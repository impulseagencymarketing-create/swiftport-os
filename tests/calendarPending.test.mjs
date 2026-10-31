import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarScheduleIncomplete,partitionCalendarSchedule,calendarPendingLabel,manualCalendarSchedule,validCalendarDate} from '../src/calendarPending.mjs';
test('persistent queue includes all incomplete pending services, independent of period, and preserves original dates',()=>{
 const events=[
  {id:'no-date',fecha:'',inicio:''},
  {id:'past',fecha:'2026-09-01',inicio:''},
  {id:'future',fecha:'2027-02-01',inicio:'',buque:'SAME VESSEL'},
  {id:'time-only',fecha:'',inicio:'12:00',buque:'SAME VESSEL'},
  {id:'provisional',fecha:'2026-10-31',inicio:'09:00',scheduleStatus:'provisional'},
  {id:'scheduled',fecha:'2026-10-31',inicio:'00:00'},
  {id:'done',fecha:'2026-09-01',inicio:'',status:'done'},
  {id:'cancelled',fecha:'2026-09-01',inicio:'',status:'cancelled'},
 ];
 const original=structuredClone(events);
 const {pending,dated}=partitionCalendarSchedule(events,e=>e.status||'pending');
 assert.deepEqual(pending.map(e=>e.id),['no-date','past','future','time-only','provisional']);
 assert.deepEqual(dated.map(e=>e.id),['scheduled','done','cancelled']);
 assert.deepEqual(events,original);
});
test('manual confirmation moves out of queue; clearing date/time restores it without fabricating dates',()=>{
 const initial={id:'x',fecha:'',inicio:'',fin:'',transporte:'TR-1',selectedCargoIds:['ALM-1'],asignado:'Driver'};
 const confirmed=manualCalendarSchedule({...initial,fecha:'2026-10-31',inicio:'14:00'});
 assert.equal(confirmed.scheduleStatus,'confirmed');
 assert.equal(calendarScheduleIncomplete(confirmed),false);
 const clear=manualCalendarSchedule({...confirmed,fecha:'',inicio:'',fin:''});
 assert.equal(clear.scheduleStatus,'missing_date');assert.equal(clear.fecha,'');
 assert.equal(calendarScheduleIncomplete(clear),true);assert.deepEqual(clear.selectedCargoIds,['ALM-1']);
 assert.equal(manualCalendarSchedule({...initial,fecha:'2026-10-31'}).scheduleStatus,'missing_time');
});
test('invalid dates and times do not disappear into the dated grid',()=>{
 for(const fecha of ['Por confirmar','2026-02-30','2026-13-01','2026-1-01'])assert.equal(validCalendarDate(fecha),false);
 for(const inicio of ['25:00','08:70','9:00',''])assert.equal(calendarScheduleIncomplete({fecha:'2026-10-31',inicio}),true);
 assert.equal(calendarPendingLabel({fecha:'',inicio:''}),'FECHA Y HORA POR CONFIRMAR');
 assert.equal(calendarPendingLabel({fecha:'',inicio:'10:00'}),'FECHA POR CONFIRMAR');
 assert.equal(calendarPendingLabel({fecha:'2026-10-31',inicio:''}),'HORA POR CONFIRMAR');
});
