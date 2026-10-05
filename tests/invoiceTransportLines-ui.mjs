// All data are local fixtures; the Holded endpoint is mocked and never sends invoices.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
try{
 for(const legacy of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];let payload;
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.route('**/api/holded/**',route=>{payload=route.request().postDataJSON();return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Prueba local: envío simulado.'})})});
  await page.route('**/src/data.js*',async route=>{
   const response=await route.fetch();let body=await response.text();
   body+=`\nObject.assign(expedientesIniciales.find(x=>x.id==='SW-2026-0044'),{cliente:'Limani',puerto:'Valencia',purchaseOrder:'PO-TEST',peso:'660 kg'});
   Object.assign(movimientosAlmacen.find(x=>x.expediente==='SW-2026-0044'),{peso:'660 kg'});
   transportesIniciales.splice(0,transportesIniciales.length,...transportesIniciales.filter(x=>x.expediente!=='SW-2026-0044'),
   {id:'TR-A',expediente:'SW-2026-0044',fecha:'2026-09-23',inicio:'08:00',fin:'09:00',origen:'TECNYCON',destino:'ALMACÉN SWIFTPORT - BLUESPACE EL PRAT',estado:'Entregado'},
   {id:'TR-B',expediente:'SW-2026-0044',fecha:'2026-09-24',inicio:'20:00',fin:'21:00',origen:'ALMACÉN VALENCIA',destino:'BUQUE ESKE - VALENCIA',estado:'Entregado'});
   eventosCalendarioIniciales.push({id:'EV-A',expediente:'SW-2026-0044',transporte:'TR-A',tipoServicio:'Transporte',fecha:'2026-09-23',inicio:'08:00',fin:'09:00'});
   `;
   await route.fulfill({response,body});
  });
  if(legacy)await page.route('**/src/main.jsx*',async route=>{
   const response=await route.fetch();let body=await response.text();
   const invoice={id:'BOR-2026-0044',expediente:'SW-2026-0044',cliente:'Limani',buque:'ESKE',puerto:'Valencia',estado:'Borrador',importe:700,observaciones:'Nota fiscal',lines:[{id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:'2 TRANSPORTES - 3 BULTO 580 KGS + 1 PALLET 80 KGS',price:350,units:2,tax:'0%'}]};
   assert.match(body,/setFinance\(demoFinance\(\)\)/);
   body=body.replaceAll('setFinance(demoFinance())',`setFinance({...demoFinance(),invoices:[${JSON.stringify(invoice)}]})`);
   await route.fulfill({response,body});
  });
  await page.goto(base);await page.getByRole('button',{name:'Facturación',exact:true}).click();
  const notice=page.getByRole('button',{name:'Entendido',exact:true});if(await notice.count())await notice.click();
  const open=()=>page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();await open();
  const modal=page.locator('.invoice-detail-modal');
  const rows=modal.locator('.invoice-line-row').filter({has:page.locator('input[value="TRANSPORT"]')});
  await rows.nth(1).waitFor();assert.equal(await rows.count(),2);
  for(let i=0;i<2;i++)assert.equal(await rows.nth(i).getByLabel('Uds.',{exact:true}).inputValue(),'1');
  assert.equal(await rows.nth(0).getByLabel('Precio',{exact:true}).inputValue(),legacy?'350':'0');
  assert.equal(await rows.nth(1).getByLabel('Precio',{exact:true}).inputValue(),'350');
  assert.match(await rows.nth(0).locator('textarea').inputValue(),/TECNYCON/);
  assert.doesNotMatch(await rows.nth(1).locator('textarea').inputValue(),/TECNYCON/);
  assert.equal(await modal.locator('.port-transport-rate.missing').count(),1);
  assert.equal(await modal.locator('.port-transport-rate.available').count(),1);
  await rows.nth(0).getByLabel('Precio',{exact:true}).fill('111');
  await rows.nth(1).getByLabel('Precio',{exact:true}).fill('222');
  const unknown=modal.locator('.overtime-review article').filter({hasText:'Falta un horario'});
  while(await unknown.count()){
   const row=unknown.first();await row.getByLabel('Horario del servicio').selectOption('manual');
   await row.getByLabel('Inicio',{exact:true}).fill('10:00');await row.getByLabel('Fin (sin el margen)',{exact:true}).fill('11:00');
  }
  assert.equal(await modal.locator('.overtime-charge').count(),1);
  assert.match(await modal.locator('.overtime-charge').innerText(),/66.60/);
  await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();await modal.waitFor({state:'hidden'});await open();
  assert.equal(await rows.count(),2);
  assert.equal(await rows.nth(0).getByLabel('Precio',{exact:true}).inputValue(),'111');
  assert.equal(await rows.nth(1).getByLabel('Precio',{exact:true}).inputValue(),'222');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();
  await page.getByText('Prueba local: envío simulado.',{exact:true}).waitFor();
  const sent=payload.invoice.lines.filter(line=>line.item==='TRANSPORT');
  assert.deepEqual(sent.map(line=>[line.price,line.units]),[[111,1],[222,1]]);
  assert.match(sent[0].detail,/TECNYCON/);assert.match(sent[1].detail,/BUQUE ESKE/);
  assert.deepEqual(errors,[]);
  console.log('OK:',legacy?'legacy split':'new draft','independent routes, prices, overtime, save/reopen and mocked Holded payload');
  await context.close();
 }
}finally{await browser.close()}
