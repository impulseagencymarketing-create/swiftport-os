import test from 'node:test';
import assert from 'node:assert/strict';
import {billingToday,refreshDraftDueDate} from '../src/invoiceDates.mjs';
const now=new Date('2026-10-07T22:30:00Z');
test('old, blank and malformed due dates become today in Madrid, without changing manual lines',()=>{
 for(const vencimiento of ['2026-10-07','','invalid','2026-02-30']){
  const invoice={estado:'Borrador',vencimiento,manualEdited:true,lines:[{price:17.45,detail:'875 KGS'}]};
  const updated=refreshDraftDueDate(invoice,now);
  assert.equal(updated.vencimiento,'2026-10-08');assert.equal(updated.lines,invoice.lines);
 }
});
test('future and current dates, issued and archived documents are not changed',()=>{
 for(const vencimiento of ['2026-10-08','2026-11-07']){const row={vencimiento};assert.equal(refreshDraftDueDate(row,now),row)}
 for(const estado of ['Enviado a Holded','Facturado','Cobrado','Archivado']){const row={estado,vencimiento:'2026-08-01'};assert.equal(refreshDraftDueDate(row,now),row)}
 const row={estado:'Borrador',holdedId:'issued',vencimiento:'2026-08-01'};assert.equal(refreshDraftDueDate(row,now),row);
});
test('Madrid day boundaries work in winter and summer independently of device timezone',()=>{
 assert.equal(billingToday(new Date('2026-01-01T23:30:00Z')),'2026-01-02');
 assert.equal(billingToday(new Date('2026-06-01T22:30:00Z')),'2026-06-02');
});
