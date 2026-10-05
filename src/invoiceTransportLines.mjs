import {overtimeLocked,isAutoOvertime} from './overtime.mjs';
import {isManualInvoice} from './manualInvoice.mjs';
import {splitTransportNotes} from './invoiceTransportDescription.mjs';

export const transportServiceKey=record=>String(record?.transporte||record?.id||[record?.fecha,record?.inicio,record?.origen,record?.destino].join('|'));
export const transportLine=line=>!/^cancel-|^auto-overtime:/.test(String(line.id||''))&&/^(TRANSPORT(?:E)?\b|DELIVERY\s+VESSEL\b|ENTREGA\s+(?:A\s+)?BUQUE\b)/i.test(String(line.item||'').trim());
const tripText=service=>{
  const date=String(service.fecha||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>`${Number(d)}/${Number(m)}/${y}`)||'Fecha pendiente';
  return `• ${date} · ${service.inicio||'Hora pendiente'}${service.fin?'–'+service.fin:''} · ${String(service.origen||'ORIGEN PENDIENTE').toUpperCase()} → ${String(service.destino||'DESTINO PENDIENTE').toUpperCase()}`;
};
function described(line,service){
  if(!service)return line;
  const block=tripText(service);
  let detail=String(line.detail||'').trim();
  if(!line.transportDetailManual){
    const previous=String(line.transportDetailBlock||'').trim();
    if(previous&&detail.endsWith(previous))detail=detail.slice(0,-previous.length).trimEnd();
    if(!detail.endsWith(block))detail=[detail,block].filter(Boolean).join('\n');
  }
  return {...line,detail,transportDetailBlock:block};
}

// A legacy price is retained per unit. Never reprice saved or issued documents.
export function separateTransportLines(invoice,services=[],{fresh=false,quoteFor=()=>null}={}){
  if(overtimeLocked(invoice)||isManualInvoice(invoice))return invoice;
  const records=[...new Map(services.map(s=>[transportServiceKey(s),s])).values()];
  const lines=invoice.lines||[];
  const targets=lines.filter(transportLine);
  if(!targets.length)return invoice;
  if(targets.some(line=>line.transportServiceKey||line.transportSplitUnmatched)){
    const updated=lines.map(line=>line.transportServiceKey?described(line,records.find(s=>transportServiceKey(s)===line.transportServiceKey)):line);
    const complete=targets.every(line=>line.transportServiceKey&&records.some(s=>transportServiceKey(s)===line.transportServiceKey));
    return {...invoice,lines:updated,observaciones:complete?splitTransportNotes(invoice.observaciones).notes:invoice.observaciones,
      transportDescriptionNeedsReview:!complete};
  }
  if(targets.length!==1)return invoice;
  const target=targets[0], units=Number(target.units);
  // Hours or an agreed lump sum cannot be mapped to trips automatically.
  if(!Number.isInteger(units)||units<1||units>100||/\bHOURS?\b/i.test(target.detail||''))return invoice;
  if(units===1&&records.length!==1)return invoice;
  const matched=records.length===units;
  let cargo=String(target.detail||'');
  if(!target.transportDetailManual)cargo=cargo.split('\n').filter(line=>!/^\s*•/.test(line)).join('\n').replace(/^\s*\d+\s+TRANSPORTES?\s*-\s*/i,'').trim();
  const replacements=Array.from({length:units},(_,index)=>{
    const service=matched?records[index]:null;
    const key=service?transportServiceKey(service):null;
    const quote=fresh&&service?quoteFor(service):null;
    const next={...target,id:units===1?target.id:`${target.id||'transport'}:trip:${key||index+1}`,units:1,
      item:units>1?'TRANSPORT':target.item,detail:cargo,transportDetailBlock:'',
      transportServiceKey:key,transportSplitUnmatched:!matched,
      price:quote?quote.price??0:target.price};
    // An aggregate manual schedule cannot safely stand for several trips.
    if(units>1){delete next.overtimeSchedule;delete next.portTariff;}
    return described(next,service);
  });
  return {...invoice,lines:lines.flatMap(line=>line===target?replacements:isAutoOvertime(line)?[]:[line]),
    observaciones:matched?splitTransportNotes(invoice.observaciones).notes:invoice.observaciones,
    transportDescriptionNeedsReview:!matched};
}
