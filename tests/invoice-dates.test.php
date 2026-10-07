<?php
declare(strict_types=1);
require __DIR__ . '/../server/api/_invoice_dates.php';
$now=new DateTimeImmutable('2026-10-07T22:30:00Z');
foreach (['2026-10-07','','bad','2026-02-30'] as $due) {
    $dates=invoice_document_dates($due,$now);
    if ($dates['dueDate']!=='2026-10-08'||$dates['issueDate']!=='2026-10-08'||$dates['dueTimestamp']<$dates['issueTimestamp']) throw new RuntimeException('Invalid dates');
}
$future=invoice_document_dates('2026-11-07',$now);
if($future['dueDate']!=='2026-11-07')throw new RuntimeException('Future due date changed');
foreach (['Enviado a Holded','Facturado','Cobrado','Archivado'] as $state){$invoice=['estado'=>$state,'vencimiento'=>'2026-01-01'];if(refresh_draft_due_date($invoice,$now)!==$invoice)throw new RuntimeException('Closed document changed');}
$invoice=['estado'=>'Borrador','vencimiento'=>'2026-01-01','lines'=>[['price'=>123.45,'detail'=>'875 KGS']]];
$updated=refresh_draft_due_date($invoice,$now);
if($updated['vencimiento']!=='2026-10-08'||$updated['lines']!==$invoice['lines'])throw new RuntimeException('Draft refresh failed');
echo "OK: Madrid issue date, automatic due date, future dates and closed documents preserved\n";
