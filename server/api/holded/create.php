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
$clientProfile = $invoice['clientProfile'] ?? [];
if (!is_array($clientProfile)) {
    $clientProfile = [];
}
$clientFiscalName = trim((string) ($clientProfile['fiscalName'] ?? $clientProfile['razonSocial'] ?? $clientName));
$clientTaxId = strtoupper(trim((string) ($clientProfile['taxId'] ?? $clientProfile['nif'] ?? '')));
$concept = trim((string) ($invoice['concepto'] ?? ''));
$lines = $invoice['lines'] ?? [];
if ($clientName === '' || $concept === '' || !is_array($lines) || count($lines) === 0) {
    respond(['error' => 'Faltan cliente, concepto o líneas de factura.'], 422);
}
$purchaseOrder = strtoupper(trim((string) ($invoice['purchaseOrder'] ?? '')));
$isLimaniInvoice = stripos($clientName . ' ' . $clientFiscalName, 'limani') !== false;

function holded_with_purchase_order(string $value, string $purchaseOrder): string
{
    $clean = trim((string) preg_replace('/\s+POD\s*$/i', '', $value));
    if ($clean === '' || $purchaseOrder === '') {
        return $clean;
    }
    if (str_ends_with(strtoupper($clean), ' ' . $purchaseOrder)) {
        return $clean;
    }
    return $clean . ' ' . $purchaseOrder;
}

if ($isLimaniInvoice && $purchaseOrder === '') {
    respond(['error' => 'Falta el PO / Purchase Order de LIMANI en el expediente.'], 422);
}
if (mb_strlen($purchaseOrder) > 80) {
    respond(['error' => 'El PO / Purchase Order es demasiado largo.'], 422);
}
if ($purchaseOrder !== '') {
    $concept = holded_with_purchase_order($concept, $purchaseOrder);
    $referenceUpdated = false;
    foreach ($lines as &$line) {
        if (!is_array($line)) {
            continue;
        }
        $lineId = strtolower(trim((string) ($line['id'] ?? '')));
        $lineName = trim((string) ($line['item'] ?? ''));
        $isReference = $lineId === 'ref' || (!$referenceUpdated && preg_match('/^SW-\d{4}-\d+/i', $lineName) === 1);
        if (!$isReference) {
            continue;
        }
        $line['item'] = holded_with_purchase_order($lineName, $purchaseOrder);
        $referenceUpdated = true;
    }
    unset($line);
}
function holded_timestamp(?string $date): int
{
    $date = trim((string) $date);
    $timestamp = $date === '' ? false : strtotime($date . ' 00:00:00');
    return $timestamp ?: (strtotime('today') ?: time());
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
    return substr(trim((string) $text), 0, 220);
}

function holded_post_document(string $apiKey, string $docType, array $request, string $authMode = 'key', string $apiVersion = 'v1'): array
{
    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
    ];
    if ($authMode === 'bearer') {
        $headers[] = 'Authorization: Bearer ' . $apiKey;
    } else {
        $headers[] = 'key: ' . $apiKey;
    }

    $ch = curl_init('https://api.holded.com/api/invoicing/' . $apiVersion . '/documents/' . $docType);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, $response, $authMode, $apiVersion];
}

function holded_response_has_invalid_key(int $status, mixed $decoded, string $raw): bool
{
    if ($status !== 400 && $status !== 401 && $status !== 403) {
        return false;
    }
    $text = strtolower(holded_safe_error($decoded, $raw));
    return str_contains($text, 'invalid key')
        || str_contains($text, 'api key')
        || str_contains($text, 'unauthorized')
        || str_contains($text, 'forbidden')
        || str_contains($text, 'token');
}

function holded_try_create_document(string $apiKey, string $docType, array $request): array
{
    $attempts = [
        ['key', 'v1'],
        ['bearer', 'v1'],
        ['bearer', 'v2'],
    ];

    $last = [0, false, 'key', 'v1'];
    foreach ($attempts as [$authMode, $apiVersion]) {
        [$status, $response, $usedAuth, $usedVersion] = holded_post_document($apiKey, $docType, $request, $authMode, $apiVersion);
        $decoded = json_decode((string) $response, true);
        $last = [$status, $response, $usedAuth, $usedVersion];
        if ($status >= 200 && $status < 300) {
            return $last;
        }
        if (!holded_response_has_invalid_key($status, $decoded, (string) $response) && $status !== 404) {
            break;
        }
    }

    return $last;
}

function holded_line_tax(mixed $tax): string
{
    $tax = trim((string) $tax);
    if ($tax === '21%') {
        return 's_iva_21';
    }
    return 's_iva_0';
}

$total = (float) ($invoice['importe'] ?? 0);
$holdedItems = [];
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
    if ($total <= 0 && $units > 0) {
        $total += $units * $price;
    }
    $detail = trim((string) ($line['detail'] ?? ''));
    $item = [
        'name' => $name,
        'desc' => $detail,
        'units' => $units > 0 ? $units : 1,
        'subtotal' => $price,
        'tax' => holded_line_tax($line['tax'] ?? '0%'),
    ];
    if ($detail === '') {
        unset($item['desc']);
    }
    $holdedItems[] = $item;
}

if (!$holdedItems) {
    respond(['error' => 'No hay concepto válido para enviar a Holded.'], 422);
}

$docType = 'proform';
$notes = trim((string) ($invoice['observaciones'] ?? ''));
$request = [
    'contactName' => $clientFiscalName ?: $clientName,
    'date' => holded_timestamp(date('Y-m-d')),
    'dueDate' => holded_timestamp((string) ($invoice['vencimiento'] ?? '')),
    'desc' => $concept,
    'notes' => $notes,
    'currency' => 'EUR',
    'items' => $holdedItems,
];
if ($clientTaxId !== '') {
    $request['contactCode'] = $clientTaxId;
}

[$status, $response, $usedAuth, $usedVersion] = holded_try_create_document($apiKey, $docType, $request);

if ($status >= 400 && $status < 500) {
    $fallbackRequest = $request;
    foreach ($fallbackRequest['items'] as $index => $line) {
        unset($fallbackRequest['items'][$index]['tax']);
    }
    [$fallbackStatus, $fallbackResponse, $fallbackAuth, $fallbackVersion] = holded_try_create_document($apiKey, $docType, $fallbackRequest);
    if ($fallbackStatus >= 200 && $fallbackStatus < 300) {
        $status = $fallbackStatus;
        $response = $fallbackResponse;
        $usedAuth = $fallbackAuth;
        $usedVersion = $fallbackVersion;
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
    } elseif (holded_response_has_invalid_key($status, $decoded, (string) $response)) {
        $safeMessage = 'Holded no reconoce la clave API configurada.';
    } elseif ($status === 429) {
        $safeMessage = 'Holded ha limitado temporalmente las solicitudes.';
    } elseif ($status >= 500) {
        $safeMessage = 'Holded no está disponible ahora mismo.';
    }
    respond([
        'error' => $safeMessage,
        'holdedStatus' => 'HTTP ' . $status,
        'holdedReason' => holded_safe_error($decoded, (string) $response) . ' · Se probó key v1, Bearer v1 y Bearer v2.',
    ], 502);
}

if (!is_array($decoded)) {
    respond(['error' => 'Holded respondió con un formato inesperado.'], 502);
}

$holdedId = (string) ($decoded['id'] ?? $decoded['_id'] ?? $decoded['docId'] ?? '');
$holdedNumber = (string) ($decoded['docNumber'] ?? $decoded['number'] ?? $decoded['num'] ?? '');
$holdedAmount = is_numeric($decoded['total'] ?? null) ? round((float) $decoded['total'], 2) : round($total, 2);

audit((int) $user['id'], 'holded.proform.create', [
    'invoice' => substr((string) ($invoice['id'] ?? ''), 0, 40),
    'case' => substr((string) ($invoice['expediente'] ?? ''), 0, 40),
    'holded_id' => substr($holdedId, 0, 80),
    'auth' => $usedAuth . ' ' . $usedVersion,
]);

respond([
    'ok' => true,
    'docType' => $docType,
    'holdedId' => $holdedId,
    'holdedNumber' => $holdedNumber,
    'holdedAmount' => $holdedAmount,
    'holdedStatus' => 'Proforma simple creada',
]);
