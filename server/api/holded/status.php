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
$invoices = $payload['invoices'] ?? [];
if (!is_array($invoices)) {
    respond(['error' => 'La lista de documentos de Holded no es válida.'], 422);
}
$invoices = array_slice(array_values(array_filter($invoices, 'is_array')), 0, 100);
if (!$invoices) {
    respond(['error' => 'No hay documentos enviados a Holded para comprobar.'], 422);
}

function holded_status_safe_error(mixed $decoded, string $raw): string
{
    $message = '';
    if (is_array($decoded)) {
        foreach (['error', 'message', 'msg', 'detail', 'description'] as $key) {
            if (isset($decoded[$key]) && is_scalar($decoded[$key])) {
                $message = (string) $decoded[$key];
                break;
            }
        }
    }
    if ($message === '') {
        $message = trim(strip_tags($raw));
    }
    $message = preg_replace('/\s+/', ' ', $message);
    $message = preg_replace('/sk-[A-Za-z0-9_\-]+/', '[clave oculta]', (string) $message);
    return substr(trim((string) $message), 0, 220);
}

function holded_status_get(string $apiKey, string $path, string $authMode = 'key', string $apiVersion = 'v1'): array
{
    $headers = ['Accept: application/json'];
    $headers[] = $authMode === 'bearer' ? 'Authorization: Bearer ' . $apiKey : 'key: ' . $apiKey;
    $normalizedPath = preg_replace('#^v[12]/#', '', ltrim($path, '/'));
    $url = 'https://api.holded.com/api/invoicing/' . $apiVersion . '/' . $normalizedPath;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, $response, $authMode, $apiVersion];
}

function holded_status_invalid_key(int $status, mixed $decoded, string $raw): bool
{
    if (!in_array($status, [400, 401, 403], true)) {
        return false;
    }
    $text = strtolower(holded_status_safe_error($decoded, $raw));
    return str_contains($text, 'invalid key')
        || str_contains($text, 'api key')
        || str_contains($text, 'unauthorized')
        || str_contains($text, 'forbidden')
        || str_contains($text, 'token');
}

function holded_status_try_get(string $apiKey, string $path): array
{
    $attempts = [['key', 'v1'], ['bearer', 'v1'], ['bearer', 'v2']];
    $last = [0, false, 'key', 'v1'];
    foreach ($attempts as [$authMode, $apiVersion]) {
        [$status, $response, $usedAuth, $usedVersion] = holded_status_get($apiKey, $path, $authMode, $apiVersion);
        $decoded = json_decode((string) $response, true);
        $last = [$status, $response, $usedAuth, $usedVersion];
        if ($status >= 200 && $status < 300) {
            return $last;
        }
        if (!holded_status_invalid_key($status, $decoded, (string) $response) && $status !== 404) {
            break;
        }
    }
    return $last;
}

function holded_document_id(array $document): string
{
    return trim((string) ($document['id'] ?? $document['_id'] ?? $document['docId'] ?? ''));
}

function holded_document_list(mixed $decoded): array
{
    if (!is_array($decoded)) {
        return [];
    }
    foreach (['documents', 'items', 'data', 'results'] as $key) {
        if (isset($decoded[$key]) && is_array($decoded[$key])) {
            return array_values(array_filter($decoded[$key], 'is_array'));
        }
    }
    return array_is_list($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
}

[$status, $response, $usedAuth, $usedVersion] = holded_status_try_get(
    $apiKey,
    'documents/proform?billed=1&sort=created-desc'
);
if ($response === false) {
    respond(['error' => 'No se pudo conectar con Holded para verificar la facturación.'], 502);
}
$decoded = json_decode((string) $response, true);
if ($status < 200 || $status >= 300) {
    $message = $status === 401 || $status === 403
        ? 'Holded rechazó la clave API o sus permisos.'
        : 'Holded no pudo verificar las proformas facturadas.';
    respond([
        'error' => $message,
        'holdedStatus' => 'HTTP ' . $status,
        'holdedReason' => holded_status_safe_error($decoded, (string) $response),
    ], 502);
}

$billedDocuments = holded_document_list($decoded);
$billedById = [];
foreach ($billedDocuments as $document) {
    $documentId = holded_document_id($document);
    if ($documentId !== '') {
        $billedById[$documentId] = $document;
    }
}

$checkedAt = gmdate('c');
$results = [];
foreach ($invoices as $invoice) {
    $localId = substr(trim((string) ($invoice['id'] ?? '')), 0, 80);
    $holdedId = substr(trim((string) ($invoice['holdedId'] ?? '')), 0, 120);
    if ($holdedId === '') {
        $results[] = [
            'id' => $localId,
            'holdedId' => '',
            'verified' => false,
            'billed' => false,
            'holdedStatus' => 'Sin ID de Holded: no se puede verificar',
            'holdedCheckedAt' => $checkedAt,
        ];
        continue;
    }
    $isBilled = isset($billedById[$holdedId]);
    $document = $billedById[$holdedId] ?? [];
    $results[] = [
        'id' => $localId,
        'holdedId' => $holdedId,
        'verified' => true,
        'billed' => $isBilled,
        'holdedStatus' => $isBilled
            ? 'Facturada: confirmado directamente en Holded'
            : 'Proforma confirmada en Holded · todavía no facturada',
        'holdedCheckedAt' => $checkedAt,
        'holdedInvoiceId' => (string) ($document['invoiceId'] ?? $document['billedId'] ?? ''),
        'holdedInvoiceNumber' => (string) ($document['invoiceNum'] ?? $document['invoiceNumber'] ?? ''),
    ];
}

$billedCount = count(array_filter($results, static fn(array $result): bool => $result['billed'] === true));
audit((int) $user['id'], 'holded.proform.verify', [
    'documents' => count($results),
    'billed' => $billedCount,
    'auth' => $usedAuth . ' ' . $usedVersion,
]);

respond([
    'ok' => true,
    'checkedAt' => $checkedAt,
    'checked' => count($results),
    'billed' => $billedCount,
    'items' => $results,
]);
