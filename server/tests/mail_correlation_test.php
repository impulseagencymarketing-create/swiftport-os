<?php
declare(strict_types=1);
require dirname(__DIR__) . '/api/mail/_service.php';

function expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$cases = [
    [
        'id' => 'SW-2026-0051',
        'buque' => 'TORC',
        'cliente' => 'LIMANI',
        'puerto' => 'BARCELONA',
        'eta' => '2026-07-04',
        'estado' => 'En curso',
        'referenciaCliente' => 'LIM-884',
    ],
    [
        'id' => 'SW-2026-0040',
        'buque' => 'TORC',
        'cliente' => 'LIMANI',
        'puerto' => 'BARCELONA',
        'eta' => '2026-05-10',
        'estado' => 'En curso',
    ],
    [
        'id' => 'SW-2026-0041',
        'buque' => 'LUCA IEVIOLI',
        'cliente' => 'LIMANI',
        'puerto' => 'BARCELONA',
        'eta' => '2026-07-03',
        'estado' => 'En curso',
    ],
];

expect_same(
    'SW-2026-0051',
    find_correlated_case_ref_in_state($cases, [
        'vessel' => 'M/V TORC',
        'client' => 'Consignatario Barcelona',
        'port' => 'Barcelona',
        'eta' => '2026-07-05',
        'existing_reference' => '',
    ]),
    'El segundo hilo del consignatario debe actualizar la escala activa de TORC encargada por LIMANI.'
);

expect_same(
    'SW-2026-0051',
    find_correlated_case_ref_in_state($cases, [
        'vessel' => 'LUCA IEVIOLI',
        'client' => 'Consignatario Barcelona',
        'port' => 'Barcelona',
        'eta' => '2026-07-03',
        'existing_reference' => '',
    ], 'TORC'),
    'Una referencia a LUCA IEVIOLI debe seguir actualizando el expediente objetivo TORC.'
);

expect_same(
    '',
    find_correlated_case_ref_in_state([
        $cases[0],
        array_merge($cases[0], ['id' => 'SW-2026-0052']),
    ], [
        'vessel' => 'TORC',
        'client' => 'LIMANI',
        'port' => 'Barcelona',
        'eta' => '2026-07-04',
        'existing_reference' => '',
    ]),
    'Si dos escalas son igual de probables, el sistema debe pedir revisión y no elegir al azar.'
);

expect_same(true, port_call_data_has_schedule(['etb' => '2026-07-04']), 'ETB debe considerarse una actualización operativa.');
expect_same(false, port_call_data_has_schedule(['operational_notes' => 'Sin cambios']), 'Una nota sin horario no es una actualización de escala.');
expect_same('SAPPHIRE', port_call_token('GC SAPPHIRE'), 'El tipo de buque GC no debe formar parte del nombre correlacionado.');
expect_same(
    'SW-SAPPHIRE',
    find_correlated_case_ref_in_state([
        ['id' => 'SW-SAPPHIRE', 'buque' => 'SAPPHIRE', 'cliente' => 'LIMANI', 'puerto' => 'TARRAGONA', 'eta' => '2026-07-04', 'estado' => 'En curso'],
    ], [
        'vessel' => 'GC SAPPHIRE', 'client' => 'LIMANI', 'port' => 'TARRAGONA', 'eta' => '2026-07-04', 'existing_reference' => '',
    ]),
    'Todos los correos de GC SAPPHIRE para la misma escala deben unirse en un expediente.'
);
expect_same('TORC', subject_target_vessel('RE: TORC - GABARRA - BARCELONA'), 'GABARRA nunca debe sustituir al buque TORC.');
expect_same('Transporte a gabarra', transport_service_name(['delivery_mode' => 'barge']), 'La tarea debe mostrar Transporte a gabarra.');
expect_same(
    '',
    find_correlated_case_ref_in_state([
        ['id' => 'SW-OLD-CALL', 'buque' => 'TORC', 'cliente' => 'LIMANI', 'puerto' => 'BARCELONA', 'eta' => '2026-06-20', 'estado' => 'En curso'],
    ], [
        'vessel' => 'TORC', 'client' => 'LIMANI', 'port' => 'BARCELONA', 'eta' => '2026-06-25', 'existing_reference' => '',
    ]),
    'Dos escalas del mismo buque separadas por más de dos días no deben unirse.'
);

$taskState = ['transports' => [], 'calendarEvents' => []];
append_extracted_tasks_to_state($taskState, 'SW-TASKS', 77, [
    'delivery_mode' => 'vessel',
    'tasks' => [
        [
            'kind' => 'reception', 'date' => '2026-06-03', 'time' => '10:00',
            'pickup' => 'Proveedor', 'delivery' => 'Bluespace', 'cargo' => '2 pallets',
            'summary' => 'Recepción de dos pallets', 'evidence' => 'Delivery on June 3',
            'confidence' => 0.96,
        ],
        [
            'kind' => 'delivery', 'date' => '2026-06-04', 'time' => '12:30',
            'pickup' => 'Bluespace', 'delivery' => 'MV TEST', 'cargo' => '2 pallets',
            'summary' => 'Entrega a bordo', 'evidence' => 'Deliver on board',
            'confidence' => 0.97,
        ],
        [
            'kind' => 'samples', 'date' => '', 'time' => '',
            'pickup' => 'MV TEST', 'delivery' => 'Bluespace', 'cargo' => 'Muestras',
            'summary' => 'Recoger muestras', 'evidence' => 'Collect samples',
            'confidence' => 0.95,
        ],
    ],
]);
expect_same(2, count($taskState['transports']), 'Cada trayecto debe crear un transporte independiente.');
expect_same(2, count($taskState['calendarEvents']), 'Solo las tareas con fecha y hora exactas deben entrar al calendario.');
expect_same('Por programar', $taskState['transports'][1]['hora'], 'Una tarea sin hora debe mantenerse pendiente sin inventar horario.');
append_extracted_tasks_to_state($taskState, 'SW-TASKS', 77, [
    'delivery_mode' => 'vessel',
    'tasks' => [
        [
            'kind' => 'reception', 'date' => '2026-06-03', 'time' => '10:00',
            'pickup' => 'Proveedor', 'delivery' => 'Bluespace', 'cargo' => '',
            'summary' => '', 'evidence' => '', 'confidence' => 0.96,
        ],
        [
            'kind' => 'delivery', 'date' => '2026-06-04', 'time' => '12:30',
            'pickup' => 'Bluespace', 'delivery' => 'MV TEST', 'cargo' => '',
            'summary' => '', 'evidence' => '', 'confidence' => 0.97,
        ],
        [
            'kind' => 'samples', 'date' => '', 'time' => '',
            'pickup' => 'MV TEST', 'delivery' => 'Bluespace', 'cargo' => '',
            'summary' => '', 'evidence' => '', 'confidence' => 0.95,
        ],
    ],
]);
expect_same(2, count($taskState['transports']), 'Reprocesar el mismo correo no debe duplicar transportes.');
expect_same(2, count($taskState['calendarEvents']), 'Reprocesar el mismo correo no debe duplicar eventos.');
$scheduleFallback = extract_port_call_fallbacks(
    "GC SAPPHIRE prospects\nETA: 04/07/2026 06:30\nETB: 04/07/2026 09:00\nETD: 05/07/2026 18:00\nPort stay: 36 hours",
    '2026-07-02 10:43:00'
);
expect_same('2026-07-04', $scheduleFallback['eta'], 'Debe rescatarse la fecha ETA del conjunto de correos.');
expect_same('06:30', $scheduleFallback['eta_time'], 'Debe rescatarse la hora ETA del conjunto de correos.');
expect_same('36 hours', $scheduleFallback['port_stay'], 'Debe conservarse la permanencia prevista en puerto.');
$forwarded = sanitize_email_text(
    'RE: GC SAPPHIRE at port TARRAGONA Prospects Update',
    "Best regards,\nFirma del consignatario\nDe: Port Agent\nAsunto: SAPPHIRE prospects\nETA: 04/07/2026 06:30\nStaying in port about 36 hours"
);
expect_same(true, str_contains($forwarded, 'ETA: 04/07/2026 06:30'), 'La firma no debe ocultar la ETA del mensaje reenviado.');
expect_same(
    ['2026-07-04', '16:30'],
    port_call_operational_slot([
        'transport' => ['date' => '', 'time' => ''],
        'etb' => '2026-07-04',
        'etb_time' => '16:30',
        'eta' => '2026-07-04',
        'eta_time' => '14:00',
    ], 'transport'),
    'El transporte de entrega sin hora propia debe planificarse con ETB antes que ETA.'
);
$updatedSchedule = merge_port_call_schedule(
    ['etaDate' => '2026-07-04', 'etaTime' => '14:00'],
    ['eta' => '2026-07-04', 'eta_time' => '15:00', 'etb' => '2026-07-04', 'etb_time' => '17:00']
);
expect_same('15:00', $updatedSchedule['etaTime'], 'La nueva hora ETA debe sustituir la anterior.');
expect_same('17:00', $updatedSchedule['etbTime'], 'La nueva ETB debe incorporarse al mismo expediente.');
$rebuild = prepare_operational_rebuild([
    'cases' => [
        ['id' => 'SW-OPEN', 'estado' => 'En curso'],
        ['id' => 'SW-DONE', 'estado' => 'Completado'],
    ],
    'transports' => [
        ['id' => 'TR-1', 'expediente' => 'SW-OPEN'],
        ['id' => 'TR-2', 'expediente' => 'SW-DONE'],
    ],
    'warehouseEntries' => [['id' => 'WH-1', 'expediente' => 'SW-OPEN']],
    'customs' => [],
    'calendarEvents' => [
        ['id' => 'EV-1', 'expediente' => 'SW-OPEN'],
        ['id' => 'EV-2', 'expediente' => 'SW-DONE'],
    ],
]);
expect_same(['SW-OPEN'], $rebuild['openRefs'], 'La reconstrucción debe seleccionar únicamente expedientes abiertos.');
expect_same(['SW-DONE'], array_column($rebuild['state']['cases'], 'id'), 'Los expedientes completados deben conservarse.');
expect_same(['TR-2'], array_column($rebuild['state']['transports'], 'id'), 'Debe conservarse el transporte histórico completado.');
expect_same(['EV-2'], array_column($rebuild['state']['calendarEvents'], 'id'), 'Debe conservarse el calendario histórico completado.');

echo "mail_correlation_test: OK\n";
