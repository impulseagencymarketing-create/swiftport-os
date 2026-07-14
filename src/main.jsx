import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Anchor, LayoutDashboard, FolderKanban, Warehouse as WarehouseIcon, Truck, FileCheck2,
  UsersRound, ReceiptText, Menu, X, Plus, Search, Bell, ChevronRight, Ship,
  PackageCheck, CircleAlert, WalletCards, CalendarDays, MapPin, Clock3, CheckCircle2,
  Circle, Camera, Box, Scale, Layers3, Navigation, UserRound, FileText, UploadCloud,
  Download, Filter, CircleDollarSign, ExternalLink, Mail, PencilLine, ClipboardCheck,
  BadgeEuro, Sparkles, ArrowLeft, Save, LogOut, ShieldCheck, LockKeyhole, UserPlus, Eye,
  RefreshCw, Timer, Undo2, ScanLine, Trash2
} from 'lucide-react';
import {
  expedientesIniciales, movimientosAlmacen, transportesIniciales, proveedoresIniciales, tramitesAduana, eventosCalendarioIniciales,
  clientNames
} from './data';
import './styles.css';
import './fixes.css';

const NAV = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['calendario','Calendario',CalendarDays],
  ['expedientes','Expedientes',FolderKanban],
  ['almacen','Almacén',WarehouseIcon],
  ['buques','Buques',Ship],
  ['clientes','Clientes / Tarifas',UsersRound],
  ['facturacion','Facturación',ReceiptText],
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
  correos:['Correos automáticos','Servicios recibidos por info@ y operations@'],
  clientes:['Clientes y tarifas','Condiciones comerciales por cliente'],
  facturacion:['Facturación','Servicios listos para revisar y exportar'],
  usuarios:['Usuarios y permisos','Control de acceso al equipo']
};
const ROLE_LABELS={driver:'Transportista',operations:'Operaciones',finance:'Finanzas',admin:'Administración'};
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
const warehouseEntriesForVessel=(entries,item)=>entries.filter(entry=>activeWarehouseEntry(entry)&&(entry.expediente===item.id||sameVessel(entry.buque,item.buque)));
const canAccess=(roles,id)=>{
  if(id==='correos')return false;
  if(['transportes','aduanas'].includes(id))return false;
  if(isDriverOnly(roles))return ['calendario','almacen'].includes(id);
  if (['clientes','facturacion'].includes(id)) return hasRole(roles,'finance')||hasRole(roles,'admin');
  if (id==='usuarios') return hasRole(roles,'admin');
  return true;
};
const statusTone = value => {
  if (['Completado','Liberado','Entregado','Lista','Enviada','Preparado','Expedido'].includes(value)) return 'success';
  if (['Bloqueado','Urgente','Retenido','Sin asignar','Revisar','Pendiente'].includes(value)) return 'danger';
  if (['En curso','En ruta','Asignado','En stock','Borrador'].includes(value)) return 'info';
  return 'warning';
};
const money = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const numericRef=value=>Number(String(value||'').match(/(\d+)(?!.*\d)/)?.[1]||0);
const newestFirst=(left,right)=>numericRef(right.id||right.ref)-numericRef(left.id||left.ref);
const newestMailFirst=(left,right)=>(Date.parse(right.received_at||right.created_at||'')||0)-(Date.parse(left.received_at||left.created_at||'')||0)||Number(right.id||0)-Number(left.id||0);
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
const portCallMoment=(date,time)=>date||time?`${date?formatEtaDate(date):'FECHA PENDIENTE'}${time?` · ${time}`:' · HORA PENDIENTE'}`:'POR CONFIRMAR';
const aisEstimatedEta=item=>{
  const value=item?.aisTracking?.estimatedArrivalAt;
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  return `${date.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'})} · ${date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})} · AIS`;
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
  const etaDate=call.etaDate||(!/confirmar/i.test(item?.eta||'')?String(item?.eta||'').slice(0,10):'');
  if(call.etbDate)return {date:call.etbDate,start:call.etbTime||'',source:'ETB'};
  if(etaDate)return {date:etaDate,start:call.etaTime||'',source:'ETA'};
  return {date:'',start:'',source:''};
};
const driverScheduleSnapshot=(data,driverName)=>{
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
const changedDriverSchedules=(previous,current)=>{
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
const SWIFTPORT_WAREHOUSE='ALMACÉN SWIFTPORT · Bluespace El Prat';
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
  if(/^BUQUE(?:\s+POR\s+CONFIRMAR)?(?:\s*[·-]\s*.*)?$/i.test(result)){
    result=`BUQUE ${nextName}${nextCase?.puerto?` · ${nextCase.puerto}`:''}`;
  }
  return result;
};
const syncLinkedTransportWithCase=(transport,previousCase,nextCase)=>{
  const parts=routeParts(transport);
  const origen=replaceLinkedVesselText(parts.origen,previousCase,nextCase);
  const destino=replaceLinkedVesselText(parts.destino,previousCase,nextCase);
  return {...transport,origen,destino,ruta:`${origen} → ${destino}`};
};
const OPERATION_STEPS=[
  {key:'review',title:'Expediente revisado',next:'Comprobar los datos del servicio y la mercancía',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'cargo',title:'Mercancía recibida o recogida',next:'Recibir en almacén o recoger en el punto indicado',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'documents',title:'Documentación del envío revisada',next:'Revisar y adjuntar la documentación antes de la entrega',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'assignment',title:'Conductor asignado',next:'Asignar o confirmar el responsable del transporte',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']},
  {key:'delivery',title:'Entrega confirmada con POD',next:'Entregar la mercancía y registrar fotos y POD firmado',responsibility:'LIBRE PARA TODOS',roles:['admin','operations','driver','finance']}
];
const canCompleteOperationStep=()=>true;
const operationFlow=item=>{
  if(item.operationalFlow){const stored=item.operationalFlow;const delivery=Boolean(stored.delivery||stored.pod);const assigned=Boolean(item.conductor&&item.conductor!=='Sin asignar');return {review:false,cargo:false,documents:false,assignment:false,delivery:false,billingReady:false,...stored,assignment:stored.assignment??Boolean(delivery||(stored.documents&&assigned)),delivery,billingReady:Boolean(stored.billingReady||delivery),review:stored.review??Boolean(stored.cargo||stored.documents||stored.delivered||stored.pod||stored.delivery)}};
  const progress=Number(item.progreso)||0;
  const completed=item.estado==='Completado'||progress>=100;
  return {review:progress>=25,cargo:progress>=50,documents:progress>=75,assignment:completed||Boolean(progress>=75&&item.conductor&&item.conductor!=='Sin asignar'),delivery:completed,billingReady:completed};
};
const operationProgress=item=>{
  const flow=operationFlow(item);
  return Math.round(OPERATION_STEPS.filter(step=>flow[step.key]).length/OPERATION_STEPS.length*100);
};
const nextOperationStep=item=>OPERATION_STEPS.find(step=>!operationFlow(item)[step.key])||null;
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
  return {...normalized,progreso:normalized.operationalFlow.billingReady?100:progress,siguiente:normalized.operationalFlow.billingReady?'Listo para facturar':next?.next||item.siguiente};
};
const numericWeight=value=>{const raw=String(value||'').replace(/[^\d.,]/g,'');if(raw.includes(',')&&raw.includes('.'))return Number(raw.replace(/\./g,'').replace(',','.'))||0;if(raw.includes(','))return Number(raw.replace(',','.'))||0;return Number(raw)||0};
const merchandiseWeight=lines=>(lines||[]).reduce((sum,line)=>sum+numericWeight(line.peso),0);
const merchandiseCount=lines=>(lines||[]).reduce((sum,line)=>sum+(Number(line.cantidad)||0),0);
const merchandiseWeightLabel=lines=>`${merchandiseWeight(lines).toLocaleString('es-ES',{maximumFractionDigits:2})} kg`;

async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(body.error||'No se pudo completar la operación.'),{status:response.status,body});
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

async function uploadAttachment(file,category,csrfToken){
  const data=new FormData();
  data.append('file',file);
  data.append('category',category);
  const response=await fetch('/api/uploads.php',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken},body:data});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||`No se pudo subir ${file.name}.`);
  return body.file;
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
      const gray=Math.max(0,Math.min(255,(sourcePixels[sourceOffset]*.299+sourcePixels[sourceOffset+1]*.587+sourcePixels[sourceOffset+2]*.114-18)*1.32+18));
      output.data[targetOffset]=gray;output.data[targetOffset+1]=gray;output.data[targetOffset+2]=gray;output.data[targetOffset+3]=255;
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

function AuthRoot(){
  const [session,setSession]=useState(null);
  const [setupRequired,setSetupRequired]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [finance,setFinance]=useState({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});
  const loadSession=async()=>{
    setLoading(true);setError('');
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
    if(!session||!(hasRole(session.user,'finance')||hasRole(session.user,'admin'))){setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});return}
    api('/api/finance.php').then(setFinance).catch(reason=>setError(reason.message));
  },[session?.user?.id,JSON.stringify(session?.user?.roles||[])]);
  const authenticated=result=>{if(!result?.user) throw new Error('Respuesta de acceso inválida.');setSession(result);setSetupRequired(false);setError('')};
  const logout=async()=>{
    try{await api('/api/auth/logout.php',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken}})}
    finally{setSession(null);setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]})}
  };
  const updateFinance=async next=>{await api('/api/finance.php',{method:'PUT',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify({clients:next.clients,invoices:next.invoices})});setFinance(next)};
  if(loading) return <AuthShell><div className="auth-loading"><span className="auth-spinner"/><b>Preparando Swiftport OS…</b></div></AuthShell>;
  if(!session) return <AuthShell>{setupRequired?<SetupForm onSuccess={authenticated} globalError={error}/>:<LoginForm onSuccess={authenticated} globalError={error}/>}</AuthShell>;
  return <App auth={session} finance={finance} onFinanceChange={updateFinance} onLogout={logout}/>;
}

function AuthShell({children}){
  return <main className="auth-page"><section className="auth-brand"><span className="brand-mark"><Anchor/></span><div><b>SWIFTPORT</b><small>OPERATING SYSTEM</small></div></section>{children}<p className="auth-footer">Acceso privado · Swiftport Logistic</p></main>;
}

function LoginForm({onSuccess,globalError}){
  const [form,setForm]=useState({email:'',password:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{onSuccess(await api('/api/auth/login.php',{method:'POST',body:JSON.stringify(form)}))}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <section className="auth-card"><span className="auth-icon"><LockKeyhole/></span><h1>Iniciar sesión</h1><p>Accede con tu cuenta de Swiftport.</p>{(error||globalError)&&<div className="form-error"><CircleAlert/>{error||globalError}</div>}<form onSubmit={submit}><label className="field"><span>Email</span><input type="email" autoComplete="username" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} required autoFocus/></label><label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} required/></label><button className="button primary full" disabled={busy}>{busy?'Comprobando…':'Entrar'}</button></form></section>;
}

function SetupForm({onSuccess,globalError}){
  const [form,setForm]=useState({fullName:'',email:'',password:'',setupToken:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{onSuccess(await api('/api/auth/setup.php',{method:'POST',body:JSON.stringify(form)}))}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <section className="auth-card setup-card"><span className="auth-icon"><ShieldCheck/></span><h1>Crear administrador</h1><p>Solo aparece una vez. Crea la primera cuenta con control total.</p>{(error||globalError)&&<div className="form-error"><CircleAlert/>{error||globalError}</div>}<form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required autoFocus/></label><label className="field"><span>Email</span><input name="email" type="email" autoComplete="username" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña (mínimo 4 caracteres)</span><input name="password" type="password" autoComplete="new-password" minLength="4" value={form.password} onChange={update} required/></label><label className="field"><span>Código inicial</span><input name="setupToken" type="password" autoComplete="off" value={form.setupToken} onChange={update} required/></label><button className="button primary full" disabled={busy}>{busy?'Creando cuenta…':'Crear administrador'}</button></form></section>;
}

function App({auth,finance,onFinanceChange,onLogout}){
  const user=auth.user;
  const [previewUser,setPreviewUser]=useState(null);
  const visibleUser=previewUser||user;
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
  const scheduleAlertsKey=`swiftport-driver-alerts-${user.id}`;
  const [scheduleAlerts,setScheduleAlerts]=useState(()=>{if(!hasRole(user,'driver'))return[];try{const stored=JSON.parse(localStorage.getItem(scheduleAlertsKey)||'[]');return Array.isArray(stored)?stored:[]}catch{return[]}});
  const scheduleSnapshotRef=useRef(null);
  const aisAlertSnapshotRef=useRef(null);
  const casesWithFinance=useMemo(()=>cases.map(item=>({...item,importe:finance.caseAmounts[item.id]||0})),[cases,finance.caseAmounts]);
  const selected=casesWithFinance.find(item=>item.id===selectedId)||casesWithFinance[0];
  const notify=message=>{setToast(message);window.clearTimeout(window.__swiftportToast);window.__swiftportToast=window.setTimeout(()=>setToast(''),2600)};
  const navigate=id=>{setTab(canAccess(effectiveRoles,id)?id:(availableNav[0]?.[0]||'dashboard'));setMenuOpen(false);setSearch('')};
  const loadTeam=()=>api('/api/users/directory.php').then(result=>setTeam(result.users)).catch(reason=>notify(reason.message));
  const loadOperational=()=>api('/api/operational.php').then(result=>{
    if(result.data){
      if(hasRole(user,'driver')){
        const storageKey=`swiftport-driver-schedule-${user.id}`;
        let stored=scheduleSnapshotRef.current;
        if(!stored){try{stored=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{stored=null}}
        const current=driverScheduleSnapshot(result.data,user.fullName);
        const changes=changedDriverSchedules(stored,current);
        if(changes.length)setScheduleAlerts(existing=>{const next=[...changes,...existing].slice(0,20);try{localStorage.setItem(scheduleAlertsKey,JSON.stringify(next))}catch{}return next});
        scheduleSnapshotRef.current=current;
        try{localStorage.setItem(storageKey,JSON.stringify(current))}catch{}
      }
      const loadedCases=result.data.cases.map(normalizeMerchandise);
      const hiddenVessels=Array.isArray(result.data.deletedVesselKeys)?result.data.deletedVesselKeys.filter(Boolean):[];
      const loadedVessels=mergeVesselCatalog(Array.isArray(result.data.vessels)?result.data.vessels:[],loadedCases).filter(vessel=>!hiddenVessels.includes(vesselKey(vessel.name)));
      setDeletedVesselKeys(hiddenVessels);setCases(loadedCases.map(item=>hydrateCaseWithVessel(item,loadedVessels)));setVessels(loadedVessels);setTransports(result.data.transports);setWarehouseEntries(result.data.warehouseEntries);if(result.data.customs)setCustoms(result.data.customs);if(result.data.calendarEvents)setCalendarEvents(result.data.calendarEvents.filter(isTransportCalendarEvent));if(Array.isArray(result.data.providers))setProviders(result.data.providers)
      const coherence=result.scheduleCoherence||{};
      const synced=Number(coherence.createdTransportEvents||0)+Number(coherence.createdTransports||0)+Number(coherence.updatedTransportEvents||0)+Number(coherence.updatedTransports||0);
      if(synced)notify(`${synced} transportes sincronizados con calendario`);
    }
    setOperationalLoaded(true)
  }).catch(reason=>{setOperationalLoaded(true);notify(reason.message)});
  useEffect(()=>{loadTeam();api('/api/clients/directory.php').then(result=>setClientOptions(result.clients.map(item=>item.name))).catch(()=>{});loadOperational();const timer=window.setInterval(loadOperational,45000);window.addEventListener('focus',loadOperational);return()=>{window.clearInterval(timer);window.removeEventListener('focus',loadOperational)}},[]);
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
      const visibleToDriver=!hasRole(user,'driver')||calendarEvents.some(event=>event.expediente===item.id&&(!event.asignado||event.asignado==='Sin asignar'||samePerson(event.asignado,user.fullName)));
      if(hadSnapshot&&visibleToDriver&&previous[item.id]!==tracking.alertKey)alerts.push({item,tracking});
    });
    aisAlertSnapshotRef.current=current;
    try{localStorage.setItem(storageKey,JSON.stringify(current))}catch{}
    if(!alerts.length)return;
    const {item,tracking}=alerts[0];
    const message=tracking.alertMessage||`${item.buque}: ${tracking.status}.`;
    notify(message);
    if(localStorage.getItem('swiftport-device-alerts')==='1')showDeviceNotification(`Swiftport · ${item.buque}`,message,tracking.alertKey).catch(()=>{});
  },[cases,calendarEvents,operationalLoaded]);
  const saveOperational=(nextCases=cases,nextTransports=transports,nextWarehouse=warehouseEntries,nextCustoms=customs,nextCalendar=calendarEvents,nextProviders=providers,nextVessels=vessels,nextDeletedVesselKeys=deletedVesselKeys)=>api('/api/operational.php',{method:'PUT',headers:{'X-CSRF-Token':auth.csrfToken},body:JSON.stringify({data:{cases:nextCases,transports:nextTransports,warehouseEntries:nextWarehouse,customs:nextCustoms,calendarEvents:nextCalendar,providers:nextProviders,vessels:nextVessels,deletedVesselKeys:nextDeletedVesselKeys}})}).catch(reason=>notify(reason.message));
  const operationalTeam=useMemo(()=>team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver')),[team]);
  useEffect(()=>{if(driverOnly&&!['calendario','almacen'].includes(tab))setTab('calendario')},[driverOnly,tab]);
  useEffect(()=>{
    if(!operationalLoaded)return;
    const missing=cases.flatMap((item,index)=>{
      if(warehouseEntries.some(entry=>entry.expediente===item.id))return[];
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
    if(!missing.length)return;
    const next=[...missing,...warehouseEntries];
    setWarehouseEntries(next);
    saveOperational(cases,transports,next);
    notify(`${missing.length} ${missing.length===1?'recepción sincronizada':'recepciones sincronizadas'} con Almacén`);
  },[operationalLoaded]);
  useEffect(()=>{
    if(!operationalLoaded||!team.length)return;
    const names=new Set(operationalTeam.map(member=>member.fullName));
    const normalizedCalendar=calendarEvents.filter(isTransportCalendarEvent).map(event=>{const asignado=event.asignado!=='Sin asignar'&&!names.has(event.asignado)?'Sin asignar':event.asignado;return {...event,asignado,tipoServicio:event.tipoServicio||'Transporte',color:driverTone(asignado,operationalTeam)}});
    const normalized=transports.map(item=>{const linked=normalizedCalendar.find(event=>event.transporte===item.id);const conductor=item.conductor!=='Sin asignar'&&!names.has(item.conductor)?'Sin asignar':linked?.asignado||item.conductor;return linked?{...item,conductor,fecha:linked.fecha,inicio:linked.inicio,fin:linked.fin,hora:formatSchedule(linked.fecha,linked.inicio,linked.fin),estado:conductor==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:{...item,conductor,estado:conductor==='Sin asignar'?'Sin asignar':item.estado}});
    const changed=normalized.some((item,index)=>JSON.stringify(item)!==JSON.stringify(transports[index]))||normalizedCalendar.some((item,index)=>item.color!==calendarEvents[index]?.color);
    if(changed){setTransports(normalized);setCalendarEvents(normalizedCalendar);saveOperational(cases,normalized,warehouseEntries,customs,normalizedCalendar)}
  },[operationalLoaded,team.length]);
  const openCase=id=>{setSelectedId(id);navigate('expedientes')};
  const createCase=form=>{
    const nextNumber=49+cases.length-expedientesIniciales.length;
    const id='SW-2026-'+String(nextNumber).padStart(4,'0');
    const etaDate=String(form.eta||'').slice(0,10);
    const etaTime=String(form.eta||'').slice(11,16);
    const known=findKnownVessel(vessels,form.buque)||{};
    const item=normalizeMerchandise({id,buque:form.buque.toUpperCase(),imo:cleanImo(form.imo)||known.imo||'',mmsi:cleanMmsi(form.mmsi)||known.mmsi||'',cliente:form.cliente,puerto:form.puerto,eta:etaDate||'Por confirmar',portCall:{etaDate,etaTime,etbDate:'',etbTime:'',etdDate:'',etdTime:'',updatedAt:new Date().toISOString()},estado:'Nuevo',prioridad:form.prioridad,conductor:'Sin asignar',servicios:[form.createReception&&'Recepción',form.createTransport&&'Transporte'].filter(Boolean),bultos:Number(form.bultos)||0,peso:'Por registrar',progreso:0,siguiente:'Revisar expediente y servicios programados',aduana:'Por revisar',autoTransportDisabled:false});
    const stamp=Date.now();
    const receptionEvent=form.createReception&&form.receptionDate?{id:`EV-${stamp}-R`,titulo:form.receptionLocation||'Recepción en almacén',tipoServicio:'Recepción',fecha:form.receptionDate,inicio:form.receptionStart,fin:form.receptionEnd,asignado:'Sin asignar',expediente:id,transporte:'',color:'gray'}:null;
    const transportDate=form.transportDate||etaDate;
    const shouldCreateTransport=Boolean(form.createTransport&&transportDate);
    const transportId=shouldCreateTransport?`TR-${stamp}`:'';
    const route=[form.transportPickup,form.transportDelivery].filter(Boolean).join(' → ')||`ALMACÉN → ${form.puerto}`;
    const assignedDriver=form.transportConductor||'Sin asignar';
    const transport=shouldCreateTransport?{id:transportId,expediente:id,origen:form.transportPickup,destino:form.transportDelivery,ruta:route,fecha:transportDate,inicio:form.transportStart,fin:form.transportEnd,hora:formatSchedule(transportDate,form.transportStart,form.transportEnd),conductor:assignedDriver,proveedorId:'',vehiculo:'Por asignar',estado:assignedDriver==='Sin asignar'?'Sin asignar':'Asignado'}:null;
    const transportEvent=transport?{id:`EV-${stamp}-T`,titulo:route,origen:transport.origen,destino:transport.destino,tipoServicio:'Transporte',fecha:transport.fecha,inicio:transport.inicio,fin:transport.fin,asignado:assignedDriver,expediente:id,transporte:transportId,proveedorId:'',color:driverTone(assignedDriver,operationalTeam)}:null;
    const nextCases=[item,...cases];
    const nextTransports=transport?[transport,...transports]:transports;
    const nextCalendar=[transportEvent].filter(Boolean).concat(calendarEvents.filter(isTransportCalendarEvent));
    const nextVessels=upsertVesselFromCase(vessels,item);
    setCases(nextCases);setTransports(nextTransports);setCalendarEvents(nextCalendar);setVessels(nextVessels);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,nextVessels);setSelectedId(item.id);setNewOpen(false);setTab('expedientes');notify(`Expediente ${item.id} creado con ${nextCalendar.length-calendarEvents.length} trabajos programados`);
  };
  const updateTransport=updated=>{const parts=routeParts(updated);const normalized={...updated,...parts,ruta:`${parts.origen} → ${parts.destino}`,hora:formatSchedule(updated.fecha,updated.inicio,updated.fin),scheduleSource:'manual',scheduleStatus:updated.inicio?'confirmed':'missing_time',scheduleNote:updated.inicio?'':'Falta hora ETB; pendiente de confirmar horario'};const nextTransports=transports.map(item=>item.id===updated.id?normalized:item);const nextCases=cases.map(item=>{if(item.id!==updated.expediente)return item;const flow=operationFlow(item);const assigned=Boolean(updated.conductor&&updated.conductor!=='Sin asignar');const changed=assigned&&item.conductor!==updated.conductor;const now=new Date();return normalizeMerchandise({...item,autoTransportDisabled:false,conductor:updated.conductor,operationalFlow:{...flow,assignment:flow.delivery||assigned},timelineCustom:changed?[{id:`ASSIGN-${item.id}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Conductor asignado',detalle:`${updated.conductor} · ${normalized.ruta}`,actor:visibleUser.fullName,estado:'done'},...(item.timelineCustom||[])]:item.timelineCustom})});const linkedEvent=calendarEvents.find(item=>item.transporte===updated.id);const synchronized={titulo:normalized.ruta,origen:normalized.origen,destino:normalized.destino,tipoServicio:'Transporte',fecha:updated.fecha,inicio:updated.inicio,fin:updated.fin,asignado:updated.conductor,proveedorId:updated.proveedorId||'',expediente:updated.expediente,transporte:updated.id,color:driverTone(updated.conductor,operationalTeam),scheduleSource:'manual',scheduleStatus:normalized.scheduleStatus,scheduleNote:normalized.scheduleNote};const nextCalendar=(linkedEvent?calendarEvents.map(item=>item.transporte===updated.id?{...item,...synchronized}:item):[...calendarEvents,{id:'EV-'+Date.now(),...synchronized}]).filter(isTransportCalendarEvent);setTransports(nextTransports);setCases(nextCases);setCalendarEvents(nextCalendar);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify('Ruta, transporte y calendario actualizados')};
  const updateCase=updated=>{
    const {importe,...rawCase}=updated;
    const previousCase=cases.find(item=>item.id===rawCase.id)||{};
    const known=findKnownVessel(vessels,rawCase.buque)||{};
    const manualVesselName=!sameVessel(previousCase.buque,rawCase.buque)||String(previousCase.buque||'').trim().toUpperCase()!==String(rawCase.buque||'').trim().toUpperCase();
    const operationalCase=normalizeMerchandise({...rawCase,buque:String(rawCase.buque||'').trim().toUpperCase(),imo:cleanImo(rawCase.imo)||known.imo||'',mmsi:cleanMmsi(rawCase.mmsi)||known.mmsi||'',manualVesselName:manualVesselName?true:rawCase.manualVesselName,manualEditedAt:manualVesselName?new Date().toISOString():rawCase.manualEditedAt});
    const next=cases.map(item=>item.id===operationalCase.id?operationalCase:item);
    const nextVessels=upsertVesselFromCase(vessels,operationalCase);
    const activeEntries=warehouseEntries.filter(entry=>entry.expediente===operationalCase.id&&!entry.archivado);
    const nextWarehouse=warehouseEntries.map(entry=>{
      if(entry.expediente!==operationalCase.id)return entry;
      const renamed={...entry,buque:operationalCase.buque};
      return activeEntries.length===1&&entry.ref===activeEntries[0].ref?{...renamed,mercancias:operationalCase.mercancias,bultos:merchandiseCount(operationalCase.mercancias),peso:merchandiseWeightLabel(operationalCase.mercancias)}:renamed;
    });
    const slot=transportSlotFromCase(operationalCase);
    const end=slot.start?plusHourClient(slot.start):'';
    const scheduleStatus=slot.start?'confirmed':'missing_time';
    const scheduleNote=slot.start?`Programado por ${slot.source}`:`Falta hora ${slot.source||'ETB/ETA'}; pendiente de confirmar horario del buque`;
    const nextTransports=transports.map(item=>{
      if(item.expediente!==operationalCase.id)return item;
      const linked=syncLinkedTransportWithCase(item,previousCase,operationalCase);
      return slot.date?{...linked,fecha:slot.date,inicio:slot.start,fin:end,hora:slot.start?formatSchedule(slot.date,slot.start,end):`${slot.date} · FALTA HORARIO`,scheduleStatus,scheduleNote}:linked;
    });
    const nextCalendar=calendarEvents.map(event=>{
      if(event.expediente!==operationalCase.id||!isTransportCalendarEvent(event))return event;
      const linkedTransport=nextTransports.find(item=>item.id===event.transporte);
      const syncedRoute=linkedTransport?transportRoute(linkedTransport):replaceLinkedVesselText(event.titulo,previousCase,operationalCase);
      const base={...event,titulo:syncedRoute,origen:linkedTransport?.origen||event.origen,destino:linkedTransport?.destino||event.destino};
      return slot.date&&event.scheduleSource!=='manual'?{...base,fecha:slot.date,inicio:slot.start,fin:end,scheduleStatus,scheduleNote}:base;
    });
    setCases(next);setVessels(nextVessels);setWarehouseEntries(nextWarehouse);setTransports(nextTransports);setCalendarEvents(nextCalendar);
    saveOperational(next,nextTransports,nextWarehouse,customs,nextCalendar,providers,nextVessels);
    notify(slot.date?'Expediente, buque, almacén y calendario actualizados':(activeEntries.length===1?'Expediente, buque y almacén actualizados':'Expediente y buque actualizados'));
  };
  const deleteCase=id=>{const target=cases.find(item=>item.id===id);if(!target)return;const linkedWarehouse=warehouseEntries.filter(entry=>entry.expediente===id&&!entry.archivado);const warning=linkedWarehouse.length?`\n\nTiene ${linkedWarehouse.length} entrada(s) de almacén vinculada(s). No se borrará la mercancía: quedará sin expediente para no perder evidencias.`:'';if(!window.confirm(`¿Borrar el expediente ${target.id} - ${target.buque}?${warning}\n\nSe quitarán sus trabajos del calendario y transportes.`))return;const nextCases=cases.filter(item=>item.id!==id);const nextTransports=transports.filter(item=>item.expediente!==id);const nextCalendar=calendarEvents.filter(item=>item.expediente!==id);const nextCustoms=customs.filter(item=>item.expediente!==id);const nextWarehouse=warehouseEntries.map(entry=>entry.expediente===id?{...entry,expediente:''}:entry);setCases(nextCases);setTransports(nextTransports);setCalendarEvents(nextCalendar);setCustoms(nextCustoms);setWarehouseEntries(nextWarehouse);saveOperational(nextCases,nextTransports,nextWarehouse,nextCustoms,nextCalendar);setSelectedId(nextCases[0]?.id||'');notify('Expediente borrado y calendario limpiado')};
  const rebuildCalendarServices=async()=>{const activeCaseIds=new Set(cases.filter(item=>item.estado!=='Completado').map(item=>item.id));const affected=calendarEvents.filter(event=>activeCaseIds.has(event.expediente)).length;const affectedTransports=transports.filter(item=>activeCaseIds.has(item.expediente)).length;if(!affected&&!affectedTransports){notify('No hay servicios activos que limpiar');return}if(!window.confirm(`¿Limpiar y reconstruir el calendario?\n\nSe quitarán ${affected} tarjetas del calendario y ${affectedTransports} transportes planificados de expedientes activos. No se borran expedientes, mercancía ni documentos. Después se reconstruirá SOLO con transportes usando ETB/fecha del buque.`))return;const nextCalendar=calendarEvents.filter(event=>!activeCaseIds.has(event.expediente));const nextTransports=transports.filter(item=>!activeCaseIds.has(item.expediente));setCalendarEvents(nextCalendar);setTransports(nextTransports);await saveOperational(cases,nextTransports,warehouseEntries,customs,nextCalendar);notify('Calendario limpiado; reconstruyendo solo transportes');await loadOperational()};
  const updateClient=updated=>{const next={...finance,clients:finance.clients.map(item=>item.codigo===updated.codigo?updated:item)};onFinanceChange(next).then(()=>notify('Cliente y tarifas actualizados')).catch(reason=>notify(reason.message))};
  const updateInvoice=updated=>{const next={...finance,invoices:finance.invoices.map(item=>item.id===updated.id?updated:item)};onFinanceChange(next).then(()=>notify('Documento actualizado')).catch(reason=>notify(reason.message))};
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
          detalle:`${normalized.ref} · ${normalized.bultos} bultos · ${normalized.peso} · Zona ${normalized.zona}`,
          actor:visibleUser.fullName,
          estado:'done'
        },...(item.timelineCustom||[])]:item.timelineCustom
      }:item);
    }
    setWarehouseEntries(next);setCases(nextCases);saveOperational(nextCases,transports,next);
    notify(relatedCase&&previous?.expediente!==updated.expediente?'Mercancía vinculada al expediente':'Entrada de almacén actualizada');
  };
  const deleteWarehouseEntry=entry=>{
    if(!window.confirm(`¿Eliminar la entrada ${entry.ref} de almacén?\n\nSe quitará del stock y del expediente vinculado, pero no tocará documentos subidos en otros pasos.`))return;
    const nextWarehouse=warehouseEntries.filter(item=>item.ref!==entry.ref);
    const affectedCaseIds=[entry.expediente].filter(Boolean);
    const nextCases=affectedCaseIds.length?cases.map(item=>affectedCaseIds.includes(item.id)?syncCaseWithWarehouseEntries({...item,recepciones:(item.recepciones||[]).filter(reception=>reception.ref!==entry.ref)},nextWarehouse):item):cases;
    setWarehouseEntries(nextWarehouse);setCases(nextCases);saveOperational(nextCases,transports,nextWarehouse);notify('Entrada de almacén eliminada');
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
    saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar,providers,vessels);
    notify(hasOtherTransport?'Servicio eliminado del calendario':'Servicio eliminado; no se recreará automáticamente hasta crear otro transporte');
  };
  const saveCalendarEvent=event=>{
    let colored={...event,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:driverTone(event.asignado,operationalTeam)};
    if(!isTransportCalendarEvent(colored)){notify('El calendario solo muestra transportes. Las recepciones se registran desde Almacén/Expediente.');return}
    colored={...colored,scheduleSource:'manual',scheduleStatus:colored.inicio?'confirmed':'missing_time',scheduleNote:colored.inicio?'':'Falta hora ETB; pendiente de confirmar horario'};
    let nextTransports=transports;
    if(colored.tipoServicio==='Transporte'){
      const parts=routeParts({origen:colored.origen,destino:colored.destino,ruta:colored.titulo});
      const route=`${parts.origen} → ${parts.destino}`;
      colored={...colored,...parts,titulo:route};
      const scheduleFields={scheduleSource:colored.scheduleSource||'manual',scheduleStatus:colored.scheduleStatus,scheduleNote:colored.scheduleNote};
      if(!colored.transporte){
        const transportId=`TR-${Date.now()}`;
        colored={...colored,transporte:transportId};
        nextTransports=[{id:transportId,expediente:colored.expediente,...parts,ruta:route,fecha:colored.fecha,inicio:colored.inicio,fin:colored.fin,hora:formatSchedule(colored.fecha,colored.inicio,colored.fin),conductor:colored.asignado,proveedorId:colored.proveedorId||'',vehiculo:'Por asignar',estado:colored.asignado==='Sin asignar'?'Sin asignar':'Asignado',...scheduleFields},...transports];
      }else{
        nextTransports=transports.map(item=>item.id===colored.transporte?{...item,...parts,expediente:colored.expediente||item.expediente,ruta:route,conductor:colored.asignado,proveedorId:colored.proveedorId||item.proveedorId||'',fecha:colored.fecha,inicio:colored.inicio,fin:colored.fin,hora:formatSchedule(colored.fecha,colored.inicio,colored.fin),estado:colored.asignado==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado,...scheduleFields}:item);
      }
    }
    const exists=calendarEvents.some(item=>item.id===colored.id);
    const nextCalendar=(exists?calendarEvents.map(item=>item.id===colored.id?colored:item):[...calendarEvents,colored]).filter(isTransportCalendarEvent);
    const previousCalendar=calendarEvents.find(item=>item.id===colored.id)||calendarEvents.find(item=>colored.transporte&&item.transporte===colored.transporte);
    const previousTransport=transports.find(item=>item.id===colored.transporte);
    const oldSchedule=[previousCalendar?.fecha||previousTransport?.fecha,previousCalendar?.inicio||previousTransport?.inicio,previousCalendar?.fin||previousTransport?.fin].filter(Boolean).join(' ');
    const newSchedule=[colored.fecha,colored.inicio,colored.fin].filter(Boolean).join(' ');
    const scheduleChanged=Boolean(oldSchedule&&newSchedule&&oldSchedule!==newSchedule);
    const nextCases=cases.map(item=>{if(item.id!==colored.expediente)return item;const flow=operationFlow(item);const isTransport=colored.tipoServicio==='Transporte';const assigned=Boolean(colored.asignado&&colored.asignado!=='Sin asignar');const changed=isTransport&&assigned&&item.conductor!==colored.asignado;const now=new Date();const timelineUpdates=[...(scheduleChanged?[{id:`MOVE-${item.id}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Transporte reprogramado',detalle:`${oldSchedule} → ${newSchedule} · ${colored.titulo}`,actor:visibleUser.fullName,estado:'done'}]:[]),...(changed?[{id:`ASSIGN-${item.id}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:'Conductor asignado',detalle:`${colored.asignado} · ${colored.titulo}`,actor:visibleUser.fullName,estado:'done'}]:[])];return normalizeMerchandise({...item,autoTransportDisabled:false,conductor:colored.asignado,operationalFlow:isTransport?{...flow,assignment:flow.delivery||assigned}:flow,timelineCustom:timelineUpdates.length?[...timelineUpdates,...(item.timelineCustom||[])]:item.timelineCustom})});
    setCalendarEvents(nextCalendar);setTransports(nextTransports);setCases(nextCases);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify(exists?'Tarea, transporte y expediente actualizados':'Trabajo añadido y sincronizado con el calendario');
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
    if(!target)return;
    const expected=nextOperationStep(target);
    if(!expected||expected.key!==stepKey){notify('Completa primero el paso anterior');return}
    const evidencePayload=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)&&Array.isArray(evidence.files)?evidence:null;
    const evidenceFiles=Array.isArray(evidence)?evidence.filter(Boolean):evidencePayload?evidencePayload.files.filter(Boolean):evidence?[evidence]:[];
    const selectedWarehouseRefs=Array.isArray(evidencePayload?.warehouseRefs)?evidencePayload.warehouseRefs:[];
    const selectedWarehouseEntries=stepKey==='cargo'?warehouseEntries.filter(entry=>selectedWarehouseRefs.includes(entry.ref)):[]; 
    const cargoEvidence=stepKey==='cargo'?evidenceFiles:[];
    const cargoHasWarehouse=stepKey==='cargo'&&selectedWarehouseEntries.length>0;
    const documentEvidence=stepKey==='documents'?evidenceFiles:[];
    const deliveryPhotos=stepKey==='delivery'?evidenceFiles.filter(file=>file.evidenceType==='delivery-photo'):[];
    const podFiles=stepKey==='delivery'?evidenceFiles.filter(file=>file.evidenceType==='pod'||(!file.evidenceType&&file)):[];
    if(stepKey==='cargo'&&!cargoEvidence.length&&!cargoHasWarehouse){notify('Añade una foto o selecciona una mercancía existente en almacén');return}
    if(stepKey==='delivery'&&!deliveryPhotos.length){notify('Añade al menos una foto de la mercancía entregada');return}
    if(stepKey==='delivery'&&!podFiles.length){notify('Escanea o adjunta el POD firmado');return}
    const flow={...operationFlow(target),[stepKey]:true};
    const ready=stepKey==='delivery';
    if(ready)flow.billingReady=true;
    const nextStep=OPERATION_STEPS.find(step=>!flow[step.key]);
    const now=new Date();
    const deliveryWarehouseScope=ready?warehouseEntriesForVessel(warehouseEntries,target):[];
    const warehouseReviewNote=ready?` Almacén revisado: ${deliveryWarehouseScope.length} partida(s) activa(s) para ${target.buque}.`:'';
    const linkedWarehouseNote=cargoHasWarehouse?` Almacén vinculado: ${selectedWarehouseEntries.map(entry=>entry.ref).join(', ')}.`:'';
    const timelineEntry={id:`FLOW-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:expected.title,detalle:`${note||'Paso confirmado sin incidencias'}${linkedWarehouseNote}${warehouseReviewNote}`,actor:visibleUser.fullName,archivo:ready?podFiles[0]||null:null,archivos:stepKey==='cargo'?[...cargoEvidence,...selectedWarehouseEntries.flatMap(entry=>[...(entry.fotos||[]),...(entry.documentosRecepcion||[])])]:stepKey==='documents'?documentEvidence:[...deliveryPhotos,...podFiles.slice(1)],estado:'done'};
    const linkedTransport=transports.find(item=>item.expediente===id);
    const warehouseMerchandise=selectedWarehouseEntries.flatMap(entry=>entry.mercancias||[]);
    const cargoMerchandise=warehouseMerchandise.length?warehouseMerchandise:(target.mercancias||[]).length?target.mercancias:[{id:`${id}-AUTO-${Date.now()}`,tipo:'CAJA',cantidad:Math.max(1,Number(target.bultos)||1),seguimiento:'',peso:target.peso&&!/registrar|pendiente/i.test(target.peso)?target.peso:'PESO PENDIENTE',documentos:[]}];
    const cargoPhotos=cargoEvidence.map((file,index)=>({...file,tipo:index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercancia:cargoMerchandise.map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'} · ${line.peso||'PESO PENDIENTE'}`).join(' · '),nota:`Registrado por ${visibleUser.fullName}`}));
    const cargoReference=`ALM-${Date.now()}`;
    const cargoReceptions=stepKey==='cargo'?(cargoHasWarehouse?selectedWarehouseEntries.map(entry=>({ref:entry.ref,source:'warehouse-linked',fecha:entry.fechaRecepcion||entry.entrada||now.toISOString(),zona:entry.zona||'ALMACÉN',peso:entry.peso||merchandiseWeightLabel(entry.mercancias||[]),mercancias:entry.mercancias||[],fotos:entry.fotos||[],documentos:entry.documentosRecepcion||[]})):[{ref:cargoReference,source:'driver-flow',fecha:now.toISOString(),zona:linkedTransport?.origen||'PENDIENTE DE UBICAR',peso:merchandiseWeightLabel(cargoMerchandise),mercancias:cargoMerchandise,fotos:cargoPhotos,documentos:[]}]):[];
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,mercancias:stepKey==='cargo'?cargoMerchandise:item.mercancias,operationalFlow:flow,progreso:ready?100:Math.round(OPERATION_STEPS.filter(step=>flow[step.key]).length/OPERATION_STEPS.length*100),siguiente:ready?'Listo para facturar':nextStep?.next||'',estado:ready?'Completado':'En curso',recepciones:cargoReceptions.length?[...cargoReceptions,...(item.recepciones||[])]:item.recepciones,documentacionMercancia:stepKey==='documents'?{...item.documentacionMercancia,archivosEnvio:[...(item.documentacionMercancia?.archivosEnvio||[]),...documentEvidence],revisada:true}:ready?{...item.documentacionMercancia,podDisponible:true,podArchivo:podFiles[0]||item.documentacionMercancia?.podArchivo||null,podArchivos:podFiles,fotosEntrega:deliveryPhotos}:item.documentacionMercancia,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=ready?transports.map(item=>item.expediente===id?{...item,estado:'Entregado'}:item):transports;
    const alreadyInWarehouse=warehouseEntries.some(item=>item.expediente===id&&!item.archivado&&item.estado!=='Expedido');
    const automaticWarehouseEntry=stepKey==='cargo'&&!alreadyInWarehouse?{ref:cargoReference,source:'driver-flow',expediente:id,buque:target.buque,zona:'PENDIENTE',entrada:formatReceptionDate(now.toISOString()),fechaRecepcion:now.toISOString(),bultos:merchandiseCount(cargoMerchandise),peso:merchandiseWeightLabel(cargoMerchandise),mercancias:cargoMerchandise,fotos:cargoPhotos,documentosRecepcion:[],dias:0,estado:'En stock',archivado:false}:null;
    const nextWarehouse=ready?warehouseEntries.map(item=>deliveryWarehouseScope.includes(item)?{...item,expediente:item.expediente||id,estado:'Expedido',archivado:true,salida:new Date().toISOString()}:item):cargoHasWarehouse?warehouseEntries.map(entry=>selectedWarehouseRefs.includes(entry.ref)?{...entry,expediente:id,buque:target.buque,estado:entry.estado||'En stock',archivado:false}:entry):automaticWarehouseEntry?[automaticWarehouseEntry,...warehouseEntries]:warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse);
    notify(ready?'POD registrado: expediente listo para facturar':expected.title+' registrado');
  };
  const undoCaseStep=(id,stepKey)=>{
    const target=cases.find(item=>item.id===id);
    if(!target)return;
    const currentFlow=operationFlow(target);
    const completedSteps=OPERATION_STEPS.filter(step=>currentFlow[step.key]);
    const lastCompleted=completedSteps[completedSteps.length-1];
    if(!lastCompleted||lastCompleted.key!==stepKey){notify('Solo puedes deshacer el último paso completado');return}
    const flow={...currentFlow,[stepKey]:false};
    if(stepKey==='delivery'){flow.delivery=false;flow.pod=false;flow.billingReady=false}
    const reopened=OPERATION_STEPS.find(step=>step.key===stepKey);
    const progress=Math.round(OPERATION_STEPS.filter(step=>flow[step.key]).length/OPERATION_STEPS.length*100);
    const now=new Date();
    const timelineEntry={id:`UNDO-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:`Paso reabierto: ${reopened.title}`,detalle:'El conductor deshizo la confirmación para corregir o repetir este paso',actor:visibleUser.fullName,estado:'done'};
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,operationalFlow:flow,progreso:progress,siguiente:reopened.next,estado:'En curso',recepciones:stepKey==='cargo'?(item.recepciones||[]).filter(reception=>reception.source!=='driver-flow'):item.recepciones,documentacionMercancia:stepKey==='delivery'?{...item.documentacionMercancia,podDisponible:false,podArchivo:null,podArchivos:[],fotosEntrega:[]}:item.documentacionMercancia,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=stepKey==='delivery'?transports.map(item=>item.expediente===id?{...item,estado:item.conductor&&item.conductor!=='Sin asignar'?'Asignado':'Sin asignar'}:item):transports;
    const nextWarehouse=stepKey==='delivery'?warehouseEntries.map(item=>item.expediente===id?{...item,estado:'En stock',archivado:false,salida:null}:item):stepKey==='cargo'?warehouseEntries.filter(item=>!(item.expediente===id&&item.source==='driver-flow')):warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse);
    notify(`${reopened.title} reabierto`);
  };
  const registerWarehouseEntry=form=>{
    const relatedCase=cases.find(item=>item.id===form.expediente);
    const nextReference=319+warehouseEntries.length-movimientosAlmacen.length;
    const reference='ALM-'+nextReference;
    const merchandise=form.mercancias.map((line,index)=>({
      id:`${form.expediente||'SIN-EXP'}-${reference}-M${index+1}`,
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
      buque:relatedCase?.buque||form.identificacion?.trim()||'Mercancía sin identificar',
      zona:form.zona.toUpperCase(),
      entrada:formatReceptionDate(form.fechaRecepcion),
      bultos:totalPackages,
      peso:totalWeight.toLocaleString('es-ES',{maximumFractionDigits:2})+' kg',
      mercancias:merchandise,
      fotos:form.fotos||[],
      documentosRecepcion:form.documentosRecepcion||[],
      dias:0,
      estado:'En stock'
    };
    const reception={ref:reference,fecha:form.fechaRecepcion,zona:item.zona,peso:item.peso,mercancias:merchandise,fotos:item.fotos,documentos:item.documentosRecepcion};
    const summary=merchandise.map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'}`).join(' · ');
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
          detalle:`${formatReceptionDate(form.fechaRecepcion)} · ${summary} · Zona ${item.zona}`,
          actor:visibleUser.fullName,
          estado:'done'
        },...(entry.timelineCustom||[])]
      });
    });
    const next=[item,...warehouseEntries];setWarehouseEntries(next);setCases(nextCases);saveOperational(nextCases,transports,next);
    notify(relatedCase?`Entrada ${item.ref} vinculada a ${relatedCase.id}`:`Entrada ${item.ref} guardada sin expediente`);
  };
  const [title,subtitle]=TITLES[tab];
  const startPreview=member=>{setPreviewUser(member);setTab('dashboard');notify('Vista previa activada')};
  const assignedAlerts=(hasRole(effectiveRoles,'operations')||hasRole(effectiveRoles,'driver'))
    ? calendarEvents.filter(event=>samePerson(event.asignado,visibleUser.fullName)&&cases.find(item=>item.id===event.expediente)?.estado!=='Completado')
    : calendarEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar');
  const notificationCount=assignedAlerts.length+(hasRole(effectiveRoles,'driver')?scheduleAlerts.length:0);
  const scheduleAlert=scheduleAlerts[0];
  return <div className="shell">
    <Sidebar tab={tab} open={menuOpen} navigate={navigate} close={()=>setMenuOpen(false)} nav={availableNav} user={visibleUser} onLogout={onLogout}/>
    {menuOpen&&<button className="scrim" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>} 
    <main className="main">
      <header className="topbar">
        <div className="topbar-title">
          <button className="icon-button menu-button" aria-label="Abrir menú" onClick={()=>setMenuOpen(true)}><Menu/></button>
          <div><div className="eyebrow">Operaciones · {new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div><h1>{title}</h1><p>{subtitle}</p></div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button notification" aria-label="Notificaciones" onClick={()=>{navigate('calendario');notify(scheduleAlerts.length?`Tienes ${scheduleAlerts.length} cambios de horario sin leer`:assignedAlerts.length?`Tienes ${assignedAlerts.length} servicios que requieren atención`:'No tienes avisos operativos')}}><Bell/>{notificationCount>0&&<i>{notificationCount}</i>}</button>
          {!driverOnly&&<button className="button primary" aria-label="Nuevo expediente" onClick={()=>setNewOpen(true)}><Plus/> <span>Nuevo expediente</span></button>}
          <div className="avatar" title={visibleUser.fullName+' · '+roleLabel(visibleUser)}>{initials(visibleUser.fullName)}</div>
        </div>
      </header>
      <div className="content">
        {previewUser&&<div className="preview-banner"><Eye/><span>Estás viendo la aplicación como <b>{previewUser.fullName}</b> ({roleLabel(previewUser)}). Tu cuenta sigue siendo administrador.</span><button onClick={()=>setPreviewUser(null)}>Salir de la vista previa</button></div>}
        {hasRole(effectiveRoles,'driver')&&scheduleAlert&&<section className="schedule-change-alert" role="alert"><Clock3/><div><small>HORARIO ACTUALIZADO · {scheduleAlert.service}</small><b>{scheduleAlert.title}</b>{scheduleAlert.oldEta!==scheduleAlert.newEta&&<p>ETA: <s>{scheduleAlert.oldEta}</s> → <strong>{scheduleAlert.newEta}</strong></p>}{scheduleAlert.oldTask!==scheduleAlert.newTask&&<p>Servicio: <s>{scheduleAlert.oldTask}</s> → <strong>{scheduleAlert.newTask}</strong></p>}</div><button className="button secondary" onClick={()=>setScheduleAlerts(alerts=>{const next=alerts.slice(1);try{localStorage.setItem(scheduleAlertsKey,JSON.stringify(next))}catch{}return next})}>Entendido</button></section>}
        {tab==='dashboard'&&<Dashboard cases={casesWithFinance} warehouseEntries={warehouseEntries} calendarEvents={calendarEvents} openCase={openCase} navigate={navigate} showFinance={showFinance} user={visibleUser}/>}
        {tab==='calendario'&&<>{!driverOnly&&<DriverLegend team={operationalTeam}/>}<Calendario events={calendarEvents} team={operationalTeam} cases={cases} transports={transports} providers={providers} warehouseEntries={warehouseEntries} saveEvent={saveCalendarEvent} deleteEvent={deleteCalendarService} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} openCase={openCase} currentUser={visibleUser} csrfToken={auth.csrfToken} reloadOperational={loadOperational} notify={notify}/></>}
        {tab==='expedientes'&&<Expedientes cases={casesWithFinance} selected={selected} select={setSelectedId} search={search} setSearch={setSearch} completeCaseStep={completeCaseStep} notify={notify} showFinance={showFinance} updateCase={updateCase} deleteCase={deleteCase} clientOptions={clientOptions} warehouseEntries={warehouseEntries} transports={transports} calendarEvents={calendarEvents} team={operationalTeam} providers={providers} vessels={vessels} saveEvent={saveCalendarEvent} csrfToken={auth.csrfToken} reloadOperational={loadOperational} currentUser={visibleUser}/>}
        {tab==='almacen'&&<Almacen items={warehouseEntries} cases={casesWithFinance} openCase={openCase} registerEntry={registerWarehouseEntry} updateEntry={updateWarehouseEntry} deleteEntry={deleteWarehouseEntry} showFinance={showFinance} storageTotal={finance.warehouseStorageTotal} csrfToken={auth.csrfToken}/>}
        {tab==='buques'&&<Buques vessels={vessels} cases={casesWithFinance} warehouseEntries={warehouseEntries} saveVessel={saveVessel} deleteVessel={deleteVessel} openCase={openCase}/>}
        {tab==='transportes'&&<Transportes items={transports} update={updateTransport} openCase={openCase} team={operationalTeam} providers={providers} saveProvider={saveProvider}/>}
        {tab==='aduanas'&&<Aduanas items={customs} update={updateCustom} openCase={openCase} notify={notify}/>}
        {tab==='correos'&&<Correos csrfToken={auth.csrfToken} notify={notify} openCase={openCase} reloadOperational={loadOperational} canRebuild={hasRole(effectiveRoles,'admin')}/>}
        {tab==='clientes'&&showFinance&&<Clientes notify={notify} clients={finance.clients} updateClient={updateClient}/>}
        {tab==='facturacion'&&showFinance&&<Facturacion openCase={openCase} notify={notify} invoices={finance.invoices} cases={casesWithFinance} updateInvoice={updateInvoice}/>}
        {tab==='usuarios'&&hasRole(user,'admin')&&!previewUser&&<Usuarios csrfToken={auth.csrfToken} notify={notify} onPreview={startPreview} onUsersChanged={loadTeam}/>}
      </div>
    </main>
    <MobileNav tab={tab} navigate={navigate} more={()=>setMenuOpen(true)} nav={availableNav}/>
    {newOpen&&<NewCaseModal clientOptions={clientOptions} vessels={vessels} team={operationalTeam} close={()=>setNewOpen(false)} submit={createCase}/>}
    {toast&&<div className="toast" role="status"><CheckCircle2/>{toast}</div>}
  </div>;
}

const initials=name=>name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toUpperCase();
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
function PortCallPanel({item}){const schedule=portCallSchedule(item);const destination=item.deliveryMode==='barge'?'TRANSPORTE A GABARRA':item.deliveryMode==='vessel'?'TRANSPORTE A BUQUE':'';return <section className="port-call-panel"><div><Ship/><span><small>LLEGADA · ETA</small><b>{schedule.eta}</b></span></div><div><MapPin/><span><small>ATRAQUE · ETB</small><b>{schedule.etb}</b></span></div><div><Clock3/><span><small>SALIDA · ETD</small><b>{schedule.etd}</b></span></div><div><Timer/><span><small>ESTANCIA EN PUERTO</small><b>{item.portStay||'POR CONFIRMAR'}</b></span></div>{destination&&<footer><Truck/><span><small>DESTINO OPERATIVO</small><b>{destination}{item.operationLocation?` · ${item.operationLocation}`:''}</b></span></footer>}</section>}

function VesselFinderMap({item}){
  const imo=String(item.imo||'').replace(/\D/g,'');
  const mmsi=String(item.mmsi||'').replace(/\D/g,'');
  if(imo.length!==7&&mmsi.length!==9)return null;
  const params=new URLSearchParams({zoom:'undefined',lat:'undefined',lon:'undefined',width:'100%',height:'400',names:'true',track:'true',fleet:'false',fleet_name:'false',clicktoact:'false',store_pos:'true'});
  if(imo.length===7)params.set('imo',imo);
  else params.set('mmsi',mmsi);
  return <div className="ais-map"><iframe title={'Mapa VesselFinder de '+item.buque} src={'https://www.vesselfinder.com/aismap?'+params.toString()} loading="eager" referrerPolicy="strict-origin-when-cross-origin"/></div>;
}

function AisTrackingPanel({item,csrfToken,reloadOperational,notify}){
  const tracking=item.aisTracking;
  const hasIdentifier=String(item.imo||'').replace(/\D/g,'').length===7||String(item.mmsi||'').replace(/\D/g,'').length===9;
  const [refreshing,setRefreshing]=useState(false);
  const [deviceAlerts,setDeviceAlerts]=useState(()=>localStorage.getItem('swiftport-device-alerts')==='1'&&('Notification' in window)&&Notification.permission==='granted');
  const refresh=async()=>{
    if(refreshing||!item.mmsi)return;
    setRefreshing(true);
    try{
      const result=await api('/api/ais/refresh.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({caseRef:item.id})});
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
  if(!tracking)return <section className="ais-panel"><VesselFinderMap item={item}/><div className="ais-info"><span className="overline"><Navigation/> MAPA OFICIAL VESSELFINDER</span><div className="ais-status"><i className="stale"/><span><small>DATOS DE SWIFTPORT</small><b>Esperando señal propia</b></span></div><p>El mapa muestra la última posición disponible en VesselFinder. Swiftport seguirá consultando AISStream para calcular métricas y alertas.</p><div className="ais-actions">{item.mmsi?refreshButton:<p>Añade también el MMSI para activar la actualización automática de Swiftport.</p>}{alertButton}</div></div></section>;
  const last=tracking.sourceTimestamp||tracking.receivedAt;
  const stale=last&&Date.now()-new Date(last).getTime()>2*60*60*1000;
  const etaEstimate=tracking.estimatedArrivalAt?new Date(tracking.estimatedArrivalAt):null;
  return <section className="ais-panel"><VesselFinderMap item={item}/><div className="ais-info"><span className="overline"><Navigation/> VESSELFINDER + AISSTREAM</span><div className="ais-status"><i className={stale?'stale':['Atracado','En fondeo','Atraque probable'].includes(tracking.status)?'moored':'live'}/><span><small>ESTADO ESTIMADO</small><b>{stale?'Señal sin actualizar':tracking.status}</b></span></div><div className="ais-metrics"><span><small>DISTANCIA AL PUERTO</small><b>{tracking.distanceToPortNm==null?'No calculada':tracking.distanceToPortNm+' mn'}</b></span><span><small>ETA ESTIMADA AIS</small><b>{etaEstimate&&!Number.isNaN(etaEstimate.getTime())?etaEstimate.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sin calcular'}</b></span><span><small>VELOCIDAD</small><b>{tracking.speed} kn</b></span><span><small>RUMBO</small><b>{tracking.course}°</b></span><span><small>ÚLTIMA SEÑAL</small><b>{last?new Date(last).toLocaleString('es-ES'):'—'}</b></span></div><div className="ais-actions">{refreshButton}{alertButton}<p>Automático cada 30 minutos · ETA AIS orientativa; confirma el atraque con el consignatario.</p></div></div></section>;
}

const isoDate=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const startOfWeek=date=>{const value=new Date(date);value.setHours(12,0,0,0);return addDays(value,-((value.getDay()+6)%7))};
const DRIVER_TONES=['blue','teal','orange','purple','red','pink','green'];
function driverTone(name,team){if(!name||name==='Sin asignar')return 'gray';const index=team.findIndex(member=>member.fullName===name);return index<0?'gray':DRIVER_TONES[index%DRIVER_TONES.length]}
function formatSchedule(date,start,end){if(!date||!start)return 'Por programar';const label=new Date(date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.','');return label+' · '+start+(end?'–'+end:'')}
const isTransportCalendarEvent=event=>String(event?.tipoServicio||'').toLowerCase().startsWith('transporte')||Boolean(event?.transporte);
const calendarHasValidStart=event=>/^\d{2}:\d{2}$/.test(String(event?.inicio||''));
const calendarNeedsTime=event=>!calendarHasValidStart(event)||String(event?.scheduleStatus||'')==='provisional';
const calendarEventWithCaseSlot=(event,cases)=>{
  if(event?.scheduleSource==='manual')return event;
  const related=(cases||[]).find(item=>item.id===event?.expediente);
  const slot=related?transportSlotFromCase(related):null;
  if(!slot?.date)return event;
  const start=/^\d{2}:\d{2}$/.test(String(slot.start||''))?slot.start:(event?.inicio||'');
  const hasStart=/^\d{2}:\d{2}$/.test(String(start||''));
  return {...event,fecha:slot.date,inicio:start,fin:hasStart?plusHourClient(start):(event?.fin||''),scheduleStatus:hasStart?'confirmed':'missing_time',scheduleNote:hasStart?`Programado por ${slot.source}`:`Falta hora ${slot.source||'ETB/ETA'}; pendiente de confirmar horario del buque`};
};
const localDay=date=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
const driverTimeLabel=event=>calendarNeedsTime(event)?'Falta hora':event.inicio;
const driverEventTimestamp=event=>{
  if(!event?.fecha)return Number.MAX_SAFE_INTEGER;
  const start=calendarHasValidStart(event)?event.inicio:'23:59';
  const value=new Date(`${event.fecha}T${start}:00`).getTime();
  return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
};
const driverEventSort=(first,second)=>driverEventTimestamp(first)-driverEventTimestamp(second)||String(first?.titulo||'').localeCompare(String(second?.titulo||''));
const driverDueInfo=event=>{
  if(!event?.fecha)return {label:'Sin fecha',detail:'Revisar expediente',tone:'missing'};
  const today=localDay(new Date());
  const target=localDay(`${event.fecha}T12:00:00`);
  const days=Math.round((target-today)/86400000);
  const time=driverTimeLabel(event);
  if(days<0)return {label:'Atrasado',detail:`Hace ${Math.abs(days)} día${Math.abs(days)===1?'':'s'} · ${time}`,tone:'late'};
  if(days===0)return {label:'Hoy',detail:time,tone:'today'};
  if(days===1)return {label:'Mañana',detail:time,tone:'soon'};
  if(days<=6)return {label:`En ${days} días`,detail:time,tone:'soon'};
  return {label:new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.',''),detail:time,tone:'later'};
};
function DriverLegend({team}){return <div className="driver-legend"><span><i className="gray"/>Sin asignar</span>{team.map(member=><span key={member.id}><i className={driverTone(member.fullName,team)}/>{member.fullName}</span>)}</div>}
function CalendarEventContent({event,cases}){const related=cases.find(item=>item.id===event.expediente);const schedule=related?portCallSchedule(related):null;const missingTime=calendarNeedsTime(event);const port=related?.puerto||event.puerto||'';return <><time>{missingTime?'FALTA HORARIO':`${event.inicio}${event.fin?`–${event.fin}`:''}`}</time><b className="calendar-vessel-name">{related?.buque||event.titulo||'Buque sin indicar'}</b>{port&&<b className="calendar-port-name">{port}</b>}<small className="calendar-service">{event.tipoServicio||'Transporte'}</small>{missingTime&&<small className="calendar-provisional">PENDIENTE ETB / HORA</small>}<small>{event.asignado||'Sin asignar'}</small>{schedule&&<small className="calendar-port-call">LLEGADA · ETA {schedule.eta}</small>}</>}
const calendarMinutes=value=>{const [hour,minute]=String(value||'').split(':').map(Number);return Number.isFinite(hour)?hour*60+(minute||0):0};
const layoutOverlappingEvents=events=>{
  const sorted=[...events].sort((first,second)=>calendarMinutes(first.inicio)-calendarMinutes(second.inicio)||calendarMinutes(first.fin)-calendarMinutes(second.fin));
  const result=[];let cluster=[];let clusterEnd=-1;let active=[];
  const finishCluster=()=>{if(!cluster.length)return;const columns=Math.max(1,...cluster.map(item=>item._lane+1));cluster.forEach(item=>result.push({...item,_columns:columns}));cluster=[];active=[];clusterEnd=-1};
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
const calendarEventStyle=event=>{
  const start=calendarMinutes(event.inicio),end=Math.max(start+30,calendarMinutes(event.fin)||start+60);
  const visibleStart=Math.max(0,Math.min(1439,start));
  const visibleEnd=Math.max(visibleStart+30,Math.min(1440,end));
  const columns=event._columns||1,lane=event._lane||0;
  return {
    top:visibleStart/60*64,
    height:Math.max(56,(visibleEnd-visibleStart)/60*64),
    left:`calc(4px + (100% - 8px) * ${lane}/${columns})`,
    width:`calc((100% - 8px) / ${columns} - ${columns>1?2:0}px)`,
    right:'auto'
  };
};
const withoutCalendarLayout=event=>{const {_lane,_columns,_end,...clean}=event;return clean};
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
  const minutes=Math.round(((y/64)*60)/15)*15;
  return minutesToClock(Math.max(0,Math.min(1410,minutes)));
};
function Calendario({events,team,cases,transports,providers,warehouseEntries,saveEvent,deleteEvent,completeCaseStep,undoCaseStep,openCase,currentUser,csrfToken,reloadOperational,notify}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const [editing,setEditing]=useState(null);
  const [mineOnly,setMineOnly]=useState(false);
  const [draggingId,setDraggingId]=useState('');
  const [dropTarget,setDropTarget]=useState('');
  const pointerDrag=useRef(null);
  const suppressCalendarClick=useRef(false);
  if(isDriverOnly(currentUser))return <DriverCalendarV2 events={events} cases={cases} transports={transports} warehouseEntries={warehouseEntries} currentUser={currentUser} saveEvent={saveEvent} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify}/>;
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:24},(_,index)=>index);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const newEvent=()=>setEditing({id:'EV-'+Date.now(),titulo:'',tipoServicio:'Transporte',fecha:isoDate(days[0]),inicio:'',fin:'',asignado:'Sin asignar',expediente:'',transporte:'',color:'gray',scheduleStatus:'missing_time'});
  const baseEvents=(mineOnly?events.filter(event=>samePerson(event.asignado,currentUser.fullName)):events).filter(isTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases));
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
    if(pointer.target?.closest?.('.calendar-event-delete'))return;
    pointerDrag.current={event,x:pointer.clientX,y:pointer.clientY,moved:false};
    setDraggingId(event.id);
    pointer.stopPropagation();
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
      <div className="calendar-nav"><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹</button><button className="button tertiary" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Hoy</button><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,7))}>›</button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div>
      <div className="calendar-actions">{hasRole(currentUser,'operations')&&<button className={'button '+(mineOnly?'secondary':'tertiary')} onClick={()=>setMineOnly(!mineOnly)}><UserRound/> Mis servicios</button>}<button className="button primary" onClick={newEvent}><Plus/> Nuevo transporte</button></div>
    </section>
    <section className="calendar-shell panel">
      <div className="calendar-help"><span><CalendarDays/> Solo transportes a ETB/ETA</span><small>Las recepciones quedan en expediente/almacén. Si falta hora ETB/ETA, el transporte queda arriba del día como “Falta horario”.</small></div>
      <div className="calendar-scroll">
        <div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div>
        <div className="calendar-unscheduled-row"><span>Falta horario</span>{days.map(day=><div key={isoDate(day)} data-missing-day={isoDate(day)} className={dropTarget===`missing-${isoDate(day)}`?'drop-target':''}>{missingTimeEvents.filter(event=>event.fecha===isoDate(day)).map(event=><article key={event.id} onPointerDown={pointer=>startPointerDrag(pointer,event)} className={`calendar-unscheduled-card ${event.color||'gray'} ${draggingId===event.id?'dragging':''}`}><button className="calendar-event-open" onClick={click=>{if(suppressCalendarClick.current){click.preventDefault();return}setEditing(event)}}><CalendarEventContent event={event} cases={cases}/></button>{canDeleteEvent&&deleteEvent&&<button type="button" className="calendar-event-delete" title="Eliminar servicio" onClick={click=>{click.stopPropagation();deleteEvent(event)}}><Trash2/></button>}</article>)}</div>)}</div>
        <div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div data-calendar-day={isoDate(day)} className={`calendar-day ${dropTarget===`time-${isoDate(day)}`?'drop-target':''}`} key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}
          {layoutOverlappingEvents(timedEvents.filter(event=>event.fecha===isoDate(day))).map(event=><DraggableCalendarEvent key={event.id} event={event} cases={cases} setEditing={setEditing} canDeleteEvent={canDeleteEvent} deleteEvent={deleteEvent} startPointerDrag={startPointerDrag} draggingId={draggingId} suppressClick={()=>suppressCalendarClick.current}/>)}</div>)}</div>
      </div>
    </section>
    {editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} providers={providers} close={()=>setEditing(null)} submit={item=>{saveEvent(item);setEditing(null)}} openCase={openCase}/>}
  </>;
}

function DraggableCalendarEvent({event,cases,setEditing,canDeleteEvent,deleteEvent,startPointerDrag,draggingId,suppressClick}){
  const clean=withoutCalendarLayout(event);
  return <article onPointerDown={pointer=>startPointerDrag(pointer,clean)} className={`calendar-event ${event.color} ${event._columns>1?'is-overlap':''} ${draggingId===event.id?'dragging':''}`} style={calendarEventStyle(event)} title={`${event.inicio}–${event.fin} · ${event.titulo||event.id}`}>
    <button className="calendar-event-open" onClick={click=>{if(suppressClick?.()){click.preventDefault();return}setEditing(clean)}}><CalendarEventContent event={event} cases={cases}/></button>
    {canDeleteEvent&&deleteEvent&&<button type="button" className="calendar-event-delete" title="Eliminar servicio" onClick={click=>{click.stopPropagation();deleteEvent(clean)}}><Trash2/></button>}
    {event._columns>1&&<span className="overlap-indicator">{event._lane+1}/{event._columns}</span>}
  </article>;
}

function DriverCalendar({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,csrfToken}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const sorted=[...events].filter(isTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort((a,b)=>(a.fecha+a.inicio).localeCompare(b.fecha+b.inicio));
  const visible=sorted.filter(event=>scope==='mine'?samePerson(event.asignado,currentUser.fullName):scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const pending=visible.filter(event=>cases.find(item=>item.id===event.expediente)?.estado!=='Completado').length;
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Puedes consultar todos los trabajos y asignarte cualquiera cuando sea necesario.</p></div><strong>{pending}<small>trabajos pendientes</small></strong></section><section className="panel driver-jobs"><SectionHeader title="Calendario de trabajos" subtitle="Servicios por fecha, hora y conductor"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{events.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{events.filter(event=>event.asignado===currentUser.fullName).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{events.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div>{visible.length?<div className="driver-job-list">{visible.map(event=>{const related=cases.find(item=>item.id===event.expediente);const completed=related?.estado==='Completado';const next=related&&nextOperationStep(related);const mine=event.asignado===currentUser.fullName;const schedule=related?portCallSchedule(related):null;return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>setSelected(event)}><time><b>{event.inicio}</b><small>{new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'})}</small></time><span className="driver-job-main"><b>{related?.buque||event.titulo}</b><small>{event.tipoServicio} · {related?.puerto||'Puerto pendiente'}</small>{schedule&&<small className="driver-port-call">LLEGADA DEL BUQUE · ETA {schedule.eta}</small>}<em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR'}</i></span><span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related||{})}%`}</small></span><ChevronRight/></button>})}</div>:<Empty text="No hay trabajos en este filtro."/>}</section>{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)}/>}</>;
}

function DriverJobList({events,cases,currentUser,select}){
  const transportEvents=(events||[]).filter(isTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort(driverEventSort);
  if(!transportEvents.length)return <Empty text="No hay transportes en esta vista."/>;
  return <div className="driver-job-list">{transportEvents.map(event=>{
    const related=cases.find(item=>item.id===event.expediente);
    if(!related)return null;
    const completed=operationFlow(related).billingReady;
    const next=nextOperationStep(related);
    const mine=samePerson(event.asignado,currentUser.fullName);
    const schedule=portCallSchedule(related);
    const due=driverDueInfo(event);
    const assignment=mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR';
    return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>select(event)}>
      <time><b>{driverTimeLabel(event)}</b><small>{event.fecha?new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'}):'Sin fecha'}</small></time>
      <span className="driver-job-main"><span className="driver-job-title-row"><b>{related.buque||event.titulo}</b><span className={`driver-due-badge ${due.tone}`}><strong>{due.label}</strong><small>{due.detail}</small></span></span><small>{related.puerto||'Puerto pendiente'} · {event.tipoServicio||'Transporte a buque'}</small><small className="driver-port-call">BUQUE: {schedule.etb!=='POR CONFIRMAR'?`ETB ${schedule.etb}`:`ETA ${schedule.eta}`}</small><em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{assignment}</i></span>
      <span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related)}%`}</small></span><ChevronRight/>
    </button>;
  })}</div>;
}

function DriverWeekView({events,cases,select,saveEvent,notify}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const [draggingId,setDraggingId]=useState('');
  const [dropTarget,setDropTarget]=useState('');
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:24},(_,index)=>index);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const transportEvents=(events||[]).filter(isTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases));
  const timedEvents=transportEvents.filter(event=>!calendarNeedsTime(event));
  const missingTimeEvents=transportEvents.filter(calendarNeedsTime);
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
  return <><section className="calendar-toolbar driver-week-toolbar"><div className="calendar-nav"><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹</button><button className="button tertiary" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Hoy</button><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,7))}>›</button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div></section><section className="calendar-shell panel driver-week"><div className="calendar-scroll"><div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div><div className="calendar-unscheduled-row"><span>Falta horario</span>{days.map(day=><div key={isoDate(day)}>{missingTimeEvents.filter(event=>event.fecha===isoDate(day)).map(event=><button key={event.id} className={`calendar-unscheduled-card ${event.color||'gray'}`} onClick={()=>select(event)}><CalendarEventContent event={event} cases={cases}/></button>)}</div>)}</div><div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div className="calendar-day" key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}{layoutOverlappingEvents(timedEvents.filter(event=>event.fecha===isoDate(day))).map(event=>{const related=cases.find(item=>item.id===event.expediente);return <article key={event.id} className={`calendar-event driver-week-event ${event.color} ${event._columns>1?'is-overlap':''}`} style={calendarEventStyle(event)}><button className="calendar-event-open" onClick={()=>select(withoutCalendarLayout(event))}><CalendarEventContent event={event} cases={cases}/>{related&&<small className="driver-week-progress">{operationProgress(related)}% completado</small>}</button></article>})}</div>)}</div></div></section></>;
}

const plusHourClient=time=>{const [hour,minute]=String(time||'09:00').split(':').map(Number);return `${String((hour+1)%24).padStart(2,'0')}:${String(minute||0).padStart(2,'0')}`};

function DriverCalendarV2({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,undoCaseStep,csrfToken,reloadOperational,notify}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const [view,setView]=useState('hub');
  const sorted=[...events].filter(isTransportCalendarEvent).map(event=>calendarEventWithCaseSlot(event,cases)).sort(driverEventSort);
  const isCompleted=event=>operationFlow(cases.find(item=>item.id===event.expediente)||{}).billingReady;
  const pendingEvents=sorted.filter(event=>cases.some(item=>item.id===event.expediente)&&!isCompleted(event));
  const completedSeen=new Set();
  const completedEvents=sorted.filter(isCompleted).reverse().filter(event=>{if(completedSeen.has(event.expediente))return false;completedSeen.add(event.expediente);return true});
  const visiblePending=pendingEvents.filter(event=>scope==='mine'?samePerson(event.asignado,currentUser.fullName):scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Trabajos pendientes limpios, planificación semanal e histórico separado.</p></div><strong>{pendingEvents.length}<small>trabajos pendientes</small></strong></section><nav className="driver-view-tabs" aria-label="Vistas del conductor"><button className={view==='hub'?'active':''} onClick={()=>setView('hub')}><LayoutDashboard/> HUB <span>{pendingEvents.length}</span></button><button className={view==='week'?'active':''} onClick={()=>setView('week')}><CalendarDays/> Semana</button><button className={view==='history'?'active':''} onClick={()=>setView('history')}><CheckCircle2/> Historial <span>{completedEvents.length}</span></button></nav>{view==='hub'&&<section className="panel driver-jobs"><SectionHeader title="Trabajo pendiente" subtitle="Los completados desaparecen automáticamente de esta vista"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{pendingEvents.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{pendingEvents.filter(event=>samePerson(event.asignado,currentUser.fullName)).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{pendingEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div><DriverJobList events={visiblePending} cases={cases} currentUser={currentUser} select={setSelected}/></section>}{view==='week'&&<DriverWeekView events={pendingEvents} cases={cases} select={setSelected}/>} {view==='history'&&<section className="panel driver-jobs"><SectionHeader title="Historial completado" subtitle="Consulta separada de trabajos al 100 %"/><DriverJobList events={completedEvents} cases={cases} currentUser={currentUser} select={setSelected}/></section>}{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)} undo={key=>undoCaseStep(selected.expediente,key)}/>}</>;
}

function ShipmentDocuments({item}){
  const documentation=item?.documentacionMercancia||{};
  const arrivalDocuments=(item?.recepciones||[]).flatMap(record=>record.documentos||[]);
  const documents=[...(documentation.archivosEnvio||[]),...arrivalDocuments].filter((file,index,list)=>list.findIndex(entry=>(entry.id||entry.url)===(file.id||file.url))===index);
  const individual=(item?.mercancias||[]).flatMap(piece=>(piece.documentos||[]).map(type=>`${piece.cantidad} ${piece.tipo}${piece.cantidad===1?'':'S'} · ${type}`));
  const customs=documentation.alcance==='global'
    ? documentation.aduaneroDisponible?`${documentation.tipoAduanero||'DOCUMENTO ADUANERO'} DISPONIBLE`:'DOCUMENTO ADUANERO PENDIENTE'
    : individual.length?individual.join(' · '):'DOCUMENTOS INDIVIDUALES PENDIENTES';
  return <section className="shipment-documents">
    <div><FileCheck2/><span><b>DOCUMENTACIÓN DEL ENVÍO</b><small>{customs}</small></span></div>
    {documents.length?<div className="shipment-document-list">{documents.map((file,index)=><a href={file.url} target="_blank" rel="noreferrer" key={file.id||file.url||index}><FileText/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>:<p><CircleAlert/> Todavía no hay archivos de packing list, delivery note, CMR o aduanas.</p>}
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
      const pieces=(entry.mercancias||[]).length?(entry.mercancias||[]).map(line=>`${line.cantidad} ${line.tipo}${line.cantidad===1?'':'S'}${line.peso?` · ${line.peso}`:''}`).join(' · '):`${entry.bultos||0} bultos${entry.peso?` · ${entry.peso}`:''}`;
      const linked=entry.expediente===item.id?'Este expediente':entry.expediente?`Otro expediente: ${entry.expediente}`:'Sin expediente vinculado';
      return <article key={entry.ref||index}><span><b>{entry.ref||`Entrada ${index+1}`}</b><small>{linked} · {entry.entrada||formatReceptionDate(entry.fechaRecepcion||entry.fecha)||'Fecha pendiente'}</small></span><em>{pieces}</em><small>{entry.zona||'Ubicación pendiente'}</small></article>;
    })}</div>:<p><CircleAlert/> Si sabes que hay una caja antigua para este buque, regístrala en almacén antes de cerrar la entrega.</p>}
    <label className="warehouse-review-check"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/><span>He revisado todo lo que hay en almacén para este buque y se entregará todo lo pendiente.</span></label>
  </section>;
}

function WarehouseCargoReception({entries,selectedRefs,toggle}){
  const totalUnits=entries.reduce((sum,entry)=>sum+(Number(entry.bultos)||merchandiseCount(entry.mercancias)),0);
  return <section className="warehouse-cargo-reception">
    <div className="warehouse-review-head"><WarehouseIcon/><span><b>Mercancía ya registrada en almacén</b><small>{entries.length?'Selecciona las entradas que corresponden a este expediente para recepcionarlas aquí.':'No hay stock activo detectado para este buque/expediente. Puedes tomar fotos de recepción para crear la entrada.'}</small></span><strong>{totalUnits} bultos</strong></div>
    {entries.length?<div className="warehouse-cargo-list">{entries.map((entry,index)=>{
      const pieces=(entry.mercancias||[]).length?(entry.mercancias||[]).map(line=>`${line.cantidad} ${line.tipo}${Number(line.cantidad)===1?'':'S'}${line.peso?` · ${line.peso} KG`:''}${line.seguimiento?` · ${line.seguimiento}`:''}`).join(' · '):`${entry.bultos||0} bultos${entry.peso?` · ${entry.peso}`:''}`;
      const photos=entry.fotos||[];
      const docs=entry.documentosRecepcion||[];
      return <article key={entry.ref||index} className={selectedRefs.includes(entry.ref)?'selected':''}>
        <label><input type="checkbox" checked={selectedRefs.includes(entry.ref)} onChange={()=>toggle(entry.ref)}/><span><b>{entry.ref||`Entrada ${index+1}`}</b><small>{entry.expediente?`Expediente ${entry.expediente}`:'Sin expediente'} · {entry.entrada||formatReceptionDate(entry.fechaRecepcion||entry.fecha)||'Fecha pendiente'} · {entry.zona||'Ubicación pendiente'}</small></span></label>
        <p>{pieces}</p>
        {(photos.length||docs.length)?<div className="warehouse-cargo-evidence">{photos.slice(0,3).map((photo,photoIndex)=><a href={photo.url} target="_blank" rel="noreferrer" key={photo.id||photo.url||photoIndex}><Camera/> Foto {photoIndex+1}</a>)}{docs.slice(0,3).map((file,fileIndex)=><a href={file.url} target="_blank" rel="noreferrer" key={file.id||file.url||fileIndex}><FileText/> {documentLabel(file.name)}</a>)}</div>:<small className="warehouse-cargo-warning"><CircleAlert/> Sin fotos/documentos adjuntos en esta entrada</small>}
      </article>;
    })}</div>:<p><CircleAlert/> Si la mercancía ya está físicamente en almacén pero no aparece aquí, regístrala primero desde Almacén o toma fotos en este paso.</p>}
  </section>;
}

function PodDocuments({item,notify}){
  const documentation=item?.documentacionMercancia||{};
  const pods=(documentation.podArchivos||[]).length?documentation.podArchivos:(documentation.podArchivo?[documentation.podArchivo]:[]);
  return <div className="document-box"><h3>POD de entrega <small>{pods.length?`${pods.length} PDF${pods.length===1?'':'S'}`:'PENDIENTE'}</small></h3>{pods.length?pods.map((file,index)=><a className="document-link" href={file.url} target="_blank" rel="noreferrer" key={file.id||file.url||index}><FileText/><span><b>POD {index+1}</b><small>{file.name}</small></span><ExternalLink/></a>):<button onClick={()=>notify('POD todavía pendiente')}><Camera/><span><b>POD / fotografías</b><small>Pendiente de entrega</small></span><ChevronRight/></button>}</div>;
}

function DriverTaskModal({event,item,transport,warehouseEntries,currentUser,csrfToken,reloadOperational,notify,close,claim,submit,undo}){
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [warehouseReviewed,setWarehouseReviewed]=useState(false);
  const step=item?nextOperationStep(item):null;
  useEffect(()=>{setNote('');setEvidenceFiles([]);setError('');setWarehouseReviewed(false)},[step?.key,item?.id]);
  if(!item)return null;
  const flow=operationFlow(item);
  const lastCompleted=[...OPERATION_STEPS].reverse().find(entry=>flow[entry.key]);
  const mine=true;
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const instructions={
    review:'Lee el servicio completo y comprueba buque, fecha, puerto, ruta, mercancía y observaciones antes de empezar.',
    cargo:inWarehouse?'Comprueba cantidades, peso y estado de la mercancía antes de cargar.':'Recoge la mercancía en el lugar indicado y comprueba cantidades, peso y estado.',
    documents:'Comprueba que están listos los documentos necesarios antes de salir a entregar.',
    assignment:'El transporte debe quedar asignado. Puedes asignártelo desde esta misma pantalla si está libre.',
    delivery:'Antes de entregar, revisa todo lo que hay en almacén para este buque. Luego fotografía la entrega y escanea el POD firmado.'
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
      if(evidenceType==='pod'&&selected.some(file=>file.type.startsWith('image/')))notify?.('Documento recortado, corregido y guardado como PDF');
    }catch(reason){setError(reason.message)}finally{setUploading(false)}
  };
  const cargoPhotos=evidenceFiles.filter(file=>file.evidenceType==='cargo-photo');
  const deliveryPhotos=evidenceFiles.filter(file=>file.evidenceType==='delivery-photo');
  const podFiles=evidenceFiles.filter(file=>file.evidenceType==='pod');
  const vesselWarehouseEntries=warehouseEntriesForVessel(warehouseEntries,item);
  const evidenceReady=step?.key==='cargo'?cargoPhotos.length>0:step?.key==='delivery'?warehouseReviewed&&deliveryPhotos.length>0&&podFiles.length>0:true;
  const needsEvidence=['cargo','delivery'].includes(step?.key);
  const evidenceLabel=file=>file.evidenceType==='pod'?'POD escaneado':file.evidenceType==='delivery-photo'?'Foto de entrega':'Foto de recepción';
  return <div className="modal-backdrop driver-task-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)close()}}>
    <section className="modal driver-task-modal">
      <div className="modal-head"><div><span className="overline">{event.inicio}–{event.fin} · {event.tipoServicio}</span><h2>{item.buque}</h2><p>{caseLabel(item)}</p></div><button className="icon-button" onClick={close}><X/></button></div>
      <div className="driver-task-body">
        <div className="driver-route"><MapPin/><span><small>PUERTO / RUTA</small><b>{transport?.ruta||item.puerto}</b></span></div>
        {false&&<div className="driver-owner-alert"><UserRound/><span><b>{event.asignado&&event.asignado!=='Sin asignar'?`Asignado a ${event.asignado}`:'Trabajo sin conductor'}</b><small>Asígnatelo antes de registrar avances.</small></span><button className="button secondary" onClick={claim}>Asignarme</button></div>}
        <OperationChecklist item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} currentRoles={currentUser}/>
        <CargoManifest item={item}/>
        {flow.cargo&&<ShipmentDocuments item={item}/>}
        {step?<>
          <div className="driver-next-action"><span>{OPERATION_STEPS.findIndex(entry=>entry.key===step.key)+1}</span><div><small>AHORA TOCA</small><b>{step.title}</b><p>{instructions[step.key]}</p></div></div>
          {step.key==='delivery'&&<WarehouseTransportReview entries={vesselWarehouseEntries} item={item} checked={warehouseReviewed} setChecked={setWarehouseReviewed}/>}
          {needsEvidence&&<div className="pod-scanner evidence-capture">
            <div><Camera/><span><b>{step.key==='cargo'?'Fotos de la mercancía recibida':'Evidencias de la entrega'}</b><small>{step.key==='cargo'?'Se requiere al menos una foto; puedes añadir todas las necesarias.':'Se requiere foto de la entrega y POD firmado.'}</small></span></div>
            {false&&<div className="evidence-assignment-lock"><LockKeyhole/><span><b>Activa el registro de este trabajo</b><small>{event.asignado&&event.asignado!=='Sin asignar'?`Ahora figura asignado a ${event.asignado}. Asígnatelo para activar la cámara y el POD.`:'El servicio todavía no tiene conductor. Asígnatelo para activar la cámara y el POD.'}</small></span><button className="button secondary" onClick={claim}>Asignarme y activar</button></div>}
            <div className="pod-scanner-actions">
              <label className={`button primary${!mine?' disabled':''}`}><Camera/> {uploading?'Procesando…':step.key==='cargo'?'Añadir fotos de recepción':'Añadir fotos de entrega'}<input type="file" accept="image/*" capture="environment" multiple disabled={uploading||!mine} onChange={change=>{uploadEvidence(change.target.files,step.key==='cargo'?'cargo-photo':'delivery-photo');change.target.value=''}}/></label>
              {step.key==='delivery'&&<><label className={`button secondary${!mine?' disabled':''}`}><ScanLine/> Escanear POD<input type="file" accept="image/*" capture="environment" multiple disabled={uploading||!mine} onChange={change=>{uploadEvidence(change.target.files,'pod');change.target.value=''}}/></label><label className={`button tertiary${!mine?' disabled':''}`}><FileText/> Añadir PDFs de POD<input type="file" accept="application/pdf" multiple disabled={uploading||!mine} onChange={change=>{uploadEvidence(change.target.files,'pod');change.target.value=''}}/></label></>}
            </div>
            {step.key==='delivery'&&<div className="evidence-requirements"><span className={deliveryPhotos.length?'done':''}><CheckCircle2/> Foto de entrega {deliveryPhotos.length?`(${deliveryPhotos.length})`:'pendiente'}</span><span className={podFiles.length?'done':''}><CheckCircle2/> POD firmado {podFiles.length?`(${podFiles.length})`:'pendiente'}</span></div>}
            {evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{evidenceLabel(file)} {file.evidenceType==='pod'?'':index+1}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
            {error&&<p className="form-error"><CircleAlert/>{error}</p>}
          </div>}
          <label className="field"><span>Observación del trabajo (opcional)</span><input value={note} onChange={change=>setNote(change.target.value)} placeholder="Persona que recibe, incidencia, referencia…"/></label>
          <button className="button primary full driver-confirm" disabled={uploading||!evidenceReady} onClick={()=>submit(step.key,note,evidenceFiles)}><CheckCircle2/> {!evidenceReady?(step.key==='cargo'?'Añade una foto para confirmar':'Revisa almacén, foto de entrega y POD'):`Confirmar: ${step.title}`}</button>
        </>:<div className="driver-finished"><CheckCircle2/><span><b>Trabajo terminado</b><small>POD recibido y expediente listo para facturación.</small></span></div>}
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
  const lastCompleted=[...OPERATION_STEPS].reverse().find(entry=>flow[entry.key]);
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
  const evidenceTitle=step?.key==='cargo'?'Fotografiar mercancía recibida':'Escanear POD firmado';
  return <div className="modal-backdrop driver-task-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)close()}}><section className="modal driver-task-modal"><div className="modal-head"><div><span className="overline">{event.inicio}–{event.fin} · {event.tipoServicio}</span><h2>{item.buque}</h2><p>{caseLabel(item)}</p></div><button className="icon-button" onClick={close}><X/></button></div><div className="driver-task-body"><div className="driver-route"><MapPin/><span><small>PUERTO / RUTA</small><b>{transport?.ruta||item.puerto}</b></span></div>{!mine&&<div className="driver-owner-alert"><UserRound/><span><b>{event.asignado&&event.asignado!=='Sin asignar'?`Asignado a ${event.asignado}`:'Trabajo sin conductor'}</b><small>Asígnatelo antes de registrar avances.</small></span><button className="button secondary" onClick={claim}>Asignarme</button></div>}<OperationChecklist item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify}/><CargoManifest item={item}/>{step?<><div className="driver-next-action"><span>{OPERATION_STEPS.findIndex(entry=>entry.key===step.key)+1}</span><div><small>AHORA TOCA</small><b>{step.title}</b><p>{instructions[step.key]}</p></div></div>{needsEvidence&&<div className="pod-scanner"><div><Camera/><span><b>{evidenceTitle}</b><small>{step.key==='cargo'?'Haz al menos una foto clara. Puedes añadir varias.':'La cámara se abrirá directamente en el móvil.'}</small></span></div><div className="pod-scanner-actions"><label className="button primary"><Camera/> {uploading?'Subiendo…':step.key==='cargo'?'Hacer foto':'Abrir cámara'}<input type="file" accept="image/*" capture="environment" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>{step.key==='delivery'&&<label className="button tertiary"><FileText/> Adjuntar PDF<input type="file" accept="application/pdf" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>}</div>{evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={file.id}><CheckCircle2/><span><b>{step.key==='cargo'?`Foto ${index+1}`:'POD adjuntado'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}{error&&<p className="form-error"><CircleAlert/>{error}</p>}</div>}<label className="field"><span>Observación del trabajo (opcional)</span><input value={note} disabled={!mine} onChange={change=>setNote(change.target.value)} placeholder="Persona que recibe, incidencia, referencia…"/></label><button className="button primary full driver-confirm" disabled={!mine||uploading||(needsEvidence&&!evidenceFiles.length)} onClick={()=>submit(step.key,note,step.key==='cargo'?evidenceFiles:evidenceFiles[0]||null)}><CheckCircle2/> {needsEvidence&&!evidenceFiles.length?(step.key==='cargo'?'Haz una foto para confirmar':'Escanea el POD para confirmar'):`Confirmar: ${step.title}`}</button></>:<div className="driver-finished"><CheckCircle2/><span><b>Trabajo terminado</b><small>POD recibido y expediente listo para facturación.</small></span></div>}{mine&&lastCompleted&&<button className="button tertiary full driver-undo-step" onClick={()=>undo(lastCompleted.key)}><Undo2/> Deshacer: {lastCompleted.title}</button>}<button className="button tertiary full" onClick={close}>{flow.billingReady?'Cerrar':'Volver al calendario'}</button></div></section></div>;
}

function Dashboard({cases,warehouseEntries,calendarEvents,openCase,navigate,showFinance,user}){
  const active=cases.filter(item=>item.estado!=='Completado').length;
  const billing=cases.filter(item=>item.estado==='Completado').reduce((sum,item)=>sum+item.importe,0);
  const stock=warehouseEntries.filter(item=>!item.archivado&&item.estado!=='Expedido').reduce((sum,item)=>sum+Number(item.bultos||0),0);
  const alerts=hasRole(user,'operations')
    ? calendarEvents.filter(event=>samePerson(event.asignado,user.fullName)&&cases.find(item=>item.id===event.expediente)?.estado!=='Completado').length
    : cases.filter(item=>item.estado!=='Completado'&&(item.prioridad==='Urgente'||item.conductor==='Sin asignar')).length;
  return <>
    <section className="welcome"><div><span className="overline"><Sparkles/> Resumen del turno</span><h2>Buenos días, {user.fullName.split(' ')[0]}</h2><p>Hay <b>{alerts} operaciones que necesitan atención</b>. El resto avanza según lo previsto.</p></div><button className="button ghost-light" onClick={()=>navigate('expedientes')}>Ver operativa <ChevronRight/></button></section>
    <section className={'kpi-grid '+(!showFinance?'kpi-grid-three':'')}>
      <Kpi icon={Ship} label="Expedientes activos" value={active} note="2 con ETA en 48 h" tone="blue"/>
      <Kpi icon={PackageCheck} label="Bultos en almacén" value={String(stock)} note={`${warehouseEntries.filter(item=>!item.archivado&&item.estado!=='Expedido').length} ubicaciones activas`} tone="teal"/>
      <Kpi icon={CircleAlert} label="Requieren acción" value={alerts} note="1 de prioridad urgente" tone="orange"/>
      {showFinance&&<Kpi icon={WalletCards} label="Listo para facturar" value={money(billing)} note="1 expediente completado" tone="green"/>}
    </section>
    <div className="dashboard-grid">
      <section className="panel attention-panel"><SectionHeader title="Requieren acción" subtitle="Ordenado por prioridad" action={<button className="text-button" onClick={()=>navigate('expedientes')}>Ver todos</button>}/><div className="attention-list">
        <ActionItem tone="danger" title="Autorización aduanera pendiente" meta="POLARIS MILA · vence hoy 17:00" action={()=>openCase('SW-2026-0047')}/>
        <ActionItem tone="warning" title="Transporte sin conductor" meta="TR-1044 · Tarragona · mañana 15:30" action={()=>navigate('calendario')}/>
        <ActionItem tone="info" title="Validar packing list" meta="ATLANTIC STAR · ETA 03 Jul 06:30" action={()=>openCase('SW-2026-0045')}/>
      </div></section>
      <section className="panel today-panel"><SectionHeader title="Agenda operativa" subtitle="Hoy, 29 de junio"/><div className="schedule">
        <Schedule time="09:15" title="Recogida aeropuerto BCN" meta="VIKING SEA · Javier S." active/>
        <Schedule time="11:00" title="ETA Puerto de Barcelona" meta="Muelle Adossat"/>
        <Schedule time="14:35" title="Entrada de mercancía" meta="POLARIS MILA · zona B-04"/>
        <Schedule time="17:00" title="Límite autorización T1" meta="AD-882 · prioridad urgente" alert/>
      </div></section>
    </div>
    <section className="panel operations"><SectionHeader title="Operaciones recientes" subtitle="Última actividad de expedientes" action={<button className="filter-button" onClick={()=>navigate('expedientes')}><Filter/> Filtrar</button>}/><div className="responsive-table"><div className="table-head"><span>Expediente</span><span>Destino</span><span>ETA</span><span>Progreso</span><span>Estado</span><span/></div>{cases.slice(0,4).map(item=><button className="table-row" key={item.id} onClick={()=>openCase(item.id)}><span className="primary-cell"><span className="ship-icon"><Ship/></span><span><b>{caseLabel(item)}</b><small>{item.cliente}</small></span></span><span data-label="Destino"><MapPin/>{item.puerto}</span><span data-label="ETA">{item.eta}</span><span data-label="Progreso"><span className="mini-progress"><i style={{width:item.progreso+'%'}}/></span>{item.progreso}%</span><span data-label="Estado"><Badge>{item.estado}</Badge></span><ChevronRight/></button>)}</div></section>
  </>;
}
function Kpi({icon:Icon,label,value,note,tone}){return <article className="kpi-card"><div className={'kpi-icon '+tone}><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>}
function ActionItem({tone,title,meta,action}){return <button className="attention-item" onClick={action}><span className={'attention-dot '+tone}/><span><b>{title}</b><small>{meta}</small></span><ChevronRight/></button>}
function Schedule({time,title,meta,active,alert}){return <div className={'schedule-item '+(active?'active ':'')+(alert?'alert':'')}><time>{time}</time><span className="schedule-line"><i/></span><span><b>{title}</b><small>{meta}</small></span></div>}

function Expedientes({cases,selected,select,search,setSearch,completeCaseStep,notify,showFinance,updateCase,deleteCase,clientOptions,warehouseEntries,transports,calendarEvents,team,providers,vessels,saveEvent,csrfToken,reloadOperational,currentUser}){
  const [filter,setFilter]=useState('Todos');
  const [mobileDetail,setMobileDetail]=useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const [flowOpen,setFlowOpen]=useState(false);
  const filtered=cases.filter(item=>(filter==='Todos'||item.estado===filter)&&[item.buque,item.id,item.cliente,item.puerto].join(' ').toLowerCase().includes(search.toLowerCase())).sort(newestFirst);
  return <div className={'case-layout '+(mobileDetail?'mobile-detail-open':'')}>
    <section className={'panel case-list '+(selected?'has-selection':'')}><div className="list-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número, buque, ETA o puerto…"/></label><div className="filter-chips">{['Todos','En curso','Bloqueado','Planificado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></div><div className="case-count">{filtered.length} expedientes</div>{filtered.length?filtered.map(item=><button key={item.id} className={'case-card '+(selected.id===item.id?'selected':'')} onClick={()=>{select(item.id);setMobileDetail(true)}}><div className="case-card-top"><span className="ship-icon"><Ship/></span><span><b>{caseLabel(item)}</b><small>{item.cliente}</small></span><Badge>{item.estado}</Badge></div><div className="case-card-meta"><span><MapPin/>{item.puerto}</span><span><CalendarDays/>{item.eta}</span></div><div className="case-progress"><span><i style={{width:item.progreso+'%'}}/></span><small>{item.progreso}%</small></div><p><b>Siguiente:</b> {item.siguiente}</p></button>):<Empty text="Prueba con otro término o estado."/>}</section>
    <section className="panel case-detail"><button className="mobile-detail-back" onClick={()=>setMobileDetail(false)}><ArrowLeft/> Expedientes</button><div className="detail-hero"><div><div className="detail-id">{selected.id} <Badge>{selected.estado}</Badge></div><h2>{selected.buque}</h2><p>{selected.cliente} · {selected.puerto}</p></div><div className="detail-actions"><button className="icon-button" aria-label="Editar expediente" onClick={()=>setEditOpen(true)}><PencilLine/></button>{(hasRole(currentUser,'operations')||hasRole(currentUser,'admin'))&&<button className="icon-button danger" aria-label="Borrar expediente" onClick={()=>deleteCase(selected.id)}><Trash2/></button>}</div></div><div className={'detail-stats '+(!showFinance?'detail-stats-three':'')}><Stat label="ETA" value={selected.eta} icon={Clock3}/><Stat label="Mercancía" value={selected.bultos+' bultos · '+selected.peso} icon={Box}/><Stat label="Conductor" value={selected.conductor} icon={UserRound}/>{showFinance&&<Stat label="Importe previsto" value={money(selected.importe)} icon={BadgeEuro}/>}</div><PortCallPanel item={selected}/><OperationChecklist item={selected} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify} currentRoles={currentUser}/><ShipmentDocuments item={selected}/><div className="detail-columns"><div><h3>Línea temporal real</h3><ActualTimeline item={selected}/></div><aside className="detail-side"><div className={'next-action '+(operationFlow(selected).billingReady?'complete':'')}><span>{operationFlow(selected).billingReady?'Operativa completada':'Próxima acción'}</span><b>{selected.siguiente}</b><p>{operationFlow(selected).billingReady?'El POD está registrado y el expediente ha pasado a facturación.':'Sigue el paso indicado para que todo el equipo trabaje igual.'}</p><button className="button primary full" disabled={operationFlow(selected).billingReady} onClick={()=>setFlowOpen(true)}><ClipboardCheck/> {operationFlow(selected).billingReady?'Listo para facturar':'Registrar siguiente paso'}</button></div><PodDocuments item={selected} notify={notify}/>{(hasRole(currentUser,'operations')||hasRole(currentUser,'admin'))&&<button className="button danger full" onClick={()=>deleteCase(selected.id)}><Trash2/> Borrar expediente</button>}</aside></div></section>
    <section className="panel case-services-panel"><CaseServicesPanel item={selected} events={calendarEvents} cases={cases} transports={transports} team={team} providers={providers} saveEvent={saveEvent}/></section>
    <section className="panel merchandise-case-panel"><MerchandisePanel item={selected} updateCase={updateCase}/></section>
    {editOpen&&<CaseEditModal item={selected} clientOptions={clientOptions} vessels={vessels} close={()=>setEditOpen(false)} submit={item=>{updateCase(item);setEditOpen(false)}}/>}
    {flowOpen&&<OperationStepModal item={selected} warehouseEntries={warehouseEntries} transports={transports} csrfToken={csrfToken} currentUser={currentUser} close={()=>setFlowOpen(false)} submit={(key,note,evidence)=>{completeCaseStep(selected.id,key,note,evidence);setFlowOpen(false)}}/>}
  </div>;
}

function CaseServicesPanel({item,events,cases,transports,team,providers,saveEvent}){
  const [editing,setEditing]=useState(null);
  const scheduled=(events||[]).filter(event=>event.expediente===item.id&&isTransportCalendarEvent(event)).sort((a,b)=>(String(a.fecha)+String(a.inicio)).localeCompare(String(b.fecha)+String(b.inicio)));
  const addService=type=>{
    const call=item.portCall||{};
    const date=call.etbDate||call.etaDate||(String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0])||new Date().toISOString().slice(0,10);
    const start=call.etbTime||call.etaTime||'09:00';
    const origen=SWIFTPORT_WAREHOUSE;
    const destino=`BUQUE ${item.buque||''} · ${item.puerto||'PUERTO'}`;
    const route=`${origen} → ${destino}`;
    setEditing({id:`EV-${Date.now()}`,titulo:route,origen,destino,tipoServicio:type,fecha:date,inicio:start,fin:plusHourClient(start),asignado:'Sin asignar',expediente:item.id,transporte:'',proveedorId:'',color:'gray'});
  };
  return <><SectionHeader title="Transporte programado" subtitle={`${scheduled.length} transporte(s) sincronizados con Calendario`}/><div className="case-service-actions"><button className="button primary" onClick={()=>addService('Transporte')}><Truck/> Añadir transporte</button></div>{scheduled.length?<div className="case-service-list">{scheduled.map(event=><button key={event.id} onClick={()=>setEditing(event)}><span className="case-service-icon transport"><Truck/></span><span><b>{event.tipoServicio||'Transporte'} · {calendarNeedsTime(event)?'Falta horario':`${event.inicio}–${event.fin}`}</b><small>{event.fecha} · {event.titulo||item.puerto}</small></span><span><b>{event.asignado||'Sin asignar'}</b><small>TRANSPORTE Y CALENDARIO</small></span><PencilLine/></button>)}</div>:<div className="case-services-empty"><CalendarDays/><span><b>Este expediente todavía no tiene transporte</b><small>Añade el transporte al buque para que aparezca en el calendario de los conductores.</small></span></div>}{editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} providers={providers} close={()=>setEditing(null)} submit={event=>{saveEvent(event);setEditing(null)}} openCase={()=>setEditing(null)}/>}</>;
}

function Stat({label,value,icon:Icon}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}
function ActualTimeline({item}){
  const events=item.timelineCustom||[];
  if(!events.length)return <div className="timeline-empty"><Clock3/><b>Sin actividad registrada</b><small>La cronología aparecerá cuando el equipo confirme el primer paso.</small></div>;
  return <div className="timeline actual-timeline">{events.map((event,index)=><div className="timeline-event done" key={event.id||event.titulo+index}><span className="timeline-marker"><CheckCircle2/></span><time>{event.hora||'—'}<small>{event.fecha||''}</small></time><span><b>{event.titulo}</b><small>{event.detalle}</small>{event.actor&&<em>Registrado por {event.actor}</em>}{event.archivo&&<a href={event.archivo.url} target="_blank" rel="noreferrer"><FileText/> POD principal: {event.archivo.name}</a>}{(event.archivos||[]).map((file,fileIndex)=>{const document=['pod','shipment-document'].includes(file.evidenceType)||String(file.name||'').toLowerCase().endsWith('.pdf');return <a href={file.url} target="_blank" rel="noreferrer" key={file.id||fileIndex}>{document?<FileText/>:<Camera/>} {file.evidenceType==='pod'?'POD adicional':document?'Documento':`Foto ${fileIndex+1}`}: {file.name}</a>})}</span></div>)}</div>;
}
function OperationChecklist({item,csrfToken,reloadOperational,notify,currentRoles}){
  const flow=operationFlow(item);
  const current=nextOperationStep(item);
  return <><AisTrackingPanel item={item} csrfToken={csrfToken} reloadOperational={reloadOperational} notify={notify}/><section className="operation-checklist"><div><b>FLUJO OPERATIVO</b><small>Pasos libres para todo el equipo</small></div><ol>{OPERATION_STEPS.map((step,index)=><li key={step.key} className={`${flow[step.key]?'done':current?.key===step.key?'current':''}`}><span>{flow[step.key]?<CheckCircle2/>:index+1}</span><span><b>{step.title}</b><small>{step.responsibility}</small></span></li>)}<li className={flow.billingReady?'done':''}><span>{flow.billingReady?<CheckCircle2/>:OPERATION_STEPS.length+1}</span><span><b>Listo para facturar</b><small>LIBRE PARA TODOS</small></span></li></ol></section></>;
}

function OperationStepModal({item,warehouseEntries,transports,csrfToken,currentUser,close,submit}){
  const step=nextOperationStep(item);
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [warehouseReviewed,setWarehouseReviewed]=useState(false);
  const [selectedWarehouseRefs,setSelectedWarehouseRefs]=useState(()=>warehouseEntriesForVessel(warehouseEntries,item).map(entry=>entry.ref));
  if(!step)return null;
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const transport=transports.find(entry=>entry.expediente===item.id);
  const guidance={
    review:'Comprueba buque, ETA, puerto, ruta, mercancía solicitada y observaciones del correo antes de iniciar el servicio.',
    cargo:inWarehouse?'Confirma que la mercancía recibida coincide con fotos, cantidades y peso.':'Confirma la recogida en el punto indicado y comprueba cantidades y estado.',
    documents:'Comprueba packing list, CMR, delivery note y documento aduanero. Puedes adjuntar aquí los archivos recibidos por correo.',
    assignment:'Selecciona el conductor en el transporte o calendario. Este paso se completará automáticamente.',
    delivery:'Revisa todo el almacén de este buque, adjunta fotografías de la mercancía entregada y el POD firmado.'
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
    }catch(reason){setError(reason.message)}finally{setUploading(false)}
  };
  const cargoPhotos=evidenceFiles.filter(file=>file.evidenceType==='cargo-photo');
  const shipmentFiles=evidenceFiles.filter(file=>file.evidenceType==='shipment-document');
  const deliveryPhotos=evidenceFiles.filter(file=>file.evidenceType==='delivery-photo');
  const podFiles=evidenceFiles.filter(file=>file.evidenceType==='pod');
  const vesselWarehouseEntries=warehouseEntriesForVessel(warehouseEntries,item);
  const selectedWarehouseEntries=vesselWarehouseEntries.filter(entry=>selectedWarehouseRefs.includes(entry.ref));
  const needsEvidence=['cargo','delivery'].includes(step.key);
  const evidenceReady=step.key==='cargo'?cargoPhotos.length>0||selectedWarehouseEntries.length>0:step.key==='delivery'?warehouseReviewed&&deliveryPhotos.length>0&&podFiles.length>0:true;
  const toggleWarehouseEntry=ref=>setSelectedWarehouseRefs(current=>current.includes(ref)?current.filter(item=>item!==ref):[...current,ref]);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
    <section className="modal operation-modal">
      <div className="modal-head"><div><span className="overline">Paso operativo</span><h2>{step.title}</h2><p>{item.id} · {item.buque}</p></div><button className="icon-button" onClick={close}><X/></button></div>
      <div className="operation-modal-body">
        <OperationChecklist item={item} currentRoles={currentUser}/>
        <div className="operation-guidance"><ClipboardCheck/><div><b>Qué debes comprobar</b><p>{guidance[step.key]}</p>{step.key==='delivery'&&transport&&<small>{transport.id} · {transport.ruta}</small>}</div></div>
        {step.key==='cargo'&&<WarehouseCargoReception entries={vesselWarehouseEntries} selectedRefs={selectedWarehouseRefs} toggle={toggleWarehouseEntry}/>}
        {['documents','assignment','delivery'].includes(step.key)&&<ShipmentDocuments item={item}/>}
        {step.key==='delivery'&&<WarehouseTransportReview entries={vesselWarehouseEntries} item={item} checked={warehouseReviewed} setChecked={setWarehouseReviewed}/>}
        {step.key==='documents'&&<div className="pod-scanner shipment-document-upload">
          <div><FileCheck2/><span><b>Adjuntar documentación del envío</b><small>Packing list, delivery note, CMR, T1, levante u otros documentos.</small></span></div>
          <div className="pod-scanner-actions"><label className="button primary"><UploadCloud/> {uploading?'Subiendo…':'Añadir varios PDFs'}<input type="file" accept="application/pdf,image/*" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'shipment-document');event.target.value=''}}/></label></div>
          {shipmentFiles.length>0&&<div className="evidence-file-list">{shipmentFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
        </div>}
        {needsEvidence&&<div className="pod-scanner evidence-capture">
          <div><Camera/><span><b>{step.key==='cargo'?'Fotos de la mercancía recibida':'Evidencias de la entrega'}</b><small>{step.key==='cargo'?'Puedes tomar varias fotografías.':'Se exige al menos una foto de entrega y un POD.'}</small></span></div>
          <div className="pod-scanner-actions">
            <label className="button primary"><Camera/> {uploading?'Procesando…':step.key==='cargo'?'Añadir fotos de recepción':'Añadir fotos de entrega'}<input type="file" accept="image/*" capture="environment" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,step.key==='cargo'?'cargo-photo':'delivery-photo');event.target.value=''}}/></label>
            {step.key==='delivery'&&<><label className="button secondary"><ScanLine/> Escanear POD<input type="file" accept="image/*" capture="environment" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'pod');event.target.value=''}}/></label><label className="button tertiary"><FileText/> Añadir PDFs de POD<input type="file" accept="application/pdf" multiple disabled={uploading} onChange={event=>{uploadEvidence(event.target.files,'pod');event.target.value=''}}/></label></>}
          </div>
          {step.key==='delivery'&&<div className="evidence-requirements"><span className={deliveryPhotos.length?'done':''}><CheckCircle2/> Foto de entrega {deliveryPhotos.length?`(${deliveryPhotos.length})`:'pendiente'}</span><span className={podFiles.length?'done':''}><CheckCircle2/> POD firmado {podFiles.length?`(${podFiles.length})`:'pendiente'}</span></div>}
          {evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={`${file.id}-${index}`}><CheckCircle2/><span><b>{file.evidenceType==='pod'?'POD escaneado':file.evidenceType==='delivery-photo'?'Foto de entrega':'Foto de recepción'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}
          {error&&<p className="form-error"><CircleAlert/>{error}</p>}
        </div>}
        <label className="field"><span>Observación (opcional)</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Incidencias, persona que recibe, referencia…"/></label>
        <div className="modal-actions"><button className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={uploading||!evidenceReady} onClick={()=>submit(step.key,note,step.key==='cargo'?{files:evidenceFiles,warehouseRefs:selectedWarehouseRefs}:evidenceFiles)}><CheckCircle2/> {!evidenceReady?(step.key==='cargo'?'Añade una foto o selecciona almacén':'Revisa almacén, foto de entrega y POD'):'Confirmar paso'}</button></div>
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
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal operation-modal"><div className="modal-head"><div><span className="overline">Paso operativo</span><h2>{step.title}</h2><p>{item.id} · {item.buque}</p></div><button className="icon-button" onClick={close}><X/></button></div><div className="operation-modal-body"><OperationChecklist item={item}/><div className="operation-guidance"><ClipboardCheck/><div><b>Qué debes comprobar</b><p>{guidance[step.key]}</p>{step.key==='delivery'&&transport&&<small>{transport.id} · {transport.ruta}</small>}</div></div>{needsEvidence&&<div className="pod-scanner"><div><Camera/><span><b>{step.key==='cargo'?'Fotografiar mercancía recibida':'Escanear POD firmado'}</b><small>{step.key==='cargo'?'La foto es obligatoria y quedará en el expediente.':'Usa la cámara del móvil o adjunta el PDF recibido.'}</small></span></div><div className="pod-scanner-actions"><label className="button primary"><Camera/> {uploading?'Subiendo…':step.key==='cargo'?'Hacer foto':'Abrir cámara'}<input type="file" accept="image/*" capture="environment" disabled={uploading} onChange={event=>uploadEvidence(event.target.files?.[0])}/></label>{step.key==='delivery'&&<label className="button tertiary"><FileText/> Adjuntar PDF<input type="file" accept="application/pdf" disabled={uploading} onChange={event=>uploadEvidence(event.target.files?.[0])}/></label>}</div>{evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={file.id}><CheckCircle2/><span><b>{step.key==='cargo'?`Foto ${index+1}`:'POD adjuntado'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}{error&&<p className="form-error"><CircleAlert/>{error}</p>}</div>}<label className="field"><span>Observación (opcional)</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Incidencias, persona que recibe, referencia…"/></label><div className="modal-actions"><button className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={uploading||(needsEvidence&&!evidenceFiles.length)} onClick={()=>submit(step.key,note,step.key==='cargo'?evidenceFiles:evidenceFiles[0]||null)}><CheckCircle2/> {needsEvidence&&!evidenceFiles.length?(step.key==='cargo'?'Haz una foto':'Escanea el POD'):'Confirmar paso'}</button></div></div></section></div>;
}

function MerchandisePanel({item,updateCase}){
  const merchandise=item.mercancias||[];
  const updatePiece=(id,change)=>updateCase({...item,mercancias:merchandise.map(piece=>piece.id===id?{...piece,...change}:piece)});
  const toggleDocument=(piece,document)=>{const documents=piece.documentos||[];updatePiece(piece.id,{documentos:documents.includes(document)?documents.filter(value=>value!==document):[...documents,document]})};
  const documentation=item.documentacionMercancia||{alcance:'individual',tipoAduanero:'',aduaneroDisponible:false,podDisponible:false};
  const updateDocumentation=change=>updateCase({...item,documentacionMercancia:{...documentation,...change}});
  const total=merchandise.reduce((sum,piece)=>sum+Number(piece.cantidad||0),0);
  return <><SectionHeader title="Mercancía y documentación" subtitle={`${total} unidades · POD ${documentation.podDisponible?'DISPONIBLE':'PENDIENTE'}`}/><div className="global-documents"><label className="field"><span>Documento aduanero</span><select value={documentation.alcance} onChange={event=>updateDocumentation({alcance:event.target.value})}><option value="individual">INDIVIDUAL POR MERCANCÍA</option><option value="global">UNO PARA TODO EL EXPEDIENTE</option></select></label>{documentation.alcance==='global'&&<><label className="field"><span>Tipo</span><select value={documentation.tipoAduanero} onChange={event=>updateDocumentation({tipoAduanero:event.target.value})}><option value="">SIN ASIGNAR</option><option>T1</option><option>LEVANTE ADUANERO</option></select></label><label className={'document-switch '+(documentation.aduaneroDisponible?'checked':'')}><input type="checkbox" checked={documentation.aduaneroDisponible} onChange={event=>updateDocumentation({aduaneroDisponible:event.target.checked})}/><FileCheck2/><span><b>DOCUMENTO ADUANERO</b><small>{documentation.aduaneroDisponible?'DISPONIBLE':'PENDIENTE'}</small></span></label></>}<label className={'document-switch pod locked '+(documentation.podDisponible?'checked':'')}><input type="checkbox" checked={documentation.podDisponible} disabled readOnly/><ClipboardCheck/><span><b>POD CONJUNTO</b><small>{documentation.podDisponible?'RECIBIDO · LISTO PARA FACTURAR':'SE REGISTRA EN EL FLUJO OPERATIVO'}</small></span></label></div><div className="merchandise-list">{merchandise.map((piece,index)=><details className="merchandise-item" key={piece.id}><summary><span className="box-icon"><Box/></span><span><b>{piece.cantidad} {piece.tipo}{piece.cantidad===1?'':'S'} · {piece.peso||'PESO PENDIENTE'}</b><small>{piece.seguimiento?`TRACKING: ${piece.seguimiento}`:'SIN N.º DE SEGUIMIENTO'}</small></span><span className="document-count">{documentation.alcance==='global'?'DOC GLOBAL':`${(piece.documentos||[]).length}/2 DOCS`}</span><ChevronRight/></summary><div className="merchandise-editor"><label className="field"><span>Tipo</span><select value={piece.tipo} onChange={event=>updatePiece(piece.id,{tipo:event.target.value})}><option>CAJA</option><option>PALLET</option><option>SOBRE</option><option>PAQUETE</option><option>BULTO</option></select></label><label className="field"><span>Cantidad</span><input type="number" min="1" value={piece.cantidad} onChange={event=>updatePiece(piece.id,{cantidad:Number(event.target.value)||1})}/></label><label className="field"><span>Peso del grupo (kg)</span><input type="number" min="0.1" step="0.1" value={String(piece.peso||'').replace(/[^\d,.]/g,'').replace(',','.')} onChange={event=>updatePiece(piece.id,{peso:event.target.value?`${event.target.value} KG`:''})}/></label><label className="field"><span>N.º seguimiento (opcional)</span><input value={piece.seguimiento||''} onChange={event=>updatePiece(piece.id,{seguimiento:event.target.value.toUpperCase()})}/></label>{documentation.alcance==='individual'&&<div className="piece-documents"><span>Documento aduanero individual</span>{DOC_TYPES.map(document=><label key={document} className={(piece.documentos||[]).includes(document)?'checked':''}><input type="checkbox" checked={(piece.documentos||[]).includes(document)} onChange={()=>toggleDocument(piece,document)}/><FileCheck2/><b>{document}</b><small>{(piece.documentos||[]).includes(document)?'DISPONIBLE':'PENDIENTE'}</small></label>)}</div>}</div></details>)}</div><ReceptionRecords records={item.recepciones||[]}/></>;
}

function ReceptionRecords({records}){
  if(!records.length)return <div className="reception-empty"><Camera/><span><b>Sin recepciones documentadas</b><small>Las fotos y documentos aparecerán aquí al registrar la entrada.</small></span></div>;
  return <section className="reception-records"><div className="reception-title"><Camera/><div><h3>Recepciones de mercancía</h3><p>Evidencias fotográficas identificadas y documentos de llegada.</p></div></div>{records.map(record=><article className="reception-record" key={record.ref}><header><div><b>{formatReceptionDate(record.fecha)}</b><small>{record.ref} · ZONA {record.zona}</small></div><Badge>{(record.fotos||[]).length} FOTOS · {(record.documentos||[]).length} DOCS</Badge></header>{Boolean((record.fotos||[]).length)&&<div className="reception-photos">{record.fotos.map((file,index)=><figure key={file.id}><a href={file.url} target="_blank" rel="noreferrer" title={file.name}><img src={file.url} alt={`${file.tipo||'Vista general'} · ${file.mercancia||'Recepción completa'}`}/><span>FOTO {String(index+1).padStart(2,'0')}</span></a><figcaption><b>{file.tipo||'VISTA GENERAL'}</b><strong>{file.mercancia||'RECEPCIÓN COMPLETA'}</strong>{file.nota&&<small>{file.nota}</small>}</figcaption></figure>)}</div>}{Boolean((record.documentos||[]).length)&&<div className="reception-documents">{record.documentos.map(file=><a href={file.url} target="_blank" rel="noreferrer" key={file.id}><FileText/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}</article>)}</section>;
}

function Almacen({items,cases,openCase,registerEntry,updateEntry,deleteEntry,showFinance,storageTotal,csrfToken}){
  const [entryOpen,setEntryOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [view,setView]=useState('Activos');
  const visibleItems=items.filter(item=>view==='Archivados'?item.archivado||item.estado==='Expedido':!item.archivado&&item.estado!=='Expedido');
  const totalPackages=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+(Number(item.bultos)||0),0);
  const totalWeight=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+(Number(String(item.peso).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0),0);
  const submit=form=>{registerEntry(form);setEntryOpen(false)};
  return <>
    <section className={'summary-strip '+(!showFinance?'summary-strip-three':'')}>
      <Summary icon={Box} label="Bultos en stock" value={String(totalPackages)}/>
      <Summary icon={Scale} label="Peso total" value={totalWeight.toLocaleString('es-ES')+' kg'}/>
      <Summary icon={Layers3} label="Ocupación" value={Math.min(95,Math.round(48+totalPackages*1.5))+'%'}/>
      {showFinance&&<Summary icon={CircleDollarSign} label="Storage acumulado" value={money(storageTotal)}/>}
    </section>
    <section className="panel">
      <SectionHeader title="Mercancía y ubicaciones" subtitle="Cada recepción queda en stock, tenga o no expediente" action={<button className="button secondary" onClick={()=>setEntryOpen(true)}><Plus/> Registrar entrada</button>}/>
      <div className="warehouse-view-tabs">
        <button className={view==='Activos'?'active':''} onClick={()=>setView('Activos')}>En almacén <span>{items.filter(item=>!item.archivado&&item.estado!=='Expedido').length}</span></button>
        <button className={view==='Archivados'?'active':''} onClick={()=>setView('Archivados')}>Archivados <span>{items.filter(item=>item.archivado||item.estado==='Expedido').length}</span></button>
      </div>
      <div className="responsive-table warehouse-table">
        <div className="table-head"><span>Referencia / expediente</span><span>Ubicación</span><span>Entrada</span><span>Mercancía</span><span>Storage</span><span>Estado</span></div>
        {visibleItems.map(item=><button className="table-row" key={item.ref} onClick={()=>setEditing(item)}>
          <span className="primary-cell"><span className="box-icon"><Box/></span><span><b>{item.buque}</b><small>{item.ref} · {item.expediente||'SIN EXPEDIENTE'} · {(item.fotos||[]).length} fotos</small></span></span>
          <span data-label="Ubicación"><b>{item.zona}</b></span>
          <span data-label="Entrada">{item.entrada}</span>
          <span data-label="Mercancía">{item.bultos} bultos<small>{item.peso}</small></span>
          <span data-label="Storage">{item.dias} día{item.dias===1?'':'s'}</span>
          <span data-label="Estado"><Badge>{item.expediente?item.estado:'Por vincular'}</Badge></span>
        </button>)}
      </div>
    </section>
    {entryOpen&&<WarehouseEntryModal cases={cases} csrfToken={csrfToken} close={()=>setEntryOpen(false)} submit={submit}/>}
    {editing&&<WarehouseEditModal item={editing} cases={cases} close={()=>setEditing(null)} submit={item=>{updateEntry(item);setEditing(null)}} deleteItem={item=>{deleteEntry(item);setEditing(null)}}/>}
  </>;
}
function Summary({icon:Icon,label,value}){return <article><span><Icon/></span><div><small>{label}</small><b>{value}</b></div></article>}

const vesselPhotoUrl=vessel=>String(vessel.photoUrl||vessel.image||'').trim();
const vesselInitials=name=>String(name||'BUQUE').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('');
function Buques({vessels,cases,warehouseEntries,saveVessel,deleteVessel,openCase}){
  const [query,setQuery]=useState('');
  const [editing,setEditing]=useState(null);
  const rows=[...vessels].sort((a,b)=>vesselNameOf(a).localeCompare(vesselNameOf(b))).filter(vessel=>[vesselNameOf(vessel),vessel.imo,vessel.mmsi,vessel.lastPort].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <><section className="panel vessels-panel"><SectionHeader title="Listado de buques" subtitle="Base de datos para buscar, elegir en expedientes y reutilizar IMO/MMSI." action={<button className="button secondary" onClick={()=>setEditing({name:'',imo:'',mmsi:'',lastPort:'',photoUrl:''})}><Plus/> Nuevo buque</button>}/><label className="search-box standalone vessel-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar buque por nombre, IMO o MMSI…"/></label><div className="vessel-list"><div className="vessel-list-head"><span>Buque</span><span>IMO / MMSI</span><span>Expedientes</span><span>Stock</span><span>Acciones</span></div>{rows.map(vessel=>{const name=vesselNameOf(vessel);const photo=vesselPhotoUrl(vessel);const relatedCases=cases.filter(item=>sameVessel(item.buque,name));const activeStock=warehouseEntries.filter(entry=>activeWarehouseEntry(entry)&&sameVessel(entry.buque,name));const lastCase=relatedCases[0];const stock=activeStock.reduce((sum,item)=>sum+Number(item.bultos||0),0);return <article className="vessel-row" key={vessel.id||name}><div className="vessel-photo">{photo?<img src={photo} alt={name}/>:<span><Ship/><b>{vesselInitials(name)}</b></span>}</div><div className="vessel-main"><h3>{name}</h3><small>{vessel.lastPort||lastCase?.puerto||'PUERTO PENDIENTE'}</small></div><div className="vessel-metrics"><span><small>IMO</small><b>{vessel.imo||'Pendiente'}</b></span><span><small>MMSI</small><b>{vessel.mmsi||'Pendiente'}</b></span><span><small>Expedientes</small><b>{relatedCases.length}</b></span><span><small>Stock</small><b>{stock} bultos</b></span></div><div className="vessel-actions">{lastCase&&<button className="button tertiary" onClick={()=>openCase(lastCase.id)}>Abrir {lastCase.id}</button>}<button className="icon-button compact" title="Editar buque" onClick={()=>setEditing(vessel)}><PencilLine/></button><button className="icon-button compact danger" title="Borrar buque" onClick={()=>deleteVessel(vessel)}><Trash2/></button></div></article>})}</div>{!rows.length&&<Empty text="No hay fichas de buque con ese nombre."/>}</section>{editing&&<VesselModal item={editing} close={()=>setEditing(null)} submit={item=>{saveVessel(item);setEditing(null)}}/>}</>;
}

function VesselModal({item,close,submit}){
  const [form,setForm]=useState({id:item.id||item.name||'',name:vesselNameOf(item),imo:item.imo||'',mmsi:item.mmsi||'',lastPort:item.lastPort||'',photoUrl:item.photoUrl||''});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal vessel-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Ficha de buque</span><h2>{item.name?'Editar buque':'Nuevo buque'}</h2><p>Esta información se reutiliza al crear expedientes y para seguimiento AIS.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field wide"><span>Nombre del buque *</span><input name="name" value={form.name} onChange={update} required autoFocus/></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="7 dígitos"/></label><label className="field"><span>MMSI</span><input name="mmsi" inputMode="numeric" maxLength="9" value={form.mmsi} onChange={update} placeholder="9 dígitos"/></label><label className="field wide"><span>Puerto habitual / último puerto</span><input name="lastPort" value={form.lastPort} onChange={update} placeholder="Ej. SAGUNTO"/></label><label className="field wide"><span>Foto del buque (URL opcional)</span><input name="photoUrl" value={form.photoUrl} onChange={update} placeholder="Pega aquí una URL de imagen del buque"/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar ficha</button></div></form></section></div>;
}

function Transportes({items,update,openCase,team,providers,saveProvider}){
  const [filter,setFilter]=useState('Todos');const [editing,setEditing]=useState(null);const [providerOpen,setProviderOpen]=useState(false);const visible=items.filter(item=>filter==='Todos'||item.estado===filter);
  return <><section className="provider-strip panel"><SectionHeader title="Proveedores de transporte" subtitle="Empresas disponibles para asignar servicios" action={<button className="button secondary" onClick={()=>setProviderOpen(true)}><Plus/> Añadir proveedor</button>}/><div>{providers.filter(item=>item.activo!==false).map(provider=><span key={provider.id}><Truck/><b>{provider.nombre}</b><small>{provider.contacto||'Sin contacto'}</small></span>)}</div></section><section className="module-toolbar"><div className="filter-chips">{['Todos','En ruta','Asignado','Sin asignar','Entregado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></section><section className="transport-grid">{visible.map(item=>{const provider=providers.find(entry=>entry.id===item.proveedorId);const route=routeParts(item);return <article className="transport-card" key={item.id}><div className="transport-head"><span className={'transport-icon '+statusTone(item.estado)}><Truck/></span><div><small>{item.id} · {item.expediente}</small><Badge>{item.estado}</Badge></div><button className="icon-button compact" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div><div className="transport-route-detail"><span><MapPin/><small>LUGAR DE RECOGIDA</small><b>{route.origen}</b></span><i><ChevronRight/></i><span><Navigation/><small>LUGAR DE ENTREGA</small><b>{route.destino}</b></span></div><div className="transport-provider">{provider?.nombre||'Proveedor sin asignar'}</div><div className="transport-info"><span><Clock3/><small>Horario</small><b>{item.hora}</b></span><span><UserRound/><small>Conductor</small><b>{item.conductor}</b></span><span><Navigation/><small>Vehículo</small><b>{item.vehiculo}</b></span></div><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button primary" onClick={()=>setEditing(item)}>{item.estado==='Sin asignar'?'Asignar servicio':'Editar transporte'}</button></div></article>})}</section>{editing&&<TransportEditModal item={editing} team={team} providers={providers} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}{providerOpen&&<ProviderModal close={()=>setProviderOpen(false)} submit={item=>{saveProvider(item);setProviderOpen(false)}}/>}</>;
}
function Aduanas({items,update,openCase,notify}){
  const [editing,setEditing]=useState(null);
  return <><section className="alert-banner"><CircleAlert/><div><b>{items.filter(item=>item.estado==='Pendiente').length} trámite requiere atención</b><p>Revisa los documentos pendientes y sus fechas límite.</p></div></section><section className="panel"><SectionHeader title="Trámites aduaneros" subtitle="DUA, T1, T2L y levantes vinculados a expedientes"/><div className="customs-grid">{items.map(item=><article className="custom-card" key={item.id}><div className="custom-card-top"><span className="doc-icon"><FileCheck2/></span><div><small>{item.id} · {item.expediente}</small><h3>{item.tipo}</h3></div><Badge>{item.estado}</Badge></div><dl><div><dt>Referencia</dt><dd>{item.referencia}</dd></div><div><dt>Fecha límite</dt><dd>{item.limite}</dd></div></dl><p>{item.nota}</p><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button secondary" onClick={()=>setEditing(item)}><PencilLine/> Editar</button></div></article>)}</div></section>{editing&&<CustomEditModal item={editing} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}</>;
}
function Clientes({notify,clients,updateClient}){
  const [query,setQuery]=useState('');const [editing,setEditing]=useState(null);const visible=clients.filter(item=>item.nombre.toLowerCase().includes(query.toLowerCase()));
  return <><section className="panel"><SectionHeader title="Directorio de clientes" subtitle="Contactos y condiciones comerciales activas"/><label className="search-box standalone"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente…"/></label><div className="client-grid">{visible.map(item=><article className="client-card" key={item.codigo}><div className="client-head"><span>{item.nombre.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><div><h3>{item.nombre}</h3><small>{item.codigo} · {item.expedientes} expedientes activos</small></div><button className="icon-button" aria-label={'Editar '+item.nombre} onClick={()=>setEditing(item)}><PencilLine/></button></div><a href={'mailto:'+item.contacto}><Mail/>{item.contacto}</a><div className="rate-grid"><span><small>Recepción</small><b>{item.recepcion}</b></span><span><small>Storage</small><b>{item.storage}</b></span><span><small>Transporte</small><b>{item.transporte}</b></span><span><small>Fuera de horario</small><b>{item.recargo}</b></span></div><button className="button tertiary full" onClick={()=>setEditing(item)}>Editar ficha y tarifas <PencilLine/></button></article>)}</div></section>{editing&&<ClientEditModal item={editing} close={()=>setEditing(null)} submit={item=>{updateClient(item);setEditing(null)}}/>}</>;
}
function Facturacion({openCase,notify,invoices,cases,updateInvoice}){
  const [editing,setEditing]=useState(null);
  const total=invoices.filter(item=>item.estado!=='Enviada').reduce((sum,item)=>sum+item.importe,0);
  const readyCases=cases.filter(item=>operationFlow(item).billingReady&&!invoices.some(invoice=>invoice.expediente===item.id));
  return <>{readyCases.length>0&&<section className="billing-ready-panel panel"><SectionHeader title="Listos para facturar" subtitle="Operativa terminada y POD recibido"/><div className="billing-ready-list">{readyCases.map(item=><button key={item.id} onClick={()=>openCase(item.id)}><span className="invoice-icon"><CheckCircle2/></span><span><b>{caseLabel(item)}</b><small>{item.cliente} · POD verificado</small></span><ChevronRight/></button>)}</div></section>}<section className="billing-hero"><div><span>Importe pendiente de gestión</span><strong>{money(total)}</strong><small>{invoices.filter(item=>item.estado!=='Enviada').length} documentos · junio 2026</small></div><div><span className="holded-mark">H</span><div><b>Integración con Holded</b><small>Exportación manual en este MVP</small></div></div><button className="button primary" onClick={()=>notify('CSV generado con '+invoices.length+' documentos')}><Download/> Exportar selección</button></section><section className="panel"><SectionHeader title="Documentos de facturación" subtitle="Revisa conceptos antes de exportar"/><div className="responsive-table billing-table"><div className="table-head"><span>Documento / expediente</span><span>Cliente</span><span>Concepto</span><span>Importe</span><span>Estado</span><span/></div>{invoices.map(item=><div className="table-row" key={item.id}><span className="primary-cell"><span className="invoice-icon"><ReceiptText/></span><span><b>{item.id}</b><button onClick={()=>openCase(item.expediente)}>{item.expediente}</button></span></span><span data-label="Cliente">{item.cliente}</span><span data-label="Concepto">{item.concepto}</span><strong data-label="Importe">{money(item.importe)}</strong><span data-label="Estado"><Badge>{item.estado}</Badge></span><button className="icon-button" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div>)}</div></section>{editing&&<InvoiceEditModal item={editing} close={()=>setEditing(null)} submit={item=>{updateInvoice(item);setEditing(null)}}/>}</>;
}

const MAIL_STATUS={review:'Revisar',processed:'Creado',ignored:'Descartado',error:'Error'};
const MAIL_ACTION_LABELS={new:'NUEVO SERVICIO',update:'ACTUALIZACIÓN',cancel:'CANCELACIÓN',information:'INFORMATIVO',not_service:'NO OPERATIVO'};
const MAIL_SERVICE_LABELS={reception:'RECEPCIÓN',pickup:'RECOGIDA',delivery:'ENTREGA',reception_and_delivery:'RECEPCIÓN + ENTREGA',customs:'ADUANAS',other:'OTRO SERVICIO',none:'SIN SERVICIO'};
function Correos({csrfToken,notify,openCase,reloadOperational,canRebuild}){
  const [items,setItems]=useState([]);
  const [counts,setCounts]=useState({review:0,processed:0,ignored:0,error:0});
  const [lastRun,setLastRun]=useState(null);
  const [filter,setFilter]=useState('all');
  const [loading,setLoading]=useState(true);
  const [processing,setProcessing]=useState(false);
  const [rebuilding,setRebuilding]=useState(false);
  const [rebuildProgress,setRebuildProgress]=useState('');
  const [editing,setEditing]=useState(null);
  const [error,setError]=useState('');
  const load=async(nextFilter=filter)=>{
    setLoading(true);setError('');
    try{const result=await api('/api/mail/inbox.php?status='+nextFilter);setItems([...(result.items||[])].sort(newestMailFirst));setCounts(result.counts);setLastRun(result.lastRun);const repaired=Number(result.reconciliation?.mergedCases||0)+Number(result.reconciliation?.correctedCases||0)+Number(result.reconciliation?.removedEmptyCases||0);if(repaired){await reloadOperational();notify(`${repaired} expedientes portuarios corregidos`)}}
    catch(reason){setError(reason.message)}
    finally{setLoading(false)}
  };
  useEffect(()=>{load(filter)},[filter]);
  const process=async()=>{
    setProcessing(true);setError('');
    try{
      const result=await api('/api/mail/process.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:'{}'});
      const summary=result.summary;
      const repaired=Number(summary.reconciliation?.mergedCases||0)+Number(summary.reconciliation?.correctedCases||0)+Number(summary.reconciliation?.removedEmptyCases||0);
      const removedOld=Number(summary.removedOldCases||0);
      const removedInvalid=Number(summary.removedInvalidCases||0);
      const coherence=summary.scheduleCoherence||{};
      const synced=Number(coherence.createdReceptionEvents||0)+Number(coherence.createdTransportEvents||0)+Number(coherence.createdTransports||0);
      notify(`${summary.scanned} correos nuevos · ${summary.processed} trabajos creados · ${summary.review} para revisar${synced?` · ${synced} trabajos al calendario`:''}${removedInvalid?` · ${removedInvalid} inválidos retirados`:''}${removedOld?` · ${removedOld} antiguos retirados`:''}${repaired?` · ${repaired} duplicados corregidos`:''}`);
      await Promise.all([load(filter),reloadOperational()]);
    }catch(reason){setError(reason.message)}
    finally{setProcessing(false)}
  };
  const rebuild=async()=>{
    setRebuilding(true);setError('');setRebuildProgress('Preparando reconstrucción…');
    try{
      const period={start:'2026-06-01',end:'2026-07-06'};
      const markerKey='swiftport-email-rebuild';
      const canResume=localStorage.getItem(markerKey)===JSON.stringify(period);
      let reset;
      const preview=await api('/api/admin/rebuild.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({action:'preview_period',...period})});
      if(canResume){
        reset={pendingEmails:Number(preview.pendingEmails||0),removedCases:0};
      }else{
      if(!window.confirm(`Se borrarán ${preview.caseCount} expedientes, incluidos los completados, y toda su operativa. Se guardará una copia de seguridad y se reinterpretarán ${preview.mailCount} correos de junio. ¿Continuar?`)){setRebuildProgress('');return}
      reset=await api('/api/admin/rebuild.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({action:'reset_period',...period})});
      }
      localStorage.setItem(markerKey,JSON.stringify(period));
      let remaining=Number(reset.pendingEmails||0),interpreted=0,created=0,ignored=0;
      while(remaining>0){
        setRebuildProgress(`Interpretando junio con IA · ${remaining} pendientes`);
        const batch=await api('/api/admin/rebuild.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({action:'process_period_batch',...period})});
        interpreted+=Number(batch.summary?.processed||0)+Number(batch.summary?.review||0)+Number(batch.summary?.ignored||0);
        created+=Number(batch.summary?.processed||0);ignored+=Number(batch.summary?.ignored||0);
        const next=Number(batch.remaining||0);
        if(next>=remaining)break;
        remaining=next;
      }
      setRebuildProgress('');
      localStorage.removeItem(markerKey);
      notify(`${reset.removedCases} expedientes retirados · ${created} correos aplicados · ${ignored} fuera de junio o no operativos`);
      await Promise.all([load('all'),reloadOperational()]);
      setFilter('all');
    }catch(reason){setError(reason.message)}
    finally{setRebuilding(false)}
  };
  useEffect(()=>{
    if(!canRebuild)return;
    const host=document.querySelector('.mail-hero-actions');
    if(!host)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='button secondary';
    button.disabled=processing||rebuilding;
    button.textContent=rebuilding?(rebuildProgress||'Creando prueba automática…'):'Crear todo automáticamente';
    button.onclick=rebuild;
    host.prepend(button);
    return()=>button.remove();
  },[canRebuild,processing,rebuilding,rebuildProgress]);
  const ignore=async item=>{
    try{await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({id:item.id,action:'ignore'})});notify('Correo descartado');load(filter)}
    catch(reason){setError(reason.message)}
  };
  const reprocess=async item=>{
    try{const result=await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({id:item.id,action:'reprocess'})});notify(result.status==='processed'?`Trabajo creado automáticamente: ${result.caseRef}`:result.status==='review'?'Servicio detectado, pero faltan datos en el correo':'El correo sigue sin datos operativos suficientes');if(result.status==='processed')await reloadOperational();setFilter(result.status);load(result.status)}
    catch(reason){setError(reason.message)}
  };
  const approve=async(item,extracted)=>{
    const result=await api('/api/mail/review.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({id:item.id,action:'approve',extracted})});
    setEditing(null);notify('Expediente '+result.caseRef+' creado desde el correo');
    await Promise.all([load(filter),reloadOperational()]);
  };
  return <><section className="mail-automation-hero"><div><Mail/><span><b>Entrada automática con IA</b><small>Los servicios nuevos crean el trabajo; cambios y dudas esperan revisión.</small></span></div><div><small>Última comprobación</small><b>{lastRun?.finished_at&&formatReceptionDate(lastRun.finished_at)||'Todavía no ejecutada'}</b></div><div className="mail-hero-actions"><button className="button primary" disabled={processing||rebuilding} onClick={process}><RefreshCw className={processing?'spinning':''}/>{processing?'Leyendo buzones…':'Comprobar correos ahora'}</button></div></section>{error&&<div className="form-error"><CircleAlert/>{error}</div>}<section className="panel"><SectionHeader title="Bandeja de servicios" subtitle="info@swiftportlogistic.com y operations@swiftportlogistic.com"/><div className="mail-filters">{[['all','Todos',Object.values(counts).reduce((a,b)=>a+b,0)],['review','Revisar',counts.review],['processed','Creados',counts.processed],['ignored','Descartados',counts.ignored],['error','Errores',counts.error]].map(([value,label,total])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}<span>{total}</span></button>)}</div>{loading?<div className="users-loading">Cargando correos…</div>:items.length?<div className="mail-list">{items.map(item=><article key={item.id} className={'mail-item '+item.status}><header><div><b>{item.subject||'Sin asunto'}</b><small>{item.sender_name||item.sender_email} · {formatReceptionDate(item.received_at)}</small></div><Badge>{MAIL_STATUS[item.status]||item.status}</Badge></header>{item.extracted&&<><div className="mail-extracted"><span><small>BUQUE</small><b>{item.extracted.vessel||'—'}</b></span><span><small>ETB / ETA</small><b>{[item.extracted.etb||item.extracted.eta,item.extracted.etb_time||item.extracted.eta_time].filter(Boolean).join(' · ')||'POR CONFIRMAR'}</b></span><span><small>PUERTO</small><b>{item.extracted.port||'POR CONFIRMAR'}</b></span><span><small>SERVICIO</small><b>{MAIL_SERVICE_LABELS[item.extracted.service_kind]||[item.extracted.reception?.required&&'RECEPCIÓN',item.extracted.transport?.required&&'TRANSPORTE'].filter(Boolean).join(' + ')||'—'}</b></span></div><div className="mail-ai-summary"><span>{MAIL_ACTION_LABELS[item.extracted.request_action]||'CLASIFICACIÓN ANTERIOR'}</span><b>{item.extracted.cargo_summary||item.extracted.operational_notes||'Sin resumen operativo'}</b>{item.extracted.operational_notes&&item.extracted.cargo_summary&&<small>{item.extracted.operational_notes}</small>}<em>Confianza {Math.round(Number(item.extracted.confidence||item.confidence||0)*100)}%</em></div>{item.extracted.tasks?.length>0&&<MailTaskProposal tasks={item.extracted.tasks}/>}</>}{item.review_reason&&<p className="mail-reason"><CircleAlert/>{item.review_reason}</p>}{item.error_message&&<p className="mail-reason error"><CircleAlert/>{item.error_message}</p>}<details className="mail-original"><summary>Ver correo original</summary><pre>{item.body}</pre></details><footer>{item.case_ref&&<button className="button tertiary" onClick={()=>openCase(item.case_ref)}>Abrir {item.case_ref}</button>}{['ignored','error'].includes(item.status)&&<button className="button secondary" onClick={()=>reprocess(item)}><RefreshCw/> Reinterpretar</button>}{item.status==='review'&&<><button className="button tertiary" onClick={()=>ignore(item)}>Descartar</button><button className="button secondary" onClick={()=>reprocess(item)}><RefreshCw/> Reinterpretar con IA</button><button className="button primary" onClick={()=>setEditing(item)}><PencilLine/> Revisar y crear</button></>}</footer></article>)}</div>:<Empty text="No hay correos en este estado."/>}</section>{editing&&<MailReviewModal item={editing} close={()=>setEditing(null)} submit={data=>approve(editing,data)}/>}</>;
}

function MailTaskProposal({tasks}){
  const labels={reception:'Recepción',pickup:'Recogida',delivery:'Entrega',samples:'Muestras',crew_transport:'Tripulación',other:'Otro'};
  return <div className="mail-task-proposal"><strong>PROPUESTA OPERATIVA</strong>{tasks.map((task,index)=><span key={index}><i>{index+1}</i><span><b>{labels[task.kind]||task.kind} · {[task.date,task.time].filter(Boolean).join(' ')||'Fecha pendiente'}</b><small>{task.pickup||'Origen pendiente'} → {task.delivery||'Destino pendiente'}</small>{task.cargo&&<em>{task.cargo}</em>}</span><small>{Math.round(Number(task.confidence||0)*100)}%</small></span>)}</div>;
}

function MailReviewModal({item,close,submit}){
  const base=item.extracted||{};
  const [form,setForm]=useState({
    client:base.client||'',vessel:base.vessel||'',imo:base.imo||'',mmsi:base.mmsi||'',eta:base.eta||'',eta_time:base.eta_time||'',etb:base.etb||'',etb_time:base.etb_time||'',etd:base.etd||'',etd_time:base.etd_time||'',port_stay:base.port_stay||'',delivery_mode:base.delivery_mode||'unknown',operation_location:base.operation_location||'',port:base.port||'',priority:base.priority||'Media',cargo_summary:base.cargo_summary||'',
    operational_notes:base.operational_notes||'',existing_reference:base.existing_reference||'',request_action:'new',service_kind:base.service_kind||'other',
    reception:{required:Boolean(base.reception?.required),date:base.reception?.date||'',time:base.reception?.time||'',location:base.reception?.location||''},
    transport:{required:Boolean(base.transport?.required),date:base.transport?.date||'',time:base.transport?.time||'',pickup:base.transport?.pickup||'',delivery:base.transport?.delivery||''},
    is_service:true,confidence:1
  });
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const top=event=>setForm({...form,[event.target.name]:event.target.value});
  const service=(type,key,value)=>setForm({...form,[type]:{...form[type],[key]:value}});
  const save=async event=>{event.preventDefault();setBusy(true);setError('');try{await submit(form)}catch(reason){setError(reason.message);setBusy(false)}};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close()}}><section className="modal mail-review-modal"><div className="modal-head"><div><span className="overline">Revisión de correo</span><h2>Confirmar trabajo operativo</h2><p>{item.subject}</p></div><button className="icon-button" disabled={busy} onClick={close}><X/></button></div><form onSubmit={save}>{error&&<div className="form-error wide"><CircleAlert/>{error}</div>}<label className="field"><span>Cliente</span><input name="client" value={form.client} onChange={top}/></label><label className="field"><span>Buque *</span><input name="vessel" value={form.vessel} onChange={top} required/></label><label className="field"><span>ETA · fecha</span><input name="eta" type="date" value={form.eta} onChange={top}/></label><label className="field"><span>ETA · hora</span><input name="eta_time" type="time" value={form.eta_time} onChange={top}/></label><label className="field"><span>ETB · fecha</span><input name="etb" type="date" value={form.etb} onChange={top}/></label><label className="field"><span>ETB · hora</span><input name="etb_time" type="time" value={form.etb_time} onChange={top}/></label><label className="field"><span>ETD · fecha</span><input name="etd" type="date" value={form.etd} onChange={top}/></label><label className="field"><span>ETD · hora</span><input name="etd_time" type="time" value={form.etd_time} onChange={top}/></label><label className="field"><span>Puerto</span><input name="port" value={form.port} onChange={top}/></label><label className="field"><span>Prioridad</span><select name="priority" value={form.priority} onChange={top}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Referencia cliente</span><input name="existing_reference" value={form.existing_reference} onChange={top}/></label><label className="field wide"><span>Resumen de mercancía</span><input name="cargo_summary" value={form.cargo_summary} onChange={top}/></label><label className="field wide"><span>Instrucciones operativas</span><input name="operational_notes" value={form.operational_notes} onChange={top}/></label><fieldset className="mail-service-fieldset wide"><label className="service-check"><input type="checkbox" checked={form.reception.required} onChange={event=>service('reception','required',event.target.checked)}/><Box/><span><b>RECEPCIÓN</b><small>Crear tarea de recepción</small></span></label>{form.reception.required&&<div className="mail-service-fields"><label className="field"><span>Fecha *</span><input type="date" value={form.reception.date} onChange={event=>service('reception','date',event.target.value)} required/></label><label className="field"><span>Hora</span><input type="time" value={form.reception.time} onChange={event=>service('reception','time',event.target.value)}/></label><label className="field"><span>Lugar</span><input value={form.reception.location} onChange={event=>service('reception','location',event.target.value)}/></label></div>}</fieldset><fieldset className="mail-service-fieldset wide"><label className="service-check"><input type="checkbox" checked={form.transport.required} onChange={event=>service('transport','required',event.target.checked)}/><Truck/><span><b>TRANSPORTE</b><small>Crear transporte y tarea de calendario</small></span></label>{form.transport.required&&<div className="mail-service-fields"><label className="field"><span>Fecha *</span><input type="date" value={form.transport.date} onChange={event=>service('transport','date',event.target.value)} required/></label><label className="field"><span>Hora</span><input type="time" value={form.transport.time} onChange={event=>service('transport','time',event.target.value)}/></label><label className="field"><span>Recogida</span><input value={form.transport.pickup} onChange={event=>service('transport','pickup',event.target.value)}/></label><label className="field"><span>Entrega</span><input value={form.transport.delivery} onChange={event=>service('transport','delivery',event.target.value)}/></label></div>}</fieldset><div className="modal-actions wide"><button type="button" className="button tertiary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" disabled={busy}><CheckCircle2/>{busy?'Creando…':'Crear expediente y trabajos'}</button></div></form></section></div>;
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
      await api('/api/admin/users.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({id:item.id,roles})});
      setUsers(users.map(user=>user.id===item.id?{...user,roles,role:primaryRole(roles)}:user));
      notify(`Permisos de ${item.fullName} actualizados`);
      onUsersChanged();
    }catch(reason){setError(reason.message)}
  };
  const toggleFormRole=role=>setForm(current=>{const roles=current.roles.includes(role)?current.roles.filter(value=>value!==role):[...current.roles,role];return {...current,roles:roles.length?roles:current.roles}});
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{await api('/api/admin/users.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify(form)});setForm({fullName:'',email:'',password:'',roles:['operations']});notify('Usuario creado correctamente');load();onUsersChanged()}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  const RoleChecks=({roles,toggle})=><div className="multi-role-selector">{Object.entries(ROLE_LABELS).map(([value,label])=><label className={roles.includes(value)?'checked':''} key={value}><input type="checkbox" checked={roles.includes(value)} onChange={()=>toggle(value)}/><CheckCircle2/><span><b>{label}</b><small>{value==='driver'?'Calendario, almacén y entregas':value==='operations'?'Expedientes, correos y planificación':value==='finance'?'Importes, tarifas y facturación':'Control total y usuarios'}</small></span></label>)}</div>;
  return <div className="users-layout">
    <section className="panel"><SectionHeader title="Equipo con acceso" subtitle="Una persona puede combinar varios roles y permisos"/>{error&&<div className="form-error users-error"><CircleAlert/>{error}</div>}{loading?<div className="users-loading">Cargando usuarios…</div>:<div className="user-list">{users.map(item=><article key={item.id}><div className="avatar">{initials(item.fullName)}</div><div className="user-identity"><b>{item.fullName}</b><small>{item.email}</small><em>{roleLabel(item)}</em></div><RoleChecks roles={rolesOf(item)} toggle={role=>toggleUserRole(item,role)}/><button className="button tertiary preview-user" onClick={()=>onPreview(item)}><Eye/> Ver como</button></article>)}</div>}</section>
    <section className="panel create-user"><SectionHeader title="Añadir usuario" subtitle="Selecciona uno o varios roles"/><form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required/></label><label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña temporal</span><input name="password" type="password" minLength="4" value={form.password} onChange={update} required/></label><div className="field"><span>Roles y permisos</span><RoleChecks roles={form.roles} toggle={toggleFormRole}/></div><button className="button primary full" disabled={busy}><UserPlus/>{busy?'Creando…':'Crear usuario'}</button></form></section>
  </div>;
}

function CaseEditModal({item,close,submit,vessels=[]}){
  const call=item.portCall||{};
  const legacyEta=String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0]||'';
  const [form,setForm]=useState({...item,imo:item.imo||'',mmsi:item.mmsi||'',servicios:(item.servicios||[]).join(', '),etaDate:call.etaDate||legacyEta,etaTime:call.etaTime||'',etbDate:call.etbDate||'',etbTime:call.etbTime||'',etdDate:call.etdDate||'',etdTime:call.etdTime||''});
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
    submit({...item,...form,imo:String(form.imo||'').replace(/\D/g,''),mmsi,eta:form.etaDate||'Por confirmar',portCall:{etaDate:form.etaDate,etaTime:form.etaTime,etbDate:form.etbDate,etbTime:form.etbTime,etdDate:form.etdDate,etdTime:form.etdTime,updatedAt:new Date().toISOString()},bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)});
  };
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios y actualizarán la ficha del buque.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Buque</span><input name="buque" list="known-vessels-edit" value={form.buque} onChange={update} required/><datalist id="known-vessels-edit">{vessels.map(vessel=><option key={vessel.id||vessel.name} value={vessel.name}>{[vessel.imo&&`IMO ${vessel.imo}`,vessel.mmsi&&`MMSI ${vessel.mmsi}`].filter(Boolean).join(' · ')}</option>)}</datalist></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="7 dígitos"/></label><label className="field"><span>MMSI para seguimiento AIS</span><input name="mmsi" inputMode="numeric" pattern="\d{9}" maxLength="9" value={form.mmsi} onChange={update} placeholder="9 dígitos"/></label><div className="vessel-memory-hint wide"><Ship/><span><b>Ficha de buque</b><small>Al guardar, Swiftport recordará este IMO/MMSI para futuras escalas del mismo buque.</small></span></div><label className="field"><span>ETA · fecha</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA · hora</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB · fecha</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/></label><label className="field"><span>ETB · hora</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD · fecha</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD · hora</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','Planificado','En curso','Bloqueado','Completado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}

function LegacyCaseEditModal({item,close,submit}){
  const call=item.portCall||{};
  const legacyEta=String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0]||'';
  const [form,setForm]=useState({...item,servicios:item.servicios.join(', '),etaDate:call.etaDate||legacyEta,etaTime:call.etaTime||'',etbDate:call.etbDate||'',etbTime:call.etbTime||'',etdDate:call.etdDate||'',etdTime:call.etdTime||''});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();submit({...item,...form,eta:form.etaDate||'Por confirmar',portCall:{etaDate:form.etaDate,etaTime:form.etaTime,etbDate:form.etbDate,etbTime:form.etbTime,etdDate:form.etdDate,etdTime:form.etdTime,updatedAt:new Date().toISOString()},bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Buque</span><input name="buque" value={form.buque} onChange={update} required/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>ETA · fecha</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA · hora</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB · fecha</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/></label><label className="field"><span>ETB · hora</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD · fecha</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD · hora</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','Planificado','En curso','Bloqueado','Completado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}

function TransportEditModal({item,team,providers,close,submit}){
  const initialRoute=routeParts(item);
  const [form,setForm]=useState({...item,...initialRoute,fecha:item.fecha||new Date().toISOString().slice(0,10),inicio:item.inicio||'09:00',fin:item.fin||'10:00'});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const estado=form.conductor==='Sin asignar'?'Sin asignar':form.estado==='Sin asignar'?'Asignado':form.estado;submit({...form,ruta:`${form.origen.trim()} → ${form.destino.trim()}`,estado})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal transport-edit-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar recorrido</h2><p>Indica libremente dónde se recoge y dónde se entrega.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Lugar de recogida</span><input name="origen" value={form.origen} onChange={update} placeholder="Ej. ALMACÉN SWIFTPORT, TECHNYMON, AEROPUERTO…" required/></label><label className="field wide"><span>Lugar de entrega</span><input name="destino" value={form.destino} onChange={update} placeholder="Ej. BUQUE, ALMACÉN, EMPRESA X (BILBAO)…" required/></label><div className="route-preview wide"><MapPin/><span><small>RECORRIDO</small><b>{form.origen||'ORIGEN'} → {form.destino||'DESTINO'}</b></span></div><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Hora inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update} required/></label><label className="field"><span>Hora fin</span><input name="fin" type="time" value={form.fin} onChange={update} required/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Sin asignar','Asignado','En ruta','Entregado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Conductor</span><select name="conductor" value={form.conductor} onChange={update}><option>Sin asignar</option>{team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver')).map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Proveedor</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Vehículo / matrícula</span><input name="vehiculo" value={form.vehiculo} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar recorrido</button></div></form></section></div>;
}

function ProviderModal({close,submit}){
  const [form,setForm]=useState({id:'',nombre:'',contacto:'',telefono:'',activo:true});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Proveedores</span><h2>Añadir empresa de transporte</h2><p>Quedará disponible en Calendario y Transportes.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field wide"><span>Empresa</span><input name="nombre" value={form.nombre} onChange={update} required autoFocus/></label><label className="field"><span>Persona / departamento</span><input name="contacto" value={form.contacto} onChange={update}/></label><label className="field"><span>Teléfono</span><input name="telefono" value={form.telefono} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar proveedor</button></div></form></section></div>;
}

function ClientEditModal({item,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.codigo}</span><h2>Editar cliente y tarifas</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit({...form,expedientes:Number(form.expedientes)||0})}}><label className="field"><span>Nombre</span><input name="nombre" value={form.nombre} onChange={update} required/></label><label className="field"><span>Email de contacto</span><input name="contacto" type="email" value={form.contacto} onChange={update} required/></label><label className="field"><span>Expedientes activos</span><input name="expedientes" type="number" min="0" value={form.expedientes} onChange={update}/></label><label className="field"><span>Recepción</span><input name="recepcion" value={form.recepcion} onChange={update}/></label><label className="field"><span>Storage</span><input name="storage" value={form.storage} onChange={update}/></label><label className="field"><span>Transporte</span><input name="transporte" value={form.transporte} onChange={update}/></label><label className="field wide"><span>Recargo fuera de horario</span><input name="recargo" value={form.recargo} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cliente</button></div></form></section></div>;
}

function InvoiceEditModal({item,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar facturación</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit({...form,importe:Number(form.importe)||0})}}><label className="field"><span>Expediente</span><input name="expediente" value={form.expediente} onChange={update} required/></label><label className="field"><span>Cliente</span><input name="cliente" value={form.cliente} onChange={update} required/></label><label className="field wide"><span>Concepto</span><input name="concepto" value={form.concepto} onChange={update} required/></label><label className="field"><span>Importe (€)</span><input name="importe" type="number" min="0" step="0.01" value={form.importe} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Borrador','Revisar','Lista','Enviada'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field wide"><span>Vencimiento</span><input name="vencimiento" value={form.vencimiento} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar documento</button></div></form></section></div>;
}

function CustomEditModal({item,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar trámite aduanero</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field"><span>Expediente</span><input name="expediente" value={form.expediente} onChange={update}/></label><label className="field"><span>Tipo</span><input name="tipo" value={form.tipo} onChange={update}/></label><label className="field"><span>Referencia</span><input name="referencia" value={form.referencia} onChange={update}/></label><label className="field"><span>Fecha límite</span><input name="limite" value={form.limite} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Pendiente','Documentación','Liberado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Nota</span><input name="nota" value={form.nota} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar trámite</button></div></form></section></div>;
}

function CargoManifest({item}){
  if(!item)return null;
  const documentation=item.documentacionMercancia||{};
  const nextStep=nextOperationStep(item);
  const receptions=item.recepciones||[];
  const photos=receptions.flatMap(record=>record.fotos||[]);
  const receptionDocuments=receptions.flatMap(record=>record.documentos||[]);
  return <div className="driver-manifest wide"><div><Box/><span><b>CARGA PARA EL CONDUCTOR</b><small>{item.buque} · {item.puerto}</small></span></div>{item.resumenMercancia&&<div className="manifest-email-brief"><PackageCheck/><span><small>MERCANCÍA INDICADA EN EL CORREO</small><b>{item.resumenMercancia}</b></span></div>}{item.notasOperativas&&<div className="manifest-email-brief notes"><FileText/><span><small>INSTRUCCIONES OPERATIVAS</small><b>{item.notasOperativas}</b></span></div>}{item.referenciaCliente&&<div className="manifest-reference">Referencia: <b>{item.referenciaCliente}</b></div>}{(item.mercancias||[]).map(piece=><p key={piece.id}><b>{piece.cantidad} {piece.tipo}{piece.cantidad===1?'':'S'} · {piece.peso||'PESO PENDIENTE'}</b><span>{piece.seguimiento?`Tracking: ${piece.seguimiento}`:'Sin seguimiento'}</span></p>)}{Boolean(photos.length||receptionDocuments.length)&&<div className="manifest-arrival-files"><Camera/><span><b>{photos.length} fotos · {receptionDocuments.length} documentos de llegada</b><small>Disponibles en el expediente</small></span></div>}<div className="manifest-next-step"><ClipboardCheck/><span><small>SIGUIENTE PASO</small><b>{nextStep?.title||'Operativa completada'}</b></span></div><footer><span>Aduanas: {documentation.alcance==='global'?(documentation.aduaneroDisponible?`${documentation.tipoAduanero} DISPONIBLE`:'PENDIENTE'):'DOCUMENTOS INDIVIDUALES'}</span><span>POD: {documentation.podDisponible?'DISPONIBLE':'PENDIENTE'}</span></footer></div>;
}

function CalendarEventModal({item,team,cases,transports,providers,close,submit,openCase}){
  const initialTransport=transports.find(entry=>entry.id===item.transporte);
  const initialRoute=routeParts(initialTransport||{origen:item.origen,destino:item.destino,ruta:item.titulo});
  const [form,setForm]=useState({...item,...initialRoute,tipoServicio:item.tipoServicio||(item.transporte?'Transporte':'Recepción')});
  const update=event=>{
    if(event.target.name==='tipoServicio'){const type=event.target.value;const related=cases.find(entry=>entry.id===form.expediente);setForm({...form,tipoServicio:type,transporte:type==='Recepción'?'':form.transporte,origen:type==='Transporte'?(form.origen||SWIFTPORT_WAREHOUSE):form.origen,destino:type==='Transporte'?(form.destino||`BUQUE ${related?.buque||''} · ${related?.puerto||''}`):form.destino});return}
    if(event.target.name==='expediente'){const related=cases.find(entry=>entry.id===event.target.value);setForm({...form,expediente:event.target.value,destino:form.tipoServicio==='Transporte'&&(!form.destino||form.destino==='BUQUE')?`BUQUE ${related?.buque||''} · ${related?.puerto||''}`:form.destino});return}
    if(event.target.name==='transporte'){const linked=transports.find(entry=>entry.id===event.target.value);const route=routeParts(linked);setForm({...form,...route,tipoServicio:event.target.value?'Transporte':form.tipoServicio,transporte:event.target.value,expediente:linked?.expediente||form.expediente,titulo:linked?transportRoute(linked):form.titulo,asignado:linked?.conductor||form.asignado,proveedorId:linked?.proveedorId||form.proveedorId||'',fecha:linked?.fecha||form.fecha,inicio:linked?.inicio||form.inicio,fin:linked?.fin||form.fin});return}
    setForm({...form,[event.target.name]:event.target.value});
  };
  const validTeam=team.filter(member=>hasRole(member,'operations')||hasRole(member,'driver'));
  const relatedCase=cases.find(entry=>entry.id===form.expediente);
  const save=event=>{event.preventDefault();const route=form.tipoServicio==='Transporte'?`${form.origen.trim()} → ${form.destino.trim()}`:form.titulo;submit({...form,titulo:route})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal calendar-event-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Planificación</span><h2>{item.titulo?'Editar transporte':'Nuevo transporte'}</h2><p>Solo se agenda el transporte al buque/gabarra. Si falta hora ETB, puedes dejar la hora vacía.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Tipo de servicio</span><select name="tipoServicio" value={form.tipoServicio} onChange={update}><option>Transporte</option></select></label><label className="field"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update} required><option value="">Seleccionar expediente</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{caseLabel(entry)}</option>)}</select></label><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Conductor</span><select name="asignado" value={form.asignado} onChange={update} autoFocus><option>Sin asignar</option>{validTeam.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Hora de inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update}/></label><label className="field"><span>Hora de fin</span><input name="fin" type="time" value={form.fin} onChange={update}/></label>{form.tipoServicio==='Transporte'?<><label className="field wide"><span>Lugar de recogida</span><input name="origen" value={form.origen} onChange={update} placeholder="ALMACÉN SWIFTPORT" required/></label><label className="field wide"><span>Lugar de entrega</span><input name="destino" value={form.destino} onChange={update} placeholder="BUQUE / EMPRESA / ALMACÉN…" required/></label><div className="route-preview wide"><MapPin/><span><small>RECORRIDO DEL CONDUCTOR</small><b>{form.origen||'ORIGEN'} → {form.destino||'DESTINO'}</b></span></div><label className="field"><span>Empresa de transporte</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Transporte relacionado</span><select name="transporte" value={form.transporte} onChange={update}><option value="">Crear transporte nuevo</option>{transports.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {transportRoute(entry)}</option>)}</select></label></>:<label className="field wide"><span>Lugar / notas</span><input name="titulo" value={form.titulo} onChange={update} placeholder="Almacén, terminal, proveedor…"/></label>}<CargoManifest item={relatedCase}/>{form.expediente&&<button type="button" className="button tertiary wide calendar-case-link" onClick={()=>{close();openCase(form.expediente)}}>Abrir expediente relacionado <ExternalLink/></button>}<div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar transporte</button></div></form></section></div>;
}

function NewCaseModal({clientOptions=[],vessels=[],team=[],close,submit}){
  const warehouse=SWIFTPORT_WAREHOUSE;
  const [form,setForm]=useState({buque:'',imo:'',mmsi:'',cliente:clientOptions[0]||'UME Shipping',puerto:'Barcelona',eta:'',prioridad:'Media',bultos:'1',createReception:false,receptionDate:'',receptionStart:'09:00',receptionEnd:'10:00',receptionLocation:warehouse,createTransport:false,transportDate:'',transportStart:'09:00',transportEnd:'10:00',transportPickup:warehouse,transportDelivery:'BUQUE POR CONFIRMAR · Barcelona',transportConductor:'Sin asignar'});
  const update=event=>{
    const {name,value,type,checked}=event.target;
    if(name==='eta'){
      const date=value.slice(0,10);
      const time=value.slice(11,16)||'09:00';
      setForm(current=>({...current,eta:value,receptionDate:current.receptionDate||date,transportDate:current.transportDate||date,transportStart:current.transportStart==='09:00'?time:current.transportStart,transportEnd:current.transportStart==='09:00'?plusHourClient(time):current.transportEnd}));
      return;
    }
    if(name==='buque'){setForm(current=>{const known=findKnownVessel(vessels,value);return {...current,buque:value,imo:known?.imo||current.imo,mmsi:known?.mmsi||current.mmsi,transportDelivery:`BUQUE ${value.toUpperCase()} · ${current.puerto}`}});return}
    if(name==='puerto'){setForm(current=>({...current,puerto:value,transportDelivery:`BUQUE ${current.buque.toUpperCase()||'POR CONFIRMAR'} · ${value}`}));return}
    setForm(current=>({...current,[name]:type==='checkbox'?checked:value}));
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal new-case-modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-head"><div><span className="overline">Nuevo registro</span><h2 id="new-case-title">Crear expediente y trabajos</h2><p>El expediente quedará creado y el transporte irá al calendario. La recepción queda en almacén/expediente.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}>{vessels.length>0&&<label className="field wide vessel-picker-field"><span>Elegir buque guardado</span><select name="buque" value={findKnownVessel(vessels,form.buque)?.name||''} onChange={update}><option value="">Escribir buque nuevo o buscar abajo</option>{vessels.map(vessel=><option key={vessel.id||vessel.name} value={vessel.name}>{vessel.name} {[vessel.imo&&`· IMO ${vessel.imo}`,vessel.mmsi&&`· MMSI ${vessel.mmsi}`].filter(Boolean).join(' ')}</option>)}</select></label>}<label className="field wide"><span>Buque *</span><input name="buque" list="known-vessels-new" value={form.buque} onChange={update} placeholder="Ej. Baltic Horizon" required autoFocus/><datalist id="known-vessels-new">{vessels.map(vessel=><option key={vessel.id||vessel.name} value={vessel.name}>{[vessel.imo&&`IMO ${vessel.imo}`,vessel.mmsi&&`MMSI ${vessel.mmsi}`].filter(Boolean).join(' · ')}</option>)}</datalist></label><label className="field"><span>IMO</span><input name="imo" inputMode="numeric" maxLength="7" value={form.imo} onChange={update} placeholder="Se rellena si existe"/></label><label className="field"><span>MMSI</span><input name="mmsi" inputMode="numeric" maxLength="9" value={form.mmsi} onChange={update} placeholder="Seguimiento AIS"/></label><div className="vessel-memory-hint wide"><Ship/><span><b>Buques recordados</b><small>Si el buque ya existe, Swiftport recupera IMO/MMSI. Si los añades ahora, quedarán guardados para la próxima escala.</small></span></div><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{(clientOptions.length?clientOptions:clientNames).map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><select name="puerto" value={form.puerto} onChange={update}>{['Barcelona','Algeciras','Tarragona','Valencia','Bilbao'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>ETA del buque</span><input name="eta" type="datetime-local" value={form.eta} onChange={update}/></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>N.º de bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><fieldset className="case-service-fieldset wide"><label className="service-check"><input name="createReception" type="checkbox" checked={form.createReception} onChange={update}/><WarehouseIcon/><span><b>REGISTRAR RECEPCIÓN</b><small>La mercancía quedará asociada al buque/expediente</small></span></label>{form.createReception&&<div className="case-service-fields"><label className="field"><span>Fecha *</span><input name="receptionDate" type="date" value={form.receptionDate} onChange={update} required/></label><label className="field"><span>Inicio *</span><input name="receptionStart" type="time" value={form.receptionStart} onChange={update} required/></label><label className="field"><span>Fin *</span><input name="receptionEnd" type="time" value={form.receptionEnd} onChange={update} required/></label><label className="field wide"><span>Lugar de recepción / recogida</span><input name="receptionLocation" value={form.receptionLocation} onChange={update} required/></label></div>}</fieldset><fieldset className="case-service-fieldset wide"><label className="service-check"><input name="createTransport" type="checkbox" checked={form.createTransport} onChange={update}/><Truck/><span><b>CREAR TRANSPORTE EN CALENDARIO</b><small>Ruta, horario y responsable de la tarea</small></span></label>{form.createTransport&&<div className="case-service-fields"><label className="field"><span>Fecha *</span><input name="transportDate" type="date" value={form.transportDate} onChange={update} required/></label><label className="field"><span>Inicio *</span><input name="transportStart" type="time" value={form.transportStart} onChange={update} required/></label><label className="field"><span>Fin *</span><input name="transportEnd" type="time" value={form.transportEnd} onChange={update} required/></label><label className="field"><span>Conductor / responsable</span><select name="transportConductor" value={form.transportConductor} onChange={update}><option>Sin asignar</option>{team.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Recogida</span><input name="transportPickup" value={form.transportPickup} onChange={update} required/></label><label className="field"><span>Entrega</span><input name="transportDelivery" value={form.transportDelivery} onChange={update} required/></label></div>}</fieldset><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Crear expediente y calendario</button></div></form></section></div>;
}

function WarehouseEntryModal({cases,close,submit,csrfToken}){
  const [form,setForm]=useState({expediente:'',identificacion:'',fechaRecepcion:localDateTimeValue(),zona:'A-01',mercancias:[{tipo:'CAJA',cantidad:'1',peso:'',seguimiento:''}]});
  const [photos,setPhotos]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const update=e=>setForm({...form,[e.target.name]:e.target.value});
  const updateLine=(index,field,value)=>setForm({...form,mercancias:form.mercancias.map((line,lineIndex)=>lineIndex===index?{...line,[field]:value}:line)});
  const updatePhoto=(index,change)=>setPhotos(photos.map((photo,photoIndex)=>photoIndex===index?{...photo,...change}:photo));
  const selectPhotos=event=>{
    const selected=[...event.target.files];
    setPhotos(current=>[...current,...selected.map((file,index)=>({id:`PHOTO-${Date.now()}-${index}`,file,preview:URL.createObjectURL(file),tipo:current.length+index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercanciaIndex:'0',nota:''}))]);
    event.target.value='';
  };
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
      const invalidLine=form.mercancias.find(line=>!line.tipo||Number(line.cantidad)<1||Number(line.peso)<=0);
      if(invalidLine)throw new Error('Cada grupo debe tener tipo, cantidad y peso.');
      const uploadedPhotos=await Promise.all(photos.map(async photo=>{
        const uploaded=await uploadAttachment(photo.file,'photo',csrfToken);
        const line=form.mercancias[Number(photo.mercanciaIndex)];
        const merchandise=!line?'MERCANCÍA SIN IDENTIFICAR':`${line.cantidad} ${line.tipo}${Number(line.cantidad)===1?'':'S'} · ${Number(line.peso).toLocaleString('es-ES',{maximumFractionDigits:2})} KG${line.seguimiento?` · ${line.seguimiento.toUpperCase()}`:''}`;
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
        <label className="field wide"><span>Expediente (opcional)</span><select name="expediente" value={form.expediente} onChange={update}><option value="">SIN EXPEDIENTE · VINCULAR DESPUÉS</option>{cases.map(item=><option value={item.id} key={item.id}>{caseLabel(item)}</option>)}</select></label>
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
        <div className="arrival-files wide">
          <label className="file-picker"><Camera/><span><b>Añadir fotos de la mercancía *</b><small>Puedes tomar varias fotos; las nuevas se suman a las anteriores</small></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple required={!photos.length} onChange={selectPhotos}/></label>
          <label className="file-picker"><FileText/><span><b>Escanear documentos</b><small>Packing list, CMR, delivery note o albarán</small></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" multiple onChange={event=>setDocuments([...event.target.files])}/></label>
          {Boolean(photos.length)&&<div className="photo-identification"><div className="photo-identification-title"><b>Identificación fotográfica</b><small>{photos.length} foto(s). Asocia cada evidencia con su mercancía.</small></div>{photos.map((photo,index)=><article key={photo.id||`${photo.file.name}-${photo.file.lastModified}`}><img src={photo.preview} alt={`Vista previa ${index+1}`}/><div><span className="photo-number">FOTO {String(index+1).padStart(2,'0')}<button type="button" onClick={()=>removePhoto(index)}>Quitar</button></span><label className="field"><span>Qué muestra</span><select value={photo.tipo} onChange={event=>updatePhoto(index,{tipo:event.target.value})}>{PHOTO_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><label className="field"><span>Mercancía asociada *</span><select value={photo.mercanciaIndex} onChange={event=>updatePhoto(index,{mercanciaIndex:event.target.value})} required>{form.mercancias.map((line,lineIndex)=><option key={lineIndex} value={lineIndex}>{line.cantidad} {line.tipo}{Number(line.cantidad)===1?'':'S'} · {line.peso||'—'} KG{line.seguimiento?` · ${line.seguimiento.toUpperCase()}`:''}</option>)}</select></label><label className="field photo-note"><span>Observación (opcional)</span><input value={photo.nota} onChange={event=>updatePhoto(index,{nota:event.target.value})} placeholder="Ej. esquina golpeada, precinto intacto…"/></label></div></article>)}</div>}
          {Boolean(documents.length)&&<div className="selected-files documents-selected">{documents.map(file=><span key={`doc-${file.name}`}><FileText/>{file.name}</span>)}</div>}
        </div>
        {error&&<div className="form-error wide"><CircleAlert/>{error}</div>}
        <div className="modal-actions wide"><button type="button" className="button tertiary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" disabled={busy}><UploadCloud/> {busy?'Subiendo archivos…':'Registrar entrada'}</button></div>
      </form>
    </section>
  </div>;
}

function WarehouseEditModal({item,cases,close,submit,deleteItem}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const related=cases.find(entry=>entry.id===form.expediente);submit({...form,buque:related?.buque||form.buque,bultos:Number(form.bultos)||0,dias:Number(form.dias)||0})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.ref}</span><h2>{item.expediente?'Editar entrada de almacén':'Vincular mercancía recibida'}</h2><p>{item.expediente?'Los cambios se reflejarán en el stock.':'Selecciona el expediente cuando sepas a qué buque pertenece.'}</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Expediente</span><select name="expediente" value={form.expediente||''} onChange={update}><option value="">SIN EXPEDIENTE</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.buque}</option>)}</select></label>{!form.expediente&&<label className="field wide"><span>Buque / referencia</span><input name="buque" value={form.buque||''} onChange={update} required/></label>}<label className="field"><span>Ubicación</span><input name="zona" value={form.zona} onChange={update} required/></label><label className="field"><span>Fecha de entrada</span><input name="entrada" value={form.entrada} onChange={update} required/></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Días de storage</span><input name="dias" type="number" min="0" value={form.dias} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['En stock','Retenido','Preparado','Expedido'].map(value=><option key={value}>{value}</option>)}</select></label>{Boolean((item.fotos||[]).length)&&<div className="warehouse-photo-gallery wide"><b>Fotos recibidas</b><div>{(item.fotos||[]).map((photo,index)=><a key={photo.id||photo.url||index} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.mercancia||`Foto ${index+1}`}/><span>{photo.mercancia||photo.tipo||`Foto ${index+1}`}</span></a>)}</div></div>}{Boolean((item.documentosRecepcion||[]).length)&&<div className="warehouse-doc-list wide"><b>Documentos de llegada</b>{(item.documentosRecepcion||[]).map((file,index)=><a key={file.id||file.url||index} href={file.url} target="_blank" rel="noreferrer"><FileText/>{file.name||`Documento ${index+1}`}</a>)}</div>}<div className="modal-actions wide"><button type="button" className="button danger" onClick={()=>deleteItem(item)}><Trash2/> Eliminar entrada</button><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> {form.expediente?'Guardar y vincular':'Guardar entrada'}</button></div></form></section></div>;
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
createRoot(document.getElementById('root')).render(<AuthRoot/>);
