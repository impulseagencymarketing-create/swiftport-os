<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();
require_method('POST');
$user = require_auth();
verify_csrf();

$payload = input();
$caseRef = trim((string) ($payload['caseRef'] ?? ''));
$cases = ais_operational_cases();
if ($caseRef === '' || !isset($cases[$caseRef])) {
    respond(['error' => 'El expediente no existe.'], 404);
}
$mmsi = preg_replace('/\D/', '', (string) ($cases[$caseRef]['mmsi'] ?? ''));
if (strlen($mmsi) !== 9) {
    respond(['error' => 'Añade un MMSI válido de 9 dígitos al expediente.'], 422);
}
$apiKey = config('aisstream_api_key');
if ($apiKey === '') {
    respond(['error' => 'El seguimiento AIS todavía no está configurado.'], 503);
}

$lastRefresh = (int) ($_SESSION['ais_refresh'][$caseRef] ?? 0);
if ($lastRefresh > 0 && time() - $lastRefresh < 20) {
    respond(['error' => 'Espera unos segundos antes de volver a consultar.'], 429);
}
$_SESSION['ais_refresh'][$caseRef] = time();

$queue = db()->prepare(
    "INSERT INTO app_ais_refresh_requests
        (case_ref, mmsi, status, attempts, requested_by, requested_at, processed_at)
     VALUES (?, ?, 'pending', 0, ?, CURRENT_TIMESTAMP, NULL)
     ON DUPLICATE KEY UPDATE
        mmsi = VALUES(mmsi),
        status = 'pending',
        attempts = 0,
        requested_by = VALUES(requested_by),
        requested_at = CURRENT_TIMESTAMP,
        processed_at = NULL"
);
$queue->execute([$caseRef, $mmsi, (int) $user['id']]);

@set_time_limit(30);
try {
    $position = ais_fetch_position($apiKey, $mmsi, 10);
    if ($position === null) {
        audit((int) $user['id'], 'ais.manual_refresh_queued', ['caseRef' => $caseRef, 'mmsi' => $mmsi]);
        respond([
            'ok' => true,
            'updated' => false,
            'queued' => true,
            'message' => 'Solicitud AIS enviada. Se actualizará en los próximos minutos.',
        ], 202);
    }
    $position['caseRef'] = $caseRef;
    $saved = ais_save_positions([$position]);
    audit((int) $user['id'], 'ais.manual_refresh', ['caseRef' => $caseRef, 'mmsi' => $mmsi]);
    respond([
        'ok' => true,
        'updated' => $saved === 1,
        'message' => $saved === 1 ? 'Posición AIS actualizada.' : 'No se pudo guardar la nueva posición.',
    ]);
} catch (Throwable $error) {
    error_log('Swiftport manual AIS refresh failed: ' . $error->getMessage());
    audit((int) $user['id'], 'ais.manual_refresh_queued', ['caseRef' => $caseRef, 'mmsi' => $mmsi]);
    respond([
        'ok' => true,
        'updated' => false,
        'queued' => true,
        'message' => 'Solicitud AIS enviada. Se actualizará en los próximos minutos.',
    ], 202);
}
