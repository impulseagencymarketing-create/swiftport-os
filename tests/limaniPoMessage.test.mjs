import test from 'node:test';
import assert from 'node:assert/strict';
import {missingLimaniPOs,limaniPoText} from '../src/limaniPoMessage.mjs';
test('only missing Limani POs, deduplicated by case; exclude issued and archived',()=>{
 const base={cliente:'Limani',expediente:'SW-1',buque:'SIDER LIU',estado:'Borrador'};
 const rows=missingLimaniPOs([base,{...base,id:'duplicate'},{...base,expediente:'SW-2',purchaseOrder:'PO123'},{...base,expediente:'SW-3',estado:'Archivado'},{...base,expediente:'SW-4',holdedId:'sent'},{...base,expediente:'SW-5',cliente:'Other'},{...base,expediente:'SW-6'}],[{id:'SW-6',cliente:'Limani',poNumber:'PO456'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].ref,'SW-1');
 assert.match(limaniPoText(rows),/SIDER LIU/);assert.doesNotMatch(limaniPoText(rows),/POR CONFIRMAR|undefined/);
});
test('message includes real dates and port, and no internal financial data',()=>{
 const rows=missingLimaniPOs([{expediente:'SW-1',cliente:'Limani',importe:123,coste:80}],[{id:'SW-1',buque:'SAHAR',puerto:'Barcelona',recepciones:[{fecha:'2026-11-03'}]}]);
 assert.match(limaniPoText(rows),/SAHAR · Barcelona · RECEIPT 03\/11\/26 · SW-1/);
 assert.equal(limaniPoText([]),'');
});
test('POA request includes line subtotal and combined total, never supplier cost or margin',()=>{
 const rows=missingLimaniPOs([{expediente:'SW-1',cliente:'Limani',importe:999,coste:888,lines:[{price:40,units:2},{price:5,units:1}]},{expediente:'SW-2',cliente:'Limani',importe:40}]);
 const message=limaniPoText(rows);
 assert.match(message,/85\.00 EUR/);assert.match(message,/40\.00 EUR/);assert.match(message,/Total \(excluding VAT\): 125\.00 EUR/);assert.doesNotMatch(message,/999|888/);
});
test('unknown amount is not zero and unreviewed operations are marked provisional',()=>{
 const rows=missingLimaniPOs([{expediente:'SW-1',cliente:'Limani'},{expediente:'SW-2',cliente:'Limani',importe:40,operationReviewRequired:true}]);
 const message=limaniPoText(rows);assert.match(message,/Amount pending/);assert.match(message,/provisional/);assert.doesNotMatch(message,/Total \(excluding VAT\)/);
});
