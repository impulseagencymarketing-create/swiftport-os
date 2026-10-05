// Local demo with a mocked Holded endpoint. Never creates a real invoice.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let payload;
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5184/')?route.continue():route.abort());
  await page.route('**/api/holded/**',route=>{
    payload=route.request().postDataJSON();
    return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Simulación local: no se ha enviado ninguna factura.'})});
  });
  await page.goto('http://127.0.0.1:5184/');
  await page.getByRole('button',{name:'Facturación',exact:true}).click();
  const notice=page.getByRole('button',{name:'Entendido',exact:true});
  if(await notice.count())await notice.click();
  const open=()=>page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();
  await open();
  const modal=page.locator('.invoice-detail-modal');
  const row=modal.locator('.invoice-line-row').filter({has:page.locator('input[value="TRANSPORT FROM WAREHOUSE TO VESSEL"]')});
  const detail=row.locator('textarea');
  const description=await detail.inputValue();
  assert.match(description,/BOX/);
  assert.match(description,/PUERTO BILBAO/);
  assert.match(description,/→/);
  assert.equal(await detail.evaluate(element=>element.tagName),'TEXTAREA');
  assert.doesNotMatch(await modal.locator('[name="observaciones"]').inputValue(),/TRANSPORTES REALIZADOS|PUERTO BILBAO/);
  await row.getByLabel('Precio',{exact:true}).fill('123.45');
  // This fixture lacks a verified finish time. Supply one before the send guard.
  const schedules=modal.locator('.overtime-review article');
  for(let index=0;index<await schedules.count();index++){
    const schedule=schedules.nth(index);
    await schedule.getByLabel('Horario del servicio').selectOption('manual');
    await schedule.getByLabel('Inicio',{exact:true}).fill('10:00');
    await schedule.getByLabel('Fin (sin el margen)',{exact:true}).fill('11:00');
  }
  await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await modal.waitFor({state:'hidden'});
  await open();
  assert.equal(await detail.inputValue(),description);
  assert.equal(await row.getByLabel('Precio',{exact:true}).inputValue(),'123.45');
  await modal.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();
  await page.getByText('Simulación local: no se ha enviado ninguna factura.',{exact:true}).waitFor();
  const sent=payload.invoice.lines.find(line=>line.item==='TRANSPORT FROM WAREHOUSE TO VESSEL');
  assert.equal(sent.detail,description);
  assert.equal(sent.price,123.45);
  assert.doesNotMatch(payload.invoice.observaciones,/TRANSPORTES REALIZADOS|PUERTO BILBAO/);
  assert.deepEqual(errors,[]);
  console.log('OK: multiline cargo and route under transport, save/reopen without duplication, manual price preserved, and same description in mocked Holded request.');
} finally {await browser.close();}
