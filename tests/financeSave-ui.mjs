// Uses the production (non-demo) save path with a local, authoritative mock API.
// No production records or Holded requests are touched.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {expedientesIniciales} from '../src/data.js';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
let invoice={id:'BOR-2026-0044',expediente:'SW-2026-0044',cliente:'UME Shipping',buque:'OCEAN BREEZE',puerto:'Bilbao',concepto:'Concepto guardado previamente',estado:'Borrador',importe:70,financeRevision:1,lines:[{id:'custom',item:'Servicio previo',detail:'Mercancía de prueba',price:70,units:1,tax:'0%'}]};
const server=new Map([[invoice.id,invoice]]),errors=[],requests=[];
let fail=true,heldSave,releaseSave;
let operational={cases:[expedientesIniciales.find(row=>row.id==='SW-2026-0044')],transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.route('**/src/main.jsx*',async route=>{
  const response=await route.fetch();let body=await response.text();
  assert.match(body,/const LOCAL_DESIGN_MODE = [^;]+;/);
  body=body.replace(/const LOCAL_DESIGN_MODE = [^;]+;/,'const LOCAL_DESIGN_MODE = false;');
  await route.fulfill({response,body});
 });
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  let result={ok:true},status=200;
  if(path==='/api/auth/me.php')result={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Prueba local',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php'){
   if(request.method()==='GET')result={caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[...server.values()]};
   else {
    const body=request.postDataJSON();requests.push(body);
    if(body.invoices.some(row=>row.concepto==='Concepto editado manualmente')){
     heldSave=new Promise(resolve=>releaseSave=resolve);await heldSave;
     if(fail){status=500;result={error:'Fallo de servidor simulado'};}
    }
    if(status===200){
     const versions={};
     for(const row of body.invoices){
      const revision=server.get(row.id)?.financeRevision||0;
      assert.equal(row.financeRevision,revision);
      versions[row.id]=revision+1;server.set(row.id,{...row,financeRevision:revision+1});
     }
     result={ok:true,invoiceVersions:versions};
    }
   }
  }else if(path==='/api/operational.php'){
   if(request.method()==='GET')result={data:operational};
   else operational=request.postDataJSON().data;
  }else if(path==='/api/users/directory.php')result={users:[]};
  else if(path==='/api/clients/directory.php')result={clients:[]};
  else if(path.startsWith('/api/holded/'))throw Error('Unexpected Holded request');
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 const billing=async()=>{
  await page.getByRole('button',{name:'Facturación',exact:true}).click();
  const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click();
 };
 const open=()=>page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();
 const modal=page.locator('.invoice-detail-modal');
 await page.goto(base);await billing();await open();
 assert.equal(await modal.getByLabel('Concepto general',{exact:true}).inputValue(),'Concepto guardado previamente');
 await modal.getByLabel('Concepto general',{exact:true}).fill('Concepto editado manualmente');
 const row=modal.locator('.invoice-line-row').first();
 await row.getByLabel('Item',{exact:true}).fill('Recogida especial acordada');
 await row.getByLabel('Precio',{exact:true}).fill('123.45');
 await row.locator('textarea').fill('2 cajas - recogida especial');
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 await modal.getByRole('button',{name:'Guardando…',exact:true}).waitFor();
 await new Promise(resolve=>setTimeout(resolve,250));
 assert.equal(await modal.isVisible(),true);assert.notEqual(server.get(invoice.id).importe,123.45);
 assert.ok(releaseSave);releaseSave();
 await modal.getByRole('alert').filter({hasText:'Fallo de servidor simulado'}).waitFor();
 assert.equal(await row.getByLabel('Precio',{exact:true}).inputValue(),'123.45');
 fail=false;releaseSave=null;
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 while(!releaseSave)await new Promise(resolve=>setTimeout(resolve,20));releaseSave();
 await modal.waitFor({state:'hidden'});
 assert.equal(server.get(invoice.id).concepto,'Concepto editado manualmente');
 assert.equal(server.get(invoice.id).lines[0].price,123.45);
 await page.reload();await billing();await open();
 assert.equal(await modal.getByLabel('Concepto general',{exact:true}).inputValue(),'Concepto editado manualmente');
 assert.equal(await row.getByLabel('Item',{exact:true}).inputValue(),'Recogida especial acordada');
 assert.equal(await row.getByLabel('Precio',{exact:true}).inputValue(),'123.45');
 assert.equal(await row.locator('textarea').inputValue(),'2 cajas - recogida especial');
 assert.deepEqual(errors,[]);assert.ok(requests.length>=2);
 if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:false});
 console.log('OK: non-demo API, delayed acknowledgement, failed save retained, retry, manual concept/line/amount preserved after reload');
}finally{await browser.close()}
