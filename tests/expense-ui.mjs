// Run against a LOCAL Vite preview only. All upload/OCR/save requests are mocked.
// PLAYWRIGHT_PACKAGE may point to a bundled playwright/package.json.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let savedPayload=null, failScan=false, duplicate=false;
  const attachment={id:'a'.repeat(32),name:'test-invoice.pdf',url:'/api/uploads.php?id='+ 'a'.repeat(32)};
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5183/')?route.continue():route.abort());
  await page.route('**/api/uploads.php',route=>route.fulfill({json:{file:attachment}}));
  await page.route('**/api/expense-import.php',route=>{
    const data=route.request().postDataJSON();
    if(data.action==='scan' && failScan) return route.fulfill({status:503,json:{error:'Lectura no disponible. Completa manualmente.'}});
    if(data.action==='save' && duplicate) return route.fulfill({status:409,json:{error:'Factura duplicada.'}});
    if(data.action==='scan') return route.fulfill({json:{invoice:{supplier:'Proveedor de prueba',supplierTaxId:'TEST',number:'F-TEST-1',date:'2026-09-09',currency:'EUR',concept:'Transporte compartido',net:'100.00',tax:'21.00',total:'121.00',notes:'Datos ficticios',vessels:[],references:[],warnings:[]}}});
    savedPayload=data;return route.fulfill({json:{ok:true,id:'test',cases:[]}});
  });
  await page.goto('http://127.0.0.1:5183/');
  await page.getByRole('button',{name:'Gastos operativos',exact:true}).click();
  await page.getByRole('button',{name:'Escanear factura de gasto',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Escáner de facturas de gasto'});
  await dialog.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('mocked test document')});
  await page.getByLabel('Proveedor',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Proveedor',{exact:true}).inputValue(),'Proveedor de prueba');
  const choices=dialog.locator('.expense-scan-cases input[type=checkbox]');
  assert.ok(await choices.count()>=3);
  for(let i=0;i<3;i++) await choices.nth(i).check();
  assert.deepEqual(await dialog.locator('.expense-scan-split input').evaluateAll(inputs=>inputs.map(input=>input.value)),['33.34','33.33','33.33']);
  const save=page.getByRole('button',{name:'Registrar en 3 expediente(s)',exact:true});
  assert.ok(await save.isDisabled());
  await page.getByLabel('Modo de reparto').selectOption('manual');
  await dialog.locator('.expense-scan-split input').first().fill('34');
  await page.getByLabel('He revisado la factura',{exact:false}).check();
  assert.ok(await save.isDisabled());
  await page.getByLabel('Modo de reparto').selectOption('equal');
  await page.getByLabel('Coste a repartir (€)',{exact:true}).fill('100,00');
  for (const [theme,width,height] of [['dark',1440,1000],['dark',390,844],['light',1440,1000]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
    const metrics=await dialog.evaluate(element=>({width:element.getBoundingClientRect().width,scroll:element.scrollWidth,client:element.clientWidth}));
    assert.ok(metrics.width<=width+1 && metrics.scroll<=metrics.client+1,JSON.stringify(metrics));
    if(process.env.EXPENSE_SCREENSHOT_DIR) await page.screenshot({path:process.env.EXPENSE_SCREENSHOT_DIR+`/expense-${theme}-${width}.png`});
  }
  await page.getByLabel('He revisado la factura',{exact:false}).check();
  await save.click();
  await page.getByRole('heading',{name:'Factura registrada correctamente'}).waitFor();
  assert.equal(savedPayload.confirmed,true);
  assert.deepEqual(savedPayload.allocations.map(row=>row.amount),['33.34','33.33','33.33']);
  assert.equal(new Set(savedPayload.allocations.map(row=>row.caseRef)).size,3);
  await page.getByRole('button',{name:'Volver a gastos',exact:true}).click();
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.getByRole('button',{name:'Gastos operativos',exact:true}).click();
  failScan=true;duplicate=true;
  await page.getByRole('button',{name:'Escanear factura de gasto',exact:true}).click();
  await dialog.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('mocked test document')});
  await page.getByRole('alert').filter({hasText:'Lectura no disponible'}).waitFor();
  for(const [label,value] of [['Proveedor','Proveedor manual'],['Número de factura','F-TEST-1'],['Fecha','2026-09-09'],['Concepto del gasto','Freight'],['Coste a repartir (€)','19,90']]) await page.getByLabel(label,{exact:true}).fill(value);
  await choices.first().check();
  await page.getByLabel('He revisado la factura',{exact:false}).check();
  await page.getByRole('button',{name:'Registrar en 1 expediente(s)',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Factura duplicada.'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Factura registrada correctamente'}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('OK: expenses page, mocked OCR, reviewed split, imbalance guard, save and responsive dark/light layouts');
} finally {await browser.close();}
