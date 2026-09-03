import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import {
  Anchor, LayoutDashboard, FolderKanban, Warehouse as WarehouseIcon, Truck, FileCheck2,
  UsersRound, ReceiptText, Menu, X, Plus, Search, Bell, ChevronLeft, ChevronRight, Ship,
  PackageCheck, CircleAlert, WalletCards, CalendarDays, MapPin, Clock3, CheckCircle2,
  Circle, Camera, Box, Scale, Layers3, Navigation, UserRound, FileText, UploadCloud,
  Download, Filter, CircleDollarSign, ExternalLink, Mail, PencilLine, ClipboardCheck,
  BadgeEuro, Sparkles, ArrowLeft, Save, LogOut, ShieldCheck, LockKeyhole, UserPlus, Eye,
  RefreshCw, Timer, Undo2, ScanLine, Trash2, Archive, ClipboardList, Moon, Sun
} from 'lucide-react';
import {
  expedientesIniciales, movimientosAlmacen, transportesIniciales, proveedoresIniciales, tramitesAduana, eventosCalendarioIniciales,
  clientNames, holdedClientProfiles
} from './data';
import './styles.css';
import './fixes.css';
pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
const LOCAL_DESIGN_MODE=import.meta.env.DEV&&['localhost','127.0.0.1'].includes(window.location.hostname);
const THEME_STORAGE_KEY='swiftport-color-theme';
const loadColorTheme=()=>{try{const stored=localStorage.getItem(THEME_STORAGE_KEY);if(['light','dark'].includes(stored))return stored}catch{}return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'};
const INITIAL_COLOR_THEME=loadColorTheme();
document.documentElement.dataset.theme=INITIAL_COLOR_THEME;
document.documentElement.style.colorScheme=INITIAL_COLOR_THEME;
const DEMO_USER={id:'local-demo',fullName:'Javier Fernández',email:'demo@swiftport.local',roles:['admin','operations','finance','driver']};
const DEMO_TEAM=[
  {id:'local-admin',fullName:'Javier Fern\u00e1ndez',email:'javier@swiftport.local',roles:['admin','operations','finance']},
  {id:'local-driver',fullName:'Mois\u00e9s Rodriguez',email:'moises@swiftport.local',roles:['driver','operations']}
];
const clientCodeFromName=name=>'CLI-'+String(name||'CLIENTE').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24);
const LIMANI_FREE_STORAGE_LABEL='GRATIS · Sin coste por días ni peso';
const normalizeClientProfile=client=>{
  const name=client?.nombre||client?.name||'CLIENTE SIN NOMBRE';
  const isLimani=/limani/i.test(name);
  const isAls=/\bals\b|algeciras logistics solution/i.test(name);
  const isUme=/\bume\b/i.test(name);
  const tarifaActiva=client?.tarifaActiva&&!/sin tarifa|pendiente/i.test(String(client.tarifaActiva))?client.tarifaActiva:(isLimani?'LIMANI Barcelona 2026':isAls?'ALS Barcelona 2026':isUme?'UME Algeciras 2026':'Sin tarifa automática');
  const recepcion=client?.recepcion&&!/sin tarifa|pendiente/i.test(String(client.recepcion))?client.recepcion:(isLimani?'0-35 kg 15€ - 35-250 kg 60€ - 251-500 kg 130€ - 501-2500 kg 245€':isAls?'LOAD / UNLOAD: 0,12 €/kg por separado':isUme?'Coordination 66€ + handling 0,0363€/kg (min. 19,80€ >50 kg)':'Pendiente de tarifa');
  const storage=isLimani?LIMANI_FREE_STORAGE_LABEL:(client?.storage&&!/sin tarifa|pendiente/i.test(String(client.storage))?client.storage:(isAls?'3 días gratis · 36-100 kg 2,50€/día · 101-500 kg 3,50€/día · 500+ kg 7,50€/día':isUme?'Warehousing 0,715€/kg/día · min. 9,90€ · storage min. 99€':'Pendiente de tarifa'));
  const transporte=client?.transporte&&!/sin tarifa|pendiente/i.test(String(client.transporte))?client.transporte:(isLimani?'Warehouse→Vessel: 45€ / 95€ / 250€ / 350€ por peso':isAls?'Añadir manual según servicio: aeropuerto, recogidas o transporte especial':isUme?'Delivery to vessel <50 kg 71,50€ · >50 kg 71,50€/h':'Pendiente de tarifa');
  const recargo=client?.recargo&&!/sin tarifa|pendiente/i.test(String(client.recargo))?client.recargo:(isLimani||isAls||isUme?'+30% overtime / holidays':'Pendiente');
  return {
    codigo:client?.codigo||client?.id||clientCodeFromName(name),
    nombre:name,
    contacto:client?.contacto||client?.email||'',
    telefono:client?.telefono||'',
    fiscalName:client?.fiscalName||client?.razonSocial||(isLimani?'LIMANI SUPPLY GROUP S.L.':name),
    taxId:client?.taxId||client?.nif||(isLimani?'ESB01785120':''),
    direccion:client?.direccion||(isLimani?'Calle Juan de la Cierva 11, Villalbilla (28810), Madrid, Espa?a':''),
    condicionesPago:client?.condicionesPago||client?.terms||'30 d?as',
    moneda:client?.moneda||'EUR',
    tarifaActiva,
    notas:client?.notas||'',
    expedientes:Number(client?.expedientes??client?.activeCases??0),
    recepcion,
    storage,
    transporte,
    recargo,
    activo:client?.activo!==false
  };
};
const clientProfileKey=client=>{
  const name=String(client?.nombre||client?.name||client?.fiscalName||'').toLowerCase();
  if(name.includes('limani'))return 'limani';
  if(name.includes('als')||name.includes('algeciras logistics solution'))return 'als';
  if(name.includes('ume'))return 'ume shipping';
  if(name.includes('a-ships')||name.includes('galaxy seaways'))return 'a-ships';
  if(name.includes('balearia')||name.includes('balearia eurolines'))return 'balearia';
  if(name.includes('oca global'))return 'oca global';
  if(name.includes('marine logistics'))return 'marine logistics españa';
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
};
const mergeClientProfiles=(clients=[])=>{
  const map=new Map();
  (holdedClientProfiles||[]).map(normalizeClientProfile).forEach(profile=>map.set(clientProfileKey(profile),profile));
  (clients||[]).map(normalizeClientProfile).forEach(profile=>{
    const key=clientProfileKey(profile);
    map.set(key,{...(map.get(key)||{}),...profile});
  });
  return [...map.values()].sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
};
const demoFinance=()=>({
  caseAmounts:{[expedientesIniciales[0]?.id||'SW-2026-DEMO']:420},
  warehouseStorageTotal:318,
  clients:mergeClientProfiles(clientNames.map((name,index)=>({codigo:`CLI-${String(index+1).padStart(3,'0')}`,nombre:name}))),
  invoices:[{
    id:`BOR-${expedientesIniciales[0]?.id||'SW-2026-DEMO'}`,
    expediente:expedientesIniciales[0]?.id||'SW-2026-DEMO',
    cliente:expedientesIniciales[0]?.cliente||clientNames[0]||'CLIENTE DEMO',
    concepto:`Servicio logístico ${expedientesIniciales[0]?.buque||'BUQUE DEMO'}  -  ${expedientesIniciales[0]?.puerto||'PUERTO'}`,
    importe:420,
    estado:'Borrador',
    vencimiento:'2026-08-15',
    notas:'Borrador local para revisar el flujo de facturación.'
  }]
});
const NAV = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['calendario','Calendario',CalendarDays],
  ['expedientes','Expedientes',FolderKanban],
  ['correos','Correos',Mail],
  ['almacen','Almacén',WarehouseIcon],
  ['buques','Buques',Ship],
  ['clientes','Clientes / Tarifas',UsersRound],
  ['facturacion','Facturación',ReceiptText],
  ['auditoria','Auditoría',ClipboardList],
  ['usuarios','Usuarios',ShieldCheck]
];
const TITLES = {
  dashboard:['Dashboard','Vista general de la operativa'],
  calendario:['Calendario','Planificación semanal del equipo'],
  expedientes:['Expedientes','Seguimiento completo por buque'],
  almacen:['Almacén','Entradas, ubicación y días de storage'],
  buques:['Buques','Fichas, IMO/MMSI y seguimiento AIS'],
  transportes:['Transportes','Planificación y asignación de conductores'],
  aduanas:['Aduanas','Documentación y control de despachos'],
  correos:['Correos','Bandeja de operations@ e info@ vinculada a expedientes'],
  clientes:['Clientes y tarifas','Condiciones comerciales por cliente'],
  facturacion:['Facturación','Servicios listos para revisar y exportar'],
  auditoria:['Auditoría','Registro de movimientos por usuario'],
  usuarios:['Usuarios y permisos','Control de acceso al equipo']
};
const ROLE_LABELS={driver:'Transportista',operations:'Operaciones',finance:'Finanzas',admin:'Administración'};
const SERVICE_TYPES=[
  {value:'vessel_delivery',label:'Entrega a buque',short:'Entrega a buque',hint:'Operativa normal: mercancía en almacén y transporte final al buque.'},
  {value:'storage_other',label:'Solo almacenaje / otra entrega',short:'Almacenaje / otra entrega',hint:'La mercancía queda en almacén o se entrega a otra empresa/dirección.'},
  {value:'survey_samples',label:'Survey / muestras a bordo',short:'Survey / muestras',hint:'Servicio técnico a bordo: ballast water samples, inspecciones o muestreos sin mercancía de almacén.'}
];
const serviceTypeOf=item=>item?.serviceType||item?.operationType||'vessel_delivery';
const serviceTypeMeta=item=>SERVICE_TYPES.find(type=>type.value===serviceTypeOf(item))||SERVICE_TYPES[0];
const rolesOf=value=>{
  if(Array.isArray(value))return [...new Set(value.filter(role=>ROLE_LABELS[role]))];
  if(value&&Array.isArray(value.roles))return rolesOf(value.roles);
  const role=typeof value==='string'?value:value?.role;
  return ROLE_LABELS[role]?[role]:[];
};
const hasRole=(value,role)=>rolesOf(value).includes(role);
const primaryRole=value=>['admin','finance','operations','driver'].find(role=>hasRole(value,role))||'operations';
const roleLabel=value=>rolesOf(value).map(role=>ROLE_LABELS[role]).join(' + ');
const isDriverOnly=value=>{const roles=rolesOf(value);return roles.length===1&&roles[0]==='driver'};
const personKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const samePerson=(first,second)=>Boolean(personKey(first)&&personKey(first)===personKey(second));
const vesselKey=value=>personKey(value).replace(/\b(mv|m\/v|m\.v\.|mt|m\/t|m\.t\.)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sameVessel=(first,second)=>Boolean(vesselKey(first)&&vesselKey(first)===vesselKey(second));
const cleanImo=value=>String(value||'').replace(/\D/g,'').slice(0,7);
const cleanMmsi=value=>String(value||'').replace(/\D/g,'').slice(0,9);
const vesselNameOf=value=>String(value?.name||value?.buque||value?.vessel||'').trim().toUpperCase();
const cleanVesselDisplayName=value=>String(value||'').toUpperCase().replace(/^[#:\-\s]*(ENTREGA|DELIVERY|SERVICIO|SERVICE|RECOGIDA|PICK\s*UP|COLLECT(?:ION)?|SOLICITUD|REQUEST)\s+/,'').replace(/^(MV|M\/V|MT|M\/T|MY|M\/Y|MS|M\/S|SS|VSL|VESSEL|SHIP|BUQUE|BARCO)\s+/,'').split(/\s*(?:\/\/|\||;)\s*/)[0].replace(/\s+\b(EN|AT|IN)\s+(EL\s+)?(PUERTO(\s+DE)?|PORT(\s+OF)?|ALGECIRAS|SAGUNTO|TARRAGONA|BARCELONA|VINAR[OÓ]S|VINAROS|MAR[IÍ]N|A\s+CORU[ÑN]A|VALENCIA|CASTELL[OÓ]N|MARSEILLE|BILBAO|ALICANTE|M[ÁA]LAGA|ALMER[ÍI]A|HUELVA|C[ÁA]DIZ)\b.*$/u,'').replace(/\s+\b(A\s+LA\s+MAYOR\s+BREVEDAD|ASAP|URGENTE|URGENT|PROSPECTS?\s+UPDATE|UPDATE|ACTUALIZACI[ÓO]N|PREVISI[ÓO]N|PREVISIONES|ETA|ETB|ETD)\b.*$/u,'').replace(/\s+/g,' ').replace(/^[ .,_-]+|[ .,_-]+$/g,'');
const findKnownVessel=(vessels,name)=>vessels.find(item=>sameVessel(vesselNameOf(item),name));
const normalizeVesselRecord=(record={})=>{
  const name=cleanVesselDisplayName(vesselNameOf(record));
  if(!vesselKey(name))return null;
  if(['OVERVELD','DHL','UPS','FEDEX','TNT','SEUR','MRW'].includes(name))return null;
  return {
    id:record.id||`VES-${vesselKey(name).replace(/\s+/g,'-').toUpperCase()}`,
    name,
    imo:cleanImo(record.imo),
    mmsi:cleanMmsi(record.mmsi),
    lastPort:record.lastPort||record.puerto||'',
    lastCase:record.lastCase||record.expediente||record.id||'',
    updatedAt:record.updatedAt||new Date().toISOString()
  };
};
const mergeVesselCatalog=(existing=[],cases=[])=>{
  const map=new Map();
  const put=record=>{
    const normalized=normalizeVesselRecord(record);
    if(!normalized)return;
    const key=vesselKey(normalized.name);
    const current=map.get(key)||{};
    map.set(key,{...current,...normalized,imo:normalized.imo||current.imo||'',mmsi:normalized.mmsi||current.mmsi||'',lastPort:normalized.lastPort||current.lastPort||'',lastCase:normalized.lastCase||current.lastCase||'',updatedAt:normalized.updatedAt||current.updatedAt||''});
  };
  existing.forEach(put);
  cases.forEach(item=>put({name:item.buque,imo:item.imo,mmsi:item.mmsi,lastPort:item.puerto,lastCase:item.id,updatedAt:item.portCall?.updatedAt}));
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
};
const hydrateCaseWithVessel=(item,vessels)=>{
  const vessel=findKnownVessel(vessels,item.buque);
  if(!vessel)return item;
  return {...item,imo:cleanImo(item.imo)||vessel.imo||'',mmsi:cleanMmsi(item.mmsi)||vessel.mmsi||''};
};
const upsertVesselFromCase=(vessels,item)=>mergeVesselCatalog(vessels,[item]);
const activeWarehouseEntry=entry=>!entry?.archivado&&entry?.estado!=='Expedido';
const warehouseEntryCargoSummary=entry=>{
  const lines=Array.isArray(entry?.mercancias)?entry.mercancias.filter(Boolean):[];
  if(lines.length)return lines.map(piece=>{
    const qty=Number(piece.cantidad)||1;
    const type=String(piece.tipo||'BULTO').toUpperCase();
    const weight=piece.peso?` ${String(piece.peso).toUpperCase()}`:'';
    const tracking=piece.seguimiento?` \u00B7 Tracking ${String(piece.seguimiento).toUpperCase()}`:'';
    return `${qty} ${type}${qty===1?'':'S'}${weight}${tracking}`;
  }).join(' + ');
  return `${Number(entry?.bultos)||0} BULTO${Number(entry?.bultos)===1?'':'S'}${entry?.peso?` \u00B7 ${String(entry.peso).toUpperCase()}`:''}`;
};
const warehouseEntryTypeSummary=entry=>{
  const lines=Array.isArray(entry?.mercancias)?entry.mercancias.filter(Boolean):[];
  if(lines.length)return lines.map(piece=>{
    const qty=Number(piece.cantidad)||1;
    const type=String(piece.tipo||'BULTO').trim().toUpperCase();
    return `${qty} ${type}${qty===1||type.endsWith('S')?'':'S'}`;
  }).join(' + ');
  return `${Number(entry?.bultos)||0} BULTO${Number(entry?.bultos)===1?'':'S'}`;
};
const warehouseWhatsappSummary=(entries=[],cases=[])=>{
  const active=entries.filter(activeWarehouseEntry).sort((a,b)=>String(a.buque||'').localeCompare(String(b.buque||''),'es')||(Date.parse(a.fechaRecepcion||a.fecha||a.entrada||'')||0)-(Date.parse(b.fechaRecepcion||b.fecha||b.entrada||'')||0));
  if(!active.length)return '';
  const groups=new Map();
  active.forEach(entry=>{
    const related=cases.find(item=>item.id===entry.expediente)||cases.find(item=>sameVessel(item.buque,entry.buque));
    const client=related?.cliente||'CLIENTE POR CONFIRMAR';
    const vessel=String(entry.buque||related?.buque||'SIN BUQUE').toUpperCase();
    const key=`${client}||${vessel}`;
    if(!groups.has(key))groups.set(key,{client,vessel,items:[]});
    groups.get(key).items.push(entry);
  });
  const blocks=[];
  [...groups.values()].forEach(group=>{
    blocks.push(`*${group.vessel}*`);
    group.items.forEach(entry=>blocks.push(`\u2022 ${warehouseEntryCargoSummary(entry)}`));
    blocks.push('');
  });
  return blocks.join('\n').trim();
};const warehouseEntriesForVessel=(entries,item)=>entries.filter(entry=>activeWarehouseEntry(entry)&&(entry.expediente===item.id||sameVessel(entry.buque,item.buque)));
const canAccess=(roles,id)=>{
  if(id==='correos')return hasRole(roles,'operations')||hasRole(roles,'admin');
  if(['transportes','aduanas'].includes(id))return false;
  if(isDriverOnly(roles))return ['calendario','almacen'].includes(id);
  if (['clientes','facturacion'].includes(id)) return hasRole(roles,'finance')||hasRole(roles,'admin');
  if (['usuarios','auditoria'].includes(id)) return hasRole(roles,'admin');
  return true;
};
const statusTone = value => {
  if (['Completado','Liberado','Entregado','Lista','Enviada','Preparado','Expedido'].includes(value)) return 'success';
  if (['Bloqueado','Cancelado','Urgente','Retenido','Sin asignar','Revisar','Pendiente'].includes(value)) return 'danger';
  if (['En curso','En ruta','Asignado','En stock','Borrador'].includes(value)) return 'info';
  return 'warning';
};
const money = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const numericRef=value=>Number(String(value||'').match(/(\d+)(?!.*\d)/)?.[1]||0);
const newestFirst=(left,right)=>numericRef(right.id||right.ref)-numericRef(left.id||left.ref);
const mailTimestamp=value=>{
  const text=String(value||'').trim();
  if(!text)return 0;
  const normalized=/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(text)?text.replace(' ','T'):text;
  const parsed=Date.parse(normalized);
  return Number.isFinite(parsed)?parsed:0;
};
const newestMailFirst=(left,right)=>(mailTimestamp(right.received_at)||mailTimestamp(right.created_at))-(mailTimestamp(left.received_at)||mailTimestamp(left.created_at))||(Number(right.id)||0)-(Number(left.id)||0);
const toIsoDateValue=value=>{
  const text=String(value||'').trim();
  if(!text||/confirmar|pendiente/i.test(text))return '';
  const iso=text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric=text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if(numeric){
    const year=numeric[3].length===2?`20${numeric[3]}`:numeric[3];
    return `${year}-${String(numeric[2]).padStart(2,'0')}-${String(numeric[1]).padStart(2,'0')}`;
  }
  return '';
};
const toClockValue=value=>{
  const match=String(value||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match?`${String(match[1]).padStart(2,'0')}:${match[2]}`:'';
};
const formatEtaDate=value=>{
  if(!value||/confirmar/i.test(value))return 'ETA POR CONFIRMAR';
  const iso=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[3]}/${iso[2]}/${iso[1].slice(-2)}`;
  const months={ene:'01',jan:'01',feb:'02',mar:'03',abr:'04',apr:'04',may:'05',jun:'06',jul:'07',ago:'08',aug:'08',sep:'09',oct:'10',nov:'11',dic:'12',dec:'12'};
  const text=String(value).toLowerCase();
  const match=text.match(/(\d{1,2})\s+([a-záéíóú]{3})/i);
  if(match)return `${String(match[1]).padStart(2,'0')}/${months[match[2].slice(0,3)]||'00'}/26`;
  const numeric=text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if(numeric)return `${String(numeric[1]).padStart(2,'0')}/${String(numeric[2]).padStart(2,'0')}/${numeric[3].slice(-2)}`;
  return String(value).toUpperCase();
};
const caseLabel=item=>[item.id,item.buque,formatEtaDate(item.eta),item.puerto].join(' - ').toUpperCase();
const portCallMoment=(date,time)=>date||time?`${date?formatEtaDate(date):'FECHA PENDIENTE'}${time?`  -  ${time}`:'  -  HORA PENDIENTE'}`:'POR CONFIRMAR';
const aisEstimatedEta=item=>{
  const value=item?.aisTracking?.estimatedArrivalAt;
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  return `${date.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'})}  -  ${date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}  -  AIS`;
};
const portCallSchedule=item=>{
  const call=item.portCall||{};
  const officialEta=portCallMoment(call.etaDate||(!/confirmar/i.test(item.eta||'')?item.eta:''),call.etaTime||'');
  return {
    eta:officialEta==='POR CONFIRMAR'?(aisEstimatedEta(item)||officialEta):officialEta,
    etb:portCallMoment(call.etbDate||'',call.etbTime||''),
    etd:portCallMoment(call.etdDate||'',call.etdTime||'')
  };
};
const transportSlotFromCase=item=>{
  const call=item?.portCall||{};
  const etaDate=toIsoDateValue(call.etaDate)||toIsoDateValue(item?.eta);
  const etaTime=toClockValue(call.etaTime)||toClockValue(item?.eta);
  const etbDate=toIsoDateValue(call.etbDate);
  const etbTime=toClockValue(call.etbTime);
  if(etbDate)return {date:etbDate,start:etbTime,source:'ETB'};
  if(etaDate)return {date:etaDate,start:etaTime,source:'ETA'};
  return {date:'',start:'',source:''};
};
const disabledDriverScheduleSnapshot=(data,driverName)=>{
  const result={};
  const cases=Array.isArray(data?.cases)?data.cases:[];
  const events=Array.isArray(data?.calendarEvents)?data.calendarEvents:[];
  events.forEach(event=>{
    const item=cases.find(entry=>entry.id===event.expediente);
    if(!item||item.estado==='Completado')return;
    if(event.asignado&&event.asignado!=='Sin asignar'&&event.asignado!==driverName)return;
    const call=item.portCall||{};
    result[event.id]={
      title:item.buque||event.titulo||event.expediente,
      service:event.tipoServicio||'Servicio',
      etaDate:call.etaDate||(!/confirmar/i.test(item.eta||'')?item.eta:''),
      etaTime:call.etaTime||'',
      date:event.fecha||'',
      start:event.inicio||'',
      end:event.fin||''
    };
  });
  return result;
};
const disabledChangedDriverSchedules=(previous,current)=>{
  if(!previous)return[];
  return Object.entries(current).flatMap(([id,next])=>{
    const before=previous[id];
    if(!before)return[];
    const oldEta=[before.etaDate,before.etaTime].filter(Boolean).join(' ')||'por confirmar';
    const newEta=[next.etaDate,next.etaTime].filter(Boolean).join(' ')||'por confirmar';
    const oldTask=[before.date,before.start,before.end&&`–${before.end}`].filter(Boolean).join(' ')||'sin programar';
    const newTask=[next.date,next.start,next.end&&`–${next.end}`].filter(Boolean).join(' ')||'sin programar';
    if(oldEta===newEta&&oldTask===newTask)return[];
    return[{id:`${id}-${Date.now()}`,title:next.title,service:next.service,oldEta,newEta,oldTask,newTask}];
  });
};
const DOC_TYPES=['T1','LEVANTE ADUANERO'];
const PHOTO_TYPES=['VISTA GENERAL','ETIQUETA / TRACKING','ESTADO DE EMBALAJE','DAÑOS / INCIDENCIA','PRECINTO'];
const SWIFTPORT_WAREHOUSE='ALMACÉN SWIFTPORT  -  Bluespace El Prat';
const routeParts=transport=>{
  const legacy=String(transport?.ruta||'').split(/\s*(?:→|->|\bTO\b)\s*/i).map(value=>value.trim()).filter(Boolean);
  return {
    origen:transport?.origen||legacy[0]||SWIFTPORT_WAREHOUSE,
    destino:transport?.destino||legacy[1]||'BUQUE'
  };
};
const transportRoute=transport=>{
  const {origen,destino}=routeParts(transport);
  return `${origen} → ${destino}`;
};
const escapeRegex=value=>String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const replaceLinkedVesselText=(value,previousCase,nextCase)=>{
  const text=String(value||'').trim();
  const nextName=String(nextCase?.buque||'').trim().toUpperCase();
  if(!text||!nextName)return text;
  const previousName=String(previousCase?.buque||'').trim();
  let result=text;
  if(previousName){
    result=result.replace(new RegExp(escapeRegex(previousName),'gi'),nextName);
  }
  if(/^BUQUE(?:\s+POR\s+CONFIRMAR)?(?:\s*[ - -]\s*.*)?$/i.test(result)){
    result=`BUQUE ${nextName}${nextCase?.puerto?`  -  ${nextCase.puerto}`:''}`;
  }
  return result;
};
const replaceLinkedPortText=(value,previousCase,nextCase)=>{
  const text=String(value||'').trim();
  const previousPort=String(previousCase?.puerto||'').trim();
  const nextPort=String(nextCase?.puerto||'').trim();
  if(!text||!previousPort||!nextPort||normalizePortKey(previousPort)===normalizePortKey(nextPort))return text;
  return text.replace(new RegExp(escapeRegex(previousPort),'gi'),nextPort);
};
const syncLinkedLocationWithCase=(value,previousCase,nextCase)=>replaceLinkedPortText(replaceLinkedVesselText(value,previousCase,nextCase),previousCase,nextCase);
const syncLinkedTransportWithCase=(transport,previousCase,nextCase)=>{
  const parts=routeParts(transport);
  const origen=syncLinkedLocationWithCase(parts.origen,previousCase,nextCase);
  const destino=syncLinkedLocationWithCase(parts.destino,previousCase,nextCase);
  return {...transport,origen,destino,puerto:nextCase?.puerto||transport.puerto||'',ruta:`${origen} → ${destino}`};
};
const OPERATION_STEPS=[
  {key:'review',title:'Expediente revisado',next:'Comprobar los datos del servicio y la mercancía',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'cargo',title:'Mercancía recibida o recogida',next:'Recibir en almacén o recoger en el punto indicado',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'documents',title:'Documentación del envío revisada',next:'Revisar y adjuntar la documentación antes de la entrega',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'assignment',title:'Conductor asignado',next:'Asignar o confirmar el responsable del transporte',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'delivery',title:'Entrega confirmada con POD',next:'Entregar la mercancía y registrar fotos y POD firmado',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']}
];
const STORAGE_OPERATION_STEPS=[
  {key:'review',title:'Expediente revisado',next:'Comprobar cliente, referencia y mercancía esperada',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'cargo',title:'Mercancía recibida en almacén',next:'Registrar entrada, fotos, bultos, peso y ubicación',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'documents',title:'Documentación / instrucciones revisadas',next:'Adjuntar documentos o instrucciones de retirada/entrega',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'assignment',title:'Salida o recogida coordinada',next:'Confirmar quién recoge o dónde se entregará la mercancía',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'delivery',title:'Salida de almacén confirmada',next:'Confirmar retirada/entrega con evidencia',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']}
];
const SURVEY_OPERATION_STEPS=[
  {key:'review',title:'Servicio revisado',next:'Comprobar buque, puerto, horario, cliente y alcance del muestreo',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'cargo',title:'Surveyor en camino / a bordo',next:'Confirmar asistencia al buque y acceso a bordo',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'documents',title:'Instrucciones y documentos revisados',next:'Adjuntar orden de servicio, instrucciones o formularios de muestreo',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'assignment',title:'Responsable asignado',next:'Asignar o confirmar quién realizará el servicio',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'delivery',title:'Muestreo / survey completado',next:'Confirmar servicio realizado con fotos, notas o informe',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']}
];
const isStorageOnly=item=>serviceTypeOf(item)==='storage_other';
const isSurveyService=item=>serviceTypeOf(item)==='survey_samples';
const isSurveyWarehouseEntry=(entry,cases=[])=>Boolean(entry?.hiddenFromWarehouse||cases.some(item=>item.id===entry?.expediente&&isSurveyService(item)));
const operationStepsFor=item=>isSurveyService(item)?SURVEY_OPERATION_STEPS:isStorageOnly(item)?STORAGE_OPERATION_STEPS:OPERATION_STEPS;
const canCompleteOperationStep=()=>true;
const operationFlow=item=>{
  if(item.operationalFlow){const stored=item.operationalFlow;const delivery=Boolean(stored.delivery||stored.pod);const assigned=Boolean(item.conductor&&item.conductor!=='Sin asignar');return {review:Boolean(stored.review),cargo:Boolean(stored.cargo),documents:Boolean(stored.documents),assignment:Boolean(stored.assignment||assigned),delivery,billingReady:Boolean(stored.billingReady||delivery),...stored,review:Boolean(stored.review||stored.cargo||stored.documents||stored.delivered||stored.pod||stored.delivery),assignment:Boolean(stored.assignment||assigned),delivery,billingReady:Boolean(stored.billingReady||delivery)}};
  const progress=Number(item.progreso)||0;
  const completed=item.estado==='Completado'||progress>=100;
  return {review:progress>=25,cargo:progress>=50,documents:progress>=75,assignment:completed||Boolean(progress>=75&&item.conductor&&item.conductor!=='Sin asignar'),delivery:completed,billingReady:completed};
};
const operationProgress=item=>{
  const flow=operationFlow(item);
  const steps=operationStepsFor(item);
  return Math.round(steps.filter(step=>flow[step.key]).length/steps.length*100);
};
const nextOperationStep=item=>operationStepsFor(item).find(step=>!operationFlow(item)[step.key])||null;
const normalizeMerchandise=item=>{
  const count=Math.max(0,Number(item.bultos)||0);
  const existing=Array.isArray(item.mercancias)?item.mercancias:[];
  const lines=existing.length?existing.map((piece,index)=>({
    ...piece,
    id:piece.id||`${item.id}-M${index+1}`,
    tipo:piece.tipo==='PAQUETE'?'CAJA':piece.tipo||'CAJA',
    cantidad:Number(piece.cantidad)||1,
    seguimiento:piece.seguimiento||'',
    documentos:piece.documentos||[]
  })):(count?[{id:`${item.id}-M1`,tipo:'CAJA',cantidad:count,seguimiento:'',peso:item.peso||'POR REGISTRAR',documentos:[]}]:[]);
  const bultos=lines.reduce((sum,line)=>sum+Number(line.cantidad||0),0);
  const normalized={...item,bultos,mercancias:lines,documentacionMercancia:{
    alcance:'individual',
    tipoAduanero:'',
    aduaneroDisponible:false,
    podDisponible:false,
    ...(item.documentacionMercancia||{})
  },operationalFlow:operationFlow(item)};
  const progress=operationProgress(normalized);
  const next=nextOperationStep(normalized);
  const completed=Boolean(normalized.operationalFlow.billingReady||progress>=100||normalized.estado==='Completado');
  const cancelled=normalized.estado==='Cancelado';
  const cancellationBillable=(normalized.billingAdjustments||[]).some(line=>String(line?.id||'').startsWith('cancel-')&&Number(line?.price)>0);
  return {...normalized,estado:cancelled?'Cancelado':completed?'Completado':normalized.estado,progreso:cancelled?progress:completed?100:progress,siguiente:cancelled?(cancellationBillable?'Cancelado · listo para facturar gastos':'Cancelado · revisar si corresponde facturar'):completed?'Listo para facturar':next?.next||item.siguiente};
};
const numericWeight=value=>{const raw=String(value||'').replace(/[^\d.,]/g,'');if(raw.includes(',')&&raw.includes('.'))return Number(raw.replace(/\./g,'').replace(',','.'))||0;if(raw.includes(','))return Number(raw.replace(',','.'))||0;return Number(raw)||0};
const merchandiseWeight=lines=>(lines||[]).reduce((sum,line)=>sum+numericWeight(line.peso),0);
const merchandiseCount=lines=>(lines||[]).reduce((sum,line)=>sum+(Number(line.cantidad)||0),0);
const merchandiseWeightLabel=lines=>`${merchandiseWeight(lines).toLocaleString('es-ES',{maximumFractionDigits:2})} kg`;
const moneyExact=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
const invoiceLineTotal=line=>(Number(line.price)||0)*(Number(line.units)||0);
const asArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
const invoiceLinesOf=value=>asArray(value).flatMap(line=>Array.isArray(line)?line:[line]).filter(line=>line&&typeof line==='object');
const invoiceText=value=>['string','number'].includes(typeof value)?String(value):'';
const invoiceLineForEditor=(line,index=0)=>({...(line&&typeof line==='object'?line:{}),id:invoiceText(line?.id)||`line-${index+1}`,item:invoiceText(line?.item||line?.concepto)||'SERVICIO',detail:invoiceText(line?.detail||line?.detalle),price:Number(line?.price??line?.precio)||0,units:Number(line?.units??line?.unidades)||1,tax:invoiceText(line?.tax||line?.iva)||'0%'});
const invoiceTotal=invoice=>invoiceLinesOf(invoice?.lines).reduce((sum,line)=>sum+invoiceLineTotal(line),0);
const expenseAmount=value=>{const clean=String(value??'').replace(/\s/g,'').replace(/[^\d,.-]/g,'');if(clean.includes(',')&&clean.includes('.'))return Number(clean.replace(/\./g,'').replace(',','.'))||0;if(clean.includes(','))return Number(clean.replace(',','.'))||0;return Number(clean)||0};
const caseExpenses=item=>Array.isArray(item?.gastos)?item.gastos:[];
const caseExpenseTotal=item=>caseExpenses(item).reduce((sum,expense)=>sum+expenseAmount(expense.importe),0);
const invoiceRevenue=item=>Number(item?.importe||invoiceTotal(item)||0);
const invoiceFinalRevenue=item=>item?.holdedBilledVerified===true&&item?.holdedPriceVerified===true&&item?.holdedInvoicedAmount!=null?Number(item.holdedInvoicedAmount):invoiceRevenue(item);
const invoiceMargin=(invoice,relatedCase)=>invoiceRevenue(invoice)-caseExpenseTotal(relatedCase);
const LIMANI_BARCELONA_RATES={
  reception:[[35,15],[250,60],[500,130],[2500,245]],
  storage:[[Infinity,0]],
  airportToWarehouse:[[35,60],[250,145],[500,260],[2500,350]],
  warehouseToVessel:[[35,45],[250,95],[500,250],[2500,350]],
  forkliftHour:50,
  craneHour:150,
  waitingHour:30,
  handlingHour:25,
  overtimeSurcharge:0.3
};
const ALS_BARCELONA_RATES={
  loadUnloadPerKg:0.12,
  freeStorageDays:3,
  storage:[[35,0],[100,2.5],[500,3.5],[Infinity,7.5]],
  airportToWarehouse:[[35,60],[250,120],[500,230],[2500,370]],
  warehouseToVessel:[[35,49],[250,115],[500,220],[2500,320]],
  overtimeSurcharge:0.3
};
const UME_ALGECIRAS_RATES={
  coordination:66,
  openFile:9.9,
  openWarehouseNightHoliday:132,
  minHandlingOver50:19.8,
  handlingPerKg:0.0363,
  minWarehousing:9.9,
  warehousingPerKg:0.715,
  storageMinimum:99,
  hazardousOvercharge:71.5,
  pickUpSmallParcels:36.3,
  deliveryToVesselUnder50:71.5,
  deliveryOver50PerHour:71.5,
  customClearanceC:36.3,
  customT1Ex1:36.3,
  receptionT1Avi:71.5,
  transitExs:48.4,
  instancia:44,
  dae:36.3,
  cub:26.4,
  lsp:26.4,
  importExportIssueDocs:42.9,
  weekendWarehouseOpening:374,
  transportAgpXrjNextDay:154,
  urgentSameDay:225.5,
  nightWeekendTransport:253,
  transportFromSvq:275,
  urgentFromSvq:396,
  docsCessionDhl:121,
  docsCessionTnt:154,
  pickup010:104.5,
  pickup1150:176,
  overtimeSurcharge:0.3
};
const OCA_SURVEY_RATES={
  baseHours:4,
  basePrice:200,
  extraHourPrice:30
};
const priceByWeight=(weight,table)=>{const kilos=Number(weight)||0;const match=table.find(([max])=>kilos<=max);return match?match[1]:table.at(-1)?.[1]||0};
const isLimaniCase=item=>/limani/i.test(String(item?.cliente||''));
const isStorageInvoiceLine=line=>{
  const label=String(line?.item||line?.label||line?.concepto||'').toUpperCase();
  const id=String(line?.id||'').toUpperCase();
  if(/TRANSPORT|TRANSPORTE|DELIVERY|ENTREGA/.test(label))return false;
  return /STORAGE|WAREHOUSE|ALMACENAJE|ALMAC[EÉ]N/.test(`${id} ${label}`);
};
const enforceLimaniFreeStorageLines=(lines,item)=>isLimaniCase(item)?invoiceLinesOf(lines).map(line=>isStorageInvoiceLine(line)?{...line,price:0}:line):invoiceLinesOf(lines);
const isAlsCase=item=>/\bals\b/i.test(String(item?.cliente||''));
const isUmeAlgecirasCase=item=>/\bume\b/i.test(String(item?.cliente||''))&&/algeciras/i.test(String(item?.puerto||''));
const isOcaCase=item=>/\boca\b/i.test(String(item?.cliente||''));
const invoiceCargoLines=(item,warehouseEntries=[])=>{
  const linkedWarehouse=warehouseEntries.filter(entry=>entry.expediente===item.id);
  const warehouseLines=linkedWarehouse.flatMap(entry=>(entry.mercancias||[]).length?entry.mercancias:[{tipo:'CAJA',cantidad:Number(entry.bultos)||0,peso:entry.peso||''}]).filter(line=>Number(line.cantidad)>0);
  return warehouseLines.length?warehouseLines:(item.mercancias||[]);
};
const invoiceCargoWeight=(item,warehouseEntries=[])=>{
  const lines=invoiceCargoLines(item,warehouseEntries);
  const weight=merchandiseWeight(lines);
  if(weight>0)return weight;
  return numericWeight(item.peso);
};
const parseWarehouseMoment=value=>{
  if(!value)return null;
  const normalized=String(value).replace(' - ',' ').trim();
  const direct=new Date(normalized.replace(' ','T'));
  if(!Number.isNaN(direct.getTime()))return direct;
  const numeric=normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if(numeric){
    const year=Number(numeric[3])<100?2000+Number(numeric[3]):Number(numeric[3]);
    const date=new Date(year,Number(numeric[2])-1,Number(numeric[1]),0,0,0,0);
    if(numeric[4])date.setHours(Number(numeric[4])||0,Number(numeric[5])||0,0,0);
    return Number.isNaN(date.getTime())?null:date;
  }
  const months={ene:0,jan:0,feb:1,mar:2,abr:3,apr:3,may:4,jun:5,jul:6,ago:7,aug:7,sep:8,oct:9,nov:10,dic:11,dec:11};
  const match=normalized.toLowerCase().match(/(\d{1,2})\s+([a-z\u00e1\u00e9\u00ed\u00f3\u00fa]{3,})\s*(\d{1,2}:\d{2})?/i);
  if(!match)return null;
  const date=new Date(new Date().getFullYear(),months[match[2].slice(0,3)]??0,Number(match[1]),0,0,0,0);
  if(match[3]){const [hour,minute]=match[3].split(':').map(Number);date.setHours(hour||0,minute||0,0,0)}
  return date;
};
const dayStart=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
const calendarDaysBetween=(start,end=new Date())=>Math.max(0,Math.floor((dayStart(end)-dayStart(start))/86400000));
const WAREHOUSE_FLOOR_M2=75;
const EURO_PALLET_FLOOR_M2=.96;
const WAREHOUSE_PALLET_CAPACITY=30;
const WAREHOUSE_OPERATIONAL_M2=WAREHOUSE_PALLET_CAPACITY*EURO_PALLET_FLOOR_M2;
const floorNumber=value=>Math.max(0,Number(String(value??'').replace(',','.'))||0);
const isPalletCargoType=value=>/^(?:EURO\s*)?PALL?ETS?$/.test(String(value||'').trim().toUpperCase());
const warehouseDeclaredPallets=entry=>(entry.mercancias||[]).filter(line=>isPalletCargoType(line.tipo)).reduce((sum,line)=>sum+floorNumber(line.cantidad),0);
const warehousePalletPositions=entry=>{
  const mode=entry.spaceType||'auto';
  if(mode==='none'||mode==='long')return 0;
  if(mode==='pallet')return floorNumber(entry.spacePositions);
  return warehouseDeclaredPallets(entry);
};
const warehouseLongFloorArea=entry=>(entry.spaceType||'auto')==='long'?floorNumber(entry.spacePositions)*floorNumber(entry.spaceLength||3)*floorNumber(entry.spaceWidth||1):0;
const warehouseFloorArea=entry=>warehousePalletPositions(entry)*EURO_PALLET_FLOOR_M2+warehouseLongFloorArea(entry);
const warehouseOccupancyLabel=entry=>{
  const pallets=warehousePalletPositions(entry);
  const longArea=warehouseLongFloorArea(entry);
  if(pallets)return `${pallets.toLocaleString('es-ES',{maximumFractionDigits:1})} pallet${pallets===1?'':'s'} computable${pallets===1?'':'s'}`;
  if(longArea)return `Material largo · ${longArea.toLocaleString('es-ES',{maximumFractionDigits:2})} m² computables`;
  return 'No computa · cajas, paquetes o bultos';
};
const warehouseOccupancyPercent=area=>area/WAREHOUSE_OPERATIONAL_M2*100;
const warehouseEntryDates=entry=>{
  const start=parseWarehouseMoment(entry.fechaRecepcion||entry.entrada);
  if(!start)return null;
  let end=parseWarehouseMoment(entry.salida);
  if(!end&&(entry.archivado||entry.estado==='Expedido')){
    const days=floorNumber(entry.dias);
    end=new Date(start.getTime()+days*86400000);
  }
  return {start,end};
};
const warehouseMonthlyOccupancy=entries=>{
  const windows=entries.map(entry=>({entry,dates:warehouseEntryDates(entry)})).filter(item=>item.dates);
  const today=new Date();
  const first=windows.length?new Date(Math.min(...windows.map(item=>item.dates.start.getTime()))):today;
  const start=new Date(Math.max(dayStart(first),dayStart(today)-729*86400000));
  const daily=[];
  for(let stamp=dayStart(start);stamp<=dayStart(today);stamp+=86400000){
    const dayEnd=stamp+86400000-1;
    const area=windows.filter(({dates})=>dates.start.getTime()<=dayEnd&&(!dates.end||dates.end.getTime()>=stamp)).reduce((sum,{entry})=>sum+warehouseFloorArea(entry),0);
    daily.push({date:new Date(stamp),percent:warehouseOccupancyPercent(area)});
  }
  const groups=new Map();
  daily.forEach(day=>{const key=`${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,'0')}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(day)});
  return [...groups.entries()].map(([key,days])=>({key,label:days[0].date.toLocaleDateString('es-ES',{month:'short',year:'numeric'}).replace('.',''),average:days.reduce((sum,day)=>sum+day.percent,0)/days.length,max:Math.max(...days.map(day=>day.percent)),over30:days.filter(day=>day.percent>=30).length,over70:days.filter(day=>day.percent>=70).length,over100:days.filter(day=>day.percent>=100).length,days:days.length})).slice(-12).reverse();
};
const invoiceWarehouseEntries=(item,warehouseEntries=[])=>warehouseEntries.filter(entry=>entry.expediente===item.id);
const storageDaysForEntry=(entry,item)=>{
  const manual=Number(entry.dias);
  const start=parseWarehouseMoment(entry.fechaRecepcion||entry.entrada);
  if(!start)return manual>0?manual:0;
  const end=parseWarehouseMoment(entry.salida)||(entry.archivado||entry.estado==='Expedido'?new Date():new Date());
  return calendarDaysBetween(start,end);
};
const invoiceStorageDays=(item,warehouseEntries=[])=>{
  const linked=invoiceWarehouseEntries(item,warehouseEntries);
  const manual=Number(item.billing?.storageDays)||0;
  if(!linked.length)return manual;
  return Math.max(manual,...linked.map(entry=>storageDaysForEntry(entry,item)));
};
const invoiceCargoSummary=(item,warehouseEntries=[])=>{
  const lines=invoiceCargoLines(item,warehouseEntries);
  if(lines.length){
    return lines.map(line=>{
      const qty=Number(line.cantidad)||0;
      const type=String(line.tipo||'BOX').toUpperCase().replace('CAJA','BOX').replace('CAJAS','BOX').replace('PALLET','PALLET').replace('SOBRE','ENVELOPE');
      const label=type==='BOX'?`BOX${qty===1?'':'ES'}`:type==='PALLET'?`PALLET${qty===1?'':'S'}`:type==='ENVELOPE'?`ENVELOPE${qty===1?'':'S'}`:type;
      const weight=numericWeight(line.peso);
      return `${qty} ${label}${weight?` ${weight.toLocaleString('es-ES',{maximumFractionDigits:1})} KGS`:''}`;
    }).join(' + ').toUpperCase();
  }
  if(item.resumenMercancia)return String(item.resumenMercancia).toUpperCase();
  return `${Number(item.bultos)||1} BOX${Number(item.bultos)===1?'':'ES'}${item.peso&&!/pendiente|registrar/i.test(item.peso)?` ${String(item.peso).toUpperCase()}`:''}`;
};
const invoiceScheduleLabel=(item,transports=[],calendarEvents=[])=>{
  const call=item?.portCall||{};
  const dates=[
    ['ETA',call.etaDate||item?.etaDate||(!/confirmar/i.test(String(item?.eta||''))?item.eta:'')],
    ['ETB',call.etbDate||item?.etbDate||item?.etb],
    ['ETD',call.etdDate||item?.etdDate||item?.etd]
  ];
  for(const [source,value] of dates){
    const date=toIsoDateValue(value);
    if(date)return source==='ETA'?formatEtaDate(date):`${source} ${formatEtaDate(date)}`;
  }
  const caseId=item?.id;
  const linked=[
    ...(transports||[]).filter(entry=>entry.expediente===caseId&&!/cancel|anulad/i.test(String(entry.estado||''))),
    ...(calendarEvents||[]).filter(entry=>entry.expediente===caseId&&(entry.transporte||String(entry.tipoServicio||'').toLowerCase().startsWith('transporte')))
  ].map(entry=>({date:toIsoDateValue(entry.fecha||entry.date||entry.transportDate),completed:/entregado|completado|realizado|finalizado/i.test(String(entry.estado||''))})).filter(entry=>entry.date);
  const completed=linked.filter(entry=>entry.completed);
  const candidates=(completed.length?completed:linked).sort((a,b)=>b.date.localeCompare(a.date));
  return candidates[0]?`TRANSPORTE ${formatEtaDate(candidates[0].date)}`:'FECHA POR CONFIRMAR';
};
const purchaseOrderOf=item=>String(item?.purchaseOrder||item?.poNumber||'').trim().toUpperCase();
const withPurchaseOrderSuffix=(value,item)=>{
  const text=String(value||'').trim().replace(/\s+POD\s*$/i,'');
  const purchaseOrder=purchaseOrderOf(item);
  if(!text||!purchaseOrder)return text;
  return text.toUpperCase().endsWith(' '+purchaseOrder)?text:text+' '+purchaseOrder;
};
const ensurePurchaseOrderReferenceLines=(lines,item)=>{
  let referenceUpdated=false;
  return invoiceLinesOf(lines).map(line=>{
    const isReference=String(line?.id||'').toLowerCase()==='ref'||(!referenceUpdated&&/^SW-\d{4}-\d+/i.test(String(line?.item||'')));
    if(!purchaseOrderOf(item)||!isReference)return line;
    referenceUpdated=true;
    return {...line,item:withPurchaseOrderSuffix(line.item,item)};
  });
};
const invoiceHeaderTitle=(item,transports=[],calendarEvents=[])=>withPurchaseOrderSuffix([item.id,item.buque,invoiceScheduleLabel(item,transports,calendarEvents),item.puerto].filter(Boolean).join(' ').toUpperCase(),item);
const suggestedTransportPrice=(item,warehouseEntries=[],route='warehouseToVessel')=>{
  const weight=invoiceCargoWeight(item,warehouseEntries);
  if(isLimaniCase(item)){
    const table=route==='airportToWarehouse'?LIMANI_BARCELONA_RATES.airportToWarehouse:LIMANI_BARCELONA_RATES.warehouseToVessel;
    return priceByWeight(weight,table);
  }
  return 0;
};
const suggestedReceptionPrice=(item,warehouseEntries=[])=>{
  const weight=invoiceCargoWeight(item,warehouseEntries);
  if(isLimaniCase(item))return priceByWeight(weight,LIMANI_BARCELONA_RATES.reception);
  return 0;
};
const suggestedHandlingPrice=(item,warehouseEntries=[])=>{
  const weight=invoiceCargoWeight(item,warehouseEntries);
  if(isLimaniCase(item))return weight>0?LIMANI_BARCELONA_RATES.handlingHour:0;
  return 0;
};
const suggestedStoragePrice=()=>0;
const suggestedWaitingPrice=item=>isLimaniCase(item)?LIMANI_BARCELONA_RATES.waitingHour:0;
const umeHandlingPrice=weight=>{
  const kilos=Number(weight)||0;
  if(kilos<=0)return 0;
  const variable=Math.round(kilos*UME_ALGECIRAS_RATES.handlingPerKg*100)/100;
  return kilos>50?Math.max(UME_ALGECIRAS_RATES.minHandlingOver50,variable):variable;
};
const umeStorageTotal=(weight,days)=>{
  const kilos=Number(weight)||0;
  const storageDays=Number(days)||0;
  if(kilos<=0||storageDays<=0)return 0;
  const daily=Math.max(UME_ALGECIRAS_RATES.minWarehousing,Math.round(kilos*UME_ALGECIRAS_RATES.warehousingPerKg*100)/100);
  return Math.max(UME_ALGECIRAS_RATES.storageMinimum,Math.round(daily*storageDays*100)/100);
};
const umeStorageDailyPrice=weight=>{
  const kilos=Number(weight)||0;
  if(kilos<=0)return UME_ALGECIRAS_RATES.minWarehousing;
  return Math.max(UME_ALGECIRAS_RATES.minWarehousing,Math.round(kilos*UME_ALGECIRAS_RATES.warehousingPerKg*100)/100);
};
const umeTransportPrice=weight=>{
  const kilos=Number(weight)||0;
  if(kilos<=0)return UME_ALGECIRAS_RATES.deliveryToVesselUnder50;
  return kilos<50?UME_ALGECIRAS_RATES.deliveryToVesselUnder50:UME_ALGECIRAS_RATES.deliveryOver50PerHour;
};
const umeAlgecirasCustomsLabel=item=>String(item?.billing?.customsType||'').toLowerCase().includes('t1')?'CUSTOMS CLEARANCE T-1':'CUSTOMS CLEARANCE';
const umeAlgecirasCustomsPrice=item=>String(item?.billing?.customsType||'').toLowerCase().includes('t1')?UME_ALGECIRAS_RATES.customT1Ex1:UME_ALGECIRAS_RATES.customClearanceC;
const hasRouteKeyword=(records=[],pattern)=>records.some(record=>pattern.test(`${record?.recogida||''} ${record?.entrega||''} ${record?.ruta||''} ${record?.observacion||''}`));
const umeAlgecirasLines=(item,warehouseEntries=[],transports=[],calendarEvents=[],options={})=>{
  const cargo=invoiceCargoSummary(item,warehouseEntries);
  const weight=invoiceCargoWeight(item,warehouseEntries);
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const transportServices=invoiceTransportServices(item,transports,calendarEvents);
  const hasRecordedTransport=(transports||[]).some(entry=>entry.expediente===item.id)||(calendarEvents||[]).some(entry=>entry.expediente===item.id&&isTransportCalendarEvent(entry));
  const billOwnTransport=!isStorageOnly(item)&&(transportServices.length>0||(!hasRecordedTransport&&((item.servicios||[]).some(service=>/transporte|entrega|delivery/i.test(String(service)))||Number(item.billing?.transportPrice||0)>0)));
  const routeRecords=[...transportServices,...(transports||[]).filter(entry=>entry.expediente===item.id&&!isCancelledTransport(entry))];
  const lines=[];
  if(options.includeRef)lines.push({id:'ref',item:invoiceHeaderTitle(item,transports,calendarEvents),detail:cargo,price:0,units:1,tax:'21%'});
  if(item.billing?.openFile)lines.push({id:'open-file',item:'OPEN FILE',detail:invoiceHeaderTitle(item,transports,calendarEvents),price:UME_ALGECIRAS_RATES.openFile,units:1,tax:'0%'});
  if(item.billing?.docsCessionDhl||hasRouteKeyword(routeRecords,/dhl/i))lines.push({id:'docs-cession-dhl',item:'DOC CESSION DHL',detail:cargo,price:UME_ALGECIRAS_RATES.docsCessionDhl,units:1,tax:'0%'});
  if(item.billing?.docsCessionTnt||hasRouteKeyword(routeRecords,/tnt/i))lines.push({id:'docs-cession-tnt',item:'DOC CESSION TNT',detail:cargo,price:UME_ALGECIRAS_RATES.docsCessionTnt,units:1,tax:'0%'});
  if(item.billing?.airportExpenses)lines.push({id:'airport-expenses',item:'ARRIVAL EXPENSES AIRPORT',detail:cargo,price:Number(item.billing.airportExpenses)||0,units:1,tax:'0%'});
  if(item.billing?.airportAgency)lines.push({id:'airport-agency',item:'AGENCY & CLEARANCE AIRPORT',detail:cargo,price:Number(item.billing.airportAgency)||0,units:1,tax:'0%'});
  if(hasRouteKeyword(routeRecords,/\bAGP\b|MALAGA|MÁLAGA|AIRPORT|AEROPUERTO/i))lines.push({id:'transport-agp',item:'TRANSPORT FROM AGP TO WAREHOUSE',detail:cargo,price:UME_ALGECIRAS_RATES.transportAgpXrjNextDay,units:1,tax:'0%'});
  if(hasRouteKeyword(routeRecords,/\bSVQ\b|SEVILLA/i))lines.push({id:'transport-svq',item:'TRANSPORT FROM SVQ TO WAREHOUSE',detail:cargo,price:UME_ALGECIRAS_RATES.transportFromSvq,units:1,tax:'0%'});
  lines.push({id:'load-unload',item:'LOAD / UNLOAD',detail:cargo,price:umeHandlingPrice(weight),units:1,tax:'0%'});
  if(storageDays>0)lines.push({id:'warehouse',item:'WAREHOUSE',detail:`${storageDays} DAY${storageDays===1?'':'S'} - ${cargo}`,price:umeStorageTotal(weight,storageDays),units:1,tax:'0%'});
  if(item.billing?.customsClearance!==false)lines.push({id:'customs',item:umeAlgecirasCustomsLabel(item),detail:cargo,price:umeAlgecirasCustomsPrice(item),units:1,tax:'0%'});
  if(item.billing?.customsType&&String(item.billing.customsType).toLowerCase().includes('t1'))lines.push({id:'reception-t1',item:'RECEPTION T1-1 (AVI)',detail:cargo,price:UME_ALGECIRAS_RATES.receptionT1Avi,units:1,tax:'0%'});
  if(billOwnTransport){
    const transportUnits=Math.max(1,transportServices.length);
    lines.push({id:'delivery-vessel',item:'DELIVERY VESSEL ALGECIRAS PORT',detail:invoiceTransportDetail(cargo,item,transports,calendarEvents),price:umeTransportPrice(weight),units:transportUnits,tax:'0%'});
  }
  if(item.billing?.openWarehouseNightHoliday)lines.push({id:'open-warehouse-night',item:'OPEN WAREHOUSE NIGHT/BANK HOLIDAYS',detail:cargo,price:UME_ALGECIRAS_RATES.openWarehouseNightHoliday,units:1,tax:'0%'});
  if(Number(item.billing?.waitingHours||0)>0)lines.push({id:'waiting',item:'WAITING TIME',detail:`${item.billing.waitingHours} HOURS WAITING`,price:UME_ALGECIRAS_RATES.deliveryOver50PerHour,units:Number(item.billing.waitingHours),tax:'0%'});
  (item.billingAdjustments||[]).filter(entry=>Number(entry.price)>0).forEach(entry=>lines.push({...entry,tax:entry.tax||'0%'}));
  (item.billing?.algecirasExtras||[]).forEach((extra,index)=>{
    lines.push({id:extra.id||`algeciras-extra-${index}`,item:String(extra.item||extra.concepto||'EXTRA SERVICE').toUpperCase(),detail:String(extra.detail||cargo).toUpperCase(),price:Number(extra.price||extra.importe)||0,units:Number(extra.units||extra.unidades)||1,tax:extra.tax||'0%'});
  });
  return lines;
};

const invoiceLineCargoText=(lines=[])=>{
  const values=(lines||[]).map(line=>String(line?.detail||'').trim()).filter(Boolean);
  const preferred=values.find(value=>/\d+(?:[.,]\d+)?\s*KGS?\b/i.test(value)&&/\b(BOX|BOXES|CAJA|CAJAS|PALLET|PALLETS|BULTO|BULTOS|SOBRE|SOBRES)\b/i.test(value));
  return preferred||values.find(value=>/\b(BOX|BOXES|CAJA|CAJAS|PALLET|PALLETS|BULTO|BULTOS|SOBRE|SOBRES)\b/i.test(value))||'';
};
const invoiceLinesWeight=(lines=[])=>{
  const detail=invoiceLineCargoText(lines).replace(/,/g,'.');
  if(!detail)return 0;
  return [...detail.matchAll(/(\d+(?:\.\d+)?)\s*KGS?\b/gi)].reduce((sum,match)=>sum+(Number(match[1])||0),0);
};
const invoiceLinesCargoSummary=(lines=[])=>{
  const detail=invoiceLineCargoText(lines);
  return detail?detail.toUpperCase():'';
};
const invoiceTariffConceptOptions=(item,warehouseEntries=[],transports=[],calendarEvents=[],manual={})=>{
  if(!item)return [];
  const baseCargo=invoiceCargoSummary(item,warehouseEntries);
  const cargo=manual.manualCargo||baseCargo;
  const weight=Number(manual.manualWeight)||invoiceCargoWeight(item,warehouseEntries);
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const transportServices=invoiceTransportServices(item,transports,calendarEvents);
  const transportUnits=Math.max(1,transportServices.length||invoiceTransportUnits(item,transports,calendarEvents)||1);
  const make=(id,label,itemName,detail,price,units=1,tax='0%')=>({id:`tariff-${id}`,label,item:itemName,detail:String(detail||cargo).toUpperCase(),price:Number(price)||0,units:Number(units)||1,tax});
  if(isUmeAlgecirasCase(item)){
    return [
      make('ume-load-unload','LOAD / UNLOAD','LOAD / UNLOAD',cargo,umeHandlingPrice(weight)),
      make('ume-warehouse','WAREHOUSE / STORAGE','WAREHOUSE',`${Math.max(storageDays,1)} DAYS - ${cargo}`,umeStorageDailyPrice(weight),Math.max(storageDays,1)),
      make('ume-customs','CUSTOMS CLEARANCE','CUSTOMS CLEARANCE',cargo,umeAlgecirasCustomsPrice(item)),
      make('ume-delivery','DELIVERY VESSEL ALGECIRAS PORT','DELIVERY VESSEL ALGECIRAS PORT',`${transportUnits} TRANSPORTES - ${cargo}`,umeTransportPrice(weight,transportUnits),transportUnits),
      make('ume-extra','EXTRA SERVICE','EXTRA SERVICE',cargo,0)
    ];
  }
  if(isAlsCase(item)){
    return [
      make('als-unload','UNLOAD (RECEPTION)','UNLOAD (RECEPTION)',cargo,Number((weight*ALS_BARCELONA_RATES.unloadPerKg).toFixed(2))),
      make('als-storage','STORAGE','STORAGE',`${Math.max(storageDays,1)} DAYS - ${cargo}`,Number((Math.max(storageDays-ALS_BARCELONA_RATES.freeStorageDays,0)*storagePriceByWeight(weight,ALS_BARCELONA_RATES.storageTiers)).toFixed(2)),Math.max(storageDays-ALS_BARCELONA_RATES.freeStorageDays,0)),
      make('als-load','LOAD (SALIDA)','LOAD (SALIDA)',cargo,Number((weight*ALS_BARCELONA_RATES.loadPerKg).toFixed(2))),
      make('als-transport','TRANSPORT','TRANSPORT',invoiceTransportDetail(item,transports,calendarEvents)||cargo,0),
      make('als-extra','EXTRA SERVICE','EXTRA SERVICE',cargo,0)
    ];
  }
  if(isLimaniCase(item)){
    return [
      make('limani-reference','REFERENCIA EXPEDIENTE',invoiceReferenceLine(item),cargo,0,1,'21%'),
      make('limani-reception','RECEPTION','RECEPTION',cargo,suggestedReceptionPrice(item,warehouseEntries)),
      make('limani-handling','HANDLING','HANDLING',cargo,suggestedHandlingPrice(item,warehouseEntries)),
      make('limani-storage','STORAGE','STORAGE',`${Math.max(storageDays,0)} DAYS - ${cargo}`,suggestedStoragePrice(item,warehouseEntries),Math.max(storageDays,0)),
      make('limani-transport','TRANSPORT FROM WAREHOUSE TO VESSEL','TRANSPORT FROM WAREHOUSE TO VESSEL',invoiceTransportDetail(item,transports,calendarEvents)||cargo,suggestedTransportPrice(item,warehouseEntries,transports,calendarEvents),transportUnits),
      make('limani-waiting','WAITING TIME','WAITING TIME',`${Number(item.billing?.waitingHours||1)} HOURS WAITING`,suggestedWaitingPrice(item),Number(item.billing?.waitingHours||1)),
      make('limani-extra','EXTRA SERVICE','EXTRA SERVICE',cargo,0)
    ];
  }
  return [
    make('manual-reference','REFERENCIA EXPEDIENTE',invoiceReferenceLine(item),cargo,0,1,'21%'),
    make('manual-reception','RECEPTION','RECEPTION',cargo,0),
    make('manual-handling','HANDLING','HANDLING',cargo,0),
    make('manual-storage','STORAGE','STORAGE',`${Math.max(storageDays,0)} DAYS - ${cargo}`,0,Math.max(storageDays,0)),
    make('manual-transport','TRANSPORT','TRANSPORT',invoiceTransportDetail(item,transports,calendarEvents)||cargo,0,transportUnits),
    make('manual-extra','EXTRA SERVICE','EXTRA SERVICE',cargo,0)
  ];
};
const supplierConceptLabel=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const supplierLineAmount=rawLine=>{
  const matches=[...String(rawLine||'').matchAll(/(\d{1,6}(?:[.,]\d{1,2}))\s*(?:EUR|€)?/gi)];
  if(!matches.length)return 0;
  return Number(matches[matches.length-1][1].replace(',','.'))||0;
};
const supplierCargoFromLine=rawLine=>{
  const match=String(rawLine||'').replace(/\s+/g,' ').trim().match(/(\d+(?:[.,]\d+)?)\s*(PC|PCS|PIECE|PIECES|BOX|BOXES|PALLET|PALLETS|BULTO|BULTOS|CAJA|CAJAS)\s+(\d+(?:[.,]\d+)?)\s*KGS?/i);
  if(!match)return '';
  const qtyNumber=Number(String(match[1]).replace(',','.'))||0;
  const qty=String(match[1]).replace('.',',').replace(/,0$/,'');
  const baseUnit=/PC|PIECE|BOX|CAJA/i.test(match[2])?'BOX':/PALLET/i.test(match[2])?'PALLET':'BULTO';
  const unit=qtyNumber===1?baseUnit:`${baseUnit}S`;
  const weight=String(match[3]).replace('.',',').replace(/,0$/,'');
  return `${qty} ${unit} ${weight} KGS`.toUpperCase();
};
const supplierCargoWeight=detail=>{
  const matches=[...String(detail||'').matchAll(/(\d+(?:[.,]\d+)?)\s*KGS?\b/gi)];
  return matches.reduce((sum,match)=>sum+(Number(String(match[1]).replace(',','.'))||0),0);
};
const supplierServiceDate=rawLine=>{
  const match=String(rawLine||'').match(/\b(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\b/);
  return match?match[1]:'';
};
const supplierConceptLine=(rawLine,item,warehouseEntries=[],transports=[],calendarEvents=[],index=0,contextCargo='')=>{
  const cargo=invoiceCargoSummary(item,warehouseEntries);
  const weight=invoiceCargoWeight(item,warehouseEntries);
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const transportUnits=Math.max(1,invoiceTransportServices(item,transports,calendarEvents).length);
  const clean=String(rawLine||'').replace(/\s+/g,' ').trim();
  if(!clean)return null;
  const lineCargo=contextCargo||supplierCargoFromLine(clean)||cargo;
  const lineWeight=supplierCargoWeight(lineCargo)||weight;
  const lineStorageDays=storageDays;
  const amount=supplierLineAmount(clean);
  const serviceDate=supplierServiceDate(clean);
  const withoutAmount=clean.replace(/\s+[-+]?\d+[.,]\d{1,2}\s*(EUR|€)?$/i,'').trim();
  const label=supplierConceptLabel(withoutAmount);
  if(!/[A-Z]/.test(label))return null;
  if(/^(INVOICE|FACTURA|CUSTOMER|CLIENTE|DATE|FECHA|TOTAL|SUBTOTAL|BASE|VAT|IVA|PAGE|PAG|NUMERO|NIF|CIF|ADDRESS|DIRECCION)\b/.test(label))return null;
  const make=(id,itemName,detail,price,units=1,tax='0%')=>({id:`supplier-${id}-${Date.now()}-${index}`,item:itemName,detail:String(detail||lineCargo).toUpperCase(),price:Number(price)||0,units:Number(units)||1,tax});
  if(/ARRIVAL.*EXPENSES.*AIRPORT/.test(label))return make('airport-expenses','ARRIVAL EXPENSES AIRPORT',lineCargo,amount);
  if(/AGENCY.*CLEARANCE.*AIRPORT/.test(label))return make('airport-agency','AGENCY & CLEARANCE AIRPORT',lineCargo,amount);
  if(/LOAD\s*\/\s*UNLOAD|UNLOAD|RECEPTION/.test(label))return make('load-unload','LOAD / UNLOAD',lineCargo,umeHandlingPrice(lineWeight));
  if(/WAREHOUSE|STORAGE|ALMACEN/.test(label))return make('warehouse','WAREHOUSE',`${lineStorageDays} DAYS - ${lineCargo}`,umeStorageTotal(lineWeight,lineStorageDays)||UME_ALGECIRAS_RATES.minWarehousing);
  if(/CUSTOMS.*T\s*-?\s*1|CLEARANCE.*T\s*-?\s*1|T1/.test(label))return make('customs-t1','CUSTOMS CLEARANCE T-1',lineCargo,UME_ALGECIRAS_RATES.customT1Ex1);
  if(/CUSTOMS|CLEARANCE|ADUANA/.test(label))return make('customs','CUSTOMS CLEARANCE',lineCargo,UME_ALGECIRAS_RATES.customClearanceC);
  if(/DELIVERY.*VESSEL|VESSEL.*PORT|TRANSPORT.*VESSEL|ENTREGA.*BUQUE|BUQUE/.test(label))return make('delivery-vessel','DELIVERY VESSEL ALGECIRAS PORT',`${invoiceTransportDetail(lineCargo,item,transports,calendarEvents)}${serviceDate?` - ${serviceDate}`:''}`,umeTransportPrice(lineWeight),serviceDate?1:transportUnits);
  if(/DOC.*CESSION.*DHL|CESION.*DHL/.test(label))return make('docs-cession-dhl','DOC CESSION DHL',lineCargo,UME_ALGECIRAS_RATES.docsCessionDhl);
  if(/DOC.*CESSION.*TNT|CESION.*TNT/.test(label))return make('docs-cession-tnt','DOC CESSION TNT',lineCargo,UME_ALGECIRAS_RATES.docsCessionTnt);
  if(/OPEN FILE|APERTURA/.test(label))return make('open-file','OPEN FILE',invoiceHeaderTitle(item,transports,calendarEvents),UME_ALGECIRAS_RATES.openFile);
  if(/OPEN WAREHOUSE|NIGHT|WEEKEND|HOLIDAY|FESTIVO/.test(label))return make('open-warehouse-night','OPEN WAREHOUSE NIGHT/BANK HOLIDAYS',lineCargo,UME_ALGECIRAS_RATES.openWarehouseNightHoliday);
  if(/AGP|MALAGA|AIRPORT|AEROPUERTO/.test(label)&&/TRANSPORT|TRUCK|RECOGIDA|COLLECTION/.test(label))return make('transport-agp','TRANSPORT FROM AGP TO WAREHOUSE',lineCargo,UME_ALGECIRAS_RATES.transportAgpXrjNextDay);
  if(/AGP|MALAGA|MÁLAGA|AIRPORT|AEROPUERTO/.test(label)&&/TRANSPORT|TRUCK|RECOGIDA|COLLECTION/.test(label))return make('transport-agp','TRANSPORT FROM AGP TO WAREHOUSE',cargo,UME_ALGECIRAS_RATES.transportAgpXrjNextDay);
  if(/SVQ|SEVILLA/.test(label)&&/TRANSPORT|TRUCK|RECOGIDA|COLLECTION/.test(label))return make('transport-svq','TRANSPORT FROM SVQ TO WAREHOUSE',lineCargo,UME_ALGECIRAS_RATES.transportFromSvq);
  if(/COURIER/.test(label))return make('courier','COURIER SERVICE',lineCargo,0);
  if(/COLLECTION|PICK\s*UP|RECOGIDA/.test(label))return make('collection','COLLECTION / PICK UP',lineCargo,UME_ALGECIRAS_RATES.pickUpSmallParcels);
  return null;
};
const parseSupplierInvoiceConcepts=(text,item,warehouseEntries=[],transports=[],calendarEvents=[])=>{
  let contextCargo='';
  return String(text||'').split(/\r?\n/).map((line,index)=>{
    const cargo=supplierCargoFromLine(line);
    if(cargo)contextCargo=cargo;
    return supplierConceptLine(line,item,warehouseEntries,transports,calendarEvents,index,contextCargo);
  }).filter(Boolean);
};
const extractTextWithPdfJs=async file=>{
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buffer),useSystemFonts:true}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
    const page=await pdf.getPage(pageNumber);
    const content=await page.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false});
    const rows=new Map();
    (content.items||[]).forEach(item=>{
      const text=String(item?.str||'').replace(/\s+/g,' ').trim();
      if(!text)return;
      const transform=item.transform||[];
      const x=Number(transform[4])||0;
      const y=Number(transform[5])||0;
      const key=Math.round(y/3)*3;
      if(!rows.has(key))rows.set(key,[]);
      rows.get(key).push({x,text});
    });
    const pageText=[...rows.entries()]
      .sort((a,b)=>b[0]-a[0])
      .map(([,items])=>items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').replace(/\s+/g,' ').trim())
      .filter(Boolean)
      .join('\n');
    if(pageText)pages.push(pageText);
  }
  return cleanSupplierPdfTextForInvoices(pages.join('\n\n'));
};
const decodePdfLiteral=value=>String(value||'')
  .replace(/\\([nrtbf()\\])/g,(match,char)=>({n:'\n',r:'\r',t:'\t',b:'',f:'','(':'(',')':')','\\':'\\'}[char]??char))
  .replace(/\\([0-7]{1,3})/g,(match,octal)=>String.fromCharCode(parseInt(octal,8)))
  .replace(/\s+/g,' ')
  .trim();
const extractTextFromRawPdf=raw=>{
  const textParts=[];
  const literalRegex=/\((?:\\.|[^\\)])*\)/g;
  let match;
  while((match=literalRegex.exec(raw))){
    const literal=decodePdfLiteral(match[0].slice(1,-1));
    if(literal&&/[A-Za-z0-9]/.test(literal))textParts.push(literal);
  }
  const hexRegex=/<([0-9A-Fa-f]{8,})>/g;
  while((match=hexRegex.exec(raw))){
    const hex=match[1];
    let decoded='';
    for(let index=0;index<hex.length;index+=4){
      const code=parseInt(hex.slice(index,index+4),16);
      if(code>=32&&code<65535)decoded+=String.fromCharCode(code);
    }
    decoded=decoded.replace(/\s+/g,' ').trim();
    if(decoded&&/[A-Za-z0-9]/.test(decoded))textParts.push(decoded);
  }
  return textParts.join('\n').replace(/\n{3,}/g,'\n\n').trim();
};
const inflatePdfStreamText=async bytes=>{
  if(typeof DecompressionStream==='undefined')return '';
  const raw=Array.from(bytes,byte=>String.fromCharCode(byte)).join('');
  const texts=[];
  const streamRegex=/<<[\s\S]{0,500}?\/FlateDecode[\s\S]{0,500}?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while((match=streamRegex.exec(raw))){
    try{
      const streamBinary=match[1];
      const streamBytes=new Uint8Array(streamBinary.length);
      for(let index=0;index<streamBinary.length;index+=1)streamBytes[index]=streamBinary.charCodeAt(index)&255;
      const decompressedStream=new Blob([streamBytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const decompressedBuffer=await new Response(decompressedStream).arrayBuffer();
      const decoded=new TextDecoder('latin1').decode(decompressedBuffer);
      const text=extractTextFromRawPdf(decoded);
      if(text)texts.push(text);
    }catch(error){
      continue;
    }
  }
  return texts.join('\n\n').trim();
};
const cleanSupplierPdfText=text=>{
  const allowed=/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ€$.,:;()\/+\-\s]/g;
  const keywords=/LOAD|UNLOAD|RECEPTION|WAREHOUSE|STORAGE|CUSTOMS|CLEARANCE|DELIVERY|VESSEL|PORT|DOC|CESSION|TRANSPORT|COURIER|COLLECTION|PICK|RECOGIDA|ALMACEN|ADUANA|BUQUE|PALLET|BOX|BULTO|KG|KGS/i;
  const price=/\d+[.,]\d{1,2}\s*(EUR|€)?/i;
  const lines=String(text||'').split(/\r?\n/).map(line=>{
    const cleaned=(line.match(allowed)||[]).join('').replace(/\s+/g,' ').trim();
    if(cleaned.length<3||cleaned.length>220)return '';
    const printableRatio=cleaned.length/Math.max(String(line||'').length,1);
    if(printableRatio<0.65)return '';
    if(!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(cleaned))return '';
    if(!(keywords.test(cleaned)||price.test(cleaned)))return '';
    return cleaned;
  }).filter(Boolean);
  return lines.join('\n').trim();
};
const cleanSupplierPdfTextForInvoices=text=>{
  const keywords=/LOAD|UNLOAD|RECEPTION|WAREHOUSE|WAREHOUSING|STORAGE|CUSTOMS|CLEARANCE|DELIVERY|VESSEL|PORT|DOC|CESSION|TRANSPORT|COURIER|COLLECTION|PICK|RECOGIDA|ALMACEN|ADUANA|BUQUE|PALLET|BOX|BULTO|KG|KGS|ARRIVAL|AGENCY/i;
  const price=/\d+[.,]\d{1,2}\s*(EUR|€)?/i;
  const lines=String(text||'').split(/\r?\n/).map(line=>{
    const original=String(line||'');
    const cleaned=original.replace(/[^\p{L}\p{N}€$.,:;()\/+\-\s]/gu,' ').replace(/\s+/g,' ').trim();
    if(cleaned.length<3||cleaned.length>220)return '';
    const printableRatio=cleaned.length/Math.max(original.length,1);
    if(printableRatio<0.65)return '';
    if(!/\p{L}/u.test(cleaned))return '';
    if(!(keywords.test(cleaned)||price.test(cleaned)))return '';
    return cleaned;
  }).filter(Boolean);
  return lines.join('\n').trim();
};
const extractSupplierPdfText=async file=>{
  try{
    const textWithPdfJs=await extractTextWithPdfJs(file);
    if(textWithPdfJs)return textWithPdfJs;
  }catch(error){
    // Si pdf.js no puede leer el PDF, usamos el extractor básico como respaldo.
  }
  try{
    const buffer=await file.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    let binary='';
    const chunkSize=0x8000;
    for(let index=0;index<bytes.length;index+=chunkSize){
      binary+=String.fromCharCode(...bytes.subarray(index,index+chunkSize));
    }
    const rawText=extractTextFromRawPdf(binary);
    const inflatedText=await inflatePdfStreamText(bytes);
    return cleanSupplierPdfTextForInvoices([rawText,inflatedText].filter(Boolean).join('\n\n'));
  }catch(error){
    return '';
  }
};
const clientCostLineTotal=line=>(Number(line.price)||0)*(Number(line.units)||0);
const clientCostTotal=estimate=>(estimate?.lines||[]).reduce((sum,line)=>sum+clientCostLineTotal(line),0);
const enforceLimaniFreeStorageEstimate=(estimate,item)=>({...estimate,lines:enforceLimaniFreeStorageLines(estimate?.lines||[],item)});
const defaultClientCostEstimate=(item,warehouseEntries=[])=>{
  const cargo=invoiceCargoSummary(item,warehouseEntries);
  const weight=invoiceCargoWeight(item,warehouseEntries);
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const chargeableStorageDays=Math.max(0,storageDays-ALS_BARCELONA_RATES.freeStorageDays);
  if(isAlsCase(item)){
    const loadUnload=Math.round((weight*ALS_BARCELONA_RATES.loadUnloadPerKg)*100)/100;
    const storageDaily=priceByWeight(weight,ALS_BARCELONA_RATES.storage);
    return {
      id:`COST-${item.id}`,
      title:`PREVISI\u00d3N COSTES ${item.buque||item.id}`.toUpperCase(),
      note:'Tarifa ALS Barcelona 2026. Storage con 3 d\u00edas gratis.',
      lines:[
        {id:'unload',item:'UNLOAD (RECEPTION)',detail:cargo,price:loadUnload,units:1},
        {id:'storage',item:'STORAGE',detail:`${storageDays} DAYS (${chargeableStorageDays} BILLABLE + ${Math.min(storageDays,ALS_BARCELONA_RATES.freeStorageDays)} FREE) - ${cargo}`,price:storageDaily,units:chargeableStorageDays},
        {id:'load',item:'LOAD (SALIDA)',detail:cargo,price:loadUnload,units:1}
      ]
    };
  }
  if(isUmeAlgecirasCase(item)){
    const lines=umeAlgecirasLines(item,warehouseEntries,[],[],{includeRef:false}).map(line=>({...line,tax:undefined}));
    return {
      id:`COST-${item.id}`,
      title:`PREVISI\u00d3N COSTES ${item.buque||item.id}`.toUpperCase(),
      note:'Tarifa UME Algeciras 2026. Base autom\u00e1tica desde peso, storage y entrega a buque.',
      lines
    };
  }
  return {
    id:`COST-${item.id}`,
      title:`PREVISI\u00d3N COSTES ${item.buque||item.id}`.toUpperCase(),
    note:'Sin tarifa autom\u00e1tica para este cliente. A\u00f1ade conceptos manuales.',
    lines:[{id:'manual-'+Date.now(),item:'CONCEPTO MANUAL',detail:cargo,price:0,units:1}]
  };
};
const invoiceDetailWeight=detail=>{
  const matches=[...String(detail||'').matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos)\b/gi)];
  return matches.reduce((sum,match)=>sum+Number(String(match[1]).replace(',','.')),0);
};
const isStandardInvoiceLine=line=>['ref','reception','handling','storage','transport'].includes(line?.id);
const repriceLimaniInvoiceLines=(lines,weight,detail)=>{
  const kilos=Number(weight)||0;
  return lines.map(line=>{
    if(!isStandardInvoiceLine(line))return line;
    const next={...line,detail:line.id==='storage'?line.detail:detail};
    if(line.id==='ref')return {...next,price:0};
    if(line.id==='reception')return {...next,price:priceByWeight(kilos,LIMANI_BARCELONA_RATES.reception)};
    if(line.id==='handling')return {...next,price:kilos>0?LIMANI_BARCELONA_RATES.handlingHour:0};
    if(line.id==='storage'){
      const days=Number(line.units)||0;
      const storageDetail=String(line.detail||'').replace(/\s-\s.*$/,'');
      return {...next,detail:`${storageDetail||`${days} DAYS`} - ${detail}`,price:0};
    }
    if(line.id==='transport')return {...next,price:priceByWeight(kilos,LIMANI_BARCELONA_RATES.warehouseToVessel)};
    return next;
  });
};
const invoiceAutoPriceLine=(line,context,warehouseEntries=[],transports=[],calendarEvents=[])=>{
  const label=supplierConceptLabel(line?.item||line?.label||'');
  const detail=String(line?.detail||'');
  const detailWeight=invoiceDetailWeight(detail);
  const fallbackWeight=invoiceCargoWeight(context,warehouseEntries);
  const kilos=detailWeight||fallbackWeight;
  const units=Number(line?.units)||1;
  if(!context||!label)return null;
  if(isUmeAlgecirasCase(context)){
    if(/LOAD|UNLOAD|HANDLING|RECEPTION/.test(label))return umeHandlingPrice(kilos);
    if(/WAREHOUSE|STORAGE/.test(label))return umeStorageDailyPrice(kilos);
    if(/CUSTOMS|CLEARANCE|ADUANA|T\s*-?\s*1|EX\s*-?\s*1/.test(label))return umeAlgecirasCustomsPrice(context);
    if(/DELIVERY|VESSEL|TRANSPORT|TRANSPORTE/.test(label))return umeTransportPrice(kilos);
    return null;
  }
  if(isAlsCase(context)){
    if(/UNLOAD|RECEPTION|DESCARGA/.test(label))return Number(((kilos||0)*ALS_BARCELONA_RATES.loadUnloadPerKg).toFixed(2));
    if(/LOAD|SALIDA|CARGA/.test(label))return Number(((kilos||0)*ALS_BARCELONA_RATES.loadUnloadPerKg).toFixed(2));
    if(/STORAGE|ALMACENAJE/.test(label))return storagePriceByWeight(kilos,ALS_BARCELONA_RATES.storage);
    return null;
  }
  if(isLimaniCase(context)){
    if(/RECEPTION|RECEPCION/.test(label))return priceByWeight(kilos,LIMANI_BARCELONA_RATES.reception);
    if(/HANDLING|MANIPULACION/.test(label))return kilos>0?LIMANI_BARCELONA_RATES.handlingHour:0;
    if(/STORAGE|ALMACENAJE/.test(label))return 0;
    if(/TRANSPORT|TRANSPORTE|DELIVERY|VESSEL|BUQUE/.test(label))return priceByWeight(kilos,LIMANI_BARCELONA_RATES.warehouseToVessel);
    if(/WAITING|ESPERA/.test(label))return LIMANI_BARCELONA_RATES.waitingHour;
    return null;
  }
  return null;
};
const invoiceTransportServices=(item,transports=[],calendarEvents=[])=>{
  const caseId=item?.id;
  if(!caseId)return[];
  const events=(calendarEvents||[]).filter(event=>event.expediente===caseId&&isActiveTransportCalendarEvent(event));
  if(events.length)return events;
  return (transports||[]).filter(entry=>entry.expediente===caseId&&!/cancel|anulad/i.test(String(entry.estado||'')));
};
const invoiceTransportUnits=(item,transports=[],calendarEvents=[])=>Math.max(1,invoiceTransportServices(item,transports,calendarEvents).length);
const invoiceTransportDetail=(cargo,item,transports=[],calendarEvents=[])=>{
  const units=invoiceTransportUnits(item,transports,calendarEvents);
  return units>1?`${units} TRANSPORTES - ${cargo}`:cargo;
};
const draftInvoiceFromCase=(item,warehouseEntries=[],transports=[],calendarEvents=[])=>{
  const cargo=invoiceCargoSummary(item,warehouseEntries);
  const date=invoiceScheduleLabel(item,transports,calendarEvents);
  if(isSurveyService(item)){
    const detail=[item.buque,date,item.puerto].filter(Boolean).join(' - ').toUpperCase();
    const surveyPrice=Number(item.billing?.surveyPrice||item.billing?.transportPrice||0);
    const lines=[
      {id:'ref',item:invoiceHeaderTitle(item,transports,calendarEvents),detail:'SURVEY / BALLAST WATER SAMPLES',price:0,units:1,tax:'21%'},
      {id:'survey',item:'SURVEY / BALLAST WATER SAMPLES',detail,price:surveyPrice,units:1,tax:'0%'}
    ];
    const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    const invoice={id:'BOR-'+item.id.replace('SW-',''),expediente:item.id,cliente:item.cliente,concepto:invoiceHeaderTitle(item,transports,calendarEvents),importe:0,estado:'Borrador',vencimiento:due,buque:item.buque,puerto:item.puerto,purchaseOrder:purchaseOrderOf(item),proforma:`PRO${String(260000+numericRef(item.id)).slice(-6)}`,observaciones:'Exenci\u00f3n de IVA seg\u00fan ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre',payment:'BANK ACCOUNT: ES06 0182 4775 5102 0174 1635\\nSWIFT: BBVAESMMXXX',lines};
    const importe=invoiceTotal(invoice);
    const coste=caseExpenseTotal(item);
    return {...invoice,importe,coste,margen:importe-coste};
  }
  if(isUmeAlgecirasCase(item)){
    const lines=umeAlgecirasLines(item,warehouseEntries,transports,calendarEvents,{includeRef:true});
    const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    const invoice={id:'BOR-'+item.id.replace('SW-',''),expediente:item.id,cliente:item.cliente,concepto:invoiceHeaderTitle(item,transports,calendarEvents),importe:0,estado:'Borrador',vencimiento:due,buque:item.buque,puerto:item.puerto,purchaseOrder:purchaseOrderOf(item),proforma:`PRO${String(260000+numericRef(item.id)).slice(-6)}`,observaciones:'Exenci\u00f3n de IVA seg\u00fan ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre',payment:'BANK ACCOUNT: ES06 0182 4775 5102 0174 1635\\nSWIFT: BBVAESMMXXX',lines};
    const importe=invoiceTotal(invoice);
    const coste=caseExpenseTotal(item);
    return {...invoice,importe,coste,margen:importe-coste};
  }
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const hasStorageLine=storageDays>0||invoiceWarehouseEntries(item,warehouseEntries).length>0||Number(item.billing?.storagePrice||0)>0;
  const transportServices=invoiceTransportServices(item,transports,calendarEvents);
  const hasRecordedTransport=(transports||[]).some(entry=>entry.expediente===item.id)||(calendarEvents||[]).some(entry=>entry.expediente===item.id&&isTransportCalendarEvent(entry));
  const billOwnTransport=!isStorageOnly(item)&&(transportServices.length>0||(!hasRecordedTransport&&((item.servicios||[]).some(service=>/transporte/i.test(String(service)))||Number(item.billing?.transportPrice||0)>0)));
  const lines=[
    {id:'ref',item:invoiceHeaderTitle(item,transports,calendarEvents),detail:cargo,price:0,units:1,tax:'21%'},
    {id:'reception',item:'RECEPTION',detail:cargo,price:suggestedReceptionPrice(item,warehouseEntries),units:1,tax:'0%'},
    {id:'handling',item:'HANDLING',detail:cargo,price:suggestedHandlingPrice(item,warehouseEntries),units:1,tax:'0%'}
  ];
  if(hasStorageLine)lines.splice(3,0,{id:'storage',item:'STORAGE',detail:`${storageDays} DAY${storageDays===1?'':'S'} - ${cargo}`,price:suggestedStoragePrice(item,warehouseEntries),units:storageDays,tax:'0%'});
  if(billOwnTransport){
    const transportUnits=Math.max(1,transportServices.length);
    const transportDetail=invoiceTransportDetail(cargo,item,transports,calendarEvents);
    lines.push({id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:transportDetail,price:suggestedTransportPrice(item,warehouseEntries),units:transportUnits,tax:'0%'});
  }
  if(Number(item.billing?.waitingHours||0)>0)lines.push({id:'waiting',item:'WAITING TIME',detail:`${item.billing.waitingHours} HOURS WAITING FOR ARRIVE`,price:suggestedWaitingPrice(item),units:Number(item.billing.waitingHours),tax:'0%'});
  (item.billingAdjustments||[]).filter(entry=>Number(entry.price)>0).forEach(entry=>lines.push({...entry,tax:entry.tax||'0%'}));
  const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const invoice={id:'BOR-'+item.id.replace('SW-',''),expediente:item.id,cliente:item.cliente,concepto:invoiceHeaderTitle(item,transports,calendarEvents),importe:0,estado:'Borrador',vencimiento:due,buque:item.buque,puerto:item.puerto,purchaseOrder:purchaseOrderOf(item),proforma:`PRO${String(260000+numericRef(item.id)).slice(-6)}`,observaciones:'Exenci\u00f3n de IVA seg\u00fan ART 22 de la ley 37/1992 y 10.2 del real decreto ley 1624/92 de Diciembre',payment:'BANK ACCOUNT: ES06 0182 4775 5102 0174 1635\\nSWIFT: BBVAESMMXXX',lines};
  const importe=invoiceTotal(invoice);
  const coste=caseExpenseTotal(item);
  return {...invoice,importe,coste,margen:importe-coste};
};
const CP1252_BYTE_MAP={
  '\u20ac':0x80,'\u201a':0x82,'\u0192':0x83,'\u201e':0x84,'\u2026':0x85,'\u2020':0x86,'\u2021':0x87,'\u02c6':0x88,'\u2030':0x89,'\u0160':0x8a,'\u2039':0x8b,'\u0152':0x8c,'\u017d':0x8e,
  '\u2018':0x91,'\u2019':0x92,'\u201c':0x93,'\u201d':0x94,'\u2022':0x95,'\u2013':0x96,'\u2014':0x97,'\u02dc':0x98,'\u2122':0x99,'\u0161':0x9a,'\u203a':0x9b,'\u0153':0x9c,'\u017e':0x9e,'\u0178':0x9f
};
const COMMON_MOJIBAKE_FIXES=[
  [String.fromCharCode(0x00C3,0x0081),'\u00C1'],[String.fromCharCode(0x00C3,0x2030),'\u00C9'],[String.fromCharCode(0x00C3,0x008D),'\u00CD'],[String.fromCharCode(0x00C3,0x201C),'\u00D3'],[String.fromCharCode(0x00C3,0x0161),'\u00DA'],[String.fromCharCode(0x00C3,0x2018),'\u00D1'],
  [String.fromCharCode(0x00C3,0x00A1),'\u00E1'],[String.fromCharCode(0x00C3,0x00A9),'\u00E9'],[String.fromCharCode(0x00C3,0x00AD),'\u00ED'],[String.fromCharCode(0x00C3,0x00B3),'\u00F3'],[String.fromCharCode(0x00C3,0x00BA),'\u00FA'],[String.fromCharCode(0x00C3,0x00B1),'\u00F1'],[String.fromCharCode(0x00C3,0x00BC),'\u00FC'],
  [String.fromCharCode(0x00C2,0x00A0),' '],[String.fromCharCode(0x00C2,0x00B7),'\u00B7'],[String.fromCharCode(0x00C2,0x00BA),'\u00BA'],[String.fromCharCode(0x00C2,0x00AA),'\u00AA'],[String.fromCharCode(0x00C2),''],
  [String.fromCharCode(0x00E2,0x20AC,0x02DC),'\u2018'],[String.fromCharCode(0x00E2,0x20AC,0x2122),'\u2019'],[String.fromCharCode(0x00E2,0x20AC,0x0153),'\u201C'],[String.fromCharCode(0x00E2,0x20AC,0x009C),'\u201C'],[String.fromCharCode(0x00E2,0x20AC,0x009D),'\u201D'],[String.fromCharCode(0x00E2,0x20AC,0xFFFD),'\u201D'],
  [String.fromCharCode(0x00E2,0x20AC,0x201C),'\u2013'],[String.fromCharCode(0x00E2,0x20AC,0x201D),'\u2014'],[String.fromCharCode(0x00E2,0x20AC,0x00A2),'\u2022'],[String.fromCharCode(0x00E2,0x20AC,0x00B9),'\u2039'],[String.fromCharCode(0x00E2,0x20AC,0x00BA),'\u203A'],
  [String.fromCharCode(0x00E2,0x2020,0x2019),'\u2192'],[String.fromCharCode(0x00E2,0x0153,0x201C),'\u2713'],[String.fromCharCode(0x00E2,0x0153,0x201D),'\u2714'],
  [String.fromCharCode(0x00E2,0x0080,0x0093),'\u2013'],[String.fromCharCode(0x00E2,0x0080,0x0094),'\u2014'],[String.fromCharCode(0x00E2,0x0086,0x0092),'\u2192'],[String.fromCharCode(0x00E2,0x009C,0x0093),'\u2713'],[String.fromCharCode(0x00E2,0x009C,0x0094),'\u2714']
];
const applyCommonMojibakeFixes=value=>COMMON_MOJIBAKE_FIXES.reduce((result,[bad,good])=>result.split(bad).join(good),String(value));
const decodeMojibakeOnce=value=>{
  if(mojibakeScore(value)===0||typeof TextDecoder==='undefined')return value;
  try{
    const bytes=Uint8Array.from(Array.from(value,char=>{
      const code=char.charCodeAt(0);
      return code<=0xff?code:(CP1252_BYTE_MAP[char]??0x3f);
    }));
    const decoded=applyCommonMojibakeFixes(new TextDecoder('utf-8',{fatal:false}).decode(bytes));
    return mojibakeScore(decoded)<mojibakeScore(value)?decoded:value;
  }catch{
    return value;
  }
};
const mojibakeScore=value=>{
  if(typeof value!=='string')return 0;
  return (value.match(/[\u00c2\u00c3\u00c5\u00e2\u00ef\ufffd]/g)||[]).length+(value.match(/[\u0080-\u009f\u201a-\u201e\u2020-\u2026\u2030\u2039\u203a\u20ac]/g)||[]).length;
};
const repairTextEncoding=value=>{
  if(typeof value!=='string')return value;
  let current=applyCommonMojibakeFixes(value);
  for(let index=0;index<4;index+=1){
    const fixed=applyCommonMojibakeFixes(decodeMojibakeOnce(current));
    if(fixed===current)break;
    current=fixed;
  }
  return current;
};
const isBinaryLike=value=>(typeof Blob!=='undefined'&&value instanceof Blob)||(typeof File!=='undefined'&&value instanceof File)||(typeof FileList!=='undefined'&&value instanceof FileList);
const normalizeTextEncoding=(value,seen=new WeakSet())=>{
  if(typeof value==='string')return repairTextEncoding(value);
  if(!value||typeof value!=='object'||value instanceof Date||isBinaryLike(value))return value;
  if(seen.has(value))return value;
  seen.add(value);
  if(Array.isArray(value))return value.map(item=>normalizeTextEncoding(item,seen));
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalizeTextEncoding(item,seen)]));
};
const hasVisibleMojibake=value=>typeof value==='string'&&mojibakeScore(value)>0;
const repairVisibleText=value=>hasVisibleMojibake(value)?repairTextEncoding(value):value;
const sanitizeVisibleDomEncoding=(root=typeof document!=='undefined'?document.body:null)=>{
  if(typeof document==='undefined'||!root)return;
  const domFilter=typeof NodeFilter!=='undefined'?NodeFilter:{SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2};
  const shouldSkipTextNode=node=>{
    const parent=node?.parentElement;
    return !parent||Boolean(parent.closest('script,style,noscript,textarea,input,[contenteditable="true"]'));
  };
  const walker=document.createTreeWalker(root,domFilter.SHOW_TEXT,{acceptNode:node=>shouldSkipTextNode(node)?domFilter.FILTER_REJECT:domFilter.FILTER_ACCEPT});
  const textNodes=[];
  while(walker.nextNode())textNodes.push(walker.currentNode);
  textNodes.forEach(node=>{
    const fixed=repairVisibleText(node.nodeValue);
    if(fixed!==node.nodeValue)node.nodeValue=fixed;
  });
  root.querySelectorAll?.('[title],[aria-label],[placeholder],[alt]').forEach(element=>{
    ['title','aria-label','placeholder','alt'].forEach(attribute=>{
      const value=element.getAttribute(attribute);
      if(!value)return;
      const fixed=repairVisibleText(value);
      if(fixed!==value)element.setAttribute(attribute,fixed);
    });
  });
};
const jsonBody=value=>JSON.stringify(normalizeTextEncoding(value));
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=normalizeTextEncoding(await response.json().catch(()=>({})));
  if(!response.ok) throw Object.assign(new Error(body.error||'No se pudo completar la operaci\u00f3n.'),{status:response.status,body});
  return body;
}
async function showDeviceNotification(title,body,tag){
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  const options={body,tag,renotify:true,icon:'/swiftport-icon.svg',badge:'/swiftport-icon.svg',data:{url:'/'}};
  if('serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.ready;
    await registration.showNotification(title,options);
    return true;
  }
  new Notification(title,options);
  return true;
}
const ALERT_SOUND_STORAGE_KEY='swiftport-alert-sound-settings-v2';
const ALERT_SOUND_MAX_VOLUME=1;
const ALERT_SOUND_OPTIONS=[
  {id:'message',label:'Mensaje corto'},
  {id:'double',label:'Doble mensaje'},
  {id:'soft',label:'Aviso suave'},
  {id:'bell',label:'Campana suave'},
  {id:'radio',label:'Radio discreta'},
  {id:'ship',label:'Bocina de barco suave'}
];
const DEFAULT_ALERT_SOUND_SETTINGS={enabled:true,sound:'message',volume:.45};
const normalizeAlertSoundSettings=settings=>{
  const raw=settings&&typeof settings==='object'?settings:{};
  const sound=ALERT_SOUND_OPTIONS.some(option=>option.id===raw.sound)?raw.sound:DEFAULT_ALERT_SOUND_SETTINGS.sound;
  const volume=Math.min(ALERT_SOUND_MAX_VOLUME,Math.max(0,Number.isFinite(Number(raw.volume))?Number(raw.volume):DEFAULT_ALERT_SOUND_SETTINGS.volume));
  return {enabled:raw.enabled!==false,sound,volume};
};
const loadAlertSoundSettings=()=>{
  try{
    const stored=localStorage.getItem(ALERT_SOUND_STORAGE_KEY);
    if(stored)return normalizeAlertSoundSettings(JSON.parse(stored));
    const legacy=localStorage.getItem('swiftport-alert-sound');
    if(legacy==='0')return {...DEFAULT_ALERT_SOUND_SETTINGS,enabled:false};
  }catch{}
  return {...DEFAULT_ALERT_SOUND_SETTINGS};
};
const saveAlertSoundSettings=settings=>{
  const next=normalizeAlertSoundSettings(settings);
  try{
    localStorage.setItem(ALERT_SOUND_STORAGE_KEY,JSON.stringify(next));
    localStorage.setItem('swiftport-alert-sound',next.enabled?'1':'0');
  }catch{}
  return next;
};
async function playAlertSound(settings=loadAlertSoundSettings()){
  const soundSettings=normalizeAlertSoundSettings(settings);
  if(!soundSettings.enabled||soundSettings.volume<=0)return false;
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)return false;
  const audio=window.__swiftportAudioContext||(window.__swiftportAudioContext=new AudioContext());
  if(audio.state==='suspended')await audio.resume();
  const now=audio.currentTime;
  const master=audio.createGain();
  const compressor=audio.createDynamicsCompressor();
  master.gain.setValueAtTime(soundSettings.volume,now);
  compressor.threshold.setValueAtTime(-20,now);
  compressor.ratio.setValueAtTime(3,now);
  compressor.attack.setValueAtTime(.006,now);
  compressor.release.setValueAtTime(.16,now);
  master.connect(compressor);
  compressor.connect(audio.destination);
  const tone=({start=0,duration=.18,frequency=440,type='sine',level=.14,endFrequency=frequency})=>{
    const oscillator=audio.createOscillator();
    const gain=audio.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,now+start);
    oscillator.frequency.linearRampToValueAtTime(endFrequency,now+start+duration);
    gain.gain.setValueAtTime(0.0001,now+start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,level),now+start+.018);
    gain.gain.setValueAtTime(Math.max(0.0002,level),now+start+Math.max(.04,duration-.06));
    gain.gain.exponentialRampToValueAtTime(0.0001,now+start+duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now+start);
    oscillator.stop(now+start+duration+.03);
  };
  const messagePulse=start=>{
    tone({start,duration:.09,frequency:930,endFrequency:1030,type:'sine',level:.14});
    tone({start:start+.11,duration:.13,frequency:1240,endFrequency:1180,type:'triangle',level:.13});
  };
  if(soundSettings.sound==='double'){
    messagePulse(0);
    messagePulse(.34);
  }else if(soundSettings.sound==='bell'){
    [0,.22].forEach((start,index)=>{
      tone({start,duration:.18,frequency:820-index*60,endFrequency:940-index*60,type:'sine',level:.16});
      tone({start,duration:.24,frequency:1220-index*80,endFrequency:1080-index*80,type:'triangle',level:.08});
    });
  }else if(soundSettings.sound==='radio'){
    [0,.13,.28].forEach((start,index)=>tone({start,duration:index===2?.22:.07,frequency:index===2?620:1120,endFrequency:index===2?560:1280,type:'square',level:index===2?.08:.1}));
  }else if(soundSettings.sound==='soft'){
    [659,784].forEach((frequency,index)=>tone({start:index*.16,duration:.22,frequency,endFrequency:frequency*1.03,type:'sine',level:.1}));
  }else if(soundSettings.sound==='ship'){
    const filter=audio.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.setValueAtTime(540,now);
    master.disconnect();
    master.connect(filter);
    filter.connect(compressor);
    tone({start:0,duration:.42,frequency:148,endFrequency:142,type:'sawtooth',level:.16});
    tone({start:0,duration:.42,frequency:196,endFrequency:188,type:'sine',level:.12});
    tone({start:0,duration:.42,frequency:74,endFrequency:70,type:'sine',level:.08});
  }else{
    messagePulse(0);
  }
  return true;
}
async function uploadAttachment(file,category,csrfToken){
  const data=new FormData();
  data.append('file',file);
  data.append('category',category);
  const response=await fetch('/api/uploads.php',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken},body:data});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||`No se pudo subir ${file.name}.`);
  return body.file;
}
function MultiPhotoButton({onFiles,disabled=false,className='button primary',title='Sesión de fotos',children}){
  const [open,setOpen]=useState(false);
  return <><button type="button" className={className} disabled={disabled} onClick={()=>setOpen(true)}>{children}</button>{open&&<MultiPhotoCapture title={title} close={()=>setOpen(false)} finish={files=>{setOpen(false);onFiles(files)}}/>}</>;
}
function MultiPhotoCapture({title,close,finish}){
  const videoRef=useRef(null);
  const streamRef=useRef(null);
  const shotsRef=useRef([]);
  const [shots,setShots]=useState([]);
  const [starting,setStarting]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    const start=async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara continua no está disponible en este dispositivo.');
        const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
        if(cancelled){stream.getTracks().forEach(track=>track.stop());return}
        streamRef.current=stream;
        if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play()}
      }catch(reason){if(!cancelled)setError(reason.message||'No se pudo abrir la cámara. Puedes elegir varias fotos de la galería.')}
      finally{if(!cancelled)setStarting(false)}
    };
    start();
    return()=>{cancelled=true;streamRef.current?.getTracks().forEach(track=>track.stop())};
  },[]);
  useEffect(()=>{shotsRef.current=shots},[shots]);
  useEffect(()=>()=>{shotsRef.current.forEach(shot=>URL.revokeObjectURL(shot.preview))},[]);
  const addFiles=files=>{
    const selected=[...files].filter(file=>file?.type?.startsWith('image/'));
    if(!selected.length)return;
    setShots(current=>[...current,...selected.map((file,index)=>({id:`SHOT-${Date.now()}-${index}`,file,preview:URL.createObjectURL(file)}))]);
  };
  const capture=()=>{
    const video=videoRef.current;
    if(!video?.videoWidth){setError('Espera un momento a que la cámara esté lista.');return}
    const canvas=document.createElement('canvas');
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      if(!blob){setError('No se pudo guardar la foto.');return}
      const file=new File([blob],`swiftport-${Date.now()}-${shots.length+1}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
      setShots(current=>[...current,{id:`SHOT-${Date.now()}`,file,preview:URL.createObjectURL(file)}]);
      setError('');
    },'image/jpeg',.9);
  };
  const remove=id=>setShots(current=>{
    const target=current.find(shot=>shot.id===id);
    if(target)URL.revokeObjectURL(target.preview);
    return current.filter(shot=>shot.id!==id);
  });
  return <div className="modal-backdrop multi-photo-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal multi-photo-modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><span className="overline">Cámara continua</span><h2>{title}</h2><p>Haz todas las fotos seguidas y pulsa Usar fotos cuando termines.</p></div><button type="button" className="icon-button" onClick={close}><X/></button></div><div className="multi-photo-body"><div className="multi-photo-view"><video ref={videoRef} autoPlay playsInline muted/>{starting&&<span><RefreshCw className="spinning"/> Abriendo cámara…</span>}{error&&<span className="camera-error"><CircleAlert/>{error}</span>}</div><div className="multi-photo-counter"><Camera/><b>{shots.length} foto{shots.length===1?'':'s'} preparada{shots.length===1?'':'s'}</b><small>Puedes seguir disparando sin cerrar esta ventana.</small></div>{shots.length>0&&<div className="multi-photo-strip">{shots.map((shot,index)=><figure key={shot.id}><img src={shot.preview} alt={`Foto ${index+1}`}/><button type="button" onClick={()=>remove(shot.id)} aria-label={`Quitar foto ${index+1}`}><X/></button><figcaption>{index+1}</figcaption></figure>)}</div>}<div className="multi-photo-actions"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><label className="button secondary attachment-upload"><UploadCloud/> Elegir varias<input type="file" accept="image/*" multiple onChange={event=>{addFiles(event.target.files);event.target.value=''}}/></label><button type="button" className="button primary camera-shutter" disabled={starting||!streamRef.current} onClick={capture}><Camera/> Hacer otra foto</button><button type="button" className="button primary use-photos" disabled={!shots.length} onClick={()=>finish(shots.map(shot=>shot.file))}><CheckCircle2/> Usar {shots.length||''} foto{shots.length===1?'':'s'}</button></div></div></section></div>;
}
const bytesJoin=parts=>{
  const size=parts.reduce((total,part)=>total+part.length,0);
  const result=new Uint8Array(size);
  let offset=0;
  parts.forEach(part=>{result.set(part,offset);offset+=part.length});
  return result;
};
const imageFromFile=file=>new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer la fotografía del POD.'))};
  image.src=url;
});
const documentCorners=image=>{
  const maximum=640;
  const scale=Math.min(1,maximum/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,width,height);
  const pixels=context.getImageData(0,0,width,height).data;
  const histogram=new Uint32Array(256);
  for(let index=0;index<pixels.length;index+=4){
    const luminance=Math.round(pixels[index]*.299+pixels[index+1]*.587+pixels[index+2]*.114);
    histogram[luminance]++;
  }
  const total=width*height;
  let sum=0;
  for(let value=0;value<256;value++)sum+=value*histogram[value];
  let background=0,backgroundSum=0,best=-1,threshold=145;
  for(let value=0;value<256;value++){
    background+=histogram[value];
    if(!background)continue;
    const foreground=total-background;
    if(!foreground)break;
    backgroundSum+=value*histogram[value];
    const meanBackground=backgroundSum/background;
    const meanForeground=(sum-backgroundSum)/foreground;
    const variance=background*foreground*(meanBackground-meanForeground)**2;
    if(variance>best){best=variance;threshold=value}
  }
  threshold=Math.max(105,Math.min(205,threshold+8));
  const mask=new Uint8Array(total);
  for(let pixel=0;pixel<total;pixel++){
    const offset=pixel*4;
    const red=pixels[offset],green=pixels[offset+1],blue=pixels[offset+2];
    const luminance=red*.299+green*.587+blue*.114;
    const chroma=Math.max(red,green,blue)-Math.min(red,green,blue);
    if(luminance>=threshold&&chroma<105)mask[pixel]=1;
  }
  const queue=new Int32Array(total);
  let largest=null;
  for(let start=0;start<total;start++){
    if(!mask[start])continue;
    let head=0,tail=0,count=0;
    let tl={score:Infinity,x:0,y:0},tr={score:-Infinity,x:0,y:0},br={score:-Infinity,x:0,y:0},bl={score:Infinity,x:0,y:0};
    queue[tail++]=start;mask[start]=0;
    while(head<tail){
      const current=queue[head++],x=current%width,y=Math.floor(current/width);count++;
      const sumScore=x+y,difference=x-y;
      if(sumScore<tl.score)tl={score:sumScore,x,y};
      if(difference>tr.score)tr={score:difference,x,y};
      if(sumScore>br.score)br={score:sumScore,x,y};
      if(difference<bl.score)bl={score:difference,x,y};
      if(x>0&&mask[current-1]){mask[current-1]=0;queue[tail++]=current-1}
      if(x<width-1&&mask[current+1]){mask[current+1]=0;queue[tail++]=current+1}
      if(y>0&&mask[current-width]){mask[current-width]=0;queue[tail++]=current-width}
      if(y<height-1&&mask[current+width]){mask[current+width]=0;queue[tail++]=current+width}
    }
    if(!largest||count>largest.count)largest={count,corners:[tl,tr,br,bl]};
  }
  if(!largest||largest.count<total*.045)return null;
  const sourceScale=1/scale;
  const points=largest.corners.map(point=>({x:point.x*sourceScale,y:point.y*sourceScale}));
  const center=points.reduce((result,point)=>({x:result.x+point.x/4,y:result.y+point.y/4}),{x:0,y:0});
  return points.map(point=>({
    x:Math.max(0,Math.min(image.naturalWidth-1,center.x+(point.x-center.x)*1.012)),
    y:Math.max(0,Math.min(image.naturalHeight-1,center.y+(point.y-center.y)*1.012))
  }));
};
const distance=(first,second)=>Math.hypot(second.x-first.x,second.y-first.y);
async function scannedPodPdf(file,caseId){
  const source=await imageFromFile(file);
  const detected=documentCorners(source);
  const corners=detected||[
    {x:source.naturalWidth*.035,y:source.naturalHeight*.035},
    {x:source.naturalWidth*.965,y:source.naturalHeight*.035},
    {x:source.naturalWidth*.965,y:source.naturalHeight*.965},
    {x:source.naturalWidth*.035,y:source.naturalHeight*.965}
  ];
  const [topLeft,topRight,bottomRight,bottomLeft]=corners;
  const rawWidth=Math.max(distance(topLeft,topRight),distance(bottomLeft,bottomRight));
  const rawHeight=Math.max(distance(topLeft,bottomLeft),distance(topRight,bottomRight));
  const maximum=2200;
  const scale=Math.min(1,maximum/Math.max(rawWidth,rawHeight));
  const width=Math.max(1,Math.round(rawWidth*scale));
  const height=Math.max(1,Math.round(rawHeight*scale));
  const samplingScale=Math.min(1,2800/Math.max(source.naturalWidth,source.naturalHeight));
  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=Math.max(1,Math.round(source.naturalWidth*samplingScale));sourceCanvas.height=Math.max(1,Math.round(source.naturalHeight*samplingScale));
  const sourceContext=sourceCanvas.getContext('2d',{willReadFrequently:true});
  sourceContext.drawImage(source,0,0,sourceCanvas.width,sourceCanvas.height);
  const sourcePixels=sourceContext.getImageData(0,0,sourceCanvas.width,sourceCanvas.height).data;
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{alpha:false});
  const output=context.createImageData(width,height);
  const [sampleTopLeft,sampleTopRight,sampleBottomRight,sampleBottomLeft]=corners.map(point=>({x:point.x*samplingScale,y:point.y*samplingScale}));
  const dx1=sampleTopRight.x-sampleBottomRight.x,dx2=sampleBottomLeft.x-sampleBottomRight.x,dx3=sampleTopLeft.x-sampleTopRight.x+sampleBottomRight.x-sampleBottomLeft.x;
  const dy1=sampleTopRight.y-sampleBottomRight.y,dy2=sampleBottomLeft.y-sampleBottomRight.y,dy3=sampleTopLeft.y-sampleTopRight.y+sampleBottomRight.y-sampleBottomLeft.y;
  const denominator=dx1*dy2-dx2*dy1;
  const projectiveG=Math.abs(denominator)<.0001?0:(dx3*dy2-dx2*dy3)/denominator;
  const projectiveH=Math.abs(denominator)<.0001?0:(dx1*dy3-dx3*dy1)/denominator;
  const a=sampleTopRight.x-sampleTopLeft.x+projectiveG*sampleTopRight.x;
  const b=sampleBottomLeft.x-sampleTopLeft.x+projectiveH*sampleBottomLeft.x;
  const c=sampleTopLeft.x;
  const d=sampleTopRight.y-sampleTopLeft.y+projectiveG*sampleTopRight.y;
  const e=sampleBottomLeft.y-sampleTopLeft.y+projectiveH*sampleBottomLeft.y;
  const f=sampleTopLeft.y;
  for(let y=0;y<height;y++){
    const vertical=height===1?0:y/(height-1);
    for(let x=0;x<width;x++){
      const horizontal=width===1?0:x/(width-1);
      const divisor=projectiveG*horizontal+projectiveH*vertical+1;
      const sourceX=Math.max(0,Math.min(sourceCanvas.width-1,Math.round((a*horizontal+b*vertical+c)/divisor)));
      const sourceY=Math.max(0,Math.min(sourceCanvas.height-1,Math.round((d*horizontal+e*vertical+f)/divisor)));
      const sourceOffset=(sourceY*sourceCanvas.width+sourceX)*4;
      const targetOffset=(y*width+x)*4;
      const base=sourcePixels[sourceOffset]*.299+sourcePixels[sourceOffset+1]*.587+sourcePixels[sourceOffset+2]*.114;
      const lifted=Math.max(0,Math.min(255,(base-24)*1.48+24));
      const cleaned=lifted>224?255:lifted<74?0:Math.max(0,Math.min(255,(lifted-128)*1.18+128));
      output.data[targetOffset]=cleaned;output.data[targetOffset+1]=cleaned;output.data[targetOffset+2]=cleaned;output.data[targetOffset+3]=255;
    }
  }
  context.putImageData(output,0,0);
  const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo preparar el escaneo.')),'image/jpeg',.9));
  const jpegBytes=new Uint8Array(await jpeg.arrayBuffer());
  const encoder=new TextEncoder();
  const portrait=height>=width;
  const pageWidth=portrait?595:842;
  const pageHeight=portrait?842:595;
  const margin=24;
  const ratio=Math.min((pageWidth-margin*2)/width,(pageHeight-margin*2)/height);
  const drawWidth=Math.round(width*ratio*100)/100;
  const drawHeight=Math.round(height*ratio*100)/100;
  const left=Math.round((pageWidth-drawWidth)/2*100)/100;
  const bottom=Math.round((pageHeight-drawHeight)/2*100)/100;
  const content=encoder.encode(`q\n${drawWidth} 0 0 ${drawHeight} ${left} ${bottom} cm\n/Scan Do\nQ\n`);
  const objects=[
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Scan 4 0 R >> >> /Contents 5 0 R >>`),
    bytesJoin([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),jpegBytes,encoder.encode('\nendstream')]),
    bytesJoin([encoder.encode(`<< /Length ${content.length} >>\nstream\n`),content,encoder.encode('endstream')])
  ];
  const parts=[encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets=[0];
  let position=parts[0].length;
  objects.forEach((object,index)=>{
    offsets.push(position);
    const wrapped=bytesJoin([encoder.encode(`${index+1} 0 obj\n`),object,encoder.encode('\nendobj\n')]);
    parts.push(wrapped);
    position+=wrapped.length;
  });
  const xrefPosition=position;
  const xref=['xref',`0 ${objects.length+1}`,'0000000000 65535 f '];
  offsets.slice(1).forEach(offset=>xref.push(`${String(offset).padStart(10,'0')} 00000 n `));
  xref.push('trailer',`<< /Size ${objects.length+1} /Root 1 0 R >>`,'startxref',String(xrefPosition),'%%EOF');
  parts.push(encoder.encode(xref.join('\n')));
  return new File([bytesJoin(parts)],`POD-${String(caseId||'EXPEDIENTE').replace(/[^a-z0-9-]/gi,'_')}.pdf`,{type:'application/pdf'});
}
const localDateTimeValue=()=>{
  const date=new Date();
  date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
  return date.toISOString().slice(0,16);
};
const formatReceptionDate=value=>value?new Date(String(value).replace(' ','T')).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sin fecha';
const documentLabel=name=>{
  const normalized=String(name||'').toLowerCase();
  if(normalized.includes('packing'))return 'PACKING LIST';
  if(normalized.includes('cmr'))return 'CMR';
  if(normalized.includes('delivery')||normalized.includes('albar'))return 'DELIVERY NOTE';
  return 'DOCUMENTO DE RECEPCIÓN';
};
const attachmentKey=file=>typeof file==='string'?file:String(file?.id||file?.url||file?.dataUrl||file?.href||file?.src||file?.name||'');
const sameAttachment=(file,target)=>attachmentKey(file)&&attachmentKey(file)===attachmentKey(target);
const mergeAttachments=(existing=[],incoming=[])=>[...(existing||[]),...(incoming||[])].filter((file,index,list)=>file&&attachmentKey(file)&&list.findIndex(entry=>sameAttachment(entry,file))===index);
const attachmentUrl=file=>typeof file==='string'?file:(file?.url||file?.dataUrl||file?.href||file?.src||'');
const attachmentName=(file,fallback='Archivo')=>typeof file==='string'?fallback:(file?.name||file?.fileName||file?.tipo||fallback);
const HOLD_STATUS_ORDER={'Borrador':1,'Revisar':2,'Listo para enviar':3,'Enviado a Holded':4,'Facturado':5,'Cobrado':6};
const hasHoldedProof=invoice=>Boolean(invoice?.holdedId||invoice?.holdedNumber||invoice?.holdedAt||invoice?.holdedStatus||['Enviado a Holded','Facturado','Cobrado'].includes(invoice?.estado));
const normalizeHoldedStatus=invoice=>hasHoldedProof(invoice)&&(HOLD_STATUS_ORDER[invoice?.estado]||0)<HOLD_STATUS_ORDER['Enviado a Holded']?{...invoice,estado:'Enviado a Holded'}:invoice;
const protectHoldedInvoice=(previous,next)=>{
  next=normalizeHoldedStatus(next);
  if(!previous)return next;
  previous=normalizeHoldedStatus(previous);
  if(!hasHoldedProof(previous))return next;
  const previousRank=HOLD_STATUS_ORDER[previous.estado]||0;
  const nextRank=HOLD_STATUS_ORDER[next?.estado]||0;
  const protectedStatus=nextRank>=previousRank?next.estado:previous.estado;
  return {
    ...next,
    estado:protectedStatus,
    holdedStatus:next.holdedStatus||previous.holdedStatus,
    holdedDocType:next.holdedDocType||previous.holdedDocType,
    holdedId:next.holdedId||previous.holdedId,
    holdedNumber:next.holdedNumber||previous.holdedNumber,
    holdedAt:next.holdedAt||previous.holdedAt
  };
};
const protectFinanceHoldedState=(previous,next)=>{
  const previousInvoices=previous?.invoices||[];
  const nextInvoices=(next?.invoices||[]).map(invoice=>{
    const previousInvoice=previousInvoices.find(item=>item.id===invoice.id||item.expediente===invoice.expediente);
    return protectHoldedInvoice(previousInvoice,invoice);
  });
  return {...next,invoices:nextInvoices};
};
function AuthRoot(){
  const [session,setSession]=useState(null);
  const [setupRequired,setSetupRequired]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [finance,setFinance]=useState({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});
  const financeRef=useRef(finance);
  useEffect(()=>{financeRef.current=finance},[finance]);
  const loadSession=async()=>{
    setLoading(true);setError('');
    if(LOCAL_DESIGN_MODE){
      setFinance(demoFinance());setSession({authenticated:true,csrfToken:'local-design',demo:true,user:DEMO_USER});setSetupRequired(false);setError('');setLoading(false);return;
    }
    try{
      const result=await api('/api/auth/me.php');
      if(result.authenticated&&result.user){setSession(result);setSetupRequired(false)}
      else{setSession(null);setSetupRequired(Boolean(result.setupRequired))}
    }catch(reason){
      if(reason.status===401){setSession(null);setSetupRequired(Boolean(reason.body?.setupRequired))}
      else setError(reason.message);
    }finally{setLoading(false)}
  };
  useEffect(()=>{loadSession()},[]);
  useEffect(()=>{
    if(session?.demo){setFinance(demoFinance());return}
    if(!session||!(hasRole(session.user,'finance')||hasRole(session.user,'admin'))){setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});return}
    api('/api/finance.php').then(setFinance).catch(reason=>setError(reason.message));
  },[session?.user?.id,JSON.stringify(session?.user?.roles||[])]);
  const authenticated=result=>{if(!result?.user) throw new Error('Respuesta de acceso inválida.');setSession(result);setSetupRequired(false);setError('')};
  const enterDesignMode=()=>{setFinance(demoFinance());setSession({authenticated:true,csrfToken:'local-design',demo:true,user:DEMO_USER});setSetupRequired(false);setError('')};
  const logout=async()=>{
    if(session?.demo){setSession(null);setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});return}
    try{await api('/api/auth/logout.php',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken}})}
    finally{setSession(null);setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]})}
  };
  const updateFinance=async next=>{const protectedNext=protectFinanceHoldedState(financeRef.current,next);financeRef.current=protectedNext;setFinance(protectedNext);if(session?.demo)return;await api('/api/finance.php',{method:'PUT',headers:{'X-CSRF-Token':session.csrfToken},body:jsonBody({clients:protectedNext.clients,invoices:protectedNext.invoices})})};
  if(loading) return <AuthShell><div className="auth-loading"><span className="auth-spinner"/><b>Preparando Swiftport OS…</b></div></AuthShell>;
  if(!session) return <AuthShell>{setupRequired?<SetupForm onSuccess={authenticated} globalError={error}/>:<LoginForm onSuccess={authenticated} globalError={error} localDesign={LOCAL_DESIGN_MODE} onDesignMode={enterDesignMode}/>}</AuthShell>;
  return <App auth={session} finance={finance} onFinanceChange={updateFinance} onLogout={logout}/>;
}
function AuthShell({children}){
  return <main className="auth-page"><section className="auth-brand"><span className="brand-mark"><Anchor/></span><div><b>SWIFTPORT</b><small>OPERATING SYSTEM</small></div></section>{children}<p className="auth-footer">Acceso privado  -  Swiftport Logistic</p></main>;
}
function LoginForm({onSuccess,globalError,localDesign=false,onDesignMode}){
  const [form,setForm]=useState({email:'',password:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{onSuccess(await api('/api/auth/login.php',{method:'POST',body:jsonBody(form)}))}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <section className="auth-card"><span className="auth-icon"><LockKeyhole/></span><h1>Iniciar sesión</h1><p>Accede con tu cuenta de Swiftport.</p>{(error||globalError)&&<div className="form-error"><CircleAlert/>{error||globalError}</div>}<form onSubmit={submit}><label className="field"><span>Email</span><input type="email" autoComplete="username" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} required autoFocus/></label><label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} required/></label><button className="button primary full" disabled={busy}>{busy?'Comprobando…':'Entrar'}</button></form></section>;
}
function SetupForm({onSuccess,globalError}){
  const [form,setForm]=useState({fullName:'',email:'',password:'',setupToken:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{onSuccess(await api('/api/auth/setup.php',{method:'POST',body:jsonBody(form)}))}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <section className="auth-card setup-card"><span className="auth-icon"><ShieldCheck/></span><h1>Crear administrador</h1><p>Solo aparece una vez. Crea la primera cuenta con control total.</p>{(error||globalError)&&<div className="form-error"><CircleAlert/>{error||globalError}</div>}<form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required autoFocus/></label><label className="field"><span>Email</span><input name="email" type="email" autoComplete="username" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña (mínimo 4 caracteres)</span><input name="password" type="password" autoComplete="new-password" minLength="4" value={form.password} onChange={update} required/></label><label className="field"><span>Código inicial</span><input name="setupToken" type="password" autoComplete="off" value={form.setupToken} onChange={update} required/></label><button className="button primary full" disabled={busy}>{busy?'Creando cuenta…':'Crear administrador'}</button></form></section>;
}
function App({auth,finance,onFinanceChange,onLogout}){
  const user=auth.user;
  const [colorTheme,setColorTheme]=useState(INITIAL_COLOR_THEME);
  useEffect(()=>{document.documentElement.dataset.theme=colorTheme;document.documentElement.style.colorScheme=colorTheme;try{localStorage.setItem(THEME_STORAGE_KEY,colorTheme)}catch{}},[colorTheme]);
  useEffect(()=>{
    sanitizeVisibleDomEncoding();
    if(typeof document==='undefined'||typeof MutationObserver==='undefined')return undefined;
    const queueFrame=typeof requestAnimationFrame==='function'?requestAnimationFrame:callback=>setTimeout(callback,0);
    const cancelFrame=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:clearTimeout;
    let frame=null;
    const scheduleSanitizer=()=>{
      if(frame!==null)return;
      frame=queueFrame(()=>{
        frame=null;
        sanitizeVisibleDomEncoding();
      });
    };
    const observer=new MutationObserver(scheduleSanitizer);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return ()=>{
      observer.disconnect();
      if(frame!==null)cancelFrame(frame);
    };
  },[]);
  const [previewUser,setPreviewUser]=useState(null);
  const visibleUser=previewUser||user;
  const actorName=user?.fullName||'Swiftport';
  const effectiveRoles=rolesOf(visibleUser);
  const driverOnly=isDriverOnly(effectiveRoles);
  const showFinance=hasRole(effectiveRoles,'finance')||hasRole(effectiveRoles,'admin');
  const availableNav=NAV.filter(([id])=>canAccess(effectiveRoles,id));
  const [tab,setTab]=useState(isDriverOnly(user)?'calendario':'dashboard');
  const [menuOpen,setMenuOpen]=useState(false);
  const [newOpen,setNewOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [cases,setCases]=useState(expedientesIniciales.map(normalizeMerchandise));
  const [selectedId,setSelectedId]=useState(expedientesIniciales[0].id);
  const [transports,setTransports]=useState(transportesIniciales);
  const [warehouseEntries,setWarehouseEntries]=useState(movimientosAlmacen);
  const [customs,setCustoms]=useState(tramitesAduana);
  const [calendarEvents,setCalendarEvents]=useState(eventosCalendarioIniciales);
  const [providers,setProviders]=useState(proveedoresIniciales);
  const [vessels,setVessels]=useState(()=>mergeVesselCatalog([],expedientesIniciales));
  const [deletedVesselKeys,setDeletedVesselKeys]=useState([]);
  const [team,setTeam]=useState([]);
  const [clientOptions,setClientOptions]=useState(clientNames);
  const [operationalLoaded,setOperationalLoaded]=useState(false);
  const [toast,setToast]=useState('');
  const operationalSaveInFlight=useRef(false);
  const aisAlertSnapshotRef=useRef(null);
  const [alertTick,setAlertTick]=useState(Date.now());
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [notificationLog,setNotificationLog]=useState([]);
  const [deliveryPopup,setDeliveryPopup]=useState(null);
  const [alertSoundSettings,setAlertSoundSettings]=useState(()=>loadAlertSoundSettings());
  const updateAlertSoundSettings=patch=>{
    setAlertSoundSettings(previous=>saveAlertSoundSettings({...previous,...patch}));
  };
  const [acknowledgedDeliveryAlerts,setAcknowledgedDeliveryAlerts]=useState({});
  const [acknowledgedBillingAlerts,setAcknowledgedBillingAlerts]=useState({});
  const casesWithFinance=useMemo(()=>cases.map(item=>({...item,importe:finance.caseAmounts[item.id]||0})),[cases,finance.caseAmounts]);
  const selected=casesWithFinance.find(item=>item.id===selectedId)||casesWithFinance[0];
  const notify=message=>{setToast(message);window.clearTimeout(window.__swiftportToast);window.__swiftportToast=window.setTimeout(()=>setToast(''),2600)};
  const navigate=id=>{setTab(canAccess(effectiveRoles,id)?id:(availableNav[0]?.[0]||'dashboard'));setMenuOpen(false);setSearch('')};
  useEffect(()=>{try{localStorage.removeItem(`swiftport-driver-alerts-${user.id}`)}catch{}},[user.id]);
  useEffect(()=>{try{setNotificationLog(JSON.parse(localStorage.getItem(`swiftport-notification-log-${user.id}`)||'[]')||[])}catch{setNotificationLog([])}},[user.id]);
  useEffect(()=>{try{setAcknowledgedDeliveryAlerts(JSON.parse(localStorage.getItem(`swiftport-delivery-alert-ack-${user.id}`)||'{}')||{})}catch{setAcknowledgedDeliveryAlerts({})}},[user.id]);
  useEffect(()=>{try{setAcknowledgedBillingAlerts(JSON.parse(localStorage.getItem(`swiftport-billing-alert-ack-${user.id}`)||'{}')||{})}catch{setAcknowledgedBillingAlerts({})}},[user.id]);
  useEffect(()=>{const timer=window.setInterval(()=>setAlertTick(Date.now()),300000);return()=>window.clearInterval(timer)},[]);
  const loadTeam=()=>api('/api/users/directory.php').then(result=>setTeam(result.users)).catch(reason=>notify(reason.message));
  const loadOperational=()=>operationalSaveInFlight.current?Promise.resolve():api('/api/operational.php').then(result=>{
    if(result.data){
      const loadedCases=result.data.cases.map(normalizeMerchandise);
      const completedCaseIds=new Set(loadedCases.filter(item=>operationFlow(item).billingReady||item.estado==='Completado').map(item=>item.id));
      const loadedTransports=(result.data.transports||[]).map(item=>completedCaseIds.has(item.expediente)?{...item,estado:'Entregado'}:item);
      const hiddenVessels=Array.isArray(result.data.deletedVesselKeys)?result.data.deletedVesselKeys.filter(Boolean):[];
      const loadedVessels=mergeVesselCatalog(Array.isArray(result.data.vessels)?result.data.vessels:[],loadedCases).filter(vessel=>!hiddenVessels.includes(vesselKey(vessel.name)));
      setDeletedVesselKeys(hiddenVessels);setCases(loadedCases.map(item=>hydrateCaseWithVessel(item,loadedVessels)));setVessels(loadedVessels);setTransports(loadedTransports);setWarehouseEntries(result.data.warehouseEntries);if(result.data.customs)setCustoms(result.data.customs);if(result.data.calendarEvents)setCalendarEvents(result.data.calendarEvents.filter(isTransportCalendarEvent));if(Array.isArray(result.data.providers))setProviders(result.data.providers)
    }
    setOperationalLoaded(true)
  }).catch(reason=>{setOperationalLoaded(true);notify(reason.message)});
  useEffect(()=>{const baseClientOptions=mergeClientProfiles(clientNames.map(nombre=>({nombre}))).map(item=>item.nombre);if(auth.demo){setTeam(DEMO_TEAM);setClientOptions(baseClientOptions);setOperationalLoaded(true);return}loadTeam();api('/api/clients/directory.php').then(result=>setClientOptions([...new Set([...baseClientOptions,...result.clients.map(item=>item.name)])])).catch(()=>setClientOptions(baseClientOptions));loadOperational();const timer=window.setInterval(loadOperational,45000);window.addEventListener('focus',loadOperational);return()=>{window.clearInterval(timer);window.removeEventListener('focus',loadOperational)}},[]);
  const ensureClientOption=async name=>{
    const client=String(name||'').trim();
    if(!client)return '';
    const exists=clientOptions.some(item=>item.toLowerCase()===client.toLowerCase());
    if(exists)return clientOptions.find(item=>item.toLowerCase()===client.toLowerCase())||client;
    if(auth.demo){const saved=client.toUpperCase();setClientOptions(options=>options.some(item=>item.toLowerCase()===saved.toLowerCase())?options:[...options,saved].sort((a,b)=>a.localeCompare(b,'es')));return saved}
    const result=await api('/api/clients/directory.php',{method:'POST',headers:{'X-CSRF-Token':auth.csrfToken},body:jsonBody({name:client})});
    const saved=result.client?.name||client.toUpperCase();
    setClientOptions(options=>options.some(item=>item.toLowerCase()===saved.toLowerCase())?options:[...options,saved].sort((a,b)=>a.localeCompare(b,'es')));
    return saved;
  };
  useEffect(()=>{
    if(!operationalLoaded)return;
    const storageKey=`swiftport-ais-alerts-${user.id}`;
    let previous=aisAlertSnapshotRef.current;
    let hadSnapshot=previous!==null;
    if(previous===null){try{const stored=localStorage.getItem(storageKey);previous=stored?JSON.parse(stored):{};hadSnapshot=stored!==null}catch{previous={}}}
    const current={};
    const alerts=[];
    cases.forEach(item=>{
      const tracking=item.aisTracking||{};
      if(!tracking.alertKey)return;
      current[item.id]=tracking.alertKey;
      const visibleToDriver=!hasRole(user,'driver')||calendarEvents.some(event=>isActiveTransportCalendarEvent(event)&&event.expediente===item.id&&(!event.asignado||event.asignado==='Sin asignar'||samePerson(event.asignado,user.fullName)));
      if(hadSnapshot&&visibleToDriver&&previous[item.id]!==tracking.alertKey)alerts.push({item,tracking});
    });
    aisAlertSnapshotRef.current=current;
    try{localStorage.setItem(storageKey,JSON.stringify(current))}catch{}
    if(!alerts.length)return;
    const {item,tracking}=alerts[0];
    const message=tracking.alertMessage||`${item.buque}: ${tracking.status}.`;
    notify(message);
    if(localStorage.getItem('swiftport-device-alerts')==='1')showDeviceNotification(`Swiftport  -  ${item.buque}`,message,tracking.alertKey).catch(()=>{});
  },[cases,calendarEvents,operationalLoaded]);
  const rawDeliveryAlerts=useMemo(()=>deliveryAlertsForSchedule(calendarEvents,cases,visibleUser,new Date(alertTick)),[calendarEvents,cases,visibleUser,alertTick]);
  const deliveryAlerts=useMemo(()=>rawDeliveryAlerts.filter(alert=>!acknowledgedDeliveryAlerts[alert.key]),[rawDeliveryAlerts,acknowledgedDeliveryAlerts]);
  const rawBillingAlerts=useMemo(()=>billingAlertsForCases(casesWithFinance,finance.invoices,visibleUser,new Date(alertTick)),[casesWithFinance,finance.invoices,visibleUser,alertTick]);
  const billingAlerts=useMemo(()=>rawBillingAlerts.filter(alert=>!acknowledgedBillingAlerts[alert.key]),[rawBillingAlerts,acknowledgedBillingAlerts]);
  const activeNotifications=useMemo(()=>[...deliveryAlerts,...billingAlerts].sort((first,second)=>(first.moment?.getTime?.()||0)-(second.moment?.getTime?.()||0)),[deliveryAlerts,billingAlerts]);
  const acknowledgeDeliveryAlert=alert=>{
    if(!alert?.key)return;
    setAcknowledgedDeliveryAlerts(previous=>{
      const next={...previous,[alert.key]:new Date().toISOString()};
      try{localStorage.setItem(`swiftport-delivery-alert-ack-${user.id}`,JSON.stringify(next))}catch{}
      return next;
    });
    setDeliveryPopup(current=>current?.key===alert.key?null:current);
  };
  const acknowledgeBillingAlert=alert=>{
    if(!alert?.key)return;
    setAcknowledgedBillingAlerts(previous=>{
      const next={...previous,[alert.key]:new Date().toISOString()};
      try{localStorage.setItem(`swiftport-billing-alert-ack-${user.id}`,JSON.stringify(next))}catch{}
      return next;
    });
    setDeliveryPopup(current=>current?.key===alert.key?null:current);
  };
  const acknowledgeOperationalAlert=alert=>alert?.type==='billing'?acknowledgeBillingAlert(alert):acknowledgeDeliveryAlert(alert);
  useEffect(()=>{
    if(!operationalLoaded||!deliveryAlerts.length)return;
    const storageKey=`swiftport-delivery-alerts-${user.id}`;
    let sent={};
    try{sent=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{sent={}}
    const now=new Date();
    const fresh=deliveryAlerts.filter(alert=>{
      const previous=sent[alert.key]?new Date(sent[alert.key]).getTime():0;
      return !previous||now.getTime()-previous>=deliveryAlertRepeatMs(alert);
    }).slice(0,4);
    if(!fresh.length)return;
    const wasAlreadySent=Object.fromEntries(fresh.map(alert=>[alert.key,Boolean(sent[alert.key])]));
    fresh.forEach(alert=>{sent[alert.key]=now.toISOString()});
    try{localStorage.setItem(storageKey,JSON.stringify(sent))}catch{}
    const entries=fresh.map(alert=>({id:`${alert.key}-${now.getTime()}`,alertKey:alert.key,type:'delivery',title:wasAlreadySent[alert.key]?'Recordatorio pendiente':'Aviso de entrega',message:alert.message,createdAt:now.toISOString(),caseId:alert.case?.id||alert.event?.expediente||'',vessel:alert.case?.buque||alert.event?.titulo||'',rule:alert.rule?.label||''}));
    setNotificationLog(previous=>{const next=[...entries,...previous].slice(0,100);try{localStorage.setItem(`swiftport-notification-log-${user.id}`,JSON.stringify(next))}catch{}return next});
    setDeliveryPopup(fresh[0]);
    playAlertSound(alertSoundSettings).catch(()=>{});
    notify(fresh.length===1?fresh[0].message:`${fresh.length} avisos de entrega activos. Revisa el calendario.`);
    if(localStorage.getItem('swiftport-device-alerts')==='1'){
      fresh.forEach(alert=>showDeviceNotification('Swiftport entrega',alert.message,alert.key).catch(()=>{}));
    }
  },[deliveryAlerts,operationalLoaded,user.id,alertSoundSettings]);
  useEffect(()=>{
    if(!operationalLoaded||!billingAlerts.length)return;
    const storageKey=`swiftport-billing-alerts-${user.id}`;
    let sent={};
    try{sent=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{sent={}}
    const now=new Date();
    const fresh=billingAlerts.filter(alert=>{
      const previous=sent[alert.key]?new Date(sent[alert.key]).getTime():0;
      return !previous||now.getTime()-previous>=BILLING_ALERT_REPEAT_MS;
    }).slice(0,4);
    if(!fresh.length)return;
    const wasAlreadySent=Object.fromEntries(fresh.map(alert=>[alert.key,Boolean(sent[alert.key])]));
    fresh.forEach(alert=>{sent[alert.key]=now.toISOString()});
    try{localStorage.setItem(storageKey,JSON.stringify(sent))}catch{}
    const entries=fresh.map(alert=>({id:`${alert.key}-${now.getTime()}`,alertKey:alert.key,type:'billing',title:wasAlreadySent[alert.key]?'Recordatorio facturación':'Listo para facturar',message:alert.message,createdAt:now.toISOString(),caseId:alert.case?.id||'',vessel:alert.case?.buque||'',rule:alert.rule?.label||''}));
    setNotificationLog(previous=>{const next=[...entries,...previous].slice(0,100);try{localStorage.setItem(`swiftport-notification-log-${user.id}`,JSON.stringify(next))}catch{}return next});
    setDeliveryPopup(fresh[0]);
    playAlertSound(alertSoundSettings).catch(()=>{});
    notify(fresh.length===1?fresh[0].message:`${fresh.length} expedientes listos para facturar.`);
    if(localStorage.getItem('swiftport-device-alerts')==='1'){
      fresh.forEach(alert=>showDeviceNotification('Swiftport facturación',alert.message,alert.key).catch(()=>{}));
    }
  },[billingAlerts,operationalLoaded,user.id,alertSoundSettings]);
  const persistOperational=async(nextCases=cases,nextTransports=transports,nextWarehouse=warehouseEntries,nextCustoms=customs,nextCalendar=calendarEvents,nextProviders=providers,nextVessels=vessels,nextDeletedVesselKeys=deletedVesselKeys,auditEvent=null)=>{
    operationalSaveInFlight.current=true;
    try{
      if(auth.demo)return {ok:true};
      return await api('/api/operational.php',{method:'PUT',headers:{'X-CSRF-Token':auth.csrfToken},body:jsonBody({data:{cases:nextCases,transports:nextTransports,warehouseEntries:nextWarehouse,customs:nextCustoms,calendarEvents:nextCalendar,providers:nextProviders,vessels:nextVessels,deletedVesselKeys:nextDeletedVesselKeys},audit:auditEvent})});
    }finally{
      operationalSaveInFlight.current=false;
    }
  };
  const saveOperational=(...args)=>persistOperational(...args).catch(reason=>notify(reason.message));
  const operationalTeam=useMemo(()=>team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver')),[team]);
  useEffect(()=>{if(driverOnly&&!['calendario','almacen'].includes(tab))setTab('calendario')},[driverOnly,tab]);
  useEffect(()=>{
    if(!operationalLoaded)return;
    const cleanupMoment=new Date().toISOString();
    let archivedSurveyEntries=0;
    const cleanedWarehouse=warehouseEntries.map(entry=>{
      if(!isSurveyWarehouseEntry(entry,cases))return entry;
      if(entry.hiddenFromWarehouse&&entry.archivado&&entry.estado==='Expedido')return entry;
      archivedSurveyEntries+=1;
      return {...entry,archivado:true,estado:'Expedido',hiddenFromWarehouse:true,archiveReason:'survey_samples',salida:entry.salida||cleanupMoment};
    });
    const missing=cases.flatMap((item,index)=>{
      if(isSurveyService(item))return[];
      if(cleanedWarehouse.some(entry=>entry.expediente===item.id))return[];
      const reception=(item.recepciones||[])[0];
      if(!reception)return[];
      const merchandise=(reception.mercancias||[]).length?reception.mercancias:(item.mercancias||[]);
      if(!(reception.fotos||[]).length&&!merchandise.length)return[];
      const completed=item.estado==='Completado';
      return [{
        ref:String(reception.ref||'').startsWith('ALM-')?reception.ref:`ALM-${Date.now()}-${index+1}`,
        expediente:item.id,
        sinExpediente:false,
        buque:item.buque,
        zona:reception.zona||'PENDIENTE',
        entrada:formatReceptionDate(reception.fecha||new Date().toISOString()),
        fechaRecepcion:reception.fecha||new Date().toISOString(),
        bultos:merchandiseCount(merchandise)||Math.max(1,Number(item.bultos)||1),
        peso:reception.peso||merchandiseWeightLabel(merchandise),
        mercancias:merchandise,
        fotos:reception.fotos||[],
        documentosRecepcion:reception.documentos||[],
        dias:0,
        estado:completed?'Expedido':'En stock',
        archivado:completed
      }];
    });
    if(!missing.length&&!archivedSurveyEntries)return;
    const next=[...missing,...cleanedWarehouse];
    setWarehouseEntries(next);
    saveOperational(cases,transports,next);
    if(missing.length)notify(`${missing.length} ${missing.length===1?'recepción sincronizada':'recepciones sincronizadas'} con Almacén`);
    else notify(`${archivedSurveyEntries} ${archivedSurveyEntries===1?'entrada antigua de SURVEY / MUESTRAS archivada':'entradas antiguas de SURVEY / MUESTRAS archivadas'}`);
  },[operationalLoaded]);
  useEffect(()=>{
    if(!operationalLoaded||!team.length)return;
    const names=new Set(operationalTeam.map(member=>member.fullName));
    const normalizedCalendar=calendarEvents.filter(isTransportCalendarEvent).map(event=>{const synced=calendarEventWithCaseSlot(event,cases);const asignado=synced.asignado!=='Sin asignar'&&!names.has(synced.asignado)?'Sin asignar':synced.asignado;return {...synced,asignado,tipoServicio:synced.tipoServicio||'Transporte',color:calendarTone(synced,cases)}});
    const normalized=transports.map(item=>{const linked=normalizedCalendar.find(event=>event.transporte===item.id);if(isCancelledTransport(item)||isCancelledTransport(linked))return {...item,conductor:'Sin asignar',estado:'Cancelado',cancellation:item.cancellation||linked?.cancellation};const conductor=item.conductor!=='Sin asignar'&&!names.has(item.conductor)?'Sin asignar':linked?.asignado||item.conductor;return linked?{...item,conductor,fecha:linked.fecha,inicio:linked.inicio,fin:linked.fin,hora:formatSchedule(linked.fecha,linked.inicio,linked.fin),estado:conductor==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:{...item,conductor,estado:conductor==='Sin asignar'?'Sin asignar':item.estado}});
    const changed=normalized.some((item,index)=>JSON.stringify(item)!==JSON.stringify(transports[index]))||normalizedCalendar.some((item,index)=>item.color!==calendarEvents[index]?.color);
    if(changed){setTransports(normalized);setCalendarEvents(normalizedCalendar);saveOperational(cases,normalized,warehouseEntries,customs,normalizedCalendar)}
  },[operationalLoaded,team.length]);
  const openCase=id=>{setSelectedId(id);navigate('expedientes')};
  const createCase=async form=>{
    const vessel=String(form.buque||'').trim().toUpperCase();
    if(!vessel){notify('Indica el buque para crear el expediente');return}
    let cliente='';
    try{cliente=await ensureClientOption(form.cliente)}
    catch(reason){notify('No se pudo crear el cliente: '+reason.message);return}
    if(!cliente){notify('Indica el cliente para crear el expediente');return}
    const nextNumber=Math.max(0,...cases.map(entry=>Number(String(entry.id||'').match(/^SW-2026-(\d+)$/)?.[1]||0)))+1;
    const id='SW-2026-'+String(nextNumber).padStart(4,'0');
    const etaDate=String(form.etaDate||form.eta||'').slice(0,10);
    const etaTime=String(form.etaTime||'')||String(form.eta||'').slice(11,16);
    const etbDate=String(form.etbDate||'').slice(0,10);
    const etbTime=String(form.etbTime||'');
    const etdDate=String(form.etdDate||'').slice(0,10);
    const etdTime=String(form.etdTime||'');
    const portSlot=etbDate?{date:etbDate,start:etbTime,source:'ETB'}:(etaDate?{date:etaDate,start:etaTime,source:'ETA'}:{date:'',start:'',source:''});
    const known=findKnownVessel(vessels,vessel)||{};
    const surveyService=form.serviceType==='survey_samples';
    const item=normalizeMerchandise({id,buque:vessel,imo:cleanImo(form.imo)||known.imo||'',mmsi:cleanMmsi(form.mmsi)||known.mmsi||'',cliente,puerto:form.puerto,eta:etaDate||'Por confirmar',portCall:{etaDate,etaTime,etbDate,etbTime,etdDate,etdTime,updatedAt:new Date().toISOString()},serviceType:form.serviceType||'vessel_delivery',estado:'Nuevo',prioridad:form.prioridad,conductor:'Sin asignar',servicios:[surveyService&&'Survey / muestras a bordo',!surveyService&&form.createReception&&'Recepción',form.createTransport&&(surveyService?'Survey':'Transporte')].filter(Boolean),bultos:surveyService?0:Number(form.bultos)||0,peso:surveyService?'No aplica':(String(form.pesoEstimado||'').trim()||'Por registrar'),progreso:0,siguiente:surveyService?'Revisar servicio y agendar surveyor':'Revisar expediente y servicios programados',aduana:surveyService?'No aplica':'Por revisar',autoTransportDisabled:false,manualVesselName:true,manualEditedAt:new Date().toISOString()});
    const stamp=Date.now();
    const receptionEvent=form.createReception&&form.receptionDate?{id:`EV-${stamp}-R`,titulo:form.receptionLocation||'Recepción en almacén',tipoServicio:'Recepción',fecha:form.receptionDate,inicio:form.receptionStart,fin:form.receptionEnd,asignado:'Sin asignar',expediente:id,transporte:'',color:'gray'}:null;
    const transportDate=form.transportDateManual?form.transportDate:(form.transportDate||portSlot.date);
    const transportStart=form.transportStartManual?form.transportStart:(form.transportStart||portSlot.start);
    const transportEnd=form.transportEnd||transportStart&&plusHourClient(transportStart)||'';
    const scheduleSource=form.transportDateManual?'manual':(portSlot.source||'manual');
    const shouldCreateTransport=Boolean(form.createTransport&&transportDate);
    const transportId=shouldCreateTransport?`TR-${stamp}`:'';
    const route=[form.transportPickup,form.transportDelivery].filter(Boolean).join(' → ')||(surveyService?`SURVEYOR → BUQUE ${vessel}  -  ${form.puerto}`:`ALMACÉN → ${form.puerto}`);
    const assignedDriver=form.transportConductor||'Sin asignar';
    const transportHasTime=Boolean(transportStart);
    const transport=shouldCreateTransport?{id:transportId,expediente:id,origen:form.transportPickup,destino:form.transportDelivery,ruta:route,fecha:transportDate,inicio:transportStart||'',fin:transportEnd||'',hora:formatSchedule(transportDate,transportStart,transportEnd),conductor:assignedDriver,proveedorId:'',vehiculo:surveyService?'Surveyor':'Por asignar',estado:assignedDriver==='Sin asignar'?'Sin asignar':'Asignado',scheduleSource,scheduleStatus:transportHasTime?'confirmed':'missing_time',scheduleNote:transportHasTime?`Programado por ${scheduleSource.toUpperCase()}`:'Falta horario del buque; transporte pendiente de confirmar'}:null;
    const transportEvent=transport?{id:`EV-${stamp}-T`,titulo:route,origen:transport.origen,destino:transport.destino,tipoServicio:surveyService?'Survey / muestras':'Transporte',fecha:transport.fecha,inicio:transport.inicio,fin:transport.fin,asignado:assignedDriver,expediente:id,transporte:transportId,proveedorId:'',color:portTone(item.puerto),scheduleSource:transport.scheduleSource,scheduleStatus:transport.scheduleStatus,scheduleNote:transport.scheduleNote}:null;
    const nextCases=[item,...cases];
    const nextTransports=transport?[transport,...transports]:transports;
    const nextCalendar=[transportEvent].filter(Boolean).concat(calendarEvents.filter(isTransportCalendarEvent));
    const nextVessels=upsertVesselFromCase(vessels,item);
    try{await persistOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,nextVessels,deletedVesselKeys,{action:'case.create',details:{caseRef:item.id,vessel:item.buque,client:item.cliente,port:item.puerto,purchaseOrder:item.purchaseOrder||'',serviceType:serviceTypeOf(item),transportCreated:Boolean(transport)}});setCases(nextCases);setTransports(nextTransports);setCalendarEvents(nextCalendar);setVessels(nextVessels);setSelectedId(item.id);setNewOpen(false);setTab('expedientes');notify(`Expediente ${item.id} creado y guardado`)}
    catch(reason){notify('No se pudo guardar el expediente: '+reason.message)}
  };
  const updateTransport=updated=>{
    const existing=transports.find(item=>item.id===updated.id)||updated;
    const relatedCase=cases.find(item=>item.id===updated.expediente);
    const parts=routeParts(updated);
    const cancelled=isCancelledTransport(updated);
    const now=new Date();
    const amount=Math.max(0,Number(updated.cancellation?.expenseAmount)||0);
    const cancellation=cancelled?{
      ...(existing.cancellation||{}),
      ...(updated.cancellation||{}),
      reason:String(updated.cancellation?.reason||'').trim(),
      notes:String(updated.cancellation?.notes||'').trim(),
      expenseAmount:amount,
      expenseProvider:String(updated.cancellation?.expenseProvider||'').trim(),
      billableToClient:Boolean(updated.cancellation?.billableToClient),
      cancelledAt:existing.cancellation?.cancelledAt||updated.cancellation?.cancelledAt||now.toISOString(),
      cancelledBy:existing.cancellation?.cancelledBy||updated.cancellation?.cancelledBy||actorName,
      previousDriver:existing.cancellation?.previousDriver||existing.conductor||''
    }:null;
    if(cancelled&&!cancellation.reason){notify('Indica el motivo de la cancelación');return false}
    const normalized={...updated,...parts,puerto:relatedCase?.puerto||updated.puerto||'',ruta:parts.origen+' → '+parts.destino,hora:formatSchedule(updated.fecha,updated.inicio,updated.fin),conductor:cancelled?'Sin asignar':updated.conductor,estado:cancelled?'Cancelado':updated.estado,cancellation,observacion:updated.observacion||'',scheduleSource:'manual',scheduleStatus:cancelled?'cancelled':updated.inicio?'confirmed':'missing_time',scheduleNote:cancelled?cancellation.reason:updated.inicio?'':'Falta hora ETB; pendiente de confirmar horario'};
    const nextTransports=transports.map(item=>item.id===updated.id?normalized:item);
    const otherActive=nextTransports.some(item=>item.expediente===updated.expediente&&item.id!==updated.id&&!isCancelledTransport(item));
    const nextCases=cases.map(item=>{
      if(item.id!==updated.expediente)return item;
      const flow=operationFlow(item);
      if(cancelled){
        const expenseId='CANCEL-'+updated.id;
        const adjustmentId='cancel-'+updated.id;
        const expenses=(item.gastos||[]).filter(expense=>expense.id!==expenseId);
        if(amount>0)expenses.unshift({id:expenseId,fecha:now.toISOString().slice(0,10),proveedor:cancellation.expenseProvider||'Cancelación de transporte',concepto:'Gastos por cancelación de servicio',importe:amount,nota:cancellation.reason+(cancellation.billableToClient?' · Facturable al cliente':' · Gasto interno'),source:'transport-cancellation',transportId:updated.id,billable:cancellation.billableToClient});
        const adjustments=(item.billingAdjustments||[]).filter(line=>line.id!==adjustmentId);
        if(amount>0&&cancellation.billableToClient)adjustments.push({id:adjustmentId,item:'CANCELLATION CHARGES',detail:cancellation.reason.toUpperCase(),price:amount,units:1,tax:'0%'});
        const timelineId='CANCEL-'+updated.id;
        const timeline=(item.timelineCustom||[]).filter(entry=>entry.id!==timelineId);
        const cancelledMoment=new Date(cancellation.cancelledAt);
        timeline.unshift({id:timelineId,fecha:cancelledMoment.toLocaleDateString('es-ES'),hora:cancelledMoment.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Servicio de transporte cancelado',detalle:normalized.ruta+' · '+cancellation.reason+(amount>0?' · Gastos '+moneyExact(amount)+(cancellation.billableToClient?' facturables':' internos'):' · Sin gastos registrados'),actor:cancellation.cancelledBy,estado:'done'});
        return normalizeMerchandise({...item,estado:otherActive?item.estado:'Cancelado',autoTransportDisabled:!otherActive,conductor:otherActive?item.conductor:'Sin asignar',siguiente:'Revisar cancelación, gastos y facturación',gastos:expenses,billingAdjustments:adjustments,timelineCustom:timeline});
      }
      const assigned=Boolean(updated.conductor&&updated.conductor!=='Sin asignar');
      const changed=assigned&&item.conductor!==updated.conductor;
      const timeline=changed?[{id:'ASSIGN-'+item.id+'-'+Date.now(),fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Conductor asignado',detalle:updated.conductor+' · '+normalized.ruta,actor:actorName,estado:'done'},...(item.timelineCustom||[])]:item.timelineCustom;
      return normalizeMerchandise({...item,autoTransportDisabled:false,conductor:updated.conductor,operationalFlow:{...flow,assignment:flow.delivery||assigned},timelineCustom:timeline});
    });
    const linkedEvent=calendarEvents.find(item=>item.transporte===updated.id);
    const synchronized={titulo:normalized.ruta,origen:normalized.origen,destino:normalized.destino,tipoServicio:'Transporte',fecha:updated.fecha,inicio:updated.inicio,fin:updated.fin,asignado:normalized.conductor,estado:normalized.estado,cancellation,proveedorId:updated.proveedorId||'',expediente:updated.expediente,transporte:updated.id,puerto:normalized.puerto,observacion:normalized.observacion,color:calendarTone({...updated,...normalized},nextCases),scheduleSource:'manual',scheduleStatus:normalized.scheduleStatus,scheduleNote:normalized.scheduleNote};
    const nextCalendar=(linkedEvent?calendarEvents.map(item=>item.transporte===updated.id?{...item,...synchronized}:item):[...calendarEvents,{id:'EV-'+Date.now(),...synchronized}]).filter(isTransportCalendarEvent);
    setTransports(nextTransports);setCases(nextCases);setCalendarEvents(nextCalendar);
    saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,vessels,deletedVesselKeys,{action:cancelled?'transport.cancel':'calendar.update',details:{caseRef:updated.expediente||'',transportId:updated.id,service:'Transporte',route:normalized.ruta,date:updated.fecha,start:updated.inicio,end:updated.fin,driver:normalized.conductor||'Sin asignar',provider:updated.proveedorId||'',note:cancelled?cancellation.reason:normalized.observacion||'',expenseAmount:amount,billable:Boolean(cancellation?.billableToClient)}});
    notify(cancelled?'Servicio cancelado, retirado de los choferes y guardado en el expediente':'Ruta, transporte y calendario actualizados');
    return true;
  };
  const updateCase=async updated=>{
    const {importe,...rawCase}=updated;
    const previousCase=cases.find(item=>item.id===rawCase.id)||{};
    const known=findKnownVessel(vessels,rawCase.buque)||{};
    const manualVesselName=!sameVessel(previousCase.buque,rawCase.buque)||String(previousCase.buque||'').trim().toUpperCase()!==String(rawCase.buque||'').trim().toUpperCase();
    const sourceCall=rawCase.portCall||{};
    const normalizedPortCall={
      etaDate:toIsoDateValue(sourceCall.etaDate||rawCase.etaDate||rawCase.eta),
      etaTime:toClockValue(sourceCall.etaTime||rawCase.etaTime||rawCase.eta),
      etbDate:toIsoDateValue(sourceCall.etbDate||rawCase.etbDate||rawCase.etb),
      etbTime:toClockValue(sourceCall.etbTime||rawCase.etbTime||rawCase.etb),
      etdDate:toIsoDateValue(sourceCall.etdDate||rawCase.etdDate||rawCase.etd),
      etdTime:toClockValue(sourceCall.etdTime||rawCase.etdTime||rawCase.etd),
      updatedAt:new Date().toISOString()
    };
    const operationalCase=normalizeMerchandise({...rawCase,buque:String(rawCase.buque||'').trim().toUpperCase(),eta:normalizedPortCall.etaDate||'Por confirmar',portCall:normalizedPortCall,imo:cleanImo(rawCase.imo)||known.imo||'',mmsi:cleanMmsi(rawCase.mmsi)||known.mmsi||'',manualVesselName:manualVesselName?true:rawCase.manualVesselName,manualEditedAt:manualVesselName?new Date().toISOString():rawCase.manualEditedAt});
    const next=cases.map(item=>item.id===operationalCase.id?operationalCase:item);
    const nextVessels=upsertVesselFromCase(vessels,operationalCase);
    const activeEntries=warehouseEntries.filter(entry=>entry.expediente===operationalCase.id&&!entry.archivado);
    const nextWarehouse=warehouseEntries.map(entry=>{
      if(entry.expediente!==operationalCase.id)return entry;
      const renamed={...entry,buque:operationalCase.buque};
      if(isSurveyService(operationalCase))return {...renamed,archivado:true,estado:'Expedido',hiddenFromWarehouse:true,archiveReason:'survey_samples',salida:entry.salida||new Date().toISOString()};
      return activeEntries.length===1&&entry.ref===activeEntries[0].ref?{...renamed,mercancias:operationalCase.mercancias,bultos:merchandiseCount(operationalCase.mercancias),peso:merchandiseWeightLabel(operationalCase.mercancias)}:renamed;
    });
    const slot=transportSlotFromCase(operationalCase);
    const end=slot.start?plusHourClient(slot.start):'';
    const scheduleStatus=slot.start?'confirmed':'missing_time';
    const scheduleNote=slot.start?`Programado por ${slot.source}`:`Falta hora ${slot.source||'ETB/ETA'}; pendiente de confirmar horario del buque`;
    const nextTransports=transports.map(item=>{
      if(item.expediente!==operationalCase.id)return item;
      const linked=syncLinkedTransportWithCase(item,previousCase,operationalCase);
      if(['Entregado','Completado','Cancelado'].includes(String(linked.estado||'')))return linked;
      if(isManualSchedule(linked))return linked;
      return slot.date?{...linked,fecha:slot.date,inicio:slot.start,fin:end,hora:slot.start?formatSchedule(slot.date,slot.start,end):`${slot.date}  -  FALTA HORARIO`,scheduleSource:slot.source,scheduleStatus,scheduleNote}:linked;
    });
    const syncedCalendar=calendarEvents.map(event=>{
      if(event.expediente!==operationalCase.id||!isTransportCalendarEvent(event))return event;
      const linkedTransport=nextTransports.find(item=>item.id===event.transporte);
      const syncedRoute=linkedTransport?transportRoute(linkedTransport):syncLinkedLocationWithCase(event.titulo,previousCase,operationalCase);
      const base={...event,titulo:syncedRoute,origen:linkedTransport?.origen||event.origen,destino:linkedTransport?.destino||event.destino,puerto:operationalCase.puerto};
      if(['Entregado','Completado','Cancelado'].includes(String(linkedTransport?.estado||event.estado||'')))return {...base,color:calendarTone(base,next)};
      if(isManualSchedule(linkedTransport)||isManualSchedule(event))return {...base,color:calendarTone(base,next)};
      return slot.date?{...base,fecha:slot.date,inicio:slot.start,fin:end,color:calendarTone(base,next),scheduleSource:slot.source,scheduleStatus,scheduleNote}:base;
    });
    const existingEventTransports=new Set(syncedCalendar.map(event=>event.transporte).filter(Boolean));
    const missingCalendarEvents=nextTransports.filter(item=>item.expediente===operationalCase.id&&!existingEventTransports.has(item.id)&&!['Entregado','Completado','Cancelado'].includes(String(item.estado||''))).map((item,index)=>({
      id:`EV-${Date.now()}-${index}`,
      titulo:transportRoute(item),
      origen:item.origen,
      destino:item.destino,
      tipoServicio:String(item.vehiculo||'').toLowerCase().includes('survey')?'Survey / muestras':'Transporte',
      fecha:item.fecha,
      inicio:item.inicio,
      fin:item.fin,
      asignado:item.conductor||'Sin asignar',
      expediente:item.expediente,
      transporte:item.id,
      proveedorId:item.proveedorId||'',
      observacion:item.observacion||'',
      color:calendarTone(item,next),
      scheduleSource:item.scheduleSource||slot.source,
      scheduleStatus:item.scheduleStatus||scheduleStatus,
      scheduleNote:item.scheduleNote||scheduleNote
    }));
    const nextCalendar=[...syncedCalendar,...missingCalendarEvents].filter(isTransportCalendarEvent);
    setCases(next);setVessels(nextVessels);setWarehouseEntries(nextWarehouse);setTransports(nextTransports);setCalendarEvents(nextCalendar);
    try{
      await persistOperational(next,nextTransports,nextWarehouse,customs,nextCalendar,providers,nextVessels,deletedVesselKeys,{action:'case.update',details:{caseRef:operationalCase.id,vessel:operationalCase.buque,client:operationalCase.cliente,port:operationalCase.puerto,purchaseOrder:operationalCase.purchaseOrder||'',eta:operationalCase.eta,etb:portCallMoment(normalizedPortCall.etbDate,normalizedPortCall.etbTime),etd:portCallMoment(normalizedPortCall.etdDate,normalizedPortCall.etdTime)}});
      notify(slot.date?'Expediente, buque, almacén y calendario actualizados':(activeEntries.length===1?'Expediente, buque y almacén actualizados':'Expediente y buque actualizados'));
    }catch(reason){
      notify('No se pudo guardar el expediente: '+reason.message);
    }
  };
  const deleteCaseAttachment=(caseId,scope,file,receptionRef='')=>{
    const target=cases.find(item=>item.id===caseId);
    if(!target||!file)return;
    const label=file.name||documentLabel(file.name)||'archivo';
    if(!window.confirm(`¿Eliminar ${label} del expediente?`))return;
    const removeFromTimeline=entries=>(entries||[]).map(entry=>({
      ...entry,
      archivo:sameAttachment(entry.archivo,file)?null:entry.archivo,
      archivos:(entry.archivos||[]).filter(stored=>!sameAttachment(stored,file))
    }));
    const nextCases=cases.map(item=>{
      if(item.id!==caseId)return item;
      const documentation=item.documentacionMercancia||{};
      const nextDocumentation={...documentation};
      let nextReceptions=item.recepciones||[];
      if(scope==='shipment')nextDocumentation.archivosEnvio=(documentation.archivosEnvio||[]).filter(stored=>!sameAttachment(stored,file));
      if(scope==='pod'){
        nextDocumentation.podArchivos=(documentation.podArchivos||[]).filter(stored=>!sameAttachment(stored,file));
        nextDocumentation.podArchivo=sameAttachment(documentation.podArchivo,file)?(nextDocumentation.podArchivos?.[0]||null):documentation.podArchivo;
        nextDocumentation.podDisponible=Boolean(nextDocumentation.podArchivo||(nextDocumentation.podArchivos||[]).length);
      }
      if(scope==='delivery-photo')nextDocumentation.fotosEntrega=(documentation.fotosEntrega||[]).filter(stored=>!sameAttachment(stored,file));
      if(scope==='reception-photo'||scope==='reception-document'){
        nextReceptions=nextReceptions.map(record=>record.ref===receptionRef?{
          ...record,
          fotos:scope==='reception-photo'?(record.fotos||[]).filter(stored=>!sameAttachment(stored,file)):record.fotos,
          documentos:scope==='reception-document'?(record.documentos||[]).filter(stored=>!sameAttachment(stored,file)):record.documentos
        }:record);
      }
      return normalizeMerchandise({...item,recepciones:nextReceptions,documentacionMercancia:nextDocumentation,timelineCustom:removeFromTimeline(item.timelineCustom)});
    });
    const nextWarehouse=(scope==='reception-photo'||scope==='reception-document')?warehouseEntries.map(entry=>entry.expediente===caseId&&(!receptionRef||entry.ref===receptionRef)?{
      ...entry,
      fotos:scope==='reception-photo'?(entry.fotos||[]).filter(stored=>!sameAttachment(stored,file)):entry.fotos,
      documentosRecepcion:scope==='reception-document'?(entry.documentosRecepcion||[]).filter(stored=>!sameAttachment(stored,file)):entry.documentosRecepcion
    }:entry):warehouseEntries;
    setCases(nextCases);setWarehouseEntries(nextWarehouse);saveOperational(nextCases,transports,nextWarehouse,customs,calendarEvents,providers,vessels);notify('Archivo eliminado del expediente');
  };  const deleteCase=id=>{const target=cases.find(item=>item.id===id);if(!target)return;const linkedWarehouse=warehouseEntries.filter(entry=>entry.expediente===id&&!entry.archivado);const warning=linkedWarehouse.length?`\n\nTiene ${linkedWarehouse.length} entrada(s) de almacén vinculada(s). No se borrará la mercancía: quedará sin expediente para no perder evidencias.`:'';if(!window.confirm(`¿Borrar el expediente ${target.id} - ${target.buque}?${warning}\n\nSe quitarán sus trabajos del calendario y transportes.`))return;const nextCases=cases.filter(item=>item.id!==id);const nextTransports=transports.filter(item=>item.expediente!==id);const nextCalendar=calendarEvents.filter(item=>item.expediente!==id);const nextCustoms=customs.filter(item=>item.expediente!==id);const nextWarehouse=warehouseEntries.map(entry=>entry.expediente===id?{...entry,expediente:''}:entry);setCases(nextCases);setTransports(nextTransports);setCalendarEvents(nextCalendar);setCustoms(nextCustoms);setWarehouseEntries(nextWarehouse);saveOperational(nextCases,nextTransports,nextWarehouse,nextCustoms,nextCalendar,providers,vessels,deletedVesselKeys,{action:'case.delete',details:{caseRef:target.id,vessel:target.buque,client:target.cliente,port:target.puerto,linkedWarehouse:linkedWarehouse.length,linkedTransports:transports.filter(item=>item.expediente===id).length}});setSelectedId(nextCases[0]?.id||'');notify('Expediente borrado y calendario limpiado')};
  const persistCaseEvidenceOnUpload=async(caseId,files=[],evidenceType='document')=>{
    const uploaded=(files||[]).filter(Boolean);
    if(!caseId||!uploaded.length)return;
    const target=cases.find(item=>item.id===caseId);
    if(!target)return;
    const normalizedFiles=uploaded.map(file=>({...file,evidenceType:file.evidenceType||evidenceType}));
    const now=new Date();
    const typeLabels={
      'shipment-document':'Documentacion del envio vinculada',
      'reception-document':'Documentacion de recepcion vinculada',
      'cargo-photo':'Fotos de mercancia vinculadas',
      'reception-photo':'Fotos de recepcion vinculadas',
      'delivery-photo':'Fotos de entrega vinculadas',
      'pod':'POD vinculado'
    };
    const nextCases=cases.map(item=>{
      if(item.id!==caseId)return item;
      const docs={...item.documentacionMercancia};
      if(evidenceType==='pod'){
        docs.podArchivos=mergeAttachments(docs.podArchivos,normalizedFiles);
        docs.podDisponible=true;
        docs.podArchivo=docs.podArchivo||normalizedFiles[0]?.name||'';
      }else if(evidenceType==='delivery-photo'){
        docs.fotosEntrega=mergeAttachments(docs.fotosEntrega,normalizedFiles);
      }else{
        docs.archivosEnvio=mergeAttachments(docs.archivosEnvio,normalizedFiles);
      }
      return normalizeMerchandise({
        ...item,
        documentacionMercancia:docs,
        timelineCustom:[
          ...(item.timelineCustom||[]),
          {
            id:`ATTACH-${caseId}-${Date.now()}`,
            fecha:now.toLocaleDateString('es-ES'),
            hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
            titulo:typeLabels[evidenceType]||'Archivo vinculado al expediente',
            detalle:`${normalizedFiles.length} archivo(s) subido(s) por ${actorName}`,
            actor:actorName,
            archivos:normalizedFiles,
            estado:'done'
          }
        ]
      });
    });
    setCases(nextCases);
    await persistOperational(nextCases,transports,warehouseEntries,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'case.attachment.link',details:{caseRef:caseId,vessel:target.buque,category:evidenceType,files:normalizedFiles.length}});
    notify?.(`${normalizedFiles.length} archivo(s) vinculado(s) al expediente`);
  };
  const rebuildCalendarServices=async()=>{const activeCaseIds=new Set(cases.filter(item=>item.estado!=='Completado').map(item=>item.id));const affected=calendarEvents.filter(event=>activeCaseIds.has(event.expediente)).length;const affectedTransports=transports.filter(item=>activeCaseIds.has(item.expediente)).length;if(!affected&&!affectedTransports){notify('No hay servicios activos que limpiar');return}if(!window.confirm(`¿Limpiar y reconstruir el calendario?\n\nSe quitarán ${affected} tarjetas del calendario y ${affectedTransports} transportes planificados de expedientes activos. No se borran expedientes, mercancía ni documentos. Después se reconstruirá SOLO con transportes usando ETB/fecha del buque.`))return;const nextCalendar=calendarEvents.filter(event=>!activeCaseIds.has(event.expediente));const nextTransports=transports.filter(item=>!activeCaseIds.has(item.expediente));setCalendarEvents(nextCalendar);setTransports(nextTransports);await saveOperational(cases,nextTransports,warehouseEntries,customs,nextCalendar);notify('Calendario limpiado; reconstruyendo solo transportes');await loadOperational()};
  const updateClient=updated=>{const normalized=normalizeClientProfile(updated);const key=normalized.codigo;const exists=finance.clients.some(item=>(item.codigo||item.id)===key);const next={...finance,clients:exists?finance.clients.map(item=>(item.codigo||item.id)===key?normalized:item):[normalized,...finance.clients]};onFinanceChange(next).then(()=>notify('Ficha de cliente actualizada')).catch(reason=>notify(reason.message))};
  const updateInvoice=updated=>{const exists=finance.invoices.some(item=>item.id===updated.id);const next={...finance,invoices:exists?finance.invoices.map(item=>item.id===updated.id?updated:item):[updated,...finance.invoices]};onFinanceChange(next).then(()=>notify(exists?'Documento actualizado':'Borrador de factura creado')).catch(reason=>notify(reason.message))};
  const syncInvoices=nextInvoices=>{const next={...finance,invoices:nextInvoices};onFinanceChange(next).catch(reason=>notify(reason.message))};
  const syncCaseWithWarehouseEntries=(item,nextWarehouse)=>{
    const linkedEntries=nextWarehouse.filter(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
    const linkedRefs=new Set(linkedEntries.map(entry=>entry.ref));
    const warehouseReceptions=linkedEntries.map(entry=>({ref:entry.ref,fecha:entry.fechaRecepcion||entry.entrada,zona:entry.zona,peso:entry.peso,mercancias:entry.mercancias||[],fotos:entry.fotos||[],documentos:entry.documentosRecepcion||[],source:entry.source||'warehouse'}));
    const otherReceptions=(item.recepciones||[]).filter(reception=>!linkedRefs.has(reception.ref));
    const linkedMerchandise=linkedEntries.flatMap(entry=>entry.mercancias||[]);
    return normalizeMerchandise({...item,mercancias:linkedMerchandise,recepciones:[...warehouseReceptions,...otherReceptions],bultos:merchandiseCount(linkedMerchandise),peso:linkedMerchandise.length?merchandiseWeightLabel(linkedMerchandise):'Por registrar'});
  };
  const updateWarehouseEntry=updated=>{
    const previous=warehouseEntries.find(item=>item.ref===updated.ref);
    const relatedCase=cases.find(item=>item.id===updated.expediente);
    const normalized={...updated,buque:relatedCase?.buque||updated.buque||'Mercancía sin identificar',expediente:updated.expediente||'',sinExpediente:!updated.expediente};
    const next=warehouseEntries.map(item=>item.ref===updated.ref?normalized:item);
    let nextCases=cases;
    const affectedCaseIds=[previous?.expediente,normalized.expediente].filter(Boolean);
    if(affectedCaseIds.length){
      const now=new Date();
      nextCases=cases.map(item=>affectedCaseIds.includes(item.id)?{
        ...syncCaseWithWarehouseEntries(item,next),
        operationalFlow:normalized.expediente===item.id?{...operationFlow(item),review:true,cargo:true}:operationFlow(item),
        estado:normalized.expediente===item.id?'En curso':item.estado,
        timelineCustom:normalized.expediente===item.id&&previous?.expediente!==updated.expediente?[{
          id:`WAREHOUSE-LINK-${normalized.ref}-${Date.now()}`,
          fecha:now.toLocaleDateString('es-ES'),
          hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
          titulo:'Mercancía vinculada desde almacén',
          detalle:`${normalized.ref}  -  ${normalized.bultos} bultos  -  ${normalized.peso}  -  Zona ${normalized.zona}`,
          actor:actorName,
          estado:'done'
        },...(item.timelineCustom||[])]:item.timelineCustom
      }:item);
    }
    setWarehouseEntries(next);setCases(nextCases);saveOperational(nextCases,transports,next,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'warehouse.update',details:{warehouseRef:normalized.ref,caseRef:normalized.expediente||'',vessel:normalized.buque,packages:normalized.bultos,weight:normalized.peso}});
    notify(relatedCase&&previous?.expediente!==updated.expediente?'Mercancía vinculada al expediente':'Entrada de almacén actualizada');
  };
  const deleteWarehouseEntry=entry=>{
    if(!window.confirm(`¿Eliminar la entrada ${entry.ref} de almacén?\n\nSe quitará del stock y del expediente vinculado, pero no tocará documentos subidos en otros pasos.`))return;
    const nextWarehouse=warehouseEntries.filter(item=>item.ref!==entry.ref);
    const affectedCaseIds=[entry.expediente].filter(Boolean);
    const nextCases=affectedCaseIds.length?cases.map(item=>affectedCaseIds.includes(item.id)?syncCaseWithWarehouseEntries({...item,recepciones:(item.recepciones||[]).filter(reception=>reception.ref!==entry.ref)},nextWarehouse):item):cases;
    setWarehouseEntries(nextWarehouse);setCases(nextCases);saveOperational(nextCases,transports,nextWarehouse,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'warehouse.delete',details:{warehouseRef:entry.ref,caseRef:entry.expediente||'',vessel:entry.buque,packages:entry.bultos,weight:entry.peso}});notify('Entrada de almacén eliminada');
  };
  const updateCustom=updated=>{const next=customs.map(item=>item.id===updated.id?updated:item);setCustoms(next);saveOperational(cases,transports,warehouseEntries,next);notify('Trámite aduanero actualizado')};
  const deleteCalendarService=event=>{
    if(!event?.id)return;
    const related=cases.find(item=>item.id===event.expediente);
    if(!window.confirm(`¿Eliminar este servicio del calendario${related?` de ${related.buque}`:''}?\n\nSe quitará solo esta tarjeta y su transporte relacionado.`))return;
    const sameCaseTransportEvents=calendarEvents.filter(item=>item.expediente===event.expediente&&isTransportCalendarEvent(item));
    const hasOtherTransport=sameCaseTransportEvents.some(item=>item.id!==event.id);
    const nextCalendar=calendarEvents.filter(item=>item.id!==event.id);
    const transportStillReferenced=event.transporte&&calendarEvents.some(item=>item.id!==event.id&&item.transporte===event.transporte);
    const nextTransports=event.transporte&&!transportStillReferenced?transports.filter(item=>item.id!==event.transporte):transports;
    const nextCases=cases.map(item=>item.id===event.expediente&&!hasOtherTransport?normalizeMerchandise({...item,autoTransportDisabled:true}):item);
    setCalendarEvents(nextCalendar);setTransports(nextTransports);setCases(nextCases);
    saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,vessels,deletedVesselKeys,{action:'calendar.delete',details:{caseRef:event.expediente||'',transportId:event.transporte||'',vessel:related?.buque||event.titulo,service:event.tipoServicio||'Transporte',date:event.fecha,start:event.inicio}});
    notify(hasOtherTransport?'Servicio eliminado del calendario':'Servicio eliminado; no se recreará automáticamente hasta crear otro transporte');
  };
  const saveCalendarEvent=event=>{
    let colored={...event,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:calendarTone(event,cases)};
    if(!isTransportCalendarEvent(colored)){notify('El calendario solo muestra transportes. Las recepciones se registran desde Almacén/Expediente.');return}
    colored={...colored,scheduleSource:'manual',scheduleStatus:colored.inicio?'confirmed':'missing_time',scheduleNote:colored.inicio?'':'Falta hora ETB; pendiente de confirmar horario'};
    let nextTransports=transports;
    if(colored.tipoServicio==='Transporte'||String(colored.tipoServicio||'').toLowerCase().startsWith('survey')){
      const parts=routeParts({origen:colored.origen,destino:colored.destino,ruta:colored.titulo});
      const route=`${parts.origen} → ${parts.destino}`;
      colored={...colored,...parts,titulo:route};
      const scheduleFields={scheduleSource:colored.scheduleSource||'manual',scheduleStatus:colored.scheduleStatus,scheduleNote:colored.scheduleNote};
      if(!colored.transporte){
        const transportId=`TR-${Date.now()}`;
        colored={...colored,transporte:transportId};
        nextTransports=[{id:transportId,expediente:colored.expediente,...parts,ruta:route,fecha:colored.fecha,inicio:colored.inicio,fin:colored.fin,hora:formatSchedule(colored.fecha,colored.inicio,colored.fin),conductor:colored.asignado,proveedorId:colored.proveedorId||'',vehiculo:'Por asignar',estado:colored.asignado==='Sin asignar'?'Sin asignar':'Asignado',observacion:colored.observacion||'',...scheduleFields},...transports];
      }else{
        nextTransports=transports.map(item=>item.id===colored.transporte?{...item,...parts,expediente:colored.expediente||item.expediente,ruta:route,conductor:colored.asignado,proveedorId:colored.proveedorId||item.proveedorId||'',fecha:colored.fecha,inicio:colored.inicio,fin:colored.fin,hora:formatSchedule(colored.fecha,colored.inicio,colored.fin),estado:colored.asignado==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado,observacion:colored.observacion||'',...scheduleFields}:item);
      }
    }
    const exists=calendarEvents.some(item=>item.id===colored.id);
    const nextCalendar=(exists?calendarEvents.map(item=>item.id===colored.id?colored:item):[...calendarEvents,colored]).filter(isTransportCalendarEvent);
    const previousCalendar=calendarEvents.find(item=>item.id===colored.id)||calendarEvents.find(item=>colored.transporte&&item.transporte===colored.transporte);
    const previousTransport=transports.find(item=>item.id===colored.transporte);
    const oldSchedule=[previousCalendar?.fecha||previousTransport?.fecha,previousCalendar?.inicio||previousTransport?.inicio,previousCalendar?.fin||previousTransport?.fin].filter(Boolean).join(' ');
    const newSchedule=[colored.fecha,colored.inicio,colored.fin].filter(Boolean).join(' ');
    const scheduleChanged=Boolean(oldSchedule&&newSchedule&&oldSchedule!==newSchedule);
    const nextCases=cases.map(item=>{if(item.id!==colored.expediente)return item;const flow=operationFlow(item);const isTransport=colored.tipoServicio==='Transporte'||String(colored.tipoServicio||'').toLowerCase().startsWith('survey');const assigned=Boolean(colored.asignado&&colored.asignado!=='Sin asignar');const changed=isTransport&&assigned&&item.conductor!==colored.asignado;const now=new Date();const timelineUpdates=[...(scheduleChanged?[{id:`MOVE-${item.id}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Servicio reprogramado',detalle:`${oldSchedule} → ${newSchedule}  -  ${colored.titulo}`,actor:actorName,estado:'done'}]:[]),...(changed?[{id:`ASSIGN-${item.id}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Responsable asignado',detalle:`${colored.asignado}  -  ${colored.titulo}`,actor:actorName,estado:'done'}]:[])];return normalizeMerchandise({...item,autoTransportDisabled:false,conductor:colored.asignado,operationalFlow:isTransport?{...flow,assignment:flow.delivery||assigned}:flow,timelineCustom:timelineUpdates.length?[...timelineUpdates,...(item.timelineCustom||[])]:item.timelineCustom})});
    setCalendarEvents(nextCalendar);setTransports(nextTransports);setCases(nextCases);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,vessels,deletedVesselKeys,{action:'calendar.update',details:{caseRef:colored.expediente||'',transportId:colored.transporte||'',service:colored.tipoServicio||'Transporte',route:colored.titulo,date:colored.fecha,start:colored.inicio,end:colored.fin,driver:colored.asignado||'Sin asignar'}});notify(exists?'Tarea, transporte y expediente actualizados':'Trabajo añadido y sincronizado con el calendario');
  };
  const saveProvider=provider=>{const exists=providers.some(item=>item.id===provider.id);const next=exists?providers.map(item=>item.id===provider.id?provider:item):[...providers,{...provider,id:'PRV-'+String(providers.length+1).padStart(3,'0')}];setProviders(next);saveOperational(cases,transports,warehouseEntries,customs,calendarEvents,next);notify(exists?'Proveedor actualizado':'Proveedor añadido')};
  const saveVessel=vessel=>{
    const clean={...vessel,name:String(vessel.name||'').trim().toUpperCase(),imo:cleanImo(vessel.imo),mmsi:cleanMmsi(vessel.mmsi),lastPort:String(vessel.lastPort||'').trim().toUpperCase(),photoUrl:String(vessel.photoUrl||'').trim(),updatedAt:new Date().toISOString()};
    if(!clean.name){notify('Indica el nombre del buque');return}
    const exists=vessels.some(item=>sameVessel(vesselNameOf(item),clean.name));
    const nextVessels=exists?vessels.map(item=>sameVessel(vesselNameOf(item),clean.name)?{...item,...clean,id:item.id||clean.id||clean.name}:item):[{...clean,id:clean.id||clean.name},...vessels];
    const nextDeletedVesselKeys=deletedVesselKeys.filter(key=>key!==vesselKey(clean.name));
    const nextCases=cases.map(item=>sameVessel(item.buque,clean.name)?hydrateCaseWithVessel(item,nextVessels):item);
    setDeletedVesselKeys(nextDeletedVesselKeys);setVessels(nextVessels);setCases(nextCases);saveOperational(nextCases,transports,warehouseEntries,customs,calendarEvents,providers,nextVessels,nextDeletedVesselKeys);notify(exists?'Ficha de buque actualizada':'Ficha de buque creada');
  };
  const deleteVessel=vessel=>{
    const name=vesselNameOf(vessel);
    if(!name)return;
    if(!window.confirm(`¿Borrar la ficha del buque ${name}?\n\nNo se borrarán expedientes, almacén ni transportes.`))return;
    const nextVessels=vessels.filter(item=>!sameVessel(vesselNameOf(item),name));
    const nextDeletedVesselKeys=[...new Set([...deletedVesselKeys,vesselKey(name)])];
    setDeletedVesselKeys(nextDeletedVesselKeys);setVessels(nextVessels);saveOperational(cases,transports,warehouseEntries,customs,calendarEvents,providers,nextVessels,nextDeletedVesselKeys);notify('Ficha de buque borrada');
  };
  const completeCaseStep=(id,stepKey,note='',evidence=null)=>{
  const target=cases.find(item=>item.id===id);
    if(!target)return false;
    const steps=operationStepsFor(target);
    const selectedStep=steps.find(step=>step.key===stepKey);
    if(!selectedStep){notify('Paso no encontrado');return false}
    const storageOnly=isStorageOnly(target);
    const surveyService=isSurveyService(target);
    const evidencePayload=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)&&Array.isArray(evidence.files)?evidence:null;
    const evidenceFiles=Array.isArray(evidence)?evidence.filter(Boolean):evidencePayload?evidencePayload.files.filter(Boolean):evidence?[evidence]:[];
    const podException=Boolean(evidencePayload?.podException);
    const podExceptionReason=String(evidencePayload?.podExceptionReason||note||'').trim();
    const selectedWarehouseRefs=Array.isArray(evidencePayload?.warehouseRefs)?evidencePayload.warehouseRefs:[];
    const cargoStepCreatesWarehouse=stepKey==='cargo'&&!surveyService;
    const selectedWarehouseEntries=cargoStepCreatesWarehouse?warehouseEntries.filter(entry=>selectedWarehouseRefs.includes(entry.ref)):[];
    const cargoEvidence=stepKey==='cargo'?evidenceFiles:[];
    const cargoHasWarehouse=cargoStepCreatesWarehouse&&selectedWarehouseEntries.length>0;
    const documentEvidence=stepKey==='documents'?evidenceFiles:[];
    const deliveryPhotos=stepKey==='delivery'?evidenceFiles.filter(file=>file.evidenceType==='delivery-photo'):[];
    const podFiles=stepKey==='delivery'?evidenceFiles.filter(file=>file.evidenceType==='pod'||(!file.evidenceType&&file)):[];
    if(stepKey==='cargo'&&!surveyService&&!cargoEvidence.length&&!cargoHasWarehouse){notify('Añade una foto o selecciona una mercancía existente en almacén');return false}
    if(stepKey==='delivery'&&!deliveryPhotos.length&&!surveyService){notify('Añade al menos una foto de la mercancía entregada');return false}
    if(stepKey==='delivery'&&surveyService&&!deliveryPhotos.length&&!podFiles.length){notify('Añade una foto, documento o informe del survey realizado');return false}
    if(stepKey==='delivery'&&!storageOnly&&!surveyService&&!podFiles.length&&!podException){notify('Escanea o adjunta el POD firmado, o marca POD no sellado con observación');return false}
    if(stepKey==='delivery'&&!storageOnly&&!surveyService&&podException&&!podExceptionReason){notify('Indica por qué no se selló el POD antes de cerrar la entrega');return false}
    const flow={...operationFlow(target),[stepKey]:true};
    const ready=stepKey==='delivery';
    if(ready)flow.billingReady=true;
    const nextStep=steps.find(step=>!flow[step.key]);
    const now=new Date();
    const deliveryWarehouseScope=ready&&!surveyService?warehouseEntriesForVessel(warehouseEntries,target):[];
    const warehouseReviewNote=ready&&!surveyService?` Almacén revisado: ${deliveryWarehouseScope.length} partida(s) activa(s) para ${target.buque}.`:ready&&surveyService?' Servicio survey confirmado a bordo.':'';
    const linkedWarehouseNote=cargoHasWarehouse?` Almacén vinculado: ${selectedWarehouseEntries.map(entry=>entry.ref).join(', ')}.`:'';
    const podExceptionNote=ready&&podException?` POD no sellado / no disponible: ${podExceptionReason}.`:'';
    const timelineEntry={id:`FLOW-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:ready&&podException?'Entrega confirmada sin POD sellado':selectedStep.title,detalle:`${note||'Paso confirmado sin incidencias'}${podExceptionNote}${linkedWarehouseNote}${warehouseReviewNote}`,actor:actorName,archivo:ready?podFiles[0]||null:null,archivos:stepKey==='cargo'?[...cargoEvidence,...selectedWarehouseEntries.flatMap(entry=>[...(entry.fotos||[]),...(entry.documentosRecepcion||[])])]:stepKey==='documents'?documentEvidence:[...deliveryPhotos,...podFiles.slice(1)],estado:'done'};
    const linkedTransport=transports.find(item=>item.expediente===id);
    const warehouseMerchandise=selectedWarehouseEntries.flatMap(entry=>entry.mercancias||[]);
    const cargoMerchandise=warehouseMerchandise.length?warehouseMerchandise:(target.mercancias||[]).length?target.mercancias:[{id:`${id}-AUTO-${Date.now()}`,tipo:'CAJA',cantidad:Math.max(1,Number(target.bultos)||1),seguimiento:'',peso:target.peso&&!/registrar|pendiente/i.test(target.peso)?target.peso:'PESO PENDIENTE',documentos:[]}];
    const cargoPhotos=cargoEvidence.map((file,index)=>({...file,tipo:index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercancia:cargoMerchandise.map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'}  -  ${line.peso||'PESO PENDIENTE'}`).join('  -  '),nota:`Registrado por ${actorName}`}));
    const cargoReference=`ALM-${Date.now()}`;
    const cargoReceptions=cargoStepCreatesWarehouse?(cargoHasWarehouse?selectedWarehouseEntries.map(entry=>({ref:entry.ref,source:'warehouse-linked',fecha:entry.fechaRecepcion||entry.entrada||now.toISOString(),zona:entry.zona||'ALMACÉN',peso:entry.peso||merchandiseWeightLabel(entry.mercancias||[]),mercancias:entry.mercancias||[],fotos:entry.fotos||[],documentos:entry.documentosRecepcion||[]})):[{ref:cargoReference,source:'driver-flow',fecha:now.toISOString(),zona:linkedTransport?.origen||'PENDIENTE DE UBICAR',peso:merchandiseWeightLabel(cargoMerchandise),mercancias:cargoMerchandise,fotos:cargoPhotos,documentos:[]}]):[];
    const nextCases=cases.map(item=>{
      if(item.id!==id)return item;
      const existingDocs=item.documentacionMercancia||{};
      const mergedShipmentDocs=stepKey==='documents'?mergeAttachments(existingDocs.archivosEnvio||[],documentEvidence):existingDocs.archivosEnvio;
      const mergedPodFiles=ready?mergeAttachments(existingDocs.podArchivos||(existingDocs.podArchivo?[existingDocs.podArchivo]:[]),podFiles):existingDocs.podArchivos;
      const mergedDeliveryPhotos=ready?mergeAttachments(existingDocs.fotosEntrega||[],deliveryPhotos):existingDocs.fotosEntrega;
      const nextDocumentation=stepKey==='documents'
        ? {...existingDocs,archivosEnvio:mergedShipmentDocs,revisada:true}
        : ready
          ? {...existingDocs,podDisponible:storageOnly||surveyService?Boolean(mergedPodFiles?.length):true,podNoSellado:podException||existingDocs.podNoSellado,podObservacion:podException?podExceptionReason:(existingDocs.podObservacion||''),podArchivo:mergedPodFiles?.[0]||existingDocs.podArchivo||null,podArchivos:mergedPodFiles||[],fotosEntrega:mergedDeliveryPhotos||[]}
          : existingDocs;
      return normalizeMerchandise({...item,mercancias:stepKey==='cargo'&&!surveyService?cargoMerchandise:item.mercancias,operationalFlow:flow,progreso:ready?100:Math.round(steps.filter(step=>flow[step.key]).length/steps.length*100),siguiente:ready?'Listo para facturar':nextStep?.next||'',estado:ready?'Completado':'En curso',recepciones:cargoReceptions.length?[...cargoReceptions,...(item.recepciones||[])]:item.recepciones,documentacionMercancia:nextDocumentation,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]});
    });
    const nextTransports=ready?transports.map(item=>item.expediente===id?{...item,estado:'Entregado'}:item):transports;
    const alreadyInWarehouse=warehouseEntries.some(item=>item.expediente===id&&!item.archivado&&item.estado!=='Expedido');
    const automaticWarehouseEntry=stepKey==='cargo'&&!surveyService&&!alreadyInWarehouse?{ref:cargoReference,source:'driver-flow',expediente:id,buque:target.buque,zona:'PENDIENTE',entrada:formatReceptionDate(now.toISOString()),fechaRecepcion:now.toISOString(),bultos:merchandiseCount(cargoMerchandise),peso:merchandiseWeightLabel(cargoMerchandise),mercancias:cargoMerchandise,fotos:cargoPhotos,documentosRecepcion:[],dias:0,estado:'En stock',archivado:false}:null;
    const nextWarehouse=ready?warehouseEntries.map(item=>deliveryWarehouseScope.includes(item)?{...item,expediente:item.expediente||id,estado:'Expedido',archivado:true,salida:new Date().toISOString()}:item):cargoHasWarehouse?warehouseEntries.map(entry=>selectedWarehouseRefs.includes(entry.ref)?{...entry,expediente:id,buque:target.buque,estado:entry.estado||'En stock',archivado:false}:entry):automaticWarehouseEntry?[automaticWarehouseEntry,...warehouseEntries]:warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'step.complete',details:{caseRef:id,vessel:target.buque,step:stepKey,title:selectedStep.title,readyForBilling:ready,podException}});
    notify(ready?(surveyService?'Survey confirmado: expediente listo para facturar':storageOnly?'Salida confirmada: expediente listo para facturar':podException?'Entrega cerrada sin POD sellado: expediente listo para facturar':'POD registrado: expediente listo para facturar'):selectedStep.title+' registrado');
    return true;
  };
  const undoCaseStep=(id,stepKey)=>{
    const target=cases.find(item=>item.id===id);
    if(!target)return;
    const currentFlow=operationFlow(target);
    const steps=operationStepsFor(target);
    const completedSteps=steps.filter(step=>currentFlow[step.key]);
    const lastCompleted=completedSteps[completedSteps.length-1];
    if(!lastCompleted||lastCompleted.key!==stepKey){notify('Solo puedes deshacer el último paso completado');return}
    const flow={...currentFlow,[stepKey]:false};
    if(stepKey==='delivery'){flow.delivery=false;flow.pod=false;flow.billingReady=false}
    const reopened=steps.find(step=>step.key===stepKey);
    const progress=Math.round(steps.filter(step=>flow[step.key]).length/steps.length*100);
    const now=new Date();
    const timelineEntry={id:`UNDO-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:`Paso reabierto: ${reopened.title}`,detalle:'El conductor deshizo la confirmación para corregir o repetir este paso. Las fotos, PODs y documentos existentes se conservan.',actor:actorName,estado:'done'};
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,operationalFlow:flow,progreso:progress,siguiente:reopened.next,estado:'En curso',recepciones:item.recepciones,documentacionMercancia:item.documentacionMercancia,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=stepKey==='delivery'?transports.map(item=>item.expediente===id?{...item,estado:item.conductor&&item.conductor!=='Sin asignar'?'Asignado':'Sin asignar'}:item):transports;
    const nextWarehouse=stepKey==='delivery'?warehouseEntries.map(item=>item.expediente===id?{...item,estado:'En stock',archivado:false,salida:null}:item):warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'step.reopen',details:{caseRef:id,vessel:target.buque,step:stepKey,title:reopened.title,method:'undo'}});
    notify(`${reopened.title} reabierto`);
  };
  const reopenCaseStep=(id,stepKey)=>{
    const target=cases.find(item=>item.id===id);
    if(!target)return;
    const steps=operationStepsFor(target);
    const stepIndex=steps.findIndex(step=>step.key===stepKey);
    const reopened=steps[stepIndex];
    if(stepIndex<0||!operationFlow(target)[stepKey]){notify('Ese paso todavía no está completado');return}
    if(!window.confirm(`¿Reabrir el paso "${reopened.title}"?
No se borrarán documentos ni fotos. El expediente volverá a este punto para corregir o añadir información.`))return;
    const currentFlow=operationFlow(target);
    const flow={...currentFlow};
    steps.slice(stepIndex).forEach(step=>{flow[step.key]=false});
    flow.billingReady=false;flow.pod=false;flow.delivered=false;
    const progress=Math.round(steps.filter(step=>flow[step.key]).length/steps.length*100);
    const now=new Date();
    const timelineEntry={id:`REOPEN-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:`Paso reabierto: ${reopened.title}`,detalle:'Reabierto desde el expediente para corregir, eliminar o añadir información sin perder evidencias existentes',actor:actorName,estado:'done'};
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,operationalFlow:flow,progreso:progress,siguiente:reopened.next,estado:'En curso',timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=stepIndex<=steps.findIndex(step=>step.key==='delivery')?transports.map(item=>item.expediente===id&&item.estado==='Entregado'?{...item,estado:item.conductor&&item.conductor!=='Sin asignar'?'Asignado':'Sin asignar'}:item):transports;
    const nextWarehouse=stepIndex<=steps.findIndex(step=>step.key==='delivery')?warehouseEntries.map(item=>item.expediente===id&&item.archivado?{...item,estado:'En stock',archivado:false,salida:null}:item):warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'step.reopen',details:{caseRef:id,vessel:target.buque,step:stepKey,title:reopened.title,method:'reopen'}});
    notify(`${reopened.title} reabierto`);
  };  const registerWarehouseEntry=form=>{
    const relatedCase=cases.find(item=>item.id===form.expediente);
    if(relatedCase&&isSurveyService(relatedCase)){notify('SURVEY / MUESTRAS no admite mercancía ni entradas de almacén');return}
    const nextReference=319+warehouseEntries.length-movimientosAlmacen.length;
    const reference='ALM-'+nextReference;
    const vesselName=relatedCase?.buque||form.identificacion?.trim()||'Mercancía sin identificar';
    const merchandise=form.mercancias.map((line,index)=>({
      id:`${form.expediente||'SIN-EXP'}-${reference}-M${index+1}`,
      buque:vesselName,
      tipo:line.tipo,
      cantidad:Number(line.cantidad)||1,
      seguimiento:line.seguimiento.trim().toUpperCase(),
      peso:Number(line.peso).toLocaleString('es-ES',{maximumFractionDigits:2})+' KG',
      documentos:[],
      sourceEntry:reference
    }));
    const totalPackages=merchandise.reduce((sum,line)=>sum+line.cantidad,0);
    const totalWeight=form.mercancias.reduce((sum,line)=>sum+(Number(line.peso)||0),0);
    const item={
      ref:reference,
      expediente:form.expediente||'',
      sinExpediente:!relatedCase,
      buque:vesselName,
      zona:form.zona.toUpperCase(),
      entrada:formatReceptionDate(form.fechaRecepcion),
      fechaRecepcion:form.fechaRecepcion,
      spaceType:form.spaceType||'auto',
      spacePositions:floorNumber(form.spacePositions),
      spaceLength:floorNumber(form.spaceLength||3),
      spaceWidth:floorNumber(form.spaceWidth||1),
      bultos:totalPackages,
      peso:totalWeight.toLocaleString('es-ES',{maximumFractionDigits:2})+' kg',
      mercancias:merchandise,
      fotos:form.fotos||[],
      documentosRecepcion:form.documentosRecepcion||[],
      dias:0,
      estado:'En stock'
    };
    const reception={ref:reference,fecha:form.fechaRecepcion,zona:item.zona,peso:item.peso,mercancias:merchandise,fotos:item.fotos,documentos:item.documentosRecepcion};
    const summary=merchandise.map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'}`).join('  -  ');
    const nextCases=cases.map(entry=>{
      if(entry.id!==form.expediente)return entry;
      const existing=(entry.mercancias||[]);
      const hasRegistered=existing.some(line=>line.sourceEntry||line.seguimiento||(line.documentos||[]).length);
      return normalizeMerchandise({
        ...entry,
        mercancias:[...(hasRegistered?existing:[]),...merchandise],
        recepciones:[reception,...(entry.recepciones||[])],
        operationalFlow:{...operationFlow(entry),review:true,cargo:true},
        estado:'En curso',
        timelineCustom:[{
          id:`RECEPTION-${reference}`,
          fecha:new Date(form.fechaRecepcion).toLocaleDateString('es-ES'),
          hora:new Date(form.fechaRecepcion).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
          titulo:'Mercancía recibida',
          detalle:`${formatReceptionDate(form.fechaRecepcion)}  -  ${summary}  -  Zona ${item.zona}`,
          actor:actorName,
          estado:'done'
        },...(entry.timelineCustom||[])]
      });
    });
    const next=[item,...warehouseEntries];setWarehouseEntries(next);setCases(nextCases);saveOperational(nextCases,transports,next,customs,calendarEvents,providers,vessels,deletedVesselKeys,{action:'warehouse.create',details:{warehouseRef:item.ref,caseRef:item.expediente||'',vessel:item.buque,packages:item.bultos,weight:item.peso,zone:item.zona,photos:(item.fotos||[]).length,documents:(item.documentosRecepcion||[]).length}});
    notify(relatedCase?`Entrada ${item.ref} vinculada a ${relatedCase.id}`:`Entrada ${item.ref} guardada sin expediente`);
  };
  const [title,subtitle]=TITLES[tab];
  const startPreview=member=>{setPreviewUser(member);setTab('dashboard');notify('Vista previa activada')};
  const assignedAlerts=(hasRole(effectiveRoles,'operations')||hasRole(effectiveRoles,'driver'))
    ? calendarEvents.filter(event=>samePerson(event.asignado,visibleUser.fullName)&&cases.find(item=>item.id===event.expediente)?.estado!=='Completado')
    : calendarEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar');
  const notificationCount=assignedAlerts.length+activeNotifications.length;
  const clearNotificationLog=()=>{setNotificationLog([]);try{localStorage.removeItem(`swiftport-notification-log-${user.id}`)}catch{}};
  return <div className="shell">
    <Sidebar tab={tab} open={menuOpen} navigate={navigate} close={()=>setMenuOpen(false)} nav={availableNav} user={visibleUser} onLogout={onLogout}/>
    {menuOpen&&<button className="scrim" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>}
    <main className="main">
      <header className="topbar">
        <div className="topbar-title">
          <button className="icon-button menu-button" aria-label="Abrir menú" onClick={()=>setMenuOpen(true)}><Menu/></button>
          <div><div className="eyebrow">Operaciones  -  {new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div><h1>{title}</h1><p>{subtitle}</p></div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button theme-toggle" aria-label={colorTheme==='dark'?'Activar modo claro':'Activar modo oscuro'} title={colorTheme==='dark'?'Modo claro':'Modo oscuro'} onClick={()=>setColorTheme(current=>current==='dark'?'light':'dark')}>{colorTheme==='dark'?<Sun/>:<Moon/>}</button>
          <button className="icon-button notification" aria-label="Notificaciones" onClick={()=>setNotificationOpen(true)}><Bell/>{notificationCount>0&&<i>{notificationCount}</i>}</button>
          {!driverOnly&&<button className="button primary" aria-label="Nuevo expediente" onClick={()=>setNewOpen(true)}><Plus/> <span>Nuevo expediente</span></button>}
          <div className="avatar" title={visibleUser.fullName+'  -  '+roleLabel(visibleUser)}>{initials(visibleUser.fullName)}</div>
        </div>
      </header>
      <div className="content">
        {previewUser&&<div className="preview-banner"><Eye/><span>Estás viendo la aplicación como <b>{previewUser.fullName}</b> ({roleLabel(previewUser)}). Tu cuenta sigue siendo administrador.</span><button onClick={()=>setPreviewUser(null)}>Salir de la vista previa</button></div>}
        {tab==='dashboard'&&<Dashboard cases={casesWithFinance} warehouseEntries={warehouseEntries} calendarEvents={calendarEvents} openCase={openCase} navigate={navigate} showFinance={showFinance} user={visibleUser}/>}
        {tab==='calendario'&&<>{!driverOnly&&<DriverLegend events={calendarEvents} cases={cases}/>}<Calendario events={calendarEvents} team={operationalTeam} cases={cases} transports={transports} providers={providers} warehouseEntries={warehouseEntries} saveEvent={saveCalendarEvent} deleteEvent={deleteCalendarService} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} openCase={openCase} currentUser={visibleUser} csrfToken={auth.csrfToken} reloadOperational={loadOperational} notify={notify} onEvidenceUploaded={persistCaseEvidenceOnUpload}/></>}
        {tab==='expedientes'&&<Expedientes cases={casesWithFinance} selected={selected} select={setSelectedId} search={search} setSearch={setSearch} completeCaseStep={completeCaseStep} notify={notify} showFinance={showFinance} updateCase={updateCase} updateTransport={updateTransport} deleteCase={deleteCase} deleteAttachment={deleteCaseAttachment} reopenCaseStep={reopenCaseStep} clientOptions={clientOptions} warehouseEntries={warehouseEntries} transports={transports} calendarEvents={calendarEvents} team={operationalTeam} providers={providers} vessels={vessels} saveEvent={saveCalendarEvent} csrfToken={auth.csrfToken} reloadOperational={loadOperational} currentUser={visibleUser} actorName={actorName} onEvidenceUploaded={persistCaseEvidenceOnUpload}/>}
        {tab==='almacen'&&<Almacen items={warehouseEntries} cases={casesWithFinance} openCase={openCase} registerEntry={registerWarehouseEntry} updateEntry={updateWarehouseEntry} deleteEntry={deleteWarehouseEntry} showFinance={showFinance} storageTotal={finance.warehouseStorageTotal} csrfToken={auth.csrfToken} notify={notify}/>}
        {tab==='buques'&&<Buques vessels={vessels} cases={casesWithFinance} warehouseEntries={warehouseEntries} saveVessel={saveVessel} deleteVessel={deleteVessel} openCase={openCase}/>}
        {tab==='transportes'&&<Transportes items={transports} update={updateTransport} openCase={openCase} team={operationalTeam} providers={providers} saveProvider={saveProvider}/>}
        {tab==='aduanas'&&<Aduanas items={customs} update={updateCustom} openCase={openCase} notify={notify}/>}
        {tab==='correos'&&<Correos csrfToken={auth.csrfToken} notify={notify} openCase={openCase} cases={casesWithFinance}/>}
        {tab==='clientes'&&showFinance&&<Clientes notify={notify} clients={finance.clients} updateClient={updateClient}/>}
        {tab==='facturacion'&&showFinance&&<Facturacion openCase={openCase} notify={notify} invoices={finance.invoices} cases={casesWithFinance} warehouseEntries={warehouseEntries} transports={transports} calendarEvents={calendarEvents} clients={finance.clients} updateInvoice={updateInvoice} updateCase={updateCase} syncInvoices={syncInvoices} csrfToken={auth.csrfToken} currentUser={visibleUser}/>}
        {tab==='auditoria'&&hasRole(user,'admin')&&!previewUser&&<Auditoria csrfToken={auth.csrfToken} notify={notify}/>}
        {tab==='usuarios'&&hasRole(user,'admin')&&!previewUser&&<Usuarios csrfToken={auth.csrfToken} notify={notify} onPreview={startPreview} onUsersChanged={loadTeam}/>}
      </div>
    </main>
    <MobileNav tab={tab} navigate={navigate} more={()=>setMenuOpen(true)} nav={availableNav}/>
    {newOpen&&<NewCaseModal clientOptions={clientOptions} vessels={vessels} team={operationalTeam} close={()=>setNewOpen(false)} submit={createCase}/>}
    {notificationOpen&&<NotificationDrawer alerts={activeNotifications} history={notificationLog} acknowledge={acknowledgeOperationalAlert} close={()=>setNotificationOpen(false)} clear={clearNotificationLog} openCalendar={()=>{setNotificationOpen(false);navigate('calendario')}} openBilling={()=>{setNotificationOpen(false);navigate('facturacion')}} soundSettings={alertSoundSettings} updateSoundSettings={updateAlertSoundSettings}/>}
    {deliveryPopup&&<DeliveryPopup alert={deliveryPopup} close={()=>acknowledgeOperationalAlert(deliveryPopup)} openHistory={()=>{setDeliveryPopup(null);setNotificationOpen(true)}} soundSettings={alertSoundSettings} updateSoundSettings={updateAlertSoundSettings}/>}
    {toast&&<div className="toast" role="status"><CheckCircle2/>{toast}</div>}
  </div>;
}
const initials=name=>name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toUpperCase();
function NotificationDrawer({alerts=[],history=[],acknowledge,close,clear,openCalendar,openBilling,soundSettings,updateSoundSettings}){
  const settings=normalizeAlertSoundSettings(soundSettings);
const volumeLabel=`Volumen ${Math.round(settings.volume*100)}%${settings.volume>1?' - potenciado':''}`;
  const formatDate=value=>value?new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Ahora';
  const updateSettings=patch=>{
    const next=saveAlertSoundSettings({...settings,...patch});
    updateSoundSettings?.(next);
  };
  const testSound=()=>{
    const next=saveAlertSoundSettings({...settings,enabled:true});
    updateSoundSettings?.(next);
    playAlertSound(next).catch(()=>{});
  };
  return <>
    <button className="notification-backdrop" aria-label="Cerrar notificaciones" onClick={close}/>
    <aside className="notification-drawer" aria-label="Centro de notificaciones">
      <header>
        <span><Bell/> Notificaciones</span>
        <button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button>
      </header>
      <section className="notification-drawer-actions">
        <button className="button secondary" onClick={openCalendar}><CalendarDays/> Abrir calendario</button>
        <button className="button secondary" onClick={openBilling}><ReceiptText/> Abrir facturación</button>
        <button className="button secondary" onClick={testSound}><Bell/> Probar sonido</button>
        <button className="button tertiary" onClick={clear}>Limpiar historial</button>
      </section>
      <section className="notification-sound-settings" aria-label="Configuracion del sonido de alertas">
        <label><span>Sonido de alerta</span><select value={settings.sound} onChange={event=>updateSettings({sound:event.target.value})}>{ALERT_SOUND_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label><span>{volumeLabel}</span><input type="range" min="0" max={ALERT_SOUND_MAX_VOLUME} step="0.05" value={settings.volume} onChange={event=>updateSettings({volume:Number(event.target.value)})}/></label>
        <label className="sound-toggle"><input type="checkbox" checked={settings.enabled} onChange={event=>updateSettings({enabled:event.target.checked})}/> Sonido activo</label>
      </section>
      <section>
        <h3>Ahora requiere atención</h3>
        {alerts.length?alerts.map(alert=><article className={`notification-card active ${alert.type==='billing'?'billing':''}`} key={alert.key}>
          <span>{alert.type==='billing'?<ReceiptText/>:<Timer/>}</span>
          <div><b>{alert.type==='billing'?'Facturación':alert.case?.buque||alert.event?.titulo||'Entrega'}</b><p>{alert.message}</p><small>{alert.rule?.label||'Aviso operativo'}  -  repetirá hasta gestionar</small><button className="button secondary notification-ack" onClick={()=>acknowledge?.(alert)}>Entendido</button></div>
        </article>):<p className="notification-empty">No hay avisos activos ahora mismo.</p>}
      </section>
      <section>
        <h3>Historial</h3>
        {history.length?history.map(item=><article className="notification-card" key={item.id}>
          <span><CheckCircle2/></span>
          <div><b>{item.title}</b><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div>
        </article>):<p className="notification-empty">Todavía no hay avisos guardados en este dispositivo.</p>}
      </section>
    </aside>
  </>;
}
function DeliveryPopup({alert,close,openHistory,soundSettings,updateSoundSettings}){
  const settings=normalizeAlertSoundSettings(soundSettings);
const volumeLabel=`Volumen ${Math.round(settings.volume*100)}%${settings.volume>1?' - potenciado':''}`;
  const updateSettings=patch=>{
    const next=saveAlertSoundSettings({...settings,...patch});
    updateSoundSettings?.(next);
  };
  const testSound=()=>{
    const next=saveAlertSoundSettings({...settings,enabled:true});
    updateSoundSettings?.(next);
    playAlertSound(next).catch(()=>{});
  };
  return <div className="delivery-popup" role="alertdialog" aria-label="Aviso de entrega">
    <div className="delivery-popup-icon"><Bell/></div>
    <div>
      <small>{alert.type==='billing'?'Facturación pendiente':alert.rule?.followUp?'Seguimiento operativo':'Aviso de entrega'}</small>
      <b>{alert.case?.buque||alert.event?.titulo||'Entrega programada'}</b>
      <p>{alert.message}</p>
      <div className="delivery-popup-sound">
        <label><span>Sonido</span><select value={settings.sound} onChange={event=>updateSettings({sound:event.target.value})}>{ALERT_SOUND_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label><span>{volumeLabel}</span><input type="range" min="0" max={ALERT_SOUND_MAX_VOLUME} step="0.05" value={settings.volume} onChange={event=>updateSettings({volume:Number(event.target.value)})}/></label>
        <label className="sound-toggle"><input type="checkbox" checked={settings.enabled} onChange={event=>updateSettings({enabled:event.target.checked})}/> Sonido activo</label>
      </div>
      <div className="delivery-popup-actions">
        <button className="button tertiary" onClick={testSound}>Probar sonido</button>
        <button className="button secondary" onClick={openHistory}>Ver historial</button>
        <button className="button primary" onClick={close}>Entendido</button>
      </div>
    </div>
  </div>;
}
function Sidebar({tab,open,navigate,close,nav,user,onLogout}){
  return <aside className={'sidebar '+(open?'open':'')}>
    <div className="brand"><span className="brand-mark"><Anchor/></span><div><b>SWIFTPORT</b><small>OPERATING SYSTEM</small></div><button className="icon-button sidebar-close" aria-label="Cerrar menú" onClick={close}><X/></button></div>
    <nav aria-label="Navegación principal">{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span>{tab===id&&<ChevronRight className="nav-arrow"/>}</button>)}</nav>
    <div className="sidebar-card"><div className="live-dot"/> <div><b>Operativa conectada</b><small>Datos de demostración</small></div></div>
    <div className="profile"><div className="avatar light">{initials(user.fullName)}</div><div><b>{user.fullName}</b><small>{roleLabel(user)}</small></div><button className="profile-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onLogout}><LogOut/></button></div>
  </aside>;
}
function MobileNav({tab,navigate,more,nav}){
  const visible=nav.slice(0,4);
  return <nav className={'mobile-nav '+(nav.length===1?'single':'')} aria-label="Navegación móvil">{visible.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span></button>)}{nav.length>1&&<button className={!visible.some(item=>item[0]===tab)?'active':''} onClick={more}><Menu/><span>Más</span></button>}</nav>;
}
function Badge({children,tone}){return <span className={'badge '+(tone||statusTone(children))}><i/>{children}</span>}
function SectionHeader({title,subtitle,action}){return <div className="section-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Empty({text}){return <div className="empty"><Search/><b>Sin resultados</b><p>{text}</p></div>}
function PortCallPanel({item}){const schedule=portCallSchedule(item);const destination=item.deliveryMode==='barge'?'TRANSPORTE A GABARRA':item.deliveryMode==='vessel'?'TRANSPORTE A BUQUE':'';return <section className="port-call-panel"><div><Ship/><span><small>LLEGADA  -  ETA</small><b>{cleanCalendarText(schedule.eta)}</b></span></div><div><MapPin/><span><small>ATRAQUE  -  ETB</small><b>{schedule.etb}</b></span></div><div><Clock3/><span><small>SALIDA  -  ETD</small><b>{schedule.etd}</b></span></div><div><Timer/><span><small>ESTANCIA EN PUERTO</small><b>{item.portStay||'POR CONFIRMAR'}</b></span></div>{destination&&<footer><Truck/><span><small>DESTINO OPERATIVO</small><b>{destination}{item.operationLocation?`  -  ${item.operationLocation}`:''}</b></span></footer>}</section>}
const AIS_PORT_COORDINATES={
  BARCELONA:[41.3434,2.1662],
  TARRAGONA:[41.0910,1.2164],
  VALENCIA:[39.4482,-0.3161],
  SAGUNTO:[39.6425,-0.2145],
  CASTELLON:[39.9667,0.0167],
  ALGECIRAS:[36.1307,-5.4380],
  BILBAO:[43.3550,-3.0750]
};
const aisPortCoordinates=port=>{
  const key=normalizePortKey(port);
  const name=Object.keys(AIS_PORT_COORDINATES).find(entry=>key.includes(entry));
  return name?AIS_PORT_COORDINATES[name]:null;
};
const digitsOnly=value=>String(value||'').split('').filter(char=>char>='0'&&char<='9').join('');
function VesselFinderMap({item}){
  const imo=digitsOnly(item.imo);
  const mmsi=digitsOnly(item.mmsi);
  const tracking=item.aisTracking||{};
  const liveLat=Number(tracking.latitude);
  const liveLon=Number(tracking.longitude);
  const hasLivePosition=Number.isFinite(liveLat)&&Number.isFinite(liveLon)&&liveLat>=-90&&liveLat<=90&&liveLon>=-180&&liveLon<=180;
  const portPosition=aisPortCoordinates(item.puerto);
  const position=hasLivePosition?[liveLat,liveLon]:portPosition;
  if(!position)return <div className="ais-map ais-map-unavailable"><Navigation/><span><b>Mapa pendiente de ubicación</b><small>Añade un puerto reconocido o actualiza la señal AIS del buque.</small></span></div>;
  const origin=typeof window!=='undefined'&&window.location?.origin?window.location.origin+'/':'https://app.swiftportlogistic.com/';
  const params=new URLSearchParams({
    zoom:hasLivePosition?'9':'11',
    lat:String(position[0]),
    lon:String(position[1]),
    width:'100%',
    height:'400',
    names:'true',
    track:'true',
    fleet:'false',
    fleet_name:'false',
    fleet_hide_old_positions:'false',
    clicktoact:'false',
    store_pos:'true',
    ra:origin
  });
  if(imo.length===7)params.set('imo',imo);
  else if(mmsi.length===9)params.set('mmsi',mmsi);
  const vesselUrl=imo.length===7?'https://www.vesselfinder.com/vessels/details/'+imo:mmsi.length===9?'https://www.vesselfinder.com/?mmsi='+mmsi:'https://www.vesselfinder.com/';
  return <div className="ais-map ais-vesselfinder-embed"><iframe title={'Mapa VesselFinder de '+(item.buque||'buque')} src={'https://www.vesselfinder.com/aismap?'+params.toString()} loading="eager" referrerPolicy="strict-origin-when-cross-origin"/><a className="ais-map-vessel-link" href={vesselUrl} target="_blank" rel="noreferrer">Abrir en VesselFinder <ExternalLink/></a></div>;
}function AisTrackingPanel({item,csrfToken,reloadOperational,notify}){
  const tracking=item.aisTracking;
  const hasIdentifier=String(item.imo||'').replace(/\D/g,'').length===7||String(item.mmsi||'').replace(/\D/g,'').length===9;
  const [refreshing,setRefreshing]=useState(false);
  const [deviceAlerts,setDeviceAlerts]=useState(()=>localStorage.getItem('swiftport-device-alerts')==='1'&&('Notification' in window)&&Notification.permission==='granted');
  const refresh=async()=>{
    if(refreshing||!item.mmsi)return;
    setRefreshing(true);
    try{
      const result=await api('/api/ais/refresh.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({caseRef:item.id})});
      await reloadOperational();
      notify(result.message||'Seguimiento AIS actualizado');
    }catch(reason){notify(reason.message)}
    finally{setRefreshing(false)}
  };
  const enableDeviceAlerts=async()=>{
    if(!('Notification' in window)){notify('Este navegador no admite avisos. En iPhone, añade Swiftport a la pantalla de inicio.');return}
    const permission=await Notification.requestPermission();
    if(permission!=='granted'){notify('Debes permitir las notificaciones de Swiftport en el teléfono.');return}
    localStorage.setItem('swiftport-device-alerts','1');
    setDeviceAlerts(true);
    await showDeviceNotification('Swiftport OS','Avisos AIS activados en este dispositivo.','swiftport-ais-enabled');
    notify('Avisos de aproximación activados en este teléfono');
  };
  const refreshButton=<button className="button secondary ais-refresh" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing?'spinning':''}/>{refreshing?'Buscando señal AIS…':'Actualizar posición ahora'}</button>;
  const alertButton=<button className={'button '+(deviceAlerts?'device-alert-enabled':'tertiary')} onClick={enableDeviceAlerts} disabled={deviceAlerts}><Bell/>{deviceAlerts?'Avisos activos':'Activar avisos en este móvil'}</button>;
  if(!hasIdentifier)return <section className="ais-panel ais-empty"><Navigation/><div><small>SEGUIMIENTO DEL BUQUE</small><b>Añade el IMO o MMSI para localizarlo</b><p>Edita el expediente e introduce el IMO de 7 dígitos o el MMSI de 9 dígitos.</p></div></section>;
  if(!tracking)return <section className="ais-panel"><VesselFinderMap item={item}/><div className="ais-info"><span className="overline"><Navigation/> MAPA OFICIAL VESSELFINDER</span><div className="ais-status"><i className="stale"/><span><small>DATOS DE SWIFTPORT</small><b>Esperando señal propia</b></span></div><p>El mapa oficial de VesselFinder permanece dentro de Swiftport y muestra el puerto y la última posición pública disponible. Swiftport seguirá consultando AISStream para calcular métricas y alertas.</p><div className="ais-actions">{item.mmsi?refreshButton:<p>Añade también el MMSI para activar la actualización automática de Swiftport.</p>}{alertButton}</div></div></section>;
  const last=tracking.sourceTimestamp||tracking.receivedAt;
  const stale=last&&Date.now()-new Date(last).getTime()>2*60*60*1000;
  const etaEstimate=tracking.estimatedArrivalAt?new Date(tracking.estimatedArrivalAt):null;
  return <section className="ais-panel"><VesselFinderMap item={item}/><div className="ais-info"><span className="overline"><Navigation/> VESSELFINDER + AISSTREAM</span><div className="ais-status"><i className={stale?'stale':['Atracado','En fondeo','Atraque probable'].includes(tracking.status)?'moored':'live'}/><span><small>ESTADO ESTIMADO</small><b>{stale?'Señal sin actualizar':tracking.status}</b></span></div><div className="ais-metrics"><span><small>DISTANCIA AL PUERTO</small><b>{tracking.distanceToPortNm==null?'No calculada':tracking.distanceToPortNm+' mn'}</b></span><span><small>ETA ESTIMADA AIS</small><b>{etaEstimate&&!Number.isNaN(etaEstimate.getTime())?etaEstimate.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sin calcular'}</b></span><span><small>VELOCIDAD</small><b>{tracking.speed} kn</b></span><span><small>RUMBO</small><b>{tracking.course}°</b></span><span><small>ÚLTIMA SEÑAL</small><b>{last?new Date(last).toLocaleString('es-ES'):'—'}</b></span></div><div className="ais-actions">{refreshButton}{alertButton}<p>Automático cada 30 minutos  -  ETA AIS orientativa; confirma el atraque con el consignatario.</p></div></div></section>;
}
const isoDate=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const addMonths=(date,months)=>{const next=new Date(date);next.setMonth(next.getMonth()+months);return next};
const startOfWeek=date=>{const value=new Date(date);value.setHours(12,0,0,0);return addDays(value,-((value.getDay()+6)%7))};
const startOfMonth=date=>{const value=new Date(date);value.setHours(12,0,0,0);value.setDate(1);return value};
const monthCalendarDays=date=>Array.from({length:42},(_,index)=>addDays(startOfWeek(startOfMonth(date)),index));
const DRIVER_TONES=['blue','teal','orange','purple','red','pink','green'];
function driverTone(name,team){if(!name||name==='Sin asignar')return 'gray';const index=team.findIndex(member=>member.fullName===name);return index<0?'gray':DRIVER_TONES[index%DRIVER_TONES.length]}
const PORT_TONES=['blue','orange','teal','purple','red','pink','green'];
const PORT_TONE_MAP={BARCELONA:'blue',TARRAGONA:'orange',SAGUNTO:'teal',VALENCIA:'purple',ALGECIRAS:'red',BILBAO:'green',VINAROS:'pink',CASTELLON:'teal',MARIN:'purple','A CORUNA':'green',HUELVA:'red',SEVILLA:'pink',CARTAGENA:'orange',ALICANTE:'blue',ALCANAR:'green'};
const normalizePortKey=value=>String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
function portTone(port){const key=normalizePortKey(port);if(!key)return 'gray';if(PORT_TONE_MAP[key])return PORT_TONE_MAP[key];let hash=0;for(let index=0;index<key.length;index++)hash=(hash*31+key.charCodeAt(index))>>>0;return PORT_TONES[hash%PORT_TONES.length]}
function calendarTone(event,cases){const related=(cases||[]).find(item=>item.id===event?.expediente);return portTone(related?.puerto||event?.puerto||event?.destino||event?.titulo)}
function formatSchedule(date,start,end){if(!date||!start)return 'Por programar';const label=new Date(date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.','');return label+'  -  '+start+(end?'–'+end:'')}
const isTransportCalendarEvent=event=>String(event?.tipoServicio||'').toLowerCase().startsWith('transporte')||Boolean(event?.transporte);
const isCancelledTransport=item=>/^(cancelado|cancelada|cancelled|canceled)$/i.test(String(item?.estado||item?.status||''))||Boolean(item?.cancellation?.cancelledAt);
const isActiveTransportCalendarEvent=event=>isTransportCalendarEvent(event)&&!isCancelledTransport(event);
const calendarHasValidStart=event=>/^\d{2}:\d{2}$/.test(String(event?.inicio||''));
const calendarNeedsTime=event=>!calendarHasValidStart(event)||String(event?.scheduleStatus||'')==='provisional';
const isManualSchedule=item=>String(item?.scheduleSource||'').toLowerCase()==='manual';
const calendarEventWithCaseSlot=(event,cases)=>{
  const related=(cases||[]).find(item=>item.id===event?.expediente);
  const color=portTone(related?.puerto||event?.puerto||event?.destino||event?.titulo);
  if(isManualSchedule(event))return {...event,color};
  const slot=related?transportSlotFromCase(related):null;
  if(!slot?.date)return {...event,color};
  const start=/^\d{2}:\d{2}$/.test(String(slot.start||''))?slot.start:'';
  const hasStart=/^\d{2}:\d{2}$/.test(String(start||''));
  return {...event,color,fecha:slot.date,inicio:start,fin:hasStart?plusHourClient(start):'',scheduleSource:slot.source,scheduleStatus:hasStart?'confirmed':'missing_time',scheduleNote:hasStart?`Programado por ${slot.source}`:`Falta hora ${slot.source||'ETB/ETA'}; pendiente de confirmar horario del buque`};
};
const DELIVERY_ALERT_RULES=[
  {key:'2h',label:'seguimiento 2 horas antes',ms:2*60*60*1000,followUp:true},
  {key:'8h',label:'faltan 8 horas',ms:8*60*60*1000},
  {key:'1d',label:'falta 1 dia',ms:24*60*60*1000},
  {key:'2d',label:'faltan 2 dias',ms:48*60*60*1000}
];
const TRANSPORT_FOLLOWUP_INTERVAL_MS=30*60*1000;
const BILLING_ALERT_REPEAT_MS=60*60*1000;
const deliveryAlertRepeatMs=alert=>{
  const key=alert?.rule?.key;
  if(key==='active30')return TRANSPORT_FOLLOWUP_INTERVAL_MS;
  if(key==='2h')return 15*60*1000;
  if(key==='8h')return 30*60*1000;
  return 60*60*1000;
};
const billingAlertVisibleToUser=user=>{
  const roles=rolesOf(user);
  return hasRole(roles,'admin')||hasRole(roles,'finance');
};
const invoiceClosedStatuses=['enviado a holded','enviada a holded','facturado','facturada','cobrado','cobrada','archivado','archivada','cancelado','cancelada'];
const billingInvoiceClosed=invoice=>{
  if(!invoice)return false;
  const status=String(invoice.estado||'').trim().toLowerCase();
  return invoiceClosedStatuses.includes(status)||Boolean(invoice.holdedId||invoice.holdedNumber||invoice.holdedDocumentId||invoice.archivedAt);
};
const billingAlertsForCases=(cases=[],invoices=[],user,now=new Date())=>{
  if(!billingAlertVisibleToUser(user))return[];
  const bucket=Math.floor(now.getTime()/BILLING_ALERT_REPEAT_MS);
  return (cases||[]).flatMap(item=>{
    const flow=operationFlow(item);
    const ready=Boolean(flow.billingReady||item.progreso>=100||item.estado==='Completado');
    if(!ready)return[];
    const invoice=(invoices||[]).find(entry=>entry.expediente===item.id);
    if(billingInvoiceClosed(invoice))return[];
    const amount=Number(invoice?.importe||item.importe||0);
    const status=invoice?.estado||'sin borrador';
    const vessel=String(item.buque||'BUQUE').toUpperCase();
    const port=String(item.puerto||'PUERTO POR CONFIRMAR').toUpperCase();
    const message=`Facturación pendiente: ${vessel} (${item.id}) está listo para facturar en ${port}. Estado: ${status}${amount?` · Importe aprox. ${moneyExact(amount)}`:''}.`;
    return [{key:`${item.id}-billing-${bucket}`,type:'billing',case:item,invoice,rule:{key:'billing60',label:'facturación pendiente cada 60 min'},message,moment:now}];
  });
};
const deliveryEventMoment=event=>{
  const date=String(event?.fecha||'').slice(0,10);
  if(!date)return null;
  const time=calendarHasValidStart(event)?event.inicio:'09:00';
  const moment=new Date(`${date}T${time}:00`);
  return Number.isFinite(moment.getTime())?moment:null;
};
const deliveryAlertVisibleToUser=(event,user)=>{
  const roles=rolesOf(user);
  if(hasRole(roles,'admin')||hasRole(roles,'operations'))return true;
  if(!event?.asignado||event.asignado==='Sin asignar')return true;
  return samePerson(event.asignado,user.fullName);
};
const alertClosedStatusWords=['entregado','completado','realizado','finalizado','cancelado','archivado'];
const deliveryAlertResolved=(event,related)=>{
  const eventStatus=String(event?.estado||'').toLowerCase();
  const caseStatus=String(related?.estado||'').toLowerCase();
  if(alertClosedStatusWords.some(word=>eventStatus.includes(word)||caseStatus.includes(word)))return true;
  const flow=related?operationFlow(related):{};
  if(flow.delivery||flow.billingReady)return true;
  const route=routeParts(event||{});
  const destination=String(route.destino||'').toUpperCase();
  const isWarehousePickup=destination.includes('ALMACEN')||destination.includes('ALMACÉN')||destination.includes('BLUESPACE');
  const eventDay=event?.fecha?localDay(`${event.fecha}T12:00:00`):null;
  const pickupDatePassed=eventDay?eventDay<=localDay(new Date()):false;
  return Boolean(isWarehousePickup&&flow.cargo&&pickupDatePassed);
};
const uniquePendingAlerts=alerts=>{
  const seen=new Set();
  return (alerts||[]).filter(alert=>{
    const event=alert.event||{};
    const route=routeParts(event);
    const uniqueKey=[
      alert.type||'delivery',
      alert.case?.id||event.expediente||event.id||'sin-expediente',
      alert.rule?.key||'rule',
      event.fecha||'sin-fecha',
      event.inicio||'sin-hora',
      route.origen||'sin-origen',
      route.destino||'sin-destino'
    ].join('|');
    if(seen.has(uniqueKey))return false;
    seen.add(uniqueKey);
    return true;
  });
};
const deliveryAlertsForSchedule=(events=[],cases=[],user,now=new Date())=>uniquePendingAlerts((events||[])
  .filter(isActiveTransportCalendarEvent)
  .map(event=>calendarEventWithCaseSlot(event,cases))
  .filter(event=>deliveryAlertVisibleToUser(event,user))
  .flatMap(event=>{
    const related=(cases||[]).find(item=>item.id===event.expediente);
    const flow=related?operationFlow(related):{};
    if(deliveryAlertResolved(event,related))return[];
    const moment=deliveryEventMoment(event);
    if(!moment)return[];
    const diff=moment.getTime()-now.getTime();
    const vessel=String(related?.buque||event.titulo||'BUQUE').toUpperCase();
    const port=String(related?.puerto||event.destino||event.puerto||'PUERTO POR CONFIRMAR').toUpperCase();
    const driver=event.asignado&&event.asignado!=='Sin asignar'?event.asignado:'sin conductor asignado';
    const when=moment.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const timeNote=calendarHasValidStart(event)?when:`${when} aprox. (hora pendiente)`;
    if(diff<=0&&calendarHasValidStart(event)){
      const elapsed=Math.max(0,now.getTime()-moment.getTime());
      const bucket=Math.floor(elapsed/TRANSPORT_FOLLOWUP_INTERVAL_MS);
      const rule={key:'active30',label:'seguimiento activo cada 30 min'};
      const message=`Seguimiento activo: ${vessel} tenía transporte programado para ${timeNote} en ${port}. Confirma con ${driver} que está coordinado o registra el avance.`;
      return [{key:`${event.id||event.transporte||event.expediente}-${rule.key}-${moment.toISOString()}-${bucket}`,event,case:related,rule,message,moment}];
    }
    if(diff<=0)return[];
    const rule=DELIVERY_ALERT_RULES.find(item=>diff<=item.ms);
    if(!rule)return[];
    const message=rule.followUp
      ? `Seguimiento: ${vessel} se entrega en 2 horas (${timeNote}). Revisa con ${driver}.`
      : `${vessel}: ${rule.label} para la entrega (${timeNote}) en ${port}. Conductor: ${driver}.`;
    return [{key:`${event.id||event.transporte||event.expediente}-${rule.key}-${moment.toISOString()}`,event,case:related,rule,message,moment}];
  }));
const localDay=date=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
const driverTimeLabel=event=>calendarNeedsTime(event)?'Falta hora':event.inicio;
const driverEventTimestamp=event=>{
  if(!event?.fecha)return Number.MAX_SAFE_INTEGER;
  const start=calendarHasValidStart(event)?event.inicio:'23:59';
  const value=new Date(`${event.fecha}T${start}:00`).getTime();
  return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
};
const driverEventSort=(first,second)=>driverEventTimestamp(first)-driverEventTimestamp(second)||String(first?.titulo||'').localeCompare(String(second?.titulo||''));
const driverTransportDone=(event,cases=[],transports=[])=>{
  const related=(cases||[]).find(item=>item.id===event?.expediente);
  const linked=(transports||[]).find(item=>item.id===event?.transporte)||null;
  const flow=related?operationFlow(related):{};
  const status=String(event?.estado||linked?.estado||'').toLowerCase();
  if(['entregado','completado','realizado','finalizado'].some(word=>status.includes(word)))return true;
  if(flow.billingReady||flow.delivery||related?.estado==='Completado'||related?.estado==='Cancelado')return true;
  const route=routeParts(linked||event);
  const destination=String(route.destino||'').toUpperCase();
  const isWarehousePickup=destination.includes('ALMACEN')||destination.includes('ALMACÉN')||destination.includes('BLUESPACE');
  const eventDay=event?.fecha?localDay(`${event.fecha}T12:00:00`):null;
  const pickupDatePassed=eventDay?eventDay<=localDay(new Date()):false;
  return Boolean(isWarehousePickup&&flow.cargo&&pickupDatePassed);
};
const driverDueInfo=event=>{
  if(!event?.fecha)return {label:'Sin fecha',detail:'Revisar expediente',tone:'missing'};
  const today=localDay(new Date());
  const target=localDay(`${event.fecha}T12:00:00`);
  const days=Math.round((target-today)/86400000);
  const time=driverTimeLabel(event);
  if(days<0)return {label:'Atrasado',detail:`Hace ${Math.abs(days)} día${Math.abs(days)===1?'':'s'}  -  ${time}`,tone:'late'};
  if(days===0)return {label:'Hoy',detail:time,tone:'today'};
  if(days===1)return {label:'Mañana',detail:time,tone:'soon'};
  if(days<=6)return {label:`En ${days} días`,detail:time,tone:'soon'};
  return {label:new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.',''),detail:time,tone:'later'};
};
const calendarServiceStatus=(event,cases=[])=>{
  const related=(cases||[]).find(item=>item.id===event?.expediente);
  const flow=related?operationFlow(related):{};
  const done=Boolean(flow.billingReady||flow.delivery||related?.estado==='Completado'||event?.estado==='Entregado');
  return done?{className:'done',label:'Terminado',icon:<CheckCircle2/>}:{className:'pending',label:'Pendiente',icon:<CircleAlert/>};
};
function DriverLegend({events=[],cases=[]}){const ports=[...new Set((events||[]).filter(isActiveTransportCalendarEvent).map(event=>cases.find(item=>item.id===event.expediente)?.puerto||event.puerto).filter(Boolean).map(port=>String(port).trim().toUpperCase()))].sort();return <div className="driver-legend port-legend"><span><i className="gray"/>Puerto sin indicar</span>{ports.map(port=><span key={port}><i className={portTone(port)}/>{port}</span>)}</div>}
const cleanCalendarText=value=>normalizeTextEncoding(String(value||''));
function CalendarEventContent({event,cases}){const related=cases.find(item=>item.id===event.expediente);const schedule=related?portCallSchedule(related):null;const missingTime=calendarNeedsTime(event);const port=cleanCalendarText(related?.puerto||event.puerto||'');const status=calendarServiceStatus(event,cases);const route=routeParts(event);const routeLabel=cleanCalendarText([route.origen,route.destino].filter(Boolean).join(' → '));const vessel=cleanCalendarText(related?.buque||event.titulo||'Buque sin indicar');const service=cleanCalendarText(event.tipoServicio||'Transporte');const assigned=cleanCalendarText(event.asignado||'Sin asignar');return <><span className={`calendar-status-pill ${status.className}`} title={cleanCalendarText(status.label)}>{status.icon}<em>{cleanCalendarText(status.label)}</em></span><time>{missingTime?'FALTA HORARIO':`${event.inicio}${event.fin?`–${event.fin}`:''}`}</time><b className="calendar-vessel-name">{vessel}</b>{port&&<b className="calendar-port-name">{port}</b>}<small className="calendar-service">{service}</small>{routeLabel&&<small className="calendar-route">{routeLabel}</small>}{missingTime&&<small className="calendar-provisional">PENDIENTE ETB / HORA</small>}<small>{assigned}</small>{schedule&&<small className="calendar-port-call">LLEGADA  -  ETA {cleanCalendarText(schedule.eta)}</small>}</>}
function CalendarDriverSelect({event,team,saveEvent}){const drivers=team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver'));const assign=change=>{change.stopPropagation();saveEvent({...withoutCalendarLayout(event),asignado:change.target.value})};return <label className="calendar-driver-quick" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}><span>Conductor</span><select value={event.asignado||'Sin asignar'} onChange={assign} aria-label="Asignar conductor"><option>Sin asignar</option>{drivers.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label>}
const calendarMinutes=value=>{const [hour,minute]=String(value||'').split(':').map(Number);return Number.isFinite(hour)?hour*60+(minute||0):0};
const layoutOverlappingEvents=events=>{
  const sorted=[...events].sort((first,second)=>calendarMinutes(first.inicio)-calendarMinutes(second.inicio)||calendarMinutes(first.fin)-calendarMinutes(second.fin));
  const result=[];let cluster=[];let clusterEnd=-1;let active=[];
  const finishCluster=()=>{
    if(!cluster.length)return;
    const rawColumns=Math.max(1,...cluster.map(item=>item._lane+1));
    const columns=rawColumns;
    cluster.forEach(item=>result.push({...item,_columns:columns,_lane:item._lane,_stackOffset:0,_rawColumns:rawColumns}));
    cluster=[];active=[];clusterEnd=-1;
  };
  sorted.forEach(event=>{
    const start=calendarMinutes(event.inicio);
    const end=Math.max(start+30,calendarMinutes(event.fin)||start+60);
    if(cluster.length&&start>=clusterEnd)finishCluster();
    active=active.filter(item=>item._end>start);
    const used=new Set(active.map(item=>item._lane));let lane=0;while(used.has(lane))lane++;
    const positioned={...event,_lane:lane,_end:end};
    active.push(positioned);cluster.push(positioned);clusterEnd=Math.max(clusterEnd,end);
  });
  finishCluster();
  return result;
};
const CALENDAR_HOUR_HEIGHT=72;
const calendarEventStyle=event=>{
  const start=calendarMinutes(event.inicio),end=Math.max(start+30,calendarMinutes(event.fin)||start+60);
  const visibleStart=Math.max(0,Math.min(1439,start));
  const visibleEnd=Math.max(visibleStart+30,Math.min(1440,end));
  const columns=event._columns||1,lane=event._lane||0;
  return {
    top:visibleStart/60*CALENDAR_HOUR_HEIGHT,
    height:Math.max(72,(visibleEnd-visibleStart)/60*CALENDAR_HOUR_HEIGHT),
    left:`calc(4px + (100% - 8px) * ${lane}/${columns})`,
    width:`calc((100% - 8px) / ${columns} - ${columns>1?2:0}px)`,
    right:'auto'
  };
};
const withoutCalendarLayout=event=>{const {_lane,_columns,_end,_stackOffset,_rawColumns,...clean}=event;return clean};
const minutesToClock=minutes=>{
  const safe=Math.max(0,Math.min(1439,Math.round(Number(minutes)||0)));
  return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;
};
const eventDurationMinutes=event=>{
  const start=calendarMinutes(event.inicio),end=calendarMinutes(event.fin);
  return Math.max(30,(end&&end>start?end-start:60));
};
const calendarDropTime=(mouseEvent,dayElement)=>{
  const rect=dayElement.getBoundingClientRect();
  const y=Math.max(0,Math.min(rect.height,mouseEvent.clientY-rect.top));
  const minutes=Math.round(((y/CALENDAR_HOUR_HEIGHT)*60)/15)*15;
  return minutesToClock(Math.max(0,Math.min(1410,minutes)));
};
function CalendarMonthView({days,monthDate,events,cases,setEditing,openCase}){
  const today=isoDate(new Date());
  const activeMonth=startOfMonth(monthDate).getMonth();
  const weekday=new Intl.DateTimeFormat('es-ES',{weekday:'short'});
  const eventsByDay=days.reduce((acc,day)=>({...acc,[isoDate(day)]:events.filter(event=>event.fecha===isoDate(day)).sort((a,b)=>driverEventSort(a,b))}),{});
  return <section className="calendar-shell panel calendar-month-shell"><div className="calendar-month-head">{days.slice(0,7).map(day=><b key={weekday.format(day)}>{weekday.format(day).replace('.','')}</b>)}</div><div className="calendar-month-grid">{days.map(day=>{const fecha=isoDate(day);const dayEvents=eventsByDay[fecha]||[];return <div key={fecha} className={`calendar-month-day ${day.getMonth()!==activeMonth?'muted':''} ${fecha===today?'today':''}`}><span>{day.getDate()}</span>{dayEvents.slice(0,5).map(event=>{const related=cases.find(item=>item.id===event.expediente);const route=routeParts(event);return <button key={event.id} className={`calendar-month-event ${event.color||'gray'}`} onClick={()=>event.expediente?openCase(event.expediente):setEditing(event)}><time>{calendarNeedsTime(event)?'Falta hora':event.inicio}</time><b>{[related?.buque||event.titulo,related?.puerto||event.puerto].filter(Boolean).join(' - ')}</b><small>{related?.puerto||event.puerto||'Puerto pendiente'}</small><em>{route.origen} → {route.destino}</em></button>})}{dayEvents.length>5&&<small className="calendar-month-more">+{dayEvents.length-5} servicios más</small>}</div>})}</div></section>;
}
function Calendario({events,team,cases,transports,providers,warehouseEntries,saveEvent,deleteEvent,completeCaseStep,undoCaseStep,openCase,currentUser,csrfToken,reloadOperational,notify,onEvidenceUploaded}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const [viewMode,setViewMode]=useState('week');
  const [editing,setEditing]=useState(null);
  const [mineOnly,setMineOnly]=useState(false);
  const [draggingId,setDraggingId]=useState('');
  const [dropTarget,setDropTarget]=useState('');
  const pointerDrag=useRef(null);
  const suppressCalendarClick=useRef(false);
  if(isDriverOnly(currentUser))return <DriverCalendarV2 events={events} cases={cases} transports={transports} warehouseEntries={warehouseEntries} currentUser={currentUser} saveEvent={saveEvent} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} onEvidenceUploaded={onEvidenceUploaded}/>;
  const periodStart=viewMode==='week'?startOfWeek(weekStart):viewMode==='month'?startOfMonth(weekStart):localDay(weekStart);
  const days=viewMode==='month'?monthCalendarDays(periodStart):Array.from({length:viewMode==='day'?1:7},(_,index)=>addDays(periodStart,index));
  const hours=Array.from({length:24},(_,index)=>index);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const calendarTitle=viewMode==='month'?periodStart.toLocaleDateString('es-ES',{month:'long',year:'numeric'}):viewMode==='day'?periodStart.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):`${days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – ${days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}`;
  const movePeriod=direction=>setWeekStart(current=>viewMode==='month'?addMonths(current,direction):addDays(current,direction*(viewMode==='day'?1:7)));
  const goToday=()=>setWeekStart(viewMode==='week'?startOfWeek(new Date()):new Date());
  const newEvent=()=>setEditing({id:'EV-'+Date.now(),titulo:'',tipoServicio:'Transporte',fecha:isoDate(days[0]),inicio:'',fin:'',asignado:'Sin asignar',expediente:'',transporte:'',color:'gray',scheduleStatus:'missing_time'});
  const baseEvents=(mineOnly?events.filter(event=>samePerson(event.asignado,currentUser.fullName)):events).filter(isActiveTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases));
  const timedEvents=baseEvents.filter(event=>!calendarNeedsTime(event));
  const missingTimeEvents=baseEvents.filter(calendarNeedsTime);
  const canDeleteEvent=hasRole(currentUser,'operations')||hasRole(currentUser,'admin');
  const saveMovedEvent=(event,target,point,withTime=true)=>{
    if(!event||!target)return;
    const fecha=target.dataset.calendarDay||target.dataset.missingDay;
    if(!fecha)return;
    const clean=withoutCalendarLayout(event);
    if(withTime&&target.dataset.calendarDay){
      const inicio=calendarDropTime(point,target);
      const fin=minutesToClock(Math.min(1320,calendarMinutes(inicio)+eventDurationMinutes(clean)));
      saveEvent({...clean,fecha,inicio,fin,scheduleStatus:'confirmed',scheduleNote:''});
      notify?.(`Transporte movido al ${new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')} a las ${inicio}`);
    }else{
      saveEvent({...clean,fecha,inicio:'',fin:'',scheduleStatus:'missing_time',scheduleNote:'Falta hora ETB; pendiente de confirmar horario'});
      notify?.(`Transporte movido al ${new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')}`);
    }
  };
  const startPointerDrag=(pointer,event)=>{
    if(pointer.button!==undefined&&pointer.button!==0)return;
    if(pointer.target?.closest?.('.calendar-event-open,.calendar-event-delete,.calendar-event-edit,.calendar-driver-quick,select,input'))return;
    pointerDrag.current={event,x:pointer.clientX,y:pointer.clientY,moved:false};
    setDraggingId(event.id);
    pointer.stopPropagation();
  };
  const openCalendarEvent=(click,event)=>{
    if(suppressCalendarClick.current){click.preventDefault();return}
    if(click.target?.closest?.('.calendar-event-delete,.calendar-event-edit,.calendar-driver-quick,select,input'))return;
    event.expediente?openCase(event.expediente):setEditing(event);
  };
  useEffect(()=>{
    const targetAt=pointer=>{
      const targets=[...document.querySelectorAll('[data-calendar-day],[data-missing-day]')];
      return targets.find(target=>{
        const rect=target.getBoundingClientRect();
        return pointer.clientX>=rect.left&&pointer.clientX<=rect.right&&pointer.clientY>=rect.top&&pointer.clientY<=rect.bottom;
      })||null;
    };
    const targetKey=target=>target?.dataset?.calendarDay?`time-${target.dataset.calendarDay}`:target?.dataset?.missingDay?`missing-${target.dataset.missingDay}`:'';
    const onMove=pointer=>{
      const drag=pointerDrag.current;
      if(!drag)return;
      const moved=Math.abs(pointer.clientX-drag.x)+Math.abs(pointer.clientY-drag.y)>8;
      if(!moved)return;
      drag.moved=true;
      pointer.preventDefault();
      setDropTarget(targetKey(targetAt(pointer)));
    };
    const onUp=pointer=>{
      const drag=pointerDrag.current;
      if(!drag)return;
      pointerDrag.current=null;
      setDraggingId('');
      setDropTarget('');
      if(!drag.moved)return;
      suppressCalendarClick.current=true;
      window.setTimeout(()=>{suppressCalendarClick.current=false},250);
      const target=targetAt(pointer);
      if(target?.dataset?.calendarDay){
        saveMovedEvent(drag.event,target,pointer,true);
      }else if(target?.dataset?.missingDay){
        saveMovedEvent(drag.event,target,pointer,false);
      }
    };
    const cancel=()=>{pointerDrag.current=null;setDraggingId('');setDropTarget('')};
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',cancel);
    return ()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',cancel)};
  },[saveEvent,notify]);
  return <>
    <section className="calendar-toolbar">
      <div className="calendar-nav"><button className="button tertiary calendar-nav-icon" type="button" aria-label="Periodo anterior" title="Periodo anterior" onClick={()=>movePeriod(-1)}><ChevronLeft aria-hidden="true" size={18}/></button><button className="button tertiary" type="button" onClick={goToday}>Hoy</button><button className="button tertiary calendar-nav-icon" type="button" aria-label="Periodo siguiente" title="Periodo siguiente" onClick={()=>movePeriod(1)}><ChevronRight aria-hidden="true" size={18}/></button><h2>{calendarTitle}</h2></div>
      <div className="calendar-actions"><div className="calendar-view-switch">{['day','week','month'].map(mode=><button key={mode} className={viewMode===mode?'active':''} onClick={()=>{setViewMode(mode);setWeekStart(current=>mode==='week'?startOfWeek(current):mode==='month'?startOfMonth(current):localDay(current))}}>{mode==='day'?'Día':mode==='week'?'Semana':'Mes'}</button>)}</div>{hasRole(currentUser,'operations')&&<button className={'button '+(mineOnly?'secondary':'tertiary')} onClick={()=>setMineOnly(!mineOnly)}><UserRound/> Mis servicios</button>}<button className="button primary" onClick={newEvent}><Plus/> Nuevo transporte</button></div>
    </section>
    {viewMode==='month'?<CalendarMonthView days={days} monthDate={periodStart} events={baseEvents} cases={cases} setEditing={setEditing} openCase={openCase}/>:<section className="calendar-shell panel" style={{'--calendar-days':days.length,'--calendar-min-width':`${70+(days.length*260)}px`}}>
      <div className="calendar-help"><span><CalendarDays/> Solo transportes a ETB/ETA</span><small>Las recepciones quedan en expediente/almacén. Si falta hora ETB/ETA, el transporte queda arriba del día como “Falta horario”.</small></div>
      <div className="calendar-scroll">
        <div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div>
        <div className="calendar-unscheduled-row"><span>Falta horario</span>{days.map(day=><div key={isoDate(day)} data-missing-day={isoDate(day)} className={dropTarget===`missing-${isoDate(day)}`?'drop-target':''}>{missingTimeEvents.filter(event=>event.fecha===isoDate(day)).map(event=><article key={event.id} onPointerDown={pointer=>startPointerDrag(pointer,event)} onClick={click=>openCalendarEvent(click,event)} className={`calendar-unscheduled-card ${event.color||'gray'} ${draggingId===event.id?'dragging':''}`}><button className="calendar-event-open" title={event.expediente?'Abrir expediente':'Editar servicio'} onClick={click=>{click.stopPropagation();openCalendarEvent(click,event)}}><CalendarEventContent event={event} cases={cases}/></button><CalendarDriverSelect event={event} team={team} saveEvent={saveEvent}/><button type="button" className="calendar-event-edit" title="Editar servicio" onClick={click=>{click.stopPropagation();setEditing(event)}}><PencilLine/></button>{canDeleteEvent&&deleteEvent&&<button type="button" className="calendar-event-delete" title="Eliminar servicio" onClick={click=>{click.stopPropagation();deleteEvent(event)}}><Trash2/></button>}</article>)}</div>)}</div>
        <div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div data-calendar-day={isoDate(day)} className={`calendar-day ${dropTarget===`time-${isoDate(day)}`?'drop-target':''}`} key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}
          {layoutOverlappingEvents(timedEvents.filter(event=>event.fecha===isoDate(day))).map(event=><DraggableCalendarEvent key={event.id} event={event} cases={cases} team={team} saveEvent={saveEvent} setEditing={setEditing} openCase={openCase} canDeleteEvent={canDeleteEvent} deleteEvent={deleteEvent} startPointerDrag={startPointerDrag} draggingId={draggingId} suppressClick={()=>suppressCalendarClick.current}/>)}</div>)}</div>
      </div>
    </section>}
    {editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} providers={providers} warehouseEntries={warehouseEntries} close={()=>setEditing(null)} submit={item=>{saveEvent(item);setEditing(null)}} openCase={openCase}/>}
  </>;
}
function DraggableCalendarEvent({event,cases,team,saveEvent,setEditing,openCase,canDeleteEvent,deleteEvent,startPointerDrag,draggingId,suppressClick}){
  const clean=withoutCalendarLayout(event);
  const openRelated=click=>{
    if(suppressClick?.()){click.preventDefault();return}
    if(click.target?.closest?.('.calendar-event-delete,.calendar-event-edit,.calendar-driver-quick,select,input'))return;
    clean.expediente?openCase(clean.expediente):setEditing(clean);
  };
  return <article onPointerDown={pointer=>startPointerDrag(pointer,clean)} onClick={openRelated} className={`calendar-event ${event.color} ${event._columns>1?'is-overlap':''} ${event._columns>2?'many-overlaps':''} ${draggingId===event.id?'dragging':''}`} style={calendarEventStyle(event)} title={`${event.inicio}–${event.fin}  -  ${event.titulo||event.id}`}>
    <button className="calendar-event-open" title={clean.expediente?'Abrir expediente':'Editar servicio'} onPointerDown={pointer=>pointer.stopPropagation()} onClick={click=>{click.stopPropagation();openRelated(click)}}><CalendarEventContent event={event} cases={cases}/></button>
    <CalendarDriverSelect event={event} team={team} saveEvent={saveEvent}/>
    <button type="button" className="calendar-event-edit" title="Editar servicio" onClick={click=>{click.stopPropagation();setEditing(clean)}}><PencilLine/></button>
    {canDeleteEvent&&deleteEvent&&<button type="button" className="calendar-event-delete" title="Eliminar servicio" onClick={click=>{click.stopPropagation();deleteEvent(clean)}}><Trash2/></button>}
    {event._rawColumns>1&&<span className="overlap-indicator">{(event._stackOffset||0)*event._columns+event._lane+1}/{event._rawColumns}</span>}
  </article>;
}
function DriverCalendar({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,csrfToken}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const sorted=[...events].filter(isActiveTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort((a,b)=>(a.fecha+a.inicio).localeCompare(b.fecha+b.inicio));
  const visible=sorted.filter(event=>scope==='mine'?samePerson(event.asignado,currentUser.fullName):scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const pending=visible.filter(event=>cases.find(item=>item.id===event.expediente)?.estado!=='Completado').length;
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Puedes consultar todos los trabajos y asignarte cualquiera cuando sea necesario.</p></div><strong>{pending}<small>trabajos pendientes</small></strong></section><section className="panel driver-jobs"><SectionHeader title="Calendario de trabajos" subtitle="Servicios por fecha, hora y conductor"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{events.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{events.filter(event=>event.asignado===currentUser.fullName).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{events.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div>{visible.length?<div className="driver-job-list">{visible.map(event=>{const related=cases.find(item=>item.id===event.expediente);const completed=related?.estado==='Completado';const next=related&&nextOperationStep(related);const mine=event.asignado===currentUser.fullName;const schedule=related?portCallSchedule(related):null;return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>setSelected(event)}><time><b>{event.inicio}</b><small>{new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'})}</small></time><span className="driver-job-main"><b>{related?.buque||event.titulo}</b><small>{event.tipoServicio}  -  {related?.puerto||'Puerto pendiente'}</small>{schedule&&<small className="driver-port-call">LLEGADA DEL BUQUE  -  ETA {schedule.eta}</small>}<em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR'}</i></span><span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related||{})}%`}</small></span><ChevronRight/></button>})}</div>:<Empty text="No hay trabajos en este filtro."/>}</section>{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} onEvidenceUploaded={onEvidenceUploaded} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)}/>}</>;
}
function DriverJobList({events,cases,transports=[],currentUser,select}){
  const transportEvents=(events||[]).filter(isActiveTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort(driverEventSort);
  if(!transportEvents.length)return <Empty text="No hay transportes en esta vista."/>;
  return <div className="driver-job-list">{transportEvents.map(event=>{
    const related=cases.find(item=>item.id===event.expediente);
    if(!related)return null;
    const completed=driverTransportDone(event,cases,transports);
    const next=nextOperationStep(related);
    const mine=samePerson(event.asignado,currentUser.fullName);
    const schedule=portCallSchedule(related);
    const due=driverDueInfo(event);
    const linkedTransport=transports.find(item=>item.id===event.transporte)||transports.find(item=>item.expediente===event.expediente);
    const route=routeParts(linkedTransport||event);
    const assignment=mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR';
    return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>select(event)}>
      <time><b>{driverTimeLabel(event)}</b><small>{event.fecha?new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'}):'Sin fecha'}</small></time>
      <span className="driver-job-main"><span className="driver-job-title-row"><b>{related.buque||event.titulo}</b><span className={`driver-due-badge ${due.tone}`}><strong>{due.label}</strong><small>{due.detail}</small></span></span><small>{related.puerto||'Puerto pendiente'}  -  {event.tipoServicio||'Transporte a buque'}</small><small className="driver-port-call">BUQUE: {schedule.etb!=='POR CONFIRMAR'?`ETB ${schedule.etb}`:`ETA ${schedule.eta}`}</small><span className="driver-job-route"><small>RECOGIDA</small><b>{route.origen}</b><small>ENTREGA</small><b>{route.destino}</b></span><em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{assignment}</i></span>
      <span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related)}%`}</small></span><ChevronRight/>
    </button>;
  })}</div>;
}
function DriverWeekView({events,cases,transports=[],select,saveEvent,notify}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const [draggingId,setDraggingId]=useState('');
  const [dropTarget,setDropTarget]=useState('');
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:24},(_,index)=>index);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const transportEvents=(events||[]).filter(isActiveTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases));
  const timedEvents=transportEvents.filter(event=>!calendarNeedsTime(event));
  const missingTimeEvents=transportEvents.filter(calendarNeedsTime);
  const isEventCompleted=event=>driverTransportDone(event,cases,transports);
  const eventById=id=>transportEvents.find(event=>event.id===id)||events.find(event=>event.id===id);
  const startDrag=(mouse,event)=>{mouse.dataTransfer.effectAllowed='move';mouse.dataTransfer.setData('text/plain',event.id);setDraggingId(event.id)};
  const allowDrop=(mouse,target)=>{mouse.preventDefault();mouse.dataTransfer.dropEffect='move';setDropTarget(target)};
  const finishDrop=(mouse,day,withTime=false)=>{
    mouse.preventDefault();
    const event=eventById(mouse.dataTransfer.getData('text/plain')||draggingId);
    setDraggingId('');setDropTarget('');
    if(!event||!saveEvent)return;
    const clean=withoutCalendarLayout(event);
    const fecha=isoDate(day);
    if(withTime){
      const inicio=calendarDropTime(mouse,mouse.currentTarget);
      const fin=minutesToClock(Math.min(1320,calendarMinutes(inicio)+eventDurationMinutes(clean)));
      saveEvent({...clean,fecha,inicio,fin,scheduleStatus:'confirmed',scheduleNote:''});
      notify?.(`Transporte movido al ${new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')} a las ${inicio}`);
    }else{
      saveEvent({...clean,fecha,inicio:'',fin:'',scheduleStatus:'missing_time',scheduleNote:'Falta hora ETB; pendiente de confirmar horario'});
      notify?.(`Transporte movido al ${new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')}`);
    }
  };
  return <><section className="calendar-toolbar driver-week-toolbar"><div className="calendar-nav"><button className="button tertiary calendar-nav-icon" type="button" aria-label="Semana anterior" title="Semana anterior" onClick={()=>setWeekStart(addDays(weekStart,-7))}><ChevronLeft aria-hidden="true" size={18}/></button><button className="button tertiary" type="button" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Hoy</button><button className="button tertiary calendar-nav-icon" type="button" aria-label="Semana siguiente" title="Semana siguiente" onClick={()=>setWeekStart(addDays(weekStart,7))}><ChevronRight aria-hidden="true" size={18}/></button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div></section><section className="calendar-shell panel driver-week"><div className="calendar-scroll"><div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div><div className="calendar-unscheduled-row"><span>Falta horario</span>{days.map(day=><div key={isoDate(day)}>{missingTimeEvents.filter(event=>event.fecha===isoDate(day)).map(event=><button key={event.id} className={`calendar-unscheduled-card ${event.color||'gray'} ${isEventCompleted(event)?'completed':''}`} onClick={()=>select(event)}><CalendarEventContent event={event} cases={cases}/>{isEventCompleted(event)&&<small className="driver-week-done">COMPLETADO</small>}</button>)}</div>)}</div><div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div className="calendar-day" key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}{layoutOverlappingEvents(timedEvents.filter(event=>event.fecha===isoDate(day))).map(event=>{const related=cases.find(item=>item.id===event.expediente);const completed=driverTransportDone(event,cases,transports);return <article key={event.id} className={`calendar-event driver-week-event ${event.color} ${event._columns>1?'is-overlap':''} ${completed?'completed':''}`} style={calendarEventStyle(event)}><button className="calendar-event-open" onClick={()=>select(withoutCalendarLayout(event))}><CalendarEventContent event={event} cases={cases}/>{related&&<small className={completed?'driver-week-done':'driver-week-progress'}>{completed?'COMPLETADO':`${operationProgress(related)}% completado`}</small>}</button></article>})}</div>)}</div></div></section></>;
}
const plusHourClient=time=>{const [hour,minute]=String(time||'09:00').split(':').map(Number);return `${String((hour+1)%24).padStart(2,'0')}:${String(minute||0).padStart(2,'0')}`};
function DriverCalendarV2({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,undoCaseStep,csrfToken,reloadOperational,notify,onEvidenceUploaded}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const [view,setView]=useState('hub');
  const sorted=[...events].filter(isActiveTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort(driverEventSort);
  const isCompleted=event=>driverTransportDone(event,cases,transports);
  const pendingEvents=sorted.filter(event=>cases.some(item=>item.id===event.expediente)&&!isCompleted(event));
  const completedEvents=sorted.filter(isCompleted).reverse();
  const visiblePending=pendingEvents.filter(event=>scope==='mine'?samePerson(event.asignado,currentUser.fullName):scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Trabajos pendientes limpios, planificación semanal e histórico separado.</p></div><strong>{pendingEvents.length}<small>trabajos pendientes</small></strong></section><nav className="driver-view-tabs" aria-label="Vistas del conductor"><button className={view==='hub'?'active':''} onClick={()=>setView('hub')}><LayoutDashboard/> HUB <span>{pendingEvents.length}</span></button><button className={view==='week'?'active':''} onClick={()=>setView('week')}><CalendarDays/> Semana <span>{sorted.length}</span></button><button className={view==='history'?'active':''} onClick={()=>setView('history')}><CheckCircle2/> Historial <span>{completedEvents.length}</span></button></nav>{view==='hub'&&<section className="panel driver-jobs"><SectionHeader title="Trabajo pendiente" subtitle="Los completados desaparecen automáticamente de esta vista"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{pendingEvents.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{pendingEvents.filter(event=>samePerson(event.asignado,currentUser.fullName)).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{pendingEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div><DriverJobList events={visiblePending} cases={cases} transports={transports} currentUser={currentUser} select={setSelected}/></section>}{view==='week'&&<DriverWeekView events={sorted} cases={cases} transports={transports} select={setSelected}/>} {view==='history'&&<section className="panel driver-jobs"><SectionHeader title="Historial completado" subtitle="Consulta separada de trabajos al 100 %"/><DriverJobList events={completedEvents} cases={cases} transports={transports} currentUser={currentUser} select={setSelected}/></section>}{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)} undo={key=>undoCaseStep(selected.expediente,key)}/>}</>;
}
function ShipmentDocuments({item,onDelete,onUpload,uploading}){
  const documentation=item?.documentacionMercancia||{};
  const arrivalDocuments=(item?.recepciones||[]).flatMap(record=>record.documentos||[]);
  const documents=[...(documentation.archivosEnvio||[]),...arrivalDocuments].filter((file,index,list)=>list.findIndex(entry=>(entry.id||entry.url)===(file.id||file.url))===index);
  const individual=(item?.mercancias||[]).flatMap(piece=>(piece.documentos||[]).map(type=>`${piece.cantidad} ${piece.tipo}${piece.cantidad===1?'':'S'}  -  ${type}`));
  const customs=documentation.alcance==='global'
    ? documentation.aduaneroDisponible?`${documentation.tipoAduanero||'DOCUMENTO ADUANERO'} DISPONIBLE`:'DOCUMENTO ADUANERO PENDIENTE'
    : individual.length?individual.join('  -  '):'DOCUMENTOS INDIVIDUALES PENDIENTES';
  const scopeFor=file=>(arrivalDocuments||[]).some(stored=>sameAttachment(stored,file))?'reception-document':'shipment';
  return <section className="shipment-documents">
    <div className="shipment-documents-head"><span className="shipment-documents-title"><FileCheck2/><span><b>DOCUMENTACION DEL ENVIO</b><small>{customs}</small></span></span>{onUpload&&<div className="shipment-upload-actions"><MultiPhotoButton className="button secondary small" disabled={Boolean(uploading)} title="Fotos de documentos del envío" onFiles={onUpload}><Camera/> Fotografiar varios documentos</MultiPhotoButton><label className={'button tertiary small attachment-upload '+(uploading?'disabled':'')}><UploadCloud/> {uploading?'Subiendo...':'Añadir PDFs'}<input type="file" multiple accept="application/pdf" disabled={Boolean(uploading)} onChange={event=>{onUpload(event.target.files);event.target.value=''}}/></label></div>}</div>
    {documents.length?<div className="shipment-document-list">{documents.map((file,index)=><div className="attachment-row" key={file.id||file.url||index}><a href={file.url} target="_blank" rel="noreferrer"><FileText/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>{onDelete&&<button type="button" className="icon-button danger attachment-delete" aria-label="Eliminar documento" onClick={()=>onDelete(file,scopeFor(file))}><Trash2/></button>}</div>)}</div>:<p><CircleAlert/> Todavia no hay archivos de packing list, delivery note, CMR o aduanas.</p>}
  </section>;
}
function WarehouseTransportReview({entries,item,checked,setChecked}){
  const totalUnits=entries.reduce((sum,entry)=>{
    const explicit=Number(entry.bultos);
    return sum+(Number.isFinite(explicit)?explicit:merchandiseCount(entry.mercancias));
  },0);
  return <section className="warehouse-transport-review">
    <div className="warehouse-review-head"><Box/><span><b>Revisión obligatoria de almacén</b><small>{entries.length?`Hay ${entries.length} partida(s) activas para ${item.buque}. Revisa también mercancía antigua o sin expediente.`:`No aparece stock activo para ${item.buque}, pero debes confirmarlo antes de cerrar.`}</small></span><strong>{totalUnits} bultos</strong></div>
    {entries.length?<div className="warehouse-review-list">{entries.map((entry,index)=>{
      const pieces=(entry.mercancias||[]).length?(entry.mercancias||[]).map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'}${line.peso?`  -  ${line.peso}`:''}`).join('  -  '):`${entry.bultos||0} bultos${entry.peso?`  -  ${entry.peso}`:''}`;
      const linked=entry.expediente===item.id?'Este expediente':entry.expediente?`Otro expediente: ${entry.expediente}`:'Sin expediente vinculado';
      const vessel=entry.buque||item.buque||'BUQUE SIN INDICAR';
      return <article key={entry.ref||index}><span><b>{vessel}</b><small>{entry.ref||`Entrada ${index+1}`}  -  {linked}  -  {entry.entrada||formatReceptionDate(entry.fechaRecepcion||entry.fecha)||'Fecha pendiente'}</small></span><em>{pieces}</em><small>{entry.zona||'Ubicación pendiente'}</small></article>;
    })}</div>:<p><CircleAlert/> Si sabes que hay una caja antigua para este buque, regístrala en almacén antes de cerrar la entrega.</p>}
    <label className="warehouse-review-check"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/><span>He revisado todo lo que hay en almacén para este buque y se entregará todo lo pendiente.</span></label>
  </section>;
}
function WarehouseCargoReception({entries,selectedRefs,toggle}){
  const totalUnits=entries.reduce((sum,entry)=>sum+(Number(entry.bultos)||merchandiseCount(entry.mercancias)),0);
  return <section className="warehouse-cargo-reception">
    <div className="warehouse-review-head"><WarehouseIcon/><span><b>Mercancía ya registrada en almacén</b><small>{entries.length?'Selecciona las entradas que corresponden a este expediente para recepcionarlas aquí.':'No hay stock activo detectado para este buque/expediente. Puedes tomar fotos de recepción para crear la entrada.'}</small></span><strong>{totalUnits} bultos</strong></div>
    {entries.length?<div className="warehouse-cargo-list">{entries.map((entry,index)=>{
      const pieces=(entry.mercancias||[]).length?(entry.mercancias||[]).map(line=>`${line.cantidad} ${line.tipo}${Number(line.cantidad)===1?'':'S'}${line.peso?`  -  ${line.peso} KG`:''}${line.seguimiento?`  -  ${line.seguimiento}`:''}`).join('  -  '):`${entry.bultos||0} bultos${entry.peso?`  -  ${entry.peso}`:''}`;
      const photos=entry.fotos||[];
      const docs=entry.documentosRecepcion||[];
      return <article key={entry.ref||index} className={selectedRefs.includes(entry.ref)?'selected':''}>
        <label><input type="checkbox" checked={selectedRefs.includes(entry.ref)} onChange={()=>toggle(entry.ref)}/><span><b>{entry.buque||'BUQUE SIN INDICAR'}</b><small>{entry.ref||`Entrada ${index+1}`}  -  {entry.expediente?`Expediente ${entry.expediente}`:'Sin expediente'}  -  {entry.entrada||formatReceptionDate(entry.fechaRecepcion||entry.fecha)||'Fecha pendiente'}  -  {entry.zona||'Ubicación pendiente'}</small></span></label>
        <p>{pieces}</p>
        {(photos.length||docs.length)?<div className="warehouse-cargo-evidence">{photos.slice(0,3).map((photo,photoIndex)=><a href={photo.url} target="_blank" rel="noreferrer" key={photo.id||photo.url||photoIndex}><Camera/> Foto {photoIndex+1}</a>)}{docs.slice(0,3).map((file,fileIndex)=><a href={file.url} target="_blank" rel="noreferrer" key={file.id||file.url||fileIndex}><FileText/> {documentLabel(file.name)}</a>)}</div>:<small className="warehouse-cargo-warning"><CircleAlert/> Sin fotos/documentos adjuntos en esta entrada</small>}
      </article>;
    })}</div>:<p><CircleAlert/> Si la mercancía ya está físicamente en almacén pero no aparece aquí, regístrala primero desde Almacén o toma fotos en este paso.</p>}
  </section>;
}
function PodDocuments({item,notify,onDelete,onUploadPod,onUploadDeliveryPhoto,uploading}){
  const documentation=item?.documentacionMercancia||{};
  const pods=(documentation.podArchivos||[]).length?documentation.podArchivos:(documentation.podArchivo?[documentation.podArchivo]:[]);
  const deliveryPhotos=documentation.fotosEntrega||[];
  const podException=Boolean(documentation.podNoSellado);
  return <div className="document-box"><h3>POD de entrega <small>{pods.length?`${pods.length} PDF${pods.length===1?'':'S'}`:podException?'NO SELLADO':'PENDIENTE'}</small></h3>
    <div className="pod-upload-actions">{onUploadDeliveryPhoto&&<MultiPhotoButton className="button secondary" disabled={uploading==='delivery-photo'} title="Fotos de entrega" onFiles={onUploadDeliveryPhoto}><Camera/> {uploading==='delivery-photo'?'Subiendo...':'Tomar varias fotos de entrega'}</MultiPhotoButton>}{onUploadPod&&<><MultiPhotoButton className="button secondary" disabled={uploading==='pod'} title="Fotos del POD" onFiles={onUploadPod}><ScanLine/> {uploading==='pod'?'Subiendo...':'Fotografiar varias páginas del POD'}</MultiPhotoButton><label className={'button tertiary attachment-upload '+(uploading==='pod'?'disabled':'')}><FileText/> Añadir PDF de POD<input type="file" multiple accept="application/pdf" disabled={uploading==='pod'} onChange={event=>{onUploadPod(event.target.files);event.target.value=''}}/></label></>}</div>
    {podException&&<div className="pod-exception-note"><CircleAlert/><span><b>POD no sellado / no disponible</b><small>{documentation.podObservacion||'Sin observacion registrada'}</small></span></div>}{pods.length?pods.map((file,index)=><div className="attachment-row compact" key={file.id||file.url||index}><a className="document-link" href={file.url} target="_blank" rel="noreferrer"><FileText/><span><b>POD {index+1}</b><small>{file.name}</small></span><ExternalLink/></a>{onDelete&&<button type="button" className="icon-button danger attachment-delete" aria-label="Eliminar POD" onClick={()=>onDelete(file,'pod')}><Trash2/></button>}</div>):!podException&&<button onClick={()=>notify('POD todavia pendiente')}><Camera/><span><b>POD / fotografias</b><small>Pendiente de entrega</small></span><ChevronRight/></button>}{deliveryPhotos.length>0&&<div className="delivery-photo-list"><b>Fotos de entrega</b>{deliveryPhotos.map((file,index)=><div className="attachment-row compact" key={file.id||file.url||index}><a className="document-link" href={file.url} target="_blank" rel="noreferrer"><Camera/><span><b>Foto entrega {index+1}</b><small>{file.name}</small></span><ExternalLink/></a>{onDelete&&<button type="button" className="icon-button danger attachment-delete" aria-label="Eliminar foto de entrega" onClick={()=>onDelete(file,'delivery-photo')}><Trash2/></button>}</div>)}</div>}</div>;
}
function DriverTaskModal({event,item,transport,warehouseEntries,currentUser,csrfToken,reloadOperational,notify,onEvidenceUploaded,close,claim,submit,undo}){
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [warehouseReviewed,setWarehouseReviewed]=useState(false);
  const [podException,setPodException]=useState(false);
  const step=item?nextOperationStep(item):null;
  useEffect(()=>{setNote('');setEvidenceFiles([]);setError('');setWarehouseReviewed(false);setPodException(false)},[step?.key,item?.id]);
  if(!item)return null;
  const flow=operationFlow(item);
  const steps=operationStepsFor(item);
  const storageOnly=isStorageOnly(item);
  const surveyService=isSurveyService(item);
  const lastCompleted=[...steps].reverse().find(entry=>flow[entry.key]);
  const mine=true;
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const instructions={
    review:'Lee el servicio completo y comprueba buque, fecha, puerto, ruta, mercancía y observaciones antes de empezar.',
    cargo:surveyService?'Confirma llegada al buque o acceso a bordo para realizar el muestreo. Puedes añadir foto si hace falta.':inWarehouse?'Comprueba cantidades, peso y estado de la mercancía antes de cargar.':'Recoge la mercancía en el lugar indicado y comprueba cantidades, peso y estado.',
    documents:surveyService?'Revisa instrucciones, formularios o documentos del muestreo antes de cerrar el servicio.':'Comprueba que están listos los documentos necesarios antes de salir a entregar.',
    assignment:'El transporte debe quedar asignado. Puedes asignártelo desde esta misma pantalla si está libre.',
    delivery:surveyService?'Confirma que el survey / Ballast Water Samples quedó realizado y adjunta foto, nota o informe.':'Antes de entregar, revisa todo lo que hay en almacén para este buque. Luego fotografía la entrega y escanea el POD firmado.'
  };
  if(storageOnly)instructions.delivery='Confirma la salida del almacén o la recogida por tercero con una foto/evidencia clara.';
  const uploadEvidence=async(files,evidenceType)=>{
    const selected=[...files].filter(Boolean);
    if(!selected.length)return;
    setUploading(true);setError('');
    try{
      const uploaded=[];
      for(const file of selected){
        const prepared=evidenceType==='pod'&&file.type.startsWith('image/')?await scannedPodPdf(file,item.id):file;
        const stored=await uploadAttachment(prepared,prepared.type==='application/pdf'?'document':'photo',csrfToken);
        uploaded.push({...stored,evidenceType});
      }
      setEvidenceFiles(current=>[...current,...uploaded]);
      await onEvidenceUploaded?.(item.id,uploaded,evidenceType);
      if(evidenceType==='pod'&&selected.some(file=>file.type.startsWith('image/')))notify?.('POD escaneado automáticamente: recortado, corregido y guardado como PDF');
    }catch(reason){setError(reason.message)}finally{setUploading(false)}
  };
  const cargoPhotos=evidenceFiles.filter(file=>file.evidenceType==='cargo-photo');
  const deliveryPhotos=evidenceFiles.filter(file=>file.evidenceType==='delivery-photo');
  const podFiles=evidenceFiles.filter(file=>file.evidenceType==='pod');
  const vesselWarehouseEntries=warehouseEntriesForVessel(warehouseEntries,item);
  const noteRequiredForPodException=step?.key==='delivery'&&!storageOnly&&!surveyService&&podException;
  const podExceptionExplained=podException&&note.trim().length>0;
  const deliveryEvidenceCount=deliveryPhotos.length+(podException?podFiles.length:0);
  const warehouseReviewMissing=step?.key==='delivery'&&!surveyService&&!warehouseReviewed;
  const evidenceReady=step?.key==='cargo'?cargoPhotos.length>0||surveyService:step?.key==='delivery'?(surveyService?(deliveryPhotos.length>0||podFiles.length>0):warehouseReviewed&&deliveryEvidenceCount>0&&(storageOnly||(podException?podExceptionExplained:podFiles.length>0))):true;
  const deliveryMissingReason=warehouseReviewMissing?'Marca que revisaste el almacén':storageOnly?'Añade evidencia de salida':deliveryEvidenceCount===0?'Añade una foto de entrega':podException&&!podExceptionExplained?'Escribe la observación del POD no sellado':'Añade el POD firmado';
  const needsEvidence=['cargo','delivery'].includes(step?.key);
  const evidenceLabel=file=>file.evidenceType==='pod'?(surveyService?'Informe / documento':podException?'Evidencia de entrega':'POD escaneado'):file.evidenceType==='delivery-photo'?(surveyService?'Evidencia survey':'Foto de entrega'):'Foto de recepción';
  return <div className="modal-backdrop driver-task-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)close()}}>
    <section className="modal driver-task-modal">
      <div className="modal-head"><div><span className="overline">{event.inicio}–{event.fin}  -  {event.tipoServicio}</span><h2>{item.buque}</h2><p>{caseLabel(item)}</p></div><button className="icon-button" onClick={close}><X/></button></div>
      <div className="driver-task-body">
        <div className="driver-route"><MapPin/><span><small>PUERTO / RUTA</small><b>{transport?.ruta||item.puerto}</b></span></div>
        {false&&<div className="driver-owner-alert"><UserRound/><span><b>{event.asignado&&event.asignado!=='Sin asignar'?`Asignado a ${event.asignado}`:'Trabajo sin conductor'}</b><small>Asígnatelo antes de registrar avances.</small></span><button className="button secondary" onClick={claim}>Asignarme</button></div>}
        <OperationChecklist item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} currentRoles={currentUser}/>
        <CargoManifest item={item} transport={transport||event}/>
        {flow.cargo&&<ShipmentDocuments item={item}/>}
        {step?<>
          <div className="driver-next-action"><span>{steps.findIndex(entry=>entry.key===step.key)+1}</span><div><small>AHORA TOCA</small><b>{step.title}</b><p>{instructions[step.key]}</p></div></div>
          {step.key==='delivery'&&!surveyService&&<WarehouseTransportReview entries={vesselWarehouseEntries} item={item} checked={warehouseReviewed} setChecked={setWarehouseReviewed}/>}
          {needsEvidence&&<div className="pod-scanner evidence-capture">
            <div><Camera/><span><b>{step.key==='cargo'?(surveyService?'Evidencia inicial del survey':'Fotos de la mercancía recibida'):surveyService?'Evidencia del survey realizado':storageOnly?'Evidencias de salida / recogida':'Evidencias de la entrega'}</b><small>{step.key==='cargo'?(surveyService?'Opcional: foto de acceso, equipo o llegada al buque.':'Se requiere al menos una foto; puedes añadir todas las necesarias.'):surveyService?'Se requiere foto, documento o informe del servicio realizado.':storageOnly?'Se requiere foto o evidencia clara de que la mercancía salió del almacén.':podException?'Se requiere foto de entrega y observación; no hace falta POD.':'Se requiere foto de la entrega y POD firmado.'}</small></span></div>
            {false&&<div className="evidence-assignment-lock"><LockKeyhole/><span><b>Activa el registro de este trabajo</b><small>{event.asignado&&event.asignado!=='Sin asignar'?`Ahora figura asignado a ${event.asignado}. Asígnatelo para activar la cámara y el POD.`:'El servicio todavía no tiene conductor. Asígnatelo para activar la cámara y el POD.'}</small></span><button className="button secondary" onClick={claim}>Asignarme y activar</button></div>}
            <div className="pod-scanner-actions">
              <MultiPhotoButton className="button primary" disabled={uploading||!mine} title={step.key==='cargo'?'Fotos de recepción':'Fotos de entrega'} onFiles={files=>uploadEvidence(files,step.key==='cargo'?'cargo-photo':'delivery-photo')}><Camera/> {uploading?'Procesando…':step.key==='cargo'?'Tomar varias fotos de recepción':'Tomar varias fotos de entrega'}</MultiPhotoButton>
              {step.key==='delivery'&&!storageOnly&&!surveyService&&!podException&&<><MultiPhotoButton className="button secondary" disabled={uploading||!mine} title="Fotos del POD" onFiles={files=>uploadEvidence(files,'pod')}><ScanLine/> Fotografiar varias páginas del POD</MultiPhotoButton><label className={`button tertiary${!mine?' disabled':''}`}><FileText/> Añadir PDFs de POD<input type="file" accept="application/pdf" multiple disabled={uploading||!mine} onChange={change=>{uploadEvidence(change.target.files,'pod');change.target.value=''}}/></label></>}
              {step.key==='delivery'&&surveyService&&<label className={`button tertiary${!mine?' disabled':''}`}><FileText/> Añadir informe / PDF<input type="file" accept="application/pdf" multiple disabled={uploading||!mine} onChange={change=>{uploadEvidence(change.target.files,'pod');change.target.value=''}}/></label>}
            </div>
            {step.key==='delivery'&&!storageOnly&&!surveyService&&<label className={'document-switch pod-exception '+(podException?'checked':'')}><input type="checkbox" checked={podException} onChange={change=>setPodException(change.target.checked)}/><CircleAlert/><span><b>POD no sellado / no disponible</b><small>Permite cerrar la entrega dejando una observación obligatoria para facturación.</small></span></label>}
            {step.key==='delivery'&&<div className="evidence-requirements"><span className={deliveryEvidenceCount?'done':''}><CheckCircle2/> {surveyService?'Foto / evidencia':storageOnly?'Evidencia de salida':'Evidencia de entrega'} {deliveryEvidenceCount?`(${deliveryEvidenceCount})`:'pendiente'}</span>{!storageOnly&&!surveyService&&<span className={(podException?podExceptionExplained:podFiles.length>0)?'done':''}><CheckCircle2/> {podException?'POD no disponible':'POD firmado'} {podException?(podExceptionExplained?'justificado con observación':'falta la observación'):podFiles.length?`(${podFiles.length})`:'pendiente'}</span>}{surveyService&&<span className={podFiles.length?'done':''}><CheckCircle2/> Informe / documento {podFiles.length?`(${podFiles.length})`:'opcional'}</span>}</div>}
            {evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{evidenceLabel(file)} {file.evidenceType==='pod'?'':index+1}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
            {error&&<p className="form-error"><CircleAlert/>{error}</p>}
          </div>}
          <label className="field"><span>{noteRequiredForPodException?'Observación obligatoria':'Observación del trabajo (opcional)'}</span><input value={note} onChange={change=>setNote(change.target.value)} placeholder={noteRequiredForPodException?'Ej. El buque/consignatario no selló el POD, entrega realizada sin sello…':'Persona que recibe, incidencia, referencia…'}/></label>
          <button className="button primary full driver-confirm" disabled={uploading||!evidenceReady} onClick={()=>submit(step.key,note,{files:evidenceFiles,podException,podExceptionReason:note})}><CheckCircle2/> {!evidenceReady?(step.key==='cargo'?'Añade una foto para confirmar':surveyService?'Añade evidencia o informe del survey':deliveryMissingReason):`Confirmar: ${step.title}`}</button>
        </>:<div className="driver-finished"><CheckCircle2/><span><b>Trabajo terminado</b><small>{surveyService?'Survey confirmado y expediente listo para facturación.':storageOnly?'Salida confirmada y expediente listo para facturación.':'POD recibido y expediente listo para facturación.'}</small></span></div>}
        {mine&&lastCompleted&&<button className="button tertiary full driver-undo-step" onClick={()=>undo(lastCompleted.key)}><Undo2/> Deshacer: {lastCompleted.title}</button>}
        <button className="button tertiary full" onClick={close}>{flow.billingReady?'Cerrar':'Volver al calendario'}</button>
      </div>
    </section>
  </div>;
}
function DriverTaskModalLegacy({event,item,transport,warehouseEntries,currentUser,csrfToken,reloadOperational,notify,close,claim,submit,undo}){
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const step=item?nextOperationStep(item):null;
  useEffect(()=>{setNote('');setEvidenceFiles([]);setError('')},[step?.key]);
  if(!item)return null;
  const flow=operationFlow(item);
  const steps=operationStepsFor(item);
  const storageOnly=isStorageOnly(item);
  const lastCompleted=[...steps].reverse().find(entry=>flow[entry.key]);
  const mine=samePerson(event.asignado,currentUser.fullName);
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const instructions={
    review:'Lee el servicio completo y comprueba buque, fecha, puerto, ruta, mercancía y observaciones antes de empezar.',
    cargo:inWarehouse?'Comprueba cantidades, peso y estado de la mercancía antes de cargar.':'Recoge la mercancía en el lugar indicado y comprueba cantidades, peso y estado.',
    documents:'Comprueba que están listos los documentos necesarios antes de salir a entregar.',
    delivery:'Entrega toda la mercancía, confirma quién la recibe y fotografía o escanea el POD firmado. Al confirmar quedará lista para facturar.'
  };
  const uploadEvidence=async file=>{if(!file)return;setUploading(true);setError('');try{const prepared=step.key==='delivery'&&file.type.startsWith('image/')?await scannedPodPdf(file,item.id):file;const uploaded=await uploadAttachment(prepared,prepared.type==='application/pdf'?'document':'photo',csrfToken);setEvidenceFiles(current=>step.key==='cargo'?[...current,uploaded]:[uploaded]);if(step.key==='delivery'&&file.type.startsWith('image/'))notify?.('POD escaneado y guardado como PDF')}catch(reason){setError(reason.message)}finally{setUploading(false)}};
  const needsEvidence=['cargo','delivery'].includes(step?.key);
  const evidenceTitle=step?.key==='cargo'?'Fotografiar mercancía recibida':storageOnly?'Confirmar salida de almacén':'Scanner automático de POD';
  return <div className="modal-backdrop driver-task-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)close()}}><section className="modal driver-task-modal"><div className="modal-head"><div><span className="overline">{event.inicio}–{event.fin}  -  {event.tipoServicio}</span><h2>{item.buque}</h2><p>{caseLabel(item)}</p></div><button className="icon-button" onClick={close}><X/></button></div><div className="driver-task-body"><div className="driver-route"><MapPin/><span><small>PUERTO / RUTA</small><b>{transport?.ruta||item.puerto}</b></span></div>{!mine&&<div className="driver-owner-alert"><UserRound/><span><b>{event.asignado&&event.asignado!=='Sin asignar'?`Asignado a ${event.asignado}`:'Trabajo sin conductor'}</b><small>Asígnatelo antes de registrar avances.</small></span><button className="button secondary" onClick={claim}>Asignarme</button></div>}<OperationChecklist item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify}/><CargoManifest item={item} transport={transport||event}/>{step?<><div className="driver-next-action"><span>{OPERATION_STEPS.findIndex(entry=>entry.key===step.key)+1}</span><div><small>AHORA TOCA</small><b>{step.title}</b><p>{instructions[step.key]}</p></div></div>{needsEvidence&&<div className="pod-scanner"><div><Camera/><span><b>{evidenceTitle}</b><small>{step.key==='cargo'?'Haz al menos una foto clara. Puedes añadir varias.':'Haz una foto del POD; Swiftport lo recorta, limpia y guarda como PDF.'}</small></span></div><div className="pod-scanner-actions"><label className="button primary"><Camera/> {uploading?'Escaneando…':step.key==='cargo'?'Hacer foto':'Escanear con cámara'}<input type="file" accept="image/*" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>{step.key==='delivery'&&<label className="button tertiary"><FileText/> Adjuntar PDF<input type="file" accept="application/pdf" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>}</div>{evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={file.id}><CheckCircle2/><span><b>{step.key==='cargo'?`Foto ${index+1}`:'POD escaneado en PDF'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}{error&&<p className="form-error"><CircleAlert/>{error}</p>}</div>}<label className="field"><span>Observación del trabajo (opcional)</span><input value={note} disabled={!mine} onChange={change=>setNote(change.target.value)} placeholder="Persona que recibe, incidencia, referencia…"/></label><button className="button primary full driver-confirm" disabled={!mine||uploading||(needsEvidence&&!evidenceFiles.length)} onClick={()=>submit(step.key,note,step.key==='cargo'?evidenceFiles:evidenceFiles[0]||null)}><CheckCircle2/> {needsEvidence&&!evidenceFiles.length?(step.key==='cargo'?'Haz una foto para confirmar':'Escanea el POD para confirmar'):`Confirmar: ${step.title}`}</button></>:<div className="driver-finished"><CheckCircle2/><span><b>Trabajo terminado</b><small>POD recibido y expediente listo para facturación.</small></span></div>}{mine&&lastCompleted&&<button className="button tertiary full driver-undo-step" onClick={()=>undo(lastCompleted.key)}><Undo2/> Deshacer: {lastCompleted.title}</button>}<button className="button tertiary full" onClick={close}>{flow.billingReady?'Cerrar':'Volver al calendario'}</button></div></section></div>;
}
function Dashboard({cases,warehouseEntries,calendarEvents,openCase,navigate,showFinance,user}){
  const today=isoDate(new Date());
  const now=Date.now();
  const activeCases=cases.filter(item=>!['Completado','Cancelado'].includes(item.estado));
  const stockEntries=warehouseEntries.filter(item=>!item.archivado&&item.estado!=='Expedido');
  const stock=stockEntries.reduce((sum,item)=>sum+Number(item.bultos||0),0);
  const realEvents=(calendarEvents||[]).map(event=>calendarEventWithCaseSlot(event,cases));
  const pendingEvents=realEvents.filter(event=>{
    const related=cases.find(item=>item.id===event.expediente);
    return !related||!['Completado','Cancelado'].includes(related.estado);
  });
  const eventMoment=event=>driverEventTimestamp(event);
  const upcomingEvents=pendingEvents
    .filter(event=>event.fecha&&eventMoment(event)>=now-30*60*1000)
    .sort(driverEventSort);
  const urgentCases=activeCases.filter(item=>item.prioridad==='Urgente');
  const missingDriver=pendingEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar');
  const missingTime=pendingEvents.filter(calendarNeedsTime);
  const readyToBill=cases.filter(item=>operationFlow(item).billingReady||item.progreso>=100);
  const deliveryWatch=upcomingEvents
    .map(event=>({event,related:cases.find(item=>item.id===event.expediente)}))
    .filter(entry=>entry.related)
    .map(({event,related})=>{
      const next=nextOperationStep(related);
      const missing=[calendarNeedsTime(event)&&'falta hora',(!event.asignado||event.asignado==='Sin asignar')&&'sin conductor'].filter(Boolean).join(' · ');
      const step=next?.title||'Listo para facturar';
      return {tone:missing?'warning':related.prioridad==='Urgente'?'danger':'info',title:String(related.buque||event.titulo||'BUQUE').toUpperCase(),meta:`${event.fecha} ${calendarNeedsTime(event)?'Falta hora':event.inicio} · Paso: ${step}${missing?` · ${missing}`:''}`,action:()=>openCase(related.id)};
    });
  const attention=[
    ...deliveryWatch,
    ...missingDriver.slice(0,2).map(event=>({tone:'warning',title:'Transporte sin conductor',meta:`${String(event.titulo||'BUQUE').toUpperCase()} · ${formatSchedule(event.fecha,event.inicio,event.fin)}`,action:()=>navigate('calendario')})),
    ...missingTime.slice(0,2).map(event=>({tone:'warning',title:'Falta horario de servicio',meta:`${String(event.titulo||'BUQUE').toUpperCase()} · ${event.fecha||'Sin fecha'}`,action:()=>navigate('calendario')})),
    ...urgentCases.slice(0,2).map(item=>({tone:'danger',title:'Expediente urgente',meta:`${caseLabel(item)} · ${item.puerto}`,action:()=>openCase(item.id)})),
    ...readyToBill.filter(item=>item.estado!=='Completado').slice(0,3).map(item=>({tone:'info',title:'Listo para facturar',meta:`${caseLabel(item)} · revisar borrador`,action:()=>showFinance?navigate('facturacion'):openCase(item.id)}))
  ].slice(0,5);
  const alerts=attention.length;
  const billing=readyToBill.reduce((sum,item)=>sum+Number(item.importe||0),0);
  const recent=[...cases].sort(newestFirst).slice(0,6);
  const nextFive=upcomingEvents.slice(0,5);
  const agendaSubtitle=nextFive.length?'Próximos 5 trabajos por fecha y hora':'Sin trabajos próximos';
  const agendaMeta=event=>{
    const related=cases.find(item=>item.id===event.expediente);
    const dateLabel=event.fecha?new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'}).replace('.',''):'Sin fecha';
    const route=[event.origen,event.destino].filter(Boolean).join(' → ')||event.titulo||event.puerto||related?.puerto||'Ruta por confirmar';
    return `${dateLabel} · ${event.tipoServicio||'Transporte'} · ${route} · ${event.asignado||'Sin asignar'}`;
  };
  const agendaTitle=event=>{
    const related=cases.find(item=>item.id===event.expediente);
    return String(related?.buque||event.buque||event.vessel||event.titulo||'BUQUE POR CONFIRMAR').replace(/^BUQUE\s+/i,'').toUpperCase();
  };
  const eta48=activeCases.filter(item=>{
    const moment=new Date(String(item.eta||'').slice(0,10)+'T12:00:00');
    if(!Number.isFinite(moment.getTime()))return false;
    const diff=moment.getTime()-Date.now();
    return diff>=0&&diff<=48*60*60*1000;
  }).length;
  return <>
    <section className="welcome"><div><span className="overline"><Sparkles/> Resumen del turno</span><h2>Buenos días, {user.fullName.split(' ')[0]}</h2><p>Hay <b>{alerts} operaciones que necesitan atención</b>. El resto avanza según lo previsto.</p></div><button className="button ghost-light" onClick={()=>navigate('expedientes')}>Ver operativa <ChevronRight/></button></section>
    <section className={'kpi-grid '+(!showFinance?'kpi-grid-three':'')}>
      <Kpi icon={Ship} label="Expedientes activos" value={activeCases.length} note={`${eta48} con ETA en 48 h`} tone="blue"/>
      <Kpi icon={PackageCheck} label="Bultos en almacén" value={String(stock)} note={`${stockEntries.length} entradas activas`} tone="teal"/>
      <Kpi icon={CircleAlert} label="Requieren acción" value={alerts} note={`${urgentCases.length} de prioridad urgente`} tone="orange"/>
      {showFinance&&<Kpi icon={WalletCards} label="Listo para facturar" value={money(billing)} note={`${readyToBill.length} expedientes completados`} tone="green"/>}
    </section>
    <div className="dashboard-grid">
      <section className="panel attention-panel"><SectionHeader title="Requieren acción" subtitle="Ordenado por prioridad" action={<button className="text-button" onClick={()=>navigate('expedientes')}>Ver todos</button>}/><div className="attention-list">
        {attention.length?attention.map((item,index)=><ActionItem key={index} {...item}/>):<Empty text="No hay incidencias operativas ahora mismo."/>}
      </div></section>
      <section className="panel today-panel"><SectionHeader title="Agenda operativa" subtitle={agendaSubtitle}/><div className="schedule">
        {nextFive.length?nextFive.map(event=><Schedule key={event.id} time={calendarNeedsTime(event)?'Falta hora':event.inicio} title={agendaTitle(event)} meta={agendaMeta(event)} active={!calendarNeedsTime(event)} alert={calendarNeedsTime(event)}/>):<Empty text="No hay transportes próximos programados."/>}
      </div></section>
    </div>
    <section className="panel operations"><SectionHeader title="Operaciones recientes" subtitle="Últimos expedientes creados o modificados" action={<button className="filter-button" onClick={()=>navigate('expedientes')}><Filter/> Filtrar</button>}/><div className="responsive-table"><div className="table-head"><span>Expediente</span><span>Destino</span><span>ETA</span><span>Progreso</span><span>Estado</span><span/></div>{recent.map(item=><button className="table-row" key={item.id} onClick={()=>openCase(item.id)}><span className="primary-cell"><span className="ship-icon"><Ship/></span><span><b>{caseLabel(item)}</b><small>{item.cliente}</small></span></span><span data-label="Destino"><MapPin/>{item.puerto}</span><span data-label="ETA">{item.eta}</span><span data-label="Progreso"><span className="mini-progress"><i style={{width:item.progreso+'%'}}/></span>{item.progreso}%</span><span data-label="Revisión Holded" className="billing-review-column">{['Facturado','Cobrado'].includes(item.estado)?<><HoldedBillingReview item={item} cost={finalCost} revenue={finalRevenue} margin={finalMargin}/><Badge>{item.estado}</Badge></>:<Badge>{item.estado}</Badge>}</span><ChevronRight/></button>)}</div></section>
  </>;
}
function Kpi({icon:Icon,label,value,note,tone}){return <article className="kpi-card"><div className={'kpi-icon '+tone}><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>}
function ActionItem({tone,title,meta,action}){return <button className="attention-item" onClick={action}><span className={'attention-dot '+tone}/><span><b>{title}</b><small>{meta}</small></span><ChevronRight/></button>}
function Schedule({time,title,meta,active,alert}){return <div className={'schedule-item '+(active?'active ':'')+(alert?'alert':'')}><time>{time}</time><span className="schedule-line"><i/></span><span><b>{title}</b><small>{meta}</small></span></div>}
function Expedientes({cases,selected,select,search,setSearch,completeCaseStep,notify,showFinance,updateCase,updateTransport,deleteCase,deleteAttachment,reopenCaseStep,clientOptions,warehouseEntries,transports,calendarEvents,team,providers,vessels,saveEvent,csrfToken,reloadOperational,currentUser,actorName,onEvidenceUploaded}){
  const [filter,setFilter]=useState('Todos');
  const [mobileDetail,setMobileDetail]=useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const [flowOpen,setFlowOpen]=useState(false);
  const [flowStep,setFlowStep]=useState(null);
  const openFlowStep=key=>{setFlowStep(key||null);setFlowOpen(true)};
  const [postUpload,setPostUpload]=useState('');
  const attachCaseFiles=async(scope,files)=>{
    const selectedFiles=[...files].filter(Boolean);
    if(!selected||!selectedFiles.length)return;
    setPostUpload(scope);
    try{
      const uploaded=[];
      for(const file of selectedFiles){
        const prepared=scope==='pod'&&file.type?.startsWith('image/')?await scannedPodPdf(file,selected.id):file;
        const stored=await uploadAttachment(prepared,prepared.type==='application/pdf'?'document':'photo',csrfToken);
        uploaded.push({...stored,evidenceType:scope==='delivery-photo'?'delivery-photo':scope==='pod'?'pod':'shipment-document'});
      }
      const documentation=selected.documentacionMercancia||{};
      const nextDocumentation=scope==='shipment'
        ? {...documentation,archivosEnvio:mergeAttachments(documentation.archivosEnvio||[],uploaded),revisada:documentation.revisada||selected.estado==='Completado'}
        : scope==='delivery-photo'
          ? {...documentation,fotosEntrega:mergeAttachments(documentation.fotosEntrega||[],uploaded)}
          : {...documentation,podDisponible:true,podArchivos:mergeAttachments(documentation.podArchivos||(documentation.podArchivo?[documentation.podArchivo]:[]),uploaded),podArchivo:documentation.podArchivo||uploaded[0]||null};
      const now=new Date();
      const labels={shipment:'Documentacion anadida',pod:'POD anadido',deliveryPhoto:'Foto de entrega anadida'};
      const title=scope==='delivery-photo'?labels.deliveryPhoto:labels[scope]||'Archivo anadido';
      const timelineEntry={id:`ATTACH-${selected.id}-${scope}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:title,detalle:`${uploaded.length} archivo(s) agregado(s) sin reabrir el expediente.`,actor:actorName||currentUser?.fullName||'Swiftport',archivos:uploaded,estado:'done'};
      await updateCase(normalizeMerchandise({...selected,documentacionMercancia:nextDocumentation,timelineCustom:[timelineEntry,...(selected.timelineCustom||[])]}));
      notify(title);
    }catch(reason){notify(reason.message||'No se pudo subir el archivo')}finally{setPostUpload('')}
  };
  const filterStatus={Todos:'Todos','En curso':'En curso',Cancelados:'Cancelado',Completados:'Completado'}[filter]||filter;
  const filtered=cases.filter(item=>(filterStatus==='Todos'||item.estado===filterStatus)&&[item.buque,item.id,item.cliente,item.puerto,item.purchaseOrder].join(' ').toLowerCase().includes(search.toLowerCase())).sort(newestFirst);
  return <div className={'case-layout '+(mobileDetail?'mobile-detail-open':'')}>
    <section className={'panel case-list '+(selected?'has-selection':'')}><div className="list-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número, buque, PO, ETA o puerto…"/></label><div className="filter-chips">{['Todos','En curso','Cancelados','Completados'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></div><div className="case-count">{filtered.length} expedientes</div>{filtered.length?filtered.map(item=><button key={item.id} className={'case-card port-'+portTone(item.puerto)+' '+(selected.id===item.id?'selected':'')} onClick={()=>{select(item.id);setMobileDetail(true)}}><div className="case-card-top"><span className="ship-icon"><Ship/></span><span><b>{caseLabel(item)}</b><small>{item.cliente}</small></span><Badge>{item.estado}</Badge></div><span className={'service-type-badge '+serviceTypeOf(item)}>{serviceTypeMeta(item).short}</span><div className="case-card-meta"><span><MapPin/>{item.puerto}</span><span><CalendarDays/>{item.eta}</span>{item.purchaseOrder&&<span><ReceiptText/>{item.purchaseOrder}</span>}</div><div className="case-progress"><span><i style={{width:item.progreso+'%'}}/></span><small>{item.progreso}%</small></div><p><b>Siguiente:</b> {item.siguiente}</p></button>):<Empty text="Prueba con otro término o estado."/>}</section>
    <section className="panel case-detail"><button className="mobile-detail-back" onClick={()=>setMobileDetail(false)}><ArrowLeft/> Expedientes</button><div className="detail-hero"><div><div className="detail-id">{selected.id} <Badge>{selected.estado}</Badge></div><h2>{selected.buque}</h2><p>{selected.cliente}  -  {selected.puerto}</p>{selected.purchaseOrder&&<p><b>PO / Purchase Order: {selected.purchaseOrder}</b></p>}<span className={'service-type-badge large '+serviceTypeOf(selected)}>{serviceTypeMeta(selected).label}</span></div><div className="detail-actions"><button className="icon-button" aria-label="Editar expediente" onClick={()=>setEditOpen(true)}><PencilLine/></button>{(hasRole(currentUser,'operations')||hasRole(currentUser,'admin'))&&<button className="icon-button danger" aria-label="Borrar expediente" onClick={()=>deleteCase(selected.id)}><Trash2/></button>}</div></div><div className={'detail-stats '+(!showFinance?'detail-stats-three':'')}><Stat label="ETA" value={selected.eta} icon={Clock3}/><Stat label="Mercancía" value={selected.bultos+' bultos  -  '+selected.peso} icon={Box}/><Stat label="Conductor" value={selected.conductor} icon={UserRound}/>{showFinance&&<Stat label="Importe previsto" value={money(selected.importe)} icon={BadgeEuro}/>}</div><PortCallPanel item={selected}/><OperationChecklist item={selected} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} currentRoles={currentUser} onStepSelect={openFlowStep}/><CaseStepReopenPanel item={selected} reopen={key=>reopenCaseStep?.(selected.id,key)}/><ShipmentDocuments item={selected} onDelete={(file,scope)=>deleteAttachment?.(selected.id,scope||'shipment',file,(selected.recepciones||[]).find(record=>(record.documentos||[]).some(stored=>sameAttachment(stored,file)))?.ref)} onUpload={files=>attachCaseFiles('shipment',files)} uploading={postUpload==='shipment'}/><div className="detail-columns"><div><h3>Línea temporal real</h3><ActualTimeline item={selected}/></div><aside className="detail-side"><div className={'next-action '+(operationFlow(selected).billingReady?'complete':'')}><span>{operationFlow(selected).billingReady?'Operativa completada':'Próxima acción'}</span><b>{selected.siguiente}</b><p>{operationFlow(selected).billingReady?'El POD está registrado y el expediente ha pasado a facturación.':'Sigue el paso indicado para que todo el equipo trabaje igual.'}</p><button className="button primary full" disabled={operationFlow(selected).billingReady} onClick={()=>openFlowStep(null)}><ClipboardCheck/> {operationFlow(selected).billingReady?'Listo para facturar':'Registrar siguiente paso'}</button></div><PodDocuments item={selected} notify={notify} onDelete={(file,scope)=>deleteAttachment?.(selected.id,scope,file)} onUploadPod={files=>attachCaseFiles('pod',files)} onUploadDeliveryPhoto={files=>attachCaseFiles('delivery-photo',files)} uploading={postUpload}/>{(hasRole(currentUser,'operations')||hasRole(currentUser,'admin'))&&<button className="button danger full" onClick={()=>deleteCase(selected.id)}><Trash2/> Borrar expediente</button>}</aside></div></section>
    {(hasRole(currentUser,'operations')||hasRole(currentUser,'admin'))&&<section className="panel case-mails-panel"><CaseEmailsPanel item={selected} csrfToken={csrfToken} notify={notify}/></section>}
    <section className="panel case-services-panel"><CaseServicesPanel item={selected} events={calendarEvents} cases={cases} transports={transports} team={team} providers={providers} warehouseEntries={warehouseEntries} saveEvent={saveEvent} updateTransport={updateTransport}/></section>
    <section className="panel case-load-panel"><CaseLoadPanel item={selected} warehouseEntries={warehouseEntries} events={calendarEvents}/></section>
    {showFinance&&<section className="panel client-cost-panel"><ClientCostPanel item={selected} warehouseEntries={warehouseEntries} updateCase={updateCase} notify={notify}/></section>}
    <section className="panel case-expenses-panel"><CaseExpensesPanel item={selected} updateCase={updateCase} notify={notify}/></section>
    <section className="panel merchandise-case-panel"><MerchandisePanel item={selected} updateCase={updateCase} deleteAttachment={deleteAttachment}/></section>
    {editOpen&&<CaseEditModal item={selected} clientOptions={clientOptions} vessels={vessels} close={()=>setEditOpen(false)} submit={item=>{updateCase(item);setEditOpen(false)}}/>}
    {flowOpen&&<OperationStepModal item={selected} warehouseEntries={warehouseEntries} transports={transports} csrfToken={csrfToken} currentUser={currentUser} onEvidenceUploaded={onEvidenceUploaded} initialStepKey={flowStep} close={()=>{setFlowOpen(false);setFlowStep(null)}} submit={(key,note,evidence)=>{if(completeCaseStep(selected.id,key,note,evidence)){setFlowOpen(false);setFlowStep(null)}}}/>}
  </div>;
}
function CaseEmailsPanel({item,csrfToken,notify}){
  const caseRef=item.id;
  const [linked,setLinked]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [selectedIds,setSelectedIds]=useState([]);
  const [search,setSearch]=useState('');
  const [mailboxFilter,setMailboxFilter]=useState('all');
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const loadVersion=useRef(0);
  const load=async()=>{
    const version=++loadVersion.current;
    setLoading(true);setError('');
    try{
      const [linkedResult,candidateResult]=await Promise.all([
        api('/api/mail/inbox.php?case_ref='+encodeURIComponent(caseRef)),
        api('/api/mail/inbox.php?link=unlinked')
      ]);
      if(version!==loadVersion.current)return;
      setLinked([...(linkedResult.items||[])].sort(newestMailFirst));
      setCandidates([...(candidateResult.items||[])].sort(newestMailFirst));
      setSelectedIds([]);
    }catch(reason){if(version===loadVersion.current)setError(reason.message)}finally{if(version===loadVersion.current)setLoading(false)}
  };
  useEffect(()=>{load()},[caseRef]);
  const mailboxLabel=value=>String(value||'').toLowerCase().includes('operations@')?'operations@':'info@';
  const searchable=mail=>[mail.subject,mail.sender_name,mail.sender_email,mail.body,mail.extracted?.vessel,mail.extracted?.port].filter(Boolean).join(' ').toLowerCase();
  const vesselNeedle=String(item.buque||'').trim().toLowerCase();
  const caseNeedle=String(caseRef).toLowerCase();
  const suggested=mail=>{const text=searchable(mail);return Boolean((vesselNeedle&&text.includes(vesselNeedle))||text.includes(caseNeedle))};
  const visibleCandidates=candidates
    .filter(mail=>mailboxFilter==='all'||mailboxLabel(mail.mailbox)===`${mailboxFilter}@`)
    .filter(mail=>searchable(mail).includes(search.trim().toLowerCase()))
    .sort(newestMailFirst);
  const toggle=id=>setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const linkSelected=async()=>{
    if(!selectedIds.length)return;
    setSaving(true);setError('');
    try{
      for(const id of selectedIds)await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({id,action:'link',caseRef})});
      notify?.(`${selectedIds.length} correo(s) vinculado(s) a ${caseRef}`);
      await load();
    }catch(reason){const message=reason.message;await load();setError(message)}finally{setSaving(false)}
  };
  const unlink=async mail=>{
    setSaving(true);setError('');
    try{
      await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({id:mail.id,action:'unlink'})});
      notify?.('Correo desvinculado');
      await load();
    }catch(reason){setError(reason.message)}finally{setSaving(false)}
  };
  const sync=async()=>{
    setSyncing(true);setError('');
    try{
      const result=await api('/api/mail/process.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:'{}'});
      notify?.(`${Number(result.summary?.scanned||0)} correo(s) nuevo(s) encontrados`);
      await load();
    }catch(reason){setError(reason.message)}finally{setSyncing(false)}
  };
  const allVisibleSelected=visibleCandidates.length>0&&visibleCandidates.every(mail=>selectedIds.includes(mail.id));
  return <>
    <SectionHeader title="Emails del barco" subtitle={loading?'Consultando operations@ e info@…':`${linked.length} vinculado(s) · ${candidates.length} disponible(s) para seleccionar`} action={<button className="button secondary" disabled={loading||syncing||saving} onClick={sync}><RefreshCw className={syncing?'spinning':''}/>{syncing?'Actualizando…':'Actualizar bandejas'}</button>}/>
    {error&&<div className="form-error"><CircleAlert/>{error}</div>}
    <div className="case-mail-picker">
      <div className="case-mail-picker-head"><div><b>Seleccionar correos para {item.buque}</b><small>Más recientes primero. Marca los mensajes de operations@ o info@ que pertenezcan a este expediente.</small></div><button className="button primary" disabled={!selectedIds.length||saving} onClick={linkSelected}><FolderKanban/>{saving?'Vinculando…':`Vincular ${selectedIds.length||''} seleccionado${selectedIds.length===1?'':'s'}`}</button></div>
      <div className="case-mail-picker-tools"><label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={`Buscar ${item.buque}, remitente, asunto o texto…`}/></label><div className="mail-filters">{[['all','Todos'],['operations','operations@'],['info','info@']].map(([value,label])=><button key={value} className={mailboxFilter===value?'active':''} onClick={()=>setMailboxFilter(value)}>{label}</button>)}</div><button className="text-button" disabled={!visibleCandidates.length} onClick={()=>setSelectedIds(current=>allVisibleSelected?current.filter(id=>!visibleCandidates.some(mail=>mail.id===id)):[...new Set([...current,...visibleCandidates.map(mail=>mail.id)])])}>{allVisibleSelected?'Quitar visibles':'Seleccionar visibles'}</button></div>
      {loading?<div className="users-loading">Cargando emails…</div>:visibleCandidates.length?<div className="case-mail-candidates">{visibleCandidates.map(mail=>{const checked=selectedIds.includes(mail.id);const recommended=suggested(mail);return <label key={mail.id} className={`case-mail-candidate${checked?' selected':''}${recommended?' recommended':''}`}><input type="checkbox" checked={checked} onChange={()=>toggle(mail.id)}/><span className="mail-source">{mailboxLabel(mail.mailbox)}</span><span><b>{mail.subject||'Sin asunto'}</b><small>{mail.sender_name||mail.sender_email} · {formatReceptionDate(mail.received_at)}</small><p>{String(mail.body||'').replace(/\s+/g,' ').slice(0,180)}</p></span>{recommended&&<em>Sugerido para este barco</em>}</label>})}</div>:<div className="case-mails-empty compact"><Mail/><span><b>No hay correos disponibles con este filtro</b><small>Actualiza las bandejas o prueba otra búsqueda.</small></span></div>}
    </div>
    <div className="case-linked-mail-head"><b>Ya vinculados a {caseRef}</b><small>{linked.length} correo(s)</small></div>
    {!loading&&linked.length?<div className="case-mail-list">{linked.map(mail=><details key={mail.id}><summary><span className="mail-source">{mailboxLabel(mail.mailbox)}</span><span><b>{mail.subject||'Sin asunto'}</b><small>{mail.sender_name||mail.sender_email} · {formatReceptionDate(mail.received_at)}</small></span><ChevronRight/></summary><pre>{mail.body}</pre><footer><button className="button tertiary" disabled={saving} onClick={()=>unlink(mail)}>Desvincular de {caseRef}</button></footer></details>)}</div>:!loading&&!error&&<div className="case-mails-empty"><Mail/><span><b>Todavía no hay correos vinculados</b><small>Selecciona uno o varios mensajes arriba y pulsa Vincular.</small></span></div>}
  </>;
}
function CaseServicesPanel({item,events,cases,transports,team,providers,warehouseEntries=[],saveEvent,updateTransport}){
  const [editing,setEditing]=useState(null);
  const [editingTransport,setEditingTransport]=useState(null);
  const allServices=(events||[]).filter(event=>event.expediente===item.id&&isTransportCalendarEvent(event)).sort((a,b)=>(String(a.fecha)+String(a.inicio)).localeCompare(String(b.fecha)+String(b.inicio)));
  const scheduled=allServices.filter(event=>!isCancelledTransport(event));
  const cancelled=allServices.filter(isCancelledTransport);
  const addService=type=>{
    const call=item.portCall||{};
    const date=call.etbDate||call.etaDate||(String(item.eta||'').match(/^20d{2}-d{2}-d{2}/)?.[0])||new Date().toISOString().slice(0,10);
    const start=call.etbTime||call.etaTime||'09:00';
    const origen=SWIFTPORT_WAREHOUSE;
    const destino='BUQUE '+(item.buque||'')+' · '+(item.puerto||'PUERTO');
    setEditing({id:'EV-'+Date.now(),titulo:origen+' → '+destino,origen,destino,tipoServicio:type,fecha:date,inicio:start,fin:plusHourClient(start),asignado:'Sin asignar',expediente:item.id,transporte:'',proveedorId:'',color:'gray'});
  };
  const openTransportCancellation=event=>{
    const transport=transports.find(entry=>entry.id===event.transporte);
    if(transport)setEditingTransport({...transport,estado:'Cancelado'});
  };
  return <><SectionHeader title="Transporte programado" subtitle={scheduled.length+' activo(s) · '+cancelled.length+' cancelado(s)'}/><div className="case-service-actions"><button className="button primary" onClick={()=>addService('Transporte')}><Truck/> Añadir transporte</button></div>{scheduled.length?<div className="case-service-list">{scheduled.map(event=><article key={event.id}><button className="case-service-main" onClick={()=>setEditing(event)}><span className="case-service-icon transport"><Truck/></span><span><b>{event.tipoServicio||'Transporte'} · {calendarNeedsTime(event)?'Falta horario':event.inicio+'–'+event.fin}</b><small>{event.fecha} · {event.titulo||item.puerto}</small></span><span><b>{event.asignado||'Sin asignar'}</b><small>TRANSPORTE Y CALENDARIO</small></span><PencilLine/></button><button className="case-service-cancel" onClick={()=>openTransportCancellation(event)} disabled={!event.transporte}><CircleAlert/> Cancelar servicio</button></article>)}</div>:<div className="case-services-empty"><CalendarDays/><span><b>Este expediente no tiene transportes activos</b><small>Añade uno nuevo o consulta debajo los servicios cancelados.</small></span></div>}{cancelled.length>0&&<div className="case-cancelled-services"><h3><CircleAlert/> Servicios cancelados</h3>{cancelled.map(event=>{const cancellation=event.cancellation||{};return <article key={event.id}><span className="case-service-icon cancelled"><Truck/></span><span><b>{event.titulo||'Transporte cancelado'}</b><small>{event.fecha} · {cancellation.reason||'Sin motivo indicado'}</small><em>{cancellation.cancelledBy?'Registrado por '+cancellation.cancelledBy:''}{cancellation.cancelledAt?' · '+formatReceptionDate(cancellation.cancelledAt):''}{cancellation.expenseAmount>0?' · '+moneyExact(cancellation.expenseAmount)+(cancellation.billableToClient?' facturable · enviado a Facturación':' gasto interno'):' · Sin gastos'}</em></span>{event.transporte&&<button className="button tertiary small" onClick={()=>setEditingTransport(transports.find(entry=>entry.id===event.transporte))}>Ver detalle</button>}</article>})}</div>}{editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} providers={providers} warehouseEntries={warehouseEntries} close={()=>setEditing(null)} submit={event=>{saveEvent(event);setEditing(null)}} openCase={()=>setEditing(null)}/>} {editingTransport&&<TransportEditModal item={editingTransport} team={team} providers={providers} close={()=>setEditingTransport(null)} submit={transport=>{if(updateTransport(transport)!==false)setEditingTransport(null)}}/>}</>;
}
function cargoPieceLabel(piece={},fallbackWeight=''){
  const qty=Number(piece.cantidad||piece.quantity||1)||1;
  const type=String(piece.tipo||piece.type||'BULTO').toUpperCase();
  const plural=qty===1?'':'S';
  const weight=piece.peso||piece.weight||fallbackWeight||'PESO PENDIENTE';
  const tracking=piece.seguimiento||piece.tracking||piece.awb||'';
  return `${qty} ${type}${plural} - ${weight}${tracking?` - Tracking ${tracking}`:''}`;
}
function warehouseGoods(entry={}){
  if(entry.mercancias?.length)return entry.mercancias;
  return [{tipo:'BULTO',cantidad:entry.bultos||entry.cantidad||1,peso:entry.peso||entry.pesoTotal||entry.kg||'',seguimiento:entry.tracking||entry.seguimiento||''}];
}
function evidenceFilesFromReception(record={}){
  return {photos:record.fotos||record.photos||[],docs:record.documentos||record.documentosRecepcion||record.docs||[]};
}
function CaseLoadPanel({item,warehouseEntries=[],events=[]}){
  if(!item)return null;
  const linkedWarehouse=warehouseEntriesForVessel(warehouseEntries,item);
  const scheduled=(events||[]).filter(event=>event.expediente===item.id&&isTransportCalendarEvent(event));
  const selectedCargo=scheduled.flatMap(event=>(event.selectedCargo||[]).map(piece=>({...piece,transport:event})));
  const casePieces=item.mercancias||[];
  const receptionRecords=item.recepciones||[];
  const receptionEvidence=receptionRecords.map(record=>({record,...evidenceFilesFromReception(record)})).filter(entry=>entry.photos.length||entry.docs.length);
  const hasData=linkedWarehouse.length||selectedCargo.length||casePieces.length||receptionEvidence.length;
  const uniquePhotos=(files=[])=>mergeAttachments([],files).filter(attachmentUrl);
  const uniqueDocs=(files=[])=>mergeAttachments([],files).filter(attachmentUrl);
  return <><SectionHeader title="Mercancia para cargar" subtitle="Vista directa para el conductor: bultos, peso, ubicacion, fotos y documentos."/>{!hasData&&<div className="case-load-empty"><Box/><span><b>No hay mercancia vinculada todavia</b><small>Cuando se registre en almacen o se seleccione en un transporte, aparecera aqui para el conductor.</small></span></div>}{selectedCargo.length>0&&<div className="case-load-selected"><PackageCheck/><span><small>CARGA SELECCIONADA EN TRANSPORTES</small>{selectedCargo.map(piece=><b key={`${piece.transport?.id||'TR'}-${piece.id||piece.ref}`}>{piece.summary}<em>{piece.transport?.fecha||''} {piece.transport?.inicio||''} - {piece.entryRef||'Almacen'} - {piece.detail||'Sin seguimiento'}</em></b>)}</span></div>}{linkedWarehouse.length>0&&<div className="case-load-grid">{linkedWarehouse.map((entry,index)=>{const photos=uniquePhotos(entry.fotos||[]);const docs=uniqueDocs(entry.documentosRecepcion||entry.documentos||[]);const goods=warehouseGoods(entry);return <article className="load-cargo-card" key={entry.ref||entry.id||index}><header><span><small>{entry.ref||entry.id||`ALM-${index+1}`}</small><b>{entry.buque||item.buque||'BUQUE SIN INDICAR'}</b></span><em>{entry.zona||entry.ubicacion||'Ubicacion pendiente'}</em></header><div className="load-cargo-meta"><span>Entrada: <b>{formatReceptionDate(entry.entrada||entry.fechaRecepcion)}</b></span><span>Estado: <b>{entry.estado||'En stock'}</b></span></div><div className="load-pieces">{goods.map((piece,pieceIndex)=><p key={piece.id||pieceIndex}><PackageCheck/><span>{cargoPieceLabel(piece,entry.peso||entry.pesoTotal)}</span></p>)}</div>{photos.length>0&&<div className="load-evidence-block"><h4><Camera/> Fotos de la mercancia</h4><div className="load-photo-grid">{photos.map((file,fileIndex)=><a href={attachmentUrl(file)} target="_blank" rel="noreferrer" key={attachmentKey(file)||fileIndex}><img src={attachmentUrl(file)} alt={attachmentName(file,`Foto ${fileIndex+1}`)}/><span>Foto {fileIndex+1}</span></a>)}</div></div>}{docs.length>0&&<div className="load-evidence-block"><h4><FileText/> Documentos de llegada</h4><div className="load-doc-list">{docs.map((file,fileIndex)=><a href={attachmentUrl(file)} target="_blank" rel="noreferrer" key={attachmentKey(file)||fileIndex}><FileText/><span>{attachmentName(file,`Documento ${fileIndex+1}`)}</span><ExternalLink/></a>)}</div></div>}</article>})}</div>}{!linkedWarehouse.length&&casePieces.length>0&&<div className="case-load-grid"><article className="load-cargo-card"><header><span><small>EXPEDIENTE</small><b>{item.buque}</b></span><em>{item.puerto}</em></header><div className="load-pieces">{casePieces.map((piece,index)=><p key={piece.id||index}><PackageCheck/><span>{cargoPieceLabel(piece)}</span></p>)}</div></article></div>}{receptionEvidence.length>0&&<div className="case-load-grid reception-only">{receptionEvidence.map(({record,photos,docs},index)=><article className="load-cargo-card" key={record.ref||index}><header><span><small>{record.ref||`RECEPCION ${index+1}`}</small><b>Evidencias de recepcion</b></span><em>{record.zona||record.ubicacion||'Expediente'}</em></header>{photos.length>0&&<div className="load-evidence-block"><h4><Camera/> Fotos</h4><div className="load-photo-grid">{photos.map((file,fileIndex)=><a href={attachmentUrl(file)} target="_blank" rel="noreferrer" key={attachmentKey(file)||fileIndex}><img src={attachmentUrl(file)} alt={attachmentName(file,`Foto ${fileIndex+1}`)}/><span>Foto {fileIndex+1}</span></a>)}</div></div>}{docs.length>0&&<div className="load-evidence-block"><h4><FileText/> Documentos</h4><div className="load-doc-list">{docs.map((file,fileIndex)=><a href={attachmentUrl(file)} target="_blank" rel="noreferrer" key={attachmentKey(file)||fileIndex}><FileText/><span>{attachmentName(file,`Documento ${fileIndex+1}`)}</span><ExternalLink/></a>)}</div></div>}</article>)}</div>}</>;
}
function Stat({label,value,icon:Icon}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}
function ActualTimeline({item}){
  const events=item.timelineCustom||[];
  if(!events.length)return <div className="timeline-empty"><Clock3/><b>Sin actividad registrada</b><small>La cronología aparecerá cuando el equipo confirme el primer paso.</small></div>;
  return <div className="timeline actual-timeline">{events.map((event,index)=><div className="timeline-event done" key={event.id||event.titulo+index}><span className="timeline-marker"><CheckCircle2/></span><time>{event.hora||'—'}<small>{event.fecha||''}</small></time><span><b>{event.titulo}</b><small>{event.detalle}</small>{event.actor&&<em>Registrado por {event.actor}</em>}{event.archivo&&<a href={event.archivo.url} target="_blank" rel="noreferrer"><FileText/> POD principal: {event.archivo.name}</a>}{(event.archivos||[]).map((file,fileIndex)=>{const document=['pod','shipment-document'].includes(file.evidenceType)||String(file.name||'').toLowerCase().endsWith('.pdf');return <a href={file.url} target="_blank" rel="noreferrer" key={file.id||fileIndex}>{document?<FileText/>:<Camera/>} {file.evidenceType==='pod'?'POD adicional':document?'Documento':`Foto ${fileIndex+1}`}: {file.name}</a>})}</span></div>)}</div>;
}
function CaseStepReopenPanel({item,reopen}){
  const flow=operationFlow(item);
  const completed=operationStepsFor(item).filter(step=>flow[step.key]);
  if(!completed.length)return null;
  return <section className="case-reopen-panel"><div><Undo2/><span><b>Corregir pasos completados</b><small>Reabre un paso para añadir o modificar documentos, fotos, mercancía o POD sin borrar lo ya subido.</small></span></div><div>{completed.map(step=><button type="button" key={step.key} onClick={()=>reopen(step.key)}><Undo2/><span>Reabrir {step.title}</span></button>)}</div></section>;
}
function ClientCostPanel({item,warehouseEntries,updateCase,notify}){
  const [draft,setDraft]=useState(()=>enforceLimaniFreeStorageEstimate(item.clientCostEstimate||defaultClientCostEstimate(item,warehouseEntries),item));
  useEffect(()=>{setDraft(enforceLimaniFreeStorageEstimate(item.clientCostEstimate||defaultClientCostEstimate(item,warehouseEntries),item))},[item.id,item.clientCostEstimate,warehouseEntries.length]);
  const draftCargo=invoiceLinesCargoSummary(draft.lines||[]);
  const cargo=invoiceCargoSummary(item,warehouseEntries)||draftCargo;
  const warehouseWeight=invoiceCargoWeight(item,warehouseEntries);
  const draftWeight=invoiceLinesWeight(draft.lines||[]);
  const weight=warehouseWeight||draftWeight;
  const hasRealWeight=weight>0;
  const storageDays=invoiceStorageDays(item,warehouseEntries);
  const total=clientCostTotal(draft);
  const updateLine=(index,key,value)=>setDraft(current=>enforceLimaniFreeStorageEstimate({...current,lines:current.lines.map((line,lineIndex)=>lineIndex===index?{...line,[key]:value}:line)},item));
  const addLine=()=>setDraft(current=>({...current,lines:[...(current.lines||[]),{id:'manual-'+Date.now(),item:'TRANSPORT',detail:cargo,price:0,units:1}]}));
  const removeLine=index=>setDraft(current=>({...current,lines:current.lines.filter((_,lineIndex)=>lineIndex!==index)}));
  const recalc=()=>setDraft(enforceLimaniFreeStorageEstimate(defaultClientCostEstimate(item,warehouseEntries),item));
  const save=()=>{updateCase({...item,clientCostEstimate:{...draft,updatedAt:new Date().toISOString()}});notify?.('Previsión de costes guardada en el expediente')};
  const copy=async()=>{
    const text=[
      `*${String(item.buque||item.id).toUpperCase()}*`,
      `${item.id} · ${String(item.puerto||'PUERTO PENDIENTE').toUpperCase()}`,
      '',
      ...(draft.lines||[]).map(line=>`• ${String(line.item||'CONCEPTO').toUpperCase()} - ${line.detail||cargo}: ${moneyExact(clientCostLineTotal(line))}`),
      '',
      `*TOTAL: ${moneyExact(total)}*`
    ].join('\n');
    try{await navigator.clipboard.writeText(text);notify?.('Costes copiados para enviar al cliente')}
    catch{notify?.('No se pudo copiar automáticamente. Selecciona el texto manualmente.')}
  };
  return <><SectionHeader title="Costes para cliente" subtitle={isAlsCase(item)?'Tarifa ALS Barcelona 2026: UNLOAD, STORAGE y LOAD separados':'Previsión editable para adelantos o costes a informar'} action={<div className="client-cost-actions"><button className="button tertiary" onClick={recalc}><RefreshCw/> Recalcular</button><button className="button secondary" onClick={copy}><ClipboardList/> Copiar para cliente</button></div>}/><div className="client-cost-summary"><article><small>Cliente</small><b>{item.cliente}</b></article><article><small>Mercancía</small><b>{cargo}</b></article><article className={`client-cost-weight ${hasRealWeight?'':'client-cost-missing'}`}><small>KG totales</small><b>{hasRealWeight?`${weight.toLocaleString('es-ES',{maximumFractionDigits:2})} kg`:'Peso pendiente'}</b></article><article><small>Storage real</small><b>{storageDays} días</b></article></div><div className="client-cost-note">{isAlsCase(item)?<><b>Regla ALS:</b> LOAD y UNLOAD se cobran por separado a 0,12 €/kg. Storage tiene 3 días gratis y luego se cobra por día según peso. {!hasRealWeight&&' Añade el peso en almacén o en el detalle para calcular por kg.'}</>:<><b>{isUmeAlgecirasCase(item)?'Tarifa UME Algeciras:':'Sin tarifa automática:'}</b> {isUmeAlgecirasCase(item)?'Los conceptos se calculan por peso, storage y servicios registrados.':'Puedes añadir los conceptos manualmente y guardar la previsión.'} {!hasRealWeight&&' Falta peso real para calcular líneas por kg.'}</>}</div><div className="client-cost-lines"><div className="client-cost-lines-head"><b>Conceptos</b><button type="button" className="button secondary compact" onClick={addLine}><Plus/> Añadir concepto</button></div>{(draft.lines||[]).map((line,index)=><article key={line.id||index}><label className="field"><span>Concepto</span><input value={line.item||''} onChange={event=>updateLine(index,'item',event.target.value)}/></label><label className="field line-detail"><span>Detalle</span><input value={line.detail||''} onChange={event=>updateLine(index,'detail',event.target.value)} placeholder={cargo}/></label><label className="field"><span>Precio</span><input type="number" min="0" step="0.01" value={line.price} onChange={event=>updateLine(index,'price',event.target.value)} readOnly={isLimaniCase(item)&&isStorageInvoiceLine(line)}/></label><label className="field"><span>Uds.</span><input type="number" min="0" step="0.01" value={line.units} onChange={event=>updateLine(index,'units',event.target.value)}/></label><strong>{moneyExact(clientCostLineTotal(line))}</strong>{(draft.lines||[]).length>1&&<button type="button" className="icon-button danger" onClick={()=>removeLine(index)} aria-label="Eliminar concepto"><Trash2/></button>}</article>)}</div><div className="client-cost-footer"><span><small>Total previsto para informar</small><b>{moneyExact(total)}</b></span><button className="button primary" onClick={save}><Save/> Guardar costes</button></div></>;
}
function CaseExpensesPanel({item,updateCase,notify}){
  const today=new Date().toISOString().slice(0,10);
  const [draft,setDraft]=useState({fecha:today,proveedor:'',concepto:'',importe:'',nota:''});
  const expenses=[...caseExpenses(item)].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));
  const total=caseExpenseTotal(item);
  const estimatedRevenue=Number(item.importe)||0;
  const saveExpenses=gastos=>updateCase({...item,gastos,updatedAt:new Date().toISOString()});
  const addExpense=()=>{
    const amount=expenseAmount(draft.importe);
    if(!draft.concepto.trim()||amount===0){notify?.('Indica concepto e importe del gasto. Puedes usar importes negativos para comisiones o ajustes.');return}
    const expense={id:`GASTO-${Date.now()}`,fecha:draft.fecha||today,proveedor:draft.proveedor.trim(),concepto:draft.concepto.trim(),importe:amount,nota:draft.nota.trim()};
    saveExpenses([expense,...caseExpenses(item)]);
    setDraft({fecha:today,proveedor:'',concepto:'',importe:'',nota:''});
    notify?.('Gasto añadido al expediente.');
  };
  const updateExpense=(id,change)=>{
    const next=caseExpenses(item).map(expense=>expense.id===id?{...expense,...change,importe:change.importe!==undefined?expenseAmount(change.importe):expense.importe}:expense);
    saveExpenses(next);
  };
  const deleteExpense=id=>{
    if(!window.confirm('¿Eliminar este gasto del expediente?'))return;
    saveExpenses(caseExpenses(item).filter(expense=>expense.id!==id));
    notify?.('Gasto eliminado del expediente.');
  };
  return <><SectionHeader title="Gastos relacionados" subtitle="Costes internos para calcular el margen de la operativa"/><div className="case-expense-summary"><article><small>Coste total</small><b>{moneyExact(total)}</b></article><article><small>Venta prevista</small><b>{estimatedRevenue?moneyExact(estimatedRevenue):'Pendiente'}</b></article><article><small>Margen estimado</small><b className={estimatedRevenue-total<0?'negative':''}>{estimatedRevenue?moneyExact(estimatedRevenue-total):'Pendiente'}</b></article></div><div className="case-expense-form"><label className="field"><span>Fecha</span><input type="date" value={draft.fecha} onChange={event=>setDraft({...draft,fecha:event.target.value})}/></label><label className="field"><span>Proveedor</span><input value={draft.proveedor} onChange={event=>setDraft({...draft,proveedor:event.target.value})} placeholder="Ej. Grúa, taxi, autopista"/></label><label className="field"><span>Concepto</span><input value={draft.concepto} onChange={event=>setDraft({...draft,concepto:event.target.value})} placeholder="Peaje, espera, proveedor, combustible…" required/></label><label className="field"><span>Importe</span><input type="number" step="0.01" value={draft.importe} onChange={event=>setDraft({...draft,importe:event.target.value})} placeholder="0,00"/></label><label className="field wide"><span>Nota interna</span><input value={draft.nota} onChange={event=>setDraft({...draft,nota:event.target.value})} placeholder="Referencia, motivo o detalle para facturación"/></label><button type="button" className="button primary" onClick={addExpense}><Plus/> Añadir gasto</button></div>{expenses.length?<div className="case-expense-list">{expenses.map(expense=><article key={expense.id}><input type="date" value={expense.fecha||''} onChange={event=>updateExpense(expense.id,{fecha:event.target.value})}/><input value={expense.proveedor||''} onChange={event=>updateExpense(expense.id,{proveedor:event.target.value})} placeholder="Proveedor"/><input value={expense.concepto||''} onChange={event=>updateExpense(expense.id,{concepto:event.target.value})} placeholder="Concepto"/><input type="number" step="0.01" value={expense.importe??0} onChange={event=>updateExpense(expense.id,{importe:event.target.value})}/><input value={expense.nota||''} onChange={event=>updateExpense(expense.id,{nota:event.target.value})} placeholder="Nota"/><strong>{moneyExact(expense.importe)}</strong><button type="button" className="icon-button danger" onClick={()=>deleteExpense(expense.id)} aria-label="Eliminar gasto"><Trash2/></button></article>)}</div>:<div className="case-expenses-empty"><BadgeEuro/><span><b>Sin gastos registrados</b><small>Añade aquí costes reales del expediente para ver el margen en Facturación.</small></span></div>}</>;
}
function OperationChecklist({item,csrfToken,reloadOperational,notify,currentRoles,onStepSelect}){
  const flow=operationFlow(item);
  const current=nextOperationStep(item);
  const steps=operationStepsFor(item);
  const renderStep=(step,index)=>{
    const stepProps=onStepSelect?{role:'button',tabIndex:0,onClick:()=>onStepSelect(step.key),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onStepSelect(step.key)}}}:{};
    return <li key={step.key} {...stepProps} className={`${flow[step.key]?'done':current?.key===step.key?'current':''} ${onStepSelect?'clickable':''}`}><span>{flow[step.key]?<CheckCircle2/>:index+1}</span><span><b>{step.title}</b><small>{step.responsibility}</small></span></li>;
  };
  return <><AisTrackingPanel item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify}/><section className="operation-checklist"><div><b>FLUJO OPERATIVO</b><small>{serviceTypeMeta(item).label}  -  pasos libres para todo el equipo</small></div><ol>{steps.map(renderStep)}<li className={flow.billingReady?'done':''}><span>{flow.billingReady?<CheckCircle2/>:steps.length+1}</span><span><b>Listo para facturar</b><small>LIBRE PARA TODOS</small></span></li></ol></section></>;
}
function OperationStepModal({item,warehouseEntries,transports,csrfToken,currentUser,onEvidenceUploaded,close,submit,initialStepKey=null}){
  const steps=operationStepsFor(item);
  const step=initialStepKey?steps.find(entry=>entry.key===initialStepKey):nextOperationStep(item);
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [warehouseReviewed,setWarehouseReviewed]=useState(false);
  const [selectedWarehouseRefs,setSelectedWarehouseRefs]=useState(()=>warehouseEntriesForVessel(warehouseEntries,item).map(entry=>entry.ref));
  const [podException,setPodException]=useState(false);
  if(!step)return null;
  const storageOnly=isStorageOnly(item);
  const surveyService=isSurveyService(item);
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const transport=transports.find(entry=>entry.expediente===item.id);
  const guidance={
    review:'Comprueba buque, ETA, puerto, ruta, mercancía solicitada y observaciones del correo antes de iniciar el servicio.',
    cargo:surveyService?'Confirma que el responsable está en ruta o a bordo y registra evidencia inicial del servicio.':inWarehouse?'Confirma que la mercancía recibida coincide con fotos, cantidades y peso.':'Confirma la recogida en el punto indicado y comprueba cantidades y estado.',
    documents:surveyService?'Adjunta orden de servicio, instrucciones de muestreo, formularios o cualquier documento recibido del cliente.':'Comprueba packing list, CMR, delivery note y documento aduanero. Puedes adjuntar aquí los archivos recibidos por correo.',
    assignment:'Selecciona el conductor en el transporte o calendario. Este paso se completará automáticamente.',
    delivery:surveyService?'Confirma que el Ballast Water Samples / survey quedó realizado. Adjunta fotos, observaciones o informe; no requiere POD.':storageOnly?'Confirma la salida de almacén o recogida por tercero con foto/evidencia clara. No hace falta POD.':'Revisa todo el almacén de este buque, adjunta fotografías de la mercancía entregada y el POD firmado.'
  };
  const uploadEvidence=async(files,evidenceType)=>{
    const selected=[...files].filter(Boolean);
    if(!selected.length)return;
    setUploading(true);setError('');
    try{
      const uploaded=[];
      for(const file of selected){
        const prepared=evidenceType==='pod'&&file.type.startsWith('image/')?await scannedPodPdf(file,item.id):file;
        const stored=await uploadAttachment(prepared,prepared.type==='application/pdf'?'document':'photo',csrfToken);
        uploaded.push({...stored,evidenceType});
      }
      setEvidenceFiles(current=>[...current,...uploaded]);
      await onEvidenceUploaded?.(item.id,uploaded,evidenceType);
    }catch(reason){setError(reason.message)}finally{setUploading(false)}
  };
  const cargoPhotos=evidenceFiles.filter(file=>file.evidenceType==='cargo-photo');
  const shipmentFiles=evidenceFiles.filter(file=>file.evidenceType==='shipment-document');
  const deliveryPhotos=evidenceFiles.filter(file=>file.evidenceType==='delivery-photo');
  const podFiles=evidenceFiles.filter(file=>file.evidenceType==='pod');
  const vesselWarehouseEntries=warehouseEntriesForVessel(warehouseEntries,item);
  const selectedWarehouseEntries=vesselWarehouseEntries.filter(entry=>selectedWarehouseRefs.includes(entry.ref));
  const needsEvidence=['cargo','delivery'].includes(step.key);
  const noteRequiredForPodException=step.key==='delivery'&&!storageOnly&&!surveyService&&podException;
  const podExceptionExplained=podException&&note.trim().length>0;
  const deliveryEvidenceCount=deliveryPhotos.length+(podException?podFiles.length:0);
  const warehouseReviewMissing=step.key==='delivery'&&!surveyService&&!warehouseReviewed;
  const evidenceReady=step.key==='cargo'?cargoPhotos.length>0||selectedWarehouseEntries.length>0||surveyService:step.key==='delivery'?(surveyService?(deliveryPhotos.length>0||podFiles.length>0):warehouseReviewed&&deliveryEvidenceCount>0&&(storageOnly||(podException?podExceptionExplained:podFiles.length>0))):true;
  const deliveryMissingReason=warehouseReviewMissing?'Marca que revisaste el almacén':storageOnly?'Añade evidencia de salida':deliveryEvidenceCount===0?'Añade una foto de entrega':podException&&!podExceptionExplained?'Escribe la observación del POD no sellado':'Añade el POD firmado';
  const toggleWarehouseEntry=ref=>setSelectedWarehouseRefs(current=>current.includes(ref)?current.filter(item=>item!==ref):[...current,ref]);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
    <section className="modal operation-modal">
      <div className="modal-head"><div><span className="overline">Paso operativo</span><h2>{step.title}</h2><p>{item.id}  -  {item.buque}</p></div><button className="icon-button" onClick={close}><X/></button></div>
      <div className="operation-modal-body">
        <OperationChecklist item={item} currentRoles={currentUser}/>
        <div className="operation-guidance"><ClipboardCheck/><div><b>Qué debes comprobar</b><p>{guidance[step.key]}</p>{step.key==='delivery'&&transport&&<small>{transport.id}  -  {transport.ruta}</small>}</div></div>
        {step.key==='cargo'&&!surveyService&&<WarehouseCargoReception entries={vesselWarehouseEntries} selectedRefs={selectedWarehouseRefs} toggle={toggleWarehouseEntry}/>}
        {['documents','assignment','delivery'].includes(step.key)&&<ShipmentDocuments item={item}/>}
        {step.key==='delivery'&&!surveyService&&<WarehouseTransportReview entries={vesselWarehouseEntries} item={item} checked={warehouseReviewed} setChecked={setWarehouseReviewed}/>}
        {step.key==='documents'&&<div className="pod-scanner shipment-document-upload">
          <div><FileCheck2/><span><b>Adjuntar documentación del envío</b><small>Packing list, delivery note, CMR, T1, levante u otros documentos.</small></span></div>
          <div className="pod-scanner-actions"><MultiPhotoButton className="button primary" disabled={uploading} title="Fotos de documentos del envío" onFiles={files=>uploadEvidence(files,'shipment-document')}><Camera/> Fotografiar varios documentos</MultiPhotoButton><label className="button secondary"><UploadCloud/> {uploading?'Subiendo…':'Añadir varios PDFs'}<input type="file" accept="application/pdf" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'shipment-document');event.target.value=''}}/></label></div>
          {shipmentFiles.length>0&&<div className="evidence-file-list">{shipmentFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
        </div>}
        {needsEvidence&&<div className="pod-scanner evidence-capture">
          <div><Camera/><span><b>{step.key==='cargo'?(surveyService?'Evidencia inicial del survey':'Fotos de la mercancía recibida'):surveyService?'Evidencia del survey realizado':storageOnly?'Evidencias de salida / recogida':'Evidencias de la entrega'}</b><small>{step.key==='cargo'?(surveyService?'Opcional: foto de acceso, equipo o nota inicial.':'Puedes tomar varias fotografías.'):surveyService?'Foto, informe o documento del servicio realizado.':storageOnly?'Se exige al menos una foto o evidencia de salida.':podException?'Se exige una foto de entrega y una observación; no hace falta POD.':'Se exige al menos una foto de entrega y un POD.'}</small></span></div>
          <div className="pod-scanner-actions">
            <MultiPhotoButton className="button primary" disabled={uploading} title={step.key==='cargo'?'Fotos de recepción':'Fotos de entrega'} onFiles={files=>uploadEvidence(files,step.key==='cargo'?'cargo-photo':'delivery-photo')}><Camera/> {uploading?'Procesando…':step.key==='cargo'?'Tomar varias fotos de recepción':'Tomar varias fotos de entrega'}</MultiPhotoButton>
            {step.key==='delivery'&&!storageOnly&&!surveyService&&!podException&&<><MultiPhotoButton className="button secondary" disabled={uploading} title="Fotos del POD" onFiles={files=>uploadEvidence(files,'pod')}><ScanLine/> Fotografiar varias páginas del POD</MultiPhotoButton><label className="button tertiary"><FileText/> Añadir PDFs de POD<input type="file" accept="application/pdf" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'pod');event.target.value=''}}/></label></>}
            {step.key==='delivery'&&surveyService&&<label className="button tertiary"><FileText/> Añadir informe / PDF<input type="file" accept="application/pdf" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'pod');event.target.value=''}}/></label>}
          </div>
          {step.key==='delivery'&&!storageOnly&&!surveyService&&<label className={'document-switch pod-exception '+(podException?'checked':'')}><input type="checkbox" checked={podException} onChange={event=>setPodException(event.target.checked)}/><CircleAlert/><span><b>POD no sellado / no disponible</b><small>Permite cerrar la entrega dejando una observación obligatoria para facturación.</small></span></label>}
          {step.key==='delivery'&&<div className="evidence-requirements"><span className={deliveryEvidenceCount?'done':''}><CheckCircle2/> {surveyService?'Foto / evidencia':storageOnly?'Evidencia de salida':'Evidencia de entrega'} {deliveryEvidenceCount?`(${deliveryEvidenceCount})`:'pendiente'}</span>{!storageOnly&&!surveyService&&<span className={(podException?podExceptionExplained:podFiles.length>0)?'done':''}><CheckCircle2/> {podException?'POD no disponible':'POD firmado'} {podException?(podExceptionExplained?'justificado con observación':'falta la observación'):podFiles.length?`(${podFiles.length})`:'pendiente'}</span>}{surveyService&&<span className={podFiles.length?'done':''}><CheckCircle2/> Informe / documento {podFiles.length?`(${podFiles.length})`:'opcional'}</span>}</div>}
          {evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{file.evidenceType==='pod'?(surveyService?'Informe / documento':podException?'Evidencia de entrega':'POD escaneado'):file.evidenceType==='delivery-photo'?(surveyService?'Evidencia survey':'Foto de entrega'):'Foto de recepción'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
          {error&&<p className="form-error"><CircleAlert/>{error}</p>}
        </div>}
        <label className="field"><span>{noteRequiredForPodException?'Observación obligatoria':'Observación (opcional)'}</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder={noteRequiredForPodException?'Ej. El buque/consignatario no selló el POD, entrega realizada sin sello…':'Incidencias, persona que recibe, referencia…'}/></label>
        <div className="modal-actions"><button className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={uploading||!evidenceReady} onClick={()=>submit(step.key,note,step.key==='cargo'?{files:evidenceFiles,warehouseRefs:surveyService?[]:selectedWarehouseRefs}:{files:evidenceFiles,podException,podExceptionReason:note})}><CheckCircle2/> {!evidenceReady?(step.key==='cargo'?'Añade una foto o selecciona almacén':surveyService?'Añade evidencia o informe del survey':deliveryMissingReason):'Confirmar paso'}</button></div>
      </div>
    </section>
  </div>;
}
function OperationStepModalLegacy({item,warehouseEntries,transports,csrfToken,close,submit}){
  const step=nextOperationStep(item);
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  if(!step)return null;
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const transport=transports.find(entry=>entry.expediente===item.id);
  const guidance={
    review:'Comprueba buque, ETA, puerto, ruta, mercancía solicitada y observaciones del correo antes de iniciar el servicio.',
    cargo:inWarehouse?'Confirma que la mercancía recibida coincide con fotos, cantidades y peso.':'Confirma la recogida en el punto indicado y comprueba cantidades y estado.',
    documents:'Comprueba packing list, CMR, delivery note y documento aduanero cuando corresponda.',
    delivery:'Entrega toda la mercancía y adjunta el POD firmado. La salida quedará archivada y el expediente pasará a Facturación.'
  };
  const uploadEvidence=async file=>{if(!file)return;setUploading(true);setError('');try{const prepared=step.key==='delivery'&&file.type.startsWith('image/')?await scannedPodPdf(file,item.id):file;const uploaded=await uploadAttachment(prepared,prepared.type==='application/pdf'?'document':'photo',csrfToken);setEvidenceFiles(current=>step.key==='cargo'?[...current,uploaded]:[uploaded])}catch(reason){setError(reason.message)}finally{setUploading(false)}};
  const needsEvidence=['cargo','delivery'].includes(step.key);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal operation-modal"><div className="modal-head"><div><span className="overline">Paso operativo</span><h2>{step.title}</h2><p>{item.id}  -  {item.buque}</p></div><button className="icon-button" onClick={close}><X/></button></div><div className="operation-modal-body"><OperationChecklist item={item}/><div className="operation-guidance"><ClipboardCheck/><div><b>Qué debes comprobar</b><p>{guidance[step.key]}</p>{step.key==='delivery'&&transport&&<small>{transport.id}  -  {transport.ruta}</small>}</div></div>{needsEvidence&&<div className="pod-scanner"><div><Camera/><span><b>{step.key==='cargo'?'Fotografiar mercancía recibida':'Scanner automático de POD'}</b><small>{step.key==='cargo'?'La foto es obligatoria y quedará en el expediente.':'Haz una foto del POD; Swiftport lo recorta, limpia y guarda como PDF.'}</small></span></div><div className="pod-scanner-actions"><label className="button primary"><Camera/> {uploading?'Escaneando…':step.key==='cargo'?'Hacer foto':'Escanear con cámara'}<input type="file" accept="image/*" disabled={uploading} onChange={event=>uploadEvidence(event.target.files?.[0])}/></label>{step.key==='delivery'&&<label className="button tertiary"><FileText/> Adjuntar PDF<input type="file" accept="application/pdf" disabled={uploading} onChange={event=>uploadEvidence(event.target.files?.[0])}/></label>}</div>{evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={file.id}><CheckCircle2/><span><b>{step.key==='cargo'?`Foto ${index+1}`:'POD escaneado en PDF'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}{error&&<p className="form-error"><CircleAlert/>{error}</p>}</div>}<label className="field"><span>Observación (opcional)</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Incidencias, persona que recibe, referencia…"/></label><div className="modal-actions"><button className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={uploading||(needsEvidence&&!evidenceFiles.length)} onClick={()=>submit(step.key,note,step.key==='cargo'?evidenceFiles:evidenceFiles[0]||null)}><CheckCircle2/> {needsEvidence&&!evidenceFiles.length?(step.key==='cargo'?'Haz una foto':'Escanea el POD'):'Confirmar paso'}</button></div></div></section></div>;
}
function MerchandisePanel({item,updateCase,deleteAttachment}){
  const merchandise=item.mercancias||[];
  const updatePiece=(id,change)=>updateCase({...item,mercancias:merchandise.map(piece=>piece.id===id?{...piece,...change}:piece)});
  const toggleDocument=(piece,document)=>{const documents=piece.documentos||[];updatePiece(piece.id,{documentos:documents.includes(document)?documents.filter(value=>value!==document):[...documents,document]})};
  const documentation=item.documentacionMercancia||{alcance:'individual',tipoAduanero:'',aduaneroDisponible:false,podDisponible:false};
  const updateDocumentation=change=>updateCase({...item,documentacionMercancia:{...documentation,...change}});
  const total=merchandise.reduce((sum,piece)=>sum+Number(piece.cantidad||0),0);
  const podLabel=documentation.podDisponible?(documentation.podNoSellado?'NO SELLADO':'DISPONIBLE'):'PENDIENTE';
  return <><SectionHeader title="Mercancía y documentación" subtitle={`${total} unidades  -  POD ${podLabel}`}/><div className="global-documents"><label className="field"><span>Documento aduanero</span><select value={documentation.alcance} onChange={event=>updateDocumentation({alcance:event.target.value})}><option value="individual">INDIVIDUAL POR MERCANCÍA</option><option value="global">UNO PARA TODO EL EXPEDIENTE</option></select></label>{documentation.alcance==='global'&&<><label className="field"><span>Tipo</span><select value={documentation.tipoAduanero} onChange={event=>updateDocumentation({tipoAduanero:event.target.value})}><option value="">SIN ASIGNAR</option><option>T1</option><option>LEVANTE ADUANERO</option></select></label><label className={'document-switch '+(documentation.aduaneroDisponible?'checked':'')}><input type="checkbox" checked={documentation.aduaneroDisponible} onChange={event=>updateDocumentation({aduaneroDisponible:event.target.checked})}/><FileCheck2/><span><b>DOCUMENTO ADUANERO</b><small>{documentation.aduaneroDisponible?'DISPONIBLE':'PENDIENTE'}</small></span></label></>}<label className={'document-switch pod locked '+(documentation.podDisponible?'checked':'')}><input type="checkbox" checked={documentation.podDisponible} disabled readOnly/><ClipboardCheck/><span><b>POD CONJUNTO</b><small>{documentation.podDisponible?(documentation.podNoSellado?'ENTREGA CERRADA CON OBSERVACIÓN':'RECIBIDO  -  LISTO PARA FACTURAR'):'SE REGISTRA EN EL FLUJO OPERATIVO'}</small></span></label></div><div className="merchandise-list">{merchandise.map((piece,index)=><details className="merchandise-item" key={piece.id}><summary><span className="box-icon"><Box/></span><span><b>{piece.buque||item.buque||'BUQUE SIN INDICAR'}</b><small>{piece.cantidad} {piece.tipo}{piece.cantidad===1?'':'S'}  -  {piece.peso||'PESO PENDIENTE'}{piece.sourceEntry?`  -  ${piece.sourceEntry}`:''}{piece.seguimiento?`  -  TRACKING: ${piece.seguimiento}`:''}</small></span><span className="document-count">{documentation.alcance==='global'?'DOC GLOBAL':`${(piece.documentos||[]).length}/2 DOCS`}</span><ChevronRight/></summary><div className="merchandise-editor"><label className="field"><span>Tipo</span><select value={piece.tipo} onChange={event=>updatePiece(piece.id,{tipo:event.target.value})}><option>CAJA</option><option>PALLET</option><option>SOBRE</option><option>PAQUETE</option><option>BULTO</option></select></label><label className="field"><span>Cantidad</span><input type="number" min="1" value={piece.cantidad} onChange={event=>updatePiece(piece.id,{cantidad:Number(event.target.value)||1})}/></label><label className="field"><span>Peso del grupo (kg)</span><input type="number" min="0.1" step="0.1" value={String(piece.peso||'').replace(/[^\d,.]/g,'').replace(',','.')} onChange={event=>updatePiece(piece.id,{peso:event.target.value?`${event.target.value} KG`:''})}/></label><label className="field"><span>N.º seguimiento (opcional)</span><input value={piece.seguimiento||''} onChange={event=>updatePiece(piece.id,{seguimiento:event.target.value.toUpperCase()})}/></label>{documentation.alcance==='individual'&&<div className="piece-documents"><span>Documento aduanero individual</span>{DOC_TYPES.map(document=><label key={document} className={(piece.documentos||[]).includes(document)?'checked':''}><input type="checkbox" checked={(piece.documentos||[]).includes(document)} onChange={()=>toggleDocument(piece,document)}/><FileCheck2/><b>{document}</b><small>{(piece.documentos||[]).includes(document)?'DISPONIBLE':'PENDIENTE'}</small></label>)}</div>}</div></details>)}</div><ReceptionRecords records={item.recepciones||[]} item={item} deleteAttachment={deleteAttachment}/></>;
}
function ReceptionRecords({records,item,deleteAttachment}){
  if(!records.length)return <div className="reception-empty"><Camera/><span><b>Sin recepciones documentadas</b><small>Las fotos y documentos aparecerán aquí al registrar la entrada.</small></span></div>;
  return <section className="reception-records"><div className="reception-title"><Camera/><div><h3>Recepciones de mercancía</h3><p>Evidencias fotográficas identificadas y documentos de llegada.</p></div></div>{records.map(record=><article className="reception-record" key={record.ref}><header><div><b>{formatReceptionDate(record.fecha)}</b><small>{record.ref}  -  ZONA {record.zona}</small></div><Badge>{(record.fotos||[]).length} FOTOS  -  {(record.documentos||[]).length} DOCS</Badge></header>{Boolean((record.fotos||[]).length)&&<div className="reception-photos">{record.fotos.map((file,index)=><figure key={file.id||file.url||index}><div className="reception-photo-frame"><a href={file.url} target="_blank" rel="noreferrer" title={file.name}><img src={file.url} alt={`${file.tipo||'Vista general'}  -  ${file.mercancia||'Recepción completa'}`}/><span>FOTO {String(index+1).padStart(2,'0')}</span></a>{deleteAttachment&&<button type="button" className="icon-button danger attachment-delete floating" aria-label="Eliminar foto" onClick={()=>deleteAttachment(item.id,'reception-photo',file,record.ref)}><Trash2/></button>}</div><figcaption><b>{file.tipo||'VISTA GENERAL'}</b><strong>{file.mercancia||'RECEPCIÓN COMPLETA'}</strong>{file.nota&&<small>{file.nota}</small>}</figcaption></figure>)}</div>}{Boolean((record.documentos||[]).length)&&<div className="reception-documents">{record.documentos.map((file,index)=><div className="attachment-row" key={file.id||file.url||index}><a href={file.url} target="_blank" rel="noreferrer"><FileText/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>{deleteAttachment&&<button type="button" className="icon-button danger attachment-delete" aria-label="Eliminar documento de recepción" onClick={()=>deleteAttachment(item.id,'reception-document',file,record.ref)}><Trash2/></button>}</div>)}</div>}</article>)}</section>;
}
function Almacen({items,cases,openCase,registerEntry,updateEntry,deleteEntry,showFinance,storageTotal,csrfToken,notify}){
  const [entryOpen,setEntryOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [view,setView]=useState('Activos');
  const [copyStatus,setCopyStatus]=useState('');
  const [selectedRefs,setSelectedRefs]=useState([]);
  const warehouseCases=cases.filter(item=>!isSurveyService(item));
  const warehouseItems=items.filter(item=>!isSurveyWarehouseEntry(item,cases));
  const visibleItems=warehouseItems.filter(item=>view==='Archivados'?item.archivado||item.estado==='Expedido':!item.archivado&&item.estado!=='Expedido');
  const activeVisibleItems=visibleItems.filter(activeWarehouseEntry);
  const allVisibleSelected=activeVisibleItems.length>0&&activeVisibleItems.every(item=>selectedRefs.includes(item.ref));
  useEffect(()=>{setSelectedRefs(current=>current.filter(ref=>warehouseItems.some(item=>item.ref===ref&&activeWarehouseEntry(item))))},[warehouseItems.map(item=>`${item.ref}:${item.estado}:${item.archivado}`).join('|')]);
  const activeStock=warehouseItems.filter(activeWarehouseEntry);
  const totalPackages=activeStock.reduce((sum,item)=>sum+(Number(item.bultos)||0),0);
  const totalWeight=activeStock.reduce((sum,item)=>sum+(Number(String(item.peso).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0),0);
  const occupiedPallets=activeStock.reduce((sum,item)=>sum+warehousePalletPositions(item),0);
  const occupiedLongArea=activeStock.reduce((sum,item)=>sum+warehouseLongFloorArea(item),0);
  const occupiedArea=occupiedPallets*EURO_PALLET_FLOOR_M2+occupiedLongArea;
  const occupationPercent=warehouseOccupancyPercent(occupiedArea);
  const monthlyOccupancy=warehouseMonthlyOccupancy(warehouseItems);
  const submit=form=>{registerEntry(form);setEntryOpen(false)};
  const toggleWarehouseSelection=(ref,checked)=>setSelectedRefs(current=>checked?[...new Set([...current,ref])]:current.filter(item=>item!==ref));
  const toggleVisibleSelection=()=>setSelectedRefs(current=>allVisibleSelected?current.filter(ref=>!activeVisibleItems.some(item=>item.ref===ref)):[...new Set([...current,...activeVisibleItems.map(item=>item.ref)])]);
  const copyWhatsappSummary=async()=>{
    const selectedItems=warehouseItems.filter(item=>selectedRefs.includes(item.ref)&&activeWarehouseEntry(item));
    if(!selectedItems.length){const message='Selecciona primero la mercancia que quieres copiar';setCopyStatus(message);notify?.(message);setTimeout(()=>setCopyStatus(''),3000);return}
    const text=warehouseWhatsappSummary(selectedItems,cases);
    let copied=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true}}catch(error){copied=false}
    if(!copied)window.prompt('Copia este resumen para WhatsApp',text);
    const message=copied?`${selectedItems.length} entrada${selectedItems.length===1?'':'s'} copiadas para WhatsApp`:'Resumen generado para copiar';
    setCopyStatus(message);notify?.(message);setTimeout(()=>setCopyStatus(''),3000);
  };
  return <>
    <section className={'summary-strip '+(!showFinance?'summary-strip-three':'')}>
      <Summary icon={Box} label="Piezas en stock" value={String(totalPackages)}/>
      <Summary icon={Scale} label="Peso total" value={totalWeight.toLocaleString('es-ES')+' kg'}/>
      <Summary icon={Layers3} label="Ocupación real" value={occupationPercent.toLocaleString('es-ES',{maximumFractionDigits:1})+'%'}/>
      {showFinance&&<Summary icon={CircleDollarSign} label="Storage acumulado" value={money(storageTotal)}/>}
    </section>
    <section className="panel warehouse-occupancy-panel">
      <div className="warehouse-occupancy-heading"><div><span className="overline">75 m² de superficie total</span><h2>Ocupación real del almacén</h2><p>Solo cuentan los pallets identificados y el material largo declarado. Cajas, sobres, paquetes y bultos permanecen en stock, pero ocupan 0% en esta estadística.</p></div><div className="warehouse-capacity"><span><b>{WAREHOUSE_PALLET_CAPACITY}</b><small>pallets = 100%</small></span><span><b>{WAREHOUSE_OPERATIONAL_M2.toLocaleString('es-ES',{maximumFractionDigits:1})} m²</b><small>superficie útil equivalente</small></span></div></div>
      <div className="warehouse-current-occupancy">
        <div className="occupancy-gauge"><div><strong>{occupationPercent.toLocaleString('es-ES',{maximumFractionDigits:1})}%</strong><small>{occupiedArea.toLocaleString('es-ES',{maximumFractionDigits:2})} m² computables · límite operativo {WAREHOUSE_OPERATIONAL_M2.toLocaleString('es-ES',{maximumFractionDigits:1})} m²</small></div><span className={occupationPercent>=100?'danger':occupationPercent>=70?'warning':'good'}><i style={{width:`${Math.min(100,occupationPercent)}%`}}/></span></div>
        <div className="occupancy-equivalent"><small>SOLO PALLETS Y LARGOS</small><b>{occupiedPallets.toLocaleString('es-ES',{maximumFractionDigits:1})} pallets + {occupiedLongArea.toLocaleString('es-ES',{maximumFractionDigits:2})} m² de largos</b><span>Equivalente total: {(occupiedArea/EURO_PALLET_FLOOR_M2).toLocaleString('es-ES',{maximumFractionDigits:1})} de {WAREHOUSE_PALLET_CAPACITY}. El resto ocupa 0%.</span></div>
      </div>
      <div className="warehouse-history"><div className="warehouse-history-head"><span>Mes</span><span>Promedio</span><span>Máximo</span><span>≥ 30%</span><span>≥ 70%</span><span>≥ 100%</span></div>{monthlyOccupancy.map(month=><div className="warehouse-history-row" key={month.key}><span><b>{month.label}</b><small>{month.days} días medidos</small></span><span>{month.average.toLocaleString('es-ES',{maximumFractionDigits:1})}%</span><span>{month.max.toLocaleString('es-ES',{maximumFractionDigits:1})}%</span><span><b>{month.over30}</b> días</span><span><b>{month.over70}</b> días</span><span className={month.over100?'danger':''}><b>{month.over100}</b> días</span></div>)}</div>
    </section>
    <section className="panel">
      <SectionHeader title="Mercancia y ubicaciones" subtitle="Selecciona las entradas que quieres copiar para avisar al cliente" action={<div className="warehouse-actions"><button className="button secondary" onClick={copyWhatsappSummary}><ClipboardCheck/> Copiar seleccion WhatsApp</button><button className="button secondary" onClick={()=>setEntryOpen(true)}><Plus/> Registrar entrada</button></div>}/>
      {copyStatus&&<p className="warehouse-copy-status"><ClipboardCheck/>{copyStatus}</p>}
      <div className="warehouse-view-tabs">
        <button className={view==='Activos'?'active':''} onClick={()=>setView('Activos')}>En almacen <span>{warehouseItems.filter(item=>!item.archivado&&item.estado!=='Expedido').length}</span></button>
        <button className={view==='Archivados'?'active':''} onClick={()=>setView('Archivados')}>Archivados <span>{warehouseItems.filter(item=>item.archivado||item.estado==='Expedido').length}</span></button>
      </div>
      {view==='Activos'&&<div className="warehouse-selection-bar"><label><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection}/> Seleccionar visibles</label><span>{selectedRefs.length} seleccionada{selectedRefs.length===1?'':'s'}</span></div>}
      <div className="responsive-table warehouse-table">
        <div className="table-head"><span>Referencia / expediente</span><span>Ubicacion</span><span>Entrada</span><span>Mercancia</span><span>Storage</span><span>Estado</span></div>
        {visibleItems.map(item=><button className={'table-row '+(selectedRefs.includes(item.ref)?'selected':'')} key={item.ref} onClick={()=>setEditing(item)}>
          <span className="primary-cell"><label className="warehouse-select" onClick={event=>event.stopPropagation()}><input type="checkbox" disabled={!activeWarehouseEntry(item)} checked={selectedRefs.includes(item.ref)} onChange={event=>toggleWarehouseSelection(item.ref,event.target.checked)}/></label><span className="box-icon"><Box/></span><span><b>{item.buque}</b><small>{item.ref}  -  {item.expediente||'SIN EXPEDIENTE'}  -  {(item.fotos||[]).length} fotos</small></span></span>
          <span data-label="Ubicacion"><b>{item.zona}</b></span>
          <span data-label="Entrada">{item.entrada}</span>
          <span data-label="Mercancia">{warehouseEntryTypeSummary(item)}<small>{item.peso} · {warehouseOccupancyLabel(item)}</small></span>
          <span data-label="Storage">{storageDaysForEntry(item)} dia{storageDaysForEntry(item)===1?'':'s'}</span>
          <span data-label="Estado"><Badge>{item.expediente?item.estado:'Por vincular'}</Badge></span>
        </button>)}
      </div>
    </section>
    {entryOpen&&<WarehouseEntryModal cases={warehouseCases} csrfToken={csrfToken} close={()=>setEntryOpen(false)} submit={submit}/>}
    {editing&&<WarehouseEditModal item={editing} cases={warehouseCases} close={()=>setEditing(null)} submit={item=>{updateEntry(item);setEditing(null)}} deleteItem={item=>{deleteEntry(item);setEditing(null)}}/>}
  </>;
}
function Summary({icon:Icon,label,value}){return <article><span><Icon/></span><div><small>{label}</small><b>{value}</b></div></article>}
const vesselPhotoUrl=vessel=>String(vessel.photoUrl||vessel.image||'').trim();
const vesselInitials=name=>String(name||'BUQUE').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('');
function Buques({vessels,cases,warehouseEntries,saveVessel,deleteVessel,openCase}){
  const [query,setQuery]=useState('');
  const [editing,setEditing]=useState(null);
  const rows=[...vessels].sort((a,b)=>vesselNameOf(a).localeCompare(vesselNameOf(b))).filter(vessel=>[vesselNameOf(vessel),vessel.imo,vessel.mmsi].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <><section className="panel vessels-panel"><SectionHeader title="Listado de buques" subtitle="Ficha única del buque para reutilizar nombre, IMO y MMSI. Los puertos y fechas se controlan por expediente/escala." action={<button className="button secondary" onClick={()=>setEditing({name:'',imo:'',mmsi:'',lastPort:'',photoUrl:''})}><Plus/> Nuevo buque</button>}/><label className="search-box standalone vessel-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar buque por nombre, IMO o MMSI…"/></label><div className="vessel-list"><div className="vessel-list-head"><span>Buque</span><span>IMO / MMSI</span><span>Expedientes</span><span>Stock</span><span>Acciones</span></div>{rows.map(vessel=>{const name=vesselNameOf(vessel);const photo=vesselPhotoUrl(vessel);const relatedCases=cases.filter(item=>sameVessel(item.buque,name)).sort(newestFirst);const activeStock=warehouseEntries.filter(entry=>activeWarehouseEntry(entry)&&sameVessel(entry.buque,name));const stock=activeStock.reduce((sum,item)=>sum+Number(item.bultos||0),0);return <article className="vessel-row" key={vessel.id||name}><div className="vessel-photo">{photo?<img src={photo} alt={name}/>:<span><Ship/><b>{vesselInitials(name)}</b></span>}</div><div className="vessel-main"><h3>{name}</h3><small>Ficha AIS · nombre/IMO/MMSI reutilizables</small></div><div className="vessel-metrics"><span><small>IMO</small><b>{vessel.imo||'Pendiente'}</b></span><span><small>MMSI</small><b>{vessel.mmsi||'Pendiente'}</b></span><span><small>Expedientes</small><b>{relatedCases.length}</b></span><span><small>Stock</small><b>{stock} bultos</b></span></div><div className="vessel-actions">{relatedCases.length===1&&<button className="button tertiary" onClick={()=>openCase(relatedCases[0].id)}>Abrir {relatedCases[0].id}</button>}{relatedCases.length>1&&<select className="vessel-case-select" defaultValue="" onChange={event=>event.target.value&&openCase(event.target.value)}><option value="">Ver {relatedCases.length} expedientes</option>{relatedCases.map(item=><option key={item.id} value={item.id}>{item.id} · {formatEtaDate(item.eta)} · {item.puerto||'Puerto pendiente'}</option>)}</select>}<button className="icon-button compact" title="Editar buque" onClick={()=>setEditing(vessel)}><PencilLine/></button><button className="icon-button compact danger" title="Borrar buque" onClick={()=>deleteVessel(vessel)}><Trash2/></button></div></article>})}</div>{!rows.length&&<Empty text="No hay fichas de buque con ese nombre."/>}</section>{editing&&<VesselModal item={editing} close={()=>setEditing(null)} submit={item=>{saveVessel(item);setEditing(null)}}/>}</>;
}
function VesselModal({item,close,submit}){
  const [form,setForm]=useState({id:item.id||item.name||'',name:vesselNameOf(item),imo:item.imo||'',mmsi:item.mmsi||'',lastPort:item.lastPort||'',photoUrl:item.photoUrl||''});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal vessel-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Ficha de buque</span><h2>{item.name?'Editar buque':'Nuevo buque'}</h2><p>Esta información se reutiliza al crear expedientes y para seguimiento AIS.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field wide"><span>Nombre del buque *</span><input name="name" value={form.name} onChange={update} required autoFocus/></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="7 dígitos"/></label><label className="field"><span>MMSI</span><input name="mmsi" inputMode="numeric" maxLength="9" value={form.mmsi} onChange={update} placeholder="9 dígitos"/></label><label className="field wide"><span>Puerto habitual / último puerto</span><input name="lastPort" value={form.lastPort} onChange={update} placeholder="Ej. SAGUNTO"/></label><label className="field wide"><span>Foto del buque (URL opcional)</span><input name="photoUrl" value={form.photoUrl} onChange={update} placeholder="Pega aquí una URL de imagen del buque"/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar ficha</button></div></form></section></div>;
}
function Transportes({items,update,openCase,team,providers,saveProvider}){
  const [filter,setFilter]=useState('Activos');const [editing,setEditing]=useState(null);const [providerOpen,setProviderOpen]=useState(false);
  const visible=items.filter(item=>filter==='Todos'?true:filter==='Activos'?!isCancelledTransport(item):filter==='Cancelados'?isCancelledTransport(item):item.estado===filter);
  return <><section className="provider-strip panel"><SectionHeader title="Proveedores de transporte" subtitle="Empresas disponibles para asignar servicios" action={<button className="button secondary" onClick={()=>setProviderOpen(true)}><Plus/> Añadir proveedor</button>}/><div>{providers.filter(item=>item.activo!==false).map(provider=><span key={provider.id}><Truck/><b>{provider.nombre}</b><small>{provider.contacto||'Sin contacto'}</small></span>)}</div></section><section className="module-toolbar"><div className="filter-chips">{['Activos','En ruta','Asignado','Sin asignar','Entregado','Cancelados','Todos'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></section><section className="transport-grid">{visible.map(item=>{const provider=providers.find(entry=>entry.id===item.proveedorId);const route=routeParts(item);const cancelled=isCancelledTransport(item);const cancellation=item.cancellation||{};return <article className={'transport-card '+(cancelled?'cancelled':'')} key={item.id}><div className="transport-head"><span className={'transport-icon '+statusTone(item.estado)}><Truck/></span><div><small>{item.id}  -  {item.expediente}</small><Badge>{item.estado}</Badge></div><button className="icon-button compact" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div><div className="transport-route-detail"><span><MapPin/><small>LUGAR DE RECOGIDA</small><b>{route.origen}</b></span><i><ChevronRight/></i><span><Navigation/><small>LUGAR DE ENTREGA</small><b>{route.destino}</b></span></div>{cancelled&&<div className="transport-cancellation-summary"><CircleAlert/><span><b>{cancellation.reason||'Servicio cancelado'}</b><small>{cancellation.cancelledBy?'Registrado por '+cancellation.cancelledBy:''}{cancellation.cancelledAt?' · '+formatReceptionDate(cancellation.cancelledAt):''}{cancellation.expenseAmount>0?' · Gastos '+moneyExact(cancellation.expenseAmount)+(cancellation.billableToClient?' facturables':' internos'):' · Sin gastos'}</small></span></div>}<div className="transport-provider">{provider?.nombre||cancellation.expenseProvider||'Proveedor sin asignar'}</div><div className="transport-info"><span><Clock3/><small>Horario original</small><b>{item.hora}</b></span><span><UserRound/><small>Conductor</small><b>{cancelled?'No asignado':item.conductor}</b></span><span><Navigation/><small>Vehículo</small><b>{item.vehiculo}</b></span></div><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className={cancelled?'button tertiary':'button primary'} onClick={()=>setEditing(item)}>{cancelled?'Ver cancelación':item.estado==='Sin asignar'?'Asignar servicio':'Editar / cancelar'}</button></div></article>})}</section>{!visible.length&&<Empty text={filter==='Cancelados'?'No hay servicios cancelados.':'No hay transportes en este estado.'}/>} {editing&&<TransportEditModal item={editing} team={team} providers={providers} close={()=>setEditing(null)} submit={item=>{if(update(item)!==false)setEditing(null)}}/>}{providerOpen&&<ProviderModal close={()=>setProviderOpen(false)} submit={item=>{saveProvider(item);setProviderOpen(false)}}/>}</>;
}
function Aduanas({items,update,openCase,notify}){
  const [editing,setEditing]=useState(null);
  return <><section className="alert-banner"><CircleAlert/><div><b>{items.filter(item=>item.estado==='Pendiente').length} trámite requiere atención</b><p>Revisa los documentos pendientes y sus fechas límite.</p></div></section><section className="panel"><SectionHeader title="Trámites aduaneros" subtitle="DUA, T1, T2L y levantes vinculados a expedientes"/><div className="customs-grid">{items.map(item=><article className="custom-card" key={item.id}><div className="custom-card-top"><span className="doc-icon"><FileCheck2/></span><div><small>{item.id}  -  {item.expediente}</small><h3>{item.tipo}</h3></div><Badge>{item.estado}</Badge></div><dl><div><dt>Referencia</dt><dd>{item.referencia}</dd></div><div><dt>Fecha límite</dt><dd>{item.limite}</dd></div></dl><p>{item.nota}</p><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button secondary" onClick={()=>setEditing(item)}><PencilLine/> Editar</button></div></article>)}</div></section>{editing&&<CustomEditModal item={editing} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}</>;
}
function Clientes({notify,clients,updateClient}){
  const [query,setQuery]=useState('');const [editing,setEditing]=useState(null);const normalized=mergeClientProfiles(clients);const visible=normalized.filter(item=>[item.nombre,item.fiscalName,item.taxId,item.contacto,item.tarifaActiva].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <><section className="panel clients-directory-panel"><SectionHeader title="Fichas de clientes" subtitle="Datos fiscales, contactos, condiciones de pago y tarifas por cliente" action={<button className="button secondary" onClick={()=>setEditing(normalizeClientProfile({nombre:'',codigo:'CLI-'+Date.now()}))}><Plus/> Nuevo cliente</button>}/><label className="search-box standalone"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, NIF, contacto o tarifa…"/></label><div className="client-file-grid">{visible.map(item=><article className="client-file-card" key={item.codigo}><header><span className="client-avatar">{item.nombre.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><div><small>{item.codigo}</small><h3>{item.nombre||'Cliente sin nombre'}</h3><p>{item.fiscalName}</p></div><button className="icon-button" aria-label={'Editar '+item.nombre} onClick={()=>setEditing(item)}><PencilLine/></button></header><div className="client-file-meta"><span><small>NIF / VAT</small><b>{item.taxId||'Pendiente'}</b></span><span><small>Condiciones</small><b>{item.condicionesPago}</b></span><span><small>Moneda</small><b>{item.moneda}</b></span><span><small>Expedientes</small><b>{item.expedientes}</b></span></div><div className="client-contact-line"><Mail/><a href={item.contacto?`mailto:${item.contacto}`:'#'}>{item.contacto||'Email pendiente'}</a>{item.telefono&&<small>{item.telefono}</small>}</div><div className="client-address"><MapPin/><span>{item.direccion||'Dirección fiscal pendiente'}</span></div><div className="client-rate-box"><b>{item.tarifaActiva}</b><span><small>Recepción</small>{item.recepcion}</span><span><small>Storage</small>{item.storage}</span><span><small>Transporte</small>{item.transporte}</span><span><small>Recargo</small>{item.recargo}</span></div><button className="button tertiary full" onClick={()=>setEditing(item)}>Editar ficha completa <PencilLine/></button></article>)}</div>{!visible.length&&<Empty text="No hay clientes con esa búsqueda."/>}</section>{editing&&<ClientEditModal item={editing} close={()=>setEditing(null)} submit={item=>{updateClient(item);setEditing(null)}}/>}</>;
}
function BillingExceptionModal({item,close,submit}){
  const options=['Servicio cancelado sin cargos','Duplicado','Incluido en otra factura','Cortesía / no facturable','Error de expediente','Otro'];
  const [form,setForm]=useState({type:item.billingExceptionType||options[0],reason:item.billingExceptionReason||''});
  const save=event=>{event.preventDefault();const reason=String(form.reason||'').trim();if(reason.length<5)return;submit({...form,reason})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal billing-exception-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Control de facturación · {item.expediente}</span><h2>Registrar por qué no se factura</h2><p>El expediente seguirá visible y trazado. Esta decisión podrá revisarse después.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={save}><div className="billing-exception-warning wide"><ShieldCheck/><span><b>No elimina la operativa ni el historial</b><small>Solo cierra este expediente en el control de facturación con un motivo obligatorio.</small></span></div><label className="field wide"><span>Motivo *</span><select value={form.type} onChange={event=>setForm(current=>({...current,type:event.target.value}))}>{options.map(option=><option key={option}>{option}</option>)}</select></label><label className="field wide"><span>Explicación concreta *</span><textarea rows="4" value={form.reason} onChange={event=>setForm(current=>({...current,reason:event.target.value}))} placeholder="Ej. El barco canceló la escala antes del servicio y no se generaron gastos." required autoFocus/><small>Indica quién o qué originó la decisión y si hubo gastos. Mínimo 5 caracteres.</small></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={String(form.reason||'').trim().length<5}><Archive/> Guardar como no facturar</button></div></form></section></div>;
}function HoldedBillingReview({item,cost,revenue,margin}){
  const billed=item.holdedBilledVerified===true;
  const priceRead=billed&&item.holdedPriceVerified===true&&item.holdedInvoicedAmount!=null;
  const sent=Number(item.holdedSentAmount??invoiceRevenue(item));
  const difference=priceRead?Number(item.holdedPriceDifference??revenue-sent):null;
  const checked=new Date(item.holdedCheckedAt||item.holdedAt||'');
  const checkedLabel=Number.isNaN(checked.getTime())?'':checked.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  const tone=!billed||!priceRead?'pending':item.holdedPriceMatches?'match':'changed';
  return <span className={`billing-holded-review ${tone}`}><span className="billing-holded-review-icon">{billed?<CheckCircle2/>:<CircleAlert/>}</span><span><b>{billed?'Facturado verificado':item.holdedId?'Pendiente de comprobar':'Sin verificación Holded'}</b><small>{item.holdedInvoiceNumber||item.holdedNumber||item.holdedId||(item.estado==='Cobrado'?'Cobrado sin ID verificable':'Facturado sin ID verificable')}{checkedLabel?` · ${checkedLabel}`:''}</small>{billed&&<small>Antes {moneyExact(sent)} · Final {priceRead?moneyExact(revenue):'precio pendiente'}</small>}<small>Gastos {moneyExact(cost)} · {priceRead?'Margen final':'Margen sin verificar'} {moneyExact(margin)}</small>{priceRead&&<em>{item.holdedPriceMatches?'Sin cambios de precio':`Diferencia ${difference>0?'+':''}${moneyExact(difference)}`}</em>}</span></span>;
}
function Facturacion({openCase,notify,invoices,cases,warehouseEntries=[],transports=[],calendarEvents=[],clients=[],updateInvoice,updateCase,syncInvoices,csrfToken,currentUser}){
  const [editing,setEditing]=useState(null);
  const [billingControlView,setBillingControlView]=useState('attention');
  const [archiveCandidate,setArchiveCandidate]=useState(null);
  const [sendingHolded,setSendingHolded]=useState('');
  const [checkingHolded,setCheckingHolded]=useState('');
  const [poDrafts,setPoDrafts]=useState({});
  const [savingPurchaseOrder,setSavingPurchaseOrder]=useState('');
  const holdedAutoCheckRef=useRef(new Set());
  const [billingSort,setBillingSort]=useState('exp_desc');
  const [billingView,setBillingView]=useState('pending');
  const canAdmin=hasRole(currentUser,'admin');
  const relatedCaseForInvoice=item=>cases.find(entry=>entry.id===item.expediente);
  const caseHasBillableCancellation=item=>(item?.billingAdjustments||[]).some(line=>String(line?.id||'').startsWith('cancel-')&&Number(line?.price)>0);
  const invoiceCaseReady=item=>{
    const related=relatedCaseForInvoice(item);
    if(!related)return true;
    const flow=operationFlow(related);
    return Boolean(flow.billingReady||related.estado==='Completado'||related.progreso>=100||caseHasBillableCancellation(related));
  };
  const invoiceSentOrClosed=item=>['Enviado a Holded','Facturado','Cobrado'].includes(item.estado)||hasHoldedProof(item);
  const visibleInvoices=invoices.filter(item=>item.estado!=='Archivado'&&(invoiceCaseReady(item)||invoiceSentOrClosed(item)));
  const notReadyInvoices=invoices.filter(item=>item.estado!=='Archivado'&&!invoiceCaseReady(item)&&!invoiceSentOrClosed(item));
  const archivedInvoices=invoices.filter(item=>item.estado==='Archivado');
  const allInvoicesForReview=[...visibleInvoices,...archivedInvoices];
  const pendingInvoices=visibleInvoices.filter(item=>!invoiceSentOrClosed(item));
  const sentInvoices=visibleInvoices.filter(item=>item.estado==='Enviado a Holded');
  const invoicedInvoices=visibleInvoices.filter(item=>['Facturado','Cobrado'].includes(item.estado));
  const holdedCheckInvoices=visibleInvoices.filter(item=>item.holdedId&&['Enviado a Holded','Facturado','Cobrado'].includes(item.estado));
  const holdedConfirmedInvoices=invoicedInvoices.filter(item=>item.holdedBilledVerified===true);
  const activeInvoices=visibleInvoices.filter(item=>!['Facturado','Cobrado','Archivado'].includes(item.estado));
  const invoiceCostOf=item=>caseExpenseTotal(relatedCaseForInvoice(item))||Number(item.coste)||0;
  const invoiceMarginOf=item=>invoiceFinalRevenue(item)-invoiceCostOf(item);
  const total=activeInvoices.reduce((sum,item)=>sum+invoiceRevenue(item),0);
  const totalCosts=activeInvoices.reduce((sum,item)=>sum+invoiceCostOf(item),0);
  const billableCases=cases.filter(item=>operationFlow(item).billingReady||caseHasBillableCancellation(item));
  const readyCases=billableCases.filter(item=>!invoices.some(invoice=>invoice.expediente===item.id));
  useEffect(()=>{
    const standardIds=['ref','reception','handling','storage','transport','waiting','survey','coordination','delivery','load-unload','warehouse','customs','delivery-vessel','open-file','docs-cession-dhl','docs-cession-tnt','airport-expenses','airport-agency','transport-agp','transport-svq','reception-t1','open-warehouse-night'];
    const standardSet=new Set(standardIds);
    let changed=false;
    let nextInvoices=[...invoices];
    billableCases.forEach(item=>{
      const existing=nextInvoices.find(invoice=>invoice.expediente===item.id);
      const draft=draftInvoiceFromCase(item,warehouseEntries,transports,calendarEvents);
      const locked=existing&&['Enviado a Holded','Facturado','Cobrado','Archivado'].includes(existing.estado);
      if(locked)return;
      if(!existing){
        nextInvoices=[draft,...nextInvoices];
        changed=true;
        return;
      }
      const currentStandard=standardIds.map(id=>{
        const line=invoiceLinesOf(existing.lines).find(entry=>entry.id===id);
        return line?[id,line.item,line.detail,Number(line.price)||0,Number(line.units)||0,line.tax||'0%']:null;
      }).filter(Boolean);
      const draftStandard=standardIds.map(id=>{
        const line=(draft.lines||[]).find(entry=>entry.id===id);
        return line?[id,line.item,line.detail,Number(line.price)||0,Number(line.units)||0,line.tax||'0%']:null;
      }).filter(Boolean);
      const needsRefresh=
        String(existing.cliente||'')!==String(draft.cliente||'')||
        String(existing.concepto||'')!==String(draft.concepto||'')||
        String(existing.buque||'')!==String(draft.buque||'')||
        String(existing.puerto||'')!==String(draft.puerto||'')||
        Number(existing.coste||0)!==Number(draft.coste||0)||
        JSON.stringify(currentStandard)!==JSON.stringify(draftStandard)||
        JSON.stringify(invoiceLinesOf(existing.lines).filter(line=>String(line.id||'').startsWith('cancel-')).map(line=>[line.id,line.item,line.detail,Number(line.price)||0,Number(line.units)||0]))!==JSON.stringify((draft.lines||[]).filter(line=>String(line.id||'').startsWith('cancel-')).map(line=>[line.id,line.item,line.detail,Number(line.price)||0,Number(line.units)||0]));
      if(!needsRefresh)return;
      const customLines=invoiceLinesOf(existing.lines).filter(line=>!standardSet.has(line.id)&&!String(line.id||'').startsWith('cancel-'));
      const refreshed={
        ...draft,
        id:existing.id,
        cliente:draft.cliente,
        estado:existing.estado||draft.estado,
        vencimiento:existing.vencimiento||draft.vencimiento,
        proforma:existing.proforma||draft.proforma,
        observaciones:existing.observaciones||draft.observaciones,
        payment:existing.payment||draft.payment,
        supplierInvoices:existing.supplierInvoices||[],
        supplierText:existing.supplierText||'',
        lines:[...draft.lines,...customLines]
      };
      refreshed.coste=draft.coste;
      refreshed.margen=invoiceRevenue(refreshed)-Number(draft.coste||0);
      nextInvoices=nextInvoices.map(invoice=>invoice.id===existing.id?refreshed:invoice);
      changed=true;
    });
    if(changed)syncInvoices(nextInvoices);
  },[billableCases.map(item=>`${item.id}:${serviceTypeOf(item)}:${item.buque}:${item.puerto}:${item.eta}:${item.portCall?.etaDate||''}:${item.portCall?.etbDate||item.etbDate||item.etb||''}:${item.portCall?.etdDate||item.etdDate||item.etd||''}:${item.cliente}:${item.purchaseOrder||''}:${item.updatedAt||''}:${caseExpenseTotal(item)}:${caseExpenses(item).map(expense=>[expense.id,expense.fecha,expense.proveedor,expense.concepto,expense.importe].join(':')).join(',')}`).join('|'),invoices.map(item=>`${item.id}:${item.expediente}:${item.estado}:${item.cliente}:${item.concepto}:${item.buque}:${item.puerto}:${item.coste||0}:${invoiceLinesOf(item.lines).map(line=>[line.id,line.item,line.detail,line.price,line.units,line.tax].join(':')).join('|')}`).join('||'),warehouseEntries.map(item=>`${item.ref}:${item.expediente}:${item.dias}:${item.estado}:${item.archivado}:${item.salida||''}:${item.updatedAt||''}`).join('|'),transports.map(item=>`${item.id}:${item.expediente}:${item.fecha}:${item.inicio}:${item.fin}:${item.estado||''}`).join('|'),calendarEvents.map(item=>`${item.id}:${item.expediente}:${item.transporte}:${item.tipoServicio}:${item.fecha}:${item.inicio}:${item.fin}`).join('|')]);
  const draftFromCase=item=>draftInvoiceFromCase(item,warehouseEntries,transports,calendarEvents);
  const createDraft=item=>setEditing(draftFromCase(item));
  const archiveInvoice=item=>{
    if(!canAdmin){notify('Solo un administrador puede registrar una excepción de facturación.');return}
    if(invoiceSentOrClosed(item)&&item.estado!=='Archivado'){notify('Este documento ya salió a Holded y no puede ocultarse. Comprueba su estado real o corrígelo en Holded.');return}
    setArchiveCandidate(item);
  };
  const archiveReadyCase=item=>{
    if(!canAdmin){notify('Solo un administrador puede registrar una excepción de facturación.');return}
    setArchiveCandidate(draftFromCase(item));
  };
  const saveBillingException=decision=>{
    if(!archiveCandidate)return;
    const stamp=new Date().toISOString();
    updateInvoice({...archiveCandidate,estado:'Archivado',billingExceptionType:decision.type,billingExceptionReason:String(decision.reason||'').trim(),billingExceptionAt:stamp,billingExceptionBy:currentUser?.fullName||currentUser?.name||currentUser?.email||'Administración',archivedAt:stamp});
    notify(`${archiveCandidate.expediente} registrado como no facturar con motivo obligatorio`);
    setArchiveCandidate(null);
  };  const numberFromCode=value=>Number(String(value||'').match(/(\d+)(?!.*\d)/)?.[1]||0);
  const compareByNumber=(left,right,field,dir='asc')=>{
    const diff=numberFromCode(left[field])-numberFromCode(right[field]);
    if(diff!==0)return dir==='asc'?diff:-diff;
    return String(left[field]||'').localeCompare(String(right[field]||''),undefined,{numeric:true});
  };
  const billingBuckets=[
    ['pending','Pendientes',pendingInvoices.length],
    ['sent','Enviadas a Holded',sentInvoices.length],
    ['invoiced','Facturadas / cobradas',invoicedInvoices.length],
    ['archived','Archivadas',archivedInvoices.length],
    ['all','Todas',allInvoicesForReview.length]
  ];
  const filteredInvoices=billingView==='pending'?pendingInvoices:billingView==='sent'?sentInvoices:billingView==='invoiced'?invoicedInvoices:billingView==='archived'?archivedInvoices:allInvoicesForReview;
  const sortedVisibleInvoices=[...filteredInvoices].sort((left,right)=>{
    if(billingSort==='exp_asc')return compareByNumber(left,right,'expediente','asc');
    if(billingSort==='exp_desc')return compareByNumber(left,right,'expediente','desc');
    if(billingSort==='doc_asc')return compareByNumber(left,right,'id','asc');
    if(billingSort==='doc_desc')return compareByNumber(left,right,'id','desc');
    return 0;
  });
  const groupedStatus=['Borrador','Revisar','Listo para enviar','Enviado a Holded','Facturado','Cobrado'];
  const holdedClientProfiles=mergeClientProfiles(clients);
  const holdedClientProfile=value=>{
    const key=clientProfileKey({nombre:value});
    return holdedClientProfiles.find(profile=>clientProfileKey(profile)===key)||holdedClientProfiles.find(profile=>String(profile.nombre||'').toLowerCase().includes(String(value||'').toLowerCase())&&String(value||'').trim().length>=3);
  };
  const savePurchaseOrder=async item=>{
    const related=cases.find(entry=>entry.id===item.expediente);
    if(!related){notify('No se encontró el expediente relacionado.');return}
    const purchaseOrder=String((poDrafts[item.expediente]??purchaseOrderOf(related))||'').trim().toUpperCase();
    if(!purchaseOrder){notify('Escribe el PO / Purchase Order antes de guardarlo.');return}
    setSavingPurchaseOrder(item.expediente);
    try{
      const updatedCase={...related,purchaseOrder};
      await updateCase(updatedCase);
      const title=invoiceHeaderTitle(updatedCase,transports,calendarEvents);
      const nextLines=invoiceLinesOf(item.lines).map(line=>String(line?.id||'').toLowerCase()==='ref'?{...line,item:title}:line);
      updateInvoice({...item,purchaseOrder,concepto:title,lines:nextLines});
      setPoDrafts(current=>({...current,[item.expediente]:purchaseOrder}));
      notify(`PO ${purchaseOrder} guardado en el expediente y en la factura.`);
    }catch(reason){
      notify('No se pudo guardar el PO: '+reason.message);
    }finally{
      setSavingPurchaseOrder('');
    }
  };
  const sendHolded=item=>{
    if(!csrfToken){notify('Inicia sesión en la web publicada para enviar a Holded.');return}
    const related=cases.find(entry=>entry.id===item.expediente);
    const itemLines=asArray(item.lines);
    const templateLines=related?asArray(draftInvoiceFromCase(related,warehouseEntries,transports,calendarEvents).lines):[];
    const billingContext=related||item;
    const purchaseOrder=purchaseOrderOf(billingContext);
    if(isLimaniCase(billingContext)&&!purchaseOrder){notify('Falta el PO / Purchase Order de LIMANI. Abre el expediente, pulsa editar y añade un número como POA604877.');return}
    const preparedLines=ensurePurchaseOrderReferenceLines(itemLines.length?itemLines:templateLines,billingContext);
    const prepared={...item,purchaseOrder,concepto:withPurchaseOrderSuffix(item.concepto,billingContext),clientProfile:holdedClientProfile(item.cliente),importe:item.importe||invoiceTotal(item),coste:related?caseExpenseTotal(related):Number(item.coste)||0,margen:related?invoiceRevenue(item)-caseExpenseTotal(related):Number(item.margen)||0,lines:preparedLines};
    setSendingHolded(item.id);
    api('/api/holded/create.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({invoice:prepared})})
      .then(result=>{
      updateInvoice({...prepared,estado:'Enviado a Holded',holdedStatus:result.holdedStatus||'Proforma creada',holdedDocType:result.docType||'proform',holdedId:result.holdedId||'',holdedNumber:result.holdedNumber||'',holdedAt:new Date().toISOString(),holdedSentAmount:Number(result.holdedAmount??invoiceRevenue(prepared))});
      notify(result.holdedNumber?`Proforma creada en Holded: ${result.holdedNumber}`:'Proforma creada en Holded');
    })
    .catch(reason=>notify([reason.message,reason.body?.holdedStatus,reason.body?.holdedReason].filter(Boolean).join(' · ')))
    .finally(()=>setSendingHolded(''));
  };
  const verifyHoldedDocuments=async(items=holdedCheckInvoices,{silent=false}={})=>{
    if(!csrfToken){if(!silent)notify('Inicia sesión en la web publicada para comprobar Holded.');return}
    const candidates=items.filter(item=>item.holdedId);
    if(!candidates.length){if(!silent)notify('Estos documentos no tienen un ID de Holded que se pueda comprobar.');return}
    setCheckingHolded(candidates.length===1?candidates[0].id:'all');
    try{
      const result=await api('/api/holded/status.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({invoices:candidates.map(item=>({id:item.id,holdedId:item.holdedId,holdedDocType:item.holdedDocType||'proform',holdedAt:item.holdedAt||'',sentAmount:Number(item.holdedSentAmount??invoiceRevenue(item))}))})});
      const checkedById=new Map((result.items||[]).map(status=>[status.id,status]));
      const nextInvoices=invoices.map(invoice=>{
        const status=checkedById.get(invoice.id);
        if(!status)return invoice;
        const nextState=status.billed&&!['Facturado','Cobrado'].includes(invoice.estado)?'Facturado':invoice.estado;
        return {...invoice,estado:nextState,holdedStatus:status.holdedStatus||invoice.holdedStatus,holdedCheckedAt:status.holdedCheckedAt||result.checkedAt||new Date().toISOString(),holdedBilledVerified:status.billed===true,holdedInvoiceId:status.holdedInvoiceId||invoice.holdedInvoiceId||'',holdedInvoiceNumber:status.holdedInvoiceNumber||invoice.holdedInvoiceNumber||'',holdedSentAmount:Number(status.holdedSentAmount??invoice.holdedSentAmount??invoiceRevenue(invoice)),holdedInvoicedAmount:status.holdedInvoicedAmount==null?null:Number(status.holdedInvoicedAmount),holdedPriceVerified:status.holdedPriceVerified===true,holdedPriceMatches:status.holdedPriceMatches===true,holdedPriceDifference:status.holdedPriceDifference==null?null:Number(status.holdedPriceDifference)};
      });
      syncInvoices(nextInvoices);
      if(result.billed>0)notify(`Holded verificado: ${result.billed} documento${result.billed===1?' ha':'s han'} pasado a Facturado.`);
      else if(!silent)notify(`Holded verificado: ${result.checked||candidates.length} proforma${(result.checked||candidates.length)===1?'':'s'} todavía sin facturar.`);
    }catch(reason){
      if(!silent)notify([reason.message,reason.body?.holdedStatus,reason.body?.holdedReason].filter(Boolean).join(' · '));
    }finally{
      setCheckingHolded('');
    }
  };
  const sentHoldedSignature=sentInvoices.map(item=>`${item.id}:${item.holdedId||''}`).sort().join('|');
  useEffect(()=>{
    if(!csrfToken||!sentHoldedSignature)return;
    const candidates=sentInvoices.filter(item=>item.holdedId&&!holdedAutoCheckRef.current.has(`${item.id}:${item.holdedId}`));
    if(!candidates.length)return;
    candidates.forEach(item=>holdedAutoCheckRef.current.add(`${item.id}:${item.holdedId}`));
    verifyHoldedDocuments(candidates,{silent:true});
  },[csrfToken,sentHoldedSignature]);
  const billingControlMeta={
    missing:{label:'SIN BORRADOR',tone:'danger'},
    decision:{label:'DECISIÓN PENDIENTE',tone:'warning'},
    pending:{label:'BORRADOR PENDIENTE',tone:'warning'},
    blocked:{label:'OPERATIVA INCOMPLETA',tone:'warning'},
    incident:{label:'INCIDENCIA',tone:'danger'},
    sent:{label:'PROFORMA EN HOLDED',tone:'info'},
    overdue:{label:'PROFORMA DEMORADA',tone:'danger'},
    verify:{label:'VERIFICAR EN HOLDED',tone:'warning'},
    confirmed:{label:'FACTURA CONFIRMADA',tone:'success'},
    excluded:{label:'NO FACTURAR JUSTIFICADO',tone:'muted'}
  };
  const billingAgeDays=value=>{
    const date=new Date(value||'');
    if(Number.isNaN(date.getTime()))return null;
    return Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));
  };
  const billingControlRows=invoices.map(invoice=>{
    const related=relatedCaseForInvoice(invoice);
    const amount=invoiceFinalRevenue(invoice);
    const cost=invoiceCostOf(invoice);
    const age=billingAgeDays(invoice.holdedAt||invoice.holdedCheckedAt);
    const base={key:'invoice-'+invoice.id,invoice,caseItem:related,expediente:invoice.expediente||'SIN EXPEDIENTE',buque:related?.buque||invoice.buque||'Buque no localizado',cliente:invoice.cliente||related?.cliente||'',amount,cost,age};
    if(invoice.estado==='Archivado'){
      if(invoice.billingExceptionReason)return {...base,stage:'excluded',reason:(invoice.billingExceptionType?invoice.billingExceptionType+' · ':'')+invoice.billingExceptionReason};
      return {...base,stage:'incident',reason:'Archivado sin motivo registrado. Debe justificarse para cerrar el control.',archived:true};
    }
    if(!related)return {...base,stage:'incident',reason:'El documento no encuentra su expediente de origen.'};
    if(!invoiceCaseReady(invoice)&&!invoiceSentOrClosed(invoice))return {...base,stage:'blocked',reason:'Expediente aún no listo: '+(related.siguiente||'faltan pasos operativos.')};
    if(amount<=0&&!invoiceSentOrClosed(invoice))return {...base,stage:'incident',reason:'Importe pendiente o igual a 0 €. Revisar antes de enviar.'};
    if(invoice.holdedBilledVerified===true){
      if(invoice.holdedPriceVerified!==true)return {...base,stage:'verify',reason:'Factura localizada en Holded; falta leer o confirmar el importe final.'};
      if(invoice.holdedPriceMatches===false){
        const difference=Number(invoice.holdedPriceDifference)||0;
        if(difference>0)return {...base,stage:'confirmed',reason:'Factura confirmada por Holded · importe final superior en '+moneyExact(difference)+'.'};
        return {...base,stage:'incident',reason:'Facturada en Holded por debajo de lo previsto: '+moneyExact(difference)+'.'};
      }
      return {...base,stage:'confirmed',reason:'Factura confirmada por Holded'+(invoice.holdedInvoiceNumber?' · '+invoice.holdedInvoiceNumber:'')+'.'};
    }
    if(['Facturado','Cobrado'].includes(invoice.estado)){
      return {...base,stage:invoice.holdedId?'verify':'incident',reason:invoice.holdedId?'Estado interno '+invoice.estado+', pendiente de confirmación real en Holded.':'Marcado como '+invoice.estado+' pero sin ID verificable de Holded.'};
    }
    if(invoice.estado==='Enviado a Holded'||invoice.holdedId){
      if(!invoice.holdedId)return {...base,stage:'incident',reason:'Figura enviado, pero falta el ID real de la proforma de Holded.'};
      if(age!=null&&age>=7)return {...base,stage:'overdue',reason:'La proforma lleva '+age+' días en Holded sin convertirse en factura.'};
      return {...base,stage:'sent',reason:'Proforma confirmada en Holded; todavía no se ha convertido en factura.'};
    }
    return {...base,stage:'pending',reason:'Borrador interno pendiente de revisar y enviar a Holded.'};
  });
  cases.forEach(item=>{
    if(invoices.some(invoice=>invoice.expediente===item.id))return;
    const cancellations=transports.filter(transport=>transport.expediente===item.id&&isCancelledTransport(transport));
    const ready=operationFlow(item).billingReady;
    if(!ready&&!cancellations.length&&item.estado!=='Cancelado')return;
    const cancellationReason=cancellations.map(transport=>transport.cancellation?.reason).filter(Boolean).join(' · ');
    billingControlRows.push({key:'case-'+item.id,caseItem:item,invoice:null,expediente:item.id,buque:item.buque||'Buque no indicado',cliente:item.cliente||'',amount:0,cost:caseExpenseTotal(item),age:null,stage:ready?'missing':'decision',reason:ready?'Expediente operativo completado sin documento de facturación.':'Servicio cancelado: '+(cancellationReason||'falta decidir si se factura algún gasto o se registra como no facturado.')});
  });
  billingControlRows.sort((left,right)=>numberFromCode(right.expediente)-numberFromCode(left.expediente));
  const attentionStages=new Set(['missing','decision','pending','blocked','incident','overdue','verify']);
  const controlAttention=billingControlRows.filter(row=>attentionStages.has(row.stage));
  const controlSent=billingControlRows.filter(row=>row.stage==='sent'||row.stage==='overdue');
  const controlConfirmed=billingControlRows.filter(row=>row.stage==='confirmed');
  const controlExcluded=billingControlRows.filter(row=>row.stage==='excluded');
  const billingControlBuckets=[
    ['attention','Requieren acción',controlAttention.length],
    ['sent','En Holded sin factura',controlSent.length],
    ['confirmed','Facturas confirmadas',controlConfirmed.length],
    ['excluded','No facturar justificados',controlExcluded.length],
    ['all','Todos los controlados',billingControlRows.length]
  ];
  const billingControlVisible=billingControlView==='attention'?controlAttention:billingControlView==='sent'?controlSent:billingControlView==='confirmed'?controlConfirmed:billingControlView==='excluded'?controlExcluded:billingControlRows;
  return <>
    <section className="panel"><SectionHeader title="Documentos de facturación" subtitle="Separa lo pendiente de lo enviado, facturado y archivado para cerrar el mes sin saltarte nada." action={<label className="billing-sort-control"><span>Ordenar por</span><select value={billingSort} onChange={event=>setBillingSort(event.target.value)}><option value="exp_desc">Expediente mayor → menor</option><option value="exp_asc">Expediente menor → mayor</option><option value="doc_desc">Documento mayor → menor</option><option value="doc_asc">Documento menor → mayor</option></select></label>}/><div className="billing-status-tabs">{billingBuckets.map(([value,label,count])=><button key={value} className={billingView===value?'active':''} onClick={()=>setBillingView(value)}>{label}<span>{count}</span></button>)}</div><div className="responsive-table billing-table"><div className="table-head"><span>Documento / expediente</span><span>Cliente</span><span>Concepto</span><span>Importe</span><span>Coste</span><span>Margen</span><span>Revisión Holded</span><span/></div>{sortedVisibleInvoices.length?sortedVisibleInvoices.map(item=>{const finalRevenue=invoiceFinalRevenue(item);const finalCost=invoiceCostOf(item);const finalMargin=finalRevenue-finalCost;return <div className="table-row" key={item.id}><span className="primary-cell"><span className="invoice-icon"><ReceiptText/></span><span><b>{item.id}</b><button onClick={()=>openCase(item.expediente)}>{item.expediente}</button>{item.holdedStatus&&<small>Holded: {item.holdedStatus}{item.holdedNumber?`  -  ${item.holdedNumber}`:''}</small>}</span></span><span data-label="Cliente">{item.cliente}</span><span data-label="Concepto" className="billing-concept-cell"><span>{item.concepto}</span>{!invoiceSentOrClosed(item)&&<div className={'billing-po-inline '+(isLimaniCase(relatedCaseForInvoice(item))&&!purchaseOrderOf(relatedCaseForInvoice(item))?'missing':'')}><label>PO / Purchase Order</label><div><input value={poDrafts[item.expediente]??purchaseOrderOf(relatedCaseForInvoice(item))} onChange={event=>setPoDrafts(current=>({...current,[item.expediente]:event.target.value.toUpperCase()}))} placeholder="Ej. POA604877"/><button className="button secondary compact" disabled={savingPurchaseOrder===item.expediente} onClick={()=>savePurchaseOrder(item)}>{savingPurchaseOrder===item.expediente?'Guardando…':'Guardar PO'}</button></div>{isLimaniCase(relatedCaseForInvoice(item))&&!purchaseOrderOf(relatedCaseForInvoice(item))&&<small>Obligatorio para enviar esta factura LIMANI a Holded.</small>}</div>}</span><strong data-label="Importe" className="billing-final-revenue">{moneyExact(finalRevenue)}{item.holdedBilledVerified===true&&<small>Importe final Holded</small>}</strong><span data-label="Coste" className="billing-cost">{moneyExact(finalCost)}</span><strong data-label="Margen" className={finalMargin<0?'billing-margin negative':'billing-margin'}>{moneyExact(finalMargin)}</strong><span data-label="Revisión Holded" className="billing-review-column">{['Facturado','Cobrado'].includes(item.estado)?<><HoldedBillingReview item={item} cost={finalCost} revenue={finalRevenue} margin={finalMargin}/><Badge>{item.estado}</Badge></>:<Badge>{item.estado}</Badge>}</span><span className="billing-row-actions"><button className="icon-button" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button>{canAdmin&&!invoiceSentOrClosed(item)&&item.estado!=='Archivado'&&<button className="icon-button danger" aria-label={'Registrar no facturar '+item.id} onClick={()=>archiveInvoice(item)} title="Registrar motivo para no facturar"><Archive/></button>}{item.holdedId&&['Enviado a Holded','Facturado','Cobrado'].includes(item.estado)?<button className="button secondary compact" disabled={Boolean(checkingHolded)} onClick={()=>verifyHoldedDocuments([item])}><RefreshCw className={checkingHolded===item.id?'spinning':''}/> {checkingHolded===item.id?'Comprobando…':'Comprobar'}</button>:!['Facturado','Cobrado','Archivado'].includes(item.estado)&&<button className="button secondary compact" disabled={sendingHolded===item.id} onClick={()=>sendHolded(item)}>{sendingHolded===item.id?'Enviando…':'Enviar a Holded'}</button>}</span></div>}):<Empty text={billingView==='pending'?'No hay facturas pendientes en este filtro.':'No hay documentos en este estado.'}/>}</div></section>
    <section className="billing-flow-panel panel"><SectionHeader title="Flujo de facturación" subtitle="Control interno antes de crear la proforma real en Holded"/><div className="billing-flow-steps">{groupedStatus.map((status,index)=><span key={status}><b>{index+1}</b><small>{status}</small></span>)}</div><div className="billing-rules"><div><b>Se puede modificar aquí</b><small>Cliente, PO / Purchase Order, concepto, importe, estado y vencimiento.</small></div><div><b>No se modifica aquí</b><small>Buque, mercancía, POD y evidencias: se corrigen desde Expediente.</small></div></div></section>
    <section className="billing-flow-panel panel"><SectionHeader title="Doble verificación con Holded" subtitle="La app consulta el estado real de proformas, facturas y cobros al abrir Facturación." action={<button className="button secondary" disabled={Boolean(checkingHolded)||!holdedCheckInvoices.length} onClick={()=>verifyHoldedDocuments(holdedCheckInvoices)}><RefreshCw className={checkingHolded?'spinning':''}/> {checkingHolded?'Comprobando…':'Comprobar ahora'}</button>}/><div className="billing-rules"><div><b>Primera confirmación</b><small>Al crear la proforma se guarda su ID real de Holded.</small></div><div><b>Segunda confirmación</b><small>Holded confirma la factura y su importe final; la revisión queda visible junto a gastos y margen.</small></div></div></section>
    <section className="panel billing-control-panel"><SectionHeader title="Control de cierre y conciliación" subtitle="Cruza cada expediente con su borrador, la proforma real de Holded, la factura y el importe final." action={<button className="button secondary" disabled={Boolean(checkingHolded)||!holdedCheckInvoices.length} onClick={()=>verifyHoldedDocuments(holdedCheckInvoices)}><RefreshCw className={checkingHolded?'spinning':''}/> Conciliar con Holded</button>}/><div className={'billing-control-summary '+(controlAttention.length?'attention':'clear')}><span>{controlAttention.length?<CircleAlert/>:<ShieldCheck/>}</span><div><b>{controlAttention.length?controlAttention.length+' expediente'+(controlAttention.length===1?' requiere':'s requieren')+' revisión':'Cierre de facturación al día'}</b><small>{controlAttention.length?'Nada se oculta: abre cada incidencia, factura o registra el motivo por el que no corresponde facturar.':'Todos los expedientes revisados tienen una salida documentada.'}</small></div></div><div className="billing-control-kpis">{billingControlBuckets.map(([value,label,count])=><button key={value} className={billingControlView===value?'active':''} onClick={()=>setBillingControlView(value)}><strong>{count}</strong><span>{label}</span></button>)}</div><div className="billing-control-list">{billingControlVisible.length?billingControlVisible.map(row=>{const meta=billingControlMeta[row.stage]||billingControlMeta.incident;const canExclude=canAdmin&&((row.invoice&&!invoiceSentOrClosed(row.invoice)&&row.invoice.estado!=='Archivado')||(!row.invoice&&['missing','decision'].includes(row.stage)));return <article className={'billing-control-row '+meta.tone} key={row.key}><span className="billing-control-status">{row.stage==='confirmed'?<CheckCircle2/>:row.stage==='excluded'?<Archive/>:row.stage==='sent'?<RefreshCw/>:<CircleAlert/>}<b>{meta.label}</b></span><div className="billing-control-identity"><b>{row.expediente} · {row.buque}</b><small>{row.cliente||'Cliente no indicado'}</small></div><div className="billing-control-reason"><span>{row.reason}</span>{row.age!=null&&['sent','overdue','verify'].includes(row.stage)&&<small>Antigüedad en Holded: {row.age} día{row.age===1?'':'s'}</small>}{row.invoice?.billingExceptionBy&&<small>Decidido por {row.invoice.billingExceptionBy}</small>}</div><div className="billing-control-money"><span><small>IMPORTE</small><b>{moneyExact(row.amount)}</b></span><span><small>GASTOS</small><b>{moneyExact(row.cost)}</b></span></div><div className="billing-control-actions">{row.caseItem&&<button className="button tertiary compact" onClick={()=>openCase(row.expediente)}>Expediente</button>}{!row.invoice&&<button className="button primary compact" onClick={()=>createDraft(row.caseItem)}>Preparar borrador</button>}{row.invoice&&row.invoice.estado!=='Archivado'&&!invoiceSentOrClosed(row.invoice)&&<button className="button secondary compact" onClick={()=>setEditing(row.invoice)}>Revisar borrador</button>}{row.invoice?.holdedId&&['sent','overdue','verify','incident'].includes(row.stage)&&<button className="button secondary compact" disabled={Boolean(checkingHolded)} onClick={()=>verifyHoldedDocuments([row.invoice])}><RefreshCw className={checkingHolded===row.invoice.id?'spinning':''}/> Comprobar</button>}{canExclude&&<button className="button tertiary danger compact" onClick={()=>row.invoice?archiveInvoice(row.invoice):archiveReadyCase(row.caseItem)}><Archive/> No facturar</button>}{canAdmin&&row.invoice?.estado==='Archivado'&&<button className="button tertiary compact" onClick={()=>archiveInvoice(row.invoice)}><PencilLine/> {row.invoice.billingExceptionReason?'Editar motivo':'Añadir motivo'}</button>}</div></article>}):<Empty text={billingControlView==='attention'?'No hay expedientes olvidados ni incidencias pendientes.':'No hay expedientes en esta categoría.'}/>}</div></section>
    {holdedConfirmedInvoices.length>0&&<section className="panel holded-confirmation-panel"><SectionHeader title="Facturas confirmadas por Holded" subtitle="Check real de facturación y comparación del importe enviado con el importe final."/><div className="holded-confirmation-list">{holdedConfirmedInvoices.map(item=><article className={`holded-confirmation-card ${item.holdedPriceVerified?(item.holdedPriceMatches?'match':'changed'):'pending'}`} key={item.id}><span className="holded-confirmation-check"><CheckCircle2/></span><div className="holded-confirmation-document"><b>{item.holdedInvoiceNumber||item.holdedNumber||'Factura Holded'}</b><small>{item.id} · {item.expediente}</small></div><div className="holded-confirmation-price"><small>ANTES DE FACTURAR</small><b>{moneyExact(Number(item.holdedSentAmount??invoiceRevenue(item)))}</b></div><div className="holded-confirmation-price"><small>FACTURADO EN HOLDED</small><b>{item.holdedPriceVerified?moneyExact(Number(item.holdedInvoicedAmount)):'Pendiente de lectura'}</b></div><strong className="holded-confirmation-result">{item.holdedPriceVerified?(item.holdedPriceMatches?<><CheckCircle2/> Sin cambios</>:`Diferencia ${Number(item.holdedPriceDifference)>0?'+':''}${moneyExact(Number(item.holdedPriceDifference))}`):'Precio por confirmar'}</strong></article>)}</div></section>}
    {readyCases.length>0&&<section className="billing-ready-panel panel"><SectionHeader title="Listos para facturar" subtitle="Se crearán automáticamente con líneas habituales de operativa"/><div className="billing-ready-list">{readyCases.map(item=><article key={item.id} className="billing-ready-card"><span className="invoice-icon"><CheckCircle2/></span><div><b>{caseLabel(item)}</b><small>{item.cliente}  -  {item.puerto}  -  {item.estado==='Cancelado'?'cancelación con gastos facturables':isStorageOnly(item)?'salida/recogida verificada':'POD verificado'}</small><em>{invoiceCargoSummary(item,warehouseEntries)}  -  gastos {moneyExact(caseExpenseTotal(item))}  -  margen sugerido {moneyExact(suggestedTransportPrice(item,warehouseEntries)-caseExpenseTotal(item))}</em></div><div className="billing-ready-actions"><button className="button tertiary" onClick={()=>openCase(item.id)}>Ver expediente</button>{canAdmin&&<button className="button secondary danger compact" onClick={()=>archiveReadyCase(item)}><Archive/> No facturar</button>}<button className="button primary" onClick={()=>createDraft(item)}>Revisar borrador</button></div></article>)}</div></section>}
    {notReadyInvoices.length>0&&<section className="billing-hold-panel panel"><SectionHeader title="No listos / revisar" subtitle="Borradores guardados de expedientes que aún no están cerrados al 100%. No entran en el importe pendiente."/><div className="billing-ready-list">{notReadyInvoices.map(item=>{const related=relatedCaseForInvoice(item);return <article key={item.id} className="billing-ready-card warning"><span className="invoice-icon"><CircleAlert/></span><div><b>{item.expediente}  -  {related?.buque||item.buque||'BUQUE PENDIENTE'}</b><small>{item.cliente}  -  progreso {related?operationProgress(related):0}%  -  {related?.siguiente||'Expediente pendiente de completar'}</small><em>Este borrador queda reservado, pero no se considera listo para enviar.</em></div><div className="billing-ready-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button secondary" onClick={()=>setEditing(item)}>Editar borrador</button>{canAdmin&&<button className="button secondary danger compact" onClick={()=>archiveInvoice(item)}><Archive/> No facturar</button>}</div></article>})}</div></section>}
    <section className="billing-hero"><div><span>Importe pendiente de gestión</span><strong>{money(total)}</strong><small>{activeInvoices.length} pendientes/enviados sin cerrar · facturados {invoicedInvoices.length} · costes {moneyExact(totalCosts)} · margen {moneyExact(total-totalCosts)}</small></div><div><span className="holded-mark">H</span><div><b>Holded conectado</b><small>El botón crea una proforma real. La factura final se hará cuando confirmemos el flujo.</small></div></div><button className="button primary" onClick={()=>notify('Holded listo: revisa un borrador y pulsa Enviar a Holded.')}><Download/> Proformas reales</button></section>
    {editing&&<InvoiceModalBoundary key={invoiceText(editing.id)} close={()=>setEditing(null)}><InvoiceEditModal item={editing} cases={cases} warehouseEntries={warehouseEntries} transports={transports} calendarEvents={calendarEvents} clients={clients} close={()=>setEditing(null)} submit={item=>{const related=cases.find(entry=>entry.id===item.expediente);const context=related||item;updateInvoice({...item,purchaseOrder:purchaseOrderOf(context),concepto:withPurchaseOrderSuffix(item.concepto,context),lines:ensurePurchaseOrderReferenceLines(item.lines,context)});setEditing(null)}} simulateHolded={item=>{sendHolded(item);setEditing(null)}}/></InvoiceModalBoundary>}
    {archiveCandidate&&<BillingExceptionModal item={archiveCandidate} close={()=>setArchiveCandidate(null)} submit={saveBillingException}/>}
  </>;
}
const MAIL_STATUS={review:'Pendiente',processed:'Procesado',ignored:'Descartado',error:'Error'};
const MAIL_SERVICE_LABELS={reception:'RECEPCIÓN',pickup:'RECOGIDA',delivery:'ENTREGA',reception_and_delivery:'RECEPCIÓN + ENTREGA',customs:'ADUANAS',other:'OTRO SERVICIO',none:'SIN SERVICIO'};
function Correos({csrfToken,notify,openCase,cases=[]}){
  const [items,setItems]=useState([]);
  const [counts,setCounts]=useState({review:0,processed:0,ignored:0,error:0,linked:0,unlinked:0,total:0});
  const [mailboxCounts,setMailboxCounts]=useState({info:0,operations:0});
  const [lastRun,setLastRun]=useState(null);
  const [statusFilter,setStatusFilter]=useState('all');
  const [mailboxFilter,setMailboxFilter]=useState('all');
  const [linkFilter,setLinkFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [draftLinks,setDraftLinks]=useState({});
  const [loading,setLoading]=useState(true);
  const [processing,setProcessing]=useState(false);
  const [busyId,setBusyId]=useState(0);
  const [error,setError]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    try{
      const params=new URLSearchParams({status:statusFilter,mailbox:mailboxFilter,link:linkFilter});
      const result=await api('/api/mail/inbox.php?'+params.toString());
      const nextItems=[...(result.items||[])].sort(newestMailFirst);
      setItems(nextItems);
      setCounts(result.counts||{});
      setMailboxCounts(result.mailboxCounts||{});
      setLastRun(result.lastRun);
      setDraftLinks(Object.fromEntries(nextItems.map(item=>[item.id,item.case_ref||''])));
    }catch(reason){setError(reason.message)}
    finally{setLoading(false)}
  };
  useEffect(()=>{load()},[statusFilter,mailboxFilter,linkFilter]);
  const sync=async()=>{
    setProcessing(true);setError('');
    try{
      const result=await api('/api/mail/process.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:'{}'});
      const summary=result.summary||{};
      notify(`${Number(summary.scanned||0)} correos nuevos recibidos · ${Number(summary.review||0)} pendientes de vincular · ningún expediente creado automáticamente`);
      await load();
    }catch(reason){setError(reason.message)}
    finally{setProcessing(false)}
  };
  const linkMail=async(item,unlink=false)=>{
    const caseRef=unlink?'':String(draftLinks[item.id]||'').trim();
    if(!unlink&&!caseRef){setError('Selecciona un expediente antes de vincular el correo.');return}
    setBusyId(item.id);setError('');
    try{
      await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({id:item.id,action:unlink?'unlink':'link',caseRef})});
      notify(unlink?'Correo desvinculado':`Correo vinculado a ${caseRef}`);
      await load();
    }catch(reason){setError(reason.message)}
    finally{setBusyId(0)}
  };
  const visibleItems=items.filter(item=>[item.subject,item.sender_name,item.sender_email,item.body,item.case_ref].join(' ').toLowerCase().includes(search.toLowerCase())).sort(newestMailFirst);
  const mailboxLabel=value=>String(value||'').toLowerCase().includes('operations@')?'operations@':String(value||'').toLowerCase().includes('info@')?'info@':String(value||'').split('@')[0]||'Buzón';
  const sortedCases=[...cases].sort(newestFirst);
  return <><section className="mail-automation-hero"><div><Mail/><span><b>Bandeja conjunta de operaciones</b><small>Lee operations@ e info@. Los correos se vinculan manualmente y nunca crean expedientes.</small></span></div><div><small>Última sincronización</small><b>{lastRun?.finished_at?formatReceptionDate(lastRun.finished_at):'Todavía no ejecutada'}</b></div><div className="mail-hero-actions"><button className="button primary" disabled={processing} onClick={sync}><RefreshCw className={processing?'spinning':''}/>{processing?'Leyendo buzones…':'Sincronizar ahora'}</button></div></section>{error&&<div className="form-error"><CircleAlert/>{error}</div>}<section className="panel mail-inbox-panel"><SectionHeader title="Bandeja de entrada" subtitle="Más recientes primero · un expediente puede tener tantos correos vinculados como necesite"/><div className="mail-filter-groups"><div className="mail-filters">{[['all','Todos los buzones',Number(counts.total||0)],['operations','operations@',Number(mailboxCounts.operations||0)],['info','info@',Number(mailboxCounts.info||0)]].map(([value,label,total])=><button key={value} className={mailboxFilter===value?'active':''} onClick={()=>setMailboxFilter(value)}>{label}<span>{total}</span></button>)}</div><div className="mail-filters">{[['all','Todos',Number(counts.total||0)],['unlinked','Sin vincular',Number(counts.unlinked||0)],['linked','Vinculados',Number(counts.linked||0)]].map(([value,label,total])=><button key={value} className={linkFilter===value?'active':''} onClick={()=>setLinkFilter(value)}>{label}<span>{total}</span></button>)}</div></div><div className="mail-inbox-toolbar"><label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar remitente, asunto, texto o expediente…"/></label><label><span>ESTADO DEL CORREO</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">Todos</option><option value="review">Pendientes</option><option value="processed">Procesados</option><option value="ignored">Descartados</option><option value="error">Con error</option></select></label></div>{loading?<div className="users-loading">Cargando correos…</div>:visibleItems.length?<div className="mail-list">{visibleItems.map(item=>{const selectedRef=draftLinks[item.id]??item.case_ref??'';return <article key={item.id} className={'mail-item '+item.status+(item.case_ref?' linked':'')}><header><div><span className="mail-source">{mailboxLabel(item.mailbox)}</span><b>{item.subject||'Sin asunto'}</b><small>{item.sender_name||item.sender_email} · {item.sender_email} · {formatReceptionDate(item.received_at)}</small></div><Badge>{item.case_ref?`Vinculado · ${item.case_ref}`:MAIL_STATUS[item.status]||item.status}</Badge></header>{item.extracted&&<div className="mail-extracted"><span><small>BUQUE</small><b>{item.extracted.vessel||'—'}</b></span><span><small>ETA / ETB</small><b>{[item.extracted.etb||item.extracted.eta,item.extracted.etb_time||item.extracted.eta_time].filter(Boolean).join(' · ')||'POR CONFIRMAR'}</b></span><span><small>PUERTO</small><b>{item.extracted.port||'POR CONFIRMAR'}</b></span><span><small>MERCANCÍA / SERVICIO</small><b>{item.extracted.cargo_summary||MAIL_SERVICE_LABELS[item.extracted.service_kind]||'—'}</b></span></div>}{item.review_reason&&<p className="mail-reason"><CircleAlert/>{item.review_reason}</p>}{item.error_message&&<p className="mail-reason error"><CircleAlert/>{item.error_message}</p>}<div className="mail-linker"><label><span>VINCULAR A EXPEDIENTE</span><select value={selectedRef} onChange={event=>setDraftLinks(current=>({...current,[item.id]:event.target.value}))}><option value="">Seleccionar expediente…</option>{sortedCases.map(caseItem=><option key={caseItem.id} value={caseItem.id}>{caseItem.id} · {caseItem.buque} · {caseItem.cliente}</option>)}</select></label><button className="button primary" disabled={!selectedRef||busyId===item.id} onClick={()=>linkMail(item)}><FolderKanban/>{busyId===item.id?'Guardando…':item.case_ref?'Cambiar vínculo':'Vincular'}</button>{item.case_ref&&<><button className="button secondary" onClick={()=>openCase(item.case_ref)}>Abrir {item.case_ref}</button><button className="button tertiary" disabled={busyId===item.id} onClick={()=>linkMail(item,true)}>Desvincular</button></>}</div><details className="mail-original"><summary>Ver correo completo</summary><pre>{item.body}</pre></details></article>})}</div>:<Empty text="No hay correos que coincidan con estos filtros."/>}</section></>;
}
const AUDIT_LABELS={
  'auth.login':'Inicio de sesión',
  'auth.logout':'Cierre de sesión',
  'auth.initial_admin_created':'Administrador inicial creado',
  'users.create':'Usuario creado',
  'users.roles_update':'Roles actualizados',
  'clients.create':'Cliente creado',
  'finance.update':'Facturación actualizada',
  'holded.proform.create':'Proforma enviada a Holded',
  'attachment.upload':'Archivo subido',
  'case.attachment.link':'Archivo vinculado al expediente',
  'operational.update':'Operativa actualizada',
  'case.create':'Expediente creado',
  'case.update':'Expediente editado',
  'case.delete':'Expediente borrado',
  'warehouse.create':'Entrada de almacén creada',
  'warehouse.update':'Entrada de almacén editada',
  'warehouse.delete':'Entrada de almacén eliminada',
  'calendar.update':'Calendario/transporte editado',
  'calendar.delete':'Servicio de calendario eliminado',
  'step.complete':'Paso operativo completado',
  'step.reopen':'Paso operativo reabierto'
};
const auditLabel=action=>AUDIT_LABELS[action]||String(action||'Movimiento');
const rawAuditDetailsText=details=>{
  if(!details||typeof details!=='object')return '—';
  const entries=Object.entries(details).filter(([,value])=>value!==''&&value!==null&&value!==undefined);
  if(!entries.length)return '—';
  return entries.map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(', '):typeof value==='object'?JSON.stringify(value):value}`).join(' · ');
};
const cleanAuditValue=value=>Array.isArray(value)?value.filter(Boolean).join(', '):typeof value==='object'&&value?JSON.stringify(value):String(value??'').trim();
const auditJoin=(parts=[])=>parts.filter(Boolean).join(' - ');
const auditDetailsText=(details,action='')=>{
  if(!details||typeof details!=='object'){
    if(action==='auth.login')return 'Entro en la aplicacion';
    if(action==='auth.logout')return 'Cerro sesion';
    if(action==='operational.update')return 'Sincronizacion general de datos operativos';
    if(action==='finance.update')return 'Guardo cambios en facturacion';
    return 'Sin detalle guardado';
  }
  const caseText=details.caseRef?`Expediente ${details.caseRef}`:'';
  const vesselText=details.vessel?`Buque ${details.vessel}`:'';
  const routeText=details.route?`Ruta ${details.route}`:'';
  const scheduleText=auditJoin([details.date&&`Fecha ${details.date}`,details.start&&`Inicio ${details.start}`,details.end&&`Fin ${details.end}`]);
  if(action==='case.create')return auditJoin([`Creo ${caseText||'expediente'}`,vesselText,details.client&&`Cliente ${details.client}`,details.port&&`Puerto ${details.port}`,details.purchaseOrder&&`PO ${details.purchaseOrder}`,details.serviceType&&`Tipo ${details.serviceType}`,details.transportCreated!==undefined&&`Transporte ${details.transportCreated?'creado':'no creado'}`]);
  if(action==='case.update')return auditJoin([`Edito ${caseText||'expediente'}`,vesselText,details.client&&`Cliente ${details.client}`,details.port&&`Puerto ${details.port}`,details.purchaseOrder&&`PO ${details.purchaseOrder}`,details.eta&&`ETA ${details.eta}`,details.etb&&`ETB ${details.etb}`,details.etd&&`ETD ${details.etd}`]);
  if(action==='case.delete')return auditJoin([`Borro ${caseText||'expediente'}`,vesselText,details.client&&`Cliente ${details.client}`,details.port&&`Puerto ${details.port}`,details.linkedWarehouse!==undefined&&`Mercancias desvinculadas ${details.linkedWarehouse}`,details.linkedTransports!==undefined&&`Transportes eliminados ${details.linkedTransports}`]);
  if(action==='calendar.update')return auditJoin([`Actualizo transporte ${details.transportId||''}`.trim(),caseText,details.service&&`Servicio ${details.service}`,routeText,scheduleText,details.driver&&`Conductor ${details.driver}`,details.provider&&`Proveedor ${details.provider}`,details.note&&`Obs. ${details.note}`]);
  if(action==='calendar.delete')return auditJoin([`Elimino servicio ${details.transportId||''}`.trim(),caseText,vesselText,details.service&&`Servicio ${details.service}`,scheduleText]);
  if(action==='warehouse.create')return auditJoin([`Registro entrada ${details.warehouseRef||''}`.trim(),caseText,vesselText,details.packages&&`${details.packages} bultos`,details.weight&&`${details.weight}`,details.zone&&`Zona ${details.zone}`,details.photos!==undefined&&`${details.photos} fotos`,details.documents!==undefined&&`${details.documents} documentos`]);
  if(action==='warehouse.update')return auditJoin([`Edito almacen ${details.warehouseRef||''}`.trim(),caseText,vesselText,details.packages&&`${details.packages} bultos`,details.weight&&`${details.weight}`]);
  if(action==='warehouse.delete')return auditJoin([`Elimino almacen ${details.warehouseRef||''}`.trim(),caseText,vesselText,details.packages&&`${details.packages} bultos`,details.weight&&`${details.weight}`]);
  if(action==='step.complete')return auditJoin([`Completo paso ${details.title||details.step||''}`.trim(),caseText,vesselText,details.readyForBilling&&'Listo para facturar',details.podException&&'POD no sellado justificado']);
  if(action==='step.reopen')return auditJoin([`Reabrio paso ${details.title||details.step||''}`.trim(),caseText,vesselText,details.method==='undo'?'Vuelta atras':'Reapertura manual']);
  if(action==='attachment.upload')return auditJoin([`Subio archivo ${details.id||''}`.trim(),details.category&&`Categoria ${details.category}`]);
  if(action==='case.attachment.link')return auditJoin([`Vinculo ${details.files||0} archivo(s) al expediente`,caseText,vesselText,details.category&&`Categoria ${details.category}`]);
  if(action==='holded.proform.create')return auditJoin(['Envio proforma a Holded',caseText,details.clientName&&`Cliente ${details.clientName}`,details.total!==undefined&&`Total ${details.total} EUR`,details.holdedId&&`Holded ${details.holdedId}`]);
  if(action==='users.create')return auditJoin([`Creo usuario ${details.created_user_id||''}`.trim(),details.roles&&`Roles ${cleanAuditValue(details.roles)}`]);
  if(action==='users.roles_update')return auditJoin([`Actualizo roles del usuario ${details.updated_user_id||''}`.trim(),details.roles&&`Roles ${cleanAuditValue(details.roles)}`]);
  if(action==='clients.create')return 'Creo o importo ficha de cliente';
  if(action?.startsWith('mail.'))return auditJoin(['Correo procesado',details.mailId&&`Mail ${details.mailId}`,caseText,details.status&&`Estado ${details.status}`]);
  if(action?.startsWith('ais.'))return auditJoin(['Seguimiento AIS',caseText,details.mmsi&&`MMSI ${details.mmsi}`]);
  const entries=Object.entries(details).filter(([,value])=>value!==''&&value!==null&&value!==undefined);
  if(!entries.length)return action==='operational.update'?'Sincronizacion general de datos operativos':'Sin detalle guardado';
  return entries.map(([key,value])=>`${key}: ${cleanAuditValue(value)}`).join(' - ');
};
function Auditoria({notify}){
  const [items,setItems]=useState([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=()=>{
    setLoading(true);setError('');
    api('/api/admin/audit.php?limit=300').then(result=>setItems(result.items||[])).catch(reason=>{setError(reason.message);notify(reason.message)}).finally(()=>setLoading(false));
  };
  useEffect(load,[]);
  const visible=items.filter(item=>{
    const haystack=[item.userName,item.email,item.action,auditLabel(item.action),auditDetailsText(item.details,item.action),item.ipAddress,item.createdAt].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const important=visible.filter(item=>!/operational\.update/.test(item.action)).length;
  return <section className="panel audit-panel">
    <SectionHeader title="Registro de actividad" subtitle="Solo administradores: entradas, borrados, cambios, archivos, facturación y accesos" action={<button className="button secondary" onClick={load} disabled={loading}>{loading?<RefreshCw className="spin"/>:<RefreshCw/>} Actualizar</button>}/>
    <div className="audit-toolbar"><label className="search-box standalone"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar usuario, acción, expediente, IP o detalle…"/></label><div className="audit-kpis"><span><b>{visible.length}</b><small>movimientos</small></span><span><b>{important}</b><small>relevantes</small></span></div></div>
    {error&&<div className="form-error"><CircleAlert/>{error}</div>}
    {loading?<div className="users-loading">Cargando auditoría…</div>:<div className="audit-table">
      <div className="audit-head"><span>Fecha</span><span>Usuario</span><span>Acción</span><span>Detalle</span><span>IP</span></div>
      {visible.map(item=><article className="audit-row" key={item.id}>
        <time>{item.createdAt?new Date(item.createdAt.replace(' ','T')).toLocaleString('es-ES'):'—'}</time>
        <span><b>{item.userName}</b><small>{item.email||'Sistema'}</small></span>
        <span><Badge tone={/delete|borr|ignore|error|logout/.test(item.action)?'danger':/create|upload|login|complete/.test(item.action)?'success':'info'}>{auditLabel(item.action)}</Badge><small>{item.action}</small></span>
        <p>{auditDetailsText(item.details,item.action)}</p>
        <code>{item.ipAddress}</code>
      </article>)}
      {!visible.length&&<Empty text="No hay movimientos con ese filtro."/>}
    </div>}
  </section>;
}
function Usuarios({csrfToken,notify,onPreview,onUsersChanged}){
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [form,setForm]=useState({fullName:'',email:'',password:'',roles:['operations']});const [busy,setBusy]=useState(false);
  const load=()=>{setLoading(true);api('/api/admin/users.php').then(result=>setUsers(result.users)).catch(reason=>setError(reason.message)).finally(()=>setLoading(false))};
  useEffect(load,[]);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const toggleUserRole=async(item,role)=>{
    const current=rolesOf(item);
    const roles=current.includes(role)?current.filter(value=>value!==role):[...current,role];
    if(!roles.length){setError('Cada usuario debe conservar al menos un rol.');return}
    setError('');
    try{
      await api('/api/admin/users.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:jsonBody({id:item.id,roles})});
      setUsers(users.map(user=>user.id===item.id?{...user,roles,role:primaryRole(roles)}:user));
      notify(`Permisos de ${item.fullName} actualizados`);
      onUsersChanged();
    }catch(reason){setError(reason.message)}
  };
  const toggleFormRole=role=>setForm(current=>{const roles=current.roles.includes(role)?current.roles.filter(value=>value!==role):[...current.roles,role];return {...current,roles:roles.length?roles:current.roles}});
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{await api('/api/admin/users.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:jsonBody(form)});setForm({fullName:'',email:'',password:'',roles:['operations']});notify('Usuario creado correctamente');load();onUsersChanged()}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  const RoleChecks=({roles,toggle})=><div className="multi-role-selector">{Object.entries(ROLE_LABELS).map(([value,label])=><label className={roles.includes(value)?'checked':''} key={value}><input type="checkbox" checked={roles.includes(value)} onChange={()=>toggle(value)}/><CheckCircle2/><span><b>{label}</b><small>{value==='driver'?'Calendario, almacén y entregas':value==='operations'?'Expedientes, correos y planificación':value==='finance'?'Importes, tarifas y facturación':'Control total y usuarios'}</small></span></label>)}</div>;
  return <div className="users-layout">
    <section className="panel"><SectionHeader title="Equipo con acceso" subtitle="Una persona puede combinar varios roles y permisos"/>{error&&<div className="form-error users-error"><CircleAlert/>{error}</div>}{loading?<div className="users-loading">Cargando usuarios…</div>:<div className="user-list">{users.map(item=><article key={item.id}><div className="avatar">{initials(item.fullName)}</div><div className="user-identity"><b>{item.fullName}</b><small>{item.email}</small><em>{roleLabel(item)}</em></div><RoleChecks roles={rolesOf(item)} toggle={role=>toggleUserRole(item,role)}/><button className="button tertiary preview-user" onClick={()=>onPreview(item)}><Eye/> Ver como</button></article>)}</div>}</section>
    <section className="panel create-user"><SectionHeader title="Añadir usuario" subtitle="Selecciona uno o varios roles"/><form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required/></label><label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña temporal</span><input name="password" type="password" minLength="4" value={form.password} onChange={update} required/></label><div className="field"><span>Roles y permisos</span><RoleChecks roles={form.roles} toggle={toggleFormRole}/></div><button className="button primary full" disabled={busy}><UserPlus/>{busy?'Creando…':'Crear usuario'}</button></form></section>
  </div>;
}
function CaseEditModal({item,close,submit,vessels=[],clientOptions=[]}){
  const call=item.portCall||{};
  const legacyEta=String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0]||'';
  const [form,setForm]=useState({...item,serviceType:serviceTypeOf(item),imo:item.imo||'',mmsi:item.mmsi||'',purchaseOrder:item.purchaseOrder||'',servicios:(item.servicios||[]).join(', '),etaDate:call.etaDate||legacyEta,etaTime:call.etaTime||'',etbDate:call.etbDate||'',etbTime:call.etbTime||'',etdDate:call.etdDate||'',etdTime:call.etdTime||''});
  const selectableClients=[...new Set([form.cliente,...(clientOptions.length?clientOptions:clientNames)])].filter(Boolean);
  const update=event=>{
    const {name,value}=event.target;
    if(name==='buque'){
      const known=findKnownVessel(vessels,value);
      setForm({...form,buque:value.toUpperCase(),imo:known?.imo||form.imo,mmsi:known?.mmsi||form.mmsi});
      return;
    }
    setForm({...form,[name]:value});
  };
  const save=event=>{
    event.preventDefault();
    const mmsi=String(form.mmsi||'').replace(/\D/g,'');
    if(mmsi&&mmsi.length!==9)return;
    submit({...item,...form,imo:String(form.imo||'').replace(/\D/g,''),mmsi,purchaseOrder:String(form.purchaseOrder||'').trim().toUpperCase(),eta:form.etaDate||'Por confirmar',portCall:{etaDate:form.etaDate,etaTime:form.etaTime,etbDate:form.etbDate,etbTime:form.etbTime,etdDate:form.etdDate,etdTime:form.etdTime,updatedAt:new Date().toISOString()},bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)});
  };
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios y actualizarán la ficha del buque.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><div className="service-type-selector wide">{SERVICE_TYPES.map(type=><label key={type.value} className={form.serviceType===type.value?'active':''}><input type="radio" name="serviceType" value={type.value} checked={form.serviceType===type.value} onChange={update}/><span><b>{type.label}</b><small>{type.hint}</small></span></label>)}</div><label className="field"><span>Buque / referencia</span><input name="buque" list="known-vessels-edit" value={form.buque} onChange={update} required/><datalist id="known-vessels-edit">{vessels.map(vessel=><option key={vessel.id||vessel.name} value={vessel.name}>{[vessel.imo&&`IMO ${vessel.imo}`,vessel.mmsi&&`MMSI ${vessel.mmsi}`].filter(Boolean).join('  -  ')}</option>)}</datalist></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{selectableClients.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>PO / Purchase Order</span><input name="purchaseOrder" value={form.purchaseOrder||''} onChange={update} placeholder="Ej. POA604877"/></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="7 dígitos"/></label><label className="field"><span>MMSI para seguimiento AIS</span><input name="mmsi" inputMode="numeric" pattern="\d{9}" maxLength="9" value={form.mmsi} onChange={update} placeholder="9 dígitos"/></label><div className="vessel-memory-hint wide"><Ship/><span><b>Ficha de buque</b><small>Al guardar, Swiftport recordará este IMO/MMSI para futuras escalas del mismo buque.</small></span></div><label className="field"><span>ETA  -  fecha</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA  -  hora</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB  -  fecha</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/></label><label className="field"><span>ETB  -  hora</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD  -  fecha</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD  -  hora</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','En curso','Completado','Cancelado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}
function LegacyCaseEditModal({item,close,submit}){
  const call=item.portCall||{};
  const legacyEta=String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0]||'';
  const [form,setForm]=useState({...item,servicios:item.servicios.join(', '),etaDate:call.etaDate||legacyEta,etaTime:call.etaTime||'',etbDate:call.etbDate||'',etbTime:call.etbTime||'',etdDate:call.etdDate||'',etdTime:call.etdTime||''});
  const selectableClients=[...new Set([form.cliente,...clientNames])].filter(Boolean);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();submit({...item,...form,eta:form.etaDate||'Por confirmar',portCall:{etaDate:form.etaDate,etaTime:form.etaTime,etbDate:form.etbDate,etbTime:form.etbTime,etdDate:form.etdDate,etdTime:form.etdTime,updatedAt:new Date().toISOString()},bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Buque</span><input name="buque" value={form.buque} onChange={update} required/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{selectableClients.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>PO / Purchase Order</span><input name="purchaseOrder" value={form.purchaseOrder||''} onChange={update} placeholder="Ej. POA604877"/></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>ETA  -  fecha</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA  -  hora</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB  -  fecha</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/></label><label className="field"><span>ETB  -  hora</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD  -  fecha</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD  -  hora</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','En curso','Completado','Cancelado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}
function TransportEditModal({item,team,providers,close,submit}){
  const initialRoute=routeParts(item);
  const prior=item.cancellation||{};
  const [form,setForm]=useState({...item,...initialRoute,fecha:item.fecha||new Date().toISOString().slice(0,10),inicio:item.inicio||'09:00',fin:item.fin||'10:00',cancellationReason:prior.reason||'',cancellationNotes:prior.notes||'',cancellationExpense:prior.expenseAmount??'',cancellationProvider:prior.expenseProvider||'',cancellationBillable:Boolean(prior.billableToClient)});
  const update=event=>setForm({...form,[event.target.name]:event.target.type==='checkbox'?event.target.checked:event.target.value});
  const cancelled=form.estado==='Cancelado';
  const save=event=>{
    event.preventDefault();
    const estado=cancelled?'Cancelado':form.conductor==='Sin asignar'?'Sin asignar':form.estado==='Sin asignar'?'Asignado':form.estado;
    const cancellation=cancelled?{...prior,reason:form.cancellationReason,notes:form.cancellationNotes,expenseAmount:Number(form.cancellationExpense)||0,expenseProvider:form.cancellationProvider,billableToClient:Boolean(form.cancellationBillable)}:null;
    submit({...form,ruta:form.origen.trim()+' → '+form.destino.trim(),estado,cancellation});
  };
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal transport-edit-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>{cancelled?'Cancelar servicio':'Editar recorrido'}</h2><p>{cancelled?'Quedará fuera del calendario de choferes, pero seguirá visible en el expediente.':'Indica libremente dónde se recoge y dónde se entrega.'}</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Lugar de recogida</span><input name="origen" value={form.origen} onChange={update} placeholder="Ej. ALMACÉN SWIFTPORT, TECHNYMON, AEROPUERTO…" required/></label><label className="field wide"><span>Lugar de entrega</span><input name="destino" value={form.destino} onChange={update} placeholder="Ej. BUQUE, ALMACÉN, EMPRESA X (BILBAO)…" required/></label><div className="route-preview wide"><MapPin/><span><small>RECORRIDO</small><b>{form.origen||'ORIGEN'} → {form.destino||'DESTINO'}</b></span></div><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Hora inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update}/></label><label className="field"><span>Hora fin</span><input name="fin" type="time" value={form.fin} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update} disabled={isCancelledTransport(item)}>{['Sin asignar','Asignado','En ruta','Entregado','Cancelado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Conductor</span><select name="conductor" value={form.conductor} onChange={update} disabled={cancelled}><option>Sin asignar</option>{team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver')).map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Proveedor</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Vehículo / matrícula</span><input name="vehiculo" value={form.vehiculo||''} onChange={update}/></label>{cancelled&&<><div className="cancellation-callout wide"><CircleAlert/><span><b>El servicio no se elimina</b><small>Se oculta a los choferes y del calendario activo. El motivo, la fecha, el usuario y los gastos quedan guardados en el expediente.</small></span></div><label className="field wide"><span>Motivo de cancelación *</span><input name="cancellationReason" value={form.cancellationReason} onChange={update} placeholder="Ej. El buque finalmente no atraca en Barcelona" required autoFocus/></label><label className="field"><span>Gasto generado</span><input name="cancellationExpense" type="number" min="0" step="0.01" value={form.cancellationExpense} onChange={update} placeholder="0,00"/></label><label className="field"><span>Proveedor / origen del gasto</span><input name="cancellationProvider" value={form.cancellationProvider} onChange={update} placeholder="Transportista, espera, desplazamiento…"/></label><label className="field wide"><span>Nota interna</span><textarea name="cancellationNotes" value={form.cancellationNotes} onChange={update} placeholder="Detalles adicionales de la cancelación"/></label><label className="cancellation-billable wide"><input name="cancellationBillable" type="checkbox" checked={form.cancellationBillable} onChange={update}/><span><b>Facturar este gasto al cliente</b><small>Se añadirá una línea “CANCELLATION CHARGES” al borrador. Si no lo marcas, solo contará como coste interno.</small></span></label></>}<div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cerrar</button><button className={'button '+(cancelled?'danger':'primary')}><Save/> {cancelled?'Confirmar cancelación':'Guardar recorrido'}</button></div></form></section></div>;
}
function ProviderModal({close,submit}){
  const [form,setForm]=useState({id:'',nombre:'',contacto:'',telefono:'',activo:true});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Proveedores</span><h2>Añadir empresa de transporte</h2><p>Quedará disponible en Calendario y Transportes.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field wide"><span>Empresa</span><input name="nombre" value={form.nombre} onChange={update} required autoFocus/></label><label className="field"><span>Persona / departamento</span><input name="contacto" value={form.contacto} onChange={update}/></label><label className="field"><span>Teléfono</span><input name="telefono" value={form.telefono} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar proveedor</button></div></form></section></div>;
}
function ClientEditModal({item,close,submit}){
  const [form,setForm]=useState(normalizeClientProfile(item));const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal client-profile-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{form.codigo}</span><h2>Ficha de cliente</h2><p>Datos que se reutilizan en facturación y tarifas automáticas.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit({...form,expedientes:Number(form.expedientes)||0})}}><div className="client-form-section wide"><b>Datos fiscales</b></div><label className="field"><span>Nombre comercial *</span><input name="nombre" value={form.nombre} onChange={update} required autoFocus/></label><label className="field"><span>Razón social</span><input name="fiscalName" value={form.fiscalName} onChange={update}/></label><label className="field"><span>NIF / VAT</span><input name="taxId" value={form.taxId} onChange={update}/></label><label className="field"><span>Expedientes activos</span><input name="expedientes" type="number" min="0" value={form.expedientes} onChange={update}/></label><label className="field wide"><span>Dirección fiscal</span><input name="direccion" value={form.direccion} onChange={update}/></label><div className="client-form-section wide"><b>Contacto y pago</b></div><label className="field"><span>Email de contacto</span><input name="contacto" type="email" value={form.contacto} onChange={update}/></label><label className="field"><span>Teléfono</span><input name="telefono" value={form.telefono} onChange={update}/></label><label className="field"><span>Condiciones de pago</span><input name="condicionesPago" value={form.condicionesPago} onChange={update}/></label><label className="field"><span>Moneda</span><input name="moneda" value={form.moneda} onChange={update}/></label><div className="client-form-section wide"><b>Tarifa de facturación</b><small>Por ahora la tarifa automática real está activa para LIMANI.</small></div><label className="field wide"><span>Tarifa activa</span><input name="tarifaActiva" value={form.tarifaActiva} onChange={update}/></label><label className="field wide"><span>Recepción</span><input name="recepcion" value={form.recepcion} onChange={update}/></label><label className="field wide"><span>Storage</span><input name="storage" value={form.storage} onChange={update} readOnly={/limani/i.test(form.nombre)}/></label><label className="field wide"><span>Transporte</span><input name="transporte" value={form.transporte} onChange={update}/></label><label className="field wide"><span>Recargo fuera de horario / festivos</span><input name="recargo" value={form.recargo} onChange={update}/></label><label className="field wide"><span>Notas internas</span><input name="notas" value={form.notas} onChange={update} placeholder="Preferencias, emails habituales, excepciones…"/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar ficha</button></div></form></section></div>;
}
class InvoiceModalBoundary extends React.Component{
  constructor(props){super(props);this.state={failed:false}}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error,info){console.error('Error al abrir el borrador de facturación',error,info)}
  render(){return this.state.failed?<div className="modal-backdrop"><section className="modal"><div className="modal-head"><div><span className="overline">Facturación</span><h2>No se pudo abrir este borrador</h2><p>El borrador no se ha modificado. Cierra esta ventana, recarga la aplicación y vuelve a intentarlo.</p></div><button className="icon-button" onClick={this.props.close}><X/></button></div><div className="modal-actions"><button className="button primary" onClick={this.props.close}>Cerrar</button></div></section></div>:this.props.children}
}
function InvoiceEditModal({item,cases=[],warehouseEntries=[],transports=[],calendarEvents=[],clients=[],close,submit,simulateHolded}){
  const safeItem=item&&typeof item==='object'?item:{};
  const relatedCase=cases.find(entry=>entry.id===safeItem.expediente);
  const clientProfiles=mergeClientProfiles(clients);
  const findClientProfile=value=>{
    const key=clientProfileKey({nombre:value});
    return clientProfiles.find(profile=>clientProfileKey(profile)===key)||clientProfiles.find(profile=>String(profile.nombre||'').toLowerCase().includes(String(value||'').toLowerCase())&&String(value||'').trim().length>=3);
  };
  let currentCargo='';
  let currentHeader=invoiceText(safeItem.concepto);
  let template=null;
  try{currentCargo=relatedCase?invoiceText(invoiceCargoSummary(relatedCase,warehouseEntries)):''}catch{currentCargo=''}
  try{currentHeader=relatedCase?invoiceText(invoiceHeaderTitle(relatedCase,transports,calendarEvents)):currentHeader}catch{}
  try{template=relatedCase?draftInvoiceFromCase(relatedCase,warehouseEntries,transports,calendarEvents):null}catch{template=null}
  const templateLines=invoiceLinesOf(template?.lines).map(invoiceLineForEditor);
  const storedItemLines=invoiceLinesOf(safeItem.lines).map(invoiceLineForEditor);
  const storedLines=storedItemLines.length?storedItemLines:[{id:'line-1',item:safeItem.concepto||'TRANSPORT FROM WAREHOUSE TO VESSEL',detail:'',price:Number(safeItem.importe)||0,units:1,tax:'0%'}];
  const standardIds=new Set(['ref','reception','handling','storage','transport','waiting']);
  const comparableLines=lines=>['ref','reception','handling','storage','transport','waiting'].map(id=>{const line=invoiceLinesOf(lines).find(entry=>entry.id===id);return line?[id,line.item,line.detail,Number(line.price)||0,Number(line.units)||0,line.tax||'0%']:null}).filter(Boolean);
  const storedLineIds=storedLines.map(line=>line.id||String(line.item||'').toLowerCase());
  const missingTemplateLine=templateLines.length>0&&templateLines.some(line=>!storedLineIds.includes(line.id));
  const changedTemplateLine=templateLines.length>0&&JSON.stringify(comparableLines(storedLines))!==JSON.stringify(comparableLines(templateLines));
  const shouldUseTemplate=templateLines.length>0&&(storedLines.length<4||missingTemplateLine||changedTemplateLine||/^SPL/i.test(String(storedLines[0]?.item||'')));
  const customLines=storedLines.filter(line=>!standardIds.has(line.id)&&!String(line.id||'').startsWith('cancel-'));
  const initialLines=enforceLimaniFreeStorageLines((shouldUseTemplate?[...templateLines,...customLines]:storedLines).map((line,index)=>invoiceLineForEditor(currentCargo?{...line,item:index===0?currentHeader:line.item,detail:line.detail||currentCargo}:line,index)),{cliente:template?.cliente||safeItem.cliente});
  const [form,setForm]=useState({...safeItem,...template,id:invoiceText(safeItem.id),expediente:invoiceText(safeItem.expediente||template?.expediente),cliente:invoiceText(template?.cliente||safeItem.cliente),buque:invoiceText(template?.buque||safeItem.buque),puerto:invoiceText(template?.puerto||safeItem.puerto),concepto:invoiceText(currentHeader||template?.concepto||safeItem.concepto),estado:invoiceText(safeItem.estado||template?.estado)||'Borrador',vencimiento:invoiceText(safeItem.vencimiento||template?.vencimiento),observaciones:invoiceText(safeItem.observaciones||template?.observaciones),proforma:invoiceText(safeItem.proforma||template?.proforma),payment:invoiceText(safeItem.payment||template?.payment),supplierInvoices:invoiceLinesOf(safeItem.supplierInvoices),supplierText:invoiceText(safeItem.supplierText),lines:initialLines});
  const [supplierText,setSupplierText]=useState(invoiceText(safeItem.supplierText));
  const [supplierNote,setSupplierNote]=useState('');
  const [supplierScanning,setSupplierScanning]=useState(false);
  const [selectedTariffConcept,setSelectedTariffConcept]=useState('');
  let manualInvoiceWeight=0;
  let manualInvoiceCargo='';
  try{manualInvoiceWeight=invoiceLinesWeight(form.lines);manualInvoiceCargo=invoiceLinesCargoSummary(form.lines)}catch{}
  const billingCase={...(relatedCase||{}),cliente:form.cliente};
  let tariffConceptOptions=[];
  try{tariffConceptOptions=relatedCase?invoiceTariffConceptOptions(billingCase,warehouseEntries,transports,calendarEvents,{manualWeight:manualInvoiceWeight,manualCargo:manualInvoiceCargo}):[]}catch{tariffConceptOptions=[]}
  const selectedClient=findClientProfile(form.cliente);
  const applyClient=value=>{
    const profile=findClientProfile(value);
    const clientName=profile?.nombre||value;
    if(relatedCase){
      let repriced=null;
      try{repriced=draftInvoiceFromCase({...relatedCase,cliente:clientName},warehouseEntries,transports,calendarEvents)}catch{}
      if(!repriced){setForm({...form,cliente:clientName});return}
      const repricedLines=invoiceLinesOf(repriced.lines).map(invoiceLineForEditor);
      const templateIds=new Set(repricedLines.map(line=>line.id));
      const customLines=form.lines.filter(line=>!standardIds.has(line.id)&&!templateIds.has(line.id));
      setForm({...form,cliente:clientName,concepto:invoiceText(repriced.concepto),buque:invoiceText(repriced.buque),puerto:invoiceText(repriced.puerto),lines:[...repricedLines,...customLines]});
      return;
    }
    setForm({...form,cliente:clientName});
  };
  const update=event=>{
    const {name,value}=event.target;
    if(name==='cliente'&&relatedCase){
      setForm({...form,cliente:value});
      return;
    }
    setForm({...form,[name]:value});
  };
  const updateLine=(index,field,value)=>{
    const billingContext={...(relatedCase||{}),cliente:form.cliente};
    const updatedLines=form.lines.map((line,lineIndex)=>{
      if(lineIndex!==index)return line;
      const next={...line,[field]:value};
      if(isLimaniCase(billingContext)&&isStorageInvoiceLine(next))return {...next,price:0};
      if(['detail','item','units'].includes(field)){
        const autoPrice=invoiceAutoPriceLine(next,billingContext,warehouseEntries,transports,calendarEvents);
        if(autoPrice!==null)return {...next,price:autoPrice};
      }
      return next;
    });
    setForm({...form,lines:updatedLines});
  };
  const addLine=()=>setForm({...form,lines:[...form.lines,{id:`line-${Date.now()}`,item:'WAITING TIME',detail:'',price:0,units:1,tax:'0%'}]});
  const removeLine=index=>setForm({...form,lines:form.lines.filter((_,lineIndex)=>lineIndex!==index)});
  const applySupplierLinesFromText=(text,source='texto')=>{
    if(!relatedCase){setSupplierNote('Primero vincula la factura a un expediente.');return false}
    const billingCase={...relatedCase,cliente:form.cliente};
    const lines=enforceLimaniFreeStorageLines(parseSupplierInvoiceConcepts(text,billingCase,warehouseEntries,transports,calendarEvents),billingCase);
    if(!lines.length){setSupplierNote(source==='PDF'?'PDF guardado, pero no pude leer conceptos claros. Si es escaneado/foto, pega el texto o usa OCR.':'No encontré conceptos claros. Pega líneas como “Load / Unload 18.00” o “Delivery vessel Algeciras Port 65.00”.');return false}
    const baseLine={...(form.lines.find(line=>line.id==='ref')||{id:'ref',price:0,units:1,tax:'21%'}),item:invoiceHeaderTitle(billingCase,transports,calendarEvents),detail:currentCargo||invoiceCargoSummary(billingCase,warehouseEntries)};
    setForm(current=>({...current,supplierText:text,lines:[baseLine,...lines]}));
    setSupplierNote(`${lines.length} concepto(s) importados automáticamente desde ${source} con tarifa Swiftport. Revisa los importes antes de enviar a Holded.`);
    return true;
  };
  const addSupplierFiles=async event=>{
    const selectedFiles=Array.from(event.target.files||[]);
    if(!selectedFiles.length)return;
    const stamp=Date.now();
    const files=selectedFiles.map((file,index)=>({id:`SUP-${stamp}-${index}-${file.name}`,name:file.name,size:file.size,uploadedAt:new Date().toISOString(),url:URL.createObjectURL(file)}));
    setForm(current=>({...current,supplierInvoices:[...(current.supplierInvoices||[]),...files]}));
    setSupplierNote(`${files.length} PDF(s) guardados como evidencia. Selecciona abajo los conceptos Swiftport que quieras facturar.`);
    event.target.value='';
  };
  const removeSupplierFile=id=>setForm({...form,supplierInvoices:(form.supplierInvoices||[]).filter(file=>file.id!==id)});
  const importSupplierLines=()=>setSupplierNote('El lector automatico de PDFs queda desactivado para evitar lineas incorrectas. Usa el selector de conceptos Swiftport.');
  const rescanSupplierFiles=()=>setSupplierNote('Los PDFs quedan guardados como evidencia. Las lineas se crean desde el selector de conceptos tarifados.');
  const addTariffConcept=()=>{
    const option=tariffConceptOptions.find(entry=>entry.id===selectedTariffConcept);
    if(!option)return;
    setForm(current=>({...current,lines:[...current.lines,{...option,id:`${option.id}-${Date.now()}`}]}));
    setSelectedTariffConcept('');
    setSupplierNote(`${option.label} anadido con tarifa Swiftport. Revisa unidades, IVA y precio antes de enviar.`);
  };
  const total=invoiceTotal(form);
  const expenseTotal=relatedCase?caseExpenseTotal(relatedCase):Number(form.coste)||0;
  const estimatedMargin=total-expenseTotal;
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal invoice-modal invoice-detail-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>{String(item.id||'').startsWith('BOR-')?'Borrador automático de factura':'Editar facturación'}</h2><p>Plantilla basada en tus facturas habituales de Holded. Puedes cambiar líneas, precios y estado.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit({...form,importe:total,lines:form.lines.map(line=>({...line,price:Number(line.price)||0,units:Number(line.units)||0}))})}}><div className="invoice-locked wide"><ReceiptText/><span><small>DATOS DEL EXPEDIENTE</small><b>{form.expediente}{form.buque?`  -  ${form.buque}`:''}{form.puerto?`  -  ${form.puerto}`:''}</b><em>La mercancía y POD se corrigen desde Expediente; la factura se ajusta aquí.</em></span></div><label className="field"><span>Expediente</span><input name="expediente" value={form.expediente} readOnly/></label><label className="field invoice-client-field"><span>Cliente</span><input name="cliente" list="invoice-client-options" value={form.cliente} onChange={update} onBlur={event=>applyClient(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();applyClient(event.currentTarget.value)}}} placeholder="Escribe o selecciona cliente" required/><datalist id="invoice-client-options">{clientProfiles.map(profile=><option key={profile.codigo} value={profile.nombre}>{[profile.fiscalName,profile.taxId,profile.tarifaActiva].filter(Boolean).join('  -  ')}</option>)}</datalist>{selectedClient&&<small className="invoice-client-hint"><b>{selectedClient.fiscalName}</b>{selectedClient.taxId&&`  -  ${selectedClient.taxId}`}{selectedClient.tarifaActiva&&`  -  ${selectedClient.tarifaActiva}`}</small>}</label><label className="field"><span>Estado interno</span><select name="estado" value={form.estado} onChange={update}>{['Borrador','Revisar','Listo para enviar','Enviado a Holded','Facturado','Cobrado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Vencimiento</span><input name="vencimiento" type="date" value={form.vencimiento} onChange={update}/></label><label className="field wide"><span>Concepto general</span><input name="concepto" value={form.concepto} onChange={update} required/></label><div className="supplier-invoice-import wide"><div className="supplier-import-head"><span><b>Facturas proveedor del expediente</b><small>Sube PDFs de proveedor: Swiftport intentara leer conceptos, bultos, kilos y precios automaticamente.</small></span><label className="button secondary"><input type="file" accept="application/pdf,.pdf" multiple onChange={addSupplierFiles}/> {supplierScanning?'Escaneando PDFs...':'Subir PDFs proveedor'}</label></div>{(form.supplierInvoices||[]).length>0&&<div className="supplier-file-list">{form.supplierInvoices.map(file=><span key={file.id}><ReceiptText/><b>{file.name}</b><button type="button" className="icon-button compact danger" onClick={()=>removeSupplierFile(file.id)}><Trash2/></button></span>)}</div>}<label className="field wide"><span>Texto / conceptos copiados de la factura proveedor</span><textarea value={supplierText} onChange={event=>setSupplierText(event.target.value)} rows="4" placeholder="Pega aquí líneas como: Load / Unload 18.00, Warehouse 9.00, Customs clearance 33.00, Delivery vessel Algeciras Port 65.00"/></label><div className="supplier-import-actions"><button type="button" className="button secondary" onClick={importSupplierLines}>Copiar conceptos y aplicar mi tarifa</button><button type="button" className="button tertiary" onClick={rescanSupplierFiles}>PDFs como evidencia</button>{supplierNote&&<small>{supplierNote}</small>}</div></div><div className="invoice-lines-editor wide"><div className="invoice-lines-title"><span><b>Lineas de factura</b><small>Selecciona un concepto tarifado o anade una linea manual.</small></span><button type="button" className="button secondary" onClick={addLine}><Plus/> Linea manual</button></div>{tariffConceptOptions.length>0&&<div className="invoice-concept-toolbar"><label className="field"><span>Concepto Swiftport</span><select value={selectedTariffConcept} onChange={event=>setSelectedTariffConcept(event.target.value)}><option value="">Seleccionar concepto...</option>{tariffConceptOptions.map(option=><option key={option.id} value={option.id}>{option.label} - {moneyExact((Number(option.price)||0)*(Number(option.units)||1))}</option>)}</select></label><button type="button" className="button primary" onClick={addTariffConcept} disabled={!selectedTariffConcept}><Plus/> Anadir con tarifa</button></div>}{form.lines.map((line,index)=><article className="invoice-line-row" key={line.id||index}><label className="field"><span>Item</span><input value={line.item} onChange={event=>updateLine(index,'item',event.target.value)} required/></label><label className="field line-detail"><span>Detalle mercancía</span><input value={line.detail||''} onChange={event=>updateLine(index,'detail',event.target.value)} placeholder="Ej. 3 BOXES 5 KGS"/></label><label className="field"><span>Precio</span><input type="number" min="0" step="0.01" value={line.price} onChange={event=>updateLine(index,'price',event.target.value)} readOnly={isLimaniCase(billingCase)&&isStorageInvoiceLine(line)}/></label><label className="field"><span>Uds.</span><input type="number" min="0" step="0.01" value={line.units} onChange={event=>updateLine(index,'units',event.target.value)}/></label><label className="field"><span>IVA</span><select value={line.tax||'0%'} onChange={event=>updateLine(index,'tax',event.target.value)}><option>0%</option><option>21%</option><option>Exenta</option></select></label><strong>{moneyExact(invoiceLineTotal(line))}</strong>{form.lines.length>1&&<button type="button" className="icon-button danger" onClick={()=>removeLine(index)}><Trash2/></button>}</article>)}</div><div className="invoice-total-box wide"><span>Base imponible <b>{moneyExact(total)}</b></span><span>IVA 21% <b>{moneyExact(0)}</b></span><span>Exenta <b>{moneyExact(total)}</b></span><strong>Total <b>{moneyExact(total)}</b></strong></div><label className="field wide"><span>Observaciones</span><input name="observaciones" value={form.observaciones||''} onChange={update}/></label><label className="field"><span>Proforma</span><input name="proforma" value={form.proforma||''} onChange={update}/></label><label className="field"><span>Condiciones de pago</span><input name="payment" value={form.payment||''} onChange={update}/></label><div className="billing-edit-note wide"><b>Automático:</b> referencia, recepción, handling, storage, transporte y totales. <b>Editable:</b> cualquier precio, línea, cliente, estado y vencimiento.</div><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button>{simulateHolded&&<button type="button" className="button secondary" onClick={()=>simulateHolded({...form,importe:total,lines:form.lines.map(line=>({...line,price:Number(line.price)||0,units:Number(line.units)||0}))})}>Enviar proforma a Holded</button>}<button className="button primary"><Save/> Guardar borrador</button></div></form></section></div>;
}
function CustomEditModal({item,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar trámite aduanero</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field"><span>Expediente</span><input name="expediente" value={form.expediente} onChange={update}/></label><label className="field"><span>Tipo</span><input name="tipo" value={form.tipo} onChange={update}/></label><label className="field"><span>Referencia</span><input name="referencia" value={form.referencia} onChange={update}/></label><label className="field"><span>Fecha límite</span><input name="limite" value={form.limite} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Pendiente','Documentación','Liberado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Nota</span><input name="nota" value={form.nota} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar trámite</button></div></form></section></div>;
}
function transportCargoOptions(item,warehouseEntries=[]){
  if(!item)return [];
  const fromCase=(item.mercancias||[]).map((piece,index)=>({
    id:piece.id||`${item.id}-case-${index}`,
    ref:piece.sourceEntry||piece.ref||piece.id||`${item.id}-${index+1}`,
    summary:`${piece.buque||item.buque||'BUQUE'}  -  ${piece.cantidad||1} ${piece.tipo||'BULTO'}${Number(piece.cantidad)===1?'':'S'}  -  ${piece.peso||'PESO PENDIENTE'}`,
    detail:piece.seguimiento?`Tracking: ${piece.seguimiento}`:'Sin seguimiento',
    entryRef:piece.sourceEntry||'Expediente',
    tracking:piece.seguimiento||''
  }));
  const fromWarehouse=warehouseEntriesForVessel(warehouseEntries,item).flatMap((entry,entryIndex)=>{
    const goods=entry.mercancias?.length?entry.mercancias:[{tipo:'BULTO',cantidad:entry.bultos||1,peso:entry.peso||entry.pesoTotal||'',seguimiento:entry.tracking||entry.seguimiento||''}];
    return goods.map((piece,pieceIndex)=>({
      id:`${entry.ref||entry.id||entryIndex}-${piece.id||pieceIndex}`,
      ref:entry.ref||entry.id||`ALM-${entryIndex+1}`,
      summary:`${entry.buque||item.buque||'BUQUE'}  -  ${piece.cantidad||1} ${piece.tipo||'BULTO'}${Number(piece.cantidad)===1?'':'S'}  -  ${piece.peso||entry.peso||'PESO PENDIENTE'}`,
      detail:piece.seguimiento||entry.tracking||entry.seguimiento?`Tracking: ${piece.seguimiento||entry.tracking||entry.seguimiento}`:'Sin seguimiento',
      entryRef:entry.ref||entry.id||'Almacén',
      tracking:piece.seguimiento||entry.tracking||entry.seguimiento||''
    }));
  });
  const merged=[...fromCase,...fromWarehouse];
  return merged.filter((option,index,self)=>index===self.findIndex(item=>item.id===option.id||(`${item.ref}-${item.summary}`===`${option.ref}-${option.summary}`)));
}
function TransportCargoSelector({options,selectedIds,onChange}){
  const allSelected=options.length>0&&options.every(option=>selectedIds.includes(option.id));
  const toggle=id=>onChange(selectedIds.includes(id)?selectedIds.filter(value=>value!==id):[...selectedIds,id]);
  if(!options.length)return <div className="cargo-selection-panel wide"><div className="cargo-selection-head"><span><b>Mercancía de este viaje</b><small>No hay bultos/pallets vinculados al expediente todavía. Cuando se registren en almacén podrás elegirlos aquí.</small></span></div></div>;
  return <div className="cargo-selection-panel wide"><div className="cargo-selection-head"><span><b>Mercancía de este viaje</b><small>Marca exactamente qué cajas, pallets o bultos lleva este transporte.</small></span><div className="cargo-selection-actions"><button type="button" className="button mini secondary" onClick={()=>onChange(allSelected?[]:options.map(option=>option.id))}>{allSelected?'Limpiar selección':'Seleccionar todo'}</button></div></div><div className="cargo-option-list">{options.map(option=><label key={option.id} className={'cargo-option-card '+(selectedIds.includes(option.id)?'selected':'')}><input type="checkbox" checked={selectedIds.includes(option.id)} onChange={()=>toggle(option.id)}/><span><b>{option.summary}</b><small>{option.entryRef}  -  {option.detail}</small></span></label>)}</div></div>;
}
function CargoManifest({item,transport}){
  if(!item)return null;
  const documentation=item.documentacionMercancia||{};
  const nextStep=nextOperationStep(item);
  const receptions=item.recepciones||[];
  const photos=receptions.flatMap(record=>record.fotos||[]);
  const receptionDocuments=receptions.flatMap(record=>record.documentos||[]);
  const selectedCargo=transport?.selectedCargo||[];
  return <div className="driver-manifest wide"><div><Box/><span><b>CARGA PARA EL CONDUCTOR</b><small>{item.buque}  -  {item.puerto}</small></span></div>{selectedCargo.length>0&&<div className="manifest-selected-cargo"><PackageCheck/><span><small>CARGA SELECCIONADA PARA ESTE VIAJE</small>{selectedCargo.map(piece=><b key={piece.id||piece.ref}>{piece.summary}<em>{piece.entryRef}  -  {piece.detail}</em></b>)}</span></div>}{item.resumenMercancia&&<div className="manifest-email-brief"><PackageCheck/><span><small>MERCANCÍA INDICADA EN EL CORREO</small><b>{item.resumenMercancia}</b></span></div>}{item.notasOperativas&&<div className="manifest-email-brief notes"><FileText/><span><small>INSTRUCCIONES OPERATIVAS</small><b>{item.notasOperativas}</b></span></div>}{transport?.observacion&&<div className="manifest-email-brief notes driver-observation"><ClipboardCheck/><span><small>OBSERVACIÓN DEL TRANSPORTE</small><b>{transport.observacion}</b></span></div>}{item.referenciaCliente&&<div className="manifest-reference">Referencia: <b>{item.referenciaCliente}</b></div>}{(item.mercancias||[]).map(piece=><p key={piece.id}><b>{piece.buque||item.buque||'BUQUE SIN INDICAR'}  -  {piece.cantidad} {piece.tipo}{piece.cantidad===1?'':'S'}  -  {piece.peso||'PESO PENDIENTE'}</b><span>{piece.sourceEntry?`${piece.sourceEntry}  -  `:''}{piece.seguimiento?`Tracking: ${piece.seguimiento}`:'Sin seguimiento'}</span></p>)}{Boolean(photos.length||receptionDocuments.length)&&<div className="manifest-arrival-files"><Camera/><span><b>{photos.length} fotos  -  {receptionDocuments.length} documentos de llegada</b><small>Disponibles en el expediente</small></span></div>}<div className="manifest-next-step"><ClipboardCheck/><span><small>SIGUIENTE PASO</small><b>{nextStep?.title||'Operativa completada'}</b></span></div><footer><span>Aduanas: {documentation.alcance==='global'?(documentation.aduaneroDisponible?`${documentation.tipoAduanero} DISPONIBLE`:'PENDIENTE'):'DOCUMENTOS INDIVIDUALES'}</span><span>POD: {documentation.podDisponible?'DISPONIBLE':'PENDIENTE'}</span></footer></div>;
}
function CalendarEventModal({item,team,cases,transports,providers,warehouseEntries=[],close,submit:rawSubmit,openCase}){
  const initialTransport=transports.find(entry=>entry.id===item.transporte);
  const initialRoute=routeParts(initialTransport||{origen:item.origen,destino:item.destino,ruta:item.titulo});
  const [form,setForm]=useState({...item,...initialRoute,observacion:item.observacion||initialTransport?.observacion||'',tipoServicio:item.tipoServicio||(item.transporte?'Transporte':'Recepción')});
  const update=event=>{
    if(event.target.name==='tipoServicio'){const type=event.target.value;const related=cases.find(entry=>entry.id===form.expediente);setForm({...form,tipoServicio:type,transporte:type==='Recepción'?'':form.transporte,origen:type==='Transporte'?(form.origen||SWIFTPORT_WAREHOUSE):form.origen,destino:type==='Transporte'?(form.destino||`BUQUE ${related?.buque||''}  -  ${related?.puerto||''}`):form.destino});return}
    if(event.target.name==='expediente'){const related=cases.find(entry=>entry.id===event.target.value);setForm({...form,expediente:event.target.value,selectedCargoIds:[],selectedCargo:[],destino:form.tipoServicio==='Transporte'&&(!form.destino||form.destino==='BUQUE')?`BUQUE ${related?.buque||''}  -  ${related?.puerto||''}`:form.destino});return}
    if(event.target.name==='transporte'){const linked=transports.find(entry=>entry.id===event.target.value);const route=routeParts(linked);setForm({...form,...route,tipoServicio:event.target.value?'Transporte':form.tipoServicio,transporte:event.target.value,expediente:linked?.expediente||form.expediente,titulo:linked?transportRoute(linked):form.titulo,asignado:linked?.conductor||form.asignado,proveedorId:linked?.proveedorId||form.proveedorId||'',fecha:linked?.fecha||form.fecha,inicio:linked?.inicio||form.inicio,fin:linked?.fin||form.fin,observacion:linked?.observacion||form.observacion||''});return}
    setForm({...form,[event.target.name]:event.target.value});
  };
  const validTeam=team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver'));
  const relatedCase=cases.find(entry=>entry.id===form.expediente);
  const cargoOptions=transportCargoOptions(relatedCase,warehouseEntries);
  const selectedCargoIds=form.selectedCargoIds||(form.selectedCargo||[]).map(piece=>piece.id).filter(Boolean);
  const setSelectedCargoIds=ids=>setForm(current=>({...current,selectedCargoIds:ids,selectedCargo:cargoOptions.filter(option=>ids.includes(option.id))}));
  const submit=payload=>rawSubmit({...payload,selectedCargoIds,selectedCargo:cargoOptions.filter(option=>selectedCargoIds.includes(option.id))});
  const saveWithCargo=event=>{event.preventDefault();const route=form.tipoServicio==='Transporte'?`${form.origen.trim()} → ${form.destino.trim()}`:form.titulo;const selectedCargo=cargoOptions.filter(option=>selectedCargoIds.includes(option.id));submit({...form,titulo:route,selectedCargoIds,selectedCargo})};
  const save=event=>{event.preventDefault();const route=form.tipoServicio==='Transporte'?`${form.origen.trim()} → ${form.destino.trim()}`:form.titulo;submit({...form,titulo:route})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal calendar-event-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Planificación</span><h2>{item.titulo?'Editar transporte':'Nuevo transporte'}</h2><p>Solo se agenda el transporte al buque/gabarra. Si falta hora ETB, puedes dejar la hora vacía.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Tipo de servicio</span><select name="tipoServicio" value={form.tipoServicio} onChange={update}><option>Transporte</option></select></label><label className="field"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update} required><option value="">Seleccionar expediente</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{caseLabel(entry)}</option>)}</select></label><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Conductor</span><select name="asignado" value={form.asignado} onChange={update} autoFocus><option>Sin asignar</option>{validTeam.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Hora de inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update}/></label><label className="field"><span>Hora de fin</span><input name="fin" type="time" value={form.fin} onChange={update}/></label>{form.tipoServicio==='Transporte'?<><label className="field wide"><span>Lugar de recogida</span><input name="origen" value={form.origen} onChange={update} placeholder="ALMACÉN SWIFTPORT" required/></label><label className="field wide"><span>Lugar de entrega</span><input name="destino" value={form.destino} onChange={update} placeholder="BUQUE / EMPRESA / ALMACÉN…" required/></label><div className="route-preview wide"><MapPin/><span><small>RECORRIDO DEL CONDUCTOR</small><b>{form.origen||'ORIGEN'} → {form.destino||'DESTINO'}</b></span></div><label className="field wide"><span>Observación para el conductor</span><textarea name="observacion" value={form.observacion||''} onChange={update} rows="3" placeholder="Ej. llamar antes de llegar, preguntar por Juan, llevar transpaleta, referencia de carga…"/></label><label className="field"><span>Empresa de transporte</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Transporte relacionado</span><select name="transporte" value={form.transporte} onChange={update}><option value="">Crear transporte nuevo</option>{transports.map(entry=><option key={entry.id} value={entry.id}>{entry.id}  -  {transportRoute(entry)}</option>)}</select></label></>:<label className="field wide"><span>Lugar / notas</span><input name="titulo" value={form.titulo} onChange={update} placeholder="Almacén, terminal, proveedor…"/></label>}<TransportCargoSelector options={cargoOptions} selectedIds={selectedCargoIds} onChange={setSelectedCargoIds}/><CargoManifest item={relatedCase} transport={form}/>{form.expediente&&<button type="button" className="button tertiary wide calendar-case-link" onClick={()=>{close();openCase(form.expediente)}}>Abrir expediente relacionado <ExternalLink/></button>}<div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar transporte</button></div></form></section></div>;
}
function NewCaseModal({clientOptions=[],vessels=[],team=[],close,submit}){
  const warehouse=SWIFTPORT_WAREHOUSE;
  const [form,setForm]=useState({serviceType:'vessel_delivery',buque:'',imo:'',mmsi:'',purchaseOrder:'',cliente:clientOptions[0]||'UME Shipping',puerto:'Barcelona',etaDate:'',etaTime:'',etbDate:'',etbTime:'',etdDate:'',etdTime:'',prioridad:'Media',bultos:'',pesoEstimado:'',createReception:false,receptionDate:'',receptionStart:'09:00',receptionEnd:'10:00',receptionLocation:warehouse,createTransport:false,transportDate:'',transportStart:'',transportEnd:'',transportDateManual:false,transportStartManual:false,transportPickup:warehouse,transportDelivery:'BUQUE POR CONFIRMAR  -  Barcelona',transportConductor:'Sin asignar'});
  const update=event=>{
    const {name,value,type,checked}=event.target;
    if(name==='cliente'&&value==='__new_client__'){
      const typed=window.prompt('Nombre del nuevo cliente');
      if(typed&&typed.trim())setForm(current=>({...current,cliente:typed.trim()}));
      return;
    }
    if(name==='serviceType'){
      setForm(current=>{
        const survey=value==='survey_samples';
        const storage=value==='storage_other';
        return {...current,serviceType:value,createReception:survey?false:current.createReception,createTransport:survey?true:(storage?false:current.createTransport),transportDate:survey&&!current.transportDateManual?(current.etbDate||current.etaDate||current.transportDate):current.transportDate,transportStart:survey&&!current.transportStartManual?(current.etbTime||current.etaTime||current.transportStart):current.transportStart,transportPickup:survey?'SURVEYOR / OFICINA':current.transportPickup,transportDelivery:survey?`BUQUE ${current.buque.toUpperCase()||'POR CONFIRMAR'}  -  ${current.puerto}`:(storage?'ENTREGA / RECOGIDA POR CONFIRMAR':`BUQUE ${current.buque.toUpperCase()||'POR CONFIRMAR'}  -  ${current.puerto}`)};
      });
      return;
    }
    if(name==='etaDate'){
      setForm(current=>({...current,etaDate:value,receptionDate:current.receptionDate||value,transportDate:current.transportDateManual?current.transportDate:(current.etbDate||value||current.transportDate)}));
      return;
    }
    if(name==='etaTime'){
      setForm(current=>({...current,etaTime:value,transportStart:current.transportStartManual?current.transportStart:(current.etbTime||value||current.transportStart),transportEnd:current.transportStartManual?current.transportEnd:((current.etbTime||value)&&!current.transportEnd?plusHourClient(current.etbTime||value):current.transportEnd)}));
      return;
    }
    if(name==='etbDate'){
      setForm(current=>({...current,etbDate:value,transportDate:current.transportDateManual?current.transportDate:(value||current.etaDate||current.transportDate)}));
      return;
    }
    if(name==='etbTime'){
      setForm(current=>({...current,etbTime:value,transportStart:current.transportStartManual?current.transportStart:(value||current.etaTime||current.transportStart),transportEnd:current.transportStartManual?current.transportEnd:(value&&!current.transportEnd?plusHourClient(value):current.transportEnd)}));
      return;
    }
    if(name==='transportDate'){
      setForm(current=>({...current,transportDate:value,transportDateManual:true}));
      return;
    }
    if(name==='transportStart'){
      setForm(current=>({...current,transportStart:value,transportStartManual:true,transportEnd:value&&!current.transportEnd?plusHourClient(value):current.transportEnd}));
      return;
    }
    if(name==='buque'){setForm(current=>{const known=findKnownVessel(vessels,value);return {...current,buque:value,imo:known?.imo||current.imo,mmsi:known?.mmsi||current.mmsi,transportDelivery:current.serviceType==='storage_other'?current.transportDelivery:`BUQUE ${value.toUpperCase()}  -  ${current.puerto}`}});return}
    if(name==='puerto'){setForm(current=>({...current,puerto:value,transportDelivery:current.serviceType==='storage_other'?current.transportDelivery:`BUQUE ${current.buque.toUpperCase()||'POR CONFIRMAR'}  -  ${value}`}));return}
    setForm(current=>({...current,[name]:type==='checkbox'?checked:value}));
  };
  useEffect(()=>{
    const select=document.querySelector('.new-case-modal select[name="cliente"]');
    if(!select)return;
    [...select.querySelectorAll('option[data-dynamic-client]')].forEach(option=>option.remove());
    const existing=[...select.options].some(option=>option.value.toLowerCase()===String(form.cliente||'').toLowerCase());
    if(form.cliente&&!existing){
      const option=document.createElement('option');
      option.value=form.cliente;
      option.textContent=form.cliente;
      option.setAttribute('data-dynamic-client','true');
      select.appendChild(option);
    }
    const add=document.createElement('option');
    add.value='__new_client__';
    add.textContent='+ Añadir cliente nuevo';
    add.setAttribute('data-dynamic-client','true');
    select.appendChild(add);
  },[form.cliente,clientOptions]);
  const transportServiceLabel=form.serviceType==='survey_samples'?'AGENDAR SURVEY A BORDO':form.serviceType==='storage_other'?'CREAR TRANSPORTE A OTRO LUGAR':'CREAR TRANSPORTE EN CALENDARIO';
  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal new-case-modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-head"><div><span className="overline">Nuevo registro</span><h2 id="new-case-title">Crear expediente y trabajos</h2><p>El expediente quedará creado y el transporte irá al calendario. La recepción queda en almacén/expediente.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit({...form,purchaseOrder:String(form.purchaseOrder||'').trim().toUpperCase()})}}><div className="service-type-selector wide">{SERVICE_TYPES.map(type=><label key={type.value} className={form.serviceType===type.value?'active':''}><input type="radio" name="serviceType" value={type.value} checked={form.serviceType===type.value} onChange={update}/><span><b>{type.label}</b><small>{type.hint}</small></span></label>)}</div><label className="field wide"><span>Buque / referencia *</span><input name="buque" list="known-vessels-new" value={form.buque} onChange={update} placeholder="Ej. Baltic Horizon o referencia de almacén" required autoFocus/><datalist id="known-vessels-new">{vessels.map(vessel=><option key={vessel.id||vessel.name} value={vessel.name}>{[vessel.imo&&`IMO ${vessel.imo}`,vessel.mmsi&&`MMSI ${vessel.mmsi}`].filter(Boolean).join('  -  ')}</option>)}</datalist></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="Se rellena si existe"/></label><label className="field"><span>MMSI</span><input name="mmsi" inputMode="numeric" maxLength="9" value={form.mmsi} onChange={update} placeholder="Seguimiento AIS"/></label><div className="vessel-memory-hint wide"><Ship/><span><b>Buques recordados</b><small>Si el buque ya existe, Swiftport recupera IMO/MMSI. Si los añades ahora, quedarán guardados para la próxima escala.</small></span></div><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{(clientOptions.length?clientOptions:clientNames).map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>PO / Purchase Order</span><input name="purchaseOrder" value={form.purchaseOrder} onChange={update} placeholder="Ej. POA604877"/></label><label className="field"><span>Puerto</span><input name="puerto" list="common-ports-new" value={form.puerto} onChange={update} placeholder="Escribe cualquier puerto" required/><datalist id="common-ports-new">{['Barcelona','Algeciras','Tarragona','Valencia','Bilbao','Sagunto','Vinaròs','Castellón','Marín','A Coruña','Huelva','Sevilla','Cartagena','Alicante','Tenerife','Las Palmas'].map(value=><option key={value} value={value}/>)}</datalist></label><label className="field"><span>ETA fecha del buque</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA hora opcional</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB fecha preferente</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/><small>Si la tienes, manda sobre la ETA para crear el transporte.</small></label><label className="field"><span>ETB hora opcional</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD fecha salida opcional</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD hora salida opcional</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos estimados (opcional)</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update} placeholder="Ej. 3"/><small>Dato provisional. La mercancía real se registra después desde almacén.</small></label><label className="field"><span>Peso estimado (opcional)</span><input name="pesoEstimado" value={form.pesoEstimado} onChange={update} placeholder="Ej. 150 kg"/><small>Provisional y no obligatorio para crear el expediente.</small></label><fieldset className="case-service-fieldset wide"><label className="service-check"><input name="createReception" type="checkbox" checked={form.createReception} onChange={update}/><WarehouseIcon/><span><b>REGISTRAR RECEPCIÓN</b><small>La mercancía quedará asociada al buque/expediente</small></span></label>{form.createReception&&<div className="case-service-fields"><label className="field"><span>Fecha *</span><input name="receptionDate" type="date" value={form.receptionDate} onChange={update} required/></label><label className="field"><span>Inicio *</span><input name="receptionStart" type="time" value={form.receptionStart} onChange={update} required/></label><label className="field"><span>Fin *</span><input name="receptionEnd" type="time" value={form.receptionEnd} onChange={update} required/></label><label className="field wide"><span>Lugar de recepción / recogida</span><input name="receptionLocation" value={form.receptionLocation} onChange={update} required/></label></div>}</fieldset><fieldset className="case-service-fieldset wide"><label className="service-check"><input name="createTransport" type="checkbox" checked={form.createTransport} onChange={update}/><Truck/><span><b>{form.serviceType==='storage_other'?'CREAR TRANSPORTE A OTRO LUGAR':'CREAR TRANSPORTE EN CALENDARIO'}</b><small>Ruta, horario y responsable de la tarea</small></span></label>{form.createTransport&&<div className="case-service-fields"><label className="field"><span>Fecha *</span><input name="transportDate" type="date" value={form.transportDate} onChange={update} required/></label><label className="field"><span>Inicio / hora buque opcional</span><input name="transportStart" type="time" value={form.transportStart} onChange={update}/></label><label className="field"><span>Fin opcional</span><input name="transportEnd" type="time" value={form.transportEnd} onChange={update}/></label><label className="field"><span>Conductor / responsable</span><select name="transportConductor" value={form.transportConductor} onChange={update}><option>Sin asignar</option>{team.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Recogida</span><input name="transportPickup" value={form.transportPickup} onChange={update} required/></label><label className="field"><span>Entrega</span><input name="transportDelivery" value={form.transportDelivery} onChange={update} required/></label></div>}</fieldset><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Crear expediente y calendario</button></div></form></section></div>;
}
function WarehouseEntryModal({cases,close,submit,csrfToken}){
  const [form,setForm]=useState({expediente:'',identificacion:'',fechaRecepcion:localDateTimeValue(),zona:'A-01',spaceType:'auto',spacePositions:'1',spaceLength:'3',spaceWidth:'1',mercancias:[{tipo:'CAJA',cantidad:'1',peso:'',seguimiento:''}]});
  const [photos,setPhotos]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const update=e=>setForm({...form,[e.target.name]:e.target.value});
  const updateLine=(index,field,value)=>setForm({...form,mercancias:form.mercancias.map((line,lineIndex)=>lineIndex===index?{...line,[field]:value}:line)});
  const updatePhoto=(index,change)=>setPhotos(photos.map((photo,photoIndex)=>photoIndex===index?{...photo,...change}:photo));
  const addPhotos=files=>{
    const selected=[...files];
    setPhotos(current=>[...current,...selected.map((file,index)=>({id:`PHOTO-${Date.now()}-${index}`,file,preview:URL.createObjectURL(file),tipo:current.length+index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercanciaIndex:'0',nota:''}))]);
  };
  const addDocuments=files=>setDocuments(current=>[...current,...files]);
  const removePhoto=index=>setPhotos(current=>current.filter((_,photoIndex)=>photoIndex!==index));
  const addLine=()=>setForm({...form,mercancias:[...form.mercancias,{tipo:'CAJA',cantidad:'1',peso:'',seguimiento:''}]});
  const removeLine=index=>{
    setForm({...form,mercancias:form.mercancias.filter((_,lineIndex)=>lineIndex!==index)});
    setPhotos(photos.map(photo=>({...photo,mercanciaIndex:Number(photo.mercanciaIndex)===index?'0':String(Math.max(0,Number(photo.mercanciaIndex)-(Number(photo.mercanciaIndex)>index?1:0)))})));
  };
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      if(!photos.length)throw new Error('Añade al menos una foto de la mercancía.');
      if(['pallet','long'].includes(form.spaceType)&&floorNumber(form.spacePositions)<1)throw new Error('Indica al menos una posición ocupada en el suelo.');
      const invalidLine=form.mercancias.find(line=>!line.tipo||Number(line.cantidad)<1||Number(line.peso)<=0);
      if(invalidLine)throw new Error('Cada grupo debe tener tipo, cantidad y peso.');
      const uploadedPhotos=await Promise.all(photos.map(async photo=>{
        const uploaded=await uploadAttachment(photo.file,'photo',csrfToken);
        const line=form.mercancias[Number(photo.mercanciaIndex)];
        const merchandise=!line?'MERCANCÍA SIN IDENTIFICAR':`${line.cantidad} ${line.tipo}${Number(line.cantidad)===1?'':'S'}  -  ${Number(line.peso).toLocaleString('es-ES',{maximumFractionDigits:2})} KG${line.seguimiento?`  -  ${line.seguimiento.toUpperCase()}`:''}`;
        return {...uploaded,tipo:photo.tipo,mercancia:merchandise,nota:photo.nota.trim()};
      }));
      const uploadedDocuments=await Promise.all(documents.map(file=>uploadAttachment(file,'document',csrfToken)));
      submit({...form,fotos:uploadedPhotos,documentosRecepcion:uploadedDocuments});
    }catch(reason){setError(reason.message);setBusy(false)}
  };
  const cargoSummary=form.mercancias.map(line=>`${Number(line.cantidad)||0} ${line.tipo}${Number(line.cantidad)===1?'':'S'}`).join(' + ');
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)close()}}>
    <section className="modal warehouse-entry-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-entry-title">
      <div className="modal-head"><div><span className="overline">Almacén</span><h2 id="warehouse-entry-title">Registrar mercancía</h2><p>Indica cantidad y peso de cada grupo recibido.</p></div><button className="icon-button" aria-label="Cerrar" disabled={busy} onClick={close}><X/></button></div>
      <form onSubmit={save}>
        <label className="field wide"><span>Expediente (opcional)</span><select name="expediente" value={form.expediente} onChange={update}><option value="">SIN EXPEDIENTE  -  VINCULAR DESPUÉS</option>{cases.map(item=><option value={item.id} key={item.id}>{caseLabel(item)}</option>)}</select></label>
        {!form.expediente&&<label className="field wide"><span>Buque / referencia de mercancía *</span><input name="identificacion" value={form.identificacion} onChange={update} placeholder="Ej. DENSA PUMA, BOS CHABLIS, tracking o proveedor" required/></label>}
        <label className="field"><span>Fecha y hora de llegada *</span><input name="fechaRecepcion" type="datetime-local" value={form.fechaRecepcion} onChange={update} required/></label>
        <label className="field"><span>Ubicación *</span><input name="zona" value={form.zona} onChange={update} placeholder="Ej. A-01" required/></label>
        <div className="cargo-lines wide">
          <div className="cargo-lines-title"><b>Mercancías</b><button type="button" className="button secondary" onClick={addLine}><Plus/> Añadir tipo</button></div>
          <div className="cargo-entry-summary"><PackageCheck/><span><small>Resumen de esta entrada</small><b>{cargoSummary}</b></span></div>
          {form.mercancias.map((line,index)=><div className="cargo-line" key={index}>
            <label className="field"><span>Tipo *</span><select value={line.tipo} onChange={event=>updateLine(index,'tipo',event.target.value)} required><option>CAJA</option><option>PALLET</option><option>SOBRE</option><option>PAQUETE</option><option>BULTO</option></select></label>
            <label className="field"><span>Cantidad *</span><input type="number" min="1" step="1" value={line.cantidad} onChange={event=>updateLine(index,'cantidad',event.target.value)} required/></label>
            <label className="field"><span>Peso del grupo (kg) *</span><input type="number" min="0.1" step="0.1" value={line.peso} onChange={event=>updateLine(index,'peso',event.target.value)} placeholder="Ej. 42,5" required/></label>
            <label className="field tracking-field"><span>N.º seguimiento (opcional)</span><input value={line.seguimiento} onChange={event=>updateLine(index,'seguimiento',event.target.value)} placeholder="Tracking / AWB"/></label>
            {form.mercancias.length>1&&<button type="button" className="icon-button remove-cargo" onClick={()=>removeLine(index)}><X/></button>}
          </div>)}
        </div>
        <div className="floor-space-box wide">
          <div><Layers3/><span><b>Ocupación de suelo</b><small>Esta información alimenta el porcentaje y el histórico mensual.</small></span></div>
          <label className="field"><span>Cómo computa esta entrada</span><select name="spaceType" value={form.spaceType} onChange={update}><option value="auto">Automático: solo pallets declarados</option><option value="pallet">Posiciones de pallet manuales</option><option value="long">Material largo / metal</option><option value="none">No ocupa suelo: cajas o bultos</option></select></label>
          {['pallet','long'].includes(form.spaceType)&&<label className="field"><span>{form.spaceType==='long'?'Posiciones / paquetes en suelo':'Posiciones de pallet'}</span><input name="spacePositions" type="number" min="1" step="1" value={form.spacePositions} onChange={update} required/></label>}
          {form.spaceType==='long'&&<><label className="field"><span>Largo ocupado (m)</span><input name="spaceLength" type="number" min="0.1" step="0.1" value={form.spaceLength} onChange={update} required/></label><label className="field"><span>Ancho ocupado (m)</span><input name="spaceWidth" type="number" min="0.1" step="0.1" value={form.spaceWidth} onChange={update} required/></label></>}
          <p>{form.spaceType==='auto'?'Cada PALLET suma 1,20 × 0,80 m; el resto suma 0%.':form.spaceType==='long'?`${floorNumber(form.spacePositions)*floorNumber(form.spaceLength)*floorNumber(form.spaceWidth)} m² computables para esta entrada.`:form.spaceType==='pallet'?`${floorNumber(form.spacePositions)*EURO_PALLET_FLOOR_M2} m² computables para esta entrada.`:'Esta entrada se conserva en stock, pero ocupa 0% en la estadística.'}</p>
        </div>
        <div className="arrival-files wide">
          <MultiPhotoButton className="file-picker multi-photo-trigger" disabled={busy} title="Fotos de recepción de mercancía" onFiles={addPhotos}><Camera/><span><b>Tomar varias fotos de la mercancía *</b><small>La cámara queda abierta hasta que termines la serie</small></span></MultiPhotoButton>
          <MultiPhotoButton className="file-picker multi-photo-trigger" disabled={busy} title="Fotos de documentos de recepción" onFiles={addDocuments}><Camera/><span><b>Fotografiar varios documentos</b><small>Packing list, CMR, delivery note o albarán</small></span></MultiPhotoButton>
          <label className="file-picker"><FileText/><span><b>Añadir documentos PDF</b><small>Puedes seleccionar varios archivos a la vez</small></span><input type="file" accept="application/pdf,.pdf" multiple onChange={event=>{addDocuments(event.target.files);event.target.value=''}}/></label>
          {Boolean(photos.length)&&<div className="photo-identification"><div className="photo-identification-title"><b>Identificación fotográfica</b><small>{photos.length} foto(s). Asocia cada evidencia con su mercancía.</small></div>{photos.map((photo,index)=><article key={photo.id||`${photo.file.name}-${photo.file.lastModified}`}><img src={photo.preview} alt={`Vista previa ${index+1}`}/><div><span className="photo-number">FOTO {String(index+1).padStart(2,'0')}<button type="button" onClick={()=>removePhoto(index)}>Quitar</button></span><label className="field"><span>Qué muestra</span><select value={photo.tipo} onChange={event=>updatePhoto(index,{tipo:event.target.value})}>{PHOTO_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><label className="field"><span>Mercancía asociada *</span><select value={photo.mercanciaIndex} onChange={event=>updatePhoto(index,{mercanciaIndex:event.target.value})} required>{form.mercancias.map((line,lineIndex)=><option key={lineIndex} value={lineIndex}>{line.cantidad} {line.tipo}{Number(line.cantidad)===1?'':'S'}  -  {line.peso||'—'} KG{line.seguimiento?`  -  ${line.seguimiento.toUpperCase()}`:''}</option>)}</select></label><label className="field photo-note"><span>Observación (opcional)</span><input value={photo.nota} onChange={event=>updatePhoto(index,{nota:event.target.value})} placeholder="Ej. esquina golpeada, precinto intacto…"/></label></div></article>)}</div>}
          {Boolean(documents.length)&&<div className="selected-files documents-selected">{documents.map(file=><span key={`doc-${file.name}`}><FileText/>{file.name}</span>)}</div>}
        </div>
        {error&&<div className="form-error wide"><CircleAlert/>{error}</div>}
        <div className="modal-actions wide"><button type="button" className="button tertiary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" disabled={busy}><UploadCloud/> {busy?'Subiendo archivos…':'Registrar entrada'}</button></div>
      </form>
    </section>
  </div>;
}
function WarehouseEditModal({item,cases,close,submit,deleteItem}){
  const [form,setForm]=useState({...item,spaceType:item.spaceType||'auto',spacePositions:item.spacePositions||1,spaceLength:item.spaceLength||3,spaceWidth:item.spaceWidth||1});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const related=cases.find(entry=>entry.id===form.expediente);submit({...form,buque:related?.buque||form.buque,bultos:Number(form.bultos)||0,dias:Number(form.dias)||0,spacePositions:floorNumber(form.spacePositions),spaceLength:floorNumber(form.spaceLength||3),spaceWidth:floorNumber(form.spaceWidth||1)})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.ref}</span><h2>{item.expediente?'Editar entrada de almacén':'Vincular mercancía recibida'}</h2><p>{item.expediente?'Los cambios se reflejarán en el stock.':'Selecciona el expediente cuando sepas a qué buque pertenece.'}</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Expediente</span><select name="expediente" value={form.expediente||''} onChange={update}><option value="">SIN EXPEDIENTE</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{entry.id}  -  {entry.buque}</option>)}</select></label>{!form.expediente&&<label className="field wide"><span>Buque / referencia</span><input name="buque" value={form.buque||''} onChange={update} required/></label>}<label className="field"><span>Ubicación</span><input name="zona" value={form.zona} onChange={update} required/></label><label className="field"><span>Fecha de entrada</span><input name="entrada" value={form.entrada} onChange={update} required/></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><div className="floor-space-box wide"><div><Layers3/><span><b>Ocupación de suelo</b><small>Cajas y bultos pueden mantenerse al 0%.</small></span></div><label className="field"><span>Cómo computa</span><select name="spaceType" value={form.spaceType} onChange={update}><option value="auto">Automático: solo pallets declarados</option><option value="pallet">Posiciones de pallet manuales</option><option value="long">Material largo / metal</option><option value="none">No ocupa suelo</option></select></label>{['pallet','long'].includes(form.spaceType)&&<label className="field"><span>Posiciones en suelo</span><input name="spacePositions" type="number" min="1" step="1" value={form.spacePositions} onChange={update} required/></label>}{form.spaceType==='long'&&<><label className="field"><span>Largo (m)</span><input name="spaceLength" type="number" min="0.1" step="0.1" value={form.spaceLength} onChange={update} required/></label><label className="field"><span>Ancho (m)</span><input name="spaceWidth" type="number" min="0.1" step="0.1" value={form.spaceWidth} onChange={update} required/></label></>}</div><label className="field"><span>Días de storage</span><input name="dias" type="number" min="0" value={form.dias} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['En stock','Retenido','Preparado','Expedido'].map(value=><option key={value}>{value}</option>)}</select></label>{Boolean((item.fotos||[]).length)&&<div className="warehouse-photo-gallery wide"><b>Fotos recibidas</b><div>{(item.fotos||[]).map((photo,index)=><a key={photo.id||photo.url||index} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.mercancia||`Foto ${index+1}`}/><span>{photo.mercancia||photo.tipo||`Foto ${index+1}`}</span></a>)}</div></div>}{Boolean((item.documentosRecepcion||[]).length)&&<div className="warehouse-doc-list wide"><b>Documentos de llegada</b>{(item.documentosRecepcion||[]).map((file,index)=><a key={file.id||file.url||index} href={file.url} target="_blank" rel="noreferrer"><FileText/>{file.name||`Documento ${index+1}`}</a>)}</div>}<div className="modal-actions wide"><button type="button" className="button danger" onClick={()=>deleteItem(item)}><Trash2/> Eliminar entrada</button><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> {form.expediente?'Guardar y vincular':'Guardar entrada'}</button></div></form></section></div>;
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
createRoot(document.getElementById('root')).render(<AuthRoot/>);


