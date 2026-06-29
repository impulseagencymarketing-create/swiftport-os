import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Anchor, LayoutDashboard, FolderKanban, Warehouse as WarehouseIcon, Truck, FileCheck2,
  UsersRound, ReceiptText, Menu, X, Plus, Search, Bell, ChevronRight, Ship,
  PackageCheck, CircleAlert, WalletCards, CalendarDays, MapPin, Clock3, CheckCircle2,
  Circle, Camera, Box, Scale, Layers3, Navigation, UserRound, FileText, UploadCloud,
  Download, Filter, CircleDollarSign, ExternalLink, Mail, PencilLine, ClipboardCheck,
  BadgeEuro, Sparkles, ArrowLeft, Save
} from 'lucide-react';
import {
  expedientesIniciales, movimientosAlmacen, transportesIniciales, tramitesAduana,
  clientesIniciales, facturasIniciales, timeline
} from './data';
import './styles.css';

const NAV = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['expedientes','Expedientes',FolderKanban],
  ['almacen','Almacén',WarehouseIcon],
  ['transportes','Transportes',Truck],
  ['aduanas','Aduanas',FileCheck2],
  ['clientes','Clientes / Tarifas',UsersRound],
  ['facturacion','Facturación',ReceiptText]
];
const TITLES = {
  dashboard:['Dashboard','Vista general de la operativa'],
  expedientes:['Expedientes','Seguimiento completo por buque'],
  almacen:['Almacén','Entradas, ubicación y días de storage'],
  transportes:['Transportes','Planificación y asignación de conductores'],
  aduanas:['Aduanas','Documentación y control de despachos'],
  clientes:['Clientes y tarifas','Condiciones comerciales por cliente'],
  facturacion:['Facturación','Servicios listos para revisar y exportar']
};
const statusTone = value => {
  if (['Completado','Liberado','Entregado','Lista','Enviada','Preparado','Expedido'].includes(value)) return 'success';
  if (['Bloqueado','Urgente','Retenido','Sin asignar','Revisar','Pendiente'].includes(value)) return 'danger';
  if (['En curso','En ruta','Asignado','En stock','Borrador'].includes(value)) return 'info';
  return 'warning';
};
const money = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);

function App(){
  const [tab,setTab]=useState('dashboard');
  const [menuOpen,setMenuOpen]=useState(false);
  const [newOpen,setNewOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [cases,setCases]=useState(expedientesIniciales);
  const [selectedId,setSelectedId]=useState(expedientesIniciales[0].id);
  const [transports,setTransports]=useState(transportesIniciales);
  const [warehouseEntries,setWarehouseEntries]=useState(movimientosAlmacen);
  const [toast,setToast]=useState('');
  const selected=cases.find(item=>item.id===selectedId)||cases[0];
  const notify=message=>{setToast(message);window.clearTimeout(window.__swiftportToast);window.__swiftportToast=window.setTimeout(()=>setToast(''),2600)};
  const navigate=id=>{setTab(id);setMenuOpen(false);setSearch('')};
  const openCase=id=>{setSelectedId(id);navigate('expedientes')};
  const createCase=form=>{
    const nextNumber=49+cases.length-expedientesIniciales.length;
    const item={id:'SW-2026-'+String(nextNumber).padStart(4,'0'),buque:form.buque.toUpperCase(),cliente:form.cliente,puerto:form.puerto,eta:form.eta||'Por confirmar',estado:'Nuevo',prioridad:form.prioridad,conductor:'Sin asignar',servicios:['Recepción','Transporte'],bultos:Number(form.bultos)||0,peso:'Por registrar',importe:0,progreso:8,siguiente:'Completar datos del expediente',aduana:'Por revisar'};
    setCases(current=>[item,...current]);setSelectedId(item.id);setNewOpen(false);setTab('expedientes');notify('Expediente '+item.id+' creado');
  };
  const assignDriver=id=>{setTransports(items=>items.map(item=>item.id===id?{...item,conductor:'Clara V.',vehiculo:'8814 NDK',estado:'Asignado'}:item));notify('Conductor asignado correctamente')};
  const advanceCase=id=>{setCases(items=>items.map(item=>item.id===id?{...item,progreso:Math.min(100,item.progreso+12),siguiente:'Preparar salida de almacén',estado:'En curso'}:item));notify('Operación registrada en la línea temporal')};
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
    setWarehouseEntries(items=>[item,...items]);
    notify('Entrada '+item.ref+' registrada en '+item.zona);
  };
  const [title,subtitle]=TITLES[tab];
  return <div className="shell">
    <Sidebar tab={tab} open={menuOpen} navigate={navigate} close={()=>setMenuOpen(false)}/>
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
          <div className="avatar" title="Lucía · Operaciones">LM</div>
        </div>
      </header>
      <div className="content">
        {tab==='dashboard'&&<Dashboard cases={cases} openCase={openCase} navigate={navigate}/>} 
        {tab==='expedientes'&&<Expedientes cases={cases} selected={selected} select={setSelectedId} search={search} setSearch={setSearch} advanceCase={advanceCase} notify={notify}/>} 
        {tab==='almacen'&&<Almacen items={warehouseEntries} cases={cases} openCase={openCase} registerEntry={registerWarehouseEntry}/>} 
        {tab==='transportes'&&<Transportes items={transports} assign={assignDriver} openCase={openCase}/>} 
        {tab==='aduanas'&&<Aduanas openCase={openCase} notify={notify}/>} 
        {tab==='clientes'&&<Clientes notify={notify}/>} 
        {tab==='facturacion'&&<Facturacion openCase={openCase} notify={notify}/>} 
      </div>
    </main>
    <MobileNav tab={tab} navigate={navigate} more={()=>setMenuOpen(true)}/>
    {newOpen&&<NewCaseModal close={()=>setNewOpen(false)} submit={createCase}/>} 
    {toast&&<div className="toast" role="status"><CheckCircle2/>{toast}</div>}
  </div>;
}

function Sidebar({tab,open,navigate,close}){
  return <aside className={'sidebar '+(open?'open':'')}>
    <div className="brand"><span className="brand-mark"><Anchor/></span><div><b>SWIFTPORT</b><small>OPERATING SYSTEM</small></div><button className="icon-button sidebar-close" aria-label="Cerrar menú" onClick={close}><X/></button></div>
    <nav aria-label="Navegación principal">{NAV.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span>{tab===id&&<ChevronRight className="nav-arrow"/>}</button>)}</nav>
    <div className="sidebar-card"><div className="live-dot"/> <div><b>Operativa conectada</b><small>Datos de demostración</small></div></div>
    <div className="profile"><div className="avatar light">LM</div><div><b>Lucía Moreno</b><small>Operaciones</small></div></div>
  </aside>;
}
function MobileNav({tab,navigate,more}){
  const visible=NAV.slice(0,4);
  return <nav className="mobile-nav" aria-label="Navegación móvil">{visible.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span></button>)}<button className={!visible.some(item=>item[0]===tab)?'active':''} onClick={more}><Menu/><span>Más</span></button></nav>;
}
function Badge({children,tone}){return <span className={'badge '+(tone||statusTone(children))}><i/>{children}</span>}
function SectionHeader({title,subtitle,action}){return <div className="section-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Empty({text}){return <div className="empty"><Search/><b>Sin resultados</b><p>{text}</p></div>}

function Dashboard({cases,openCase,navigate}){
  const active=cases.filter(item=>item.estado!=='Completado').length;
  const billing=cases.filter(item=>item.estado==='Completado').reduce((sum,item)=>sum+item.importe,0);
  const alerts=3;
  return <>
    <section className="welcome"><div><span className="overline"><Sparkles/> Resumen del turno</span><h2>Buenos días, Lucía</h2><p>Hay <b>{alerts} operaciones que necesitan atención</b>. El resto avanza según lo previsto.</p></div><button className="button ghost-light" onClick={()=>navigate('expedientes')}>Ver operativa <ChevronRight/></button></section>
    <section className="kpi-grid">
      <Kpi icon={Ship} label="Expedientes activos" value={active} note="2 con ETA en 48 h" tone="blue"/>
      <Kpi icon={PackageCheck} label="Bultos en almacén" value="13" note="4 ubicaciones activas" tone="teal"/>
      <Kpi icon={CircleAlert} label="Requieren acción" value={alerts} note="1 de prioridad urgente" tone="orange"/>
      <Kpi icon={WalletCards} label="Listo para facturar" value={money(billing)} note="1 expediente completado" tone="green"/>
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

function Expedientes({cases,selected,select,search,setSearch,advanceCase,notify}){
  const [filter,setFilter]=useState('Todos');
  const [mobileDetail,setMobileDetail]=useState(false);
  const filtered=cases.filter(item=>(filter==='Todos'||item.estado===filter)&&[item.buque,item.id,item.cliente,item.puerto].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className={'case-layout '+(mobileDetail?'mobile-detail-open':'')}>
    <section className={'panel case-list '+(selected?'has-selection':'')}><div className="list-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar buque, cliente, puerto…"/></label><div className="filter-chips">{['Todos','En curso','Bloqueado','Planificado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div></div><div className="case-count">{filtered.length} expedientes</div>{filtered.length?filtered.map(item=><button key={item.id} className={'case-card '+(selected.id===item.id?'selected':'')} onClick={()=>{select(item.id);setMobileDetail(true)}}><div className="case-card-top"><span className="ship-icon"><Ship/></span><span><b>{item.buque}</b><small>{item.id} · {item.cliente}</small></span><Badge>{item.estado}</Badge></div><div className="case-card-meta"><span><MapPin/>{item.puerto}</span><span><CalendarDays/>{item.eta}</span></div><div className="case-progress"><span><i style={{width:item.progreso+'%'}}/></span><small>{item.progreso}%</small></div><p><b>Siguiente:</b> {item.siguiente}</p></button>):<Empty text="Prueba con otro término o estado."/>}</section>
    <section className="panel case-detail"><button className="mobile-detail-back" onClick={()=>setMobileDetail(false)}><ArrowLeft/> Expedientes</button><div className="detail-hero"><div><div className="detail-id">{selected.id} <Badge>{selected.estado}</Badge></div><h2>{selected.buque}</h2><p>{selected.cliente} · {selected.puerto}</p></div><button className="icon-button" aria-label="Editar expediente" onClick={()=>notify('Edición preparada para la siguiente iteración')}><PencilLine/></button></div><div className="detail-stats"><Stat label="ETA" value={selected.eta} icon={Clock3}/><Stat label="Mercancía" value={selected.bultos+' bultos · '+selected.peso} icon={Box}/><Stat label="Conductor" value={selected.conductor} icon={UserRound}/><Stat label="Importe previsto" value={money(selected.importe)} icon={BadgeEuro}/></div><div className="detail-columns"><div><h3>Servicios</h3><div className="service-list">{selected.servicios.map(service=><span key={service}><CheckCircle2/>{service}</span>)}<span className="muted-service"><Circle/>Storage adicional</span></div><h3>Línea temporal</h3><div className="timeline">{timeline.map((event,index)=><div className={'timeline-event '+event.estado} key={event.titulo}><span className="timeline-marker">{event.estado==='done'?<CheckCircle2/>:<Circle/>}</span><time>{event.hora}</time><span><b>{event.titulo}</b><small>{event.detalle}</small></span></div>)}</div></div><aside className="detail-side"><div className="next-action"><span>Próxima acción</span><b>{selected.siguiente}</b><p>La operación quedará registrada en este expediente.</p><button className="button primary full" onClick={()=>advanceCase(selected.id)}><ClipboardCheck/> Registrar avance</button></div><div className="document-box"><h3>Documentos</h3><button onClick={()=>notify('Packing list abierto')}><FileText/><span><b>Packing list.pdf</b><small>1,2 MB · verificado</small></span><ExternalLink/></button><button onClick={()=>notify('POD todavía pendiente')}><Camera/><span><b>POD / fotografías</b><small>Pendiente de entrega</small></span><ChevronRight/></button><button className="upload" onClick={()=>notify('Selector de archivos preparado')}><UploadCloud/> Añadir documento</button></div></aside></div></section>
  </div>;
}
function Stat({label,value,icon:Icon}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}

function Almacen({items,cases,openCase,registerEntry}){
  const [entryOpen,setEntryOpen]=useState(false);
  const totalPackages=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+item.bultos,0);
  const totalWeight=items.filter(item=>item.estado!=='Expedido').reduce((sum,item)=>sum+(Number(String(item.peso).replace(/\./g,'').replace(/[^\d]/g,''))||0),0);
  const submit=form=>{registerEntry(form);setEntryOpen(false)};
  return <><section className="summary-strip"><Summary icon={Box} label="Bultos en stock" value={String(totalPackages)}/><Summary icon={Scale} label="Peso total" value={totalWeight.toLocaleString('es-ES')+' kg'}/><Summary icon={Layers3} label="Ocupación" value={Math.min(95,Math.round(48+totalPackages*1.5))+'%'}/><Summary icon={CircleDollarSign} label="Storage acumulado" value="318 €"/></section><section className="panel"><SectionHeader title="Mercancía y ubicaciones" subtitle="Control de entradas, salidas y storage" action={<button className="button secondary" onClick={()=>setEntryOpen(true)}><Plus/> Registrar entrada</button>}/><div className="responsive-table warehouse-table"><div className="table-head"><span>Referencia / expediente</span><span>Ubicación</span><span>Entrada</span><span>Mercancía</span><span>Storage</span><span>Estado</span></div>{items.map(item=><button className="table-row" key={item.ref} onClick={()=>openCase(item.expediente)}><span className="primary-cell"><span className="box-icon"><Box/></span><span><b>{item.buque}</b><small>{item.ref} · {item.expediente}</small></span></span><span data-label="Ubicación"><b>{item.zona}</b></span><span data-label="Entrada">{item.entrada}</span><span data-label="Mercancía">{item.bultos} bultos<small>{item.peso}</small></span><span data-label="Storage">{item.dias} día{item.dias===1?'':'s'}</span><span data-label="Estado"><Badge>{item.estado}</Badge></span></button>)}</div></section>{entryOpen&&<WarehouseEntryModal cases={cases} close={()=>setEntryOpen(false)} submit={submit}/>}</>;
}
function Summary({icon:Icon,label,value}){return <article><span><Icon/></span><div><small>{label}</small><b>{value}</b></div></article>}

function Transportes({items,assign,openCase}){
  const [filter,setFilter]=useState('Todos');const visible=items.filter(item=>filter==='Todos'||item.estado===filter);
  return <><section className="module-toolbar"><div className="filter-chips">{['Todos','En ruta','Asignado','Sin asignar','Entregado'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}</div><button className="button secondary"><Plus/> Nuevo transporte</button></section><section className="transport-grid">{visible.map(item=><article className="transport-card" key={item.id}><div className="transport-head"><span className={'transport-icon '+statusTone(item.estado)}><Truck/></span><div><small>{item.id} · {item.expediente}</small><Badge>{item.estado}</Badge></div></div><h3>{item.ruta}</h3><div className="transport-info"><span><Clock3/><small>Salida</small><b>{item.hora}</b></span><span><UserRound/><small>Conductor</small><b>{item.conductor}</b></span><span><Navigation/><small>Vehículo</small><b>{item.vehiculo}</b></span></div><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button>{item.estado==='Sin asignar'?<button className="button primary" onClick={()=>assign(item.id)}>Asignar conductor</button>:<button className="button secondary">Ver ruta</button>}</div></article>)}</section></>;
}
function Aduanas({openCase,notify}){
  return <><section className="alert-banner"><CircleAlert/><div><b>1 trámite requiere atención hoy</b><p>La autorización T1 de POLARIS MILA vence a las 17:00.</p></div><button onClick={()=>openCase('SW-2026-0047')}>Revisar ahora <ChevronRight/></button></section><section className="panel"><SectionHeader title="Trámites aduaneros" subtitle="DUA, T1, T2L y levantes vinculados a expedientes" action={<button className="button secondary" onClick={()=>notify('Nuevo trámite preparado')}><Plus/> Nuevo trámite</button>}/><div className="customs-grid">{tramitesAduana.map(item=><article className="custom-card" key={item.id}><div className="custom-card-top"><span className="doc-icon"><FileCheck2/></span><div><small>{item.id} · {item.expediente}</small><h3>{item.tipo}</h3></div><Badge>{item.estado}</Badge></div><dl><div><dt>Referencia</dt><dd>{item.referencia}</dd></div><div><dt>Fecha límite</dt><dd>{item.limite}</dd></div></dl><p>{item.nota}</p><div className="card-actions"><button className="button tertiary" onClick={()=>openCase(item.expediente)}>Ver expediente</button><button className="button secondary" onClick={()=>notify('Documento de '+item.id+' abierto')}>Documentos</button></div></article>)}</div></section></>;
}
function Clientes({notify}){
  const [query,setQuery]=useState('');const visible=clientesIniciales.filter(item=>item.nombre.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel"><SectionHeader title="Directorio de clientes" subtitle="Contactos y condiciones comerciales activas" action={<button className="button secondary" onClick={()=>notify('Alta de cliente preparada')}><Plus/> Nuevo cliente</button>}/><label className="search-box standalone"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente…"/></label><div className="client-grid">{visible.map(item=><article className="client-card" key={item.codigo}><div className="client-head"><span>{item.nombre.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><div><h3>{item.nombre}</h3><small>{item.codigo} · {item.expedientes} expedientes activos</small></div><button className="icon-button" aria-label={'Editar '+item.nombre} onClick={()=>notify('Tarifas de '+item.nombre+' abiertas')}><PencilLine/></button></div><a href={'mailto:'+item.contacto}><Mail/>{item.contacto}</a><div className="rate-grid"><span><small>Recepción</small><b>{item.recepcion}</b></span><span><small>Storage</small><b>{item.storage}</b></span><span><small>Transporte</small><b>{item.transporte}</b></span><span><small>Fuera de horario</small><b>{item.recargo}</b></span></div><button className="button tertiary full" onClick={()=>notify('Ficha de '+item.nombre+' abierta')}>Ver ficha y tarifas <ChevronRight/></button></article>)}</div></section>;
}
function Facturacion({openCase,notify}){
  const total=facturasIniciales.filter(item=>item.estado!=='Enviada').reduce((sum,item)=>sum+item.importe,0);
  return <><section className="billing-hero"><div><span>Importe pendiente de gestión</span><strong>{money(total)}</strong><small>3 documentos · junio 2026</small></div><div><span className="holded-mark">H</span><div><b>Integración con Holded</b><small>Exportación manual en este MVP</small></div></div><button className="button primary" onClick={()=>notify('CSV generado con 3 documentos')}><Download/> Exportar selección</button></section><section className="panel"><SectionHeader title="Documentos de facturación" subtitle="Revisa conceptos antes de exportar"/><div className="responsive-table billing-table"><div className="table-head"><span>Documento / expediente</span><span>Cliente</span><span>Concepto</span><span>Importe</span><span>Estado</span><span/></div>{facturasIniciales.map(item=><div className="table-row" key={item.id}><span className="primary-cell"><span className="invoice-icon"><ReceiptText/></span><span><b>{item.id}</b><button onClick={()=>openCase(item.expediente)}>{item.expediente}</button></span></span><span data-label="Cliente">{item.cliente}</span><span data-label="Concepto">{item.concepto}</span><strong data-label="Importe">{money(item.importe)}</strong><span data-label="Estado"><Badge>{item.estado}</Badge></span><button className="icon-button" aria-label={'Abrir '+item.id} onClick={()=>notify(item.id+' abierto')}><ChevronRight/></button></div>)}</div></section></>;
}

function NewCaseModal({close,submit}){
  const [form,setForm]=useState({buque:'',cliente:'UME Shipping',puerto:'Barcelona',eta:'',prioridad:'Media',bultos:'1'});const update=e=>setForm({...form,[e.target.name]:e.target.value});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-head"><div><span className="overline">Nuevo registro</span><h2 id="new-case-title">Crear expediente</h2><p>Introduce los datos mínimos. Podrás completar el resto después.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();submit(form)}}><label className="field wide"><span>Buque *</span><input name="buque" value={form.buque} onChange={update} placeholder="Ej. Baltic Horizon" required autoFocus/></label><label className="field"><span>Cliente</span><select name="cliente" value={form.cliente} onChange={update}>{clientesIniciales.map(item=><option key={item.codigo}>{item.nombre}</option>)}</select></label><label className="field"><span>Puerto</span><select name="puerto" value={form.puerto} onChange={update}>{['Barcelona','Algeciras','Tarragona','Valencia','Bilbao'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>ETA</span><input name="eta" type="datetime-local" value={form.eta} onChange={update}/></label><label className="field"><span>Prioridad</span><select name="prioridad" value={form.prioridad} onChange={update}>{['Baja','Media','Alta','Urgente'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>N.º de bultos</span><input name="bultos" type="number" min="0" value={form.bultos} onChange={update}/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Crear expediente</button></div></form></section></div>;
}

function WarehouseEntryModal({cases,close,submit}){
  const [form,setForm]=useState({expediente:cases[0]?.id||'',zona:'A-01',bultos:'1',peso:'100'});
  const update=e=>setForm({...form,[e.target.name]:e.target.value});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-entry-title"><div className="modal-head"><div><span className="overline">Almacén</span><h2 id="warehouse-entry-title">Registrar entrada</h2><p>Vincula la mercancía a un expediente y asigna su ubicación.</p></div><button className="icon-button" aria-label="Cerrar" onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();submit(form)}}><label className="field wide"><span>Expediente / buque</span><select name="expediente" value={form.expediente} onChange={update}>{cases.map(item=><option value={item.id} key={item.id}>{item.id} · {item.buque}</option>)}</select></label><label className="field"><span>Ubicación *</span><input name="zona" value={form.zona} onChange={update} placeholder="Ej. A-01" required/></label><label className="field"><span>N.º de bultos *</span><input name="bultos" type="number" min="1" value={form.bultos} onChange={update} required/></label><label className="field wide"><span>Peso total (kg) *</span><input name="peso" type="number" min="1" step="0.1" value={form.peso} onChange={update} required/></label><div className="modal-actions wide"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary"><Save/> Registrar entrada</button></div></form></section></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
