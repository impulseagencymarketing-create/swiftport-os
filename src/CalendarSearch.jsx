import React,{useEffect,useState} from 'react';
import {Search,X,CalendarDays} from 'lucide-react';
import {emptyCalendarSearch,hasCalendarSearch,sortCalendarResults} from './calendarSearch.mjs';
import {validCalendarDate,calendarScheduleIncomplete} from './calendarPending.mjs';
import './calendar-search.css';

export default function CalendarSearch({filters,onChange,assignees,results,cases,statusOf,onOpen,onLocate,periodAvailable=false,mineOnly=false}){
  const [page,setPage]=useState(0),active=hasCalendarSearch(filters),pageSize=20;
  const ordered=sortCalendarResults(results),lastPage=Math.max(0,Math.ceil(ordered.length/pageSize)-1),current=Math.min(page,lastPage);
  useEffect(()=>setPage(0),[filters.query,filters.assignee,filters.status,filters.scope]);
  const change=(key,value)=>onChange({...filters,[key]:value});
  const byCase=new Map(cases.map(c=>[c.id,c]));
  return <section className="calendar-search panel" aria-label="Buscador del calendario">
    <div className="calendar-search-fields"><label className="field calendar-search-query"><span><Search size={15}/> Buscar buque o servicio</span><input type="search" value={filters.query} onChange={e=>change('query',e.target.value)} placeholder="Buque, expediente, ruta, puerto o persona…"/></label>
      <label className="field"><span>Persona / transportista</span><select value={filters.assignee} onChange={e=>change('assignee',e.target.value)}><option value="">Todas las personas y empresas</option>{assignees.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
      <label className="field"><span>Estado del servicio</span><select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">Todos los estados</option><option value="done">Realizados</option><option value="pending">Pendientes</option><option value="cancelled">Cancelados</option></select></label>
      {active&&<button type="button" className="button tertiary" onClick={()=>onChange(emptyCalendarSearch())}><X/> Limpiar búsqueda</button>}
    </div>
    {!active&&<p>Busca también servicios de otras semanas. Para revisar el trabajo realizado, selecciona una persona y el estado «Realizados».</p>}
    {active&&<><div className="calendar-search-summary"><div><h3>{results.length} servicio(s) encontrado(s)</h3><p>{filters.scope==='period'?'Resultados del periodo mostrado.':'Resultados de todas las fechas registradas, incluidos los servicios sin fecha.'}{mineOnly?' Filtro «Mis servicios» activo.':''} La cuadrícula y sus contadores muestran el periodo seleccionado con estos filtros.</p></div>{periodAvailable&&<label className="field"><span>Fechas de los resultados</span><select value={filters.scope} onChange={e=>change('scope',e.target.value)}><option value="all">Todas las fechas</option><option value="period">Día / semana / mes visible</option></select></label>}</div>
      <div className="calendar-search-results">{ordered.slice(current*pageSize,(current+1)*pageSize).map(e=>{const c=byCase.get(e.expediente)||{},status=statusOf(e);return <article key={e.id} data-search-event={e.id}><div className="calendar-search-date"><b>{validCalendarDate(e.fecha)?new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES'):'Fecha por confirmar'}</b><small>{calendarScheduleIncomplete(e)?'Horario por confirmar':[e.inicio,e.fin].filter(Boolean).join('–')}</small></div><div className="calendar-search-detail"><h4>{c.buque||e.titulo||'Servicio sin buque'}</h4><span>{e.tipoServicio||'Transporte'} · {c.puerto||e.puerto||'Puerto sin indicar'} · {e.expediente||'Sin expediente'}</span><p>{[e.origen,e.destino].filter(Boolean).join(' → ')||e.ruta||e.titulo}</p><b>{e.asignado||'Sin asignar'}</b></div><div className="calendar-search-result-actions"><span className={'calendar-search-status '+status.className}>{status.label}</span><button type="button" className="button secondary" onClick={()=>onOpen(e)}>Ver servicio</button>{onLocate&&validCalendarDate(e.fecha)&&!calendarScheduleIncomplete(e)&&<button type="button" className="button tertiary" onClick={()=>onLocate(e)}><CalendarDays/> Ver en calendario</button>}</div></article>})}</div>
      {!results.length&&<p role="status">No hay servicios que coincidan. Prueba otra persona, otro estado o busca en todas las fechas.</p>}
      {lastPage>0&&<nav className="calendar-search-pagination" aria-label="Páginas de resultados"><button className="button tertiary" disabled={current===0} onClick={()=>setPage(current-1)}>Resultados anteriores</button><span>{current+1} / {lastPage+1}</span><button className="button tertiary" disabled={current===lastPage} onClick={()=>setPage(current+1)}>Más resultados</button></nav>}
    </>}
  </section>;
}
