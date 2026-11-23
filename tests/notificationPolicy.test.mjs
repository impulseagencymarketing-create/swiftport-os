import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTOMATIC_ALERTS_ENABLED} from '../src/notificationPolicy.mjs';
const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('quiet policy blocks automatic reminders even with legacy preferences',()=>{
 assert.equal(AUTOMATIC_ALERTS_ENABLED,false);
 for(const guard of ['if(!AUTOMATIC_ALERTS_ENABLED||!operationalLoaded)return;','if(!AUTOMATIC_ALERTS_ENABLED||!operationalLoaded||!deliveryAlerts.length)return;','if(!AUTOMATIC_ALERTS_ENABLED||!operationalLoaded||!billingAlerts.length)return;','enabled:AUTOMATIC_ALERTS_ENABLED&&raw.enabled!==false','{AUTOMATIC_ALERTS_ENABLED&&notificationCount>0&&'])assert.ok(source.includes(guard),guard);
 assert.doesNotMatch(source,/DeliveryPopup|setDeliveryPopup|className="delivery-popup"/);
 assert.match(source,/async function showDeviceNotification\([^]*?if\(!AUTOMATIC_ALERTS_ENABLED\)return false;/);
 assert.match(source,/const enableDeviceAlerts=async\(\)=>\{\s*if\(!AUTOMATIC_ALERTS_ENABLED\)return;/);
});
test('on-demand notifications and action feedback remain available',()=>{
 assert.ok(source.includes('{notificationOpen&&<NotificationDrawer alerts={activeNotifications} history={notificationLog}'));
 assert.ok(source.includes('{toast&&<div className="toast" role="status">'));
 assert.ok(source.includes('const notify=message=>{setToast(message)'));
});
