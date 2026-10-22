import React,{useState} from 'react';
import {groupEligible,groupSubtotal,groupTaxTotal} from './invoiceGrouping.mjs';
import './invoice-grouping.css';
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
export default function InvoiceGroupModal({invoices,onCreate,onClose}) {
  const [selected,setSelected]=useState([]),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const candidates=invoices.filter(groupEligible);
  const chosen=candidates.filter(row=>selected.includes(row.id));
  const client=chosen[0]?.cliente.trim().toLowerCase();
  const totals={lines:chosen.flatMap(row=>row.lines)};
  const visible=candidates.filter(row=>[row.expediente,row.buque,row.concepto,row.cliente].join(' ').toLowerCase().includes(search.toLowerCase()));
  const submit=async()=>{setBusy(true);setError('');try{await onCreate(chosen)}catch(reason){setError(reason.message)}finally{setBusy(false)}};
  return <div className="modal-backdrop"><section className="modal invoice-group-modal" role="dialog" aria-modal="true" aria-label="Unificar expedientes WRIST">
    <header className="modal-head"><div><h2>Unificar expedientes WRIST</h2><p>Una factura, con las líneas y referencias de cada expediente.</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar agrupación">×</button></header>
    <div className="invoice-group-body"><p>Solo borradores pendientes del mismo cliente. No se envía nada a Holded al unificar. Los originales quedan vinculados y no se pueden facturar por separado.</p>
      <label className="field"><span>Buscar expediente o buque</span><input value={search} onChange={event=>setSearch(event.target.value)} disabled={busy}/></label>
      <div className="invoice-group-list">{visible.map(row=><label key={row.id} className="invoice-group-choice"><input type="checkbox" aria-label={'Seleccionar '+row.expediente} checked={selected.includes(row.id)} disabled={busy||Boolean(client&&row.cliente.trim().toLowerCase()!==client)} onChange={event=>setSelected(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/><span><b>{row.expediente} · {row.buque||row.concepto}</b><small>{row.cliente} · {row.puerto} · {row.lines.length} líneas</small></span><strong>{money(groupSubtotal(row))}</strong></label>)}{!visible.length&&<p>No hay borradores de WRIST disponibles con este filtro.</p>}</div>
      {error&&<div className="form-error" role="alert">{error}</div>}
    </div><footer className="modal-actions"><span>{chosen.length} expedientes · Base <b>{money(groupSubtotal(totals))}</b><br/>Total con IVA <b>{money(groupSubtotal(totals)+groupTaxTotal(totals))}</b></span><button className="button tertiary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy||chosen.length<2} onClick={submit}>{busy?'Guardando…':'Crear factura conjunta'}</button></footer>
  </section></div>;
}
