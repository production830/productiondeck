import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assets,fetchVerifiedAsset} from '../scripts/vendor-ai.mjs';
const example={name:'test.js',sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'};
test('AI build rejects missing, changed or oversized assets before publishing',async()=>{
 await assert.rejects(fetchVerifiedAsset(example,async()=>new Response('no',{status:404})),/HTTP 404/);
 await assert.rejects(fetchVerifiedAsset(example,async()=>new Response('changed')),/checksum mismatch/);
 await assert.rejects(fetchVerifiedAsset(example,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(25*1024*1024+1)})),/hosting limit/);
});
test('AI build accepts verified bytes and only uses pinned HTTPS runtime downloads',async()=>{
 let url;const result=await fetchVerifiedAsset(example,async u=>{url=u;return new Response('abc')});
 assert.equal(new TextDecoder().decode(result),'abc');assert.equal(url,'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/test.js');
 assert.equal(assets.length,3);for(const asset of assets)assert.match(asset.sha256,/^[a-f0-9]{64}$/);
});
