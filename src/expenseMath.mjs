export const cents = value => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Math.round(Number(text) * 100);
  return Number.isSafeInteger(amount) && Math.abs(amount) <= 1000000000 ? amount : null;
};
export function equalSplit(amount, ids) {
  const total = cents(amount);
  if (total === null || !ids.length) return [];
  const absolute = Math.abs(total), base = Math.floor(absolute / ids.length), remainder = absolute % ids.length;
  return ids.map((caseRef, index) => ({caseRef, amount: ((base + (index < remainder ? 1 : 0)) * Math.sign(total) / 100).toFixed(2)}));
}
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function suggestCases(invoice, cases) {
  const refs = (invoice.references || []).map(key).filter(Boolean);
  const vessels = (invoice.vessels || []).map(key).filter(Boolean);
  return cases.map(item => {
    const reasons = [];
    if (refs.includes(key(item.id))) reasons.push('Referencia de expediente');
    if (key(item.purchaseOrder) && refs.includes(key(item.purchaseOrder))) reasons.push('PO coincidente');
    if (key(item.buque) && vessels.includes(key(item.buque))) reasons.push('Nombre del buque');
    return {item, reasons, score: reasons.includes('Referencia de expediente') ? 100 : reasons.includes('PO coincidente') ? 80 : reasons.length ? 40 : 0};
  }).filter(row => row.score).sort((a,b) => b.score-a.score);
}
