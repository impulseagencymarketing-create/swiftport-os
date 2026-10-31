<?php
require __DIR__.'/../server/api/_transport_waiting.php';
function check($value) { if(!$value) throw new Exception('Assertion failed'); }
$stored=['transports'=>[['id'=>'T1','waiting'=>['hours'=>1.5,'rate'=>null,'reason'=>'Terminal']]]];
$data=['transports'=>[['id'=>'T1'],['id'=>'T2','waiting'=>['hours'=>2,'rate'=>0]]],'calendarEvents'=>[['transporte'=>'T1'],['transporte'=>'T2']]];
$next=transport_waiting_validate($data,$stored);
check($next['transports'][0]['waiting']['hours']===1.5);
check($next['calendarEvents'][0]['waiting']['rate']===null);
check($next['calendarEvents'][1]['waiting']['rate']===0.0);
$data['transports'][0]['waiting']=['hours'=>0];
check(transport_waiting_validate($data,$stored)['transports'][0]['waiting']['hours']===0.0);
foreach([['hours'=>-1],['hours'=>1001],['hours'=>'bad'],['hours'=>1,'rate'=>-1],['hours'=>1.555]] as $bad){
  try {transport_waiting_normalize($bad);throw new Exception('Expected rejection');}catch(InvalidArgumentException $e){}
}
echo "OK: waiting validation, zero, missing tariff, legacy preservation, service-specific calendar sync\n";
