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
$events = is_array($state['calendarEvents'] ?? null) ? $state['calendarEvents'] : [];
$transports = is_array($state['transports'] ?? null) ? $state['transports'] : [];
$windowStart = strtotime('-12 hours');
$windowEnd = strtotime('+7 days');
foreach (is_array($state['cases'] ?? null) ? $state['cases'] : [] as $case) {
    if (!is_array($case)) continue;
    $caseStatus = mb_strtoupper(trim((string) ($case['estado'] ?? '')));
    if (in_array($caseStatus, ['COMPLETADO', 'CANCELADO'], true) || !empty($case['caseCancellation']['cancelledAt'])) continue;
    $caseRef = (string) ($case['id'] ?? '');
    $mmsi = preg_replace('/\D/', '', (string) ($case['mmsi'] ?? ''));
    if ($caseRef === '' || strlen($mmsi) !== 9) continue;

    $nearbyTransportAt = null;
    foreach (array_merge($events, $transports) as $service) {
        if (!is_array($service) || (string) ($service['expediente'] ?? '') !== $caseRef) continue;
        $serviceStatus = mb_strtoupper(trim((string) ($service['estado'] ?? '')));
        if (in_array($serviceStatus, ['CANCELADO', 'ENTREGADO', 'COMPLETADO'], true)) continue;
        $date = trim((string) ($service['fecha'] ?? ''));
        if ($date === '') continue;
        $time = trim((string) ($service['inicio'] ?? '00:00')) ?: '00:00';
        $timestamp = strtotime($date . ' ' . $time);
        if ($timestamp !== false && $timestamp >= $windowStart && $timestamp <= $windowEnd) {
            $nearbyTransportAt = $nearbyTransportAt === null ? $timestamp : min($nearbyTransportAt, $timestamp);
        }
    }
    if ($nearbyTransportAt === null) continue;

    $targets[] = [
        'caseRef' => $caseRef,
        'mmsi' => $mmsi,
        'vessel' => (string) ($case['buque'] ?? ''),
        'port' => (string) ($case['puerto'] ?? ''),
        'transportAt' => gmdate(DATE_ATOM, $nearbyTransportAt),
    ];
}

respond(['ok' => true, 'targets' => $targets]);
