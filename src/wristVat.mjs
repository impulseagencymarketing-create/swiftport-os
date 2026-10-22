export const isWristInvoice=invoice=>/\bwrist\b/i.test(invoice?.cliente||'');
export const WRIST_OLD_EXEMPTION='Exención de IVA según ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre';
// Customer billing rule requested by operations. Never rewrite issued documents or grouped originals.
export function applyWristVat(invoice) {
  if(!isWristInvoice(invoice)||invoice.groupedInto||['Enviado a Holded','Facturado','Cobrado','Archivado','Agrupado'].includes(invoice.estado)||['holdedId','holdedNumber','holdedAt','holdedStatus'].some(key=>invoice[key]))return invoice;
  const lines=(invoice.lines||[]).map(line=>({...line,tax:'21%'}));
  const observaciones=typeof invoice.observaciones==='string'?invoice.observaciones.split(WRIST_OLD_EXEMPTION).join('').trim():invoice.observaciones;
  if(lines.every((line,index)=>line.tax===invoice.lines[index].tax)&&observaciones===invoice.observaciones)return invoice;
  return {...invoice,lines,...(observaciones!==undefined?{observaciones}:{})};
}
