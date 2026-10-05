<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/_finance_revision.php';
function check(bool $value): void { if (!$value) throw new RuntimeException('Finance revision test failed'); }
check(next_finance_revision([], []) === 1);
check(next_finance_revision(['financeRevision'=>7], ['financeRevision'=>7]) === 8);
foreach ([[], ['financeRevision'=>1], ['financeRevision'=>8]] as $stale) {
    try { next_finance_revision($stale, ['financeRevision'=>7]); throw new RuntimeException('Stale write accepted'); }
    catch (FinanceConflict $error) { check(str_contains($error->getMessage(), 'No se ha sobrescrito')); }
}
echo "OK: finance revision rejects stale writes, including old tabs without revision\n";
$manual=['manualEdited'=>true,'manualEditedAt'=>'saved','lines'=>[['item'=>'STORAGE','price'=>25,'detail'=>'875 KGS']],'concepto'=>'Manual'];
protect_manual_finance($manual, $manual);
try { protect_manual_finance(array_replace($manual,['lines'=>[]]),$manual); throw new RuntimeException('Automatic reset accepted'); }
catch (FinanceConflict $error) {}
try { protect_manual_finance(['lines'=>[]],$manual); throw new RuntimeException('Legacy overwrite accepted'); }
catch (FinanceConflict $error) {}
protect_manual_finance(array_replace($manual,['manualEditedAt'=>'new edit','lines'=>[['price'=>35]]]),$manual);
echo "OK: server protects manual lines from automatic and old-client rewrites\n";
