export const carrierType=carrier=>carrier?.tipo==='persona'?'persona':'empresa';
// Assignment records currently use names, not account IDs. Prefer the operational
// account when a person also has an administrator login; never rewrite history.
export function transportAssignmentTeam(team=[]){
  const roles=member=>Array.isArray(member.roles)?member.roles:[member.role];
  const name=member=>String(member.fullName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
  const eligible=team.filter(member=>name(member)&&roles(member).some(role=>['operations','driver'].includes(role)));
  const operationalNames=new Set(eligible.filter(member=>!roles(member).includes('admin')).map(name));
  return eligible.filter(member=>!roles(member).includes('admin')||!operationalNames.has(name(member)));
}
export const externalCarrierLabel=carrier=>`Externo · ${carrier.nombre}`;
export function assignmentValue(driver,providerId,providers){
  if(providerId&&(driver===externalCarrierLabel(providers.find(p=>p.id===providerId)||{nombre:''})||String(driver||'').startsWith('Externo · ')||!driver||driver==='Sin asignar'))return `external:${providerId}`;
  return driver&&driver!=='Sin asignar'?`team:${driver}`:'';
}
export function assignmentFields(value,providers){
  if(value.startsWith('external:')){
    const provider=providers.find(p=>p.id===value.slice(9)&&p.activo!==false&&!p.deletedAt);
    if(!provider)throw new Error('El transportista ya no está disponible. Actualiza el directorio.');
    return {asignado:externalCarrierLabel(provider),proveedorId:provider.id};
  }
  return {asignado:value.startsWith('team:')?value.slice(5):'Sin asignar',proveedorId:''};
}
export function filterCarriers(providers,query,filter='active'){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  return providers.filter(p=>!p.deletedAt&&(filter==='all'||(filter==='inactive'?p.activo===false:p.activo!==false))&&terms.every(t=>normalize([p.nombre,p.contacto,p.telefono,p.email,p.zona,p.vehiculo,p.notas].join(' ')).includes(t)));
}
