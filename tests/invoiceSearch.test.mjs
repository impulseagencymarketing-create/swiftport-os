import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceSearchText,invoiceMatchesSearch} from '../src/invoiceSearch.mjs';
const invoice={id:'BOR-2026-0236',expediente:'SW-2026-0236',cliente:'UME Shipping',concepto:'Supply',proforma:'PRO260236',holdedInvoiceNumber:'A20260400',lines:[{item:'SUPPLY',detail:'Moledor de carne'}]};
const cases=[{id:'SW-2026-0236',buque:'GUBAL TRADER',puerto:'A Coruña',purchaseOrder:'04-074/2026H-O001'}];
test('finds vessel, client, case, PO, Holded number and line details',()=>{
 const text=invoiceSearchText(invoice,cases);
 for(const query of ['gubal UME','0236','04-074/2026H-O001','pro260236','a20260400','coruna','MOLEDOR   carne',''])assert.ok(invoiceMatchesSearch(text,query),query);
 assert.equal(invoiceMatchesSearch(text,'gubal wrist'),false);
});
test('joint invoices are found by each source vessel and case PO',()=>{
 const group={id:'GRP-1',expedientes:['SW-2026-0236'],sourceInvoiceIds:['BOR-2026-0236'],groupSources:[{expediente:'SW-2026-0236',buque:'GUBAL TRADER'}]};
 assert.ok(invoiceMatchesSearch(invoiceSearchText(group,cases),'gubal 04-074'));
 assert.ok(invoiceMatchesSearch(invoiceSearchText(group,cases),'BOR-2026-0236'));
 assert.equal(invoiceMatchesSearch(invoiceSearchText(group,[...cases,{id:'OTHER',buque:'UNRELATED'}]),'unrelated'),false);
});
test('search is read-only and handles sparse documents',()=>{
 const before=JSON.stringify(invoice);invoiceSearchText(invoice,cases);assert.equal(JSON.stringify(invoice),before);
 assert.ok(invoiceMatchesSearch(invoiceSearchText({}),'  '));
 assert.equal(invoiceMatchesSearch(invoiceSearchText({}),'gubal'),false);
});
