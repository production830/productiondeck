// Lazy browser-only AI. Photos go to a local worker, never to a remote AI API.
(()=>{
 let worker=null,run=0,active=false,settings,timer;
 const $=s=>document.querySelector(s),form=()=>$('#item-form');
 const status=message=>{$('#ai-status').textContent=message};
 function report(data){status(data.message);$('#ai-error-code').textContent='Error: '+data.code+' · Step: '+data.stage;$('#ai-error-detail').textContent=data.detail;$('#ai-error-details').hidden=false}
 function stop(){run++;active=false;clearTimeout(timer);worker?.terminate();worker=null;$('#ai-suggest').disabled=false;$('#ai-suggest').textContent='✧ Suggest tags with AI'}
 function reset(){if(!$('#ai-tagging'))return;stop();$('#ai-results').hidden=true;$('#ai-choices').replaceChildren();status('');$('#ai-error-details').hidden=true;$('#ai-error-details').open=false;$('#ai-tagging').hidden=form().elements.type.value!=='location'}
 function finish(){active=false;clearTimeout(timer);$('#ai-suggest').disabled=false;$('#ai-suggest').textContent='✧ Suggest tags with AI'}
 function selected(){return [...$('#ai-choices').querySelectorAll('input:checked')].map(x=>x.value)}
 async function suggest(){
  if(active||form().elements.type.value!=='location')return;
  const files=[...form().elements.photos.files],saved=settings.getSavedPhotos();
  $('#ai-results').hidden=true;$('#ai-error-details').hidden=true;$('#ai-error-details').open=false;$('#ai-choices').replaceChildren();
  if(!files.length&&!saved.length){status('Choose at least one location photo below, then click Suggest tags with AI.');return}
  if(!window.Worker||!window.WebAssembly){status('This browser does not support local AI. Try a recent Chrome or Edge browser.');return}
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)){status('Choose JPEG, PNG or WebP photos, each 8 MB or smaller.');return}
  const id=++run;active=true;$('#ai-suggest').disabled=true;$('#ai-suggest').textContent='Preparing AI…';status('Preparing up to three location photos…');
  timer=setTimeout(()=>{if(run===id&&active){stop();status('AI took too long. Please try again; downloaded model files may already be cached. Manual tagging still works.')}},600000);
  try{
   const {samplePhotos}=await import('/ai-tags.js');
   const sources=samplePhotos([...saved.map(image=>'/media/'+image),...files]);
   const photos=[];
   for(const source of sources){
    const blob=typeof source==='string'?await fetch(source,{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('photo');return r.blob()}):source;
    if(id!==run)return;photos.push(blob);
   }
   if(id!==run)return;
   worker ||= new Worker('/ai-worker.js?v=3',{type:'module'});
   worker.onmessage=({data})=>{
    if(data.id!==run||!active)return;
    if(data.type==='status'){status(data.message);return}
    finish();
    if(data.type==='error'){worker.terminate();worker=null;report(data);return}
    if(data.type!=='result')return;
    const existing=new Set(form().elements.tags.value.split(',').map(x=>x.trim().toLowerCase()));
    const tags=data.tags.filter(t=>!existing.has(t.toLowerCase()));
    status(tags.length?'Reviewed '+data.count+' photo'+(data.count===1?'':'s')+'. Choose which suggestions to add below.': 'No new tags to suggest from these photos. Your existing tags have been kept.');
    $('#ai-results').hidden=!tags.length;
    for(const tag of tags){
     const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=tag;input.checked=true;label.append(input,document.createTextNode(tag));$('#ai-choices').append(label);
    }
    $('#ai-apply').disabled=!tags.length;
   };
   worker.onerror=event=>{event.preventDefault();if(id!==run||!active)return;stop();status('AI could not load. Check your connection and try a recent Chrome or Edge browser. Manual tagging still works.')};
   worker.postMessage({id,photos});
  }catch{if(id!==run)return;stop();status('Could not prepare the photos for AI. Please reselect your photos or sign in again, then retry. Your tags have been kept.')}
 }
 window.ProductiondeckAIEditor={reset,init(options){
  settings=options;
  $('#ai-suggest').onclick=suggest;
  $('#ai-choices').onchange=()=>{$('#ai-apply').disabled=!selected().length};
  $('#ai-apply').onclick=async()=>{
   const id=run,{mergeTags}=await import('/ai-tags.js');if(id!==run)return;
   const input=form().elements.tags,current=input.value.split(','),choices=selected(),merged=mergeTags(current,choices);
   input.value=merged.join(', ');input.dispatchEvent(new Event('input',{bubbles:true}));$('#ai-results').hidden=true;status('Selected tags added to this draft (up to 30 total). Review them above, then save the reference.');
  };
  form().elements.photos.addEventListener('change',reset);
  $('#editor').addEventListener('close',reset);
  $('#item-form').addEventListener('submit',reset);
  reset();
 }};
})();
