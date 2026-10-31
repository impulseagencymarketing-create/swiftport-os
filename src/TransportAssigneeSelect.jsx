import React from 'react';
import {assignmentValue,assignmentFields,carrierType} from './transportCarriers.mjs';

export default function TransportAssigneeSelect({driver,providerId,team=[],providers=[],onChange,disabled=false,label='Asignar transportista'}){
  const value=assignmentValue(driver,providerId,providers);
  const active=providers.filter(p=>p.activo!==false&&!p.deletedAt);
  const known=value===''||team.some(p=>value===`team:${p.fullName}`)||active.some(p=>value===`external:${p.id}`);
  return <select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(assignmentFields(e.target.value,providers))}>
    <option value="">Sin asignar</option>
    {!known&&<option value={value}>{providers.find(p=>value===`external:${p.id}`)?.nombre||driver||'Asignación guardada'} (asignación anterior)</option>}
    <optgroup label="Equipo SWIFTPORT">{team.map(p=><option key={p.id} value={`team:${p.fullName}`}>{p.fullName}</option>)}</optgroup>
    {['persona','empresa'].map(tipo=><optgroup key={tipo} label={tipo==='persona'?'Personas externas':'Empresas proveedoras'}>{active.filter(p=>carrierType(p)===tipo).map(p=><option key={p.id} value={`external:${p.id}`}>{p.nombre}</option>)}</optgroup>)}
  </select>;
}
