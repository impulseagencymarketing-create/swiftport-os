// Mock local demo fixture data only. No live invoices, API accounts or external calls.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const [port,expected,origin='Barcelona'] of [['Tarragona',400],['Palamós',410],['Alcanar',580],['Barcelona',210],['Valencia',210,'Valencia'],['A Coruña',210,'A Coruña'],['Valencia',null,'Barcelona'],['Sagunto',null]]){
  const context=await browser.newContext();
  const page=await context.newPage();const errors=[];let holded=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5184/')?route.continue():route.abort());
  await page.route('**/src/data.js*',async route=>{
   const response=await route.fetch();let body=await response.text();
   body=body.replace(/(\{id: ["']SW-2026-0044["'][^\n]*)/,line=>line.replace('UME Shipping','Limani').replace('Bilbao',port));
   // Vite may preserve the compact source formatting instead.
   body=body.replace(/(\{id:["']SW-2026-0044["'][^\n]*)/,line=>line.replace('UME Shipping','Limani').replace('Bilbao',port));
   body=body.replaceAll('Puerto Bilbao → Almacén cliente','Almacén Swiftport - '+origin+' → Puerto '+port);
   await route.fulfill({response,body});
  });
  await page.route('**/api/holded/**',route=>{holded++;return route.abort()});
  await page.goto('http://127.0.0.1:5184/');
  await page.getByRole('button',{name:'Facturación',exact:true}).click();
  const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click();
  const open=()=>page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();
  await open();const modal=page.locator('.invoice-detail-modal');
  const panel=modal.locator('.port-transport-rate');await panel.waitFor();
  const row=modal.locator('.invoice-line-row').filter({has:page.locator('input[value="TRANSPORT FROM WAREHOUSE TO VESSEL"]')});
  assert.equal(Number(await row.getByLabel('Precio',{exact:true}).inputValue()),expected??0,port);
  if(expected!==null){
   await row.getByLabel('Precio',{exact:true}).fill('123.45');
   await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();await modal.waitFor({state:'hidden'});await open();
   assert.equal(await row.getByLabel('Precio',{exact:true}).inputValue(),'123.45');
   await panel.getByRole('button',{name:/Aplicar tarifa/}).click();
   assert.equal(Number(await row.getByLabel('Precio',{exact:true}).inputValue()),expected);
  }else{
   assert.match(await panel.innerText(),port==='Valencia'?/origen registrado/:/Sin tarifa/);
   assert.equal(await panel.getByRole('button',{name:/Aplicar tarifa/}).count(),0);
  }
  assert.deepEqual(errors,[]);assert.equal(holded,0);
  console.log('OK port fixture:',port,expected??'warning/no automatic price');
  await context.close();
 }
}finally{await browser.close();}
