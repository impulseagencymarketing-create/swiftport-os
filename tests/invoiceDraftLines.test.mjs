import test from 'node:test';
import assert from 'node:assert/strict';
import {savedInvoiceLines, editInvoiceLine} from '../src/invoiceDraftLines.mjs';

const proposed = [{id:'transport',item:'TRANSPORT',price:95,units:1,tax:'0%'}, {id:'reception',price:60,units:1}];
test('saved standard and legacy prices win over tariff changes', () => {
  const saved = [{...proposed[0],price:123.45,units:2,detail:'Precio acordado',tax:'21%'}];
  assert.deepEqual(savedInvoiceLines(saved, proposed), saved);
  assert.notEqual(savedInvoiceLines(saved, proposed)[0], saved[0]);
  assert.deepEqual(savedInvoiceLines(savedInvoiceLines(saved, proposed), proposed), saved);
});
test('zero prices, zero units, removed lines and custom lines stay intact', () => {
  const saved = [{id:'reception',price:0,units:0}, {id:'custom',price:17,units:3}];
  assert.deepEqual(savedInvoiceLines(saved, proposed), saved);
});
test('a new draft without stored lines receives the tariff proposal', () => {
  assert.deepEqual(savedInvoiceLines(undefined, proposed), proposed);
  assert.deepEqual(savedInvoiceLines([], proposed), proposed);
});
test('editing detail, units or name does not recalculate a negotiated price', () => {
  let lines = editInvoiceLine(proposed,0,'price','123.45');
  for (const [field,value] of [['detail','4 BOXES'],['units','2'],['item','DELIVERY']]) lines = editInvoiceLine(lines,0,field,value);
  assert.equal(lines[0].price,'123.45');
  assert.equal(proposed[0].price,95);
});
