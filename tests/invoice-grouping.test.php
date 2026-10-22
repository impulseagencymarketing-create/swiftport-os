<?php
declare(strict_types=1);
require __DIR__.'/../server/api/_invoice_grouping.php';
$sources=[];
foreach([1,2] as $n)$sources[]=['id'=>'BOR-'.$n,'expediente'=>'SW-2026-000'.$n,'cliente'=>'WRIST','buque'=>'VESSEL '.$n,'puerto'=>'Barcelona','concepto'=>'SERVICE '.$n,'purchaseOrder'=>'PO'.$n,'estado'=>'Borrador','financeRevision'=>2,'lines'=>[['id'=>'transport','item'=>'TRANSPORT','detail'=>$n.' BOXES','price'=>$n*125.25,'units'=>1,'tax'=>'21%']]];
$group=['id'=>'GRP-test','sourceInvoiceIds'=>['BOR-1','BOR-2'],'expedientes'=>array_column($sources,'expediente'),'expediente'=>'','cliente'=>'WRIST','estado'=>'Borrador','manualEdited'=>true,'importe'=>375.75,'lines'=>billing_group_lines($sources)];
$children=array_map(static fn($row)=>array_merge($row,['estado'=>'Agrupado','groupedInto'=>'GRP-test','groupedAt'=>'now']),$sources);
$batch=[$group,...$children];validate_invoice_group_batch($batch,$sources);
$legacy=$sources;unset($legacy[0]['financeRevision']);$legacyBatch=$batch;$legacyBatch[1]['financeRevision']=0;validate_invoice_group_batch($legacyBatch,$legacy);
function rejects(array $batch,array $stored,array $exports=[]):void {try{validate_invoice_group_batch($batch,$stored,$exports);}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Unsafe batch accepted');}
$bad=$batch;$bad[0]['lines'][1]['price']=1;rejects($bad,$sources);
$bad=$batch;$bad[2]['financeRevision']=0;rejects($bad,$sources);
$bad=$sources;$bad[1]['cliente']='WRIST OTHER';rejects($batch,$bad);
$bad=$sources;$bad[1]['estado']='Facturado';rejects($batch,$bad);
rejects($batch,$sources,['BOR-2'=>true]);
rejects([$group,$children[0]],$sources);
rejects([$sources[0]],$batch); // Old browser tries to restore an individual draft.
$duplicate=$sources[0];$duplicate['id']='NEW-BOR';rejects([$duplicate],$batch);
$edited=$group;$edited['lines'][1]['price']=444;$edited['importe']=694.5;validate_invoice_group_batch([$edited],$batch);
$edited['expedientes']=[];rejects([$edited],$batch);
echo "OK: atomic group validation, mixed clients, stale revisions, export claims, protected sources, manual group edits\n";
