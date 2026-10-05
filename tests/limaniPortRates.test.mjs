import test from 'node:test';
import assert from 'node:assert/strict';
import {LIMANI_LOCAL_RATES,quoteLimaniTransport,applyPortRate,isPortTransportLine} from '../src/limaniPortRates.mjs';
test('all 12 PDF prices are mapped to their own port and weight tier',()=>{
  for(const [port,prices] of [['Tarragona',[350,370,400,450]],['Palamós',[360,380,410,460]],['Alcanar',[520,540,580,650]]]){
    [35,250,500,2500].forEach((weight,index)=>assert.equal(quoteLimaniTransport({port,weight}).price,prices[index]));
  }
});
test('boundary convention, decimals, accents and port prefixes',()=>{
  for(const [weight,price] of [[0.1,350],[35,350],[35.01,370],[250.01,400],[500.01,450]])assert.equal(quoteLimaniTransport({port:'Puerto de Tarragona',weight}).price,price);
  assert.equal(quoteLimaniTransport({port:' PALAMÓS ',weight:100}).price,380);
});

test('Vinaròs uses Alcanar prices at every tier without changing the destination',()=>{
  for(const port of ['Vinaròs','VINAROS','Vinaroz',' Puerto de Vinaròs ','Port de Vinaròs']){
    for(const weight of [1,35,35.01,250,250.01,500,500.01,2500]){
      const quote=quoteLimaniTransport({port,weight,origins:['Almacén Swiftport - Bluespace El Prat']});
      assert.equal(quote.price,quoteLimaniTransport({port:'Alcanar',weight}).price);
      assert.equal(quote.status,'available');
      assert.equal(quote.port,'VINAROS');
      assert.equal(quote.message,'');
      assert.match(quote.source,/Equivalencia confirmada/);
    }
  }
  assert.equal(quoteLimaniTransport({port:'Vinaròs',weight:100,origins:['Almacén Valencia']}).price,null);
  assert.equal(quoteLimaniTransport({port:'Vinaròs',weight:2501}).price,null);
  assert.equal(quoteLimaniTransport({port:'Vinaròs',weight:0}).price,null);
  const manual={id:'transport',item:'TRANSPORT',price:123.45,units:1,detail:'Vinaròs'};
  const quote=quoteLimaniTransport({port:'Vinaròs',weight:100});
  assert.equal(manual.price,123.45);
  assert.equal(applyPortRate(manual,quote).price,540);
  assert.equal(manual.price,123.45);
});
test('Unknown ports and out-of-range weights have no price',()=>{
  for(const port of ['Sagunto','Castellón',''])assert.equal(quoteLimaniTransport({port,weight:100}).price,null);
  for(const weight of [0,-1,undefined,NaN,Infinity,2500.01])assert.equal(quoteLimaniTransport({port:'Tarragona',weight}).price,null);
});
test('non-Barcelona origin is not priced using this table',()=>{
  assert.equal(quoteLimaniTransport({port:'Alcanar',weight:100,origins:['Almacén Valencia']}).price,null);
  assert.equal(quoteLimaniTransport({port:'Alcanar',weight:100,origins:['ALMACÉN SWIFTPORT - Bluespace El Prat']}).price,540);
});
test('updated Barcelona rates used, applying a quote changes only the selected price',()=>{
  assert.equal(quoteLimaniTransport({port:'Barcelona',weight:100}).price,70);
  const line={id:'transport',item:'TRANSPORT FROM WAREHOUSE TO VESSEL',price:123,units:2,detail:'Mercancía\nRuta',tax:'0%'};
  const result=applyPortRate(line,quoteLimaniTransport({port:'Tarragona',weight:100}));
  assert.equal(line.price,123);assert.equal(result.price,370);assert.equal(result.units,2);assert.equal(result.detail,line.detail);
  assert.equal(applyPortRate(line,quoteLimaniTransport({port:'Sagunto',weight:100})),line);
  assert.equal(isPortTransportLine({item:'TRANSPORT FROM AIRPORT TO WAREHOUSE'}),false);
});

test('latest local PDF tables cover Barcelona, Valencia and Coruña at every weight tier',()=>{
  for(const port of ['Barcelona','VALÈNCIA','A Coruña','La Coruña','Coruña']){
    [35,250,500,2500].forEach((weight,index)=>assert.equal(quoteLimaniTransport({port,weight}).price,[40,70,210,350][index]));
  }
  assert.deepEqual(LIMANI_LOCAL_RATES.reception.map(row=>row[1]),[15,60,130,235]);
  assert.deepEqual(LIMANI_LOCAL_RATES.airportToWarehouse.map(row=>row[1]),[60,140,250,350]);
  assert.equal(LIMANI_LOCAL_RATES.storage[0][1],0);
  assert.equal(LIMANI_LOCAL_RATES.waitingHour,30);
  assert.equal(LIMANI_LOCAL_RATES.handlingHour,25);
  assert.equal(LIMANI_LOCAL_RATES.overtimeSurcharge,0.3);
});
test('local tariffs cannot price a cross-city route or unidentified origin',()=>{
  for(const port of ['Valencia','A Coruña']){
    assert.equal(quoteLimaniTransport({port,weight:100,origins:['Almacén - Bluespace El Prat']}).price,null);
    assert.equal(quoteLimaniTransport({port,weight:100,origins:['Almacén '+port]}).price,70);
  }
  assert.equal(quoteLimaniTransport({port:'Barcelona',weight:100,origins:['Almacén Valencia']}).price,null);
  assert.equal(quoteLimaniTransport({port:'Valencia',weight:100,origins:['Proveedor desconocido']}).price,null);
});
