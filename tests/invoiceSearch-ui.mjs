import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[{id:'SW-2026-0236',buque:'GUBAL TRADER',cliente:'UME Shipping',puerto:'Barcelona',estado:'Completado',progreso:100},{id:'SW-2026-0245',buque:'PIS KALIMANTAN',cliente:'WRIST',puerto:'Barcelona',estado:'Completado',progreso:100}];
let invoices=cases.map((c,i)=>({...c,id:`BOR-${i}`,expediente:c.id,concepto:c.buque,estado:i?'Archivado':'Revisar',importe:438.3,financeRevision:1,manualEdited:true,lines:[{id:'supply',item:'SUPPLY',detail:'Moledor de carne',price:438.3,units:1,tax:'0%'}]}));
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.route('**/src/main.jsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE\s*=\s*[^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async r=>{
  const req=r.request(),path=new URL(req.url()).pathname;let body={ok:true};
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Local test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php'){
   if(req.method()==='GET')body={caseAmounts:{},clients:[],invoices};
   else {const payload=req.postDataJSON();const invoiceVersions={};for(const row of payload.invoices){invoiceVersions[row.id]=(row.financeRevision||0)+1;invoices=invoices.map(old=>old.id===row.id?{...row,financeRevision:invoiceVersions[row.id]}:old)}body={ok:true,invoiceVersions};}
  }else if(path==='/api/operational.php')body={data:{cases,transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]}};
  else if(path==='/api/users/directory.php')body={users:[]};
  await r.fulfill({json:body});
 });
 await page.goto(base);await page.getByRole('button',{name:'Facturación',exact:true}).first().click();
 await page.addLocatorHandler(page.getByRole('button',{name:'Entendido',exact:true}),async button=>button.click());
 const search=page.getByLabel('Buscar en facturación');await search.fill('gubal UME');
 assert.equal(await page.getByRole('button',{name:'Editar BOR-0',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Editar BOR-1',exact:true}).count(),0);
 await search.fill('Kalimantan');await page.getByRole('button',{name:'Ver coincidencias en todos los estados'}).click();
 assert.equal(await page.getByRole('button',{name:'Editar BOR-1',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Editar BOR-0',exact:true}).count(),0);
 await search.fill('NO-MATCH');assert.ok(await page.getByText('No hay documentos que coincidan con la búsqueda en este estado.').isVisible());
 await page.getByRole('button',{name:'Limpiar búsqueda'}).click();assert.equal(await search.inputValue(),'');
 await page.setViewportSize({width:390,height:844});await search.fill('gubal');
 const box=await search.boundingBox();assert.ok(box.width>200&&box.x>=0&&box.x+box.width<=390);
 await page.screenshot({path:'../outputs/billing-search-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Billing search UI passed: state filters, archive discovery, clear, empty result and mobile layout.');
}finally{await browser.close()}
