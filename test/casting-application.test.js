import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/taxonomy.js';
import '../public/casting-application-model.js';
import {jpegDimensions} from '../casting-intake.js';
const input=()=>({firstName:'Arbër',lastName:'Çela',phone:'+38344123456',email:'PERSON@EXAMPLE.TV',city:'Pristina',gender:'',interests:['Actor'],languages:['Shqip'],skills:[],consent:true});
test('application fields normalize safely and public submissions cannot supply internal tags or approval fields',()=>{
 const data=ProductiondeckCastingApplication.validate({...input(),type:'casting',status:'approved',tags:['forged']});assert.equal(data.email,'person@example.tv');assert.equal(data.city,'Prishtinë');assert.deepEqual(data.tags,[]);assert(!Object.hasOwn(data,'status'));assert(!Object.hasOwn(data,'type'));
 for(const patch of [{consent:false},{city:'New typo'},{gender:'invalid'},{interests:['Office']},{showreel:'javascript:alert(1)'},{showreel:'http://example.test'},{email:'invalid'},{phone:'abc'},{languages:[42]}])assert.throws(()=>ProductiondeckCastingApplication.validate({...input(),...patch}));
 assert.deepEqual(ProductiondeckCastingApplication.validate({...input(),consent:false,tags:['internal']},{review:true}).tags,['internal']);assert.throws(()=>jpegDimensions(new Uint8Array([255,216,255,217])));
});
