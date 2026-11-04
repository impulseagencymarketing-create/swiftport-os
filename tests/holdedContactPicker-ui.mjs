import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const vessel={id:'SW-2026-0999',buque:'TEST VESSEL',cliente:'Agency',puerto:'Barcelona',estado:'Completado',progreso:100,eta:'2026-11-04',bultos:1,peso:'3 kg'};
const owner={id:'owner-existing',name:'Example Vessel Owner Ltd',tradeName:'TEST VESSEL',taxId:'TEST123'};
let saved={id:'BOR-TEST',expediente:vessel.id,cliente:'Agency',buque:vessel.buque,concepto:'TEST VESSEL',estado:'Borrador',importe:438.3,financeRevision:1,manualEdited:true,manualPricingConfirmed:true,lines:[{id:'custom',item:'SUPPLY CUSTOM',detail:'Manual goods',price:438.3,units:1,tax:'0%'}]};
let holdedPayload,contactFailure=true;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.route('**/src/main.jsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE\s*=\s*[^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async r=>{
  const req=r.request(),path=new URL(req.url()).pathname;let body={ok:true},status=200;
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php'){
   if(req.method()==='GET')body={caseAmounts:{},clients:[],invoices:[saved]};
   else {const row=req.postDataJSON().invoices.find(i=>i.id===saved.id);if(row)saved={...row,financeRevision:saved.financeRevision+1};body={ok:true,invoiceVersions:{[saved.id]:saved.financeRevision}};}
  }else if(path==='/api/operational.php')body={data:{cases:[vessel],transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]}};
  else if(path==='/api/users/directory.php')body={users:[]};
  else if(path==='/api/holded/contacts.php'){
   if(contactFailure){status=502;body={error:'Test connection failure'};contactFailure=false}
   else body={contacts:[owner,{id:'other',name:'Other company',taxId:'OTHER'}]};
  }else if(path==='/api/holded/create.php'){holdedPayload=req.postDataJSON();status=422;body={error:'Test: no real export',code:'holded_contact_required'};}
  await r.fulfill({status,json:body});
 });
 const billing=()=>page.getByRole('button',{name:'Facturación',exact:true}).first().click();
 const open=()=>page.getByRole('button',{name:'Editar BOR-TEST',exact:true}).click();
 await page.addLocatorHandler(page.getByRole('button',{name:'Entendido',exact:true}),button=>button.click());
 await page.goto(base);await billing();await open();
 const modal=page.locator('.invoice-detail-modal'),picker=modal.getByRole('region',{name:'Destinatario de Holded'});
 await picker.getByRole('button',{name:'Buscar contacto en Holded'}).click();
 await picker.getByText(/Test connection failure/).waitFor();
 await picker.getByRole('button',{name:'Buscar contacto en Holded'}).click();
 await picker.getByLabel('Buscar contacto por razón social, buque o NIF').fill('test vessel');
 await picker.getByLabel('Destinatario de la proforma').selectOption(owner.id);
 assert.ok(await picker.getByText(owner.name,{exact:true}).isVisible());
 const review=modal.getByLabel('He revisado mercancía, kilos, servicios y precios.');if(await review.count())await review.check();
 await modal.getByLabel(/He revisado los importes finales/).check();
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();await modal.waitFor({state:'hidden'});
 assert.equal(saved.holdedContactSelection.id,owner.id);assert.equal(saved.holdedContactSelection.forClient,'Agency');
 assert.equal(saved.holdedContactSelection.invoiceId,'BOR-TEST');assert.equal(saved.lines[0].price,438.3);
 const expected=structuredClone(saved.lines);
 await page.reload();await billing();await open();
 assert.ok(await picker.getByText(owner.name,{exact:true}).isVisible());
 await modal.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();
 await page.getByText('Test: no real export',{exact:true}).waitFor();
 assert.equal(holdedPayload.invoice.holdedContactSelection.id,owner.id);assert.deepEqual(holdedPayload.invoice.lines,expected);
 // Changing the operational customer must not silently reuse the old fiscal choice.
 await modal.locator('input[name="cliente"]').fill('Different client');
 await picker.getByText('El cliente ha cambiado. Vuelve a elegir el destinatario antes de enviar.').waitFor();
 await picker.getByRole('button',{name:'Quitar selección y usar identificación automática'}).click();
 assert.equal(await picker.getByText(owner.name,{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});
 const box=await picker.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
 await picker.scrollIntoViewIfNeeded();await page.screenshot({path:'../outputs/holded-contact-picker-mobile.png'});
 assert.deepEqual(errors,[]);console.log('OK: lookup retry, search by vessel, explicit selection, save/reload, exact mock export, client-change warning, clear and mobile.');
}finally{await browser.close()}
