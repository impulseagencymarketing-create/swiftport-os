import {billingToday} from './invoiceDates.mjs';
import {applyWristVat} from './wristVat.mjs';

export const isGroupedInvoice = invoice => Array.isArray(invoice?.sourceInvoiceIds) && invoice.sourceInvoiceIds.length > 1;
export const invoiceCaseRefs = invoice => isGroupedInvoice(invoice) ? invoice.expedientes || [] : [invoice?.expediente].filter(Boolean);
export const isGroupSource = invoice => Boolean(invoice?.groupedInto);
export const groupEligible = invoice => /\bwrist\b/i.test(invoice?.cliente || '') && Boolean(invoice?.expediente) &&
  ['Borrador','Revisar','Listo para enviar'].includes(invoice.estado) && !isGroupSource(invoice) && !isGroupedInvoice(invoice) &&
  !['holdedId','holdedNumber','holdedAt','holdedStatus'].some(key => invoice[key]) && Array.isArray(invoice.lines) && invoice.lines.length > 0;
export const groupSubtotal = invoice => Math.round((invoice.lines || []).reduce((sum,line) => sum + Number(line.price || 0) * Number(line.units ?? 1),0) * 100) / 100;
export const groupTaxTotal = invoice => Math.round((invoice.lines || []).reduce((sum,line) => sum + (line.tax==='21%' ? Number(line.price || 0) * Number(line.units ?? 1) * .21 : 0),0) * 100) / 100;

// Never aggregate similar services: every original line keeps its own price and attribution.
export function buildInvoiceGroup(sources, id, now = new Date()) {
  if (sources.length < 2 || sources.length > 50 || !sources.every(groupEligible)) throw new Error('Selecciona entre 2 y 50 borradores pendientes de WRIST.');
  const clients = new Set(sources.map(row => row.cliente.trim().toLowerCase()));
  if (clients.size !== 1) throw new Error('Los expedientes deben pertenecer al mismo cliente WRIST.');
  if (new Set(sources.map(row=>row.expediente)).size !== sources.length) throw new Error('No puedes incluir dos borradores del mismo expediente.');
  const lines = sources.flatMap(source => [
    {id:`group:${source.id}`,item:source.expediente,detail:[source.buque,source.puerto,source.concepto,source.purchaseOrder && `PO ${source.purchaseOrder}`].filter(Boolean).join(' · '),price:0,units:1,tax:'0%',sourceInvoiceId:source.id,sourceCaseRef:source.expediente},
    ...source.lines.map((line,index)=>({...line,id:`${source.id}:${index}`,sourceInvoiceId:source.id,sourceCaseRef:source.expediente}))
  ]);
  const group = {id,expediente:'',expedientes:sources.map(row=>row.expediente),sourceInvoiceIds:sources.map(row=>row.id),
    groupSources:sources.map(row=>({id:row.id,expediente:row.expediente,buque:row.buque||'',puerto:row.puerto||'',importe:groupSubtotal(row)})),
    cliente:sources[0].cliente,concepto:`WRIST · Factura conjunta · ${sources.length} expedientes`,estado:'Borrador',vencimiento:billingToday(now),
    lines,observaciones:sources.map(row=>[row.expediente,row.observaciones].filter(Boolean).join('\n')).join('\n\n'),
    payment:sources[0].payment||'',coste:sources.reduce((sum,row)=>sum+Number(row.coste||0),0),
    manualEdited:true,manualEditedAt:now.toISOString(),manualPricingConfirmed:false,groupedAt:now.toISOString(),financeRevision:0};
  return applyWristVat({...group,importe:groupSubtotal(group)});
}

export function groupFinanceInvoices(current, selections, id, now = new Date()) {
  const sources=selections.map(selected=>{
    const found=current.find(row=>row.id===selected.id);
    if(!found || (found.financeRevision||0)!==(selected.financeRevision||0)) throw new Error('Un borrador cambió. Revisa la selección antes de unificar.');
    return found;
  });
  const group=buildInvoiceGroup(sources,id,now),ids=new Set(group.sourceInvoiceIds);
  return [group,...current.map(row=>ids.has(row.id)?{...row,estado:'Agrupado',groupedInto:id,groupedAt:group.groupedAt}:row)];
}

export function effectiveCaseInvoice(caseRef,invoices) {
  const key=value=>String(value||'').trim().toUpperCase();
  const source=invoices.filter(row=>key(row.expediente)===key(caseRef)).sort((a,b)=>Number(Boolean(b.groupedInto))-Number(Boolean(a.groupedInto))||Number(b.importe||0)-Number(a.importe||0))[0];
  if(!source?.groupedInto)return source;
  const group=invoices.find(row=>row.id===source.groupedInto);
  // Use the source amount for per-case reporting, never the entire group total per case.
  return group?{...source,estado:group.estado,holdedId:group.holdedId,holdedNumber:group.holdedNumber,holdedStatus:group.holdedStatus,groupedInto:group.id}:source;
}
