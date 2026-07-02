<?php
declare(strict_types=1);

function port_call_token(string $value): string
{
    $value = mb_strtoupper(trim($value));
    $value = preg_replace('/^(?:MV|M\/V|VSL|VESSEL|SHIP)\s+/u', '', $value) ?? $value;
    $value = preg_replace('/[^A-Z0-9]+/u', ' ', $value) ?? $value;
    return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
}

function port_call_known_value(string $value): bool
{
    $token = port_call_token($value);
    return $token !== '' && !str_contains($token, 'CONFIRMAR') && !str_contains($token, 'IDENTIFICAR');
}

function port_call_iso_date(string $value): string
{
    return preg_match('/^(20\d{2}-\d{2}-\d{2})/', trim($value), $match) ? $match[1] : '';
}

function port_call_date_distance(string $left, string $right): ?int
{
    $left = port_call_iso_date($left);
    $right = port_call_iso_date($right);
    if ($left === '' || $right === '') return null;
    $leftDate = DateTimeImmutable::createFromFormat('!Y-m-d', $left);
    $rightDate = DateTimeImmutable::createFromFormat('!Y-m-d', $right);
    if (!$leftDate || !$rightDate) return null;
    return abs((int) $leftDate->diff($rightDate)->format('%r%a'));
}

function port_call_data_has_schedule(array $data): bool
{
    foreach (['eta', 'eta_time', 'etb', 'etb_time', 'etd', 'etd_time'] as $field) {
        if (trim((string) ($data[$field] ?? '')) !== '') return true;
    }
    return false;
}

function merge_port_call_schedule(array $current, array $data): array
{
    $mapping = [
        'eta' => 'etaDate',
        'eta_time' => 'etaTime',
        'etb' => 'etbDate',
        'etb_time' => 'etbTime',
        'etd' => 'etdDate',
        'etd_time' => 'etdTime',
    ];
    foreach ($mapping as $source => $target) {
        $value = trim((string) ($data[$source] ?? ''));
        if ($value !== '') $current[$target] = $value;
    }
    if (port_call_data_has_schedule($data)) {
        $current['updatedAt'] = date(DATE_ATOM);
    }
    return $current;
}

function port_call_operational_slot(array $data, string $service): array
{
    $serviceData = is_array($data[$service] ?? null) ? $data[$service] : [];
    $date = trim((string) ($serviceData['date'] ?? ''));
    $time = trim((string) ($serviceData['time'] ?? ''));
    if ($date !== '') return [$date, $time];
    if ($service === 'transport') {
        $date = trim((string) ($data['etb'] ?? '')) ?: trim((string) ($data['eta'] ?? ''));
        $time = trim((string) ($data['etb_time'] ?? '')) ?: trim((string) ($data['eta_time'] ?? ''));
    }
    return [$date, $time];
}

function port_call_schedule_label(array $case): string
{
    $schedule = is_array($case['portCall'] ?? null) ? $case['portCall'] : [];
    $parts = [];
    foreach ([['ETA', 'etaDate', 'etaTime'], ['ETB', 'etbDate', 'etbTime'], ['ETD', 'etdDate', 'etdTime']] as [$label, $dateKey, $timeKey]) {
        $date = trim((string) ($schedule[$dateKey] ?? ''));
        $time = trim((string) ($schedule[$timeKey] ?? ''));
        if ($date !== '' || $time !== '') $parts[] = $label . ' ' . trim($date . ' ' . $time);
    }
    return implode(' · ', $parts);
}

function port_call_case_eta(array $case): string
{
    $schedule = is_array($case['portCall'] ?? null) ? $case['portCall'] : [];
    return (string) ($schedule['etaDate'] ?? $case['eta'] ?? '');
}

function find_correlated_case_ref_in_state(array $cases, array $data, string $subjectVessel = ''): string
{
    $vessel = port_call_token($subjectVessel !== '' ? $subjectVessel : (string) ($data['vessel'] ?? ''));
    if ($vessel === '') return '';

    $incomingClient = port_call_token((string) ($data['client'] ?? ''));
    $incomingPort = port_call_token((string) ($data['port'] ?? ''));
    $incomingEta = (string) ($data['eta'] ?? '');
    $incomingReference = port_call_token((string) ($data['existing_reference'] ?? ''));
    $candidates = [];

    foreach ($cases as $case) {
        if (!is_array($case) || port_call_token((string) ($case['buque'] ?? '')) !== $vessel) continue;
        if (port_call_token((string) ($case['estado'] ?? '')) === 'COMPLETADO') continue;

        $caseClient = port_call_token((string) ($case['cliente'] ?? ''));
        $casePort = port_call_token((string) ($case['puerto'] ?? ''));
        $caseReference = port_call_token((string) ($case['referenciaCliente'] ?? ''));
        $distance = port_call_date_distance($incomingEta, port_call_case_eta($case));

        if ($distance !== null && $distance > 21) continue;
        if (
            port_call_known_value($incomingPort)
            && port_call_known_value($casePort)
            && $incomingPort !== $casePort
        ) continue;
        if (
            port_call_known_value($incomingClient)
            && port_call_known_value($caseClient)
            && $incomingClient !== $caseClient
            && $caseClient !== 'LIMANI'
        ) continue;

        $score = 100;
        if ($incomingClient !== '' && $incomingClient === $caseClient) $score += 30;
        if ($caseClient === 'LIMANI') $score += 20;
        if (port_call_known_value($incomingPort) && $incomingPort === $casePort) $score += 20;
        if ($incomingReference !== '' && $incomingReference === $caseReference) $score += 80;
        if ($distance !== null) $score += $distance <= 2 ? 30 : 10;
        $candidates[] = ['id' => (string) ($case['id'] ?? ''), 'score' => $score];
    }

    if (!$candidates) return '';
    usort($candidates, static fn(array $left, array $right): int => $right['score'] <=> $left['score']);
    if (count($candidates) > 1 && $candidates[0]['score'] === $candidates[1]['score']) return '';
    return $candidates[0]['score'] >= 120 ? $candidates[0]['id'] : '';
}
