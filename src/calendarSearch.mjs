import {tripStops} from './sharedTrips.mjs';
export const normalizeCalendarSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
export const emptyCalendarSearch=()=>({query:'',assignee:'',status:'',scope:'all'});
export const hasCalendarSearch=filters=>Boolean(filters.query.trim()||filters.assignee||filters.status);
const personValue=name=>'person:'+normalizeCalendarSearch(name);
const external=event=>event.proveedorId&&String(event.asignado||'').startsWith('Externo · ');
export function calendarAssigneeOptions(events,team=[],providers=[]){
  const options=new Map();
  const person=name=>{if(name&&name!=='Sin asignar')options.set(personValue(name),{value:personValue(name),label:name});};
  team.forEach(p=>person(p.fullName));
  providers.forEach(p=>options.set('provider:'+p.id,{value:'provider:'+p.id,label:p.nombre+' · externo'+(p.activo===false?' (inactivo)':'')}));
  events.forEach(e=>{
    if(!external(e))person(e.asignado);
    if(e.proveedorId&&!options.has('provider:'+e.proveedorId))options.set('provider:'+e.proveedorId,{value:'provider:'+e.proveedorId,label:(e.asignado||e.proveedorId)+' · histórico'});
  });
  return [{value:'unassigned',label:'Sin asignar'},...options.values()].sort((a,b)=>a.value==='unassigned'?-1:b.value==='unassigned'?1:a.label.localeCompare(b.label,'es'));
}
export function filterCalendarEvents(events,{filters,cases=[],providers=[],statusOf}){
  const byCase=new Map(cases.map(c=>[c.id,c]));const byProvider=new Map(providers.map(p=>[p.id,p]));
  const terms=normalizeCalendarSearch(filters.query).split(' ').filter(Boolean);
  return events.filter(e=>{
    if(filters.status&&statusOf(e)!==filters.status)return false;
    const selected=filters.assignee;
    if(selected==='unassigned'&&(e.proveedorId||(e.asignado&&e.asignado!=='Sin asignar')))return false;
    if(selected.startsWith('provider:')&&e.proveedorId!==selected.slice(9))return false;
    if(selected.startsWith('person:')&&(external(e)||personValue(e.asignado)!==selected))return false;
    const c=byCase.get(e.expediente)||{},p=byProvider.get(e.proveedorId)||{};
    // Use the service assignee, not the current case's driver: one case can have several services.
    const relatedText=tripStops(e).map(stop=>{const c=byCase.get(stop.expediente)||{};return [stop.expediente,stop.transporte,stop.origen,stop.destino,stop.sharedCargo,c.buque,c.puerto,c.purchaseOrder,c.cliente].join(' ')}).join(' ');
    const haystack=normalizeCalendarSearch([relatedText,e.id,e.transporte,e.expediente,e.titulo,e.tipoServicio,e.origen,e.destino,e.ruta,e.observacion,e.asignado,e.puerto,c.buque,c.puerto,c.purchaseOrder,c.cliente,p.nombre].join(' '));
    return terms.every(term=>haystack.includes(term));
  });
}
export function sortCalendarResults(events){
  return [...events].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))||String(b.inicio||'').localeCompare(String(a.inicio||''))||String(a.id).localeCompare(String(b.id)));
}
