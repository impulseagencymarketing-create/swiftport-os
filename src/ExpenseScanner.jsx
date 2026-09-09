import React, {useMemo, useRef, useState} from 'react';
import {ScanLine, X, UploadCloud, Save, Search, ExternalLink} from 'lucide-react';
import {cents, equalSplit, suggestCases} from './expenseMath.mjs';
import './expense-scanner.css';

const blank = {supplier:'', supplierTaxId:'', number:'', date:'', currency:'EUR', concept:'', net:'', tax:'', total:'', cost:'', notes:'', category:'Otros', vessels:[], references:[], warnings:[]};
const money = value => Number(value || 0).toLocaleString('es-ES', {style:'currency',currency:'EUR'});
export default function ExpenseScanner({cases, csrfToken, uploadAttachment, api, onSaved}) {
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(''), [error,setError] = useState('');
  const [attachment,setAttachment] = useState(null), [invoice,setInvoice] = useState(blank);
  const [allocations,setAllocations] = useState([]), [mode,setMode] = useState('equal');
  const [search,setSearch] = useState(''), [confirmed,setConfirmed] = useState(false), [saved,setSaved] = useState(false);
  const lock = useRef(false);
  const suggestions = useMemo(() => suggestCases(invoice,cases), [invoice,cases]);
  const rows = mode === 'equal' ? equalSplit(invoice.cost, allocations.map(row=>row.caseRef)) : allocations;
  const total = cents(invoice.cost), assigned = rows.reduce((sum,row)=>sum+(cents(row.amount)??0),0);
  const valid = attachment && invoice.supplier.trim() && invoice.number.trim() && invoice.date && invoice.concept.trim() && invoice.currency === 'EUR' && total !== null && total !== 0 && rows.length && rows.every(row=>cents(row.amount)!==null && cents(row.amount)!==0 && Math.sign(cents(row.amount))===Math.sign(total)) && assigned === total && confirmed;
  const update = (field,value) => {setInvoice(current=>({...current,[field]:value}));setConfirmed(false)};
  const request = data => api('/api/expense-import.php',{method:'POST',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify(data)});
  async function scan(stored) {
    const result = await request({action:'scan',attachmentId:stored.id});
    const data = {...blank,...result.invoice,cost:result.invoice.net || ''};
    setInvoice(data); setConfirmed(false);
    const matches = suggestCases(data,cases);
    // Only unique explicit case/PO references are preselected. Vessel-only matches remain suggestions.
    const unique = matches.filter(row=>row.score>=80);
    setAllocations(unique.length===1 ? [{caseRef:unique[0].item.id,amount:data.cost}] : []);
  }
  async function receive(file) {
    if (!file || lock.current) return;
    lock.current=true; setBusy('Guardando original y leyendo factura…'); setError('');setSaved(false);setAttachment(null);setInvoice({...blank});setAllocations([]);setConfirmed(false);setMode('equal');setSearch('');
    try {const stored=await uploadAttachment(file,'document',csrfToken);setAttachment(stored);await scan(stored)}
    catch(reason){setError(reason.message)}finally{lock.current=false;setBusy('')}
  }
  async function retry() {
    if(lock.current||!attachment)return;lock.current=true;setBusy('Leyendo factura…');setError('');
    try{await scan(attachment)}catch(reason){setError(reason.message)}finally{lock.current=false;setBusy('')}
  }
  function toggle(id) {
    setConfirmed(false);
    setAllocations(current=>current.some(row=>row.caseRef===id)?current.filter(row=>row.caseRef!==id):[...current,{caseRef:id,amount:'0.00'}]);
  }
  async function save() {
    if(lock.current||!valid)return;lock.current=true;setBusy('Registrando el reparto…');setError('');
    try {const result=await request({action:'save',attachmentId:attachment.id,invoice,allocations:rows,confirmed:true});setSaved(true);onSaved(result.cases);}
    catch(reason){setError(reason.message)}finally{lock.current=false;setBusy('')}
  }
  const visible=cases.filter(item=>[item.id,item.buque,item.cliente,item.purchaseOrder].join(' ').toLowerCase().includes(search.toLowerCase()));
  const close=()=>{if(!busy)setOpen(false)};
  return <>
    <button className="button primary" onClick={()=>{if(saved){setSaved(false);setAttachment(null);setInvoice({...blank});setAllocations([]);setError('');setConfirmed(false)}setOpen(true)}}><ScanLine/> Escanear factura de gasto</button>
    {open&&<div className="modal-backdrop expense-scan-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
      <section className="expense-scan-modal" role="dialog" aria-modal="true" aria-label="Escáner de facturas de gasto">
        <header><div><span className="overline">Gastos operativos</span><h2>Escanear y repartir factura</h2><p>Factura de proveedor → revisión → gasto en cada expediente.</p></div><button disabled={Boolean(busy)} className="icon-button" onClick={close} aria-label="Cerrar"><X/></button></header>
        {saved?<div className="expense-scan-body"><h3>Factura registrada correctamente</h3><p>Se ha añadido una parte del gasto a cada uno de los {rows.length} expedientes seleccionados, con su justificante.</p><button className="button primary" onClick={close}>Volver a gastos</button></div>:<>
          <div className="expense-scan-body">
            <label className="button secondary"><UploadCloud/> {busy||'Subir factura o fotografiar ticket'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={event=>{receive(event.target.files?.[0]);event.target.value=''}}/></label>
            <p className="expense-scan-hint">PDF, JPG, PNG o WEBP. Original hasta 50 MB; lectura automática hasta 20 MB con la IA de Swiftport. Revisa siempre importes y destino antes de registrar.</p>
            {attachment&&<div className="expense-scan-original"><a href={attachment.url} target="_blank" rel="noreferrer">Ver original: {attachment.name} <ExternalLink size={14}/></a><button type="button" className="button tertiary" onClick={retry} disabled={Boolean(busy)}>Reintentar lectura</button></div>}
            {error&&<p className="form-error" role="alert">{error}</p>}
            {(invoice.warnings||[]).map((warning,index)=><p className="form-error" key={index}>{warning}</p>)}
            {attachment&&<fieldset disabled={Boolean(busy)}>
              <legend>1. Revisa los datos de la factura</legend>
              <div className="expense-scan-fields">{[['supplier','Proveedor'],['supplierTaxId','NIF / VAT proveedor'],['number','Número de factura'],['date','Fecha'],['currency','Moneda'],['net','Base neta'],['tax','Impuestos'],['total','Total factura'],['cost','Coste a repartir (€)']].map(([field,label])=><label className="field" key={field}><span>{label}</span><input type={field==='date'?'date':'text'} inputMode={['net','tax','total','cost'].includes(field)?'decimal':undefined} value={invoice[field]} onChange={event=>update(field,event.target.value)}/></label>)}</div>
              <p className="expense-scan-hint">El coste se propone a partir de la base neta. Ajusta el importe si corresponde incluir impuestos; conserva base, impuestos y total del documento por separado. Los abonos admiten importes negativos.</p>
              <label className="field"><span>Concepto del gasto</span><input value={invoice.concept} onChange={event=>update('concept',event.target.value)}/></label>
              <label className="field"><span>Notas de revisión / cambio de moneda</span><textarea rows="2" value={invoice.notes} onChange={event=>update('notes',event.target.value)}/></label>
              <h3>2. Selecciona los expedientes</h3>
              <div className="expense-scan-suggestions">{suggestions.length?suggestions.map(({item,reasons})=><button type="button" className="button secondary" key={item.id} onClick={()=>toggle(item.id)}>{allocations.some(row=>row.caseRef===item.id)?'✓ ':''}{item.id} · {item.buque}<small>{reasons.join(' · ')} · {item.puerto} · {item.eta}</small></button>):<p>No hay coincidencias claras. Busca y selecciona los expedientes manualmente.</p>}</div>
              <p className="expense-scan-hint">Un mismo buque puede tener varias operativas. Comprueba PO, puerto y fecha; las coincidencias por nombre no se seleccionan automáticamente.</p>
              <label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar buque, expediente, cliente o PO"/></label>
              <div className="expense-scan-cases">{visible.map(item=><label key={item.id}><input type="checkbox" checked={allocations.some(row=>row.caseRef===item.id)} onChange={()=>toggle(item.id)}/><span><b>{item.id} · {item.buque}</b><small>{item.cliente} · {item.puerto} · {item.eta} · {item.estado}{item.purchaseOrder?' · PO '+item.purchaseOrder:''}</small></span></label>)}</div>
              <h3>3. Comprueba el reparto</h3>
              <label className="field"><span>Modo de reparto</span><select value={mode} onChange={event=>{setAllocations(rows);setMode(event.target.value);setConfirmed(false)}}><option value="equal">A partes iguales entre los expedientes</option><option value="manual">Importe manual por expediente</option></select></label>
              <div className="expense-scan-split">{rows.map(row=><label className="field" key={row.caseRef}><span>{row.caseRef} · {cases.find(item=>item.id===row.caseRef)?.buque}</span><input type="text" inputMode="decimal" value={row.amount} readOnly={mode==='equal'} onChange={event=>{const value=event.target.value.replace(',','.');setAllocations(current=>current.map(entry=>entry.caseRef===row.caseRef?{...entry,amount:value}:entry));setConfirmed(false)}}/></label>)}</div>
              <p className={assigned!==total?'form-error':'expense-scan-hint'}>Asignado: {money(assigned/100)} · Coste: {money((total||0)/100)} · Diferencia: {money(((total||0)-assigned)/100)}</p>
              <label className="expense-scan-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> He revisado la factura, los expedientes y los importes. Registrar el gasto repartido.</label>
            </fieldset>}
          </div>
          <footer><button className="button tertiary" disabled={Boolean(busy)} onClick={close}>Cerrar</button><button className="button primary" disabled={!valid||Boolean(busy)} onClick={save}><Save/> {busy||`Registrar en ${rows.length} expediente(s)`}</button></footer>
        </>}
      </section>
    </div>}
  </>;
}
