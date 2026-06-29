import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Anchor, LayoutDashboard, FolderKanban, Warehouse as WarehouseIcon, Truck, FileCheck2,
  UsersRound, ReceiptText, Menu, X, Plus, Search, Bell, ChevronRight, Ship,
  PackageCheck, CircleAlert, WalletCards, CalendarDays, MapPin, Clock3, CheckCircle2,
  Circle, Camera, Box, Scale, Layers3, Navigation, UserRound, FileText, UploadCloud,
  Download, Filter, CircleDollarSign, ExternalLink, Mail, PencilLine, ClipboardCheck,
  BadgeEuro, Sparkles, ArrowLeft, Save, LogOut, ShieldCheck, LockKeyhole, UserPlus, Eye
} from 'lucide-react';
import {
  expedientesIniciales, movimientosAlmacen, transportesIniciales, tramitesAduana, eventosCalendarioIniciales,
  clientNames, timeline
} from './data';
import './styles.css';

const NAV = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['calendario','Calendario',CalendarDays],
  ['expedientes','Expedientes',FolderKanban],
  ['almacen','Almacén',WarehouseIcon],
  ['transportes','Transportes',Truck],
  ['aduanas','Aduanas',FileCheck2],
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
  clientes:['Clientes y tarifas','Condiciones comerciales por cliente'],
  facturacion:['Facturación','Servicios listos para revisar y exportar'],
  usuarios:['Usuarios y permisos','Control de acceso al equipo']
};
const ROLE_LABELS={operations:'Operaciones',finance:'Finanzas',admin:'Administración'};
const canAccess=(role,id)=>{
  if (['clientes','facturacion'].includes(id)) return ['finance','admin'].includes(role);
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

async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(body.error||'No se pudo completar la operación.'),{status:response.status,body});
  return body;
}

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
  const [tab,setTab]=useState('dashboard');
  const [menuOpen,setMenuOpen]=useState(false);
  const [newOpen,setNewOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [cases,setCases]=useState(expedientesIniciales);
  const [selectedId,setSelectedId]=useState(expedientesIniciales[0].id);
  const [transports,setTransports]=useState(transportesIniciales);
  const [warehouseEntries,setWarehouseEntries]=useState(movimientosAlmacen);
  const [customs,setCustoms]=useState(tramitesAduana);
  const [calendarEvents,setCalendarEvents]=useState(eventosCalendarioIniciales);
  const [team,setTeam]=useState([]);
  const [clientOptions,setClientOptions]=useState(clientNames);
  const [operationalLoaded,setOperationalLoaded]=useState(false);
  const [toast,setToast]=useState('');
  const casesWithFinance=useMemo(()=>cases.map(item=>({...item,importe:finance.caseAmounts[item.id]||0})),[cases,finance.caseAmounts]);
  const selected=casesWithFinance.find(item=>item.id===selectedId)||casesWithFinance[0];
  const notify=message=>{setToast(message);window.clearTimeout(window.__swiftportToast);window.__swiftportToast=window.setTimeout(()=>setToast(''),2600)};
  const navigate=id=>{setTab(canAccess(effectiveRole,id)?id:'dashboard');setMenuOpen(false);setSearch('')};
  const loadTeam=()=>api('/api/users/directory.php').then(result=>setTeam(result.users)).catch(reason=>notify(reason.message));
  useEffect(()=>{loadTeam();api('/api/clients/directory.php').then(result=>setClientOptions(result.clients.map(item=>item.name))).catch(()=>{});api('/api/operational.php').then(result=>{if(result.data){setCases(result.data.cases);setTransports(result.data.transports);setWarehouseEntries(result.data.warehouseEntries);if(result.data.customs)setCustoms(result.data.customs);if(result.data.calendarEvents)setCalendarEvents(result.data.calendarEvents)}setOperationalLoaded(true)}).catch(reason=>{setOperationalLoaded(true);notify(reason.message)})},[]);
  const saveOperational=(nextCases=cases,nextTransports=transports,nextWarehouse=warehouseEntries,nextCustoms=customs,nextCalendar=calendarEvents)=>api('/api/operational.php',{method:'PUT',headers:{'X-CSRF-Token':auth.csrfToken},body:JSON.stringify({data:{cases:nextCases,transports:nextTransports,warehouseEntries:nextWarehouse,customs:nextCustoms,calendarEvents:nextCalendar}})}).catch(reason=>notify(reason.message));
  useEffect(()=>{
    if(!operationalLoaded||!team.length)return;
    const names=new Set(team.map(member=>member.fullName));
    const normalizedCalendar=calendarEvents.map(event=>({...event,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:driverTone(event.asignado,team)}));
    const normalized=transports.map(item=>{const linked=normalizedCalendar.find(event=>event.transporte===item.id);const conductor=item.conductor!=='Sin asignar'&&!names.has(item.conductor)?'Sin asignar':linked?.asignado||item.conductor;return linked?{...item,conductor,fecha:linked.fecha,inicio:linked.inicio,fin:linked.fin,hora:formatSchedule(linked.fecha,linked.inicio,linked.fin),estado:conductor==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:{...item,conductor,estado:conductor==='Sin asignar'?'Sin asignar':item.estado}});
    const changed=normalized.some((item,index)=>JSON.stringify(item)!==JSON.stringify(transports[index]))||normalizedCalendar.some((item,index)=>item.color!==calendarEvents[index]?.color);
    if(changed){setTransports(normalized);setCalendarEvents(normalizedCalendar);saveOperational(cases,normalized,warehouseEntries,customs,normalizedCalendar)}
  },[operationalLoaded,team.length]);
  const openCase=id=>{setSelectedId(id);navigate('expedientes')};
  const createCase=form=>{
    const nextNumber=49+cases.length-expedientesIniciales.length;
    const item={id:'SW-2026-'+String(nextNumber).padStart(4,'0'),buque:form.buque.toUpperCase(),cliente:form.cliente,puerto:form.puerto,eta:form.eta||'Por confirmar',estado:'Nuevo',prioridad:form.prioridad,conductor:'Sin asignar',servicios:['Recepción','Transporte'],bultos:Number(form.bultos)||0,peso:'Por registrar',progreso:8,siguiente:'Completar datos del expediente',aduana:'Por revisar'};
    const next=[item,...cases];setCases(next);saveOperational(next,transports,warehouseEntries);setSelectedId(item.id);setNewOpen(false);setTab('expedientes');notify('Expediente '+item.id+' creado');
  };
  const updateTransport=updated=>{const normalized={...updated,hora:formatSchedule(updated.fecha,updated.inicio,updated.fin)};const nextTransports=transports.map(item=>item.id===updated.id?normalized:item);const nextCases=cases.map(item=>item.id===updated.expediente?{...item,conductor:updated.conductor}:item);const linkedEvent=calendarEvents.find(item=>item.transporte===updated.id);const synchronized={titulo:updated.ruta,tipoServicio:'Transporte',fecha:updated.fecha,inicio:updated.inicio,fin:updated.fin,asignado:updated.conductor,expediente:updated.expediente,transporte:updated.id,color:driverTone(updated.conductor,team)};const nextCalendar=linkedEvent?calendarEvents.map(item=>item.transporte===updated.id?{...item,...synchronized}:item):[...calendarEvents,{id:'EV-'+Date.now(),...synchronized}];setTransports(nextTransports);setCases(nextCases);setCalendarEvents(nextCalendar);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify('Transporte, expediente y calendario actualizados')};
  const updateCase=updated=>{const {importe,...operationalCase}=updated;const next=cases.map(item=>item.id===operationalCase.id?operationalCase:item);setCases(next);saveOperational(next,transports,warehouseEntries);notify('Expediente actualizado')};
  const updateClient=updated=>{const next={...finance,clients:finance.clients.map(item=>item.codigo===updated.codigo?updated:item)};onFinanceChange(next).then(()=>notify('Cliente y tarifas actualizados')).catch(reason=>notify(reason.message))};
  const updateInvoice=updated=>{const next={...finance,invoices:finance.invoices.map(item=>item.id===updated.id?updated:item)};onFinanceChange(next).then(()=>notify('Documento actualizado')).catch(reason=>notify(reason.message))};
  const updateWarehouseEntry=updated=>{const next=warehouseEntries.map(item=>item.ref===updated.ref?updated:item);setWarehouseEntries(next);saveOperational(cases,transports,next);notify('Entrada de almacén actualizada')};
  const updateCustom=updated=>{const next=customs.map(item=>item.id===updated.id?updated:item);setCustoms(next);saveOperational(cases,transports,warehouseEntries,next);notify('Trámite aduanero actualizado')};
  const saveCalendarEvent=event=>{const colored={...event,tipoServicio:event.tipoServicio||(event.transporte?'Transporte':'Recepción'),color:driverTone(event.asignado,team)};const exists=calendarEvents.some(item=>item.id===event.id);const nextCalendar=exists?calendarEvents.map(item=>item.id===event.id?colored:item):[...calendarEvents,colored];const nextTransports=transports.map(item=>item.id===event.transporte?{...item,expediente:event.expediente||item.expediente,conductor:event.asignado,fecha:event.fecha,inicio:event.inicio,fin:event.fin,hora:formatSchedule(event.fecha,event.inicio,event.fin),estado:event.asignado==='Sin asignar'?'Sin asignar':item.estado==='Sin asignar'?'Asignado':item.estado}:item);const linked=nextTransports.find(item=>item.id===event.transporte);const nextCases=linked?cases.map(item=>item.id===linked.expediente?{...item,conductor:linked.conductor}:item):cases;setCalendarEvents(nextCalendar);setTransports(nextTransports);setCases(nextCases);saveOperational(nextCases,nextTransports,warehouseEntries,customs,nextCalendar);notify(exists?'Tarea, transporte y expediente actualizados':'Tarea añadida al calendario')};
  const advanceCase=id=>{const next=cases.map(item=>item.id===id?{...item,progreso:Math.min(100,item.progreso+12),siguiente:'Preparar salida de almacén',estado:'En curso'}:item);setCases(next);saveOperational(next,transports,warehouseEntries);notify('Operación registrada en la línea temporal')};
  const registerWarehouseEntry=form=>{
    const relatedCase=cases.find(item=>item.id===form.expediente);
    const nextReference=319+warehouseEntries.length-movimientosAlmacen.length;
    const item={
      ref:'ALM-'+nextReference,
      expediente:form.expediente,
      buque:relatedCase?.buque||'Sin buque',
      zona:form.zona.toUpperCase(),
      entrada:'29 Jun · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),
      bultos:Number(form.bultos),
      peso:Number(form.peso).toLocaleString('es-ES')+' kg',
      dias:0,
      estado:'En stock'
    };
    const next=[item,...warehouseEntries];setWarehouseEntries(next);saveOperational(cases,transports,next);
    notify('Entrada '+item.ref+' registrada en '+item.zona);
  };
  const [title,subtitle]=TITLES[tab];
  const startPreview=member=>{setPreviewUser(member);setTab('dashboard');notify('Vista previa activada')};
  return <div className="shell">
    <Sidebar tab={tab} open={menuOpen} navigate={navigate} close={()=>setMenuOpen(false)} nav={availableNav} user={visibleUser} onLogout={onLogout}/>
    {menuOpen&&<button className="scrim" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>} 
    <main className="main">
      <header className="topbar">
        <div className="topbar-title">
          <button className="icon-button menu-button" aria-label="Abrir menú" onClick={()=>setMenuOpen(true)}><Menu/></button>
          <div><div className="eyebrow">Operaciones · 29 junio 2026</div><h1>{title}</h1><p>{subtitle}</p></div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button notification" aria-label="Notificaciones" onClick={()=>notify('Tienes 3 avisos operativos')}><Bell/><i>3</i></button>
          <button className="button primary" aria-label="Nuevo expediente" onClick={()=>setNewOpen(true)}><Plus/> <span>Nuevo expediente</span></button>
          <div className="avatar" title={visibleUser.fullName+' · '+ROLE_LABELS[effectiveRole]}>{initials(visibleUser.fullName)}</div>
        </div>
      </header>
      <div className="content">
        {previewUser&&<div className="preview-banner"><Eye/><span>Estás viendo la aplicación como <b>{previewUser.fullName}</b> ({ROLE_LABELS[previewUser.role]}). Tu cuenta sigue siendo administrador.</span><button onClick={()=>setPreviewUser(null)}>Salir de la vista previa</button></div>}
        {tab==='dashboard'&&<Dashboard cases={casesWithFinance} openCase={openCase} navigate={navigate} showFinance={showFinance} user={visibleUser}/>}
        {tab==='calendario'&&<><DriverLegend team={team}/><Calendario events={calendarEvents} team={team} cases={cases} transports={transports} saveEvent={saveCalendarEvent} openCase={openCase}/></>}
        {tab==='expedientes'&&<Expedientes cases={casesWithFinance} selected={selected} select={setSelectedId} search={search} setSearch={setSearch} advanceCase={advanceCase} notify={notify} showFinance={showFinance} updateCase={updateCase} clientOptions={clientOptions}/>}
        {tab==='almacen'&&<Almacen items={warehouseEntries} cases={casesWithFinance} openCase={openCase} registerEntry={registerWarehouseEntry} updateEntry={updateWarehouseEntry} showFinance={showFinance} storageTotal={finance.warehouseStorageTotal}/>}
        {tab==='transportes'&&<Transportes items={transports} update={updateTransport} openCase={openCase} team={team}/>}
        {tab==='aduanas'&&<Aduanas items={customs} update={updateCustom} openCase={openCase} notify={notify}/>}
        {tab==='clientes'&&showFinance&&<Clientes notify={notify} clients={finance.clients} updateClient={updateClient}/>}
        {tab==='facturacion'&&showFinance&&<Facturacion openCase={openCase} notify={notify} invoices={finance.invoices} updateInvoice={updateInvoice}/>}
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
  return <nav className="mobile-nav" aria-label="Navegación móvil">{visible.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span></button>)}<button className={!visible.some(item=>item[0]===tab)?'active':''} onClick={more}><Menu/><span>Más</span></button></nav>;
}
function Badge({children,tone}){return <span className={'badge '+(tone||statusTone(children))}><i/>{children}</span>}
function SectionHeader({title,subtitle,action}){return <div className="section-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Empty({text}){return <div className="empty"><Search/><b>Sin resultados</b><p>{text}</p></div>}

const isoDate=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const DRIVER_TONES=['blue','teal','orange','purple','red','pink','green'];
function driverTone(name,team){if(!name||name==='Sin asignar')return 'gray';const index=team.findIndex(member=>member.fullName===name);return index<0?'gray':DRIVER_TONES[index%DRIVER_TONES.length]}
function formatSchedule(date,start,end){if(!date||!start)return 'Por programar';const label=new Date(date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}).replace('.','');return label+' · '+start+(end?'–'+end:'')}
function DriverLegend({team}){const drivers=team.filter(member=>['operations','admin'].includes(member.role));return <div className="driver-legend"><span><i className="gray"/>Sin asignar</span>{drivers.map(member=><span key={member.id}><i className={driverTone(member.fullName,team)}/>{member.fullName}</span>)}</div>}
function CalendarEventContent({event,cases}){const related=cases.find(item=>item.id===event.expediente);return <><b>{related?.buque||event.titulo||'Buque sin indicar'}</b><small className="calendar-service">{event.tipoServicio||(event.transporte?'Transporte':'Recepción')}</small><small>{event.asignado||'Sin asignar'}</small><small>{related?.puerto||'Puerto sin indicar'}</small></>}
function Calendario({events,team,cases,transports,saveEvent,openCase}){
  const [weekStart,setWeekStart]=useState(new Date('2026-06-29T12:00:00'));
  const [editing,setEditing]=useState(null);
  const days=Array.from({length:7},(_,index)=>addDays(weekStart,index));
  const hours=Array.from({length:16},(_,index)=>index+6);
  const dayLabel=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
  const newEvent=()=>setEditing({id:'EV-'+Date.now(),titulo:'',tipoServicio:'Recepción',fecha:isoDate(days[0]),inicio:'09:00',fin:'10:00',asignado:'Sin asignar',expediente:'',transporte:'',color:'gray'});
  return <><section className="calendar-toolbar"><div className="calendar-nav"><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹</button><button className="button tertiary" onClick={()=>setWeekStart(new Date('2026-06-29T12:00:00'))}>Hoy</button><button className="button tertiary" onClick={()=>setWeekStart(addDays(weekStart,7))}>›</button><h2>{days[0].toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – {days[6].toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</h2></div><button className="button primary" onClick={newEvent}><Plus/> Nueva tarea</button></section><section className="calendar-shell panel"><div className="calendar-scroll"><div className="calendar-head"><span className="calendar-zone">GMT+2</span>{days.map(day=><div key={isoDate(day)} className={isoDate(day)==='2026-06-29'?'today':''}><b>{dayLabel.format(day).replace('.','')}</b></div>)}</div><div className="calendar-body"><div className="calendar-hours">{hours.map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>{days.map(day=><div className="calendar-day" key={isoDate(day)}>{hours.map(hour=><i className="calendar-line" key={hour}/>)}
    {events.filter(event=>event.fecha===isoDate(day)).map(event=>{const [startHour,startMinute]=event.inicio.split(':').map(Number);const [endHour,endMinute]=event.fin.split(':').map(Number);const top=((startHour*60+startMinute)-360)/60*64;const height=Math.max(72,((endHour*60+endMinute)-(startHour*60+startMinute))/60*64);return <button key={event.id} className={'calendar-event '+event.color} style={{top,height}} onClick={()=>setEditing(event)}><CalendarEventContent event={event} cases={cases}/></button>})}</div>)}</div></div></section>{editing&&<CalendarEventModal item={editing} team={team} cases={cases} transports={transports} close={()=>setEditing(null)} submit={item=>{saveEvent(item);setEditing(null)}} openCase={openCase}/>}</>;
}

function Dashboard({cases,openCase,navigate,showFinance,user}){
  const active=cases.filter(item=>item.estado!=='Completado').length;
  const billing=cases.filter(item=>item.estado==='Completado').reduce((sum,item)=>sum+item.importe,0);
  const alerts=3;
  return <>
    <section className="welcome"><div><span className="overline"><Sparkles/> Resumen del turno</span><h2>Buenos días, {user.fullName.split(' ')[0]}</h2><p>Hay <b>{alerts} operaciones que necesitan atención</b>. El resto avanza según lo previsto.</p></div><button className="button ghost-light" onClick={()=>navigate('expedientes')}>Ver operativa <ChevronRight/></button></section>
    <section className={'kpi-grid '+(!showFinance?'kpi-grid-three':'')}>
      <Kpi icon={Ship} label="Expedientes activos" value={active} note="2 con ETA en 48 h" tone="blue"/>
      <Kpi icon={PackageCheck} label="Bultos en almacén" value="13" note="4 ubicaciones activas" tone="teal"/>
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
    <section className="panel operations"><SectionHeader title="Operaciones recientes" subtitle="Última actividad de expedientes" action={<button className="filter-button" onClick={()=>navigate('expedientes')}><Filter/> Filtrar</button>}/><div className="responsive-table"><div className="table-head"><span>Expediente / buque</span><span>Destino</span><span>ETA</span><span>Progreso</span><span>Estado</span><span/></div>{cases.slice(0,4).map(item=><button className="table-row" key={item.id} onClick={()=>openCase(item.id)}><span className="primary-cell"><span className="ship-icon"><Ship/></span><span><b>{item.buque}</b><small>{item.id} · {item.cliente}</small></span></span><span data-label="Destino"><MapPin/>{item.puerto}</span><span data-label="ETA">{item.eta}</span><span data-label="Progreso"><span className="mini-progress"><i style={{width:item.progreso+'%'}}/></span>{item.progreso}%</span><span data-label="Estado"><Badge>{item.estado}</Badge></span><ChevronRight/></button>)}</div></section>
  </>;
}
function Kpi({icon:Icon,label,value,note,tone}){return <article className="kpi-card"><div className={'kpi-icon '+tone}><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>}
function ActionItem({tone,title,meta,action}){return <button className="attention-item" onClick={action}><span className={'attention-dot '+tone}/><span><b>{title}</b><small>{meta}</small></span><ChevronRight/></button>}
function Schedule({time,title,meta,active,alert}){return <div className={'schedule-item '+(active?'active ':'')+(alert?'alert':'')}><time>{time}</time><span className="schedule-line"><i/></span><span><b>{title}</b><small>{meta}</small></span></div>}

function Expedientes({cases,selected,select,search,setSearch,advanceCase,notify,showFinance,updateCase,clientOptions}){
  const [filter,setFilter]=useState('Todos');
  const [mobileDetail,setMobileDetail]=useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const filtered=cases.filter(item=>(filter==='Todos'||item.estado===filter)&&[item.buque,item.id,item.cliente,item.puerto].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className={'case-layout '+(mobileDetail?'mobile-detail-open':'')}>
    <section className={'panel case-list '+(selected?'has-selection':'')}><div className="list-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar buque, cliente, puerto…"/></label><div className="filter-chips">{['Todos','En curso','Bloqueado','Planificado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></div><div className="case-count">{filtered.length} expedientes</div>{filtered.length?filtered.map(item=><button key={item.id} className={'case-card '+(selected.id===item.id?'selected':'')} onClick={()=>{select(item.id);setMobileDetail(true)}}><div className="case-card-top"><span className="ship-icon"><Ship/></span><span><b>{item.buque}</b><small>{item.id} · {item.cliente}</small></span><Badge>{item.estado}</Badge></div><div className="case-card-meta"><span><MapPin/>{item.puerto}</span><span><CalendarDays/>{item.eta}</span></div><div className="case-progress"><span><i style={{width:item.progreso+'%'}}/></span><small>{item.progreso}%</small></div><p><b>Siguiente:</b> {item.siguiente}</p></button>):<Empty text="Prueba con otro término o estado."/>}</section>
    <section className="panel case-detail"><button className="mobile-detail-back" onClick={()=>setMobileDetail(false)}><ArrowLeft/> Expedientes</button><div className="detail-hero"><div><div className="detail-id">{selected.id} <Badge>{selected.estado}</Badge></div><h2>{selected.buque}</h2><p>{selected.cliente} · {selected.puerto}</p></div><button className="icon-button" aria-label="Editar expediente" onClick={()=>setEditOpen(true)}><PencilLine/></button></div><div className={'detail-stats '+(!showFinance?'detail-stats-three':'')}><Stat label="ETA" value={selected.eta} icon={Clock3}/><Stat label="Mercancía" value={selected.bultos+' bultos · '+selected.peso} icon={Box}/><Stat label="Conductor" value={selected.conductor} icon={UserRound}/>{showFinance&&<Stat label="Importe previsto" value={money(selected.importe)} icon={BadgeEuro}/>}</div><div className="detail-columns"><div><h3>Servicios</h3><div className="service-list">{selected.servicios.map(service=><span key={service}><CheckCircle2/>{service}</span>)}<span className="muted-service"><Circle/>Storage adicional</span></div><h3>Línea temporal</h3><div className="timeline">{timeline.map((event,index)=><div className={'timeline-event '+event.estado} key={event.titulo}><span className="timeline-marker">{event.estado==='done'?<CheckCircle2/>:<Circle/>}</span><time>{event.hora}</time><span><b>{event.titulo}</b><small>{event.detalle}</small></span></div>)}</div></div><aside className="detail-side"><div className="next-action"><span>Próxima acción</span><b>{selected.siguiente}</b><p>La operación quedará registrada en este expediente.</p><button className="button primary full" onClick={()=>advanceCase(selected.id)}><ClipboardCheck/> Registrar avance</button></div><div className="document-box"><h3>Documentos</h3><button onClick={()=>notify('Packing list abierto')}><FileText/><span><b>Packing list.pdf</b><small>1,2 MB · verificado</small></span><ExternalLink/></button><button onClick={()=>notify('POD todavía pendiente')}><Camera/><span><b>POD / fotografías</b><small>Pendiente de entrega</small></span><ChevronRight/></button><button className="upload" onClick={()=>notify('Selector de archivos preparado')}><UploadCloud/> Añadir documento</button></div></aside></div></section>
    {editOpen&&<CaseEditModal item={selected} clientOptions={clientOptions} close={()=>setEditOpen(false)} submit={item=>{updateCase(item);setEditOpen(false)}}/>}
  </div>;
}
function Stat({label,value,icon:Icon}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}

function Almacen({items,cases,openCase,registerEntry,updateEntry,showFinance,storageTotal}){
  const [entryOpen,setEntryOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const totalPackages=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+item.bultos,0);
  const totalWeight=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+(Number(String(item.peso).replace(/\./g,'').replace(/[^\d]/g,''))||0),0);
  const submit=form=>{registerEntry(form);setEntryOpen(false)};
  return <><section className={'summary-strip '+(!showFinance?'summary-strip-three':'')}><Summary icon={Box} label="Bultos en stock" value={String(totalPackages)}/><Summary icon={Scale} label="Peso total" value={totalWeight.toLocaleString('es-ES')+' kg'}/><Summary icon={Layers3} label="Ocupación" value={Math.min(95,Math.round(48+totalPackages*1.5))+'%'}/>{showFinance&&<Summary icon={CircleDollarSign} label="Storage acumulado" value={money(storageTotal)}/>}</section><section className="panel"><SectionHeader title="Mercancía y ubicaciones" subtitle="Pulsa cualquier registro para editarlo" action={<button className="button secondary" onClick={()=>setEntryOpen(true)}><Plus/> Registrar entrada</button>}/><div className="responsive-table warehouse-table"><div className="table-head"><span>Referencia / expediente</span><span>Ubicación</span><span>Entrada</span><span>Mercancía</span><span>Storage</span><span>Estado</span></div>{items.map(item=><button className="table-row" key={item.ref} onClick={()=>setEditing(item)}><span className="primary-cell"><span className="box-icon"><Box/></span><span><b>{item.buque}</b><small>{item.ref} · {item.expediente}</small></span></span><span data-label="Ubicación"><b>{item.zona}</b></span><span data-label="Entrada">{item.entrada}</span><span data-label="Mercancía">{item.bultos} bultos<small>{item.peso}</small></span><span data-label="Storage">{item.dias} día{item.dias===1?'':'s'}</span><span data-label="Estado"><Badge>{item.estado}</Badge></span></button>)}</div></section>{entryOpen&&<WarehouseEntryModal cases={cases} close={()=>setEntryOpen(false)} submit={submit}/>} {editing&&<WarehouseEditModal item={editing} cases={cases} close={()=>setEditing(null)} submit={item=>{updateEntry(item);setEditing(null)}}/>}</>;
}
function Summary({icon:Icon,label,value}){return <article><span><Icon/></span><div><small>{label}</small><b>{value}</b></div></article>}

function Transportes({items,update,openCase,team}){
  const [filter,setFilter]=useState('Todos');const [editing,setEditing]=useState(null);const visible=items.filter(item=>filter==='Todos'||item.estado===filter);
  return <><section className="module-toolbar"><div className="filter-chips">{['Todos','En ruta','Asignado','Sin asignar','Entregado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></section><section className="transport-grid">{visible.map(item=><article className="transport-card" key={item.id}><div className="transport-head"><span className={'transport-icon '+statusTone(item.estado)}><Truck/></span><div><small>{item.id} · {item.expediente}</small><Badge>{item.estado}</Badge></div><button className="icon-button compact" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div><h3>{item.ruta}</h3><div className="transport-info"><span><Clock3/><small>Salida</small><b>{item.hora}</b></span><span><UserRound/><small>Conductor</small><b>{item.conductor}</b></span><span><Navigation/><small>Vehículo</small><b>{item.vehiculo}</b></span></div><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button primary" onClick={()=>setEditing(item)}>{item.estado==='Sin asignar'?'Asignar conductor':'Editar transporte'}</button></div></article>)}</section>{editing&&<TransportEditModal item={editing} team={team} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}</>;
}
function Aduanas({items,update,openCase,notify}){
  const [editing,setEditing]=useState(null);
  return <><section className="alert-banner"><CircleAlert/><div><b>{items.filter(item=>item.estado==='Pendiente').length} trámite requiere atención</b><p>Revisa los documentos pendientes y sus fechas límite.</p></div></section><section className="panel"><SectionHeader title="Trámites aduaneros" subtitle="DUA, T1, T2L y levantes vinculados a expedientes"/><div className="customs-grid">{items.map(item=><article className="custom-card" key={item.id}><div className="custom-card-top"><span className="doc-icon"><FileCheck2/></span><div><small>{item.id} · {item.expediente}</small><h3>{item.tipo}</h3></div><Badge>{item.estado}</Badge></div><dl><div><dt>Referencia</dt><dd>{item.referencia}</dd></div><div><dt>Fecha límite</dt><dd>{item.limite}</dd></div></dl><p>{item.nota}</p><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button secondary" onClick={()=>setEditing(item)}><PencilLine/> Editar</button></div></article>)}</div></section>{editing&&<CustomEditModal item={editing} close={()=>setEditing(null)} submit={item=>{update(item);setEditing(null)}}/>}</>;
}
function Clientes({notify,clients,updateClient}){
  const [query,setQuery]=useState('');const [editing,setEditing]=useState(null);const visible=clients.filter(item=>item.nombre.toLowerCase().includes(query.toLowerCase()));
  return <><section className="panel"><SectionHeader title="Directorio de clientes" subtitle="Contactos y condiciones comerciales activas"/><label className="search-box standalone"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente…"/></label><div className="client-grid">{visible.map(item=><article className="client-card" key={item.codigo}><div className="client-head"><span>{item.nombre.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><div><h3>{item.nombre}</h3><small>{item.codigo} · {item.expedientes} expedientes activos</small></div><button className="icon-button" aria-label={'Editar '+item.nombre} onClick={()=>setEditing(item)}><PencilLine/></button></div><a href={'mailto:'+item.contacto}><Mail/>{item.contacto}</a><div className="rate-grid"><span><small>Recepción</small><b>{item.recepcion}</b></span><span><small>Storage</small><b>{item.storage}</b></span><span><small>Transporte</small><b>{item.transporte}</b></span><span><small>Fuera de horario</small><b>{item.recargo}</b></span></div><button className="button tertiary full" onClick={()=>setEditing(item)}>Editar ficha y tarifas <PencilLine/></button></article>)}</div></section>{editing&&<ClientEditModal item={editing} close={()=>setEditing(null)} submit={item=>{updateClient(item);setEditing(null)}}/>}</>;
}
function Facturacion({openCase,notify,invoices,updateInvoice}){
  const [editing,setEditing]=useState(null);
  const total=invoices.filter(item=>item.estado!=='Enviada').reduce((sum,item)=>sum+item.importe,0);
  return <><section className="billing-hero"><div><span>Importe pendiente de gestión</span><strong>{money(total)}</strong><small>{invoices.filter(item=>item.estado!=='Enviada').length} documentos · junio 2026</small></div><div><span className="holded-mark">H</span><div><b>Integración con Holded</b><small>Exportación manual en este MVP</small></div></div><button className="button primary" onClick={()=>notify('CSV generado con '+invoices.length+' documentos')}><Download/> Exportar selección</button></section><section className="panel"><SectionHeader title="Documentos de facturación" subtitle="Revisa conceptos antes de exportar"/><div className="responsive-table billing-table"><div className="table-head"><span>Documento / expediente</span><span>Cliente</span><span>Concepto</span><span>Importe</span><span>Estado</span><span/></div>{invoices.map(item=><div className="table-row" key={item.id}><span className="primary-cell"><span className="invoice-icon"><ReceiptText/></span><span><b>{item.id}</b><button onClick={()=>openCase(item.expediente)}>{item.expediente}</button></span></span><span data-label="Cliente">{item.cliente}</span><span data-label="Concepto">{item.concepto}</span><strong data-label="Importe">{money(item.importe)}</strong><span data-label="Estado"><Badge>{item.estado}</Badge></span><button className="icon-button" aria-label={'Editar '+item.id} onClick={()=>setEditing(item)}><PencilLine/></button></div>)}</div></section>{editing&&<InvoiceEditModal item={editing} close={()=>setEditing(null)} submit={item=>{updateInvoice(item);setEditing(null)}}/>}</>;
}

function Usuarios({csrfToken,notify,onPreview,onUsersChanged}){
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [form,setForm]=useState({fullName:'',email:'',password:'',role:'operations'});const [busy,setBusy]=useState(false);
  const load=()=>{setLoading(true);api('/api/admin/users.php').then(result=>setUsers(result.users)).catch(reason=>setError(reason.message)).finally(()=>setLoading(false))};
  useEffect(load,[]);
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const submit=async event=>{event.preventDefault();setBusy(true);setError('');try{await api('/api/admin/users.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify(form)});setForm({fullName:'',email:'',password:'',role:'operations'});notify('Usuario creado correctamente');load();onUsersChanged()}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <div className="users-layout"><section className="panel"><SectionHeader title="Equipo con acceso" subtitle="Crea usuarios y comprueba exactamente qué verá cada rol"/>{error&&<div className="form-error users-error"><CircleAlert/>{error}</div>}{loading?<div className="users-loading">Cargando usuarios…</div>:<div className="user-list">{users.map(item=><article key={item.id}><div className="avatar">{initials(item.fullName)}</div><div><b>{item.fullName}</b><small>{item.email}</small></div><Badge tone={item.role==='admin'?'info':item.role==='finance'?'success':'warning'}>{ROLE_LABELS[item.role]}</Badge><button className="button tertiary preview-user" onClick={()=>onPreview(item)}><Eye/> Ver como</button></article>)}</div>}</section><section className="panel create-user"><SectionHeader title="Añadir usuario" subtitle="La contraseña debe tener al menos 4 caracteres"/><form onSubmit={submit}><label className="field"><span>Nombre completo</span><input name="fullName" value={form.fullName} onChange={update} required/></label><label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required/></label><label className="field"><span>Contraseña temporal</span><input name="password" type="password" minLength="4" value={form.password} onChange={update} required/></label><label className="field"><span>Nivel de acceso</span><select name="role" value={form.role} onChange={update}><option value="operations">Operaciones · sin importes</option><option value="finance">Finanzas · importes y tarifas</option><option value="admin">Administración · acceso total</option></select></label><button className="button primary full" disabled={busy}><UserPlus/>{busy?'Creando…':'Crear usuario'}</button></form></section></div>;
}

function CaseEditModal({item,close,submit}){
  const [form,setForm]=useState({...item,servicios:item.servicios.join(', ')});
  const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();submit({...item,...form,bultos:Number(form.bultos)||0,progreso:Math.max(0,Math.min(100,Number(form.progreso)||0)),servicios:form.servicios.split(',').map(value=>value.trim()).filter(Boolean)})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Expediente {item.id}</span><h2>Editar información</h2><p>Los cambios se compartirán con todos los usuarios.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field"><span>Buque</span><input name="buque" value={form.buque} onChange={update} required/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><input name="puerto" value={form.puerto} onChange={update} required/></label><label className="field"><span>ETA</span><input name="eta" value={form.eta} onChange={update} required/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Nuevo','Planificado','En curso','Bloqueado','Completado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Progreso (%)</span><input name="progreso" type="number" min="0" max="100" value={form.progreso} onChange={update}/></label><label className="field"><span>Siguiente acción</span><input name="siguiente" value={form.siguiente} onChange={update}/></label><label className="field wide"><span>Servicios (separados por comas)</span><input name="servicios" value={form.servicios} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar cambios</button></div></form></section></div>;
}

function TransportEditModal({item,team,close,submit}){
  const [form,setForm]=useState({...item,fecha:item.fecha||'2026-06-29',inicio:item.inicio||'09:00',fin:item.fin||'10:00'});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const estado=form.conductor==='Sin asignar'?'Sin asignar':form.estado==='Sin asignar'?'Asignado':form.estado;submit({...form,estado})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.id}</span><h2>Editar transporte</h2><p>El conductor se selecciona entre los usuarios activos.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Ruta</span><input name="ruta" value={form.ruta} onChange={update} required/></label><label className="field"><span>Salida</span><input name="hora" value={form.hora} onChange={update} required/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['Sin asignar','Asignado','En ruta','Entregado'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Conductor</span><select name="conductor" value={form.conductor} onChange={update}><option>Sin asignar</option>{team.map(member=><option key={member.id} value={member.fullName}>{member.fullName} · {ROLE_LABELS[member.role]}</option>)}</select></label><label className="field"><span>Vehículo / matrícula</span><input name="vehiculo" value={form.vehiculo} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar transporte</button></div></form></section></div>;
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

function CalendarEventModal({item,team,cases,transports,close,submit,openCase}){
  const [form,setForm]=useState({...item,tipoServicio:item.tipoServicio||(item.transporte?'Transporte':'Recepción')});
  const update=event=>{
    if(event.target.name==='tipoServicio'){setForm({...form,tipoServicio:event.target.value,transporte:event.target.value==='Recepción'?'':form.transporte});return}
    if(event.target.name==='transporte'){const linked=transports.find(entry=>entry.id===event.target.value);setForm({...form,tipoServicio:event.target.value?'Transporte':form.tipoServicio,transporte:event.target.value,expediente:linked?.expediente||form.expediente,titulo:form.titulo||linked?.ruta||'',asignado:linked?.conductor||form.asignado,fecha:linked?.fecha||form.fecha,inicio:linked?.inicio||form.inicio,fin:linked?.fin||form.fin});return}
    setForm({...form,[event.target.name]:event.target.value});
  };
  const validTeam=team.filter(member=>['operations','admin'].includes(member.role));
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">Planificación</span><h2>{item.titulo?'Editar tarea':'Nueva tarea'}</h2><p>Define el servicio, responsable y trabajo relacionado.</p></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={event=>{event.preventDefault();submit(form)}}><label className="field"><span>Tipo de servicio</span><select name="tipoServicio" value={form.tipoServicio} onChange={update} autoFocus><option>Recepción</option><option>Transporte</option></select></label><label className="field"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update} required><option value="">Seleccionar expediente</option>{cases.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.buque}</option>)}</select></label><label className="field"><span>Fecha</span><input name="fecha" type="date" value={form.fecha} onChange={update} required/></label><label className="field"><span>Responsable</span><select name="asignado" value={form.asignado} onChange={update}><option>Sin asignar</option>{validTeam.map(member=><option key={member.id} value={member.fullName}>{member.fullName}</option>)}</select></label><label className="field"><span>Hora de inicio</span><input name="inicio" type="time" value={form.inicio} onChange={update} required/></label><label className="field"><span>Hora de fin</span><input name="fin" type="time" value={form.fin} onChange={update} required/></label>{form.tipoServicio==='Transporte'&&<label className="field wide"><span>Transporte relacionado</span><select name="transporte" value={form.transporte} onChange={update}><option value="">Sin transporte</option>{transports.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.ruta}</option>)}</select></label>}<label className="field wide"><span>Notas del servicio</span><input name="titulo" value={form.titulo} onChange={update} placeholder="Información adicional"/></label>{form.expediente&&<button type="button" className="button tertiary wide calendar-case-link" onClick={()=>{close();openCase(form.expediente)}}>Abrir expediente relacionado <ExternalLink/></button>}<div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar tarea</button></div></form></section></div>;
}

function NewCaseModal({close,submit}){
  const [form,setForm]=useState({buque:'',cliente:'UME Shipping',puerto:'Barcelona',eta:'',prioridad:'Media',bultos:'1'});const update=e=>setForm({...form,[e.target.name]:e.target.value});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-head"><div><span className="overline">Nuevo registro</span><h2 id="new-case-title">Crear expediente</h2><p>Introduce los datos mínimos. Podrás completar el resto después.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();submit(form)}}><label className="field wide"><span>Buque *</span><input name="buque" value={form.buque} onChange={update} placeholder="Ej. Baltic Horizon" required autoFocus/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientNames.map(name=><option key={name}>{name}</option>)}</select></label><label className="field"><span>Puerto</span><select name="puerto" value={form.puerto} onChange={update}>{['Barcelona','Algeciras','Tarragona','Valencia','Bilbao'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>ETA</span><input name="eta" type="datetime-local" value={form.eta} onChange={update}/></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>N.º de bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Crear expediente</button></div></form></section></div>;
}

function WarehouseEntryModal({cases,close,submit}){
  const [form,setForm]=useState({expediente:cases[0]?.id||'',zona:'A-01',bultos:'1',peso:'100'});
  const update=e=>setForm({...form,[e.target.name]:e.target.value});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-entry-title"><div className="modal-head"><div><span className="overline">Almacén</span><h2 id="warehouse-entry-title">Registrar entrada</h2><p>Vincula la mercancía a un expediente y asigna su ubicación.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();submit(form)}}><label className="field wide"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update}>{cases.map(item=><option value={item.id} key={item.id}>{item.id} · {item.buque}</option>)}</select></label><label className="field"><span>Ubicación *</span><input name="zona" value={form.zona} onChange={update} placeholder="Ej. A-01" required/></label><label className="field"><span>N.º de bultos *</span><input name="bultos" type="number" min="1" value={form.bultos} onChange={update} required/></label><label className="field wide"><span>Peso total (kg) *</span><input name="peso" type="number" min="1" step="0.1" value={form.peso} onChange={update} required/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Registrar entrada</button></div></form></section></div>;
}

function WarehouseEditModal({item,cases,close,submit}){
  const [form,setForm]=useState({...item});const update=event=>setForm({...form,[event.target.name]:event.target.value});
  const save=event=>{event.preventDefault();const related=cases.find(entry=>entry.id===form.expediente);submit({...form,buque:related?.buque||form.buque,bultos:Number(form.bultos)||0,dias:Number(form.dias)||0})};
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="overline">{item.ref}</span><h2>Editar entrada de almacén</h2></div><button className="icon-button" onClick={close}><X/></button></div><form onSubmit={save}><label className="field wide"><span>Expediente</span><select name="expediente" value={form.expediente} onChange={update}>{cases.map(entry=><option key={entry.id} value={entry.id}>{entry.id} · {entry.buque}</option>)}</select></label><label className="field"><span>Ubicación</span><input name="zona" value={form.zona} onChange={update} required/></label><label className="field"><span>Fecha de entrada</span><input name="entrada" value={form.entrada} onChange={update} required/></label><label className="field"><span>Bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><label className="field"><span>Peso</span><input name="peso" value={form.peso} onChange={update}/></label><label className="field"><span>Días de storage</span><input name="dias" type="number" min="0" value={form.dias} onChange={update}/></label><label className="field"><span>Estado</span><select name="estado" value={form.estado} onChange={update}>{['En stock','Retenido','Preparado','Expedido'].map(value=><option key={value}>{value}</option>)}</select></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Guardar entrada</button></div></form></section></div>;
}

createRoot(document.getElementById('root')).render(<AuthRoot/>);
