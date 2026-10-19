import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/taxonomy.js';
const taxonomy=globalThis.ProductiondeckTaxonomy;
test('classification offers exactly 3 categories and 120 ordered, unique subcategories',()=>{
 assert.deepEqual(Object.values(taxonomy.labels),['Lokacion','Rekuizita','Kasting']);assert.equal(taxonomy.subcategories.length,120);assert.equal(new Set(taxonomy.subcategories).size,120);
 assert.deepEqual(taxonomy.subcategories.slice(0,16),['City','Village','Outdoors','Indoors','Exterior','Interior','Car','Bus','Truck','Apartment','Building','Corporate','Office','Field','Stadium','Medical']);
});
test('legacy classifications map when known and remain preserved when custom',()=>{
 assert.deepEqual(taxonomy.record({type:'location',category:'Apartment',tags:['manual']}),{type:'location',category:'Lokacion',tags:['manual'],subcategories:['Apartment'],legacyCategory:'Apartment'});
 assert.deepEqual(taxonomy.fromItem({category:'Outdoor'}),['Outdoors']);
 const record=taxonomy.record({type:'prop',category:'Custom archive category',tags:['manual']});assert.equal(record.legacyCategory,'Custom archive category');assert.deepEqual(record.subcategories,[]);assert.deepEqual(record.tags,['manual']);
 assert.deepEqual(taxonomy.fromItem({category:'Apartment',subcategories:[]}),[]);assert.equal(taxonomy.canonical('  ｏｆｆｉｃｅ '),'Office');
});

test('Albanian labels share stable keys with English legacy selections and support accent-free search',()=>{
 assert.equal(Object.keys(taxonomy.subcategoryLabels).length,120);assert.equal(new Set(Object.values(taxonomy.subcategoryLabels)).size,120);
 for(const key of taxonomy.subcategories){assert.equal(taxonomy.canonical(taxonomy.label(key)),key)}
 assert.equal(taxonomy.label('Graffiti'),'Grafiti');assert.equal(taxonomy.label('Mural'),'Mural');assert.equal(taxonomy.canonical('Grafiti'),'Graffiti');assert(taxonomy.search('Abandoned Building','ndertese'));assert(taxonomy.search('Graffiti','graffiti'));
 assert.equal(taxonomy.fromItem({subcategories:taxonomy.subcategories.slice(0,12)}).length,10);
});
test('regional city list covers Kosovo municipalities, major Albanian cities and three North Macedonian cities',()=>{
 assert.equal(taxonomy.cityGroups[0].cities.length,38);assert.equal(taxonomy.cityGroups[1].cities.length,25);assert.deepEqual(taxonomy.cityGroups[2].cities,['Shkup','Tetovë','Kumanovë']);assert.equal(taxonomy.cities.length,new Set(taxonomy.cities).size);
 for(const city of taxonomy.cities)assert.equal(taxonomy.canonicalCity(city),city);
 for(const alias of ['Pristina','Prishtina','  prishtine  ','PRISHTINË'])assert.equal(taxonomy.canonicalCity(alias),'Prishtinë');
 assert.equal(taxonomy.canonicalCity('Tirana'),'Tiranë');assert.equal(taxonomy.canonicalCity('Skopje'),'Shkup');assert.equal(taxonomy.canonicalCity('Gjakova'),'Gjakovë');assert.equal(taxonomy.canonicalCity('Unknown City'),'');
 const old={type:'location',category:'Location',city:'Pristina'};assert.equal(taxonomy.record(old).city,'Prishtinë');assert.equal(old.city,'Pristina');assert.equal(taxonomy.record({...old,city:'Old area'}).city,'Old area');
});
