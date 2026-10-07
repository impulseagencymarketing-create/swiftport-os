export function billingToday(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value=type=>parts.find(part=>part.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function refreshDraftDueDate(invoice,now=new Date()) {
  if(['Enviado a Holded','Facturado','Cobrado','Archivado'].includes(invoice?.estado)||invoice?.holdedId||invoice?.holdedNumber||invoice?.holdedAt||invoice?.holdedStatus)return invoice;
  const today=billingToday(now),due=String(invoice?.vencimiento||'').trim();
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(due)&&!Number.isNaN(Date.parse(due))&&new Date(due).toISOString().slice(0,10)===due;
  return valid&&due>=today?invoice:{...invoice,vencimiento:today};
}
