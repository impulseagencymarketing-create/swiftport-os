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

@set_time_limit(55);
try {
    $position = ais_fetch_position($apiKey, $mmsi, 35);
    if ($position === null) {
        audit((int) $user['id'], 'ais.manual_refresh_empty', ['caseRef' => $caseRef, 'mmsi' => $mmsi]);
        respond([
            'ok' => true,
            'updated' => false,
            'message' => 'No se recibió una señal nueva. Se mantiene la última posición disponible.',
        ]);
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
    respond(['error' => 'No se pudo consultar AISStream en este momento.'], 502);
}
