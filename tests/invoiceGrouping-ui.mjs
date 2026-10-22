import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[1,2,3].map(n=>({id:`SW-2026-000${n}`,buque:`WRIST VESSEL ${n}`,cliente:n===3?'Limani':'WRIST',puerto:'Barcelona',eta:'2026-10-20',estado:'Completado',progreso:100,bultos:2,peso:'75 kg',servicios:['Transporte']}));
let invoices=cases.map((row,index)=>({id:`BOR-${index+1}`,expediente:row.id,cliente:row.cliente,buque:row.buque,puerto:row.puerto,concepto:`${row.id} ${row.buque}`,estado:'Borrador',vencimiento:'2026-12-01',importe:100+index*50,financeRevision:1,manualEdited:true,manualEditedAt:'2026-10-20T10:00:00Z',lines:[{id:'transport',item:'TRANSPORT',detail:`${index+1} BOXES 75 KGS · 20/10/2026 · 08:00–09:00 · WAREHOUSE → VESSEL`,price:100+index*50,units:1,tax:index===0?'21%':'0%'}]}));
let failGroup=true,exported=null,exportCount=0;const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.route('**/src/main.jsx*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE = [^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={ok:true},status=200;
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Local test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php'){
   if(req.method()==='GET')body={caseAmounts:{},clients:[],invoices};
   else {
    const payload=req.postDataJSON(),isGroup=payload.invoices.some(row=>row.sourceInvoiceIds&&!invoices.some(old=>old.id===row.id));
    if(isGroup&&failGroup){failGroup=false;body={error:'Fallo de prueba: nada guardado'};status=503}
    else {
     // Run the real server validator over the actual UI request, with no production DB.
     if(process.env.TEST_PHP)execFileSync(process.env.TEST_PHP,['-n','-r',`require 'server/api/_invoice_grouping.php'; $p=json_decode(stream_get_contents(STDIN),true); validate_invoice_group_batch($p['incoming'],$p['stored']);`],{input:JSON.stringify({incoming:payload.invoices,stored:invoices})});
     const versions={};for(const row of payload.invoices){const old=invoices.find(item=>item.id===row.id);assert.equal(row.financeRevision,old?.financeRevision||0);versions[row.id]=(old?.financeRevision||0)+1;invoices=[...invoices.filter(item=>item.id!==row.id),{...row,financeRevision:versions[row.id]}]}
     body={ok:true,invoiceVersions:versions};
    }
   }
  }else if(path==='/api/operational.php')body={data:{cases,transports:[],warehouseEntries:[],calendarEvents:[],customs:[],providers:[],vessels:[]}};
  else if(path==='/api/users/directory.php')body={users:[]};
  else if(path==='/api/clients/directory.php')body={clients:[]};
  else if(path==='/api/holded/create.php'){exported=req.postDataJSON().invoice;exportCount++;body={ok:true,holdedId:'TEST-GROUP',holdedNumber:'TEST-001',holdedAmount:exported.importe,docType:'proform'}};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const billing=async()=>{await page.getByRole('button',{name:'Facturación',exact:true}).click();const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click()};
 await page.goto(base);await billing();await page.getByRole('button',{name:'Unificar expedientes WRIST',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Unificar expedientes WRIST'});
 assert.equal(await dialog.getByRole('checkbox').count(),2);
 await dialog.getByLabel('Seleccionar SW-2026-0001').check();await dialog.getByLabel('Seleccionar SW-2026-0002').check();
 await page.screenshot({path:'../outputs/wrist-group-desktop.png'});
 await page.setViewportSize({width:560,height:900});
 assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:'../outputs/wrist-group-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark'});
 await page.screenshot({path:'../outputs/wrist-group-dark.png'});
 await dialog.getByRole('button',{name:'Crear factura conjunta',exact:true}).click();
 await dialog.getByRole('alert').filter({hasText:'Fallo de prueba'}).waitFor();assert.equal(invoices.length,3);assert.equal(invoices.some(row=>row.groupedInto),false);
 await dialog.getByRole('button',{name:'Crear factura conjunta',exact:true}).click();
 const editor=page.locator('.invoice-detail-modal');await editor.waitFor();
 let group=invoices.find(row=>row.sourceInvoiceIds);assert.ok(group);assert.equal(group.importe,250);assert.equal(group.lines.length,4);
 assert.equal(invoices.filter(row=>row.groupedInto===group.id).length,2);
 await editor.locator('.invoice-line-row').nth(1).getByLabel('Precio',{exact:true}).fill('177.35');
 await editor.getByRole('checkbox').check();
 await editor.getByRole('button',{name:'Guardar borrador',exact:true}).click();await editor.waitFor({state:'hidden'});
 group=invoices.find(row=>row.sourceInvoiceIds);const savedLines=structuredClone(group.lines);assert.equal(group.importe,327.35);
 await page.reload();await billing();
 assert.equal(await page.getByRole('button',{name:'Editar BOR-1',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Editar BOR-2',exact:true}).count(),0);
 await page.getByRole('button',{name:'Editar '+group.id,exact:true}).click();
 assert.equal(await editor.locator('.invoice-line-row').count(),4);
 await editor.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();await editor.waitFor({state:'hidden'});
 assert.equal(exportCount,1);assert.deepEqual(exported.lines,savedLines);assert.deepEqual(exported.expedientes,cases.slice(0,2).map(row=>row.id));
 assert.ok(exported.lines.every(line=>line.tax==='21%'));
 await page.reload();await billing();await page.getByRole('button',{name:/Unificar expedientes WRIST/,exact:true}).click();
 assert.equal(await dialog.getByRole('checkbox').count(),0);
 assert.deepEqual(errors,[]);
 console.log('OK: WRIST selection, responsive preview, failed atomic save/retry, real PHP batch validation, manual edit/reload, one mock Holded proforma, sources locked');
} finally {await browser.close()}
