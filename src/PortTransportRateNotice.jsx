import React from 'react';
import {isPortTransportLine} from './limaniPortRates.mjs';
import './port-transport-rate.css';
export default function PortTransportRateNotice({quote,lines=[],onApply}){
  const targets=lines.map((line,index)=>({line,index})).filter(({line})=>isPortTransportLine(line));
  if(!quote||!targets.length)return null;
  const ready=quote.status==='available';
  return <div className={'port-transport-rate wide '+(ready?'available':'missing')} role="status">
    <b>{ready?`Tarifa LIMANI · ${quote.origin} → ${quote.port}`:'Revisar tarifa de transporte'}</b>
    <p>{ready?`${quote.weight.toLocaleString('es-ES')} kg · ${quote.price.toLocaleString('es-ES',{style:'currency',currency:'EUR'})} por transporte. ${quote.source}.`:quote.message}</p>
    <small>Los precios guardados o pactados manualmente se conservan. No se sustituyen automáticamente.</small>
    {ready&&onApply&&targets.map(({line,index})=><button type="button" className="button secondary compact" key={line.id||index} onClick={()=>onApply(index)}>Aplicar tarifa a {line.item}</button>)}
    {!ready&&<small>Antes de enviar a Holded, revisa el precio manual. Un importe pendiente no debe tratarse como transporte gratuito.</small>}
  </div>;
}
