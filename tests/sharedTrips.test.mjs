import test from 'node:test';
import assert from 'node:assert/strict';
import {saveSharedTripState,groupSharedTrips,tripCaseIds,initialSharedTrip,allocateTripCost,syncSharedTripSchedule} from '../src/sharedTrips.mjs';
import {separateTransportLines} from '../src/invoiceTransportLines.mjs';
import {filterCalendarEvents,emptyCalendarSearch} from '../src/calendarSearch.mjs';
const state=()=>({cases:[{id:'A',buque:'WASA EXPRESS',gastos:[{id:'old',importe:25}],documentacionMercancia:{podArchivos:[{name:'A.pdf'}]}},{id:'B',buque:'MONTE EXPRESS',gastos:[],documentacionMercancia:{podArchivos:[{name:'B.pdf'}]}}],transports:[{id:'TA',expediente:'A',selectedCargo:[{id:'BOX-A'}],estado:'Entregado',origen:'Warehouse',destino:'WASA'},{id:'TB',expediente:'B',estado:'Asignado',origen:'Warehouse',destino:'MONTE'}],calendarEvents:[{id:'EA',transporte:'TA',expediente:'A',estado:'Entregado'},{id:'EB',transporte:'TB',expediente:'B',estado:'Pendiente'}]});
const draft=()=>({fecha:'2026-10-31',inicio:'10:00',fin:'12:00',asignado:'Driver',cost:'100.01',costMode:'equal',stops:[{expediente:'A',transportId:'TA',origen:'Warehouse',destino:'WASA',cargo:'A cargo'},{expediente:'B',transportId:'TB',origen:'Warehouse',destino:'MONTE',cargo:'B cargo'}]});
const save=(s=state(),d=draft())=>saveSharedTripState(s,d,{id:'VJ-TEST',now:'2026-10-31T12:00:00Z'});
test('merge has one physical trip, two case services; identities, cargo, POD and statuses stay independent',()=>{
  const original=state(),before=JSON.stringify(original),saved=save(original),grouped=groupSharedTrips(saved.calendarEvents);
  assert.equal(JSON.stringify(original),before);assert.equal(grouped.length,1);assert.deepEqual(tripCaseIds(grouped[0]),['A','B']);
  assert.deepEqual(saved.transports.map(t=>t.id),['TA','TB']);assert.deepEqual(saved.calendarEvents.map(t=>t.id),['EA','EB']);
  assert.equal(saved.transports[0].estado,'Entregado');assert.equal(saved.calendarEvents[1].estado,'Pendiente');
  assert.deepEqual(saved.transports[0].selectedCargo,[{id:'BOX-A'}]);
  assert.deepEqual(saved.cases.map(c=>c.documentacionMercancia),original.cases.map(c=>c.documentacionMercancia));
});
test('equal and manual cost allocation sum exactly once; repeated save replaces rather than duplicates',()=>{
  const first=save(),second=save(first,initialSharedTrip(first.calendarEvents[0],first.transports,first.cases));
  assert.deepEqual(second.cases.map(c=>c.gastos.filter(g=>g.source==='shared-trip').map(g=>g.importe)),[[50.01],[50]]);
  assert.equal(second.cases[0].gastos.find(g=>g.id==='old').importe,25);
  assert.deepEqual(allocateTripCost('100.01',[{costShare:30},{costShare:70.01}],'manual'),[30,70.01]);
  assert.throws(()=>allocateTripCost(100,[{costShare:30},{costShare:60}],'manual'),/sumar/);
  assert.equal(allocateTripCost('',[{},{}]),null);assert.throws(()=>allocateTripCost(-1,[{},{}]));assert.throws(()=>allocateTripCost('abc',[{},{}]));
});
test('new journey creates one stable billable service per case without touching existing records',()=>{
  const d=draft();d.stops=d.stops.map(s=>({...s,transportId:''}));d.cost='';const saved=save(state(),d);
  assert.equal(saved.transports.length,4);assert.equal(groupSharedTrips(saved.calendarEvents).length,3);
  const editable=initialSharedTrip(saved.calendarEvents.at(-1),saved.transports,saved.cases);
  assert.equal(save(saved,editable).transports.length,4);
});
test('reject duplicates, mismatched case, missing route, linked elsewhere and invalid allocation',()=>{
  const d=draft();assert.throws(()=>save(state(),{...d,stops:[d.stops[0],d.stops[0]]}),/una sola/);
  assert.throws(()=>save(state(),{...d,stops:[d.stops[0],{...d.stops[1],transportId:'TA'}]}),/pertenece/);
  assert.throws(()=>save(state(),{...d,stops:[d.stops[0],{...d.stops[1],destino:''}]}),/recogida/);
  const s=state();s.transports[0].sharedTripId='OTHER';assert.throws(()=>save(s),/otro viaje/);
});
test('assignment and rescheduling sync only shared physical fields, never delivery state or routes',()=>{
  const s=save(),next=syncSharedTripSchedule(s,{sharedTripId:'VJ-TEST',fecha:'2026-11-01',inicio:'14:00',fin:'15:00',asignado:'Other'});
  assert.deepEqual(next.transports.map(t=>[t.conductor,t.fecha]),[['Other','2026-11-01'],['Other','2026-11-01']]);
  assert.deepEqual(next.transports.map(t=>t.destino),['WASA','MONTE']);assert.equal(next.transports[0].estado,'Entregado');
  const cancelled=structuredClone(s);cancelled.transports[0].estado='Cancelado';cancelled.calendarEvents[0].estado='Cancelado';
  const changed=syncSharedTripSchedule(cancelled,{sharedTripId:'VJ-TEST',asignado:'Other'});assert.equal(changed.transports[0].conductor,'Driver');
});
test('search matches every vessel, not only first; grouped input is idempotent',()=>{
  const s=save(),events=groupSharedTrips(s.calendarEvents);
  assert.equal(groupSharedTrips(events)[0]._tripStops.length,2);
  assert.equal(filterCalendarEvents(events,{cases:s.cases,filters:{...emptyCalendarSearch(),query:'MONTE'},statusOf:()=> 'pending'}).length,1);
});
test('each case keeps independent transport price and cargo; issued invoices are untouched',()=>{
  const s=save();
  const invoice={lines:[{id:'transport',item:'TRANSPORT',units:1,price:150,detail:'Original cargo'}]};
  for(const [index,c] of s.cases.entries()){
    const services=s.transports.filter(t=>t.expediente===c.id).map(t=>({...t,transporte:t.id}));
    const result=separateTransportLines(invoice,services);
    assert.equal(result.lines[0].price,150);assert.equal(result.lines[0].units,1);
    assert.ok(result.lines[0].detail.includes(index===0?'A cargo':'B cargo'));
    const issued={...invoice,holdedId:'ISSUED',estado:'Enviado a Holded'};
    assert.deepEqual(separateTransportLines(issued,services),issued);
  }
});
