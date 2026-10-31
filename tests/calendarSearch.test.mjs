import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCalendarSearch,filterCalendarEvents,calendarAssigneeOptions,sortCalendarResults} from '../src/calendarSearch.mjs';
const cases=[{id:'SW-1',buque:'WASA EXPRESS',puerto:'Barcelona',conductor:'Wrong current driver',purchaseOrder:'PO123'}];
const providers=[{id:'PRV-1',nombre:'External Company',activo:false}];
const events=[{id:'A',expediente:'SW-1',asignado:'Moisés Rodríguez',fecha:'2026-01-04',origen:'Almacén',destino:'Buque',status:'done'},{id:'B',expediente:'SW-1',asignado:'Javier Fernández',fecha:'2026-10-31',status:'pending'},{id:'C',expediente:'SW-1',asignado:'Externo · Old Name',proveedorId:'PRV-1',fecha:'2026-09-15',status:'done'},{id:'D',asignado:'Sin asignar',fecha:'',status:'pending'},{id:'E',asignado:'Moisés Rodríguez',status:'cancelled'}];
const search=filters=>filterCalendarEvents(events,{filters:{...emptyCalendarSearch(),...filters},cases,providers,statusOf:e=>e.status});
test('text searches vessel, case, PO, route, port, person and external company across all dates',()=>{
  assert.equal(search({query:'wasa barcelona almacen'}).length,1);
  assert.equal(search({query:'moises rodriguez'}).length,2);
  assert.equal(search({query:'SW-1 PO123'}).length,3);
  assert.equal(search({query:'external company'})[0].id,'C');
  assert.equal(search({query:'wrong current driver'}).length,0);
});
test('combined person and completed filter uses service owner, not current case owner; unassigned and cancellation remain separate',()=>{
  assert.deepEqual(search({assignee:'person:moises rodriguez',status:'done'}).map(e=>e.id),['A']);
  assert.deepEqual(search({assignee:'provider:PRV-1',status:'done'}).map(e=>e.id),['C']);
  assert.deepEqual(search({assignee:'unassigned'}).map(e=>e.id),['D']);
  assert.deepEqual(search({status:'cancelled'}).map(e=>e.id),['E']);
  assert.equal(search({}).length,5);
});
test('assignee choices retain past people and inactive providers; sorting does not mutate or drop unscheduled jobs',()=>{
  const options=calendarAssigneeOptions(events,[{fullName:'Moisés Rodríguez'}],providers);
  assert.equal(options.filter(o=>o.value==='person:moises rodriguez').length,1);
  assert.ok(options.some(o=>o.value==='person:javier fernandez'));
  assert.match(options.find(o=>o.value==='provider:PRV-1').label,/inactivo/);
  assert.equal(options.filter(o=>o.value.startsWith('person:externo')).length,0);
  assert.equal(sortCalendarResults(events)[0].id,'B');assert.equal(events[0].id,'A');
  assert.equal(sortCalendarResults(events).length,5);
});
