import {prompts,chooseTags} from './ai-tags.js';
let classifier;
let busy=false;
self.onmessage=async({data:{id,photos}})=>{
 if(busy)return;busy=true;
 const send=(type,extra={})=>self.postMessage({id,type,...extra});
 try{
  if(!classifier){
   send('status',{message:'Downloading the AI model for this browser. First use can take a few minutes…'});
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js');
   env.allowLocalModels=false;env.useBrowserCache=true;
   env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
   classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{
    device:'wasm',dtype:'q8',progress_callback:event=>{
     if(event.status==='progress'&&Number.isFinite(event.progress))send('status',{message:'Downloading AI model: '+Math.round(event.progress)+'% of '+(event.file?.split('/').pop()||'file')+'…'});
    }
   });
  }
  const tags=new Set();
  for(let i=0;i<photos.length;i++){
   send('status',{message:'Analyzing photo '+(i+1)+' of '+photos.length+' on this computer…'});
   const predictions=await classifier(photos[i],prompts,{hypothesis_template:'A photograph of {}.'});
   for(const tag of chooseTags(predictions))tags.add(tag);
  }
  send('result',{tags:[...tags].slice(0,24),count:photos.length});
 }catch(error){classifier=null;send('error',{message:'AI could not finish. Check your connection and use a recent Chrome or Edge browser, then try again. You can still add tags manually.'});}
 finally{busy=false}
};
