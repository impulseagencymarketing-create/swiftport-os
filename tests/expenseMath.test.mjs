import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,equalSplit,suggestCases} from '../src/expenseMath.mjs';

test('decimal amounts, Spanish commas and invalid input',()=>{
  assert.equal(cents('19,90'),1990);
  assert.equal(cents('-0.01'),-1);
  for(const value of ['',null,'1.001','1e3','NaN','10000001','1.000,00']) assert.equal(cents(value),null);
});
test('equal split preserves every cent, including credits',()=>{
  assert.deepEqual(equalSplit('100',['A','B','C']).map(row=>row.amount),['33.34','33.33','33.33']);
  assert.deepEqual(equalSplit('-100',['A','B','C']).map(row=>row.amount),['-33.34','-33.33','-33.33']);
  for(let amount=-199;amount<=199;amount++) for(let count=1;count<=12;count++) {
    const rows=equalSplit((amount/100).toFixed(2),Array.from({length:count},(_,i)=>String(i)));
    assert.equal(rows.reduce((sum,row)=>sum+cents(row.amount),0),amount);
  }
});
const cases=[{id:'SW-1',buque:'WASA EXPRESS',purchaseOrder:'POA604877'},{id:'SW-2',buque:'Wasa Express',purchaseOrder:'PO-OTHER'},{id:'SW-3',buque:'MONTE EXPRESS'}];
test('same vessel leaves both operations as suggestions, not a confident match',()=>{
  const matches=suggestCases({vessels:['WASA EXPRESS']},cases);
  assert.equal(matches.length,2);
  assert.ok(matches.every(row=>row.score===40));
});
test('explicit case and PO references outrank vessel names',()=>{
  const matches=suggestCases({vessels:['WASA EXPRESS'],references:['POA604877','SW-3']},cases);
  assert.deepEqual(matches.map(row=>[row.item.id,row.score]),[['SW-3',100],['SW-1',80],['SW-2',40]]);
  assert.deepEqual(suggestCases({},cases),[]);
});
