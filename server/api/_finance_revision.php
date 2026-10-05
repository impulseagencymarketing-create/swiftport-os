<?php
declare(strict_types=1);

final class FinanceConflict extends RuntimeException {}

function next_finance_revision(array $incoming, array $stored): int
{
    $expected = (int) ($incoming['financeRevision'] ?? 0);
    $actual = (int) ($stored['financeRevision'] ?? 0);
    if ($expected !== $actual) {
        throw new FinanceConflict('Este borrador cambió en otra sesión. No se ha sobrescrito. Conserva tus cambios antes de recargar y revisar la última versión.');
    }
    return $actual + 1;
}
