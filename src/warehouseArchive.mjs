const reference=value=>String(value??'').trim().toUpperCase();
const confirmed=value=>value===true||value===1||value==='1';

export function caseClosesWarehouse(item){
  if(!item||typeof item!=='object')return false;
  const status=reference(item.estado||item.status);
  const cancellation=item.caseCancellation||{};
  if(['CANCELADO','CANCELADA','CANCELLED','CANCELED'].includes(status)||cancellation.cancelledAt||cancellation.sentToBilling)return false;
  const flow=item.operationalFlow||{};
  // Billing readiness or a percentage alone is not proof of physical delivery.
  return ['COMPLETADO','CERRADO','CLOSED','COMPLETED'].includes(status)||confirmed(flow.delivery)||confirmed(flow.pod);
}

export function reconcileWarehouseArchive(entries=[],cases=[]){
  const byId=new Map();
  const byReception=new Map();
  for(const item of cases){
    if(!item||!reference(item.id))continue;
    const id=reference(item.id);
    byId.set(id,byId.has(id)?null:item);
    for(const reception of Array.isArray(item.recepciones)?item.recepciones:[]){
      const ref=reference(reception?.ref);
      if(!ref)continue;
      if(!byReception.has(ref))byReception.set(ref,item);
      else if(reference(byReception.get(ref)?.id)!==id)byReception.set(ref,null);
    }
  }
  let changed=false;
  const result=entries.map(entry=>{
    if(!entry||entry.archivado)return entry;
    // An explicit link always wins. Never match by vessel name alone.
    const item=reference(entry.expediente)?byId.get(reference(entry.expediente)):byReception.get(reference(entry.ref));
    if(!caseClosesWarehouse(item))return entry;
    const deliveredAt=item.deliveryConfirmedAt;
    const receivedAt=entry.fechaRecepcion;
    // New stock received after an earlier delivery must stay active.
    if(deliveredAt&&receivedAt&&Date.parse(receivedAt)>Date.parse(deliveredAt))return entry;
    changed=true;
    return {...entry,expediente:entry.expediente||item.id,estado:'Expedido',archivado:true,
      archiveReason:entry.archiveReason||'case_delivery',archivedByCase:item.id,
      // Do not fabricate historical departure times during reconciliation.
      ...(entry.salida?{}:deliveredAt&&Number.isFinite(Date.parse(deliveredAt))?{salida:deliveredAt}:{})};
  });
  return changed?result:entries;
}
