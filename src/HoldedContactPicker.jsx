import React,{useEffect,useRef,useState} from 'react';
import './holded-contact-picker.css';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function HoldedContactPicker({invoice,selection,onChange,api,disabled=false}){
  const [contacts,setContacts]=useState(null);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
  const load=async()=>{
    setLoading(true);setError('');
    try{
      const result=await api('/api/holded/contacts.php');
      if(!Array.isArray(result.contacts))throw new Error('No se recibió la lista de contactos.');
      if(active.current)setContacts(result.contacts);
    }catch(reason){if(active.current)setError(reason.message||'No se pudo consultar Holded.')}
    finally{if(active.current)setLoading(false)}
  };
  const valid=selection?.invoiceId===invoice.id&&selection?.forClient===invoice.cliente;
  const tokens=normalize(query).trim().split(/\s+/).filter(Boolean);
  const matches=(contacts||[]).filter(contact=>tokens.every(token=>normalize([contact.name,contact.tradeName,contact.taxId,contact.id].join(' ')).includes(token)));
  return <section className="holded-contact-picker wide" aria-label="Destinatario de Holded">
    <b>Contacto existente de Holded</b>
    <p>Para clientes con varios contactos o un destinatario fiscal distinto por buque. La elección se guarda solo en este borrador; no cambia el cliente general ni crea contactos.</p>
    {selection?.id&&<div className="holded-contact-selected" role="status">
      <strong>{selection.name}</strong><span>NIF / VAT: {selection.taxId||'Sin NIF'} · ID: {selection.id}</span>
      {!valid&&<span role="alert">El cliente ha cambiado. Vuelve a elegir el destinatario antes de enviar.</span>}
      <button type="button" className="button tertiary compact" disabled={disabled} onClick={()=>onChange(null)}>Quitar selección y usar identificación automática</button>
    </div>}
    <button type="button" className="button secondary" disabled={disabled||loading} onClick={load}>{loading?'Consultando Holded…':contacts?'Actualizar contactos de Holded':'Buscar contacto en Holded'}</button>
    {error&&<p role="alert">{error} Puedes volver a intentarlo; el borrador no se ha enviado.</p>}
    {contacts&&<>
      <label className="field"><span>Buscar contacto por razón social, buque o NIF</span><input type="search" value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)} placeholder="Ej. Sivamar, GUBAL TRADER, UME o NIF"/></label>
      <label className="field"><span>Destinatario de la proforma</span><select disabled={disabled} value="" onChange={event=>{
        const contact=contacts.find(row=>row.id===event.target.value);
        if(contact)onChange({...contact,invoiceId:invoice.id,forClient:invoice.cliente});
      }}><option value="">Selecciona un contacto existente ({matches.length})</option>{matches.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.tradeName?' · '+contact.tradeName:''} · NIF: {contact.taxId||'Sin NIF'} · ID: {contact.id}</option>)}</select></label>
      {!matches.length&&<p>No hay coincidencias. Busca por razón social o NIF, no solo por el nombre comercial.</p>}
      <small>Revisa la razón social y el NIF antes de guardar y enviar. Este contacto sustituye los datos fiscales genéricos únicamente para esta proforma.</small>
    </>}
  </section>;
}
