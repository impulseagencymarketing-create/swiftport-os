export const isManualInvoice = invoice => invoice?.manualEdited === true;
export const manualPricingApproved = invoice => isManualInvoice(invoice) && invoice.manualPricingConfirmed === true;
export function markManualInvoice(invoice) {
  const lines=(invoice.lines||[]).map(line=>({...line}));
  const importe=Math.round((lines.reduce((sum,line)=>sum+(Number(line.price)||0)*(Number(line.units)||0),0)+Number.EPSILON)*100)/100;
  return {...invoice,lines,importe,manualEdited:true,manualEditedAt:new Date().toISOString()};
}
