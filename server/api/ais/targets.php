<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';

ensure_schema();
require_method('GET');

$cronToken = (string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
if ($cronToken === '' || config('setup_token') === '' || !hash_equals(config('setup_token'), $cronToken)) {
    respond(['error' => 'Acceso no autorizado.'], 401);
}

$row = db()->query('SELECT data FROM app_operational_state WHERE id = 1')->fetch();
$state = $row ? json_decode((string) $row['data'], true) : [];
$targets = [];
foreach (is_array($state['cases'] ?? null) ? $state['cases'] : [] as $case) {
    if (!is_array($case) || mb_strtoupper(trim((string) ($case['estado'] ?? ''))) === 'COMPLETADO') continue;
    $mmsi = preg_replace('/\D/', '', (string) ($case['mmsi'] ?? ''));
    if (strlen($mmsi) !== 9) continue;
    $targets[] = [
        'caseRef' => (string) ($case['id'] ?? ''),
        'mmsi' => $mmsi,
        'vessel' => (string) ($case['buque'] ?? ''),
        'port' => (string) ($case['puerto'] ?? ''),
    ];
}

respond(['ok' => true, 'targets' => $targets]);
