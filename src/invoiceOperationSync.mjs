const issued=invoice=>Boolean(invoice.holdedId||invoice.holdedNumber||invoice.holdedDocumentId||invoice.holdedAt||['Enviado a Holded','Facturado','Cobrado'].includes(invoice.estado));
export function operationSnapshot(template) {
  return {cliente:template.cliente,buque:template.buque,puerto:template.puerto,concepto:template.concepto,purchaseOrder:template.purchaseOrder||'',coste:template.coste||0,lines:(template.lines||[]).map(({id,item,detail,price,units,tax})=>({id,item,detail,price,units,tax}))};
}
export function syncInvoiceOperation(invoice,template) {
  // Group sources are immutable in the API, including diagnostic metadata.
  // Compare their operation on the joint invoice instead of writing them back.
  if(invoice.estado==='Archivado'||invoice.groupedInto||invoice.estado==='Agrupado')return invoice;
  const snapshot=operationSnapshot(template),previous=invoice.operationSnapshot;
  const changed=previous?JSON.stringify(previous)!==JSON.stringify(snapshot):['concepto','buque','puerto','cliente'].some(key=>invoice[key]&&invoice[key]!==snapshot[key])||(invoice.lines||[]).some(line=>{const fresh=snapshot.lines.find(row=>row.id===line.id);return fresh&&line.detail!==fresh.detail});
  if(issued(invoice)||invoice.groupedInto||invoice.sourceInvoiceIds?.length){
    // Keep issued and grouped amounts and descriptions immutable; retain the comparison baseline.
    if(!changed)return previous?invoice:{...invoice,operationSnapshot:snapshot};
    const notice='El expediente cambió después de preparar o emitir este documento. Revisa mercancía, kilos, servicios e importes antes de corregir la facturación.';
    if(invoice.operationChangeNotice===notice&&JSON.stringify(invoice.operationCurrent)===JSON.stringify(snapshot))return invoice;
    return {...invoice,operationChangeNotice:notice,operationCurrent:snapshot};
  }
  if(previous&&!changed)return invoice;
  const manual=invoice.manualEdited===true;
  const lines=(invoice.lines||[]).filter(line=>{
    const old=previous?.lines.find(row=>row.id===line.id);
    return manual||!old||snapshot.lines.some(row=>row.id===line.id)||Object.keys(old).some(key=>old[key]!==line[key]);
  }).map(line=>{
    const fresh=snapshot.lines.find(row=>row.id===line.id);
    if(!fresh)return line;
    const old=previous?.lines.find(row=>row.id===line.id);
    const result={...line,item:fresh.item,detail:line.transportDetailManual?line.detail:fresh.detail};
    for(const field of ['price','units','tax'])if(!manual&&old&&line[field]===old[field])result[field]=fresh[field];
    return result;
  });
  if(!manual&&previous){
    for(const line of snapshot.lines)if(!lines.some(row=>row.id===line.id)&&!previous.lines.some(row=>row.id===line.id))lines.push({...line});
  }
  const next={...invoice,lines,operationSyncVersion:1,operationSnapshot:snapshot,buque:snapshot.buque,puerto:snapshot.puerto,concepto:snapshot.concepto,purchaseOrder:snapshot.purchaseOrder,coste:snapshot.coste};
  if(changed){next.operationChangeNotice=manual||!previous?'Datos del expediente actualizados. Revisa los importes guardados antes de enviar.':'Expediente actualizado automáticamente. Revisa el borrador antes de enviar.';next.operationReviewRequired=true;next.manualPricingConfirmed=false;next.estado='Revisar';}
  return JSON.stringify(next)===JSON.stringify(invoice)?invoice:next;
}

export function syncGroupedInvoiceOperations(invoice,sources,templateFor) {
  if(!invoice.sourceInvoiceIds?.length||invoice.estado==='Archivado')return invoice;
  const snapshots={...invoice.operationSourceSnapshots},affected=[];
  for(const id of invoice.sourceInvoiceIds){
    const source=sources.find(row=>row.id===id);
    if(!source)continue;
    const template=templateFor(source);if(!template)continue;
    const snapshot=operationSnapshot(template);
    const previous=snapshots[id]||source.operationSnapshot;
    const differs=previous?JSON.stringify(previous)!==JSON.stringify(snapshot):
      ['concepto','buque','puerto','cliente'].some(key=>source[key]&&source[key]!==snapshot[key])||
      (source.lines||[]).some(line=>{const fresh=snapshot.lines.find(row=>row.id===line.id);return fresh&&line.detail!==fresh.detail});
    if(differs)affected.push(source.expediente);
    snapshots[id]=snapshot;
  }
  if(!affected.length&&JSON.stringify(snapshots)===JSON.stringify(invoice.operationSourceSnapshots||{}))return invoice;
  return {...invoice,operationSourceSnapshots:snapshots,...(affected.length?{
    operationChangeNotice:'Cambios en expedientes de la factura conjunta: '+affected.join(', ')+'. Revisa sus líneas antes de facturar o corregir Holded.',
    operationReviewRequired:!issued(invoice),...(!issued(invoice)?{manualPricingConfirmed:false}:{})
  }:{})};
}
