<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_method('POST');

$cronToken = (string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
if ($cronToken === '' || config('setup_token') === '' || !hash_equals(config('setup_token'), $cronToken)) {
    respond(['error' => 'Acceso no autorizado.'], 401);
}

function ais_port_coordinates(string $port): ?array
{
    $normalized = mb_strtoupper(trim($port));
    $ports = [
        'BARCELONA' => [41.3434, 2.1662],
        'TARRAGONA' => [41.0910, 1.2164],
        'VALENCIA' => [39.4482, -0.3161],
        'SAGUNTO' => [39.6425, -0.2145],
        'CASTELLON' => [39.9667, 0.0167],
        'CASTELLÓN' => [39.9667, 0.0167],
        'ALGECIRAS' => [36.1307, -5.4380],
        'BILBAO' => [43.3550, -3.0750],
    ];
    foreach ($ports as $name => $coordinates) {
        if (str_contains($normalized, $name)) return $coordinates;
    }
    return null;
}

function ais_distance_nm(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $earthRadiusNm = 3440.065;
    $latDelta = deg2rad($lat2 - $lat1);
    $lonDelta = deg2rad($lon2 - $lon1);
    $a = sin($latDelta / 2) ** 2
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;
    return $earthRadiusNm * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function ais_operational_status(?float $distance, float $speed, int $navigationStatus): string
{
    if ($distance !== null && $distance <= 1.5 && ($navigationStatus === 5 || $speed <= 0.5)) {
        return 'Atraque probable';
    }
    if ($distance !== null && $distance <= 5) return 'En zona portuaria';
    if ($distance !== null && $distance <= 20) return 'Cerca del puerto';
    return 'En navegación';
}

$payload = input();
$positions = is_array($payload['positions'] ?? null) ? $payload['positions'] : [];
if (count($positions) > 100) respond(['error' => 'Demasiadas posiciones.'], 422);

$stateRow = db()->query('SELECT data FROM app_operational_state WHERE id = 1')->fetch();
$state = $stateRow ? json_decode((string) $stateRow['data'], true) : [];
$cases = [];
foreach (is_array($state['cases'] ?? null) ? $state['cases'] : [] as $case) {
    if (is_array($case) && !empty($case['id'])) $cases[(string) $case['id']] = $case;
}

$upsert = db()->prepare(
    'INSERT INTO app_ais_positions (case_ref, mmsi, data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE mmsi = VALUES(mmsi), data = VALUES(data), updated_at = CURRENT_TIMESTAMP'
);
$saved = 0;
foreach ($positions as $position) {
    if (!is_array($position)) continue;
    $caseRef = trim((string) ($position['caseRef'] ?? ''));
    $mmsi = preg_replace('/\D/', '', (string) ($position['mmsi'] ?? ''));
    $latitude = filter_var($position['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $longitude = filter_var($position['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
    if (!isset($cases[$caseRef]) || strlen($mmsi) !== 9 || $latitude === false || $longitude === false) continue;
    if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) continue;
    $speed = max(0, (float) ($position['speed'] ?? 0));
    $navigationStatus = (int) ($position['navigationStatus'] ?? -1);
    $portCoordinates = ais_port_coordinates((string) ($cases[$caseRef]['puerto'] ?? ''));
    $distance = $portCoordinates
        ? ais_distance_nm((float) $latitude, (float) $longitude, $portCoordinates[0], $portCoordinates[1])
        : null;
    $tracking = [
        'mmsi' => $mmsi,
        'latitude' => round((float) $latitude, 6),
        'longitude' => round((float) $longitude, 6),
        'speed' => round($speed, 1),
        'course' => round((float) ($position['course'] ?? 0), 1),
        'heading' => (int) ($position['heading'] ?? 0),
        'navigationStatus' => $navigationStatus,
        'distanceToPortNm' => $distance === null ? null : round($distance, 1),
        'status' => ais_operational_status($distance, $speed, $navigationStatus),
        'sourceTimestamp' => trim((string) ($position['timestamp'] ?? '')),
        'receivedAt' => gmdate(DATE_ATOM),
        'source' => 'AISStream · prueba gratuita',
    ];
    $upsert->execute([
        $caseRef,
        $mmsi,
        json_encode($tracking, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ]);
    $saved++;
}

respond(['ok' => true, 'saved' => $saved]);
