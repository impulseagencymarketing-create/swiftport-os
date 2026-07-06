<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();

$cronToken = (string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
if ($cronToken === '' || config('setup_token') === '' || !hash_equals(config('setup_token'), $cronToken)) {
    respond(['error' => 'Acceso no autorizado.'], 401);
}

db()->exec(
    "UPDATE app_ais_refresh_requests
     SET status = 'failed', processed_at = CURRENT_TIMESTAMP
     WHERE status = 'pending' AND attempts >= 6"
);
$requests = db()->query(
    "SELECT case_ref, mmsi
     FROM app_ais_refresh_requests
     WHERE status = 'pending' AND attempts < 6
     ORDER BY requested_at ASC
     LIMIT 20"
)->fetchAll();
$cases = ais_operational_cases();
$targets = [];
$increment = db()->prepare(
    "UPDATE app_ais_refresh_requests
     SET attempts = attempts + 1
     WHERE case_ref = ? AND status = 'pending'"
);
foreach ($requests as $request) {
    $caseRef = trim((string) ($request['case_ref'] ?? ''));
    $mmsi = preg_replace('/\D/', '', (string) ($request['mmsi'] ?? ''));
    if (!isset($cases[$caseRef]) || strlen($mmsi) !== 9) continue;
    $currentMmsi = preg_replace('/\D/', '', (string) ($cases[$caseRef]['mmsi'] ?? ''));
    if ($currentMmsi !== $mmsi) continue;
    $targets[] = [
        'caseRef' => $caseRef,
        'vessel' => (string) ($cases[$caseRef]['buque'] ?? ''),
        'mmsi' => $mmsi,
        'port' => (string) ($cases[$caseRef]['puerto'] ?? ''),
    ];
    $increment->execute([$caseRef]);
}

respond(['ok' => true, 'targets' => $targets]);
