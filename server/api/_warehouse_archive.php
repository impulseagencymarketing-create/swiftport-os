<?php
declare(strict_types=1);

function warehouse_reference(mixed $value): string { return strtoupper(trim((string) ($value ?? ''))); }
function warehouse_case_closed(?array $case): bool
{
    if (!$case) return false;
    $status = warehouse_reference($case['estado'] ?? $case['status'] ?? '');
    $cancellation = $case['caseCancellation'] ?? [];
    if (in_array($status, ['CANCELADO','CANCELADA','CANCELLED','CANCELED'], true)
        || !empty($cancellation['cancelledAt']) || !empty($cancellation['sentToBilling'])) return false;
    $flow = $case['operationalFlow'] ?? [];
    return in_array($status, ['COMPLETADO','CERRADO','CLOSED','COMPLETED'], true)
        || in_array($flow['delivery'] ?? false, [true, 1, '1'], true)
        || in_array($flow['pod'] ?? false, [true, 1, '1'], true);
}

function warehouse_archive_project(array $state): array
{
    if (!is_array($state['cases'] ?? null) || !is_array($state['warehouseEntries'] ?? null)) return $state;
    $byId = []; $byReception = [];
    foreach ($state['cases'] as $case) {
        if (!is_array($case) || !($id = warehouse_reference($case['id'] ?? ''))) continue;
        $byId[$id] = array_key_exists($id, $byId) ? null : $case;
        foreach (is_array($case['recepciones'] ?? null) ? $case['recepciones'] : [] as $reception) {
            $ref = warehouse_reference(is_array($reception) ? ($reception['ref'] ?? '') : '');
            if ($ref === '') continue;
            if (!array_key_exists($ref, $byReception)) $byReception[$ref] = $case;
            elseif (warehouse_reference($byReception[$ref]['id'] ?? '') !== $id) $byReception[$ref] = null;
        }
    }
    foreach ($state['warehouseEntries'] as &$entry) {
        if (!is_array($entry) || !empty($entry['archivado'])) continue;
        $id = warehouse_reference($entry['expediente'] ?? '');
        $case = $id !== '' ? ($byId[$id] ?? null) : ($byReception[warehouse_reference($entry['ref'] ?? '')] ?? null);
        if (!warehouse_case_closed($case)) continue;
        $delivered = (string) ($case['deliveryConfirmedAt'] ?? '');
        $received = (string) ($entry['fechaRecepcion'] ?? '');
        if ($delivered !== '' && $received !== '' && strtotime($delivered) !== false
            && strtotime($received) !== false && strtotime($received) > strtotime($delivered)) continue;
        $entry['expediente'] = ($entry['expediente'] ?? '') ?: $case['id'];
        $entry['estado'] = 'Expedido';
        $entry['archivado'] = true;
        $entry['archiveReason'] = ($entry['archiveReason'] ?? '') ?: 'case_delivery';
        $entry['archivedByCase'] = $case['id'];
        if (empty($entry['salida']) && $delivered !== '' && strtotime($delivered) !== false) $entry['salida'] = $delivered;
    }
    unset($entry);
    return $state;
}
