<?php
declare(strict_types=1);

function billing_grouped(array $row): bool { return count($row['sourceInvoiceIds'] ?? []) > 1; }
function billing_exported(array $row): bool {
    return in_array($row['estado'] ?? '', ['Enviado a Holded','Facturado','Cobrado'], true)
        || !empty($row['holdedId']) || !empty($row['holdedNumber']) || !empty($row['holdedAt']) || !empty($row['holdedStatus']);
}
function billing_row(array $row): array {
    return array_merge(json_decode($row['invoice_data'] ?? '{}', true) ?: [], ['id'=>$row['id'],'expediente'=>$row['case_ref'],'cliente'=>$row['client_name'],'concepto'=>$row['concept'],'importe'=>(float)$row['amount'],'estado'=>$row['status'],'vencimiento'=>$row['due_date']]);
}
function billing_lock(PDO $pdo): void {
    $stmt=$pdo->query("SELECT GET_LOCK('swiftport-billing-write', 5)");
    if ((int)$stmt->fetchColumn() !== 1) throw new InvalidArgumentException('Hay otra operación de facturación en curso. Espera unos segundos y vuelve a intentarlo.');
    register_shutdown_function(static function() use ($pdo): void {
        try { $pdo->query("SELECT RELEASE_LOCK('swiftport-billing-write')"); } catch (Throwable $ignored) {}
    });
}
function billing_export_schema(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS app_billing_exports (invoice_id VARCHAR(40) PRIMARY KEY, state VARCHAR(20) NOT NULL, result JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}
function billing_group_lines(array $sources): array {
    $lines=[];
    foreach($sources as $source){
        $parts=array_values(array_filter([$source['buque']??'', $source['puerto']??'', $source['concepto']??'', !empty($source['purchaseOrder'])?'PO '.$source['purchaseOrder']:''], static fn($part)=>$part!==''));
        $lines[]=['id'=>'group:'.$source['id'],'item'=>$source['expediente'],'detail'=>implode(' · ',$parts),'price'=>0,'units'=>1,'tax'=>'0%','sourceInvoiceId'=>$source['id'],'sourceCaseRef'=>$source['expediente']];
        foreach($source['lines'] as $index=>$line) $lines[]=array_merge($line,['id'=>$source['id'].':'.$index,'sourceInvoiceId'=>$source['id'],'sourceCaseRef'=>$source['expediente']]);
    }
    return $lines;
}

// Validate the whole batch before any write. Originals and group are committed together.
function validate_invoice_group_batch(array $incoming, array $stored, array $exports=[]): void {
    $changes=[];foreach($incoming as $row){if(isset($changes[$row['id']]))throw new InvalidArgumentException('Documento repetido.');$changes[$row['id']]=$row;}
    $byId=[];foreach($stored as $row)$byId[$row['id']]=$row;
    $covered=[];foreach($stored as $row){if(billing_grouped($row))foreach($row['expedientes']??[] as $ref)$covered[$ref]=$row['id'];}
    $newGroups=[];
    foreach($incoming as $group){
        if(!billing_grouped($group)||isset($byId[$group['id']]))continue;
        $ids=$group['sourceInvoiceIds'];
        if(count($ids)>50||count(array_unique($ids))!==count($ids))throw new InvalidArgumentException('Selección de expedientes no válida.');
        $sources=[];$refs=[];$client=null;
        foreach($ids as $id){
            $source=$byId[$id]??[];$changed=$changes[$id]??[];
            if(!$source||!preg_match('/\bwrist\b/i',$source['cliente']??'')||!in_array($source['estado']??'',['Borrador','Revisar','Listo para enviar'],true)||billing_exported($source)||billing_grouped($source)||!empty($source['groupedInto'])||isset($exports[$id])||empty($source['lines'])||empty($source['expediente']))throw new InvalidArgumentException('Un borrador ya está agrupado, enviado o no pertenece a WRIST. Actualiza Facturación.');
            $key=strtolower(trim($source['cliente']));
            if($client!==null&&$client!==$key)throw new InvalidArgumentException('Solo se pueden unificar expedientes del mismo cliente.');
            $client=$key;$ref=$source['expediente'];
            if(isset($covered[$ref])||in_array($ref,$refs,true))throw new InvalidArgumentException('Un expediente ya está incluido en otra factura conjunta.');
            // Also reject an alternative invoice already issued for the same case.
            foreach($stored as $other)if(($other['expediente']??'')===$ref&&(billing_exported($other)||isset($exports[$other['id']])))throw new InvalidArgumentException('Este expediente ya tiene una factura enviada.');
            if(($changed['groupedInto']??'')!==$group['id']||($changed['estado']??'')!=='Agrupado'||(int)($changed['financeRevision']??0)!==(int)($source['financeRevision']??0))throw new InvalidArgumentException('El borrador cambió. Revisa la selección antes de unificar.');
            $allowed=$changed;unset($allowed['groupedInto'],$allowed['groupedAt']);$allowed['estado']=$source['estado'];
            $original=$source;unset($allowed['financeRevision'],$original['financeRevision']);
            // Due date normalization happens after this validation.
            if($allowed!=$original)throw new InvalidArgumentException('Guarda primero las ediciones individuales antes de unificar.');
            $sources[]=$source;$refs[]=$ref;
        }
        if(($group['cliente']??'')!==$sources[0]['cliente']||($group['expediente']??'')!==''||($group['expedientes']??[])!==$refs||($group['lines']??[])!=billing_group_lines($sources)||($group['manualEdited']??false)!==true||($group['estado']??'')!=='Borrador')throw new InvalidArgumentException('Las líneas de la factura conjunta no coinciden con los borradores guardados. Actualiza y vuelve a unificar.');
        $sum=0;foreach($group['lines'] as $line)$sum+=(float)($line['price']??0)*(float)($line['units']??1);
        if(abs(round($sum,2)-(float)($group['importe']??0))>0.001)throw new InvalidArgumentException('El importe conjunto no coincide con sus líneas.');
        foreach($refs as $ref)$covered[$ref]=$group['id'];
        $newGroups[$group['id']]=$ids;
    }
    foreach($incoming as $row){
        $old=$byId[$row['id']]??[];
        if($old&&billing_grouped($row)&&!billing_grouped($old))throw new InvalidArgumentException('Crea una factura conjunta nueva; no sustituyas un borrador individual.');
        if(isset($exports[$row['id']]))foreach(['lines','cliente','concepto','expediente'] as $key)if(($row[$key]??null)!=($old[$key]??null))throw new InvalidArgumentException('Este documento tiene un envío a Holded registrado. No se pueden cambiar sus líneas desde una sesión antigua.');
        if(!empty($old['groupedInto'])){
            if($row!=$old)throw new InvalidArgumentException('Este borrador está incluido en '.$old['groupedInto'].'. Edita la factura conjunta.');
        }elseif(!empty($row['groupedInto'])&&!in_array($row['id'],$newGroups[$row['groupedInto']]??[],true))throw new InvalidArgumentException('Agrupación incompleta. No se ha guardado ningún cambio.');
        if(billing_grouped($old))foreach(['sourceInvoiceIds','expedientes','groupSources','expediente','cliente','groupedAt'] as $key)if(($row[$key]??null)!=($old[$key]??null))throw new InvalidArgumentException('No se pueden cambiar los expedientes ni el cliente de una factura conjunta.');
        if(billing_grouped($old)&&($row['manualEdited']??false)!==true)throw new InvalidArgumentException('La factura conjunta conserva sus líneas manuales.');
        if(!empty($row['expediente'])&&isset($covered[$row['expediente']])&&empty($row['groupedInto']))throw new InvalidArgumentException('El expediente ya está incluido en '.$covered[$row['expediente']].'. No se puede crear otro borrador.');
    }
}
