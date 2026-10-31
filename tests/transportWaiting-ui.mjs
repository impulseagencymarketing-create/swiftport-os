// Local mock APIs only: never alters production or sends to Holded.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base='http://127.0.0.1:5187/';
const c={id:'SW-2026-0001',buque:'WAITING TEST',cliente:'Cliente prueba',puerto:'Barcelona',estado:'Completado',progreso:100,operationalFlow:{review:true,cargo:true,documents:true,assignment:true,delivery:true,billingReady:true},servicios:['Transporte']};
const t={id:'TR-1',expediente:c.id,conductor:'Test Driver',fecha:'2026-10-31',inicio:'10:00',fin:'12:00',scheduleSource:'manual',scheduleStatus:'confirmed',origen:'Warehouse',destino:c.buque,ruta:'Warehouse → '+c.buque,estado:'Asignado'};
let data={cases:[c],transports:[t],calendarEvents:[{...t,id:'EV-1',transporte:t.id,asignado:t.conductor,tipoServicio:'Transporte',titulo:t.ruta}],warehouseEntries:[],customs:[],providers:[],vessels:[]};
const original={id:'custom',item:'TRANSPORT AGREED',detail:'3 boxes 125 KG',price:127.75,units:1,tax:'0%'};
let invoice={id:'BOR-2026-0001',expediente:c.id,cliente:c.cliente,buque:c.buque,puerto:c.puerto,concepto:'Manual agreed service',estado:'Borrador',manualEdited:true,manualPricingConfirmed:true,lines:[original],importe:127.75,financeRevision:1};
let failNext=false,holdedCalls=0;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-31T12:00:00+01:00')});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.route('**/src/main.jsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE\s*=\s*[^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async r=>{const req=r.request(),path=new URL(req.url()).pathname;let body={ok:true};
   if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Test Driver',roles:['admin','operations','finance']}};
   else if(path==='/api/operational.php'){
     if(req.method()==='PUT'){if(failNext){failNext=false;await r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Error simulado'})});return}data=req.postDataJSON().data;}body={ok:true,data};
   }else if(path==='/api/users/directory.php')body={users:[{id:'test',fullName:'Test Driver',roles:['driver']}]};
   else if(path==='/api/finance.php'){
     if(req.method()==='PUT'){const saved=req.postDataJSON().invoices?.find(i=>i.id===invoice.id);if(saved)invoice={...saved,financeRevision:invoice.financeRevision+1};body={ok:true,invoiceVersions:{[invoice.id]:invoice.financeRevision}};}
     else body={caseAmounts:{},clients:[],invoices:[invoice]};
   }else if(path==='/api/clients/directory.php')body={clients:[]};
   else if(path==='/api/holded/create.php'){holdedCalls++;body={error:'Not permitted in test'};}
   await r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const dismiss=async()=>{const b=page.getByRole('button',{name:'Entendido',exact:true});if(await b.count())await b.click()};
 const calendar=async()=>{await page.getByRole('button',{name:'Calendario',exact:true}).click();await dismiss();await page.getByPlaceholder('Buque, expediente, ruta, puerto o persona…').fill(c.buque);await page.getByRole('button',{name:'Ver servicio',exact:true}).click()};
 await page.goto(base);await calendar();
 const modal=page.locator('.calendar-event-modal');
 await modal.getByLabel(/^Horas de espera/).fill('1.5');
 await modal.getByLabel('Motivo / lugar de la espera').fill('Waiting for berth authorization');
 failNext=true;await modal.getByRole('button',{name:'Guardar transporte',exact:true}).click();
 await modal.getByRole('alert').waitFor();assert.match(await modal.getByRole('alert').innerText(),/Error simulado/);
 assert.equal(data.transports[0].waiting,undefined);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await modal.locator('.transport-waiting').screenshot({path:'../outputs/transport-waiting-fields.png'});
 await modal.getByRole('button',{name:'Guardar transporte',exact:true}).click();await modal.waitFor({state:'detached'});
 assert.equal(data.transports[0].waiting.hours,1.5);assert.equal(data.calendarEvents[0].waiting.hours,1.5);
 await page.reload();await calendar();assert.equal(await modal.getByLabel(/^Horas de espera/).inputValue(),'1.5');await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Facturación',exact:true}).click();await dismiss();
 try{await page.getByRole('button',{name:'Revisar horas de espera',exact:true}).click({timeout:8000})}catch(e){console.log('BILLING DEBUG',errors,JSON.stringify(invoice),JSON.stringify(data.transports),await page.locator('body').innerText());throw e}
 const bill=page.locator('.invoice-detail-modal');
 await bill.getByRole('button',{name:'Incorporar / actualizar esta espera',exact:true}).click();
 assert.equal(await bill.locator('.invoice-line-row').count(),2);
 assert.equal(await bill.locator('.invoice-line-row').first().getByLabel('Precio',{exact:true}).inputValue(),'127.75');
 assert.equal(await bill.locator('.invoice-line-row').last().getByLabel('Uds.',{exact:true}).inputValue(),'1.5');
 await bill.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();assert.equal(holdedCalls,0);
 await bill.locator('.invoice-line-row').last().getByLabel('Precio',{exact:true}).fill('40');
 await bill.getByRole('button',{name:'Guardar borrador',exact:true}).click();await bill.waitFor({state:'detached'});
 assert.equal(invoice.lines.length,2);assert.equal(invoice.importe,187.75);
 assert.equal(invoice.lines[0].price,original.price);assert.equal(invoice.lines[0].detail,original.detail);
 assert.equal(invoice.lines[1].waitingRatePending,false);
 await page.reload();await page.getByRole('button',{name:'Facturación',exact:true}).click();await dismiss();
 await page.getByRole('button',{name:'Editar '+invoice.id,exact:true}).click();
 assert.equal(await bill.locator('.invoice-line-row').count(),2);
 assert.equal(await bill.getByRole('button',{name:'Incorporar / actualizar esta espera',exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});assert.ok(await bill.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.equal(holdedCalls,0);assert.deepEqual(errors,[]);
 console.log('OK: waiting save failure/retry, reload, invoice warning, independent charge, manual amount retained, rate gate, save/reload no duplicate, mobile.');
}finally{await browser.close()}
