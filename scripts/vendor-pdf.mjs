// Self-hosted runtime: browsers never depend on a third-party script CDN.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
export const assets=[
 {name:'jspdf.umd.min.js',url:'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',sha256:'e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54'},
 {name:'NotoSans-Regular.ttf',url:'https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans/NotoSans-Regular.ttf',sha256:'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'}
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function ensurePDFAssets(){
 const directory=resolve(dirname(fileURLToPath(import.meta.url)),'../public/vendor/pdf');await mkdir(directory,{recursive:true});
 await Promise.all(assets.map(async asset=>{
  const path=resolve(directory,asset.name);let old;try{old=await readFile(path)}catch(error){if(error.code!=='ENOENT')throw error}
  if(old&&hash(old)===asset.sha256)return;
  const response=await fetch(asset.url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('PDF dependency download failed: '+asset.name+' (HTTP '+response.status+')');
  const bytes=new Uint8Array(await response.arrayBuffer());if(hash(bytes)!==asset.sha256)throw Error('PDF dependency checksum mismatch: '+asset.name);
  await writeFile(path+'.tmp',bytes);await rename(path+'.tmp',path);
 }));console.log('Verified self-hosted PDF runtime and Unicode font.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))ensurePDFAssets().catch(error=>{console.error(error.message);process.exitCode=1});
