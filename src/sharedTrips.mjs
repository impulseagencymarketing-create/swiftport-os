import {manualCalendarSchedule,validCalendarDate,validCalendarTime} from './calendarPending.mjs';
import {normalizeWaiting} from './transportWaiting.mjs';

// A trip is the physical journey. Its existing per-case service IDs remain stable
// so invoices, cargo and delivery evidence never move between cases.
export const tripStops=event=>event?._tripStops||[event];
export const tripCaseIds=event=>[...new Set(tripStops(event).map(e=>e.expediente).filter(Boolean))];
export const tripVessels=(event,cases)=>tripCaseIds(event).map(id=>cases.find(c=>c.id===id)?.buque||id).join(' + ');
export const sharedTripRoute=event=>({origen:[...new Set(tripStops(event).map(s=>s.origen).filter(Boolean))].join(' / '),destino:tripStops(event).map(s=>s.destino).filter(Boolean).join(' → ')});
export function groupSharedTrips(events){
  const groups=new Map();
  for(const event of events){
    const key=event.sharedTripId||`event:${event.id}`;
    if(!groups.has(key))groups.set(key,[]);
    for(const stop of tripStops(event))if(!groups.get(key).some(e=>e.id===stop.id))groups.get(key).push(stop);
  }
  return [...groups.values()].map(stops=>{
    stops.sort((a,b)=>(a.sharedTripOrder||0)-(b.sharedTripOrder||0));
    if(!stops[0].sharedTripId)return stops[0];
    const lead=stops.find(e=>e.estado!=='Cancelado')||stops[0];
    return {...lead,_tripStops:stops};
  });
}
export function initialSharedTrip(event,transports,cases){
  const linked=transports.find(t=>t.id===event?.transporte);
  const id=event?.sharedTripId||linked?.sharedTripId||'';
  const members=id?transports.filter(t=>t.sharedTripId===id).sort((a,b)=>a.sharedTripOrder-b.sharedTripOrder):linked?[linked]:[];
  const first=members.find(t=>t.estado!=='Cancelado')||members[0]||event||{};
  return {id,fecha:first.fecha||'',inicio:first.inicio||'',fin:first.fin||'',asignado:first.conductor||event?.asignado||'Sin asignar',proveedorId:first.proveedorId||'',vehiculo:first.vehiculo||'',cost:first.sharedTripCost??'',costMode:first.sharedTripCostMode||'equal',costProvider:first.sharedTripCostProvider||'',
    stops:members.length?members.map(t=>({expediente:t.expediente,transportId:t.id,origen:t.origen||'',destino:t.destino||'',cargo:t.sharedCargo||cases.find(c=>c.id===t.expediente)?.resumenMercancia||'',costShare:t.sharedTripCostShare??'',waiting:t.waiting,observacion:t.observacion||''})):[{expediente:event?.expediente||'',transportId:'',origen:event?.origen||'ALMACÉN SWIFTPORT',destino:event?.destino||'',cargo:'',costShare:'',observacion:''}]};
}
export function allocateTripCost(total,stops,mode='equal'){
  const amount=String(total??'').replace(',','.');
  if(amount==='')return null;
  const number=Number(amount),cents=Math.round(number*100);
  if(!Number.isFinite(number)||number<0||Math.abs(number*100-cents)>0.00001)throw new Error('El coste debe ser un importe positivo con un máximo de dos decimales.');
  if(mode==='manual'){
    const shares=stops.map(s=>{const n=Number(String(s.costShare??'').replace(',','.'));if(!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>0.00001)throw new Error('Revisa los importes del reparto.');return Math.round(n*100)});
    if(shares.reduce((a,b)=>a+b,0)!==cents)throw new Error('El reparto debe sumar exactamente el coste total del viaje.');
    return shares.map(n=>n/100);
  }
  return stops.map((_,i)=>(Math.floor(cents/stops.length)+(i<cents%stops.length?1:0))/100);
}
export function saveSharedTripState(state,draft,{id,now=new Date().toISOString(),actor='Operaciones'}={}){
  const tripId=draft.id||id;
  if(!tripId)throw new Error('Falta el identificador del viaje.');
  const stops=draft.stops||[];
  if(stops.length<2||stops.length>20)throw new Error('Selecciona entre 2 y 20 expedientes para el viaje.');
  if(new Set(stops.map(s=>s.expediente)).size!==stops.length)throw new Error('Cada expediente debe aparecer una sola vez en el viaje.');
  if(draft.fecha&&!validCalendarDate(draft.fecha)||draft.inicio&&!validCalendarTime(draft.inicio)||draft.fin&&!validCalendarTime(draft.fin))throw new Error('Revisa la fecha y el horario.');
  const oldMembers=state.transports.filter(t=>t.sharedTripId===tripId);
  if(oldMembers.some(t=>!stops.some(s=>s.transportId===t.id)))throw new Error('No se pueden retirar entregas de un viaje guardado. Cancela el servicio desde su expediente.');
  const shares=allocateTripCost(draft.cost,stops,draft.costMode);
  const savedTransports=[],savedEvents=[];
  stops.forEach((stop,index)=>{
    const related=state.cases.find(c=>c.id===stop.expediente);
    if(!related)throw new Error('Selecciona un expediente válido para cada entrega.');
    const previous=stop.transportId?state.transports.find(t=>t.id===stop.transportId):null;
    if(stop.transportId&&!previous)throw new Error('El transporte seleccionado ya no existe. Recarga la página.');
    if(previous&&previous.expediente!==stop.expediente)throw new Error('El transporte no pertenece a ese expediente.');
    if(previous?.sharedTripId&&previous.sharedTripId!==tripId)throw new Error('Ese transporte ya pertenece a otro viaje compartido.');
    if(!draft.id&&(related.estado==='Cancelado'||previous?.estado==='Cancelado'))throw new Error('No se pueden unir servicios cancelados.');
    if(!previous&&['Completado','Cancelado'].includes(related.estado))throw new Error('Para un expediente cerrado selecciona su servicio existente; no crees otro.');
    if(!String(stop.origen||'').trim()||!String(stop.destino||'').trim())throw new Error('Indica la recogida y la entrega de cada buque.');
    const transportId=previous?.id||`${tripId}-S${index+1}`;
    const oldEvents=(state.calendarEvents||[]).filter(e=>e.transporte===transportId);
    if(oldEvents.length>1)throw new Error('Este transporte tiene varias tarjetas de calendario. Revisa el duplicado antes de unirlo.');
    const cancelled=related.estado==='Cancelado'||previous?.estado==='Cancelado';
    const common={...(stop.waiting!==undefined?{waiting:normalizeWaiting(stop.waiting)}:{}),sharedTripId:tripId,sharedTripOrder:index,sharedCargo:stop.cargo||'',fecha:draft.fecha||'',inicio:draft.inicio||'',fin:draft.fin||'',proveedorId:draft.proveedorId||'',vehiculo:draft.vehiculo||'',origen:stop.origen.trim(),destino:stop.destino.trim(),observacion:stop.observacion||'',expediente:related.id,sharedTripCost:shares?Number(String(draft.cost).replace(',','.')):null,sharedTripCostShare:shares?.[index]??null,sharedTripCostMode:draft.costMode||'equal',sharedTripCostProvider:draft.costProvider||''};
    const route=`${common.origen} → ${common.destino}`;
    const schedule=manualCalendarSchedule(common);
    const status=cancelled?'Cancelado':previous?.estado||'Asignado';
    const assigned=cancelled?'Sin asignar':draft.asignado||'Sin asignar';
    savedTransports.push({...previous,...schedule,id:transportId,ruta:route,conductor:assigned,estado:status,hora:[common.fecha,[common.inicio,common.fin].filter(Boolean).join('–')].filter(Boolean).join(' · '),...(cancelled?{scheduleStatus:'cancelled'}:{})});
    savedEvents.push({...oldEvents[0],...schedule,id:oldEvents[0]?.id||`EV-${transportId}`,transporte:transportId,titulo:route,tipoServicio:'Transporte',asignado:assigned,estado:cancelled?'Cancelado':oldEvents[0]?.estado||status,...(cancelled?{scheduleStatus:'cancelled'}:{})});
  });
  const caseChanges=state.cases.map(c=>{
    const index=stops.findIndex(s=>s.expediente===c.id);if(index<0)return c;
    const expenseId=`TRIP-COST-${tripId}-${c.id}`;
    const gastos=(c.gastos||[]).filter(g=>g.id!==expenseId);
    if(shares&&shares[index]>0)gastos.push({...(c.gastos||[]).find(g=>g.id===expenseId),id:expenseId,source:'shared-trip',sharedTripId:tripId,fecha:draft.fecha||now.slice(0,10),proveedor:draft.costProvider||'Transporte compartido',concepto:`Coste viaje compartido ${tripId}`,importe:shares[index],category:'Transporte',billable:false,nota:`Parte ${index+1}/${stops.length}. Coste total del viaje: ${draft.cost} EUR. No modifica el precio de venta.`});
    const timelineId=`SHARED-${tripId}`;
    return {...c,...(c.estado!=='Cancelado'?{autoTransportDisabled:false,conductor:draft.asignado||'Sin asignar',operationalFlow:{...c.operationalFlow,assignment:Boolean(c.operationalFlow?.assignment||(draft.asignado&&draft.asignado!=='Sin asignar'))}}:{}),gastos,timelineCustom:[{id:timelineId,fecha:now.slice(0,10),hora:now.slice(11,16),titulo:'Transporte compartido',detalle:`${tripId} · ${stops.map(s=>s.expediente).join(' / ')} · Facturación independiente por expediente`,actor,estado:'done'},...(c.timelineCustom||[]).filter(t=>t.id!==timelineId)]};
  });
  const changedIds=new Set(savedTransports.map(t=>t.id));
  return {...state,cases:caseChanges,transports:[...state.transports.filter(t=>!changedIds.has(t.id)),...savedTransports],calendarEvents:[...(state.calendarEvents||[]).filter(e=>!changedIds.has(e.transporte)),...savedEvents]};
}

// Schedule/driver edits affect the physical journey, never cargo, delivery
// state, prices or evidence of another stop. Cancellation is per case.
export function syncSharedTripSchedule(state,event){
  if(!event.sharedTripId)return state;
  const fields=manualCalendarSchedule({fecha:event.fecha||'',inicio:event.inicio||'',fin:event.fin||'',proveedorId:event.proveedorId||''});
  const member=t=>t.sharedTripId===event.sharedTripId&&t.estado!=='Cancelado';
  const ids=new Set(state.transports.filter(member).map(t=>t.expediente));
  return {...state,transports:state.transports.map(t=>member(t)?{...t,...fields,conductor:event.asignado||'Sin asignar',hora:[fields.fecha,[fields.inicio,fields.fin].filter(Boolean).join('–')].join(' · ')}:t),calendarEvents:state.calendarEvents.map(e=>member(e)?{...e,...fields,asignado:event.asignado||'Sin asignar'}:e),cases:state.cases.map(c=>ids.has(c.id)?{...c,conductor:event.asignado||'Sin asignar'}:c)};
}
