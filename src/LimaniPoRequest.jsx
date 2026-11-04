import React,{useState} from 'react';
import {missingLimaniPOs,limaniPoText} from './limaniPoMessage.mjs';
export default function LimaniPoRequest({invoices,cases,transports,calendarEvents,warehouseEntries,notify}) {
  const [message,setMessage]=useState(null);
  const rows=missingLimaniPOs(invoices,cases,transports,calendarEvents,warehouseEntries);
  const copy=async()=>{try{await navigator.clipboard.writeText(message);notify('Mensaje copiado para Limani')}catch{notify('No se pudo copiar. Selecciona el texto del mensaje y cópialo.')}};
  return <>
    <div className="invoice-group-toolbar"><p>LIMANI: {rows.length?`${rows.length} expediente(s) pendiente(s) de PO.`:'Todos los documentos pendientes tienen PO.'}</p><button type="button" className="button secondary" disabled={!rows.length} onClick={()=>setMessage(limaniPoText(rows))}>Pedir PO a Limani ({rows.length})</button></div>
    {message!==null&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setMessage(null)}}><section className="modal" role="dialog" aria-modal="true" aria-label="Pedir PO a Limani" style={{width:'min(720px,95vw)'}} onKeyDown={e=>{if(e.key==='Escape')setMessage(null)}}><div className="modal-head"><h2>Pedir PO a Limani</h2><button type="button" className="button tertiary" onClick={()=>setMessage(null)}>Cerrar</button></div><p>Revisa el mensaje. En WhatsApp podrás elegir el contacto o grupo de Limani.</p><label className="field wide"><span>Mensaje</span><textarea rows="15" autoFocus value={message} onChange={e=>setMessage(e.target.value)} style={{width:'100%',resize:'vertical'}}/></label><div className="modal-actions"><button type="button" className="button secondary" disabled={!message.trim()} onClick={copy}>Copiar mensaje</button>{message.trim()&&<a className="button primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}</div></section></div>}
  </>;
}
