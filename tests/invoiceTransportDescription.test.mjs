import test from 'node:test';
import assert from 'node:assert/strict';
import {placeTransportDescription,splitTransportNotes} from '../src/invoiceTransportDescription.mjs';
const trip='• 5/9/2026 · 06:00–07:00 · ALMACÉN SWIFTPORT → BUQUE MERITO - BARCELONA';
const notes='Texto fiscal\n\nTRANSPORTES REALIZADOS:\n'+trip+'\n\nNota manual del cliente';
const invoice={estado:'Borrador',observaciones:notes,importe:123.45,lines:[{id:'reception',item:'RECEPTION',detail:'Mercancía',price:60,units:1},{id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:'2 BOXES 37 KGS + 1 PALLET 100 KGS',price:63.45,units:1,tax:'0%'}]};
test('transport description is below its cargo and not in observations; prices unchanged',()=>{
  const result=placeTransportDescription(invoice);
  assert.equal(result.lines[1].detail,invoice.lines[1].detail+'\n'+trip);
  assert.equal(result.lines[1].price,63.45);
  assert.equal(result.importe,123.45);
  assert.deepEqual(result.lines[0],invoice.lines[0]);
  assert.match(result.observaciones,/Texto fiscal/);
  assert.match(result.observaciones,/Nota manual del cliente/);
  assert.doesNotMatch(result.observaciones,/TRANSPORTES|MERITO/);
});
test('save/reopen is idempotent and a corrected schedule replaces only generated text',()=>{
  const first=placeTransportDescription(invoice);
  assert.deepEqual(placeTransportDescription(first,notes),first);
  const result=placeTransportDescription(first,notes.replace('06:00–07:00','08:00–09:00'));
  assert.doesNotMatch(result.lines[1].detail,/06:00/);
  assert.match(result.lines[1].detail,/08:00–09:00/);
  assert.match(result.lines[1].detail,/2 BOXES/);
});
test('several services stay in the single transport line, without adding invoice rows',()=>{
  const result=placeTransportDescription(invoice,'TRANSPORTES REALIZADOS:\n'+trip+'\n'+trip.replace('5/9','6/9'));
  assert.equal(result.lines.length,2);
  assert.equal((result.lines[1].detail.match(/•/g)||[]).length,2);
});
test('ambiguous separately priced routes are flagged instead of guessing',()=>{
  const result=placeTransportDescription({...invoice,lines:[...invoice.lines,{item:'TRANSPORT FROM AIRPORT TO WAREHOUSE',detail:'AIRPORT',price:90}]});
  assert.equal(result.transportDescriptionNeedsReview,true);
  assert.equal(result.observaciones,notes);
  assert.equal(result.lines[1].detail,invoice.lines[1].detail);
});
test('sent invoices and manually edited descriptions are never rewritten',()=>{
  assert.equal(placeTransportDescription({...invoice,estado:'Facturado'}).observaciones,notes);
  const manual={...invoice,lines:[{...invoice.lines[1],detail:'Descripción pactada',transportDetailManual:true}]};
  assert.equal(placeTransportDescription(manual).lines[0].detail,'Descripción pactada');
});
test('no schedule is fabricated and unrelated notes are preserved',()=>{
  assert.equal(placeTransportDescription({...invoice,observaciones:'Solo nota'}).lines[1].detail,invoice.lines[1].detail);
  assert.deepEqual(splitTransportNotes('Nota sin bloque'),{notes:'Nota sin bloque',services:''});
});
