<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/_expense_service.php';
$checks = 0;
function check(bool $ok, string $message): void { global $checks; $checks++; if (!$ok) throw new RuntimeException($message); }
function rejects(callable $action, string $message): void { try {$action();} catch (InvalidArgumentException $error) {check(true,$message); return;} check(false,$message); }
$cases = [['id'=>'A','gastos'=>[['id'=>'manual','importe'=>10]]],['id'=>'B'],['id'=>'C']];
$payload = ['invoice'=>['supplier'=>'Test Supplier','number'=>'F-100','date'=>'2026-09-09','concept'=>'Freight','currency'=>'EUR','cost'=>'100,00','net'=>'100','tax'=>'21','total'=>'121','notes'=>'Reviewed'], 'allocations'=>[['caseRef'=>'A','amount'=>'33.34'],['caseRef'=>'B','amount'=>'33.33'],['caseRef'=>'C','amount'=>'33.33']]];
$valid = expense_validate($payload,$cases);
check(array_sum(array_column($valid['allocations'],'amount'))===100.0,'exact total');
check(expense_cents('19,90')===1990,'Spanish decimal');
foreach (['','1.001','1e3','NaN','10000001',[],true] as $value) rejects(fn()=>expense_cents($value),'invalid amount');
foreach (['cost'=>'0','date'=>'2026-02-31','currency'=>'USD','notes'=>['bad']] as $field=>$value) {
    $bad=$payload; $bad['invoice'][$field]=$value; rejects(fn()=>expense_validate($bad,$cases),'invalid invoice '.$field);
}
$bad=$payload;$bad['allocations'][0]['amount']='33.33'; rejects(fn()=>expense_validate($bad,$cases),'unbalanced split');
$bad=$payload;$bad['allocations'][1]['caseRef']='A'; rejects(fn()=>expense_validate($bad,$cases),'duplicate case');
$bad=$payload;$bad['allocations'][1]['caseRef']='UNKNOWN'; rejects(fn()=>expense_validate($bad,$cases),'missing case');
$bad=$payload;$bad['allocations'][1]='bad'; rejects(fn()=>expense_validate($bad,$cases),'invalid allocation');
$bad=$payload;$bad['invoice']='bad'; rejects(fn()=>expense_validate($bad,$cases),'invalid invoice object');
$credit=$payload;$credit['invoice']['cost']='-100';foreach($credit['allocations'] as &$part)$part['amount']='-'.$part['amount'];unset($part);
check(array_sum(array_column(expense_validate($credit,$cases)['allocations'],'amount'))===-100.0,'credit total');
$bad=$payload;$bad['allocations'][1]['amount']='-33.33'; rejects(fn()=>expense_validate($bad,$cases),'mixed signs');
check(expense_key(' Test Supplier ','F-100')===expense_key('TEST SUPPLIER','F100'),'duplicate normalization');
check(expense_key('Other Supplier','F100')!==expense_key('Test Supplier','F100'),'different suppliers');
$import=['id'=>'test','invoice'=>$valid['invoice'],'allocations'=>$valid['allocations'],'attachment'=>['id'=>'file','url'=>'/api/uploads.php?id=file']];
$state=['cases'=>$cases];$projected=expense_project($state,[$import]);
check(count($projected['cases'][0]['gastos'])===2,'manual expense preserved');
check(count($projected['cases'][1]['gastos'])===1,'second case receives one share');
check($projected===expense_project($projected,[$import]),'projection is idempotent');
$projected['cases'][0]['gastos'][1]['importe']=999;
$projected['cases'][0]['gastos'][1]['paymentStatus']='Pagado';
$repaired=expense_project($projected,[$import]);
check($repaired['cases'][0]['gastos'][1]['importe']===33.34,'canonical amount cannot be altered by stale snapshot');
check($repaired['cases'][0]['gastos'][1]['paymentStatus']==='Pagado','payment metadata preserved');
check(expense_project($state,[$import])['cases'][1]['gastos'][0]['importe']===33.33,'old tabs cannot erase imported expenses');
echo "OK: $checks expense service checks\n";
