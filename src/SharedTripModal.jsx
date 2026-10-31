import React,{useState} from 'react';
import {X,Plus,Truck,Save} from 'lucide-react';
import TransportAssigneeSelect from './TransportAssigneeSelect.jsx';
import TransportWaitingFields from './TransportWaitingFields.jsx';
import {initialSharedTrip,allocateTripCost,tripStops} from './sharedTrips.mjs';
import './shared-trips.css';

export default function SharedTripModal({item={},cases,transports,team,providers,close,submit,openCase}){
  const [form,setForm]=useState(()=>initialSharedTrip(item,transports,cases));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const stopChange=(index,patch)=>setForm(f=>({...f,stops:f.stops.map((s,i)=>i===index?{...s,...patch}:s)}));
  let shares=null,costError='';try{shares=allocateTripCost(form.cost,form.stops,form.costMode)}catch(e){costError=e.message}
  const chooseCase=(index,id)=>{const c=cases.find(c=>c.id===id);stopChange(index,{expediente:id,transportId:'',destino:c?`BUQUE ${c.buque} · ${c.puerto||''}`:'',cargo:c?.resumenMercancia||'',waiting:undefined,observacion:''})};
  const chooseTransport=(index,id)=>{const t=transports.find(t=>t.id===id);if(!t){stopChange(index,{transportId:'',waiting:undefined});return}stopChange(index,{transportId:id,waiting:t.waiting,origen:t.origen||'',destino:t.destino||'',cargo:t.sharedCargo||cases.find(c=>c.id===t.expediente)?.resumenMercancia||'',observacion:t.observacion||''});if(index===0&&!form.id)setForm(f=>({...f,fecha:t.fecha||'',inicio:t.inicio||'',fin:t.fin||'',asignado:t.conductor||'Sin asignar',proveedorId:t.proveedorId||'',vehiculo:t.vehiculo||''}))};
  const save=async e=>{e.preventDefault();setError('');if(costError){setError(costError);return}setBusy(true);try{await submit({sharedTripDraft:form});close()}catch(e){setError(e.message||'No se pudo guardar el viaje. Tus cambios siguen aquí.')}finally{setBusy(false)}};
  return <div className="modal-backdrop"><section className="modal shared-trip-modal" role="dialog" aria-modal="true" aria-label="Transporte compartido">
    <header className="modal-head"><div><span className="overline">Un viaje · varias entregas</span><h2>{form.id?'Editar viaje compartido':'Crear / unir transporte compartido'}</h2><p>Un transporte en calendario. Mercancía, entrega y facturación independientes para cada buque.</p></div><button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={close}><X/></button></header>
    <form onSubmit={save}><fieldset disabled={busy} className="shared-trip-fields">
      <div className="shared-trip-notice">Para unir duplicados, selecciona el expediente y su transporte existente en cada parada. Se conservan los identificadores, documentos y precios. El horario y conductor de este formulario se aplican a todo el viaje.</div>
      <div className="shared-trip-grid">
        <label className="field"><span>Fecha del viaje</span><input type="date" value={form.fecha} onChange={e=>change('fecha',e.target.value)}/></label>
        <label className="field"><span>Hora inicio</span><input type="time" value={form.inicio} onChange={e=>change('inicio',e.target.value)}/></label>
        <label className="field"><span>Hora fin</span><input type="time" value={form.fin} onChange={e=>change('fin',e.target.value)}/></label>
        <label className="field"><span>Conductor / transportista del viaje</span><TransportAssigneeSelect driver={form.asignado} providerId={form.proveedorId} team={team} providers={providers} onChange={assignment=>setForm(f=>({...f,...assignment}))}/></label>
        <label className="field"><span>Vehículo / matrícula</span><input value={form.vehiculo} onChange={e=>change('vehiculo',e.target.value)}/></label>
      </div>
      <h3>Entregas del viaje · orden de las paradas</h3>
      {form.stops.map((stop,index)=>{const current=transports.find(t=>t.id===stop.transportId);return <article className="shared-trip-stop" key={index} data-trip-stop={index}>
        <header><b>Parada {index+1}</b>{!form.id&&form.stops.length>1&&<button type="button" className="button tertiary" onClick={()=>change('stops',form.stops.filter((_,i)=>i!==index))}>Quitar parada</button>}{openCase&&stop.expediente&&<button type="button" className="button tertiary" onClick={()=>openCase(stop.expediente)}>Ver expediente</button>}</header>
        <div className="shared-trip-grid">
          <label className="field"><span>Expediente / buque</span><select value={stop.expediente} required disabled={Boolean(form.id&&current)} onChange={e=>chooseCase(index,e.target.value)}><option value="">Seleccionar expediente</option>{cases.filter(c=>c.id===stop.expediente||!form.stops.some(s=>s.expediente===c.id)).map(c=><option key={c.id} value={c.id}>{c.id} · {c.buque} · {c.cliente}</option>)}</select></label>
          <label className="field"><span>Servicio a vincular</span><select value={stop.transportId} disabled={Boolean(form.id&&current)} onChange={e=>chooseTransport(index,e.target.value)}><option value="">Crear servicio en este expediente</option>{transports.filter(t=>t.expediente===stop.expediente&&(!t.sharedTripId||t.sharedTripId===form.id)).map(t=><option key={t.id} value={t.id}>{t.id} · {t.fecha||'Sin fecha'} {t.inicio} · {t.origen} → {t.destino}</option>)}</select></label>
          <label className="field"><span>Recogida de esta mercancía</span><input value={stop.origen} required onChange={e=>stopChange(index,{origen:e.target.value})}/></label>
          <label className="field"><span>Entrega / parada</span><input value={stop.destino} required onChange={e=>stopChange(index,{destino:e.target.value})}/></label>
          <label className="field"><span>Mercancía de este buque</span><textarea value={stop.cargo} onChange={e=>stopChange(index,{cargo:e.target.value})} placeholder="Ej. 2 cajas · 80 kg · referencias"/></label>
          <label className="field"><span>Instrucciones de esta entrega</span><textarea value={stop.observacion} onChange={e=>stopChange(index,{observacion:e.target.value})}/></label>
        </div>
        <TransportWaitingFields value={stop.waiting} onChange={waiting=>stopChange(index,{waiting})}/>
        {current&&<small>Se conservan la mercancía seleccionada, el estado de entrega y los documentos ya registrados. {current.estado==='Cancelado'?'Esta entrega está cancelada.':''}</small>}
      </article>})}
      <button type="button" className="button secondary" disabled={form.stops.length>=20} onClick={()=>change('stops',[...form.stops,{expediente:'',transportId:'',origen:form.stops[0]?.origen||'ALMACÉN SWIFTPORT',destino:'',cargo:'',costShare:'',observacion:''}])}><Plus/> Añadir buque / expediente</button>
      <section className="shared-trip-cost"><h3>Coste real del viaje (opcional)</h3><p>El coste se registra una sola vez y se reparte entre los expedientes. No modifica ni divide los precios de venta. Si el gasto ya está registrado en Gastos operativos, déjalo vacío para no duplicarlo.</p>
        <div className="shared-trip-grid"><label className="field"><span>Coste total EUR</span><input type="number" min="0" step="0.01" value={form.cost??''} onChange={e=>change('cost',e.target.value)}/></label><label className="field"><span>Proveedor del gasto</span><input value={form.costProvider} onChange={e=>change('costProvider',e.target.value)}/></label><label className="field"><span>Reparto del coste</span><select value={form.costMode} onChange={e=>change('costMode',e.target.value)}><option value="equal">A partes iguales</option><option value="manual">Importes manuales</option></select></label></div>
        {form.cost!==''&&form.cost!==null&&form.stops.map((s,i)=><label className="shared-trip-share" key={i}><span>{s.expediente||`Parada ${i+1}`}</span>{form.costMode==='manual'?<input aria-label={`Coste parada ${i+1}`} type="number" min="0" step="0.01" value={s.costShare??''} onChange={e=>stopChange(i,{costShare:e.target.value})}/>:<b>{shares?.[i]?.toFixed(2)||'—'} €</b>}</label>)}
        {costError&&<p role="alert">{costError}</p>}
      </section>
      <p className="shared-trip-notice"><Truck size={18}/> Cada buque se factura desde su propio expediente, con su tarifa o precio manual. Las facturas emitidas no se modifican.</p>
      {error&&<div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button tertiary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy||form.stops.length<2}><Save/>{busy?'Guardando…':'Guardar viaje compartido'}</button></div>
    </fieldset></form>
  </section></div>;
}

export function SharedTripDeliveries({event,cases,onSelect,onClose}){
  return <div className="modal-backdrop"><section className="modal shared-trip-modal" role="dialog" aria-label="Entregas del viaje compartido"><header className="modal-head"><div><h2>Entregas del viaje compartido</h2><p>Abre cada buque para consultar su mercancía y registrar sus fotos y POD por separado.</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X/></button></header><div className="shared-trip-fields">{tripStops(event).map((stop,i)=><article className="shared-trip-stop" key={stop.id}><h3>{i+1}. {cases.find(c=>c.id===stop.expediente)?.buque||stop.expediente}</h3><p>{stop.origen} → {stop.destino}</p><p>{stop.sharedCargo}</p><button className="button primary" onClick={()=>onSelect(stop)}>Abrir entrega · {stop.expediente}</button></article>)}</div></section></div>;
}
