// Acknowledged state is the source of truth. Failed requests never look saved.
export const financeContent = value => JSON.stringify(value, (key, entry) => key === 'financeRevision' ? undefined : entry);

export function mergeFinanceSnapshot(current, baseline, proposed) {
  const merge = (key, id) => {
    const before = new Map((baseline[key] || []).map(row => [row[id], row]));
    const now = new Map((current[key] || []).map(row => [row[id], row]));
    const retained = new Set((proposed[key] || []).map(row => row[id]));
    for (const [identity, row] of before) {
      if (!retained.has(identity) && financeContent(now.get(identity)) === financeContent(row)) now.delete(identity);
    }
    for (const row of proposed[key] || []) {
      // Automatic refreshes may only replace the version they actually read.
      if (financeContent(now.get(row[id])) === financeContent(before.get(row[id]))) now.set(row[id], row);
    }
    return [...now.values()];
  };
  return {...current, clients: merge('clients', 'codigo'), invoices: merge('invoices', 'id')};
}

export function createFinanceWriter({read, commit, send, protect = (_, next) => next}) {
  let tail = Promise.resolve();
  return update => {
    const baseline = read();
    const run = async () => {
      const current = read();
      const next = protect(current, typeof update === 'function' ? update(current) : mergeFinanceSnapshot(current, baseline, update));
      const changed = (key, id) => {
        const before = new Map((current[key] || []).map(row => [row[id], row]));
        return (next[key] || []).filter(row => financeContent(row) !== financeContent(before.get(row[id])));
      };
      const invoices = changed('invoices', 'id').map(row => ({...row, financeRevision: current.invoices.find(old => old.id === row.id)?.financeRevision || 0}));
      const clients = changed('clients', 'codigo');
      if (!invoices.length && !clients.length) {
        // Preserve the existing local duplicate filter; this does not delete server records.
        if (next.invoices.length !== current.invoices.length || next.clients.length !== current.clients.length) commit(next);
        return next;
      }
      const result = await send({clients, invoices});
      if (result?.ok !== true) throw new Error('El servidor no confirmó el guardado. Vuelve a intentarlo.');
      const versions = result?.invoiceVersions || {};
      const saved = {...next, invoices: next.invoices.map(row => ({...row, ...(result.invoiceDueDates?.[row.id] ? {vencimiento:result.invoiceDueDates[row.id]} : {}), financeRevision: versions[row.id] ?? current.invoices.find(old => old.id === row.id)?.financeRevision ?? 0}))};
      commit(saved);
      return saved;
    };
    const result = tail.then(run);
    tail = result.catch(() => {});
    return result;
  };
}
