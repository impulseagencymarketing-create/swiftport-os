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

function holded_document_source_id(array $document): string
{
    foreach (['from', 'source', 'origin', 'convertedFrom', 'source_document'] as $key) {
        $source = $document[$key] ?? null;
        if (is_array($source)) {
            $id = trim((string) ($source['id'] ?? $source['_id'] ?? $source['documentId'] ?? ''));
            if ($id !== '') {
                return $id;
            }
        }
    }
    foreach (['fromId', 'sourceId', 'proformId', 'proformaId'] as $key) {
        $id = trim((string) ($document[$key] ?? ''));
        if ($id !== '') {
            return $id;
        }
    }
    return '';
}

function holded_document_amount(array $document): ?float
{
    foreach (['total', 'amount', 'totalAmount', 'total_with_taxes', 'totalWithTaxes'] as $key) {
        if (isset($document[$key]) && is_numeric($document[$key])) {
            return round((float) $document[$key], 2);
        }
    }
    return null;
}

function holded_document_number(array $document): string
{
    return trim((string) ($document['document_number'] ?? $document['docNumber'] ?? $document['invoiceNum'] ?? $document['invoiceNumber'] ?? $document['number'] ?? $document['num'] ?? ''));
}

function holded_v2_invoice_map(string $apiKey, array $targetIds): array
{
    $targets = array_fill_keys(array_filter($targetIds), true);
    if (!$targets) {
        return [];
    }
    $found = [];
    $cursor = '';
    for ($page = 0; $page < 3; $page++) {
        $query = 'limit=100&sort=-date' . ($cursor !== '' ? '&cursor=' . rawurlencode($cursor) : '');
        $ch = curl_init('https://api.holded.com/api/v2/invoices?' . $query);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'Authorization: Bearer ' . $apiKey],
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($response === false || $status < 200 || $status >= 300) {
            break;
        }
        $decoded = json_decode((string) $response, true);
        foreach (holded_document_list($decoded) as $document) {
            $sourceId = holded_document_source_id($document);
            if ($sourceId !== '' && isset($targets[$sourceId])) {
                $found[$sourceId] = $document;
            }
        }
        if (count($found) >= count($targets) || !is_array($decoded) || empty($decoded['has_more'])) {
            break;
        }
        $cursor = trim((string) ($decoded['cursor'] ?? ''));
        if ($cursor === '') {
            break;
        }
    }
    return $found;
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

$targetHoldedIds = [];
foreach ($invoices as $invoice) {
    $targetId = trim((string) ($invoice['holdedId'] ?? ''));
    if ($targetId !== '') {
        $targetHoldedIds[] = $targetId;
    }
}
$invoiceByProform = holded_v2_invoice_map($apiKey, $targetHoldedIds);
[$invoiceListStatus, $invoiceListResponse] = holded_status_try_get($apiKey, 'documents/invoice?sort=created-desc');
if ($invoiceListStatus >= 200 && $invoiceListStatus < 300) {
    $invoiceListDecoded = json_decode((string) $invoiceListResponse, true);
    foreach (holded_document_list($invoiceListDecoded) as $document) {
        $sourceId = holded_document_source_id($document);
        if ($sourceId !== '' && in_array($sourceId, $targetHoldedIds, true) && !isset($invoiceByProform[$sourceId])) {
            $invoiceByProform[$sourceId] = $document;
        }
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
    $isBilled = isset($billedById[$holdedId]) || isset($invoiceByProform[$holdedId]);
    $document = $invoiceByProform[$holdedId] ?? [];
    $sentAmount = round((float) ($invoice['sentAmount'] ?? 0), 2);
    $invoicedAmount = $document ? holded_document_amount($document) : null;
    $priceVerified = $isBilled && $invoicedAmount !== null;
    $difference = $priceVerified ? round($invoicedAmount - $sentAmount, 2) : null;
    $priceMatches = $priceVerified ? abs((float) $difference) < 0.01 : null;
    $results[] = [
        'id' => $localId,
        'holdedId' => $holdedId,
        'verified' => true,
        'billed' => $isBilled,
        'holdedStatus' => $isBilled
            ? ($priceVerified ? 'Facturada y precio confirmado directamente en Holded' : 'Facturada en Holded - precio final pendiente de lectura')
            : 'Proforma confirmada en Holded · todavía no facturada',
        'holdedCheckedAt' => $checkedAt,
        'holdedInvoiceId' => holded_document_id($document),
        'holdedInvoiceNumber' => holded_document_number($document),
        'holdedSentAmount' => $sentAmount,
        'holdedInvoicedAmount' => $invoicedAmount,
        'holdedPriceVerified' => $priceVerified,
        'holdedPriceMatches' => $priceMatches,
        'holdedPriceDifference' => $difference,
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
