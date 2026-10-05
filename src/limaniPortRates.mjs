// Local sources: RATES 2026 - SWIFTPORT LOGISTIC - LIMANI BARCELONA / VALENCIA / A CORUÑA.
// Interport sources: 2026 - TARIFAS PUERTOS CERCA DE BARCELONA.
const tiers=[35,250,500,2500];
export const LIMANI_LOCAL_RATES={
  reception:[[35,15],[250,60],[500,130],[2500,235]],
  airportToWarehouse:[[35,60],[250,140],[500,250],[2500,350]],
  warehouseToVessel:[[35,40],[250,70],[500,210],[2500,350]],
  storage:[[Infinity,0]],
  waitingHour:30,
  handlingHour:25,
  overtimeSurcharge:0.3
};
export const LIMANI_PORT_RATES={
  BARCELONA:[40,70,210,350],
  VALENCIA:[40,70,210,350],
  'A CORUNA':[40,70,210,350],
  TARRAGONA:[350,370,400,450],
  PALAMOS:[360,380,410,460],
  ALCANAR:[520,540,580,650]
};
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/\s+/g,' ');
export const portKey=value=>{
  const key=normalize(value).replace(/^(?:PUERTO DE|PORT DE|PORT OF|PUERTO|PORT)\s+/,'');
  return /^(?:LA )?CORUNA$/.test(key)?'A CORUNA':key;
};
const localPorts=['BARCELONA','VALENCIA','A CORUNA'];
const originCity=origin=>{
  const value=normalize(origin);
  if(/\b(?:BARCELONA|EL PRAT)\b/.test(value))return 'BARCELONA';
  if(/\bVALENCIA\b/.test(value))return 'VALENCIA';
  if(/\bCORUNA\b/.test(value))return 'A CORUNA';
  return null;
};
export function quoteLimaniTransport({port,weight,origins=[]}){
  const key=portKey(port);
  const local=localPorts.includes(key);
  const city=local?key:'BARCELONA';
  const base={port:key||'Puerto pendiente',origin:`Almacén de ${city==='A CORUNA'?'A Coruña':city.charAt(0)+city.slice(1).toLowerCase()}`,weight:Number(weight),price:null,status:'missing'};
  const missing=message=>({...base,message});
  if(!LIMANI_PORT_RATES[key])return missing(`Sin tarifa de transporte para ${key||'este puerto'}. Introduce y revisa un precio manual.`);
  // An unspecified route uses the local tariff scope displayed in the quote.
  // A recorded origin must match that scope, never a different city's local rate.
  const wrongOrigin=origins.filter(Boolean).some(origin=>{
    const knownCity=originCity(origin);
    if(knownCity)return knownCity!==city;
    return !/^ALMACEN(?: SWIFTPORT)?$/.test(normalize(origin));
  });
  if(wrongOrigin)return missing(`Esta tarifa solo cubre salidas de ${base.origin.toLowerCase()}. El origen registrado no coincide o no se puede identificar. Revisa la ruta y acuerda el precio.`);
  if(!Number.isFinite(base.weight)||base.weight<=0)return missing('Falta un peso válido para seleccionar la tarifa de transporte.');
  if(base.weight>2500)return missing('Peso superior a 2.500 kg: fuera de tabla. Solicita una tarifa específica.');
  const index=tiers.findIndex(limit=>base.weight<=limit);
  return {...base,status:'available',price:LIMANI_PORT_RATES[key][index],maxKg:tiers[index],source:local?`LIMANI · ${key==='A CORUNA'?'A Coruña':key} local 2026`:'LIMANI · Puertos cerca de Barcelona 2026',message:''};
}
export function isPortTransportLine(line){
  const name=normalize(line?.item);
  return !/^(?:cancel-|auto-overtime:)/i.test(String(line?.id||'')) &&
    !/AIRPORT|AEROPUERTO|FROM AGP|FROM SVQ/.test(name) &&
    /^(?:TRANSPORT(?:E)?\b|DELIVERY\s+VESSEL\b|ENTREGA\s+(?:A\s+)?BUQUE\b)/.test(name);
}
export function applyPortRate(line,quote){
  if(quote.status!=='available'||!isPortTransportLine(line))return line;
  return {...line,price:quote.price,portTariff:{port:quote.port,origin:quote.origin,weight:quote.weight,price:quote.price,source:quote.source}};
}
