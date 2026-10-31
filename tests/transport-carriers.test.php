<?php
require __DIR__.'/../server/api/_transport_carriers.php';
function check($value,$message){if(!$value)throw new RuntimeException($message);}
function rejects($call){try{$call();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Expected validation error');}
$original=[['id'=>'legacy','nombre'=>'Legacy Ltd','contacto'=>'Original','activo'=>true]];
$created=transport_carrier_save($original,['nombre'=>'Jane Driver','tipo'=>'persona','telefono'=>'+34 600000000']);
check(count($created['providers'])===2,'preserve legacy');
check($created['providers'][0]===$original[0],'legacy unchanged');
$p=$created['provider'];check($p['revision']===1&&str_starts_with($p['id'],'PRV-'),'stable identity');
$edited=transport_carrier_save($created['providers'],array_merge($p,['telefono'=>'+34 611111111','activo'=>false]));
check($edited['provider']['id']===$p['id']&&$edited['provider']['revision']===2,'edit same entry');
check($edited['provider']['activo']===false,'archive not delete');
rejects(fn()=>transport_carrier_save($edited['providers'],$p));
rejects(fn()=>transport_carrier_save($original,['nombre'=>'legacy LTD','tipo'=>'empresa']));
rejects(fn()=>transport_carrier_save($original,['nombre'=>' ']));
rejects(fn()=>transport_carrier_save($original,['nombre'=>'Test','email'=>'bad']));
rejects(fn()=>transport_carrier_save($original,['id'=>'missing','nombre'=>'Test']));
$saved=['providers'=>$edited['providers'],'providerDirectoryManaged'=>true,'cases'=>[['id'=>'A']]];
$incoming=['providers'=>$original,'cases'=>[['id'=>'B']]];
$merged=preserve_transport_carriers($incoming,$saved);
check($merged['providers']===$edited['providers'],'stale operational writes must not erase directory');
check($merged['cases']===$incoming['cases'],'unrelated operational writes retained');
check(preserve_transport_carriers($incoming,[])===$incoming,'initial bootstrap allowed');
echo "OK: company/person validation, stable IDs, revisions, archive, duplicates, concurrent snapshot protection\n";
$deleted=transport_carrier_delete($edited['providers'],$edited['provider'],42);
check(count($deleted['providers'])===2,'history identity retained');
check($deleted['provider']['id']===$p['id']&&$deleted['provider']['activo']===false&&!empty($deleted['provider']['deletedAt']),'deleted and unavailable');
check($deleted['provider']['deletedBy']===42,'deletion audited');
check($deleted['providers'][0]===$original[0],'other entries untouched');
rejects(fn()=>transport_carrier_save($deleted['providers'],$edited['provider']));
rejects(fn()=>transport_carrier_delete($edited['providers'],$p,42));
rejects(fn()=>transport_carrier_delete($edited['providers'],['id'=>'missing'],42));
check(transport_carrier_delete($deleted['providers'],$edited['provider'],42)===$deleted,'retry is idempotent');
$recreated=transport_carrier_save($deleted['providers'],['nombre'=>'Jane Driver','tipo'=>'persona']);
check($recreated['provider']['id']!==$p['id'],'new identity does not replace historical assignments');
$stored=['providers'=>$deleted['providers'],'providerDirectoryManaged'=>true];
check(preserve_transport_carriers(['providers'=>$original],$stored)['providers']===$deleted['providers'],'stale client cannot resurrect deleted entries');
echo "OK: deletion, history preservation, stale revisions, idempotent retry, recreation and stale write protection\n";
