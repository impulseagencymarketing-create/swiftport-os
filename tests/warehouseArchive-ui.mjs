// Isolated local demo fixtures. Never access or mutate production stock.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5184/')?route.continue():route.abort());
 await page.route('**/src/data.js*',async route=>{
  const response=await route.fetch();let body=await response.text();
  // Emulate the reported legacy inconsistency: closed case, stock still active.
  body=body.replace(/(ref:\s*["']ALM-309["'][^\n]*)/,line=>line.replace('Expedido','En stock'));
  await route.fulfill({response,body});
 });
 await page.goto('http://127.0.0.1:5184/');
 const dismiss=async()=>{const button=page.getByRole('button',{name:'Entendido',exact:true});if(await button.count())await button.click()};
 await page.getByRole('button',{name:'Almacén',exact:true}).click();await dismiss();
 const rows=page.locator('.warehouse-table .table-row');
 await rows.first().waitFor();
 assert.equal(await rows.filter({hasText:'OCEAN BREEZE'}).count(),0);
 await page.locator('.warehouse-view-tabs').getByRole('button',{name:/Archivados/}).click();
 await rows.filter({hasText:'OCEAN BREEZE'}).waitFor();
 // Close an active case through the edit form, rather than the POD button.
 await page.getByRole('button',{name:'Expedientes',exact:true}).click();await dismiss();
 await page.getByRole('button',{name:'Editar expediente',exact:true}).click();
 const modal=page.locator('.case-edit-modal');
 assert.equal(await modal.locator('input[name="buque"]').inputValue(),'MONTE EXPRESS');
 await modal.locator('select[name="estado"]').selectOption('Completado');
 await modal.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await modal.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Almacén',exact:true}).click();
 assert.equal(await rows.filter({hasText:'MONTE EXPRESS'}).count(),0);
 await page.locator('.warehouse-view-tabs').getByRole('button',{name:/Archivados/}).click();
 await rows.filter({hasText:'MONTE EXPRESS'}).waitFor();
 assert.equal(await rows.filter({hasText:'OCEAN BREEZE'}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('OK: legacy completed stock repaired on load; manual case closure archives stock immediately; entries remain visible under Archivados.');
}finally{await browser.close();}
