import test from 'node:test';
import assert from 'node:assert/strict';
import {separateTransportLines} from '../src/invoiceTransportLines.mjs';
import {quoteLimaniService} from '../src/limaniPortRates.mjs';
import {applyOvertime} from '../src/overtime.mjs';
const services=[
 {id:'a',fecha:'2026-09-23',inicio:'08:00',fin:'09:00',origen:'TECNYCON',destino:'ALMACÉN SWIFTPORT - BLUESPACE EL PRAT'},
 {id:'b',fecha:'2026-09-24',inicio:'20:00',fin:'21:00',origen:'ALMACÉN VALENCIA',destino:'BUQUE ESKE - VALENCIA'}
];
const original={estado:'Borrador',observaciones:'Nota fiscal',lines:[{id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:'2 TRANSPORTES - 3 BULTO 580 KGS + 1 PALLET 80 KGS',price:350,units:2,tax:'0%'}]};
const quoteFor=service=>quoteLimaniService({port:'Valencia',weight:660,service});
test('legacy transports split into distinct priced rows with only their own route',()=>{
 const result=separateTransportLines(original,services);
 assert.equal(result.lines.length,2);
 assert.deepEqual(result.lines.map(l=>l.units),[1,1]);
 assert.deepEqual(result.lines.map(l=>l.price),[350,350]);
 assert.equal(result.lines.reduce((s,l)=>s+l.price*l.units,0),700);
 assert.match(result.lines[0].detail,/TECNYCON/);assert.doesNotMatch(result.lines[1].detail,/TECNYCON/);
 assert.match(result.lines[1].detail,/BUQUE ESKE/);assert.doesNotMatch(result.lines[0].detail,/BUQUE ESKE/);
 assert.ok(result.lines.every(l=>l.detail.includes('580 KGS')));
 assert.ok(result.lines.every(l=>!l.detail.includes('2 TRANSPORTES')));
 assert.notEqual(result.lines[0].id,result.lines[1].id);
 assert.equal(original.lines.length,1);
});
test('new draft quotes each route independently; special pickup has no invented rate',()=>{
 const result=separateTransportLines(original,services,{fresh:true,quoteFor});
 assert.deepEqual(result.lines.map(l=>l.price),[0,350]);
 assert.equal(quoteFor(services[0]).status,'missing');
 assert.equal(quoteFor(services[1]).status,'available');
 assert.equal(quoteFor({...services[1],origen:'Supplier Valencia'}).status,'missing');
 assert.equal(quoteFor({...services[1],destino:'BUQUE ESKE - BARCELONA'}).status,'missing');
});
test('editing one price, deleting a row, reordered records and repeat loads preserve user decisions',()=>{
 const result=separateTransportLines(original,services);
 result.lines[0].price=123.45;result.lines[1].price=567;
 assert.deepEqual(separateTransportLines(result,[...services].reverse()),result);
 const deleted={...result,lines:[result.lines[1]]};
 assert.deepEqual(separateTransportLines(deleted,services),deleted);
});
test('overtime uses each linked trip, not the other trip or the entire invoice',()=>{
 const split=separateTransportLines(original,services);
 split.lines[0].price=123;split.lines[1].price=200;
 const result=applyOvertime(split,services);
 assert.equal(result.importe,383);
 assert.equal(result.overtimeReview[0].night,false);
 assert.equal(result.overtimeReview[1].surcharge,60);
 assert.equal(result.lines.filter(l=>l.id.startsWith('auto-overtime:')).length,1);
 assert.equal(applyOvertime(result,services).importe,383);
 assert.ok(applyOvertime(split,[services[0]]).overtimeReview[1].unknown);
});
test('issued invoices, hourly quantities, ambiguous matching and manual descriptions are protected',()=>{
 for(const locked of [{estado:'Facturado'},{holdedId:'id'}]){const item={...original,...locked};assert.equal(separateTransportLines(item,services),item);}
 const hourly={...original,lines:[{...original.lines[0],detail:'2 HOURS DELIVERY'}]};
 assert.equal(separateTransportLines(hourly,services),hourly);
 const uncertain=separateTransportLines(original,[services[0]]);
 assert.equal(uncertain.lines.length,2);assert.ok(uncertain.transportDescriptionNeedsReview);
 assert.ok(uncertain.lines.every(l=>l.transportSplitUnmatched&&!l.transportServiceKey));
 const manual=separateTransportLines({...original,lines:[{...original.lines[0],detail:'Texto pactado',transportDetailManual:true}]},services);
 assert.ok(manual.lines.every(l=>l.detail==='Texto pactado'));
});
test('old generated route block is replaced, without leaving both trips in each line',()=>{
 const value={...original,lines:[{...original.lines[0],detail:original.lines[0].detail+'\n• 23/9/2026 · 08:00–09:00 · TECNYCON → ALMACEN\n• 24/9/2026 · 20:00–21:00 · ALMACEN → BUQUE ESKE'}]};
 const result=separateTransportLines(value,services);
 assert.ok(result.lines.every(l=>(l.detail.match(/•/g)||[]).length===1));
 assert.deepEqual(separateTransportLines(result,services),result);
});
