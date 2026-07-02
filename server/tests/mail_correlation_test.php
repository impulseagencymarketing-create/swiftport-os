<?php
declare(strict_types=1);
require dirname(__DIR__) . '/api/mail/_correlation.php';

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
expect_same(
    ['2026-07-04', '14:00'],
    port_call_operational_slot([
        'transport' => ['date' => '', 'time' => ''],
        'etb' => '2026-07-04',
        'etb_time' => '16:30',
        'eta' => '2026-07-04',
        'eta_time' => '14:00',
    ], 'transport'),
    'El transporte de entrega sin hora propia debe planificarse siempre con la llegada ETA.'
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
