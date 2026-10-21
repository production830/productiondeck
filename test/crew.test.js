import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/taxonomy.js';
import '../public/crew-model.js';
const model=ProductiondeckCrew;
const person=()=>({...model.fresh(),firstName:'Arbër',lastName:'Çela',roles:['dp']});
test('crew directory has ten roles and supports deduplicated custom roles and standardized cities',()=>{
 assert.equal(Object.keys(model.roles).length,10);const data=model.validate({...person(),roles:['camera_operator','camera_operator'],customRoles:['DIT','dit','  Director of Photography  '],city:'Pristina',email:' TEST@EXAMPLE.TV '});assert.deepEqual(data.roles,['camera_operator','dp']);assert.deepEqual(data.customRoles,['DIT']);assert.equal(data.city,'Prishtinë');assert.equal(data.email,'test@example.tv');assert.deepEqual(model.labels(data),['Operator kamere','Drejtor fotografie (DP)','DIT']);
 const custom=model.validate({...person(),roles:[],customRoles:['Montazhier']});assert.deepEqual(custom.customRoles,['Montazhier']);
});
test('crew validation requires names and a role, rejects invalid values and makes only safe phone links',()=>{
 for(const patch of [{firstName:''},{lastName:''},{roles:[],customRoles:[]},{roles:['__proto__']},{roles:['unknown']},{customRoles:[42]},{customRoles:['a'.repeat(81)]},{customRoles:['a','b','c','d','e','f']},{city:'New typo'},{email:'bad'},{workedBefore:'maybe'}])assert.throws(()=>model.validate({...person(),...patch}));
 assert.equal(model.phoneLink('+383 (0)44-123-456'),'tel:+383044123456');assert.equal(model.phoneLink('javascript:alert(1)'),'');assert.equal(model.phoneLink('---'),'');assert.equal(model.phoneLink('Ask agent'),'');assert.equal(model.fold('ÇELA'),'cela');
});
