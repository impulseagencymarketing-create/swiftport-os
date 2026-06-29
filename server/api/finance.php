<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

ensure_schema();
$user = require_roles(['finance', 'admin']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'PUT') {
    verify_csrf();
    $payload = input();
    $clients = $payload['clients'] ?? null;
    $invoices = $payload['invoices'] ?? null;
    if (!is_array($clients) || !is_array($invoices)) {
        respond(['error' => 'Los datos financieros no son válidos.'], 422);
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $clientStatement = $pdo->prepare(
            'INSERT INTO app_clients
             (code, name, contact, active_cases, reception_rate, storage_rate, transport_rate, surcharge_rate, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE name=VALUES(name), contact=VALUES(contact),
             active_cases=VALUES(active_cases), reception_rate=VALUES(reception_rate),
             storage_rate=VALUES(storage_rate), transport_rate=VALUES(transport_rate),
             surcharge_rate=VALUES(surcharge_rate)'
        );
        foreach ($clients as $client) {
            $clientStatement->execute([
                substr((string) ($client['codigo'] ?? ''), 0, 40),
                substr((string) ($client['nombre'] ?? ''), 0, 160),
                substr((string) ($client['contacto'] ?? ''), 0, 190),
                max(0, (int) ($client['expedientes'] ?? 0)),
                substr((string) ($client['recepcion'] ?? ''), 0, 120),
                substr((string) ($client['storage'] ?? ''), 0, 120),
                substr((string) ($client['transporte'] ?? ''), 0, 120),
                substr((string) ($client['recargo'] ?? ''), 0, 120),
            ]);
        }
        $invoiceStatement = $pdo->prepare(
            'INSERT INTO app_invoices (id, case_ref, client_name, concept, amount, status, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE case_ref=VALUES(case_ref), client_name=VALUES(client_name),
             concept=VALUES(concept), amount=VALUES(amount), status=VALUES(status), due_date=VALUES(due_date)'
        );
        foreach ($invoices as $invoice) {
            $invoiceStatement->execute([
                substr((string) ($invoice['id'] ?? ''), 0, 40),
                substr((string) ($invoice['expediente'] ?? ''), 0, 40),
                substr((string) ($invoice['cliente'] ?? ''), 0, 160),
                substr((string) ($invoice['concepto'] ?? ''), 0, 220),
                (float) ($invoice['importe'] ?? 0),
                substr((string) ($invoice['estado'] ?? ''), 0, 40),
                substr((string) ($invoice['vencimiento'] ?? ''), 0, 40),
            ]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
    audit((int) $user['id'], 'finance.update');
    respond(['ok' => true]);
}

require_method('GET');

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
