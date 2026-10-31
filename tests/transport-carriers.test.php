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
