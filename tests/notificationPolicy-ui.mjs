import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5186/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[{id:'SW-2026-0998',buque:'BILLING TEST',cliente:'Test',puerto:'Barcelona',estado:'Completado',progreso:100},{id:'SW-2026-0999',buque:'DELIVERY TEST',cliente:'Test',puerto:'Barcelona',estado:'En curso',progreso:0,aisTracking:{alertKey:'new-signal',status:'En fondeo',alertMessage:'AIS test'}}];
const events=[{id:'TEST-TR',transporte:'TR1',expediente:cases[1].id,titulo:'DELIVERY TEST',tipoServicio:'Transporte',fecha:'2026-11-18',inicio:'14:00',fin:'15:00',asignado:'Test',estado:'Pendiente',origen:'Warehouse',destino:'Vessel'}];
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-18T12:00:00')});
 await page.addInitScript(()=>{
  localStorage.setItem('swiftport-alert-sound-settings-v2',JSON.stringify({enabled:true,sound:'message',volume:1}));
  localStorage.setItem('swiftport-device-alerts','1');
  localStorage.setItem('swiftport-ais-alerts-test',JSON.stringify({'SW-2026-0999':'old-signal'}));
  localStorage.setItem('swiftport-notification-log-test',JSON.stringify([{id:'old',type:'ais',title:'Existing history',message:'Preserved',unread:true}]));
  window.testInterruptions=[];
  window.AudioContext=class{constructor(){window.testInterruptions.push('sound');throw Error('Unexpected sound')}};
  window.Notification=class{static permission='granted';static requestPermission(){window.testInterruptions.push('permission');return Promise.resolve('granted')}constructor(){window.testInterruptions.push('notification')}};
 });
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.route('**/src/main.jsx*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/const LOCAL_DESIGN_MODE\s*=\s*[^;]+;/,'const LOCAL_DESIGN_MODE = false;')})});
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname;let body={ok:true};
  if(path==='/api/auth/me.php')body={authenticated:true,csrfToken:'test',user:{id:'test',fullName:'Test',roles:['admin','finance','operations']}};
  else if(path==='/api/finance.php')body={caseAmounts:{},clients:[],invoices:[]};
  else if(path==='/api/operational.php')body={data:{cases,calendarEvents:events,transports:[],warehouseEntries:[],customs:[],providers:[],vessels:[]}};
  else if(path==='/api/users/directory.php')body={users:[]};
  await r.fulfill({json:body});
 });
 await page.goto(base);await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await page.clock.fastForward(65*60*1000);
 assert.equal(await page.getByRole('alertdialog').count(),0);
 assert.equal(await page.locator('.notification i').count(),0);
 assert.equal(await page.locator('.toast').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.testInterruptions),[]);
 await page.getByRole('button',{name:'Notificaciones',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'Centro de notificaciones'});
 await drawer.getByText(/Avisos automáticos desactivados/).waitFor();
 assert.ok(await drawer.getByText('Existing history',{exact:true}).isVisible());
 assert.ok(await drawer.locator('.notification-card.active').count()>0);
 assert.equal(await drawer.getByRole('button',{name:'Probar sonido'}).count(),0);
 await page.screenshot({path:'../outputs/quiet-notifications.png'});
 await drawer.getByRole('button',{name:'Cerrar',exact:true}).click();
 // A user-triggered error is still shown; quiet mode does not hide failures.
 await page.route('**/api/operational.php',r=>r.fulfill({status:500,json:{error:'Test: no se pudieron cargar los datos'}}));
 await page.clock.fastForward(46000);
 await page.getByText('Test: no se pudieron cargar los datos',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('OK: old sound/push preferences ignored; no popups/badges/sounds across reminder cycles; manual centre/history and errors preserved.');
}finally{await browser.close()}
