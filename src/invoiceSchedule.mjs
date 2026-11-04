export function operationDate(value) {
  const text=String(value||'');
  const iso=text.match(/\b(20\d{2})-(\d{2})-(\d{2})(?=T|\b)/);
  const local=text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  const date=iso?iso[0]:local?`${local[3].length===2?'20':''}${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`:'';
  return date&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:'';
}
export function invoiceOperationLabel(item={},transports=[],calendarEvents=[],warehouseEntries=[]) {
  const label=(source,date)=>`${source?source+' ':''}${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(2,4)}`;
  const call=item.portCall||{};
  for(const [source,values] of [['',[call.etaDate,item.etaDate,item.eta]],['ETB',[call.etbDate,item.etbDate,item.etb]],['ETD',[call.etdDate,item.etdDate,item.etd]]]) {
    for(const value of values){const date=operationDate(value);if(date)return label(source,date);}
  }
  const linked=item.id?[...transports,...calendarEvents.filter(e=>e.transporte||String(e.tipoServicio||'').toLowerCase().startsWith('transporte'))].filter(e=>e.expediente===item.id&&!/cancel|anulad/i.test(String(e.estado||''))):[];
  const trips=linked.map(e=>({date:[e.fecha,e.date,e.transportDate].map(operationDate).find(Boolean),completed:/entregado|completado|realizado|finalizado/i.test(String(e.estado||''))})).filter(e=>e.date);
  const completed=trips.filter(e=>e.completed);
  const trip=(completed.length?completed:trips).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(trip)return label('TRANSPORTE',trip.date);
  const receptions=[...(item.recepciones||[]),...(item.id?warehouseEntries.filter(e=>e.expediente===item.id):[])];
  const dates=[item.fechaRecepcion,...receptions.flatMap(e=>[e.fechaRecepcion,e.fecha,e.entrada])].map(operationDate).filter(Boolean).sort();
  return dates.length?label('RECEPCIÓN',dates[0]):'';
}
const pendingDate=/\b(?:FECHA|ETA|ETB|ETD)\s+POR\s+CONFIRMAR\b/gi;
export function refreshInvoiceOperationDate(invoice,label) {
  if(!label)return invoice;
  if(invoice.holdedId||invoice.holdedNumber||invoice.holdedAt||invoice.holdedStatus||invoice.groupedInto||['Enviado a Holded','Facturado','Cobrado','Archivado','Agrupado'].includes(invoice.estado))return invoice;
  const replace=value=>typeof value==='string'?value.replace(pendingDate,label):value;
  const concepto=replace(invoice.concepto);
  const lines=(invoice.lines||[]).map(line=>({...line,item:replace(line.item),detail:replace(line.detail)}));
  return concepto===invoice.concepto&&JSON.stringify(lines)===JSON.stringify(invoice.lines||[])?invoice:{...invoice,concepto,lines};
}
