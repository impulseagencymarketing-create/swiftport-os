import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {billingToday} from '../src/invoiceDates.mjs';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
const caseRef='SW-2026-0211',invoiceId='BOR-2026-0211';
const vessel={id:caseRef,buque:'RDO CONCORD',cliente:'Limani',puerto:'Valencia',purchaseOrder:'POA634715',estado:'Completado',progreso:100,bultos:1,peso:'3 kg',servicios:['Transporte'],eta:'2026-10-03'};
let operational={cases:[vessel],transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]};
let saved={id:invoiceId,expediente:caseRef,cliente:'Limani',buque:'RDO CONCORD',puerto:'Valencia',concepto:'RDO CONCORD POA634715',estado:'Borrador',vencimiento:'2020-01-01',importe:98.5,financeRevision:1,lines:[{id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:'1 BOX 3 KGS',price:98.5,units:1,tax:'0%'}]};
let holdedPayload;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.route('**/src/main.jsx*',async route=>{const response=await route.fetch();const body=(await response.text()).replace(/const LOCAL_DESIGN_MODE = [^;]+;/,'const LOCAL_DESIGN_MODE = false;');await route.fulfill({response,body})});
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let body={ok:true},status=200;
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Local test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php'){
   if(request.method()==='GET')body={caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[saved]};
   else {const invoice=request.postDataJSON().invoices.find(row=>row.id===invoiceId);if(invoice){assert.equal(invoice.financeRevision,saved.financeRevision);saved={...invoice,financeRevision:saved.financeRevision+1}}body={ok:true,invoiceVersions:{[invoiceId]:saved.financeRevision}};}
  }else if(path==='/api/operational.php'){
   if(request.method()==='GET')body={data:operational};else operational=request.postDataJSON().data;
  }else if(path==='/api/users/directory.php')body={users:[]};
  else if(path==='/api/clients/directory.php')body={clients:[]};
  else if(path==='/api/holded/create.php'){holdedPayload=request.postDataJSON();body={error:'Prueba local: no se envía ninguna factura real.'};status=422}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const billing=async()=>{await page.getByRole('button',{name:'Facturación',exact:true}).click();const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click()};
 const open=()=>page.getByRole('button',{name:'Editar '+invoiceId,exact:true}).click();
 const modal=page.locator('.invoice-detail-modal'),rows=modal.locator('.invoice-line-row');
 await page.goto(base);await billing();await open();
 assert.equal(await modal.getByLabel('Vencimiento',{exact:true}).inputValue(),billingToday());
 await rows.first().locator('textarea').fill('7 BOXES 875 KGS - PESO CORREGIDO');
 await rows.first().getByLabel('Precio',{exact:true}).fill('187.35');
 await rows.first().getByLabel('Uds.',{exact:true}).fill('2');
 for(const [name,price,units] of [['STORAGE ESPECIAL','25','3'],['RECOGIDA EXTRA PACTADA','35.5','1']]){
  await modal.getByRole('button',{name:'Linea manual',exact:true}).click();
  await rows.last().getByLabel('Item',{exact:true}).fill(name);
  await rows.last().locator('textarea').fill('7 BOXES 875 KGS');
  await rows.last().getByLabel('Precio',{exact:true}).fill(price);
  await rows.last().getByLabel('Uds.',{exact:true}).fill(units);
 }
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();await modal.waitFor({state:'hidden'});
 assert.equal(saved.manualEdited,true);assert.equal(saved.lines.length,3);assert.equal(saved.importe,485.2);
 assert.equal(saved.vencimiento,billingToday());
 const expected=structuredClone(saved.lines);
 // Operational data change between sessions must not regenerate the billing draft.
 operational.cases[0]={...operational.cases[0],peso:'2 kg',bultos:1};
 operational.transports=[{id:'TR-NEW',expediente:caseRef,fecha:'2026-10-03',inicio:'22:00',fin:'23:00',origen:'ALMACÉN VALENCIA',destino:'RDO CONCORD',estado:'Entregado'}];
 await page.reload();await billing();await open();
 assert.equal(await rows.count(),3);
 assert.equal(await rows.first().locator('textarea').inputValue(),'7 BOXES 875 KGS - PESO CORREGIDO');
 assert.equal(await rows.first().getByLabel('Precio',{exact:true}).inputValue(),'187.35');
 assert.equal(await rows.first().getByLabel('Uds.',{exact:true}).inputValue(),'2');
 assert.equal(await rows.nth(1).getByLabel('Item',{exact:true}).inputValue(),'STORAGE ESPECIAL');
 assert.equal(await rows.nth(1).getByLabel('Precio',{exact:true}).inputValue(),'25');
 await modal.getByRole('checkbox').check();
 await modal.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();
 await page.getByText('Prueba local: no se envía ninguna factura real.',{exact:true}).waitFor();
 assert.deepEqual(holdedPayload.invoice.lines,expected);
 assert.deepEqual(saved.lines,expected);
 assert.equal(holdedPayload.invoice.importe,485.2);
 assert.equal(holdedPayload.invoice.manualPricingConfirmed,true);
 assert.equal(holdedPayload.invoice.vencimiento,billingToday());
 assert.deepEqual(errors,[]);
 console.log('OK: RDO CONCORD fixture, corrected kg, added rows, special prices, units, reload after operational change, exact mocked Holded payload');
}finally{await browser.close()}
