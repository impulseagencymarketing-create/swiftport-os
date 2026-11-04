import {invoiceOperationLabel} from './invoiceSchedule.mjs';
export function missingLimaniPOs(invoices=[],cases=[],transports=[],calendarEvents=[],warehouseEntries=[]) {
  const rows=new Map();
  for(const invoice of invoices){
    if(invoice.groupedInto||invoice.holdedId||invoice.holdedNumber||invoice.holdedAt||['Enviado a Holded','Facturado','Cobrado','Archivado','Agrupado'].includes(invoice.estado))continue;
    const item=cases.find(c=>c.id===invoice.expediente);
    if(!/limani/i.test(String(item?.cliente||invoice.cliente||'')))continue;
    if([item?.purchaseOrder,item?.poNumber,invoice.purchaseOrder,invoice.poNumber].some(v=>String(v||'').trim()))continue;
    const ref=invoice.expediente||invoice.id;
    if(!ref||rows.has(ref))continue;
    rows.set(ref,{ref,vessel:item?.buque||invoice.buque||ref,port:item?.puerto||invoice.puerto||'',date:invoiceOperationLabel(item||{},transports,calendarEvents,warehouseEntries).replace('RECEPCIÓN','RECEIPT').replace('TRANSPORTE','TRANSPORT')});
  }
  return [...rows.values()].sort((a,b)=>a.ref.localeCompare(b.ref,undefined,{numeric:true}));
}
export function limaniPoText(rows) {
  if(!rows.length)return '';
  return 'Hi Limani team,\n\nCould you please send us the POs for the following vessel services so we can complete the invoicing?\n\n'+rows.map(row=>'• '+[row.vessel,row.port,row.date,row.ref].filter(Boolean).join(' · ')).join('\n')+'\n\nPlease indicate the corresponding PO for each reference.\nThank you!\nSwiftport Logistics';
}
