import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5187/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
let state={cases:[1,2].map(n=>({id:`SW-2026-099${n}`,buque:`SUPPLY TEST ${n}`,cliente:'Test',puerto:'Barcelona',serviceType:'vessel_supply',estado:'En curso',supplyOrder:{mode:'warehouse',lines:[]},mercancias:[],operationalFlow:{review:true}})),transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]};
let failure=false,holdGet=false,holdPut=false,pendingGet,pendingPut;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-23T12:00:00')});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.route('**/src/main.jsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE\s*=\s*[^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async r=>{
  const req=r.request(),path=new URL(req.url()).pathname;let body={ok:true};
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php')body={caseAmounts:{},clients:[],invoices:[]};
  else if(path==='/api/users/directory.php')body={users:[]};
  else if(path==='/api/operational.php'){
   if(req.method()==='GET'){
    const snapshot=structuredClone(state);
    if(holdGet){holdGet=false;pendingGet=()=>r.fulfill({json:{data:snapshot}});return;}
    body={data:snapshot};
   }else{
    if(failure){await r.fulfill({status:500,json:{error:'Fallo de prueba al guardar'}});return;}
    const next=req.postDataJSON().data;
    if(holdPut){holdPut=false;pendingPut=async()=>{state=next;await r.fulfill({json:{ok:true}})};return;}
    state=next;
   }
  }
  await r.fulfill({json:body});
 });
 await page.goto(base);
 await page.getByRole('button',{name:'Expedientes',exact:true}).first().click();
 await page.locator('.case-card').filter({hasText:'SUPPLY TEST 1'}).click();
 await page.setViewportSize({width:390,height:844});
 const panel=page.locator('#supply-control-SW-2026-0991');
 await panel.getByRole('button',{name:'Añadir producto',exact:true}).click();
 const description=panel.getByLabel('Descripción *',{exact:true});
 const cost=panel.getByLabel('Coste unitario €',{exact:true});
 const price=panel.getByLabel('Venta unitaria €',{exact:true});
 await description.fill('Cemento 25 kg');await cost.fill('123.45');await price.fill('180.25');
 await panel.getByLabel('Solicitado',{exact:true}).fill('2');
 // Both the timer and focus refresh must preserve a new, unsaved product and focus.
 await cost.focus();
 await page.clock.fastForward(46000);await page.waitForTimeout(100);
 assert.equal(await description.inputValue(),'Cemento 25 kg');assert.equal(await cost.inputValue(),'123.45');assert.ok(await cost.evaluate(el=>el===document.activeElement));
 state.cases[0].supplyOrder.notes='Actualización del servidor';
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(100);
 assert.equal(await description.inputValue(),'Cemento 25 kg');assert.equal(await cost.inputValue(),'123.45');
 assert.ok(await page.locator('.case-layout.mobile-detail-open').isVisible());
 // Failed saves retain edits, never report success, and remain editable through another poll.
 failure=true;await panel.getByRole('button',{name:'Guardar pedido',exact:true}).click();
 await page.getByText(/No se pudo guardar el expediente: Fallo de prueba/).waitFor();
 assert.equal(await page.getByText('Pedido Supply, costes y venta guardados',{exact:true}).count(),0);
 await page.clock.fastForward(46000);await page.waitForTimeout(100);assert.equal(await cost.inputValue(),'123.45');
 // A response captured before saving must not overwrite the confirmed save afterwards.
 failure=false;holdGet=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(100);assert.ok(pendingGet);
 await panel.getByRole('button',{name:'Guardar pedido',exact:true}).click();
 await page.getByText('Pedido Supply, costes y venta guardados',{exact:true}).waitFor();
 await pendingGet();await page.waitForTimeout(100);
 assert.equal(await cost.inputValue(),'123.45');
 const saved=state.cases.find(x=>x.id==='SW-2026-0991');
 assert.equal(saved.supplyOrder.lines[0].unitCost,123.45);assert.equal(saved.supplyOrder.lines[0].unitPrice,180.25);
 assert.equal(saved.gastos.find(x=>x.source==='supply-order').importe,246.9);
 assert.equal(saved.billingAdjustments[0].price,180.25);
 // Edits made during a slow save are not replaced by its older submitted values.
 await cost.fill('140');holdPut=true;await panel.getByRole('button',{name:'Guardar pedido',exact:true}).click();
 await panel.getByRole('button',{name:'Guardando…',exact:true}).waitFor();assert.ok(pendingPut);
 await cost.fill('150');await pendingPut();await panel.getByRole('button',{name:'Guardar pedido',exact:true}).waitFor();
 await page.clock.fastForward(46000);await page.waitForTimeout(100);assert.equal(await cost.inputValue(),'150');
 await panel.getByRole('button',{name:'Guardar pedido',exact:true}).click();
 await page.getByText('Pedido Supply, costes y venta guardados',{exact:true}).waitFor();
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.case-card').filter({hasText:'SUPPLY TEST 2'}).click();
 assert.equal(await page.locator('#supply-control-SW-2026-0992 .supply-lines article').count(),0);
 await page.locator('.case-card').filter({hasText:'SUPPLY TEST 1'}).click();assert.equal(await cost.inputValue(),'150');
 await page.reload();await page.getByRole('button',{name:'Expedientes',exact:true}).first().click();
 await page.locator('.case-card').filter({hasText:'SUPPLY TEST 1'}).click();assert.equal(await cost.inputValue(),'150');
 assert.deepEqual(errors,[]);
 console.log('Supply draft passed: mobile timer/focus refresh, remote refresh while editing, failed save/retry, stale GET, edits during save, case isolation and reload persistence.');
}finally{await browser.close()}
