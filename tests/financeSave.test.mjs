import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinanceWriter, mergeFinanceSnapshot} from '../src/financeSave.mjs';

const initial = () => ({clients:[],invoices:[{id:'A',concepto:'Original',importe:70,financeRevision:2},{id:'B',importe:95}]});
const edit = (id, patch) => state => ({...state,invoices:state.invoices.map(row=>row.id===id?{...row,...patch}:row)});

test('only changed rows are sent and state waits for acknowledgement', async () => {
  let state=initial(),release,payload;
  const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:body=>{payload=body;return new Promise(resolve=>release=resolve)}});
  const pending=writer(edit('A',{importe:123.45,concepto:'Manual'}));
  await Promise.resolve();
  assert.equal(state.invoices[0].importe,70);
  assert.deepEqual(payload.clients,[]);
  assert.deepEqual(payload.invoices.map(row=>row.id),['A']);
  release({ok:true,invoiceVersions:{A:3}});await pending;
  assert.equal(state.invoices[0].importe,123.45);
  assert.equal(state.invoices[0].financeRevision,3);
});

test('writes serialize, carry the latest revision, and stale automatic work cannot overwrite manual edits', async () => {
  let state=initial(),release;const sent=[];
  const baseline=structuredClone(state);
  const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:async body=>{
    sent.push(body);if(sent.length===1)await new Promise(resolve=>release=resolve);
    return {ok:true,invoiceVersions:Object.fromEntries(body.invoices.map(row=>[row.id,row.financeRevision+1]))};
  }});
  const first=writer(edit('A',{importe:111}));
  const second=writer(edit('A',{importe:222,concepto:'Mi concepto'}));
  const auto=writer(current=>mergeFinanceSnapshot(current,baseline,edit('A',{importe:95})(baseline)));
  await Promise.resolve();assert.equal(sent.length,1);
  release();await Promise.all([first,second,auto]);
  assert.equal(sent.length,2);assert.equal(sent[1].invoices[0].financeRevision,3);
  assert.equal(state.invoices[0].importe,222);assert.equal(state.invoices[0].concepto,'Mi concepto');
});

test('failure is rejected without committing, and retry still works', async () => {
  let state=initial(),fail=true;
  const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:async()=>{if(fail)throw Error('Servidor no disponible');return {ok:true,invoiceVersions:{A:3}}}});
  await assert.rejects(writer(edit('A',{importe:0})),/Servidor/);
  assert.equal(state.invoices[0].importe,70);
  fail=false;await writer(edit('A',{importe:0}));assert.equal(state.invoices[0].importe,0);
});

test('independent invoice updates do not replace each other or unchanged rows', async () => {
  let state=initial();const sent=[];
  const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:async body=>{sent.push(body);return {ok:true}}});
  await Promise.all([writer(edit('A',{importe:120})),writer(edit('B',{importe:230}))]);
  assert.deepEqual(state.invoices.map(row=>row.importe),[120,230]);
  assert.deepEqual(sent.map(body=>body.invoices.map(row=>row.id)),[['A'],['B']]);
});

test('HTTP success without explicit save acknowledgement is not treated as saved', async () => {
  let state=initial();
  const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:async()=>({})});
  await assert.rejects(writer(edit('A',{importe:999})),/no confirmó/);
  assert.equal(state.invoices[0].importe,70);
});

test('duplicate filtering does not drop a draft that was edited after the filter ran', async () => {
  const baseline=initial(),proposed={...baseline,invoices:[baseline.invoices[0]]};
  assert.deepEqual(mergeFinanceSnapshot(baseline,baseline,proposed).invoices.map(row=>row.id),['A']);
  const newer=edit('B',{importe:345})(baseline);
  assert.deepEqual(mergeFinanceSnapshot(newer,baseline,proposed).invoices.map(row=>row.id),['A','B']);
});

test('acknowledged server due date is retained if the day changed during the request',async()=>{
 let state=initial();
 const writer=createFinanceWriter({read:()=>state,commit:next=>state=next,send:async()=>({ok:true,invoiceVersions:{A:3},invoiceDueDates:{A:'2026-10-09'}})});
 await writer(edit('A',{vencimiento:'2026-10-08'}));
 assert.equal(state.invoices[0].vencimiento,'2026-10-09');
});
