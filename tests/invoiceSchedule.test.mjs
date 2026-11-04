import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceOperationLabel as label,refreshInvoiceOperationDate as refresh} from '../src/invoiceSchedule.mjs';
test('reception-only cases use linked warehouse dates, never another case',()=>{
 assert.equal(label({id:'SW-1'},[],[],[{expediente:'SW-2',fechaRecepcion:'2026-01-01'},{expediente:'SW-1',fechaRecepcion:'2026-11-03T09:00:00Z'}]),'RECEPCIÓN 03/11/26');
 assert.equal(label({id:'SW-1',recepciones:[{fecha:'2/11/2026, 12:00'}]}),'RECEPCIÓN 02/11/26');
});
test('schedule falls back across invalid values and transport dates',()=>{
 assert.equal(label({portCall:{etaDate:'bad'},etaDate:'2026-11-02'}),'02/11/26');
 assert.equal(label({etb:'2026-11-03'}),'ETB 03/11/26');
 assert.equal(label({etd:'2026-11-04'}),'ETD 04/11/26');
 assert.equal(label({id:'SW-1'},[{expediente:'SW-1',estado:'Cancelado',fecha:'2026-11-03'},{expediente:'SW-1',estado:'Entregado',fecha:'2026-11-02'}]),'TRANSPORTE 02/11/26');
 assert.equal(label({eta:'2026-02-30'}),'');
});
test('existing manual drafts replace placeholders without touching prices or issued invoices',()=>{
 const original={estado:'Borrador',manualEdited:true,concepto:'SW-1 FECHA POR CONFIRMAR BCN',importe:85,lines:[{id:'ref',item:'SW-1 FECHA POR CONFIRMAR BCN',price:85}]};
 const next=refresh(original,'RECEPCIÓN 03/11/26');
 assert.equal(next.concepto,'SW-1 RECEPCIÓN 03/11/26 BCN');
 assert.equal(next.lines[0].price,85);
 assert.equal(next.importe,85);
 assert.equal(refresh(next,'RECEPCIÓN 03/11/26'),next);
 const issued={...original,holdedId:'123'};
 assert.equal(refresh(issued,'03/11/26'),issued);
 assert.equal(refresh(original,''),original);
});
