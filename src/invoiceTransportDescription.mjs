// Move only the generated transport bullets. Keep legal and free-form notes intact.
import {isManualInvoice} from './manualInvoice.mjs';
const blockPattern = /(?:^|\n)[ \t]*TRANSPORTES REALIZADOS:[ \t]*\n((?:[ \t]*•[^\n]*(?:\n|$))+)/i;
export function splitTransportNotes(value) {
  const text=String(value||'').replace(/\r\n/g,'\n');
  const match=text.match(blockPattern);
  if(!match)return {notes:text.trim(),services:''};
  return {notes:(text.slice(0,match.index)+'\n'+text.slice(match.index+match[0].length)).trim(),services:match[1].trim()};
}
export function placeTransportDescription(invoice, generatedNotes='') {
  if(isManualInvoice(invoice))return invoice;
  if(['Enviado a Holded','Facturado','Cobrado','Archivado'].includes(invoice.estado)||invoice.holdedId||invoice.holdedNumber||invoice.holdedAt)return invoice;
  const lines=Array.isArray(invoice.lines)?invoice.lines:[];
  const targets=lines.map((line,index)=>({line,index})).filter(({line})=>!/^cancel-|^auto-overtime:/.test(String(line.id||''))&&/^(?:TRANSPORT(?:E)?\b|DELIVERY\s+VESSEL\b|ENTREGA\s+(?:A\s+)?BUQUE\b)/i.test(String(line.item||'').trim()));
  const existing=splitTransportNotes(invoice.observaciones);
  const fresh=splitTransportNotes(generatedNotes);
  const services=fresh.services||existing.services;
  if(!services)return {...invoice,transportDescriptionNeedsReview:false};
  // With multiple separately priced routes, do not attribute all trips to an arbitrary line.
  if(targets.length!==1)return {...invoice,transportDescriptionNeedsReview:targets.length>1};
  const target=targets[0];
  const line=target.line;
  let detail=String(line.detail||'').trim();
  if(!line.transportDetailManual){
    const previous=String(line.transportDetailBlock||'').trim();
    if(previous&&detail.endsWith(previous))detail=detail.slice(0,-previous.length).trimEnd();
    if(!detail.endsWith(services))detail=[detail,services].filter(Boolean).join('\n');
  }
  return {...invoice,observaciones:existing.notes,transportDescriptionNeedsReview:false,lines:lines.map((entry,index)=>index===target.index?{...entry,detail,transportDetailBlock:services}:entry)};
}
