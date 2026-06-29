<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

require_method('GET');
ensure_schema();
require_roles(['finance', 'admin']);

$caseRows = db()->query(
    'SELECT case_ref, amount FROM app_case_finance ORDER BY case_ref'
)->fetchAll();
$clientRows = db()->query(
    'SELECT code, name, contact, active_cases, reception_rate, storage_rate,
            transport_rate, surcharge_rate, active
     FROM app_clients WHERE active = 1 ORDER BY name'
)->fetchAll();
$invoiceRows = db()->query(
    'SELECT id, case_ref, client_name, concept, amount, status, due_date
     FROM app_invoices ORDER BY id DESC'
)->fetchAll();

$caseAmounts = [];
foreach ($caseRows as $row) {
    $caseAmounts[$row['case_ref']] = (float) $row['amount'];
}

respond([
    'caseAmounts' => $caseAmounts,
    'warehouseStorageTotal' => 318,
    'clients' => array_map(static fn(array $row): array => [
        'codigo' => $row['code'],
        'nombre' => $row['name'],
        'contacto' => $row['contact'],
        'expedientes' => (int) $row['active_cases'],
        'recepcion' => $row['reception_rate'],
        'storage' => $row['storage_rate'],
        'transporte' => $row['transport_rate'],
        'recargo' => $row['surcharge_rate'],
        'activo' => (bool) $row['active'],
    ], $clientRows),
    'invoices' => array_map(static fn(array $row): array => [
        'id' => $row['id'],
        'expediente' => $row['case_ref'],
        'cliente' => $row['client_name'],
        'concepto' => $row['concept'],
        'importe' => (float) $row['amount'],
        'estado' => $row['status'],
        'vencimiento' => $row['due_date'],
    ], $invoiceRows),
]);
