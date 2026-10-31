import {overtimeLocked} from './overtime.mjs';

const decimal=value=>Number(String(value??'').replace(',','.'));
export function normalizeWaiting(value={}){
  const hours=decimal(value.hours),rate=value.rate===''||value.rate==null?null:decimal(value.rate);
  if(!Number.isFinite(hours)||hours<0||hours>1000||Math.abs(hours*100-Math.round(hours*100))>0.00001)throw new Error('Indica horas de espera entre 0 y 1000, con un máximo de dos decimales.');
  if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>1000000||Math.abs(rate*100-Math.round(rate*100))>0.00001))throw new Error('Revisa el precio por hora de espera.');
  return {hours,rate,reason:String(value.reason||'').trim().slice(0,2000)};
}

// IDs are service + case, never physical trip: shared journeys bill each stop independently.
export function waitingProposal(service,{defaultRate=null,tax='0%'}={}){
  if(!service.waiting)return null;
  const waiting=normalizeWaiting(service.waiting);
  const key=`${service.expediente}:${service.transporte||service.id}`;
  const version=JSON.stringify([waiting,service.fecha||'',service.inicio||'',service.fin||'',service.origen||'',service.destino||'']);
  const rate=waiting.rate??defaultRate;
  return {key,version,hours:waiting.hours,line:{id:`transport-waiting:${key}`,item:'WAITING TIME',
    detail:[`${waiting.hours} HOURS WAITING`,`${service.fecha||'Fecha pendiente'} · ${service.inicio||'Hora pendiente'}${service.fin?'–'+service.fin:''}`,`${service.origen||'Origen pendiente'} → ${service.destino||'Destino pendiente'}`,waiting.reason].filter(Boolean).join('\n'),
    price:rate??0,units:waiting.hours,tax,sourceCaseRef:service.expediente,
    transportServiceKey:String(service.transporte||service.id),waitingSourceKey:key,waitingSourceVersion:version,waitingRatePending:rate===null}};
}

export function waitingReview(invoice,proposals){
  if(overtimeLocked(invoice))return [];
  return proposals.filter(Boolean).filter(p=>{
    const lines=(invoice.lines||[]).filter(l=>l.waitingSourceKey===p.key);
    if(!p.hours&&!lines.length)return false;
    return invoice.waitingDecisions?.[p.key]!==p.version&&!lines.some(l=>l.waitingSourceVersion===p.version);
  });
}

// Only an explicit billing action may replace a saved waiting line. All other rows stay intact.
export function reviewWaiting(invoice,proposal,include=true){
  if(overtimeLocked(invoice))return invoice;
  const oldIds=new Set((invoice.lines||[]).filter(l=>l.waitingSourceKey===proposal.key).map(l=>l.id));
  const lines=(invoice.lines||[]).filter(l=>l.waitingSourceKey!==proposal.key&&!oldIds.has(l.overtimeSource));
  if(include&&proposal.hours>0)lines.push({...proposal.line});
  return {...invoice,lines,waitingDecisions:{...invoice.waitingDecisions,[proposal.key]:proposal.version},manualPricingConfirmed:false};
}

export function appendFreshWaiting(invoice,proposals){
  if(overtimeLocked(invoice))return invoice;
  let next=invoice;
  // Legacy case-level waiting must be reconciled by billing, not charged twice automatically.
  if((invoice.lines||[]).some(l=>/WAITING|ESPERA/i.test(l.item||'')&&!l.waitingSourceKey))return invoice;
  for(const p of waitingReview(invoice,proposals))next=reviewWaiting(next,p);
  return next;
}
