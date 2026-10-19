import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/taxonomy.js';
const taxonomy=globalThis.ProductiondeckTaxonomy;
test('classification offers exactly 3 categories and 90 ordered, unique subcategories',()=>{
 assert.deepEqual(Object.values(taxonomy.labels),['Location','Props','Casting']);assert.equal(taxonomy.subcategories.length,90);assert.equal(new Set(taxonomy.subcategories).size,90);
 assert.deepEqual(taxonomy.subcategories.slice(0,16),['City','Village','Outdoors','Indoors','Exterior','Interior','Car','Bus','Truck','Apartment','Building','Corporate','Office','Field','Stadium','Medical']);
});
test('legacy classifications map when known and remain preserved when custom',()=>{
 assert.deepEqual(taxonomy.record({type:'location',category:'Apartment',tags:['manual']}),{type:'location',category:'Location',tags:['manual'],subcategories:['Apartment'],legacyCategory:'Apartment'});
 assert.deepEqual(taxonomy.fromItem({category:'Outdoor'}),['Outdoors']);
 const record=taxonomy.record({type:'prop',category:'Custom archive category',tags:['manual']});assert.equal(record.legacyCategory,'Custom archive category');assert.deepEqual(record.subcategories,[]);assert.deepEqual(record.tags,['manual']);
 assert.deepEqual(taxonomy.fromItem({category:'Apartment',subcategories:[]}),[]);assert.equal(taxonomy.canonical('  ｏｆｆｉｃｅ '),'Office');
});
