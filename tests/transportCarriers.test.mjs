import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentFields,assignmentValue,externalCarrierLabel,filterCarriers,transportAssignmentTeam} from '../src/transportCarriers.mjs';
const people=[{id:'P1',tipo:'persona',nombre:'José Pérez',telefono:'+34 600 100 200',zona:'Barcelona'},{id:'C1',nombre:'Camiones SA',activo:true},{id:'OLD',nombre:'Inactivo',activo:false}];
test('prefer the operational account over a duplicate administrator without changing users or assignments',()=>{
  const admin={id:'admin',fullName:'Javier Fernández',roles:['admin','operations','driver']};
  const driver={id:'driver',fullName:'Javier Fernández',roles:['driver']};
  const other={id:'other',fullName:'Other Admin Driver',roles:['admin','driver']};
  const list=[admin,driver,other,{id:'finance',fullName:'Finance',roles:['finance']}];
  const snapshot=JSON.stringify(list);
  assert.deepEqual(transportAssignmentTeam(list),[driver,other]);
  assert.deepEqual(transportAssignmentTeam([...list].reverse()),[other,driver]);
  assert.equal(JSON.stringify(list),snapshot);
  assert.equal(assignmentValue(admin.fullName,'',[]),'team:Javier Fernández');
  assert.deepEqual(transportAssignmentTeam([admin,{...driver,fullName:' JAVIER  FERNANDEZ ',roles:undefined,role:'operations'}]).map(p=>p.id),['driver']);
  assert.deepEqual(transportAssignmentTeam([admin]),[admin]);
});
test('external companies and people retain IDs and do not impersonate internal accounts',()=>{
  for(const p of people.slice(0,2)){const result=assignmentFields('external:'+p.id,people);assert.equal(result.proveedorId,p.id);assert.equal(result.asignado,externalCarrierLabel(p));assert.notEqual(result.asignado,p.nombre);assert.equal(assignmentValue(result.asignado,result.proveedorId,people),'external:'+p.id);}
  assert.deepEqual(assignmentFields('team:José Pérez',people),{asignado:'José Pérez',proveedorId:''});
  assert.deepEqual(assignmentFields('',people),{asignado:'Sin asignar',proveedorId:''});
});
test('inactive and unknown entries cannot be newly assigned; old assignments remain visible',()=>{
  assert.throws(()=>assignmentFields('external:OLD',people));assert.throws(()=>assignmentFields('external:missing',people));
  assert.equal(assignmentValue('Externo · Inactivo','OLD',people),'external:OLD');
  assert.equal(assignmentValue('Former Driver','',people),'team:Former Driver');
});
test('directory searches accents, phone, zones and inactive records without mutation',()=>{
  assert.equal(filterCarriers(people,'jose barcelona').length,1);assert.equal(filterCarriers(people,'600').length,1);
  assert.equal(filterCarriers(people,'').length,2);assert.equal(filterCarriers(people,'','inactive')[0].id,'OLD');assert.equal(filterCarriers(people,'','all').length,3);
});
test('deleted transportistas disappear from every directory filter and new assignments, but remain identifiable on history',()=>{
  const deleted={id:'DEL',nombre:'Deleted Person',tipo:'persona',activo:false,deletedAt:'2026-10-31T12:00:00Z'};
  const list=[...people,deleted];
  for(const filter of ['active','inactive','all'])assert.equal(filterCarriers(list,'Deleted',filter).length,0);
  assert.throws(()=>assignmentFields('external:DEL',list));
  assert.equal(assignmentValue('Externo · Deleted Person','DEL',list),'external:DEL');
});
