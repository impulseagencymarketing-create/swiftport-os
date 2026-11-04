import {invoiceOperationLabel} from './invoiceSchedule.mjs';
const euros=value=>new Intl.NumberFormat('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+' EUR';
const poAmount=invoice=>{
  const lines=Array.isArray(invoice.lines)?invoice.lines:[];
  if(lines.length){
    if(lines.some(line=>!Number.isFinite(Number(line.price))||!Number.isFinite(Number(line.units))))return null;
    return Math.round((lines.reduce((sum,line)=>sum+Number(line.price)*Number(line.units),0)+Number.EPSILON)*100)/100;
  }
  return invoice.importe!==undefined&&invoice.importe!==null&&invoice.importe!==''&&Number.isFinite(Number(invoice.importe))?Number(invoice.importe):null;
};
export function missingLimaniPOs(invoices=[],cases=[],transports=[],calendarEvents=[],warehouseEntries=[]) {
  const rows=new Map();
  for(const invoice of invoices){
    if(invoice.groupedInto||invoice.holdedId||invoice.holdedNumber||invoice.holdedAt||['Enviado a Holded','Facturado','Cobrado','Archivado','Agrupado'].includes(invoice.estado))continue;
    const item=cases.find(c=>c.id===invoice.expediente);
    if(!/limani/i.test(String(item?.cliente||invoice.cliente||'')))continue;
    if([item?.purchaseOrder,item?.poNumber,invoice.purchaseOrder,invoice.poNumber].some(v=>String(v||'').trim()))continue;
    const ref=invoice.expediente||invoice.id;
    if(!ref||rows.has(ref))continue;
    rows.set(ref,{ref,vessel:item?.buque||invoice.buque||ref,port:item?.puerto||invoice.puerto||'',amount:poAmount(invoice),reviewRequired:invoice.operationReviewRequired===true,date:invoiceOperationLabel(item||{},transports,calendarEvents,warehouseEntries).replace('RECEPCIÓN','RECEIPT').replace('TRANSPORTE','TRANSPORT')});
  }
  return [...rows.values()].sort((a,b)=>a.ref.localeCompare(b.ref,undefined,{numeric:true}));
}
export function limaniPoText(rows) {
  if(!rows.length)return '';
  const complete=rows.every(row=>row.amount!==null&&row.amount!==undefined);
  const total=complete?'\n\nTotal (excluding VAT): '+euros(rows.reduce((sum,row)=>sum+row.amount,0)):'';
  return 'Hi Limani team,\n\nCould you please issue the POAs for the following vessel services? Amounts below are in EUR, excluding VAT.\n\n'+rows.map(row=>'• '+[row.vessel,row.port,row.date,row.ref,row.amount==null?'Amount pending':euros(row.amount)+(row.reviewRequired?' (provisional — under review)':'')].filter(Boolean).join(' · ')).join('\n')+total+(rows.some(row=>row.reviewRequired)?'\nProvisional amounts must be confirmed before issuing the corresponding POA.':'')+'\n\nPlease indicate the corresponding POA and amount for each reference.\nThank you!\nSwiftport Logistics';
}
