import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileWarehouseArchive} from '../src/warehouseArchive.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./warehouseArchive.fixtures.json',import.meta.url),'utf8'));
for(const fixture of fixtures)test(fixture.name,()=>{
  const before=structuredClone(fixture);
  const result=reconcileWarehouseArchive(fixture.entries,fixture.cases);
  assert.equal(Boolean(result[0].archivado),fixture.archived);
  if(!fixture.archived)assert.equal(result,fixture.entries);
  assert.deepEqual(fixture,before,'no mutation of source state');
  assert.deepEqual(result[0].fotos,fixture.entries[0].fotos);
  assert.deepEqual(result[0].documentosRecepcion,fixture.entries[0].documentosRecepcion);
  assert.equal(result[0].bultos,fixture.entries[0].bultos);
  assert.equal(result[0].peso,fixture.entries[0].peso);
  assert.equal(reconcileWarehouseArchive(result,fixture.cases),result,'idempotent');
  if(fixture.archived&&!fixture.entries[0].archivado){
    assert.equal(result[0].estado,'Expedido');
    assert.equal(result[0].salida,fixture.entries[0].salida||fixture.cases[0].deliveryConfirmedAt);
  }
});
test('multiple rows archive only exact completed case links',()=>{
  const entries=[{ref:'A',expediente:'DONE'},{ref:'B',expediente:'OPEN'},{ref:'C',expediente:'DONE'},{ref:'D',buque:'SAME'}];
  const cases=[{id:'DONE',buque:'SAME',estado:'Completado'},{id:'OPEN',buque:'SAME',estado:'En curso'}];
  const result=reconcileWarehouseArchive(entries,cases);
  assert.deepEqual(result.map(row=>Boolean(row.archivado)),[true,false,true,false]);
  assert.equal(result.length,4);
});
