import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWristVat,WRIST_OLD_EXEMPTION} from '../src/wristVat.mjs';
import {buildInvoiceGroup,groupTaxTotal} from '../src/invoiceGrouping.mjs';
test('WRIST applies 21% to pending manual lines without changing base prices or quantities',()=>{
 const invoice={cliente:'Wrist Ship Supply',estado:'Borrador',manualEdited:true,importe:250,observaciones:WRIST_OLD_EXEMPTION+'\n\nDelivery 22/10/2026',lines:[{price:100,units:1,tax:'0%'},{price:75,units:2,tax:'Exenta'}]};
 const result=applyWristVat(invoice);
 assert.equal(groupTaxTotal(result),52.5);assert.equal(result.importe,250);assert.equal(result.lines[1].price,75);assert.equal(result.lines[1].units,2);
 assert.equal(result.observaciones,'Delivery 22/10/2026');assert.equal(result.manualEdited,true);assert.equal(applyWristVat(result),result);
});
test('issued documents, original grouped sources and other clients are untouched',()=>{
 const row={cliente:'WRIST',estado:'Borrador',lines:[{price:100,units:1,tax:'0%'}]};
 for(const patch of [{estado:'Facturado'},{estado:'Enviado a Holded'},{estado:'Archivado'},{holdedId:'existing'},{groupedInto:'GRP-old'},{cliente:'Limani'}]){const invoice={...row,...patch};assert.equal(applyWristVat(invoice),invoice)}
});
test('new grouped WRIST draft taxes all original services at 21 percent',()=>{
 const sources=[1,2].map(n=>({id:'BOR-'+n,expediente:'SW-'+n,cliente:'WRIST',estado:'Borrador',lines:[{item:'TRANSPORT',price:100,units:1,tax:'0%'}],observaciones:WRIST_OLD_EXEMPTION}));
 const group=buildInvoiceGroup(sources,'GRP-NEW');assert.equal(group.importe,200);assert.equal(groupTaxTotal(group),42);assert.ok(group.lines.every(line=>line.tax==='21%'));assert.ok(!group.observaciones.includes('Exención'));assert.equal(sources[0].lines[0].tax,'0%');
});
