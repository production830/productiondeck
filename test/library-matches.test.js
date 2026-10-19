import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/library-matches.js';
const {findSimilar}=globalThis.ProductiondeckSimilarity;
const item=(id,extra={})=>({id,title:id,type:'location',tags:[],category:'',...extra});
test('related references exclude self, other asset types and records without matching metadata',()=>{
 const current=item('original',{tags:['industrial'],category:'Warehouse'});
 const records=[current,item('prop',{type:'prop',tags:['industrial'],category:'Warehouse'}),item('unrelated',{city:'Same City',setting:'Interior'}),item('matching',{tags:['industrial']})];
 assert.deepEqual(findSimilar(current,records).map(x=>x.item.id),['matching']);
 assert.deepEqual(findSimilar(item('blank'),[item('also-blank')]),[]);
});
test('shared visual tags rank ahead of a category-only match and provide reasons',()=>{
 const current=item('base',{tags:['warm light','minimal'],category:'Apartment'});
 const matches=findSimilar(current,[item('same-category',{category:'Apartment'}),item('one-tag',{tags:['minimal']}),item('two-tags',{tags:['warm light','minimal'],category:'Studio'})]);
 assert.deepEqual(matches.map(x=>x.item.id),['two-tags','one-tag','same-category']);
 assert.deepEqual(matches[0].sharedTags,['warm light','minimal']);assert.equal(matches[2].sameCategory,true);
});
test('case, whitespace, unicode and duplicate tags do not inflate the ranking',()=>{
 const current=item('base',{tags:[' Warm Light ','WARM LIGHT','ｍｉｎｉｍａｌ'],category:' Apartment '});
 const [match]=findSimilar(current,[item('candidate',{tags:['warm   light','minimal'],category:'apartment'})]);
 assert.equal(match.sharedTags.length,2);assert.equal(match.sameCategory,true);assert.equal(match.score,13);
});
test('prop recommendations remain props and missing metadata is handled safely',()=>{
 const current=item('chair',{type:'prop',category:'Furniture'});
 const matches=findSimilar(current,[item('room',{category:'Furniture'}),item('table',{type:'prop',category:'furniture',tags:null}),item('actor',{type:'casting',category:'Furniture'})]);
 assert.deepEqual(matches.map(x=>x.item.id),['table']);assert.deepEqual(findSimilar(null,[]),[]);assert.deepEqual(findSimilar({...current,type:'casting'},[current]),[]);
});
test('related results are deterministic, limited, and use no fallback unrelated records',()=>{
 const current=item('base',{tags:['wood']});const records=Array.from({length:9},(_,i)=>item('item-'+i,{tags:['wood']}));
 assert.equal(findSimilar(current,records).length,6);assert.equal(findSimilar(current,records,2).length,2);assert.equal(findSimilar(current,records,0).length,0);
 assert.deepEqual(findSimilar(current,records).map(x=>x.item.id),findSimilar(current,[...records].reverse()).map(x=>x.item.id));
});
