export const OVERTIME_RATE = 0.30;
export const OVERTIME_MARGIN_MINUTES = 60;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const isAutoOvertime = line => String(line?.id || '').startsWith('auto-overtime:');
export const overtimeLocked = invoice => ['Enviado a Holded','Facturado','Cobrado','Archivado'].includes(invoice?.estado) || Boolean(invoice?.holdedId || invoice?.holdedNumber || invoice?.holdedAt || invoice?.holdedStatus);
const clockMinutes = value => {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value || ''));
  if (!match || +match[1] > 23 || +match[2] > 59) return null;
  return +match[1] * 60 + +match[2];
};
export function nightService(service) {
  const start = clockMinutes(service?.inicio), endClock = clockMinutes(service?.fin);
  if (start === null || endClock === null || start === endClock) return null;
  const end = endClock + (endClock < start ? 1440 : 0) + OVERTIME_MARGIN_MINUTES;
  // Half-open intervals: ending (including margin) at 20:00 is not working after 20:00.
  for (let day = 0; day <= Math.floor(end / 1440); day++) {
    if (start < day * 1440 + 480 && end > day * 1440) return true;
    if (start < day * 1440 + 1440 && end > day * 1440 + 1200) return true;
  }
  return false;
}
export const isServiceLine = line => {
  const id = String(line?.id || '').toLowerCase(), label = String(line?.item || '').toUpperCase();
  return !isAutoOvertime(line) && id !== 'ref' && !id.startsWith('cancel-') && !id.startsWith('supply-sale-') && !/^(STORAGE|WAREHOUSE|WAREHOUSING|ALMACENAJE|OVERTIME|RECARGO NOCTURNO)\b/.test(label) && !['storage','warehouse','open-warehouse-night'].includes(id) && (Number(line?.price) || 0) * (Number(line?.units) || 0) > 0;
};
const automaticTransportLine = line => ['transport','delivery-vessel','survey'].includes(line.id) || /^(tariff-)?(warehouse-vessel|delivery-vessel)(-|$)/.test(String(line.id)) || /^(TRANSPORT FROM WAREHOUSE TO VESSEL|DELIVERY VESSEL|SURVEY)/i.test(line.item || '');
export function applyOvertime(invoice, services = [], {cancelled = false} = {}) {
  if (overtimeLocked(invoice)) return invoice;
  const base = (invoice.lines || []).filter(line => !isAutoOvertime(line));
  const records = [...new Map(services.filter(s => !/cancel|anulad/i.test(s.estado || '')).map(s => [s.transporte || s.id || [s.fecha,s.inicio,s.fin,s.origen,s.destino].join('|'),s])).values()];
  const manualSurcharge = base.some(line => /\bOVERTIME\b|RECARGO NOCTURNO/i.test(line.item || ''));
  const additions = [], review = [];
  if (!cancelled) for (const [index,line] of base.entries()) {
    if (!isServiceLine(line)) continue;
    const manual = line.overtimeSchedule?.mode === 'manual';
    const schedules = manual ? [line.overtimeSchedule] : line.transportServiceKey ? records.filter(record=>String(record.transporte||record.id||[record.fecha,record.inicio,record.origen,record.destino].join('|'))===line.transportServiceKey) : line.transportSplitUnmatched ? [] : automaticTransportLine(line) ? records : [];
    const statuses = schedules.map(nightService);
    const units = Number(line.units) || 0;
    const ambiguous = !manual && schedules.length > 1 && units !== schedules.length;
    const unknown = manualSurcharge || !schedules.length || ambiguous || statuses.some(status => status === null);
    const reason = manualSurcharge ? 'Revisa el overtime manual existente para evitar duplicarlo.' : ambiguous ? 'Varios servicios: vincula un horario a esta línea o ajusta sus unidades.' : unknown ? 'Falta un horario de inicio y fin verificable.' : '';
    const count = statuses.filter(Boolean).length;
    const baseAmount = (Number(line.price) || 0) * units;
    const surcharge = unknown ? 0 : round(baseAmount * OVERTIME_RATE * (manual || schedules.length === 1 ? Number(count > 0) : count / schedules.length));
    const detail = schedules.map(s => `${s.fecha || ''} ${s.inicio || '?'}–${s.fin || '?'} + 1 h`.trim()).join(' · ');
    review.push({lineId:line.id,index,item:line.item,unknown,reason,night:!unknown && count > 0,surcharge,detail});
    if (surcharge > 0) additions.push({id:`auto-overtime:${line.id || index}`,item:'OVERTIME 30 %',detail:`${line.item} · ${detail} · franja 20:00–08:00`,price:surcharge,units:1,tax:line.tax || '0%',overtimeSource:line.id,overtimeRate:OVERTIME_RATE,overtimeMarginMinutes:60});
  }
  const lines = [...base,...additions];
  const importe = round(lines.reduce((sum,line)=>sum+(Number(line.price)||0)*(Number(line.units)||0),0));
  return {...invoice,lines,importe,overtimePolicyVersion:'night-30-margin-60-v1',margen:round(importe-(Number(invoice.coste)||0)),overtimeReview:review};
}
