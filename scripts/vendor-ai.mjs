// Download at deployment time, never in the user's browser. Keep versions and
// SHA-256 digests together so upstream changes cannot silently alter the app.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
export const assets=[
 {name:'transformers.min.js',sha256:'489ae9fa3deae4eed28f83b9f94a32342c63cffdabd56ad990f76d28c858a1c2'},
 {name:'ort-wasm-simd-threaded.jsep.mjs',sha256:'08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9'},
 {name:'ort-wasm-simd-threaded.jsep.wasm',sha256:'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39'}
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function fetchVerifiedAsset(asset,fetcher=fetch){
 const url='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/'+asset.name;
 const response=await fetcher(url,{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('AI asset download failed: '+asset.name+' (HTTP '+response.status+')');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength>25*1024*1024)throw Error('AI asset exceeds hosting limit: '+asset.name);
 if(hash(bytes)!==asset.sha256)throw Error('AI asset checksum mismatch: '+asset.name);
 return bytes;
}
export async function ensureAIAssets(){
 const directory=resolve(dirname(fileURLToPath(import.meta.url)),'../public/vendor/transformers-3.7.2');
 await mkdir(directory,{recursive:true});
 await Promise.all(assets.map(async asset=>{
  const path=resolve(directory,asset.name);let cached;try{cached=await readFile(path)}catch(error){if(error.code!=='ENOENT')throw error}
  if(cached&&hash(cached)===asset.sha256)return;
  const bytes=await fetchVerifiedAsset(asset);await writeFile(path+'.tmp',bytes);await rename(path+'.tmp',path);
 }));
 console.log('Verified 3 local AI runtime assets (Transformers.js 3.7.2).');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 ensureAIAssets().catch(error=>{console.error(error.message);process.exitCode=1});
}
