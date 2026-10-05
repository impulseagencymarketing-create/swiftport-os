// Local demo only: never sends a real invoice or connects to Holded.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 let holdedCalls=0;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5184/')?route.continue():route.abort());
 await page.route('**/api/holded/**',route=>{holdedCalls++;return route.abort()});
 await page.goto('http://127.0.0.1:5184/');
 await page.getByRole('button',{name:'Facturación',exact:true}).click();
 const notice=page.getByRole('button',{name:'Entendido',exact:true});
 if(await notice.count()) await notice.click();
 await page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();
 const modal=page.locator('.invoice-detail-modal');
 await modal.getByRole('button',{name:'Linea manual',exact:true}).click();
 const row=modal.locator('.invoice-line-row').last();
 await row.getByLabel('Precio',{exact:true}).fill('100');
 const review=modal.locator('.overtime-review');
 await review.getByText('Falta un horario de inicio y fin verificable.').waitFor();
 await modal.getByRole('button',{name:'Enviar proforma a Holded',exact:true}).click();
 assert.equal(holdedCalls,0);
 assert.ok(await modal.isVisible());
 await review.getByLabel('Horario del servicio').selectOption('manual');
 await review.getByLabel('Inicio',{exact:true}).fill('18:30');
 await review.getByLabel('Fin (sin el margen)',{exact:true}).fill('19:30');
 await review.getByText(/OVERTIME \+30.00/).waitFor();
 assert.match(await modal.locator('.invoice-total-box').innerText(),/130,00/);
 await row.getByLabel('Precio',{exact:true}).fill('200');
 await review.getByText(/OVERTIME \+60.00/).waitFor();
 assert.match(await modal.locator('.invoice-total-box').innerText(),/260,00/);
 await review.getByLabel('Inicio',{exact:true}).fill('10:00');
 await review.getByLabel('Fin (sin el margen)',{exact:true}).fill('11:00');
 await review.getByText(/Sin overtime/).waitFor();
 assert.equal(await review.locator('.overtime-charge').count(),0);
 assert.match(await modal.locator('.invoice-total-box').innerText(),/200,00/);
 await review.getByLabel('Inicio',{exact:true}).fill('18:30');
 await review.getByLabel('Fin (sin el margen)',{exact:true}).fill('19:30');
 for(const [theme,width,height] of [['dark',1440,1000],['dark',390,844],['light',1440,1000]]){
   await page.setViewportSize({width,height});
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await review.scrollIntoViewIfNeeded();
   const size=await review.evaluate(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth}));
   assert.ok(size.width<=width && size.scroll<=size.client+1,JSON.stringify(size));
   if(process.env.OVERTIME_SCREENSHOT_DIR)await page.screenshot({path:process.env.OVERTIME_SCREENSHOT_DIR+`/overtime-${theme}-${width}.png`});
 }
 await modal.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 await modal.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Editar BOR-2026-0044',exact:true}).click();
 await modal.locator('.overtime-review').getByText(/OVERTIME \+60.00/).waitFor();
 assert.match(await modal.locator('.invoice-total-box').innerText(),/260,00/);
 assert.equal(holdedCalls,0);
 assert.deepEqual(errors,[]);
 console.log('OK: real invoice editor, manual service time, margin, price recalculation, day/night changes, responsive review and local save. No Holded calls.');
}finally{await browser.close();}
