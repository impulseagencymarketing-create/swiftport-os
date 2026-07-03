import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Anchor, LayoutDashboard, FolderKanban, Warehouse as WarehouseIcon, Truck, FileCheck2,
  UsersRound, ReceiptText, Menu, X, Plus, Search, Bell, ChevronRight, Ship,
  PackageCheck, CircleAlert, WalletCards, CalendarDays, MapPin, Clock3, CheckCircle2,
  Circle, Camera, Box, Scale, Layers3, Navigation, UserRound, FileText, UploadCloud,
  Download, Filter, CircleDollarSign, ExternalLink, Mail, PencilLine, ClipboardCheck,
  BadgeEuro, Sparkles, ArrowLeft, Save, LogOut, ShieldCheck, LockKeyhole, UserPlus, Eye,
  RefreshCw, Timer, Undo2
} from 'lucide-react';
import {
  expedientesIniciales, movimientosAlmacen, transportesIniciales, proveedoresIniciales, tramitesAduana, eventosCalendarioIniciales,
  clientNames
} from './data';
import './styles.css';

const NAV = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['calendario','Calendario',CalendarDays],
  ['expedientes','Expedientes',FolderKanban],
  ['almacen','Almacén',WarehouseIcon],
  ['transportes','Transportes',Truck],
  ['aduanas','Aduanas',FileCheck2],
  ['correos','Correos',Mail],
  ['clientes','Clientes / Tarifas',UsersRound],
  ['facturacion','Facturación',ReceiptText],
  ['usuarios','Usuarios',ShieldCheck]
];
const TITLES = {
  dashboard:['Dashboard','Vista general de la operativa'],
  calendario:['Calendario','Planificación semanal del equipo'],
  expedientes:['Expedientes','Seguimiento completo por buque'],
  almacen:['Almacén','Entradas, ubicación y días de storage'],
  transportes:['Transportes','Planificación y asignación de conductores'],
  aduanas:['Aduanas','Documentación y control de despachos'],
  correos:['Correos automáticos','Servicios recibidos por info@ y operations@'],
  clientes:['Clientes y tarifas','Condiciones comerciales por cliente'],
  facturacion:['Facturación','Servicios listos para revisar y exportar'],
  usuarios:['Usuarios y permisos','Control de acceso al equipo']
};
const ROLE_LABELS={driver:'Transportista',operations:'Operaciones',finance:'Finanzas',admin:'Administración'};
const canAccess=(role,id)=>{
  if(role==='driver')return id==='calendario';
  if (['clientes','facturacion'].includes(id)) return ['finance','admin'].includes(role);
  if (id==='correos') return ['operations','admin'].includes(role);
  if (id==='usuarios') return role==='admin';
  return true;
};
const statusTone = value => {
  if (['Completado','Liberado','Entregado','Lista','Enviada','Preparado','Expedido'].includes(value)) return 'success';
  if (['Bloqueado','Urgente','Retenido','Sin asignar','Revisar','Pendiente'].includes(value)) return 'danger';
  if (['En curso','En ruta','Asignado','En stock','Borrador'].includes(value)) return 'info';
  return 'warning';
};
const money = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
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
const portCallSchedule=item=>{
  const call=item.portCall||{};
  return {
    eta:portCallMoment(call.etaDate||(!/confirmar/i.test(item.eta||'')?item.eta:''),call.etaTime||''),
    etb:portCallMoment(call.etbDate||'',call.etbTime||''),
    etd:portCallMoment(call.etdDate||'',call.etdTime||'')
  };
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
const OPERATION_STEPS=[
  {key:'review',title:'Expediente revisado',next:'Comprobar los datos del servicio y la mercancía'},
  {key:'cargo',title:'Mercancía recibida o recogida',next:'Recibir en almacén o recoger en el punto indicado'},
  {key:'documents',title:'Documentación revisada',next:'Revisar documentación antes de la entrega'},
  {key:'delivery',title:'Entrega confirmada con POD',next:'Entregar la mercancía y registrar el POD firmado'}
];
const operationFlow=item=>{
  if(item.operationalFlow){const stored=item.operationalFlow;const delivery=Boolean(stored.delivery||stored.pod);return {review:false,cargo:false,documents:false,delivery:false,billingReady:false,...stored,delivery,billingReady:Boolean(stored.billingReady||delivery),review:stored.review??Boolean(stored.cargo||stored.documents||stored.delivered||stored.pod||stored.delivery)}};
  const progress=Number(item.progreso)||0;
  const completed=item.estado==='Completado'||progress>=100;
  return {review:progress>=25,cargo:progress>=50,documents:progress>=75,delivery:completed,billingReady:completed};
};
const operationProgress=item=>{
  const flow=operationFlow(item);
  return OPERATION_STEPS.filter(step=>flow[step.key]).length*25;
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

async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(body.error||'No se pudo completar la operación.'),{status:response.status,body});
  return body;
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
    if(!session||!['finance','admin'].includes(session.user.role)){setFinance({caseAmounts:{},warehouseStorageTotal:0,clients:[],invoices:[]});return}
    api('/api/finance.php').then(setFinance).catch(reason=>setError(reason.message));
  },[session?.user?.id,session?.user?.role]);
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
  const effectiveRole=previewUser?.role||user.role;
  const visibleUser=previewUser||user;
  const showFinance=['finance','admin'].includes(effectiveRole);
  const availableNav=NAV.filter(([id])=>canAccess(effectiveRole,id));
  const [tab,setTab]=useState(user.role==='driver'?'calendario':'dashboard');
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
  const [team,setTeam]=useState([]);
  const [clientOptions,setClientOptions]=useState(clientNames);
  const [operationalLoaded,setOperationalLoaded]=useState(false);
  const [toast,setToast]=useState('');
  const scheduleAlertsKey=`swiftport-driver-alerts-${user.id}`;
  const [scheduleAlerts,setScheduleAlerts]=useState(()=>{if(user.role!=='driver')return[];try{const stored=JSON.parse(localStorage.getItem(scheduleAlertsKey)||'[]');return Array.isArray(stored)?stored:[]}catch{return[]}});
  const scheduleSnapshotRef=useRef(null);
  const casesWithFinance=useMemo(()=>cases.map(item=>({...item,importe:finance.caseAmounts[item.id]||0})),[cases,finance.caseAmounts]);
  const selected=casesWithFinance.find(item=>item.id===selectedId)||casesWithFinance[0];
  const notify=message=>{setToast(message);window.clearTimeout(window.__swiftportToast);window.__swiftportToast=window.setTimeout(()=>setToast(''),2600)};
  const navigate=id=>{setTab(canAccess(effectiveRole,id)?id:(availableNav[0]?.[0]||'dashboard'));setMenuOpen(false);setSearch('')};
  const loadTeam=()=>api('/api/users/directory.php').then(result=>setTeam(result.users)).catch(reason=>notify(reason.message));
  const loadOperational=()=>api('/api/operational.php').then(result=>{
    if(result.data){
      if(user.role==='driver'){
        const storageKey=`swiftport-driver-schedule-${user.id}`;
        let stored=scheduleSnapshotRef.current;
        if(!stored){try{stored=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{stored=null}}
        const current=driverScheduleSnapshot(result.data,user.fullName);
        const changes=changedDriverSchedules(stored,current);
        if(changes.length)setScheduleAlerts(existing=>{const next=[...changes,...existing].slice(0,20);try{localStorage.setItem(scheduleAlertsKey,JSON.stringify(next))}catch{}return next});
        scheduleSnapshotRef.current=current;
        try{localStorage.setItem(storageKey,JSON.stringify(current))}catch{}
      }
      setCases(result.data.cases.map(normalizeMerchandise));setTransports(result.data.transports);setWarehouseEntries(result.data.warehouseEntries);if(result.data.customs)setCustoms(result.data.customs);if(result.data.calendarEvents)setCalendarEvents(result.data.calendarEvents);if(Array.isArray(result.data.providers))setProviders(result.data.providers)
    }
    setOperationalLoaded(true)
  }).catch(reason=>{setOperationalLoaded(true);notify(reason.message)});
  useEffect(()=>{loadTeam();api('/api/clients/directory.php').then(result=>setClientOptions(result.clients.map(item=>item.name))).catch(()=>{});loadOperational();const timer=window.setInterval(loadOperational,45000);window.addEventListener('focus',loadOperational);return()=>{window.clearInterval(timer);window.removeEventListener('focus',loadOperational)}},[]);
  const saveOperational=(nextCases=cases,nextTransports=transports,nextWarehouse=warehouseEntries,nextCustoms=customs,nextCalendar=calendarEvents,nextProviders=providers)=>api('/api/operational.php',{method:'PUT',headers:{'X-CSRF-Token':auth.csrfToken},body:JSON.stringify({data:{cases:nextCases,transports:nextTransports,warehouseEntries:nextWarehouse,customs:nextCustoms,calendarEvents:nextCalendar,providers:nextProviders}})}).catch(reason=>notify(reason.message));
  const operationalTeam=useMemo(()=>team.filter(member=>['operations','driver'].includes(member.role)),[team]);
  useEffect(()=>{if(effectiveRole==='driver'&&tab!=='calendario')setTab('calendario')},[effectiveRole,tab]);
  useEffect(()=>{
    if(!operationalLoaded||!team.length)return;
    const names=new Set(operationalTeam.map(member=>member.fullName));
    const normalizedCalendar=calendarEvents.map(event=>{const asignado=event.asignado!=='Sin asignar'&&!names.has(event.asignado)?'Sin asignar':event.asignado;return {...event,asignado,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:driverTone(asignado,operationalTeam)}});
    const normalized=transports.map(item=>{const linked=normalizedCalendar.find(event=>event.transporte===item.id);const conductor=item.conductor!=='Sin asignar'&&!names.has(item.conductor)?'Sin asignar':linked?.asignado||item.conductor;return linked?{...item,conductor,fecha:linked.fecha,inicio:linked.inicio,fin:linked.fin,hora:formatSchedule(linked.fecha,linked.inicio,linked.fin),estado:conductor==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:{...item,conductor,estado:conductor==='Sin asignar'?'Sin asignar':item.estado}});
    const changed=normalized.some((item,index)=>JSON.stringify(item)!==JSON.stringify(transports[index]))||normalizedCalendar.some((item,index)=>item.color!==calendarEvents[index]?.color);
    if(changed){setTransports(normalized);setCalendarEvents(normalizedCalendar);saveOperational(cases,normalized,warehouseEntries,customs,normalizedCalendar)}
  },[operationalLoaded,team.length]);
  const openCase=id=>{setSelectedId(id);navigate('expedientes')};
  const createCase=form=>{
    const nextNumber=49+cases.length-expedientesIniciales.length;
    const item=normalizeMerchandise({id:'SW-2026-'+String(nextNumber).padStart(4,'0'),buque:form.buque.toUpperCase(),cliente:form.cliente,puerto:form.puerto,eta:form.eta||'Por confirmar',estado:'Nuevo',prioridad:form.prioridad,conductor:'Sin asignar',servicios:['Recepción','Transporte'],bultos:Number(form.bultos)||0,peso:'Por registrar',progreso:8,siguiente:'Completar datos del expediente',aduana:'Por revisar'});
    const next=[item,...cases];setCases(next);saveOperational(next,transports,warehouseEntries);setSelectedId(item.id);setNewOpen(false);setTab('expedientes');notify('Expediente '+item.id+' creado');
  };
  const updateTransport=updated=>{const normalized={...updated,hora:formatSchedule(updated.fecha,updated.inicio,updated.fin)};const nextTransports=transports.map(item=>item.id===updated.id?normalized:item);const nextCases=cases.map(item=>item.id===updated.expediente?{...item,conductor:updated.conductor}:item);const linkedEvent=calendarEvents.find(item=>item.transporte===updated.id);const synchronized={titulo:updated.ruta,tipoServicio:'Transporte',fecha:updated.fecha,inicio:updated.inicio,fin:updated.fin,asignado:updated.conductor,proveedorId:updated.proveedorId||'',expediente:updated.expediente,transporte:updated.id,color:driverTone(updated.conductor,operationalTeam)};const nextCalendar=linkedEvent?calendarEvents.map(item=>item.transporte===updated.id?{...item,...synchronized}:item):[...calendarEvents,{id:'EV-'+Date.now(),...synchronized}];setTransports(nextTransports);setCases(nextCases);setCalendarEvents(nextCalendar);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify('Transporte, expediente y calendario actualizados')};
  const updateCase=updated=>{const {importe,...rawCase}=updated;const operationalCase=normalizeMerchandise(rawCase);const next=cases.map(item=>item.id===operationalCase.id?operationalCase:item);setCases(next);saveOperational(next,transports,warehouseEntries);notify('Expediente actualizado')};
  const updateClient=updated=>{const next={...finance,clients:finance.clients.map(item=>item.codigo===updated.codigo?updated:item)};onFinanceChange(next).then(()=>notify('Cliente y tarifas actualizados')).catch(reason=>notify(reason.message))};
  const updateInvoice=updated=>{const next={...finance,invoices:finance.invoices.map(item=>item.id===updated.id?updated:item)};onFinanceChange(next).then(()=>notify('Documento actualizado')).catch(reason=>notify(reason.message))};
  const updateWarehouseEntry=updated=>{const next=warehouseEntries.map(item=>item.ref===updated.ref?updated:item);setWarehouseEntries(next);saveOperational(cases,transports,next);notify('Entrada de almacén actualizada')};
  const updateCustom=updated=>{const next=customs.map(item=>item.id===updated.id?updated:item);setCustoms(next);saveOperational(cases,transports,warehouseEntries,next);notify('Trámite aduanero actualizado')};
  const saveCalendarEvent=event=>{const colored={...event,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:driverTone(event.asignado,operationalTeam)};const exists=calendarEvents.some(item=>item.id===event.id);const nextCalendar=exists?calendarEvents.map(item=>item.id===event.id?colored:item):[...calendarEvents,colored];const nextTransports=transports.map(item=>item.id===event.transporte?{...item,expediente:event.expediente||item.expediente,conductor:event.asignado,proveedorId:event.proveedorId||item.proveedorId||'',fecha:event.fecha,inicio:event.inicio,fin:event.fin,hora:formatSchedule(event.fecha,event.inicio,event.fin),estado:event.asignado==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:item);const nextCases=cases.map(item=>item.id===event.expediente?{...item,conductor:event.asignado}:item);setCalendarEvents(nextCalendar);setTransports(nextTransports);setCases(nextCases);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify(exists?'Tarea, transporte y expediente actualizados':'Tarea añadida al calendario')};
  const saveProvider=provider=>{const exists=providers.some(item=>item.id===provider.id);const next=exists?providers.map(item=>item.id===provider.id?provider:item):[...providers,{...provider,id:'PRV-'+String(providers.length+1).padStart(3,'0')}];setProviders(next);saveOperational(cases,transports,warehouseEntries,customs,calendarEvents,next);notify(exists?'Proveedor actualizado':'Proveedor añadido')};
  const completeCaseStep=(id,stepKey,note='',evidence=null)=>{
    const target=cases.find(item=>item.id===id);
    if(!target)return;
    const expected=nextOperationStep(target);
    if(!expected||expected.key!==stepKey){notify('Completa primero el paso anterior');return}
    const evidenceFiles=Array.isArray(evidence)?evidence.filter(Boolean):evidence?[evidence]:[];
    if(['cargo','delivery'].includes(stepKey)&&!evidenceFiles.length){notify(stepKey==='cargo'?'Añade al menos una foto de la mercancía':'Escanea o adjunta el POD firmado');return}
    const flow={...operationFlow(target),[stepKey]:true};
    const ready=stepKey==='delivery';
    if(ready)flow.billingReady=true;
    const nextStep=OPERATION_STEPS.find(step=>!flow[step.key]);
    const now=new Date();
    const timelineEntry={id:`FLOW-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:expected.title,detalle:note||'Paso confirmado sin incidencias',actor:visibleUser.fullName,archivo:ready?evidenceFiles[0]||null:null,archivos:stepKey==='cargo'?evidenceFiles:[],estado:'done'};
    const linkedTransport=transports.find(item=>item.expediente===id);
    const cargoReception=stepKey==='cargo'?{ref:`REC-${Date.now()}`,fecha:now.toISOString(),zona:linkedTransport?.ruta||'RECOGIDA / RECEPCIÓN',peso:target.peso,mercancias:target.mercancias||[],fotos:evidenceFiles.map((file,index)=>({...file,tipo:index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercancia:`${target.bultos||0} BULTOS · ${target.peso||'PESO PENDIENTE'}`,nota:`Registrado por ${visibleUser.fullName}`})),documentos:[]}:null;
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,operationalFlow:flow,progreso:ready?100:OPERATION_STEPS.filter(step=>flow[step.key]).length*25,siguiente:ready?'Listo para facturar':nextStep?.next||'',estado:ready?'Completado':'En curso',recepciones:cargoReception?[cargoReception,...(item.recepciones||[])]:item.recepciones,documentacionMercancia:ready?{...item.documentacionMercancia,podDisponible:true,podArchivo:evidenceFiles[0]||item.documentacionMercancia?.podArchivo||null}:item.documentacionMercancia,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=ready?transports.map(item=>item.expediente===id?{...item,estado:'Entregado'}:item):transports;
    const nextWarehouse=ready?warehouseEntries.map(item=>item.expediente===id?{...item,estado:'Expedido',archivado:true,salida:new Date().toISOString()}:item):warehouseEntries;
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
    const progress=OPERATION_STEPS.filter(step=>flow[step.key]).length*25;
    const now=new Date();
    const timelineEntry={id:`UNDO-${id}-${stepKey}-${Date.now()}`,fecha:now.toLocaleDateString('es-ES'),hora:now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),titulo:`Paso reabierto: ${reopened.title}`,detalle:'El conductor deshizo la confirmación para corregir o repetir este paso',actor:visibleUser.fullName,estado:'done'};
    const nextCases=cases.map(item=>item.id===id?normalizeMerchandise({...item,operationalFlow:flow,progreso:progress,siguiente:reopened.next,estado:'En curso',recepciones:stepKey==='cargo'?(item.recepciones||[]).filter((reception,index)=>index>0||!String(reception.ref||'').startsWith('REC-')):item.recepciones,documentacionMercancia:stepKey==='delivery'?{...item.documentacionMercancia,podDisponible:false,podArchivo:null}:item.documentacionMercancia,timelineCustom:[timelineEntry,...(item.timelineCustom||[])]}):item);
    const nextTransports=stepKey==='delivery'?transports.map(item=>item.expediente===id?{...item,estado:item.conductor&&item.conductor!=='Sin asignar'?'Asignado':'Sin asignar'}:item):transports;
    const nextWarehouse=stepKey==='delivery'?warehouseEntries.map(item=>item.expediente===id?{...item,estado:'En stock',archivado:false,salida:null}:item):warehouseEntries;
    setCases(nextCases);setTransports(nextTransports);setWarehouseEntries(nextWarehouse);
    saveOperational(nextCases,nextTransports,nextWarehouse);
    notify(`${reopened.title} reabierto`);
  };
  const registerWarehouseEntry=form=>{
    const relatedCase=cases.find(item=>item.id===form.expediente);
    const nextReference=319+warehouseEntries.length-movimientosAlmacen.length;
    const reference='ALM-'+nextReference;
    const merchandise=form.mercancias.map((line,index)=>({
      id:`${form.expediente}-${reference}-M${index+1}`,
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
      expediente:form.expediente,
      buque:relatedCase?.buque||'Sin buque',
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
    notify('Entrada '+item.ref+' registrada en '+item.zona);
  };
  const [title,subtitle]=TITLES[tab];
  const startPreview=member=>{setPreviewUser(member);setTab('dashboard');notify('Vista previa activada')};
  const assignedAlerts=['operations','driver'].includes(effectiveRole)
    ? calendarEvents.filter(event=>event.asignado===visibleUser.fullName&&cases.find(item=>item.id===event.expediente)?.estado!=='Completado')
    : calendarEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar');
  const notificationCount=assignedAlerts.length+(effectiveRole==='driver'?scheduleAlerts.length:0);
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
          {effectiveRole!=='driver'&&<button className="button primary" aria-label="Nuevo expediente" onClick={()=>setNewOpen(true)}><Plus/> <span>Nuevo expediente</span></button>}
          <div className="avatar" title={visibleUser.fullName+' · '+ROLE_LABELS[effectiveRole]}>{initials(visibleUser.fullName)}</div>
        </div>
      </header>
      <div className="content">
        {previewUser&&<div className="preview-banner"><Eye/><span>Estás viendo la aplicación como <b>{previewUser.fullName}</b> ({ROLE_LABELS[previewUser.role]}). Tu cuenta sigue siendo administrador.</span><button onClick={()=>setPreviewUser(null)}>Salir de la vista previa</button></div>}
        {effectiveRole==='driver'&&scheduleAlert&&<section className="schedule-change-alert" role="alert"><Clock3/><div><small>HORARIO ACTUALIZADO · {scheduleAlert.service}</small><b>{scheduleAlert.title}</b>{scheduleAlert.oldEta!==scheduleAlert.newEta&&<p>ETA: <s>{scheduleAlert.oldEta}</s> → <strong>{scheduleAlert.newEta}</strong></p>}{scheduleAlert.oldTask!==scheduleAlert.newTask&&<p>Servicio: <s>{scheduleAlert.oldTask}</s> → <strong>{scheduleAlert.newTask}</strong></p>}</div><button className="button secondary" onClick={()=>setScheduleAlerts(alerts=>{const next=alerts.slice(1);try{localStorage.setItem(scheduleAlertsKey,JSON.stringify(next))}catch{}return next})}>Entendido</button></section>}
        {tab==='dashboard'&&<Dashboard cases={casesWithFinance} warehouseEntries={warehouseEntries} calendarEvents={calendarEvents} openCase={openCase} navigate={navigate} showFinance={showFinance} user={visibleUser}/>}
        {tab==='calendario'&&<>{effectiveRole!=='driver'&&<DriverLegend team={operationalTeam}/>}<Calendario events={calendarEvents} team={operationalTeam} cases={cases} transports={transports} providers={providers} warehouseEntries={warehouseEntries} saveEvent={saveCalendarEvent} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} openCase={openCase} currentUser={visibleUser} csrfToken={auth.csrfToken}/></>}
        {tab==='expedientes'&&<Expedientes cases={casesWithFinance} selected={selected} select={setSelectedId} search={search} setSearch={setSearch} completeCaseStep={completeCaseStep} notify={notify} showFinance={showFinance} updateCase={updateCase} clientOptions={clientOptions} warehouseEntries={warehouseEntries} transports={transports} csrfToken={auth.csrfToken}/>}
        {tab==='almacen'&&<Almacen items={warehouseEntries} cases={casesWithFinance} openCase={openCase} registerEntry={registerWarehouseEntry} updateEntry={updateWarehouseEntry} showFinance={showFinance} storageTotal={finance.warehouseStorageTotal} csrfToken={auth.csrfToken}/>}
        {tab==='transportes'&&<Transportes items={transports} update={updateTransport} openCase={openCase} team={operationalTeam} providers={providers} saveProvider={saveProvider}/>}
        {tab==='aduanas'&&<Aduanas items={customs} update={updateCustom} openCase={openCase} notify={notify}/>}
        {tab==='correos'&&<Correos csrfToken={auth.csrfToken} notify={notify} openCase={openCase} reloadOperational={loadOperational} canRebuild={effectiveRole==='admin'}/>}
        {tab==='clientes'&&showFinance&&<Clientes notify={notify} clients={finance.clients} updateClient={updateClient}/>}
        {tab==='facturacion'&&showFinance&&<Facturacion openCase={openCase} notify={notify} invoices={finance.invoices} cases={casesWithFinance} updateInvoice={updateInvoice}/>}
        {tab==='usuarios'&&user.role==='admin'&&!previewUser&&<Usuarios csrfToken={auth.csrfToken} notify={notify} onPreview={startPreview} onUsersChanged={loadTeam}/>}
      </div>
    </main>
    <MobileNav tab={tab} navigate={navigate} more={()=>setMenuOpen(true)} nav={availableNav}/>
    {newOpen&&<NewCaseModal clientOptions={clientOptions} close={()=>setNewOpen(false)} submit={createCase}/>}
    {toast&&<div className="toast" role="status"><CheckCircle2/>{toast}</div>}
  </div>;
}

const initials=name=>name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toUpperCase();
function Sidebar({tab,open,navigate,close,nav,user,onLogout}){
  return <aside className={'sidebar '+(open?'open':'')}>
    <div className="brand"><span className="brand-mark"><Anchor/></span><div><b>SWIFTPORT</b><small>OPERATING SYSTEM</small></div><button className="icon-button sidebar-close" aria-label="Cerrar menú" onClick={close}><X/></button></div>
    <nav aria-label="Navegación principal">{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span>{tab===id&&<ChevronRight className="nav-arrow"/>}</button>)}</nav>
    <div className="sidebar-card"><div className="live-dot"/> <div><b>Operativa conectada</b><small>Datos de demostración</small></div></div>
    <div className="profile"><div className="avatar light">{initials(user.fullName)}</div><div><b>{user.fullName}</b><small>{ROLE_LABELS[user.role]}</small></div><button className="profile-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onLogout}><LogOut/></button></div>
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

const isoDate=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const startOfWeek=date=>{const value=new Date(date);value.setHours(12,0,0,0);return addDays(value,-((value.getDay()+6)%7))};
const DRIVER_TONES=['blue','teal','orange','purple','red','pink','green'];
function driverTone(name,team){if(!name||name==='Sin asignar')return 'gray';const index=team.findIndex(member=>member.fullName===name);return index<0?'gray':DRIVER_TONES[index%DRIVER_TONES.length]}
function formatSchedule(date,start,end){if(!date||!start)return 'Por programar';const label=new Date(date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.','');return label+' · '+start+(end?'–'+end:'')}
function DriverLegend({team}){return <div className="driver-legend"><span><i className="gray"/>Sin asignar</span>{team.map(member=><span key={member.id}><i className={driverTone(member.fullName,team)}/>{member.fullName}</span>)}</div>}
function CalendarEventContent({event,cases}){const related=cases.find(item=>item.id===event.expediente);const schedule=related?portCallSchedule(related):null;return <><time>{event.inicio}{event.fin?`–${event.fin}`:''}</time><b>{related?.buque||event.titulo||'Buque sin indicar'}</b><small className="calendar-service">{event.tipoServicio||(event.transporte?'Transporte':'Recepción')}</small>{event.scheduleStatus==='provisional'&&<small className="calendar-provisional">HORARIO PROVISIONAL</small>}<small>{event.asignado||'Sin asignar'}</small><small>{related?.puerto||'Puerto sin indicar'}</small>{schedule&&<small className="calendar-port-call">LLEGADA · ETA {schedule.eta}</small>}</>}
function Calendario({events,team,cases,transports,providers,warehouseEntries,saveEvent,completeCaseStep,undoCaseStep,openCase,currentUser,csrfToken}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const [editing,setEditing]=useState(null);
  const [mineOnly,setMineOnly]=useState(false);
  if(currentUser.role==='driver')return <DriverCalendarV2 events={events} cases={cases} transports={transports} warehouseEntries={warehouseEntries} currentUser={currentUser} saveEvent={saveEvent} completeCaseStep={completeCaseStep} undoCaseStep={undoCaseStep} csrfToken={csrfToken}/>;
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:16},(_,index)=>index+6);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const newEvent=()=>setEditing({id:'EV-'+Date.now(),titulo:'',tipoServicio:'Recepción',fecha:isoDate(days[0]),inicio:'09:00',fin:'10:00',asignado:'Sin asignar',expediente:'',transporte:'',color:'gray'});
  const visibleEvents=(mineOnly?events.filter(event=>event.asignado===currentUser.fullName):events).filter(event=>event.inicio);
  return <><section className="calendar-toolbar"><div className="calendar-nav"><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹</button><button className="button tertiary" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Hoy</button><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,7))}>›</button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div><div className="calendar-actions">{currentUser.role==='operations'&&<button className={'button '+(mineOnly?'secondary':'tertiary')} onClick={()=>setMineOnly(!mineOnly)}><UserRound/> Mis servicios</button>}<button className="button primary" onClick={newEvent}><Plus/> Nueva tarea</button></div></section><section className="calendar-shell panel"><div className="calendar-scroll"><div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div><div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div className="calendar-day" key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}
    {visibleEvents.filter(event=>event.fecha===isoDate(day)).map(event=>{const [startHour,startMinute]=event.inicio.split(':').map(Number);const [endHour,endMinute]=event.fin.split(':').map(Number);const top=((startHour*60+startMinute)-360)/60*64;const height=Math.max(108,((endHour*60+endMinute)-(startHour*60+startMinute))/60*64);return <article key={event.id} className={'calendar-event '+event.color} style={{top,height}}><button className="calendar-event-open" onClick={()=>setEditing(event)}><CalendarEventContent event={event} cases={cases}/></button><select aria-label={'Asignar conductor a '+(event.titulo||event.id)} value={event.asignado||'Sin asignar'} onChange={change=>saveEvent({...event,asignado:change.target.value})}><option>Sin asignar</option>{team.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></article>})}</div>)}</div></div></section>{editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} providers={providers} close={()=>setEditing(null)} submit={item=>{saveEvent(item);setEditing(null)}} openCase={openCase}/>}</>;
}

function DriverCalendar({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,csrfToken}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const sorted=[...events].sort((a,b)=>(a.fecha+a.inicio).localeCompare(b.fecha+b.inicio));
  const visible=sorted.filter(event=>scope==='mine'?event.asignado===currentUser.fullName:scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const pending=visible.filter(event=>cases.find(item=>item.id===event.expediente)?.estado!=='Completado').length;
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Puedes consultar todos los trabajos y asignarte cualquiera cuando sea necesario.</p></div><strong>{pending}<small>trabajos pendientes</small></strong></section><section className="panel driver-jobs"><SectionHeader title="Calendario de trabajos" subtitle="Servicios por fecha, hora y conductor"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{events.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{events.filter(event=>event.asignado===currentUser.fullName).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{events.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div>{visible.length?<div className="driver-job-list">{visible.map(event=>{const related=cases.find(item=>item.id===event.expediente);const completed=related?.estado==='Completado';const next=related&&nextOperationStep(related);const mine=event.asignado===currentUser.fullName;const schedule=related?portCallSchedule(related):null;return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>setSelected(event)}><time><b>{event.inicio}</b><small>{new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'})}</small></time><span className="driver-job-main"><b>{related?.buque||event.titulo}</b><small>{event.tipoServicio} · {related?.puerto||'Puerto pendiente'}</small>{schedule&&<small className="driver-port-call">LLEGADA DEL BUQUE · ETA {schedule.eta}</small>}<em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR'}</i></span><span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related||{})}%`}</small></span><ChevronRight/></button>})}</div>:<Empty text="No hay trabajos en este filtro."/>}</section>{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)}/>}</>;
}

function DriverJobList({events,cases,currentUser,select}){
  if(!events.length)return <Empty text="No hay trabajos en esta vista."/>;
  return <div className="driver-job-list">{events.map(event=>{
    const related=cases.find(item=>item.id===event.expediente);
    if(!related)return null;
    const completed=operationFlow(related).billingReady;
    const next=nextOperationStep(related);
    const mine=event.asignado===currentUser.fullName;
    const schedule=portCallSchedule(related);
    return <button key={event.id} className={(completed?'completed ':'')+(mine?'mine':'')} onClick={()=>select(event)}>
      <time><b>{event.inicio||'—'}</b><small>{event.fecha?new Date(event.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'}):'Sin fecha'}</small></time>
      <span className="driver-job-main"><b>{related.buque||event.titulo}</b><small>{event.tipoServicio} · {related.puerto||'Puerto pendiente'}</small><small className="driver-port-call">LLEGADA DEL BUQUE · ETA {schedule.eta}</small><em>{completed?'Trabajo terminado':next?.title||'Abrir trabajo'}</em><i>{mine?'TU TRABAJO':event.asignado&&event.asignado!=='Sin asignar'?`ASIGNADO A ${event.asignado.toUpperCase()}`:'SIN ASIGNAR'}</i></span>
      <span className={'driver-job-status '+(completed?'done':'')}><CheckCircle2/><small>{completed?'Completo':`${operationProgress(related)}%`}</small></span><ChevronRight/>
    </button>;
  })}</div>;
}

function DriverWeekView({events,cases,select}){
  const [weekStart,setWeekStart]=useState(startOfWeek(new Date()));
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:16},(_,index)=>index+6);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  return <><section className="calendar-toolbar driver-week-toolbar"><div className="calendar-nav"><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹</button><button className="button tertiary" onClick={()=>setWeekStart(startOfWeek(new Date()))}>Hoy</button><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,7))}>›</button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div></section><section className="calendar-shell panel driver-week"><div className="calendar-scroll"><div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)===isoDate(new Date())?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div><div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div className="calendar-day" key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}{events.filter(event=>event.fecha===isoDate(day)&&event.inicio).map(event=>{const related=cases.find(item=>item.id===event.expediente);const [startHour,startMinute]=event.inicio.split(':').map(Number);const [endHour,endMinute]=(event.fin||plusHourClient(event.inicio)).split(':').map(Number);const top=((startHour*60+startMinute)-360)/60*64;const height=Math.max(96,((endHour*60+endMinute)-(startHour*60+startMinute))/60*64);return <article key={event.id} className={'calendar-event driver-week-event '+event.color} style={{top,height}}><button className="calendar-event-open" onClick={()=>select(event)}><CalendarEventContent event={event} cases={cases}/>{related&&<small className="driver-week-progress">{operationProgress(related)}% completado</small>}</button></article>})}</div>)}</div></div></section></>;
}

const plusHourClient=time=>{const [hour,minute]=String(time||'09:00').split(':').map(Number);return `${String((hour+1)%24).padStart(2,'0')}:${String(minute||0).padStart(2,'0')}`};

function DriverCalendarV2({events,cases,transports,warehouseEntries,currentUser,saveEvent,completeCaseStep,undoCaseStep,csrfToken}){
  const [selected,setSelected]=useState(null);
  const [scope,setScope]=useState('all');
  const [view,setView]=useState('hub');
  const sorted=[...events].sort((a,b)=>(String(a.fecha)+String(a.inicio)).localeCompare(String(b.fecha)+String(b.inicio)));
  const isCompleted=event=>operationFlow(cases.find(item=>item.id===event.expediente)||{}).billingReady;
  const pendingEvents=sorted.filter(event=>cases.some(item=>item.id===event.expediente)&&!isCompleted(event));
  const completedSeen=new Set();
  const completedEvents=sorted.filter(isCompleted).reverse().filter(event=>{if(completedSeen.has(event.expediente))return false;completedSeen.add(event.expediente);return true});
  const visiblePending=pendingEvents.filter(event=>scope==='mine'?event.asignado===currentUser.fullName:scope==='unassigned'?(!event.asignado||event.asignado==='Sin asignar'):true);
  const claim=event=>{const updated={...event,asignado:currentUser.fullName};saveEvent(updated);setSelected(updated)};
  return <><section className="driver-day-hero"><div><span className="overline"><Truck/> Jornada operativa</span><h2>Hola, {currentUser.fullName.split(' ')[0]}</h2><p>Trabajos pendientes limpios, planificación semanal e histórico separado.</p></div><strong>{pendingEvents.length}<small>trabajos pendientes</small></strong></section><nav className="driver-view-tabs" aria-label="Vistas del conductor"><button className={view==='hub'?'active':''} onClick={()=>setView('hub')}><LayoutDashboard/> HUB <span>{pendingEvents.length}</span></button><button className={view==='week'?'active':''} onClick={()=>setView('week')}><CalendarDays/> Semana</button><button className={view==='history'?'active':''} onClick={()=>setView('history')}><CheckCircle2/> Historial <span>{completedEvents.length}</span></button></nav>{view==='hub'&&<section className="panel driver-jobs"><SectionHeader title="Trabajo pendiente" subtitle="Los completados desaparecen automáticamente de esta vista"/><div className="driver-scope-tabs"><button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>Todos <span>{pendingEvents.length}</span></button><button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mis trabajos <span>{pendingEvents.filter(event=>event.asignado===currentUser.fullName).length}</span></button><button className={scope==='unassigned'?'active':''} onClick={()=>setScope('unassigned')}>Sin asignar <span>{pendingEvents.filter(event=>!event.asignado||event.asignado==='Sin asignar').length}</span></button></div><DriverJobList events={visiblePending} cases={cases} currentUser={currentUser} select={setSelected}/></section>}{view==='week'&&<DriverWeekView events={pendingEvents} cases={cases} select={setSelected}/>} {view==='history'&&<section className="panel driver-jobs"><SectionHeader title="Historial completado" subtitle="Consulta separada de trabajos al 100 %"/><DriverJobList events={completedEvents} cases={cases} currentUser={currentUser} select={setSelected}/></section>}{selected&&<DriverTaskModal event={selected} item={cases.find(entry=>entry.id===selected.expediente)} transport={transports.find(entry=>entry.id===selected.transporte)} warehouseEntries={warehouseEntries} currentUser={currentUser} csrfToken={csrfToken} close={()=>setSelected(null)} claim={()=>claim(selected)} submit={(key,note,evidence)=>completeCaseStep(selected.expediente,key,note,evidence)} undo={key=>undoCaseStep(selected.expediente,key)}/>}</>;
}

function DriverTaskModal({event,item,transport,warehouseEntries,currentUser,csrfToken,close,claim,submit,undo}){
  const [note,setNote]=useState('');
  const [evidenceFiles,setEvidenceFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const step=item?nextOperationStep(item):null;
  useEffect(()=>{setNote('');setEvidenceFiles([]);setError('')},[step?.key]);
  if(!item)return null;
  const flow=operationFlow(item);
  const lastCompleted=[...OPERATION_STEPS].reverse().find(entry=>flow[entry.key]);
  const mine=event.asignado===currentUser.fullName;
  const inWarehouse=warehouseEntries.some(entry=>entry.expediente===item.id&&!entry.archivado&&entry.estado!=='Expedido');
  const instructions={
    review:'Lee el servicio completo y comprueba buque, fecha, puerto, ruta, mercancía y observaciones antes de empezar.',
    cargo:inWarehouse?'Comprueba cantidades, peso y estado de la mercancía antes de cargar.':'Recoge la mercancía en el lugar indicado y comprueba cantidades, peso y estado.',
    documents:'Comprueba que están listos los documentos necesarios antes de salir a entregar.',
    delivery:'Entrega toda la mercancía, confirma quién la recibe y fotografía o escanea el POD firmado. Al confirmar quedará lista para facturar.'
  };
  const uploadEvidence=async file=>{if(!file)return;setUploading(true);setError('');try{const uploaded=await uploadAttachment(file,file.type==='application/pdf'?'document':'photo',csrfToken);setEvidenceFiles(current=>step.key==='cargo'?[...current,uploaded]:[uploaded])}catch(reason){setError(reason.message)}finally{setUploading(false)}};
  const needsEvidence=['cargo','delivery'].includes(step?.key);
  const evidenceTitle=step?.key==='cargo'?'Fotografiar mercancía recibida':'Escanear POD firmado';
  return <div className="modal-backdrop driver-task-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)close()}}><section className="modal driver-task-modal"><div className="modal-head"><div><span className="overline">{event.inicio}–{event.fin} · {event.tipoServicio}</span><h2>{item.buque}</h2><p>{caseLabel(item)}</p></div><button className="icon-button" onClick={close}><X/></button></div><div className="driver-task-body"><div className="driver-route"><MapPin/><span><small>PUERTO / RUTA</small><b>{transport?.ruta||item.puerto}</b></span></div>{!mine&&<div className="driver-owner-alert"><UserRound/><span><b>{event.asignado&&event.asignado!=='Sin asignar'?`Asignado a ${event.asignado}`:'Trabajo sin conductor'}</b><small>Asígnatelo antes de registrar avances.</small></span><button className="button secondary" onClick={claim}>Asignarme</button></div>}<OperationChecklist item={item}/><CargoManifest item={item}/>{step?<><div className="driver-next-action"><span>{OPERATION_STEPS.findIndex(entry=>entry.key===step.key)+1}</span><div><small>AHORA TOCA</small><b>{step.title}</b><p>{instructions[step.key]}</p></div></div>{needsEvidence&&<div className="pod-scanner"><div><Camera/><span><b>{evidenceTitle}</b><small>{step.key==='cargo'?'Haz al menos una foto clara. Puedes añadir varias.':'La cámara se abrirá directamente en el móvil.'}</small></span></div><div className="pod-scanner-actions"><label className="button primary"><Camera/> {uploading?'Subiendo…':step.key==='cargo'?'Hacer foto':'Abrir cámara'}<input type="file" accept="image/*" capture="environment" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>{step.key==='delivery'&&<label className="button tertiary"><FileText/> Adjuntar PDF<input type="file" accept="application/pdf" disabled={uploading||!mine} onChange={change=>uploadEvidence(change.target.files?.[0])}/></label>}</div>{evidenceFiles.length>0&&<div className="evidence-file-list">{evidenceFiles.map((file,index)=><a className="pod-uploaded" href={file.url} target="_blank" rel="noreferrer" key={file.id}><CheckCircle2/><span><b>{step.key==='cargo'?`Foto ${index+1}`:'POD adjuntado'}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}{error&&<p className="form-error"><CircleAlert/>{error}</p>}</div>}<label className="field"><span>Observación del trabajo (opcional)</span><input value={note} disabled={!mine} onChange={change=>setNote(change.target.value)} placeholder="Persona que recibe, incidencia, referencia…"/></label><button className="button primary full driver-confirm" disabled={!mine||uploading||(needsEvidence&&!evidenceFiles.length)} onClick={()=>submit(step.key,note,step.key==='cargo'?evidenceFiles:evidenceFiles[0]||null)}><CheckCircle2/> {needsEvidence&&!evidenceFiles.length?(step.key==='cargo'?'Haz una foto para confirmar':'Escanea el POD para confirmar'):`Confirmar: ${step.title}`}</button></>:<div className="driver-finished"><CheckCircle2/><span><b>Trabajo terminado</b><small>POD recibido y expediente listo para facturación.</small></span></div>}{mine&&lastCompleted&&<button className="button tertiary full driver-undo-step" onClick={()=>undo(lastCompleted.key)}><Undo2/> Deshacer: {lastCompleted.title}</button>}<button className="button tertiary full" onClick={close}>{flow.billingReady?'Cerrar':'Volver al calendario'}</button></div></section></div>;
}

function Dashboard({cases,warehouseEntries,calendarEvents,openCase,navigate,showFinance,user}){
  const active=cases.filter(item=>item.estado!=='Completado').length;
  const billing=cases.filter(item=>item.estado==='Completado').reduce((sum,item)=>sum+item.importe,0);
  const stock=warehouseEntries.filter(item=>!item.archivado&&item.estado!=='Expedido').reduce((sum,item)=>sum+Number(item.bultos||0),0);
  const alerts=user.role==='operations'
    ? calendarEvents.filter(event=>event.asignado===user.fullName&&cases.find(item=>item.id===event.expediente)?.estado!=='Completado').length
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
        <ActionItem tone="warning" title="Transporte sin conductor" meta="TR-1044 · Tarragona · mañana 15:30" action={()=>navigate('transportes')}/>
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

function Expedientes({cases,selected,select,search,setSearch,completeCaseStep,notify,showFinance,updateCase,clientOptions,warehouseEntries,transports,csrfToken}){
  const [filter,setFilter]=useState('Todos');
  const [mobileDetail,setMobileDetail]=useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const [flowOpen,setFlowOpen]=useState(false);
  const filtered=cases.filter(item=>(filter==='Todos'||item.estado===filter)&&[item.buque,item.id,item.cliente,item.puerto].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className={'case-layout '+(mobileDetail?'mobile-detail-open':'')}>
    <section className={'panel case-list '+(selected?'has-selection':'')}><div className="list-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número, buque, ETA o puerto…"/></label><div className="filter-chips">{['Todos','En curso','Bloqueado','Planificado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></div><div className="case-count">{filtered.length} expedientes</div>{filtered.length?filtered.map(item=><button key={item.id} className={'case-card '+(selected.id===item.id?'selected':'')} onClick={()=>{select(item.id);setMobileDetail(true)}}><div className="case-card-top"><span className="ship-icon"><Ship/></span><span><b>{caseLabel(item)}</b><small>{item.cliente}</small></span><Badge>{item.estado}</Badge></div><div className="case-card-meta"><span><MapPin/>{item.puerto}</span><span><CalendarDays/>{item.eta}</span></div><div className="case-progress"><span><i style={{width:item.progreso+'%'}}/></span><small>{item.progreso}%</small></div><p><b>Siguiente:</b> {item.siguiente}</p></button>):<Empty text="Prueba con otro término o estado."/>}</section>
    <section className="panel case-detail"><button className="mobile-detail-back" onClick={()=>setMobileDetail(false)}><ArrowLeft/> Expedientes</button><div className="detail-hero"><div><div className="detail-id">{selected.id} <Badge>{selected.estado}</Badge></div><h2>{selected.buque}</h2><p>{selected.cliente} · {selected.puerto}</p></div><button className="icon-button" aria-label="Editar expediente" onClick={()=>setEditOpen(true)}><PencilLine/></button></div><div className={'detail-stats '+(!showFinance?'detail-stats-three':'')}><Stat label="ETA" value={selected.eta} icon={Clock3}/><Stat label="Mercancía" value={selected.bultos+' bultos · '+selected.peso} icon={Box}/><Stat label="Conductor" value={selected.conductor} icon={UserRound}/>{showFinance&&<Stat label="Importe previsto" value={money(selected.importe)} icon={BadgeEuro}/>}</div><PortCallPanel item={selected}/><OperationChecklist item={selected}/><div className="detail-columns"><div><h3>Línea temporal real</h3><ActualTimeline item={selected}/></div><aside className="detail-side"><div className={'next-action '+(operationFlow(selected).billingReady?'complete':'')}><span>{operationFlow(selected).billingReady?'Operativa completada':'Próxima acción'}</span><b>{selected.siguiente}</b><p>{operationFlow(selected).billingReady?'El POD está registrado y el expediente ha pasado a facturación.':'Sigue el paso indicado para que todo el equipo trabaje igual.'}</p><button className="button primary full" disabled={operationFlow(selected).billingReady} onClick={()=>setFlowOpen(true)}><ClipboardCheck/> {operationFlow(selected).billingReady?'Listo para facturar':'Registrar siguiente paso'}</button></div><div className="document-box"><h3>Documentos</h3><button onClick={()=>notify('Packing list abierto')}><FileText/><span><b>Packing list.pdf</b><small>1,2 MB · verificado</small></span><ExternalLink/></button>{selected.documentacionMercancia?.podArchivo?<a className="document-link" href={selected.documentacionMercancia.podArchivo.url} target="_blank" rel="noreferrer"><Camera/><span><b>POD firmado</b><small>{selected.documentacionMercancia.podArchivo.name}</small></span><ExternalLink/></a>:<button onClick={()=>notify('POD todavía pendiente')}><Camera/><span><b>POD / fotografías</b><small>Pendiente de entrega</small></span><ChevronRight/></button>}<button className="upload" onClick={()=>notify('Selector de archivos preparado')}><UploadCloud/> Añadir documento</button></div></aside></div></section>
    <section className="panel merchandise-case-panel"><MerchandisePanel item={selected} updateCase={updateCase}/></section>
    {editOpen&&<CaseEditModal item={selected} clientOptions={clientOptions} close={()=>setEditOpen(false)} submit={item=>{updateCase(item);setEditOpen(false)}}/>}
    {flowOpen&&<OperationStepModal item={selected} warehouseEntries={warehouseEntries} transports={transports} csrfToken={csrfToken} close={()=>setFlowOpen(false)} submit={(key,note,evidence)=>{completeCaseStep(selected.id,key,note,evidence);setFlowOpen(false)}}/>}
  </div>;
}
function Stat({label,value,icon:Icon}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}
function ActualTimeline({item}){
  const events=item.timelineCustom||[];
  if(!events.length)return <div className="timeline-empty"><Clock3/><b>Sin actividad registrada</b><small>La cronología aparecerá cuando el equipo confirme el primer paso.</small></div>;
  return <div className="timeline actual-timeline">{events.map((event,index)=><div className="timeline-event done" key={event.id||event.titulo+index}><span className="timeline-marker"><CheckCircle2/></span><time>{event.hora||'—'}<small>{event.fecha||''}</small></time><span><b>{event.titulo}</b><small>{event.detalle}</small>{event.actor&&<em>Registrado por {event.actor}</em>}{event.archivo&&<a href={event.archivo.url} target="_blank" rel="noreferrer"><FileText/> Ver {event.archivo.name}</a>}{(event.archivos||[]).map((file,fileIndex)=><a href={file.url} target="_blank" rel="noreferrer" key={file.id||fileIndex}><Camera/> Foto {fileIndex+1}: {file.name}</a>)}</span></div>)}</div>;
}
function OperationChecklist({item}){
  const flow=operationFlow(item);
  const current=nextOperationStep(item);
  return <section className="operation-checklist"><div><b>FLUJO OPERATIVO</b><small>Siempre en el mismo orden</small></div><ol>{OPERATION_STEPS.map((step,index)=><li key={step.key} className={flow[step.key]?'done':current?.key===step.key?'current':''}><span>{flow[step.key]?<CheckCircle2/>:index+1}</span><b>{step.title}</b></li>)}<li className={flow.billingReady?'done':''}><span>{flow.billingReady?<CheckCircle2/>:OPERATION_STEPS.length+1}</span><b>Listo para facturar</b></li></ol></section>;
}

function OperationStepModal({item,warehouseEntries,transports,csrfToken,close,submit}){
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
  const uploadEvidence=async file=>{if(!file)return;setUploading(true);setError('');try{const uploaded=await uploadAttachment(file,file.type==='application/pdf'?'document':'photo',csrfToken);setEvidenceFiles(current=>step.key==='cargo'?[...current,uploaded]:[uploaded])}catch(reason){setError(reason.message)}finally{setUploading(false)}};
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
  return <><SectionHeader title="Mercancía y documentación" subtitle={`${total} unidades · POD ${documentation.podDisponible?'DISPONIBLE':'PENDIENTE'}`}/><div className="global-documents"><label className="field"><span>Documento aduanero</span><select value={documentation.alcance} onChange={event=>updateDocumentation({alcance:event.target.value})}><option value="individual">INDIVIDUAL POR MERCANCÍA</option><option value="global">UNO PARA TODO EL EXPEDIENTE</option></select></label>{documentation.alcance==='global'&&<><label className="field"><span>Tipo</span><select value={documentation.tipoAduanero} onChange={event=>updateDocumentation({tipoAduanero:event.target.value})}><option value="">SIN ASIGNAR</option><option>T1</option><option>LEVANTE ADUANERO</option></select></label><label className={'document-switch '+(documentation.aduaneroDisponible?'checked':'')}><input type="checkbox" checked={documentation.aduaneroDisponible} onChange={event=>updateDocumentation({aduaneroDisponible:event.target.checked})}/><FileCheck2/><span><b>DOCUMENTO ADUANERO</b><small>{documentation.aduaneroDisponible?'DISPONIBLE':'PENDIENTE'}</small></span></label></>}<label className={'document-switch pod locked '+(documentation.podDisponible?'checked':'')}><input type="checkbox" checked={documentation.podDisponible} disabled readOnly/><ClipboardCheck/><span><b>POD CONJUNTO</b><small>{documentation.podDisponible?'RECIBIDO · LISTO PARA FACTURAR':'SE REGISTRA EN EL FLUJO OPERATIVO'}</small></span></label></div><div className="merchandise-list">{merchandise.map((piece,index)=><details className="merchandise-item" key={piece.id}><summary><span className="box-icon"><Box/></span><span><b>{piece.cantidad} {piece.tipo}{piece.cantidad===1?'':'S'} · {piece.peso||'PESO PENDIENTE'}</b><small>{piece.seguimiento?`TRACKING: ${piece.seguimiento}`:'SIN N.º DE SEGUIMIENTO'}</small></span><span className="document-count">{documentation.alcance==='global'?'DOC GLOBAL':`${(piece.documentos||[]).length}/2 DOCS`}</span><ChevronRight/></summary><div className="merchandise-editor"><label className="field"><span>Tipo</span><select value={piece.tipo} onChange={event=>updatePiece(piece.id,{tipo:event.target.value})}><option>CAJA</option><option>PALLET</option><option>SOBRE</option></select></label><label className="field"><span>Cantidad</span><input type="number" min="1" value={piece.cantidad} onChange={event=>updatePiece(piece.id,{cantidad:Number(event.target.value)||1})}/></label><label className="field"><span>Peso del grupo (kg)</span><input type="number" min="0.1" step="0.1" value={String(piece.peso||'').replace(/[^\d,.]/g,'').replace(',','.')} onChange={event=>updatePiece(piece.id,{peso:event.target.value?`${event.target.value} KG`:''})}/></label><label className="field"><span>N.º seguimiento (opcional)</span><input value={piece.seguimiento||''} onChange={event=>updatePiece(piece.id,{seguimiento:event.target.value.toUpperCase()})}/></label>{documentation.alcance==='individual'&&<div className="piece-documents"><span>Documento aduanero individual</span>{DOC_TYPES.map(document=><label key={document} className={(piece.documentos||[]).includes(document)?'checked':''}><input type="checkbox" checked={(piece.documentos||[]).includes(document)} onChange={()=>toggleDocument(piece,document)}/><FileCheck2/><b>{document}</b><small>{(piece.documentos||[]).includes(document)?'DISPONIBLE':'PENDIENTE'}</small></label>)}</div>}</div></details>)}</div><ReceptionRecords records={item.recepciones||[]}/></>;
}

function ReceptionRecords({records}){
  if(!records.length)return <div className="reception-empty"><Camera/><span><b>Sin recepciones documentadas</b><small>Las fotos y documentos aparecerán aquí al registrar la entrada.</small></span></div>;
  return <section className="reception-records"><div className="reception-title"><Camera/><div><h3>Recepciones de mercancía</h3><p>Evidencias fotográficas identificadas y documentos de llegada.</p></div></div>{records.map(record=><article className="reception-record" key={record.ref}><header><div><b>{formatReceptionDate(record.fecha)}</b><small>{record.ref} · ZONA {record.zona}</small></div><Badge>{(record.fotos||[]).length} FOTOS · {(record.documentos||[]).length} DOCS</Badge></header>{Boolean((record.fotos||[]).length)&&<div className="reception-photos">{record.fotos.map((file,index)=><figure key={file.id}><a href={file.url} target="_blank" rel="noreferrer" title={file.name}><img src={file.url} alt={`${file.tipo||'Vista general'} · ${file.mercancia||'Recepción completa'}`}/><span>FOTO {String(index+1).padStart(2,'0')}</span></a><figcaption><b>{file.tipo||'VISTA GENERAL'}</b><strong>{file.mercancia||'RECEPCIÓN COMPLETA'}</strong>{file.nota&&<small>{file.nota}</small>}</figcaption></figure>)}</div>}{Boolean((record.documentos||[]).length)&&<div className="reception-documents">{record.documentos.map(file=><a href={file.url} target="_blank" rel="noreferrer" key={file.id}><FileText/><span><b>{documentLabel(file.name)}</b><small>{file.name}</small></span><ExternalLink/></a>)}</div>}</article>)}</section>;
}

function Almacen({items,cases,openCase,registerEntry,updateEntry,showFinance,storageTotal,csrfToken}){
  const [entryOpen,setEntryOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [view,setView]=useState('Activos');
  const visibleItems=items.filter(item=>view==='Archivados'?item.archivado||item.estado==='Expedido':!item.archivado&&item.estado!=='Expedido');
  const totalPackages=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+item.bultos,0);
  const totalWeight=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+(Number(String(item.peso).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0),0);
  const submit=form=>{registerEntry(form);setEntryOpen(false)};
  return <><section className={'summary-strip '+(!showFinance?'summary-strip-three':'')}><Summary icon={Box} label="Bultos en stock" value={String(totalPackages)}/><Summary icon={Scale} label="Peso total" value={totalWeight.toLocaleString('es-ES')+' kg'}/><Summary icon={Layers3} label="Ocupación" value={Math.min(95,Math.round(48+totalPackages*1.5))+'%'}/>{showFinance&&<Summary icon={CircleDollarSign} label="Storage acumulado" value={money(storageTotal)}/>}</section><section className="panel"><SectionHeader title="Mercancía y ubicaciones" subtitle="Las entregas completadas salen del stock y quedan archivadas" action={<button className="button secondary" onClick={()=>setEntryOpen(true)}><Plus/> Registrar entrada</button>}/><div className="warehouse-view-tabs"><button className={view==='Activos'?'active':''} onClick={()=>setView('Activos')}>En almacén <span>{items.filter(item=>!item.archivado&&item.estado!=='Expedido').length}</span></button><button className={view==='Archivados'?'active':''} onClick={()=>setView('Archivados')}>Archivados <span>{items.filter(item=>item.archivado||item.estado==='Expedido').length}</span></button></div><div className="responsive-table warehouse-table"><div className="table-head"><span>Referencia / expediente</span><span>Ubicación</span><span>Entrada</span><span>Mercancía</span><span>Storage</span><span>Estado</span></div>{visibleItems.map(item=><button className="table-row" key={item.ref} onClick={()=>setEditing(item)}><span className="primary-cell"><span className="box-icon"><Box/></span><span><b>{item.buque}</b><small>{item.ref} · {item.expediente}</small></span></span><span data-label="Ubicación"><b>{item.zona}</b></span><span data-label="Entrada">{item.entrada}</span><span data-label="Mercancía">{item.bultos} bultos<small>{item.peso}</small></span><span data-label="Storage">{item.dias} día{item.dias===1?'':'s'}</span><span data-label="Estado"><Badge>{item.estado}</Badge></span></button>)}</div></section>{entryOpen&&<WarehouseEntryModal cases={cases} csrfToken={csrfToken} close={()=>setEntryOpen(false)} submit={submit}/>} {editing&&<WarehouseEditModal item={editing} cases={cases} close={()=>setEditing(null)} submit={item=>{updateEntry(item);setEditing(null)}}/>}</>;
}
function Summary({icon:Icon,label,value}){return <article><span><Icon/></span><div><small>{label}</small><b>{value}</b></div></article>}

function Transportes({items,update,openCase,team,providers,saveProvider}){
  const [filter,setFilter]=useState('Todos');const [editing,setEditing]=useState(null);const [providerOpen,setProviderOpen]=useState(false);const visible=items.filter(item=>filter==='Todos'||item.estado===filter);
  return <><section className="provider-strip panel"><SectionHeader title="Proveedores de transporte" subtitle="Empresas disponibles para asignar servicios" action={<button className="button secondary" onClick={()=>setProviderOpen(true)}><Plus/> Añadir proveedor</button>}/><div>{providers.filter(item=>item.activo!==false).map(provider=><span key={provider.id}><Truck/><b>{provider.nombre}</b><small>{provider.contacto||'Sin contacto'}</small></span>)}</div></section><section className="module-toolbar"><div className="filter-chips">{['Todos','En ruta','Asignado','Sin asignar','Entregado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></section><section className="transport-grid">{visible.map(item=>{const provider=providers.find(entry=>entry.id===item.proveedorId);return <article className="transport-card" key={item.id}><div className="transport-head"><span className={'transport-icon '+statusTone(item.estado)}><Truck/></span><div><small>{item.id} · {item.expediente}</small><Badge>{item.estado}</Badge></div><button className="icon-button compact" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div><h3>{item.ruta}</h3><div className="transport-provider">{provider?.nombre||'Proveedor sin asignar'}</div><div className="transport-info"><span><Clock3/><small>Salida</small><b>{item.hora}</b></span><span><UserRound/><small>Conductor</small><b>{item.conductor}</b></span><span><Navigation/><small>Vehículo</small><b>{item.vehiculo}</b></span></div><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button primary" onClick={()=>setEditing(item)}>{item.estado==='Sin asignar'?'Asignar servicio':'Editar transporte'}</button></div></article>})}</section>{editing&&<TransportEditModal item={editing} team={team} providers={providers} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}{providerOpen&&<ProviderModal close={()=>setProviderOpen(false)} submit={item=>{saveProvider(item);setProviderOpen(false)}}/>}</>;
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
    try{const result=await api('/api/mail/inbox.php?status='+nextFilter);setItems(result.items);setCounts(result.counts);setLastRun(result.lastRun);const repaired=Number(result.reconciliation?.mergedCases||0)+Number(result.reconciliation?.correctedCases||0)+Number(result.reconciliation?.removedEmptyCases||0);if(repaired){await reloadOperational();notify(`${repaired} expedientes portuarios corregidos`)}}
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
      notify(`${summary.scanned} correos nuevos · ${summary.processed} trabajos creados · ${summary.review} para revisar${repaired?` · ${repaired} duplicados corregidos`:''}`);
      await Promise.all([load(filter),reloadOperational()]);
    }catch(reason){setError(reason.message)}
    finally{setProcessing(false)}
  };
  const rebuild=async()=>{
    setRebuilding(true);setError('');setRebuildProgress('Preparando reconstrucción…');
    try{
      const period={start:'2026-06-01',end:'2026-07-06'};
      const preview=await api('/api/admin/rebuild.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({action:'preview_period',...period})});
      if(!window.confirm(`Se borrarán ${preview.caseCount} expedientes, incluidos los completados, y toda su operativa. Se guardará una copia de seguridad y se reinterpretarán ${preview.mailCount} correos de junio. ¿Continuar?`)){setRebuildProgress('');return}
      const reset=await api('/api/admin/rebuild.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({action:'reset_period',...period})});
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
    client:base.client||'',vessel:base.vessel||'',eta:base.eta||'',eta_time:base.eta_time||'',etb:base.etb||'',etb_time:base.etb_time||'',etd:base.etd||'',etd_time:base.etd_time||'',port_stay:base.port_stay||'',delivery_mode:base.delivery_mode||'unknown',operation_location:base.operation_location||'',port:base.port||'',priority:base.priority||'Media',cargo_summary:base.cargo_summary||'',
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
  const [form,setForm]=useState({fullName:'',email:'',password:'',role:'operations'});const [busy,setBusy]=useState(false);
  const load=()=>{setLoading(true);api('/api/admin/users.php').then(result=>setUsers(result.users)).catch(reason=>setError(reason.message)).finally(()=>setLoading(false))};
  useEffect(load,[]);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const updateRole=async(item,role)=>{setError('');try{await api('/api/admin/users.php',{method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({id:item.id,role})});setUsers(users.map(user=>user.id===item.id?{...user,role}:user));notify(`${item.fullName} ahora es ${ROLE_LABELS[role]}`);onUsersChanged()}catch(reason){setError(reason.message)}};
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{await api('/api/admin/users.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify(form)});setForm({fullName:'',email:'',password:'',role:'operations'});notify('Usuario creado correctamente');load();onUsersChanged()}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <div className="users-layout"><section className="panel"><SectionHeader title="Equipo con acceso" subtitle="Cambia a Moisés a Transportista para activar su vista simplificada"/>{error&&<div className="form-error users-error"><CircleAlert/>{error}</div>}{loading?<div className="users-loading">Cargando usuarios…</div>:<div className="user-list">{users.map(item=><article key={item.id}><div className="avatar">{initials(item.fullName)}</div><div><b>{item.fullName}</b><small>{item.email}</small></div><label className="user-role-select"><span>Nivel</span><select value={item.role} onChange={event=>updateRole(item,event.target.value)}>{Object.entries(ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button tertiary preview-user" onClick={()=>onPreview(item)}><Eye/> Ver como</button></article>)}</div>}</section><section className="panel create-user"><SectionHeader title="Añadir usuario" subtitle="La contraseña debe tener al menos 4 caracteres"/><form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required/></label><label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña temporal</span><input name="password" type="password" minLength="4" value={form.password} onChange={update} required/></label><label className="field"><span>Nivel de acceso</span><select name="role" value={form.role} onChange={update}><option value="driver">Transportista · solo sus trabajos</option><option value="operations">Operaciones · sin importes</option><option value="finance">Finanzas · importes y tarifas</option><option value="admin">Administración · acceso total</option></select></label><button className="button primary full" disabled={busy}><UserPlus/>{busy?'Creando…':'Crear usuario'}</button></form></section></div>;
}

function CaseEditModal({item,close,submit}){
  const call=item.portCall||{};
  const legacyEta=String(item.eta||'').match(/^20\d{2}-\d{2}-\d{2}/)?.[0]||'';
  const [form,setForm]=useState({...item,servicios:item.servicios.join(', '),etaDate:call.etaDate||legacyEta,etaTime:call.etaTime||'',etbDate:call.etbDate||'',etbTime:call.etbTime||'',etdDate:call.etdDate||'',etdTime:call.etdTime||''});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();submit({...item,...form,eta:form.etaDate||'Por confirmar',portCall:{etaDate:form.etaDate,etaTime:form.etaTime,etbDate:form.etbDate,etbTime:form.etbTime,etdDate:form.etdDate,etdTime:form.etdTime,updatedAt:new Date().toISOString()},bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Buque</span><input name="buque" value={form.buque} onChange={update} required/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>ETA · fecha</span><input name="etaDate" type="date" value={form.etaDate} onChange={update}/></label><label className="field"><span>ETA · hora</span><input name="etaTime" type="time" value={form.etaTime} onChange={update}/></label><label className="field"><span>ETB · fecha</span><input name="etbDate" type="date" value={form.etbDate} onChange={update}/></label><label className="field"><span>ETB · hora</span><input name="etbTime" type="time" value={form.etbTime} onChange={update}/></label><label className="field"><span>ETD · fecha</span><input name="etdDate" type="date" value={form.etdDate} onChange={update}/></label><label className="field"><span>ETD · hora</span><input name="etdTime" type="time" value={form.etdTime} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','Planificado','En curso','Bloqueado','Completado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}

function TransportEditModal({item,team,providers,close,submit}){
  const [form,setForm]=useState({...item,fecha:item.fecha||new Date().toISOString().slice(0,10),inicio:item.inicio||'09:00',fin:item.fin||'10:00'});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const estado=form.conductor==='Sin asignar'?'Sin asignar':form.estado==='Sin asignar'?'Asignado':form.estado;submit({...form,estado})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar transporte</h2><p>Solo aparecen usuarios operativos y transportistas.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Ruta</span><input name="ruta" value={form.ruta} onChange={update} required/></label><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Hora inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update} required/></label><label className="field"><span>Hora fin</span><input name="fin" type="time" value={form.fin} onChange={update} required/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Sin asignar','Asignado','En ruta','Entregado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Conductor</span><select name="conductor" value={form.conductor} onChange={update}><option>Sin asignar</option>{team.filter(member=>['operations','driver'].includes(member.role)).map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Proveedor</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Vehículo / matrícula</span><input name="vehiculo" value={form.vehiculo} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar transporte</button></div></form></section></div>;
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
  const [form,setForm]=useState({...item,tipoServicio:item.tipoServicio||(item.transporte?'Transporte':'Recepción')});
  const update=event=>{
    if(event.target.name==='tipoServicio'){setForm({...form,tipoServicio:event.target.value,transporte:event.target.value==='Recepción'?'':form.transporte});return}
    if(event.target.name==='transporte'){const linked=transports.find(entry=>entry.id===event.target.value);setForm({...form,tipoServicio:event.target.value?'Transporte':form.tipoServicio,transporte:event.target.value,expediente:linked?.expediente||form.expediente,titulo:form.titulo||linked?.ruta||'',asignado:linked?.conductor||form.asignado,proveedorId:linked?.proveedorId||form.proveedorId||'',fecha:linked?.fecha||form.fecha,inicio:linked?.inicio||form.inicio,fin:linked?.fin||form.fin});return}
    setForm({...form,[event.target.name]:event.target.value});
  };
  const validTeam=team.filter(member=>['operations','driver'].includes(member.role));
  const relatedCase=cases.find(entry=>entry.id===form.expediente);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Planificación</span><h2>{item.titulo?'Editar tarea':'Nueva tarea'}</h2><p>Asigna el servicio desde el calendario de trabajo diario.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field"><span>Tipo de servicio</span><select name="tipoServicio" value={form.tipoServicio} onChange={update} autoFocus><option>Recepción</option><option>Transporte</option></select></label><label className="field"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update} required><option value="">Seleccionar expediente</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{caseLabel(entry)}</option>)}</select></label><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Conductor</span><select name="asignado" value={form.asignado} onChange={update}><option>Sin asignar</option>{validTeam.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Hora de inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update} required/></label><label className="field"><span>Hora de fin</span><input name="fin" type="time" value={form.fin} onChange={update} required/></label>{form.tipoServicio==='Transporte'&&<><label className="field"><span>Empresa de transporte</span><select name="proveedorId" value={form.proveedorId||''} onChange={update}><option value="">Sin proveedor</option>{providers.filter(provider=>provider.activo!==false).map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><label className="field"><span>Transporte relacionado</span><select name="transporte" value={form.transporte} onChange={update}><option value="">Sin transporte</option>{transports.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.ruta}</option>)}</select></label></>}<label className="field wide"><span>Notas del servicio</span><input name="titulo" value={form.titulo} onChange={update} placeholder="Información adicional"/></label><CargoManifest item={relatedCase}/>{form.expediente&&<button type="button" className="button tertiary wide calendar-case-link" onClick={()=>{close();openCase(form.expediente)}}>Abrir expediente relacionado <ExternalLink/></button>}<div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar tarea</button></div></form></section></div>;
}

function NewCaseModal({close,submit}){
  const [form,setForm]=useState({buque:'',cliente:'UME Shipping',puerto:'Barcelona',eta:'',prioridad:'Media',bultos:'1'});const update=e=>setForm({...form,[e.target.name]:e.target.value});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-head"><div><span className="overline">Nuevo registro</span><h2 id="new-case-title">Crear expediente</h2><p>Introduce los datos mínimos. Podrás completar el resto después.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();submit(form)}}><label className="field wide"><span>Buque *</span><input name="buque" value={form.buque} onChange={update} placeholder="Ej. Baltic Horizon" required autoFocus/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><select name="puerto" value={form.puerto} onChange={update}>{['Barcelona','Algeciras','Tarragona','Valencia','Bilbao'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>ETA</span><input name="eta" type="datetime-local" value={form.eta} onChange={update}/></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>N.º de bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Crear expediente</button></div></form></section></div>;
}

function WarehouseEntryModal({cases,close,submit,csrfToken}){
  const [form,setForm]=useState({expediente:cases[0]?.id||'',fechaRecepcion:localDateTimeValue(),zona:'A-01',mercancias:[{tipo:'CAJA',cantidad:'1',peso:'',seguimiento:''}]});
  const [photos,setPhotos]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const update=e=>setForm({...form,[e.target.name]:e.target.value});
  const updateLine=(index,field,value)=>setForm({...form,mercancias:form.mercancias.map((line,lineIndex)=>lineIndex===index?{...line,[field]:value}:line)});
  const updatePhoto=(index,change)=>setPhotos(photos.map((photo,photoIndex)=>photoIndex===index?{...photo,...change}:photo));
  const selectPhotos=event=>setPhotos([...event.target.files].map((file,index)=>({file,preview:URL.createObjectURL(file),tipo:index===0?'VISTA GENERAL':'ESTADO DE EMBALAJE',mercanciaIndex:'0',nota:''})));
  const addLine=()=>setForm({...form,mercancias:[...form.mercancias,{tipo:'CAJA',cantidad:'1',peso:'',seguimiento:''}]});
  const removeLine=index=>{
    setForm({...form,mercancias:form.mercancias.filter((_,lineIndex)=>lineIndex!==index)});
    setPhotos(photos.map(photo=>({...photo,mercanciaIndex:Number(photo.mercanciaIndex)===index?'0':String(Math.max(0,Number(photo.mercanciaIndex)-(Number(photo.mercanciaIndex)>index?1:0)))})));
  };
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      if(!photos.length)throw new Error('Añade al menos una foto de la mercancía.');
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
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)close()}}>
    <section className="modal warehouse-entry-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-entry-title">
      <div className="modal-head"><div><span className="overline">Almacén</span><h2 id="warehouse-entry-title">Registrar mercancía</h2><p>Indica cantidad y peso de cada grupo recibido.</p></div><button className="icon-button" aria-label="Cerrar" disabled={busy} onClick={close}><X/></button></div>
      <form onSubmit={save}>
        <label className="field wide"><span>Expediente</span><select name="expediente" value={form.expediente} onChange={update} required>{cases.map(item=><option value={item.id} key={item.id}>{caseLabel(item)}</option>)}</select></label>
        <label className="field"><span>Fecha y hora de llegada *</span><input name="fechaRecepcion" type="datetime-local" value={form.fechaRecepcion} onChange={update} required/></label>
        <label className="field"><span>Ubicación *</span><input name="zona" value={form.zona} onChange={update} placeholder="Ej. A-01" required/></label>
        <div className="cargo-lines wide">
          <div className="cargo-lines-title"><b>Mercancías</b><button type="button" className="button secondary" onClick={addLine}><Plus/> Añadir tipo</button></div>
          {form.mercancias.map((line,index)=><div className="cargo-line" key={index}>
            <label className="field"><span>Tipo *</span><select value={line.tipo} onChange={event=>updateLine(index,'tipo',event.target.value)} required><option>CAJA</option><option>PALLET</option><option>SOBRE</option></select></label>
            <label className="field"><span>Cantidad *</span><input type="number" min="1" step="1" value={line.cantidad} onChange={event=>updateLine(index,'cantidad',event.target.value)} required/></label>
            <label className="field"><span>Peso del grupo (kg) *</span><input type="number" min="0.1" step="0.1" value={line.peso} onChange={event=>updateLine(index,'peso',event.target.value)} placeholder="Ej. 42,5" required/></label>
            <label className="field tracking-field"><span>N.º seguimiento (opcional)</span><input value={line.seguimiento} onChange={event=>updateLine(index,'seguimiento',event.target.value)} placeholder="Tracking / AWB"/></label>
            {form.mercancias.length>1&&<button type="button" className="icon-button remove-cargo" onClick={()=>removeLine(index)}><X/></button>}
          </div>)}
        </div>
        <div className="arrival-files wide">
          <label className="file-picker"><Camera/><span><b>Fotos de la mercancía *</b><small>Después identifica qué muestra cada imagen</small></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple required onChange={selectPhotos}/></label>
          <label className="file-picker"><FileText/><span><b>Escanear documentos</b><small>Packing list, CMR, delivery note o albarán</small></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" multiple onChange={event=>setDocuments([...event.target.files])}/></label>
          {Boolean(photos.length)&&<div className="photo-identification"><div className="photo-identification-title"><b>Identificación fotográfica</b><small>Asocia obligatoriamente cada evidencia con su mercancía.</small></div>{photos.map((photo,index)=><article key={`${photo.file.name}-${photo.file.lastModified}`}><img src={photo.preview} alt={`Vista previa ${index+1}`}/><div><span className="photo-number">FOTO {String(index+1).padStart(2,'0')}</span><label className="field"><span>Qué muestra</span><select value={photo.tipo} onChange={event=>updatePhoto(index,{tipo:event.target.value})}>{PHOTO_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><label className="field"><span>Mercancía asociada *</span><select value={photo.mercanciaIndex} onChange={event=>updatePhoto(index,{mercanciaIndex:event.target.value})} required>{form.mercancias.map((line,lineIndex)=><option key={lineIndex} value={lineIndex}>{line.cantidad} {line.tipo}{Number(line.cantidad)===1?'':'S'} · {line.peso||'—'} KG{line.seguimiento?` · ${line.seguimiento.toUpperCase()}`:''}</option>)}</select></label><label className="field photo-note"><span>Observación (opcional)</span><input value={photo.nota} onChange={event=>updatePhoto(index,{nota:event.target.value})} placeholder="Ej. esquina golpeada, precinto intacto…"/></label></div></article>)}</div>}
          {Boolean(documents.length)&&<div className="selected-files documents-selected">{documents.map(file=><span key={`doc-${file.name}`}><FileText/>{file.name}</span>)}</div>}
        </div>
        {error&&<div className="form-error wide"><CircleAlert/>{error}</div>}
        <div className="modal-actions wide"><button type="button" className="button tertiary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" disabled={busy}><UploadCloud/> {busy?'Subiendo archivos…':'Registrar entrada'}</button></div>
      </form>
    </section>
  </div>;
}

function WarehouseEditModal({item,cases,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const related=cases.find(entry=>entry.id===form.expediente);submit({...form,buque:related?.buque||form.buque,bultos:Number(form.bultos)||0,dias:Number(form.dias)||0})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.ref}</span><h2>Editar entrada de almacén</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Expediente</span><select name="expediente" value={form.expediente} onChange={update}>{cases.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.buque}</option>)}</select></label><label className="field"><span>Ubicación</span><input name="zona" value={form.zona} onChange={update} required/></label><label className="field"><span>Fecha de entrada</span><input name="entrada" value={form.entrada} onChange={update} required/></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Días de storage</span><input name="dias" type="number" min="0" value={form.dias} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['En stock','Retenido','Preparado','Expedido'].map(value=><option key={value}>{value}</option>)}</select></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar entrada</button></div></form></section></div>;
}

createRoot(document.getElementById('root')).render(<AuthRoot/>);
