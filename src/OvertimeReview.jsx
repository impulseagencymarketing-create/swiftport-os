import React from 'react';
import './overtime.css';
export default function OvertimeReview({invoice, onSchedule}) {
  const review=invoice.overtimeReview || [];
  if (!review.length) return null;
  return <section className="overtime-review wide">
    <h3>Overtime nocturno · 30 %</h3>
    <p>Franja 20:00–08:00, con 1 hora añadida al finalizar. Se aplica al precio completo del servicio afectado, no a toda la factura. Horas locales del servicio; comprueba el horario realizado antes de enviar.</p>
    {review.map(row=>{
      const line=invoice.lines.find(line=>line.id===row.lineId), schedule=line?.overtimeSchedule || {};
      return <article key={row.lineId || row.index}>
        <div><b>{row.item}</b><small className={row.unknown?'overtime-warning':''}>{row.unknown?row.reason:row.night?`OVERTIME +${row.surcharge.toFixed(2)} € · ${row.detail}`:`Sin overtime · ${row.detail}`}</small></div>
        <label className="field"><span>Horario del servicio</span><select value={schedule.mode || 'auto'} onChange={e=>onSchedule(row.lineId,{...schedule,mode:e.target.value})}><option value="auto">Del transporte / calendario</option><option value="manual">Indicar horario de esta línea</option></select></label>
        {schedule.mode==='manual'&&<div className="overtime-times"><label className="field"><span>Inicio</span><input type="time" value={schedule.inicio || ''} onChange={e=>onSchedule(row.lineId,{...schedule,inicio:e.target.value})}/></label><label className="field"><span>Fin (sin el margen)</span><input type="time" value={schedule.fin || ''} onChange={e=>onSchedule(row.lineId,{...schedule,fin:e.target.value})}/></label></div>}
      </article>;
    })}
    {invoice.lines.filter(line=>String(line.id).startsWith('auto-overtime:')).map(line=><div className="overtime-charge" key={line.id}><span><b>{line.item}</b><small>{line.detail}</small></span><strong>{Number(line.price).toFixed(2)} €</strong></div>)}
  </section>;
}
