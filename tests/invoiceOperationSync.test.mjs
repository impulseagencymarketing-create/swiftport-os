import test from 'node:test';
import assert from 'node:assert/strict';
import {operationSnapshot,syncInvoiceOperation as sync,syncGroupedInvoiceOperations} from '../src/invoiceOperationSync.mjs';
const template=weight=>({cliente:'Limani',buque:'SAHAR',puerto:'Barcelona',concepto:'SW-1 SAHAR 03/11/26 BARCELONA',coste:10,lines:[{id:'ref',item:'SW-1',detail:`1 BOX ${weight} KGS`,price:0,units:1,tax:'0%'},{id:'reception',item:'RECEPTION',detail:`1 BOX ${weight} KGS`,price:weight>35?60:15,units:1,tax:'0%'}]});
test('closed operational case gets fresh kilos and weight tariff in its draft',()=>{
 const before={...template(20),estado:'Borrador',operationSnapshot:operationSnapshot(template(20))};
 const after=sync(before,template(40));
 assert.equal(after.lines[1].detail,'1 BOX 40 KGS');assert.equal(after.lines[1].price,60);assert.equal(after.operationReviewRequired,true);
 assert.equal(sync(after,template(40)),after);
});
test('manual prices and extra lines survive; cargo refresh requires review',()=>{
 const before={...template(20),manualEdited:true,lines:[{...template(20).lines[1],price:27},{id:'custom',item:'EXTRA',price:9,units:1}],operationSnapshot:operationSnapshot(template(20))};
 const after=sync(before,template(40));
 assert.equal(after.lines[0].price,27);assert.equal(after.lines[0].detail,'1 BOX 40 KGS');assert.equal(after.lines[1].item,'EXTRA');assert.equal(after.manualPricingConfirmed,false);
});
test('issued invoices are never rewritten and retain evidence of changed operation',()=>{
 const before={...template(20),importe:15,estado:'Facturado',holdedId:'h1',operationSnapshot:operationSnapshot(template(20))};
 const after=sync(before,template(40));
 assert.equal(after.lines,before.lines);assert.equal(after.importe,15);assert.equal(after.concepto,before.concepto);assert.ok(after.operationChangeNotice);assert.equal(after.operationCurrent.lines[1].price,60);assert.equal(sync(after,template(40)),after);
});
test('legacy drafts refresh cargo without guessing whether saved prices were manual',()=>{
 const before={...template(20),lines:[{...template(20).lines[1],price:22}],estado:'Borrador'};
 const after=sync(before,template(40));assert.equal(after.lines[0].detail,'1 BOX 40 KGS');assert.equal(after.lines[0].price,22);assert.equal(after.operationReviewRequired,true);
});
test('group sources stay byte-for-byte immutable, even without a baseline or with changed cargo',()=>{
 for(const extra of [{},{operationSnapshot:operationSnapshot(template(20))}]){
   const before={...template(20),groupedInto:'GRP-1',...extra};
   assert.equal(sync(before,template(40)),before);assert.equal(sync(before,template(20)),before);
 }
});
test('joint invoice carries the review, preserves prices and does not re-block after acknowledgement',()=>{
 const source={...template(20),id:'BOR-1',expediente:'SW-1',groupedInto:'GRP-1',operationSnapshot:operationSnapshot(template(20))};
 const group={id:'GRP-1',sourceInvoiceIds:['BOR-1','BOR-2'],manualEdited:true,manualPricingConfirmed:true,lines:[{price:777,units:2,detail:'Manual'}],importe:1554};
 const next=syncGroupedInvoiceOperations(group,[source],()=>template(40));
 assert.equal(next.lines,group.lines);assert.equal(next.importe,1554);assert.equal(next.operationReviewRequired,true);
 assert.equal(next.manualPricingConfirmed,false);assert.match(next.operationChangeNotice,/SW-1/);
 assert.equal(source.operationChangeNotice,undefined);
 assert.equal(syncGroupedInvoiceOperations(next,[source],()=>template(40)),next);
 const reviewed={...next,operationReviewRequired:false,operationChangeNotice:'',manualPricingConfirmed:true};
 assert.equal(syncGroupedInvoiceOperations(reviewed,[source],()=>template(40)),reviewed);
 assert.equal(syncGroupedInvoiceOperations(reviewed,[source],()=>template(80)).operationReviewRequired,true);
 const issued=syncGroupedInvoiceOperations({...group,holdedId:'H-1',estado:'Facturado'},[source],()=>template(40));
 assert.equal(issued.lines,group.lines);assert.equal(issued.operationReviewRequired,false);
});
test('automatic removed services are removed but custom edited lines survive',()=>{
 const old=template(20),fresh={...template(20),lines:[template(20).lines[0]]};
 assert.equal(sync({...old,operationSnapshot:operationSnapshot(old)},fresh).lines.length,1);
 assert.equal(sync({...old,lines:[old.lines[0],{...old.lines[1],price:123}],operationSnapshot:operationSnapshot(old)},fresh).lines.length,2);
});
