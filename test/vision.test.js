import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/vision-core.js';
const vision=globalThis.ProductiondeckVisionCore;
test('dominant photo colours use pixels and ignore small colour accents and transparent pixels',()=>{
 const green=new Uint8ClampedArray(400);for(let i=0;i<400;i+=4)green.set([30,150,50,255],i);assert.deepEqual(vision.colorTags(green),['E gjelbër']);
 const image=[...green];for(let i=0;i<20;i+=4)image.splice(i,4,230,30,30,255);assert.deepEqual(vision.colorTags(image),['E gjelbër']);assert.deepEqual(vision.colorTags([255,0,0,0]),[]);const decor=[...Array.from({length:50},()=>[0,0,0,255]).flat(),...Array.from({length:30},()=>[255,255,255,255]).flat(),...Array.from({length:20},()=>[30,150,50,255]).flat()];assert(vision.colorTags(decor).includes('E gjelbër'));
});
test('automatic tags preserve manual spelling, deduplicate accents and case and respect the shared tag limit',()=>{
 assert.deepEqual(vision.merge(['Custom','E gjelbër'],['custom','e gjelber','Bar']),['Custom','E gjelbër','Bar']);assert.equal(vision.merge(Array.from({length:30},(_,i)=>'Manual '+i),['Extra']).length,30);
 const vector=new Float32Array(512);assert.deepEqual(vision.rank(vector,[]),[]);assert.throws(()=>vision.decodeLabels({labels:[{}],vectors:''}));
});

test('automatic tag writes retry a concurrent edit and preserve its new notes and manual tags',async()=>{
 const {saveAutoTags}=await import('../auto-tags.js');let current={id:'test-id',data:{type:'location',title:'Bar',tags:['Original'],notes:'Old notes'}},writes=0;
 const rest=async(table,query,options)=>{if(table==='images')return [{id:'photo-1'}];if(!options)return [structuredClone(current)];writes++;if(writes===1){current.data.notes='Another editor saved this';current.data.tags.push('New manual tag');return []}current.data=options.data.data;return [structuredClone(current)]};
 const result=await saveAutoTags({request:{method:'POST'},p:'/api/items/test-id/auto-tags',body:async()=>({version:'clip-laion-v1',tags:['Bar']}),checkId:id=>id,rest,isDocument:()=>false});assert.equal(writes,2);assert.equal(current.data.notes,'Another editor saved this');assert.deepEqual(result.tags,['Original','New manual tag','Bar']);
});
