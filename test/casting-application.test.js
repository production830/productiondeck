import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/taxonomy.js';
import '../public/casting-application-model.js';
import {jpegDimensions} from '../casting-intake.js';
const input=()=>({firstName:'Arbër',lastName:'Çela',phone:'+38344123456',email:'PERSON@EXAMPLE.TV',city:'Pristina',gender:'male',interests:['Actor'],languages:['Shqip'],skills:[],consent:true});
test('application fields normalize safely and public submissions cannot supply internal tags or approval fields',()=>{
 const data=ProductiondeckCastingApplication.validate({...input(),type:'casting',status:'approved',tags:['forged']});assert.equal(data.email,'person@example.tv');assert.equal(data.city,'Prishtinë');assert.deepEqual(data.tags,[]);assert.deepEqual(data.interests,[]);assert(!Object.hasOwn(data,'status'));assert(!Object.hasOwn(data,'type'));
 for(const patch of [{consent:false},{city:'New typo'},{gender:'invalid'},{showreel:'javascript:alert(1)'},{showreel:'http://example.test'},{email:'invalid'},{phone:'abc'},{languages:[42]}])assert.throws(()=>ProductiondeckCastingApplication.validate({...input(),...patch}));
 assert.deepEqual(ProductiondeckCastingApplication.validate({...input(),consent:false,tags:['internal']},{review:true}).tags,['internal']);assert.throws(()=>jpegDimensions(new Uint8Array([255,216,255,217])));
});

test('public applicants report past commercials without selecting future casting roles',()=>{
 const data=ProductiondeckCastingApplication.validate({...input(),interests:['Model'],previousCommercial:'yes',previousCommercialProjects:'Campaign for Client A',previousCommercialRole:'Figurant'});
 assert.deepEqual(data.interests,[]);assert.equal(data.previousCommercialProjects,'Campaign for Client A');assert.equal(data.previousCommercialRole,'Figurant');
 for(const patch of [{previousCommercial:'invalid'},{previousCommercial:'yes'},{previousCommercial:'yes',previousCommercialProjects:'Campaign'}])assert.throws(()=>ProductiondeckCastingApplication.validate({...input(),...patch}));
 const no=ProductiondeckCastingApplication.validate({...input(),previousCommercial:'no',previousCommercialProjects:'Stale draft',previousCommercialRole:'Stale role'});assert.equal(no.previousCommercialProjects,'');assert.equal(no.previousCommercialRole,'');
 assert.deepEqual(ProductiondeckCastingApplication.validate({...input(),interests:[]},{review:true}).interests,[]);assert.deepEqual(ProductiondeckCastingApplication.validate({...input(),interests:['Extra']},{review:true}).interests,['Extra']);assert.throws(()=>ProductiondeckCastingApplication.validate({...input(),interests:['Office']},{review:true}));
});

test('public casting applications require gender while historical unrecorded values remain reviewable',()=>{
 for(const gender of ['',undefined,null,'unknown'])assert.throws(()=>ProductiondeckCastingApplication.validate({...input(),gender}));
 for(const gender of ['male','female'])assert.equal(ProductiondeckCastingApplication.validate({...input(),gender}).gender,gender);
 assert.equal(ProductiondeckCastingApplication.validate({...input(),gender:''},{review:true}).gender,'');
});
