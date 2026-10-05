<?php
declare(strict_types=1);

final class FinanceConflict extends RuntimeException {}

function protect_manual_finance(array $incoming, array $stored): void
{
    if (($stored['manualEdited'] ?? false) !== true) return;
    if (($incoming['manualEdited'] ?? false) !== true) {
        throw new FinanceConflict('Este borrador tiene una edición manual protegida. Actualiza la aplicación antes de guardarlo.');
    }
    if (($incoming['manualEditedAt'] ?? '') !== ($stored['manualEditedAt'] ?? '')) return;
    foreach (['lines', 'concepto', 'cliente', 'observaciones'] as $field) {
        // MySQL JSON may reorder object keys; compare values, not PHP key order.
        if (($incoming[$field] ?? null) != ($stored[$field] ?? null)) {
            throw new FinanceConflict('Una actualización automática intentó cambiar tu edición manual. Se conserva la versión guardada.');
        }
    }
}

function next_finance_revision(array $incoming, array $stored): int
{
    $expected = (int) ($incoming['financeRevision'] ?? 0);
    $actual = (int) ($stored['financeRevision'] ?? 0);
    if ($expected !== $actual) {
        throw new FinanceConflict('Este borrador cambió en otra sesión. No se ha sobrescrito. Conserva tus cambios antes de recargar y revisar la última versión.');
    }
    return $actual + 1;
}
