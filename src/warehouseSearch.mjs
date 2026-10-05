const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function warehouseMatchesSearch(entry,query,relatedCase){
  const terms=normalized(query).split(' ').filter(Boolean);
  if(!terms.length)return true;
  const goods=Array.isArray(entry.mercancias)?entry.mercancias.filter(piece=>piece&&typeof piece==='object'):[];
  const text=normalized([
    entry.ref,entry.expediente,entry.buque,entry.zona,entry.entrada,entry.fechaRecepcion,
    entry.estado,entry.cliente,entry.tracking,entry.seguimiento,entry.descripcion,
    entry.observaciones,entry.peso,entry.bultos,entry.tipo,
    relatedCase?.buque,relatedCase?.cliente,relatedCase?.puerto,relatedCase?.purchaseOrder,
    ...goods.flatMap(piece=>[piece.tipo,piece.descripcion,piece.nombre,piece.seguimiento,piece.tracking,piece.cantidad,piece.peso])
  ].filter(value=>value!=null).join(' '));
  return terms.every(term=>text.includes(term));
}
