// A tariff is a starting proposal, never an instruction to overwrite a saved draft.
// Preserve legacy drafts too: they did not record which prices were edited manually.
export function savedInvoiceLines(stored, proposed = []) {
  const source = Array.isArray(stored) && stored.length ? stored : proposed;
  return (Array.isArray(source) ? source : []).map(line => ({...line}));
}

export function editInvoiceLine(lines, index, field, value) {
  return lines.map((line, position) => position === index ? {...line, [field]: value, ...(field==='detail' && line.transportDetailBlock ? {transportDetailManual:true} : {})} : line);
}
