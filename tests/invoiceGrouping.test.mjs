import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvoiceGroup,groupFinanceInvoices,groupEligible,effectiveCaseInvoice} from '../src/invoiceGrouping.mjs';
export const fixtures=[1,2].map((n)=>({id:`BOR-${n}`,expediente:`SW-2026-000${n}`,cliente:'WRIST',buque:`VESSEL ${n}`,puerto:'Barcelona',concepto:`SERVICE ${n}`,purchaseOrder:`PO${n}`,estado:'Borrador',financeRevision:2,lines:[{id:'transport',item:'TRANSPORT',detail:`${n} BOXES · 20/10/2026 · 08:00–09:00 · WAREHOUSE → VESSEL`,price:n*125.25,units:1,tax:n===1?'21%':'0%'}]}));
test('group preserves every line, tax, cargo, route, PO, price and distinct identity',()=>{
 const group=buildInvoiceGroup(fixtures,'GRP-test');
 assert.equal(group.lines.length,4);assert.equal(group.importe,375.75);
 assert.equal(new Set(group.lines.map(line=>line.id)).size,4);
 assert.equal(group.lines[1].detail,fixtures[0].lines[0].detail);
 assert.ok(group.lines.every(line=>line.tax==='21%'));assert.match(group.lines[0].detail,/PO1/);
 assert.deepEqual(group.sourceInvoiceIds,['BOR-1','BOR-2']);assert.equal(group.manualPricingConfirmed,false);
});
test('reject mixed clients, repeated cases, already sent and stale selection',()=>{
 for(const patch of [{cliente:'LIMANI'},{cliente:'WRIST OTHER ENTITY'},{estado:'Facturado'},{holdedId:'sent'},{groupedInto:'GRP-old'},{expediente:fixtures[0].expediente}])assert.throws(()=>buildInvoiceGroup([fixtures[0],{...fixtures[1],...patch}],'GRP-test'));
 assert.throws(()=>groupFinanceInvoices([{...fixtures[0],financeRevision:3},fixtures[1]],fixtures,'GRP-test'));
});
test('sources locked, effective status follows group, per-case totals not multiplied',()=>{
 const grouped=groupFinanceInvoices(fixtures,fixtures,'GRP-test');
 assert.equal(grouped.length,3);assert.equal(groupEligible(grouped[1]),false);
 grouped[0].estado='Enviado a Holded';grouped[0].holdedId='holded-group';
 const linked=effectiveCaseInvoice(fixtures[0].expediente,grouped);
 assert.equal(linked.holdedId,'holded-group');assert.equal(linked.estado,'Enviado a Holded');
 assert.deepEqual(linked.lines,fixtures[0].lines);assert.notEqual(linked.importe,grouped[0].importe);
});
