<?php
declare(strict_types=1);
require __DIR__.'/../server/api/_shared_trips.php';
function check(bool $test,string $message): void {if(!$test)throw new RuntimeException($message);}
function rejects(callable $call): void {try{$call();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Expected rejection');}
$state=['transports'=>[], 'calendarEvents'=>[], 'cases'=>[]];
foreach(['A','B'] as $id){$state['transports'][]=['id'=>$id,'expediente'=>$id,'sharedTripId'=>'VJ-1','fecha'=>'2026-10-31','inicio'=>'10:00','fin'=>'12:00','conductor'=>'Driver'];$state['calendarEvents'][]=['id'=>'E'.$id,'transporte'=>$id];$state['cases'][]=['id'=>$id,'gastos'=>[['id'=>'COST-'.$id,'source'=>'shared-trip','sharedTripId'=>'VJ-1','importe'=>50]]];}
check(shared_trips_validate($state,[],true)['calendarEvents'][1]['sharedTripId']==='VJ-1','Events retain link');
rejects(fn()=>shared_trips_validate($state,[],false));
shared_trips_validate($state,$state,false);
$bad=$state;$bad['transports'][1]['conductor']='Other';rejects(fn()=>shared_trips_validate($bad,$state,true));
$legacy=$state;foreach($legacy['transports'] as &$t)unset($t['sharedTripId']);unset($t);$legacy['cases'][0]['gastos']=[];
$restored=shared_trips_validate($legacy,$state,true);check($restored['transports'][0]['sharedTripId']==='VJ-1','Stale clients cannot dissolve trip');check(count($restored['cases'][0]['gastos'])===1,'Stale client retains expense');
$cancelled=$bad;$cancelled['transports'][1]['estado']='Cancelado';shared_trips_validate($cancelled,$state,true);
$missing=$state;array_pop($missing['transports']);rejects(fn()=>shared_trips_validate($missing,$state,true));
$removedCase=$missing;array_pop($removedCase['cases']);shared_trips_validate($removedCase,$state,true);
echo "OK: shared-trip validation, roles, common schedule, cancellation and stale-client protection\n";
