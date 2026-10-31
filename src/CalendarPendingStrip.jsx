import React from 'react';
import {CalendarClock} from 'lucide-react';
import './calendar-pending.css';

export default function CalendarPendingStrip({events,renderEvent}){
  return <section className="calendar-pending-strip panel" aria-label="Pendientes de fecha y horario">
    <header><CalendarClock size={23}/><div><h3>Pendientes de fecha y horario <span>{events.length}</span></h3><p>Siempre visibles, independientemente del día, semana o mes. Al confirmar fecha y hora pasan al calendario.</p></div></header>
    {events.length?<div className="calendar-pending-cards" tabIndex={0} aria-label="Servicios pendientes de programar">{events.map(renderEvent)}</div>:<p className="calendar-pending-empty">No hay servicios pendientes de programar.</p>}
  </section>;
}
