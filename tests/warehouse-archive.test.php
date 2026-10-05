<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/_warehouse_archive.php';
set_error_handler(static function(int $severity, string $message): never { throw new RuntimeException($message); });
$fixtures = json_decode(file_get_contents(__DIR__ . '/warehouseArchive.fixtures.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($fixtures as $fixture) {
    $state = ['cases' => $fixture['cases'], 'warehouseEntries' => $fixture['entries'], 'unrelated' => ['keep' => true]];
    $result = warehouse_archive_project($state);
    $entry = $result['warehouseEntries'][0];
    if ((bool) ($entry['archivado'] ?? false) !== $fixture['archived']) throw new RuntimeException($fixture['name']);
    if (!$fixture['archived'] && $result !== $state) throw new RuntimeException('unexpected change: '.$fixture['name']);
    foreach (['fotos','documentosRecepcion','bultos','peso'] as $field)
        if ($entry[$field] !== $fixture['entries'][0][$field]) throw new RuntimeException('lost evidence');
    if (warehouse_archive_project($result) !== $result) throw new RuntimeException('not idempotent');
    if ($result['unrelated'] !== $state['unrelated']) throw new RuntimeException('unrelated data changed');
    if ($fixture['archived'] && !$fixture['entries'][0]['archivado']) {
        $expected = $fixture['entries'][0]['salida'] ?? $fixture['cases'][0]['deliveryConfirmedAt'] ?? null;
        if (($entry['salida'] ?? null) !== $expected) throw new RuntimeException('wrong departure');
    }
}
$minimal=['cases'=>[['id'=>'CASE','estado'=>'Completado','recepciones'=>[['ref'=>'ALM']]]],'warehouseEntries'=>[['ref'=>'ALM']]];
if (warehouse_archive_project($minimal)['warehouseEntries'][0]['expediente'] !== 'CASE') throw new RuntimeException('missing link');
echo 'OK: '.count($fixtures).' warehouse archive fixtures, evidence preservation and idempotence'.PHP_EOL;
