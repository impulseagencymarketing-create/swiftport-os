import test from 'node:test';
import assert from 'node:assert/strict';
import {nightService,applyOvertime,isAutoOvertime} from '../src/overtime.mjs';
const line=(extra={})=>({id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',price:100,units:1,tax:'21%',...extra});
const invoice=(lines=[line()])=>({id:'BOR-test',estado:'Borrador',coste:40,lines});
const service=(inicio,fin,extra={})=>({id:'TR-test',fecha:'2026-09-16',inicio,fin,...extra});
test('night window and extra hour at the end, including midnight',()=>{
  for(const [start,end,expected] of [['18:30','19:30',true],['18:00','19:00',false],['19:00','20:00',true],['20:00','21:00',true],['07:59','08:30',true],['08:00','09:00',false],['23:30','00:15',true],['00:00','01:00',true],['08:00','18:59',false],['08:00','19:01',true]]) assert.equal(nightService(service(start,end)),expected,`${start}-${end}`);
});
test('missing or invalid hours require review, never guess',()=>{
  for(const [start,end] of [['','21:00'],['20:00',''],['xx','21:00'],['24:00','01:00'],['08:00','08:00'],['08:99','09:00']]) assert.equal(nightService(service(start,end)),null);
  const result=applyOvertime(invoice(),[service('20:00','')]);
  assert.equal(result.importe,100);assert.equal(result.overtimeReview[0].unknown,true);
});
test('whole service +30%, inherited tax, no compound or duplicate surcharge',()=>{
  const records=[service('18:30','19:30')];const result=applyOvertime(invoice(),records);
  assert.equal(result.importe,130);assert.equal(result.margen,90);
  assert.equal(result.lines[1].tax,'21%');assert.equal(result.lines[1].price,30);
  assert.deepEqual(applyOvertime(result,records),result);
  const daytime=applyOvertime(result,[service('10:00','11:00')]);
  assert.equal(daytime.importe,100);assert.equal(daytime.lines.length,1);
});
test('only the night service is charged when a line groups two transport units',()=>{
  const result=applyOvertime(invoice([line({units:2})]),[service('10:00','11:00'),service('20:00','21:00',{id:'TR-night'})]);
  assert.equal(result.importe,230);assert.equal(result.lines[1].price,30);
});
test('cancellation, duplicate calendar records and ambiguous units',()=>{
  const records=[service('20:00','21:00',{transporte:'TR-1'}),service('20:00','21:00',{id:'CAL-1',transporte:'TR-1'})];
  assert.equal(applyOvertime(invoice(),records).importe,130);
  assert.equal(applyOvertime(invoice(),[service('20:00','21:00',{estado:'Cancelado'})]).importe,100);
  const cancelled=applyOvertime(invoice(),records,{cancelled:true});assert.equal(cancelled.importe,100);assert.deepEqual(cancelled.overtimeReview,[]);
  assert.equal(applyOvertime(invoice(),[service('20:00','21:00'),service('10:00','11:00',{id:'TR-2'})]).overtimeReview[0].unknown,true);
});
test('other services use their own explicit hours; no surcharge on goods/storage/reference',()=>{
  const other=line({id:'handling',item:'HANDLING',price:25,overtimeSchedule:{mode:'manual',inicio:'18:30',fin:'19:30'}});
  const base=[other,line({id:'storage',item:'STORAGE',price:10}),line({id:'supply-sale-1',item:'CEMENT',price:50}),line({id:'ref',price:0})];
  const result=applyOvertime(invoice(base),[]);
  assert.equal(result.lines.filter(isAutoOvertime).length,1);assert.equal(result.lines.at(-1).price,7.5);
  assert.equal(result.overtimeReview.length,1);
});
test('unknown reception is not assigned the time of an unrelated night delivery',()=>{
  const result=applyOvertime(invoice([line({id:'reception',item:'RECEPTION'})]),[service('20:00','21:00')]);
  assert.equal(result.importe,100);assert.equal(result.overtimeReview[0].unknown,true);
});
test('sent, billed, paid, archived or Holded-linked invoices remain unchanged',()=>{
  for(const props of [{estado:'Enviado a Holded'},{estado:'Facturado'},{estado:'Cobrado'},{estado:'Archivado'},{holdedId:'abc'},{holdedAt:'2026-09-16'},{holdedStatus:'Creado'}]){
    const original={...invoice(),...props};assert.equal(applyOvertime(original,[service('20:00','21:00')]),original);
  }
});
test('manual overtime cannot silently combine with automatic overtime',()=>{
  const result=applyOvertime(invoice([line(),line({id:'manual-ot',item:'OVERTIME 30%',price:30})]),[service('20:00','21:00')]);
  assert.equal(result.lines.filter(isAutoOvertime).length,0);assert.equal(result.overtimeReview[0].unknown,true);
});
test('recalculates after changes to price, quantity and manual hours, rounded to cents',()=>{
  const result=applyOvertime(invoice([line({price:19.99})]),[service('20:00','21:00')]);assert.equal(result.importe,25.99);
  result.lines[0].price=200;result.lines[0].overtimeSchedule={mode:'manual',inicio:'10:00',fin:'11:00'};
  assert.equal(applyOvertime(result,[service('20:00','21:00')]).importe,200);
});
