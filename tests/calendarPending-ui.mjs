// Mock operational API; never reads or modifies live operational records.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base='http://127.0.0.1:5187/';
const cases=Array.from({length:7},(_,i)=>({id:`SW-2026-00${i+10}`,buque:['NO DATE','OLD PENDING','FUTURE PENDING','CONFIRMED','FINISHED','CANCELLED','TIME ONLY'][i],cliente:'WRIST',puerto:'Barcelona',eta:'Por confirmar',estado:i===4?'Completado':i===5?'Cancelado':'En curso',progreso:i===4?100:20,servicios:['Transporte'],autoTransportDisabled:false}));
const calendarEvents=cases.map((c,i)=>({id:`EV-${i}`,expediente:c.id,transporte:`TR-${i}`,titulo:c.buque,tipoServicio:'Transporte',fecha:['','2026-09-01','2027-02-01','2026-10-31','2026-10-30','2026-10-31',''][i],inicio:i===3?'10:00':i===6?'12:00':'',fin:i===3?'11:00':'',scheduleSource:'manual',scheduleStatus:i===3?'confirmed':'missing_time',asignado:'Test Driver',origen:'ALMACEN',destino:`BUQUE ${c.buque}`,estado:i===4?'Entregado':i===5?'Cancelado':'Pendiente'}));
let data={cases,calendarEvents,transports:calendarEvents.map(e=>({...e,id:e.transporte,conductor:e.asignado,ruta:`${e.origen} → ${e.destino}`})),warehouseEntries:[],customs:[],providers:[],vessels:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.clock.install({time:new Date('2026-10-31T12:00:00+01:00')});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.route('**/src/main.jsx*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE = [^;]+;/,'const LOCAL_DESIGN_MODE = false;')});});
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={ok:true};
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Test Driver',roles:['admin','operations']}};
  else if(path==='/api/operational.php'){if(req.method()==='PUT')data=req.postDataJSON().data;body={data};}
  else if(path==='/api/users/directory.php')body={users:[{id:'test',fullName:'Test Driver',roles:['operations','driver']}]};
  else if(path==='/api/finance.php')body={caseAmounts:{},clients:[],invoices:[]};
  else if(path==='/api/clients/directory.php')body={clients:[]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const openCalendar=async()=>{await page.getByRole('button',{name:'Calendario',exact:true}).click();const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click();};
 await page.goto(base);await openCalendar();
 const strip=page.getByRole('region',{name:'Pendientes de fecha y horario'});
 await strip.waitFor();assert.equal(await strip.locator('[data-pending-event]').count(),4);
 assert.match(await strip.innerText(),/OLD PENDING/);assert.match(await strip.innerText(),/FUTURE PENDING/);
 assert.doesNotMatch(await strip.innerText(),/FINISHED|CANCELLED|CONFIRMED/);
 const original=data.calendarEvents.find(e=>e.id==='EV-1').fecha;
 for(const name of ['Periodo siguiente','Periodo siguiente','Periodo anterior']){await page.getByRole('button',{name,exact:true}).click();assert.equal(await strip.locator('[data-pending-event]').count(),4);}
 for(const mode of ['Mes','Día','Semana']){await page.getByRole('button',{name:mode,exact:true}).click();assert.equal(await strip.locator('[data-pending-event]').count(),4);}
 assert.equal(data.calendarEvents.find(e=>e.id==='EV-1').fecha,original);
 await page.getByRole('button',{name:'Hoy',exact:true}).click();
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 await page.screenshot({path:'../outputs/calendar-pending-dark.png'});
 assert.ok(await strip.evaluate(el=>el.getBoundingClientRect().height<420));
 await strip.locator('[data-pending-event="EV-0"]').getByRole('button',{name:'Asignar fecha y hora'}).click();
 const modal=page.locator('.calendar-event-modal');
 await modal.locator('[name="fecha"]').fill('2026-10-31');await modal.locator('[name="inicio"]').fill('14:00');await modal.locator('[name="fin"]').fill('15:00');
 await modal.getByRole('button',{name:'Guardar transporte',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-pending-event]').length===3);
 assert.equal(data.calendarEvents.find(e=>e.id==='EV-0').scheduleStatus,'confirmed');
 assert.equal(data.transports.find(e=>e.id==='TR-0').inicio,'14:00');
 await page.reload();await openCalendar();assert.equal(await strip.locator('[data-pending-event]').count(),3);
 const timed=page.locator('.calendar-event').filter({hasText:'NO DATE'});await timed.waitFor();
 await timed.getByRole('button',{name:'Editar servicio',exact:true}).click();
 await modal.getByRole('button',{name:'Quitar fecha y hora',exact:true}).click();
 await modal.getByRole('button',{name:'Guardar transporte',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-pending-event]').length===4);
 await page.reload();await openCalendar();assert.equal(data.calendarEvents.find(e=>e.id==='EV-0').fecha,'');
 assert.equal(data.calendarEvents.filter(e=>e.id==='EV-0').length,1);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await strip.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:'../outputs/calendar-pending-mobile.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('OK: persistent pending strip across weeks/day/month, completed/cancelled excluded, independent dates, confirm/clear/reload persistence, no duplicate transports, dark/mobile layout');
}finally{await browser.close();}
