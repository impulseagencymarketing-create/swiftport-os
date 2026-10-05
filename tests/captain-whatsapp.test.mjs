import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('captain WhatsApp links always prefill English and retain the vessel name',()=>{
  const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  const expression=source.match(/const whatsapp=contact=>(.*?);return <div className="captain-directory"/);
  assert.ok(expression,'Contact link builder exists');
  const linkFor=new Function('contact','digitsOnly',`return ${expression[1]};`);
  for(const vesselName of ['LIBERTY','SIRIOS CEMENT V','A&B #1']){
    const link=new URL(linkFor({phone:'+34 600 000 000',vesselName,language:'Español'},value=>value.replace(/\D/g,'')));
    assert.equal(link.origin,'https://wa.me');
    assert.equal(link.pathname,'/34600000000');
    assert.equal(link.searchParams.get('text'),`Hello Captain, this is Swiftport Logistics. We are contacting you regarding the vessel ${vesselName}.`);
    assert.equal([...link.searchParams.keys()].length,1);
  }
});
