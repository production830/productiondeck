// Verified model/runtime assets are served by Productiondeck, never a browser CDN.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('public/vendor/vision/v1'),hash=b=>createHash('sha256').update(b).digest('hex');
const assets=[
 ['ort.min.js','https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js','be6e560b64c03c99252eedc0e1989e9e51e44d9f191e7655c9bf011bf9f576c8'],
 ['ort-wasm-simd-threaded.wasm','https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm-simd-threaded.wasm','207d02be4591c156b0a98f024f3d58005b5b04c92274d759fb390338c63559ea'],
 ['ort-wasm-simd-threaded.mjs','https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort-wasm-simd-threaded.mjs','745eb7c0ce6f18a6aa521971b2877babc7ffb27eecb58ab3bc6e5ef4692672e8']
];
await mkdir(root,{recursive:true});
for(const [name,url,sha] of assets){const path=resolve(root,name);let old;try{old=await readFile(path)}catch{}if(old&&hash(old)===sha)continue;const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Vision runtime download failed: '+name);const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==sha)throw Error('Vision checksum mismatch: '+name);await writeFile(path,bytes)}
const modelHash='a2fbb26b5f6ab5c79dd9bf99ab2dbac4711abc88dc2e20afc02a0827aa3d59c2',size=88521003,partSize=20*1024*1024,parts=Math.ceil(size/partSize);let complete=true;const old=[];
for(let i=0;i<parts;i++){try{old.push(await readFile(resolve(root,'visual-'+i+'.bin')))}catch{complete=false;break}}
if(!complete||hash(Buffer.concat(old))!==modelHash){const response=await fetch('https://raw.githubusercontent.com/slavabarkov/tidy/eb4aed45656909b72992c51f3f11ac663759b2e7/app/src/main/res/raw/visual_quant.onnx',{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Vision model download failed');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==size||hash(bytes)!==modelHash)throw Error('Vision model checksum mismatch');for(let i=0;i<parts;i++)await writeFile(resolve(root,'visual-'+i+'.bin'),bytes.subarray(i*partSize,(i+1)*partSize))}
const manifest={version:'clip-laion-v1',size,sha256:modelHash,parts:[]};for(let i=0;i<parts;i++){const name='visual-'+i+'.bin',bytes=await readFile(resolve(root,name));manifest.parts.push({name,size:bytes.length,sha256:hash(bytes)})}await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest));
console.log('Verified self-hosted vision model and browser runtime.');
