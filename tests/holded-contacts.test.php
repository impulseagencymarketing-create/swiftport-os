<?php
declare(strict_types=1);
require __DIR__.'/../server/api/holded/_contacts.php';
function check_contact(bool $ok,string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects_contact(callable $work,string $text): void {
    try { $work(); } catch (InvalidArgumentException|RuntimeException $e) { check_contact(str_contains($e->getMessage(),$text),'Unexpected error: '.$e->getMessage()); return; }
    throw new RuntimeException('Unsafe contact accepted: '.$text);
}
// Same shape as the live WRIST account: one established client, a supplier with the
// same fiscal code, and several bare-name contacts accidentally created by proformas.
$contacts=[
    ['id'=>'client-original','name'=>'WRIST SHIP SUPPLY SPAIN, S.L.','code'=>'B12345678','type'=>'client'],
    ['id'=>'supplier','name'=>'Wrist Ship Supply Spain S.L.','code'=>'B12345678','type'=>'supplier'],
    ['id'=>'duplicate-1','name'=>'WRIST','code'=>null],
    ['id'=>'duplicate-2','name'=>'WRIST','code'=>null],
];
$invoices=[
    ['contact'=>'client-original','date'=>1792620000,'docNumber'=>'A20260387','status'=>0,'draft'=>false],
    ['contact'=>'client-original','date'=>1792620000,'docNumber'=>'A20260386','status'=>0,'draft'=>false],
    ['contact'=>'client-original','date'=>1792620000,'docNumber'=>'A20260385','status'=>0,'draft'=>false],
    ['contact'=>'duplicate-1','date'=>1892620000,'docNumber'=>'DRAFT','draft'=>true],
];
$calls=[];
$get=function($path)use(&$calls,$contacts,$invoices){$calls[]=$path;return $path==='contacts'?$contacts:$invoices;};
$resolved=holded_resolve_contact('unused','WRIST','WRIST','',$get);
check_contact($resolved['contact']['id']==='client-original','Must reuse the issued invoice customer, not the supplier or bare-name duplicate');
check_contact($resolved['matchedBy']==='latest-issued-invoice','Must have issued-invoice evidence');
check_contact($calls===['contacts','documents/invoice?sort=created-desc'],'Resolver must only GET contacts and issued invoices, never proformas or contact creation');
$request=['contactName'=>'WRIST','contactCode'=>'B12345678','contactEmail'=>'client@example.test','items'=>[['subtotal'=>142.45,'units'=>2,'tax'=>'s_iva_21']],'notes'=>'Keep manual details'];
$out=holded_existing_contact_request($request,$resolved);
check_contact($out['contactId']==='client-original'&&!isset($out['contactName'])&&!isset($out['contactCode'])&&!isset($out['contactEmail']),'No inline creation fields');
check_contact($out['items']===$request['items']&&$out['notes']===$request['notes'],'Must preserve manual prices, quantities, notes and 21% VAT');
check_contact(holded_existing_contact_request($out,$resolved)===$out,'Idempotent request');
$taxMatches=holded_contact_candidates($contacts,'WRIST','WRIST','b-12345678');
check_contact(array_keys($taxMatches)===['client-original','supplier'],'NIF is authoritative, exclude duplicates without a fiscal code');
check_contact(holded_choose_contact($taxMatches,$invoices)['contact']['id']==='client-original','Prefer invoiced client over same-NIF supplier');
check_contact(holded_contact_candidates($contacts,'WRIST','WRIST','B99999999')===[],'Never fall back from a mismatched NIF to a name');
rejects_contact(fn()=>holded_choose_contact([],[]),'No se encontró');
rejects_contact(fn()=>holded_choose_contact($taxMatches,[]),'varios contactos');
rejects_contact(fn()=>holded_existing_contact_request([],[]),'identificador');
rejects_contact(fn()=>holded_contact_list(['status'=>0,'info'=>'Access denied']),'No se pudo leer');
rejects_contact(fn()=>holded_contact_list(['has_more'=>true,'items'=>$contacts]),'incompleto');
rejects_contact(fn()=>holded_resolve_contact('x','WRIST','WRIST','',static function(){throw new RuntimeException('network down');}),'network down');
$tie=array_merge($invoices,[['contact'=>'supplier','date'=>1792620000,'docNumber'=>'OTHER']]);
rejects_contact(fn()=>holded_choose_contact($taxMatches,$tie),'misma fecha');
$other=['id'=>'other-company','name'=>'WRIST OTHER COUNTRY','code'=>'OTHER123'];
$mixed=holded_contact_candidates(array_merge($contacts,[$other]),'WRIST','WRIST','');
rejects_contact(fn()=>holded_choose_contact($mixed,array_merge($invoices,[['contact'=>'other-company','date'=>1792500000,'docNumber'=>'OLDER']])),'varios NIF');
$exact=holded_contact_candidates([['id'=>'limani','name'=>'LIMANI','code'=>'NIF1'],['id'=>'not-limani','name'=>'LIMANI OTHER','code'=>'NIF2']],'Limani','','');
check_contact(holded_choose_contact($exact,[])['contact']['id']==='limani','Exact names for other customers, no substring guessing');
check_contact(holded_contact_candidates([['id'=>'archived','name'=>'WRIST','archived'=>true]],'WRIST','','')===[],'Archived contact excluded');
check_contact(holded_invoice_contact_id(['contact'=>['id'=>'nested']])==='nested','Nested contact reference');
check_contact(holded_contact_list(['items'=>$contacts])===$contacts,'Wrapped response');
$source=file_get_contents(__DIR__.'/../server/api/holded/create.php');
check_contact(strpos($source,'holded_resolve_contact(')<strpos($source,'INSERT INTO app_billing_exports'),'Resolve before export reservation and Holded POST');
check_contact(!str_contains($source,"'contactName' =>"),'Endpoint cannot send name-only creation requests');
echo "OK: WRIST issued contact reused; NIF matching; duplicates, supplier, ambiguity, errors; manual prices and IVA preserved; no contact creation\n";
