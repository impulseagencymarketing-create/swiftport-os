const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Search display data only; never recalculate or mutate financial documents.
export function invoiceSearchText(invoice, cases = []) {
  const refs = new Set([invoice.expediente, ...(invoice.expedientes || []), ...(invoice.groupSources || []).map(row => row.expediente)].filter(Boolean));
  const fields = row => [row.id, row.expediente, row.buque, row.cliente, row.puerto, row.concepto, row.purchaseOrder, row.poNumber, row.proforma, row.holdedNumber, row.holdedInvoiceNumber];
  return normalize([
    ...fields(invoice), ...refs, ...(invoice.sourceInvoiceIds || []),
    ...(invoice.groupSources || []).flatMap(fields),
    ...cases.filter(row => refs.has(row.id)).flatMap(fields),
    ...(invoice.lines || []).flatMap(row => [row.item, row.detail, row.sourceCaseRef]),
  ].filter(Boolean).join(' '));
}

export function invoiceMatchesSearch(text, query) {
  return normalize(query).split(' ').filter(Boolean).every(term => text.includes(term));
}
