import React from 'react';
import './transport-waiting.css';

export default function TransportWaitingFields({value={},onChange}){
  const update=(key,next)=>onChange({...value,[key]:next});
  return <section className="transport-waiting wide">
    <h3>Horas de espera para facturación</h3>
    <p>Registra solo la espera de este servicio / buque. En viajes compartidos no repitas la misma espera en todas las paradas.</p>
    <div className="waiting-fields">
      <label className="field"><span>Horas de espera</span><input type="number" min="0" max="1000" step="0.01" value={value.hours??''} onChange={e=>update('hours',e.target.value)} placeholder="Ej. 1,5"/><small>1,5 h = 1 hora y 30 minutos. No se redondea a horas completas.</small></label>
      <label className="field"><span>Precio de espera EUR / hora (opcional)</span><input type="number" min="0" max="1000000" step="0.01" value={value.rate??''} onChange={e=>update('rate',e.target.value)} placeholder="Revisar en facturación"/><small>Vacío: se propone la tarifa existente o se solicita un precio. 0: sin cargo.</small></label>
      <label className="field waiting-reason"><span>Motivo / lugar de la espera</span><textarea rows="2" value={value.reason||''} onChange={e=>update('reason',e.target.value)} placeholder="Ej. 1,5 horas esperando autorización en la terminal" maxLength="2000"/></label>
    </div>
  </section>;
}

export function WaitingInvoiceReview({invoice,pending,onReview}){
  const unresolved=(invoice.lines||[]).filter(l=>l.waitingRatePending);
  if(!pending.length&&!unresolved.length)return null;
  return <section className="transport-waiting waiting-review wide"><h3>Esperas de transportes · revisar antes de enviar</h3>
    <p>Los importes y conceptos guardados no se sustituyen. Comprueba que las esperas no estén ya incluidas en una línea manual.</p>
    {pending.map(p=><article key={p.key}><b>{p.line.sourceCaseRef} · {p.hours} h de espera</b><p className="waiting-detail">{p.line.detail}</p><small>{p.line.waitingRatePending?'Precio pendiente':`${p.line.price} EUR / hora · ${(p.line.price*p.hours).toFixed(2)} EUR`}</small><div className="waiting-actions"><button type="button" className="button secondary" onClick={()=>onReview(p,true)}>{p.hours?'Incorporar / actualizar esta espera':'Retirar espera de la factura'}</button><button type="button" className="button tertiary" onClick={()=>onReview(p,false)}>No facturar / ya incluida en otra línea</button></div></article>)}
    {unresolved.length>0&&<p role="alert">Indica el precio de las líneas WAITING TIME antes de enviar. Puedes introducir 0 si decides no cobrarlas.</p>}
  </section>;
}
