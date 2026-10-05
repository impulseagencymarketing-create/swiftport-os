import test from 'node:test';
import assert from 'node:assert/strict';
import {markManualInvoice} from '../src/manualInvoice.mjs';
import {separateTransportLines} from '../src/invoiceTransportLines.mjs';
import {placeTransportDescription} from '../src/invoiceTransportDescription.mjs';
import {applyOvertime} from '../src/overtime.mjs';

test('manual kg, extra concepts, zero prices, quantities and surcharge stay exactly as reviewed',()=>{
 const invoice=markManualInvoice({concepto:'Pactado',estado:'Borrador',observaciones:'Nota manual',lines:[
  {id:'transport',item:'TRANSPORT',detail:'7 BOXES 875 KGS',price:187.35,units:2},
  {id:'storage',item:'STORAGE ESPECIAL',detail:'875 KGS',price:25,units:3},
  {id:'extra',item:'Recogida extra',detail:'Mercancía manual',price:35.5,units:1},
  {id:'auto-overtime:transport',item:'OVERTIME ACORDADO',price:12,units:1},
  {id:'free',item:'Servicio incluido',price:0,units:1}
 ]});
 const services=[{id:'A',inicio:'20:00',fin:'21:00'},{id:'B',inicio:'21:00',fin:'22:00'}];
 const split=separateTransportLines(invoice,services,{fresh:true,quoteFor:()=>({price:999})});
 const described=placeTransportDescription(split,'TRANSPORTES REALIZADOS:\n• Ruta distinta\n');
 const prepared=applyOvertime(described,services);
 assert.deepEqual(prepared.lines,invoice.lines);
 assert.equal(prepared.observaciones,invoice.observaciones);
 assert.equal(prepared.importe,497.2);
});
