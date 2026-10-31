<?php
declare(strict_types=1);

// Older clients may omit trip metadata in a full operational snapshot. Retain
// the link; a trip is not dissolved by editing an unrelated case or document.
function shared_trips_validate(array $data, array $stored, bool $canManage): array {
    if (!is_array($data['calendarEvents'] ?? null)) $data['calendarEvents'] = [];
    $fields = ['sharedTripId','sharedTripOrder','sharedCargo','sharedTripCost','sharedTripCostShare','sharedTripCostMode','sharedTripCostProvider'];
    $old = array_column($stored['transports'] ?? [], null, 'id');
    $incomingIds=array_column($data['transports'],'id');
    $caseIds=array_column($data['cases'],'id');
    foreach ($old as $previous) {
        if (!empty($previous['sharedTripId']) && in_array($previous['expediente'],$caseIds,true) && !in_array($previous['id'],$incomingIds,true)) throw new InvalidArgumentException('Falta una entrega de un viaje compartido. Recarga los datos; cancela la entrega desde su expediente en vez de borrar el vínculo.');
    }
    $groups = []; $byId = []; $legacyTrips = [];
    foreach ($data['transports'] as &$transport) {
        $previous = $old[$transport['id'] ?? ''] ?? [];
        if (!empty($previous['sharedTripId']) && empty($transport['sharedTripId'])) {
            $legacyTrips[$previous['sharedTripId']] = true;
            foreach ($fields as $field) if (array_key_exists($field, $previous)) $transport[$field] = $previous[$field];
        }
        $tripId = (string)($transport['sharedTripId'] ?? '');
        if ($tripId === '') continue;
        if (!empty($previous['sharedTripId']) && $previous['sharedTripId'] !== $tripId) throw new InvalidArgumentException('Un servicio no puede cambiar de viaje compartido.');
        if (!$canManage) foreach ($fields as $field) {
            if (($previous[$field] ?? null) !== ($transport[$field] ?? null)) throw new InvalidArgumentException('Solo Operaciones puede crear o modificar un viaje compartido.');
        }
        $groups[$tripId][] = $transport;
        $byId[$transport['id']] = $transport;
    }
    unset($transport);
    foreach ($groups as $members) {
        if (count($members)>20 || count(array_unique(array_column($members,'expediente'))) !== count($members)) throw new InvalidArgumentException('Cada expediente debe tener una sola entrega en este viaje.');
        $common = null;
        foreach ($members as $member) {
            if (($member['estado'] ?? '') === 'Cancelado') continue;
            $schedule = array_map(static fn($key)=>(string)($member[$key]??''), ['fecha','inicio','fin','conductor','proveedorId']);
            if ($common !== null && $common !== $schedule) throw new InvalidArgumentException('Actualiza el horario y el conductor desde el viaje compartido, para todas sus entregas.');
            $common = $schedule;
        }
    }
    foreach ($data['calendarEvents'] as &$event) {
        $transport=$byId[$event['transporte']??'']??null;
        if (!$transport) continue;
        foreach ($fields as $field) if (array_key_exists($field,$transport)) $event[$field]=$transport[$field];
    }
    unset($event);
    if ($legacyTrips) {
        $oldCases=array_column($stored['cases']??[],null,'id');
        foreach ($data['cases'] as &$case) {
            $expenses=$case['gastos']??[]; $ids=array_column($expenses,'id');
            foreach (($oldCases[$case['id']]['gastos']??[]) as $expense) {
                if (($expense['source']??'')==='shared-trip' && isset($legacyTrips[$expense['sharedTripId']??'']) && !in_array($expense['id'],$ids,true)) $expenses[]=$expense;
            }
            $case['gastos']=$expenses;
        }
        unset($case);
    }
    return $data;
}
