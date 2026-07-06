<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/_service.php';

ensure_schema();
require_method('POST');

$cronToken = (string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');
if ($cronToken === '' || config('setup_token') === '' || !hash_equals(config('setup_token'), $cronToken)) {
    respond(['error' => 'Acceso no autorizado.'], 401);
}

$payload = input();
$positions = is_array($payload['positions'] ?? null) ? $payload['positions'] : [];
$saved = ais_save_positions($positions);
respond(['ok' => true, 'saved' => $saved]);
