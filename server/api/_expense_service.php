<?php
declare(strict_types=1);

function expense_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_expense_imports (
        id CHAR(32) PRIMARY KEY, document_hash CHAR(64) NOT NULL UNIQUE,
        invoice_key CHAR(64) NOT NULL UNIQUE, data JSON NOT NULL,
        created_by BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function expense_cents(mixed $value): int {
    if (is_string($value)) $value = str_replace(',', '.', trim($value));
    if (!is_scalar($value) || is_bool($value) || !preg_match('/^-?\d+(\.\d{1,2})?$/D', (string) $value)) throw new InvalidArgumentException('Indica importes con un máximo de dos decimales.');
    $number = (float) $value;
    if (!is_finite($number) || abs($number) > 10000000) throw new InvalidArgumentException('El importe está fuera del rango permitido.');
    return (int) round($number * 100);
}
function expense_key(string $supplier, string $number): string {
    $normalize = static fn(string $text): string => preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtoupper(trim($text)));
    return hash('sha256', $normalize($supplier) . '|' . $normalize($number));
}
function expense_validate(array $payload, array $cases): array {
    $invoice = $payload['invoice'] ?? [];
    if (!is_array($invoice)) throw new InvalidArgumentException('Los datos de la factura no son válidos.');
    $invoice = array_intersect_key($invoice, array_flip(['supplier','supplierTaxId','number','date','concept','currency','cost','net','tax','total','notes','category']));
    foreach (['supplierTaxId','notes','category'] as $field) {
        if (isset($invoice[$field]) && (!is_string($invoice[$field]) || mb_strlen($invoice[$field]) > 2000)) throw new InvalidArgumentException('Revisa las notas y los datos del proveedor.');
    }
    foreach (['supplier','number','date','concept','currency'] as $field) {
        if (!is_string($invoice[$field] ?? null) || trim($invoice[$field]) === '' || mb_strlen($invoice[$field]) > 500) throw new InvalidArgumentException('Completa proveedor, número, fecha, concepto y moneda.');
        $invoice[$field] = trim($invoice[$field]);
    }
    if ($invoice['currency'] !== 'EUR') throw new InvalidArgumentException('Convierte el coste a EUR y documenta el cambio en las notas antes de registrar.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $invoice['date']);
    if (!$date || $date->format('Y-m-d') !== $invoice['date']) throw new InvalidArgumentException('Fecha de factura no válida.');
    $total = expense_cents($invoice['cost'] ?? '');
    if ($total === 0) throw new InvalidArgumentException('El coste a repartir no puede ser cero.');
    foreach (['net','tax','total'] as $field) {
        if (($invoice[$field] ?? '') !== '') expense_cents($invoice[$field]);
    }
    $allocations = $payload['allocations'] ?? [];
    if (!is_array($allocations) || !count($allocations) || count($allocations) > 100) throw new InvalidArgumentException('Selecciona entre 1 y 100 expedientes.');
    $ids = array_column($cases, 'id'); $seen = []; $sum = 0;
    foreach ($allocations as &$allocation) {
        if (!is_array($allocation)) throw new InvalidArgumentException('El reparto no es válido.');
        $ref = $allocation['caseRef'] ?? '';
        if (!is_string($ref) || !in_array($ref, $ids, true) || isset($seen[$ref])) throw new InvalidArgumentException('Revisa los expedientes: hay una referencia duplicada o inexistente.');
        $seen[$ref] = true;
        $amount = expense_cents($allocation['amount'] ?? '');
        if ($amount === 0 || ($amount > 0) !== ($total > 0)) throw new InvalidArgumentException('Cada parte debe tener el mismo signo que el gasto y un importe distinto de cero.');
        $sum += $amount;
        $allocation = ['caseRef' => $ref, 'amount' => $amount / 100];
    }
    unset($allocation);
    if ($sum !== $total) throw new InvalidArgumentException('La suma del reparto debe coincidir exactamente con el coste.');
    return ['invoice' => $invoice, 'allocations' => $allocations];
}
// Canonical imported amounts survive saves from other open tabs and older app versions.
// Only payment/review metadata may be edited through the ordinary case controls.
function expense_project(array $state, array $imports): array {
    $byCase = [];
    foreach ($imports as $import) {
        $invoice = $import['invoice'];
        foreach ($import['allocations'] as $allocation) {
            $ref = $allocation['caseRef'];
            $id = 'SCAN-' . $import['id'] . '-' . $ref;
            $byCase[$ref][$id] = [
                'id' => $id, 'source' => 'expense-scanner', 'invoiceImportId' => $import['id'],
                'fecha' => $invoice['date'], 'proveedor' => $invoice['supplier'],
                'concepto' => $invoice['concept'], 'importe' => $allocation['amount'],
                'nota' => 'Factura ' . $invoice['number'] . ' · Repartida entre ' . count($import['allocations']) . ' expediente(s). ' . ($invoice['notes'] ?? ''),
                'category' => $invoice['category'] ?? 'Otros', 'billable' => false,
                'paymentStatus' => 'Pendiente', 'receiptVerified' => true,
                'invoiceNumber' => $invoice['number'], 'attachment' => $import['attachment'],
            ];
        }
    }
    foreach ($state['cases'] as &$case) {
        $existing = is_array($case['gastos'] ?? null) ? $case['gastos'] : [];
        $manual = []; $metadata = [];
        foreach ($existing as $expense) {
            if (($expense['source'] ?? '') !== 'expense-scanner') { $manual[] = $expense; continue; }
            $metadata[$expense['id']] = array_intersect_key($expense, array_flip(['category','billable','paymentStatus','paidAt','receiptVerified']));
        }
        foreach ($byCase[$case['id']] ?? [] as $id => $expense) $manual[] = array_replace($expense, $metadata[$id] ?? []);
        $case['gastos'] = $manual;
    }
    unset($case);
    return $state;
}
function expense_load_imports(PDO $pdo): array {
    return array_map(static fn(array $row): array => json_decode($row['data'], true, 512, JSON_THROW_ON_ERROR), $pdo->query('SELECT data FROM app_expense_imports')->fetchAll());
}
