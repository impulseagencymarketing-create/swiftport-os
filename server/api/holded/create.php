<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
$user = require_roles(['finance', 'admin']);
require_method('POST');
verify_csrf();

$apiKey = trim(config('holded_api_key'));
if ($apiKey === '') {
    respond(['error' => 'Holded todavía no está configurado. Falta HOLDED_API_KEY en GitHub Secrets.'], 503);
}

$payload = input();
$invoice = $payload['invoice'] ?? null;
if (!is_array($invoice)) {
    respond(['error' => 'El borrador de factura no es válido.'], 422);
}

$clientName = trim((string) ($invoice['cliente'] ?? ''));
$concept = trim((string) ($invoice['concepto'] ?? ''));
$lines = $invoice['lines'] ?? [];
if ($clientName === '' || $concept === '' || !is_array($lines) || count($lines) === 0) {
    respond(['error' => 'Faltan cliente, concepto o líneas de factura.'], 422);
}

function holded_timestamp(?string $date): int
{
    $date = trim((string) $date);
    $timestamp = $date === '' ? false : strtotime($date . ' 00:00:00');
    return $timestamp ?: (strtotime('today') ?: time());
}

function holded_tax_value(mixed $value): string
{
    $tax = strtoupper(trim((string) $value));
    return str_contains($tax, '21') ? 's_iva_21' : 's_iva_0';
}

function holded_safe_error(mixed $decoded, string $raw): string
{
    $candidates = [];
    if (is_array($decoded)) {
        foreach (['error', 'message', 'msg', 'detail', 'description'] as $key) {
            if (isset($decoded[$key]) && is_scalar($decoded[$key])) {
                $candidates[] = (string) $decoded[$key];
            }
        }
        if (isset($decoded['errors']) && is_array($decoded['errors'])) {
            foreach ($decoded['errors'] as $error) {
                if (is_scalar($error)) {
                    $candidates[] = (string) $error;
                } elseif (is_array($error)) {
                    foreach (['message', 'msg', 'detail'] as $key) {
                        if (isset($error[$key]) && is_scalar($error[$key])) {
                            $candidates[] = (string) $error[$key];
                        }
                    }
                }
            }
        }
    }
    if (!$candidates) {
        $plain = trim(strip_tags($raw));
        if ($plain !== '') {
            $candidates[] = $plain;
        }
    }
    $text = preg_replace('/\s+/', ' ', implode(' ', $candidates));
    $text = preg_replace('/sk-[A-Za-z0-9_\-]+/', '[clave oculta]', (string) $text);
    return mb_substr(trim((string) $text), 0, 220);
}

$items = [];
foreach ($lines as $line) {
    if (!is_array($line)) {
        continue;
    }
    $name = trim((string) ($line['item'] ?? ''));
    if ($name === '') {
        continue;
    }
    $units = max(0.0, (float) ($line['units'] ?? 1));
    $price = max(0.0, (float) ($line['price'] ?? 0));
    if ($units <= 0) {
        continue;
    }
    $items[] = [
        'name' => $name,
        'desc' => trim((string) ($line['detail'] ?? '')),
        'units' => $units,
        'subtotal' => $price,
        'tax' => holded_tax_value($line['tax'] ?? '0%'),
    ];
}

if (!$items) {
    respond(['error' => 'No hay líneas válidas para enviar a Holded.'], 422);
}

$docType = 'proform';
$request = [
    'contactName' => $clientName,
    'date' => holded_timestamp(date('Y-m-d')),
    'dueDate' => holded_timestamp((string) ($invoice['vencimiento'] ?? '')),
    'desc' => $concept,
    'notes' => trim((string) ($invoice['observaciones'] ?? '')),
    'currency' => 'EUR',
    'items' => $items,
];

function holded_post_document(string $apiKey, string $docType, array $request): array
{
    $ch = curl_init('https://api.holded.com/api/invoicing/v1/documents/' . $docType);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'key: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, $response];
}

[$status, $response] = holded_post_document($apiKey, $docType, $request);

if ($status >= 400 && $status < 500) {
    $billableItems = array_values(array_filter($items, static fn(array $item): bool => ((float) ($item['subtotal'] ?? 0)) > 0 && ((float) ($item['units'] ?? 0)) > 0));
    if ($billableItems && count($billableItems) < count($items)) {
        $fallbackRequest = $request;
        $fallbackRequest['notes'] = trim(($request['notes'] ? $request['notes'] . "\n\n" : '') . 'Detalle operativo en Swiftport: ' . $concept);
        $fallbackRequest['items'] = $billableItems;
        [$fallbackStatus, $fallbackResponse] = holded_post_document($apiKey, $docType, $fallbackRequest);
        if ($fallbackStatus >= 200 && $fallbackStatus < 300) {
            $status = $fallbackStatus;
            $response = $fallbackResponse;
        }
    }
}

if ($response === false) {
    respond(['error' => 'No se pudo conectar con Holded.'], 502);
}

$decoded = json_decode((string) $response, true);
if ($status < 200 || $status >= 300) {
    $safeMessage = 'Holded rechazó la proforma.';
    if ($status === 401 || $status === 403) {
        $safeMessage = 'Holded rechazó la clave API o permisos.';
    } elseif ($status === 429) {
        $safeMessage = 'Holded ha limitado temporalmente las solicitudes.';
    } elseif ($status >= 500) {
        $safeMessage = 'Holded no está disponible ahora mismo.';
    }
    respond([
        'error' => $safeMessage,
        'holdedStatus' => 'HTTP ' . $status,
        'holdedReason' => holded_safe_error($decoded, (string) $response),
    ], 502);
}

if (!is_array($decoded)) {
    respond(['error' => 'Holded respondió con un formato inesperado.'], 502);
}

$holdedId = (string) ($decoded['id'] ?? $decoded['_id'] ?? $decoded['docId'] ?? '');
$holdedNumber = (string) ($decoded['docNumber'] ?? $decoded['number'] ?? $decoded['num'] ?? '');

audit((int) $user['id'], 'holded.proform.create', [
    'invoice' => substr((string) ($invoice['id'] ?? ''), 0, 40),
    'case' => substr((string) ($invoice['expediente'] ?? ''), 0, 40),
    'holded_id' => substr($holdedId, 0, 80),
]);

respond([
    'ok' => true,
    'docType' => $docType,
    'holdedId' => $holdedId,
    'holdedNumber' => $holdedNumber,
    'holdedStatus' => 'Proforma creada',
]);
