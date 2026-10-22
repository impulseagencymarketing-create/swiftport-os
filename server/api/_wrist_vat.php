<?php
declare(strict_types=1);
function is_wrist_invoice(array $invoice): bool {return preg_match('/\bwrist\b/i',(string)($invoice['cliente']??''))===1;}
function apply_wrist_vat(array $invoice): array {
    if(!is_wrist_invoice($invoice)||!empty($invoice['groupedInto'])||in_array($invoice['estado']??'',['Enviado a Holded','Facturado','Cobrado','Archivado','Agrupado'],true))return $invoice;
    foreach(['holdedId','holdedNumber','holdedAt','holdedStatus'] as $key)if(!empty($invoice[$key]))return $invoice;
    $invoice['lines']=array_map(static fn(array $line)=>array_merge($line,['tax'=>'21%']),$invoice['lines']??[]);
    if(isset($invoice['observaciones']))$invoice['observaciones']=trim(str_replace('Exención de IVA según ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre','',$invoice['observaciones']));
    return $invoice;
}
