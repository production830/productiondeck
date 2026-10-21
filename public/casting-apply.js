(()=>{
 const $=selector=>document.querySelector(selector),model=ProductiondeckCastingApplication;
 let key=crypto.randomUUID(),busy=false,previews=[];
 const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const list=value=>value.split(',').map(item=>item.trim()).filter(Boolean);
 const form=$('#apply-form');form.elements.city.innerHTML='<option value="">Zgjidhni qytetin</option>'+ProductiondeckTaxonomy.cityGroups.map(group=>`<optgroup label="${esc(group.country)}">${group.cities.map(city=>`<option>${esc(city)}</option>`).join('')}</optgroup>`).join('');
 $('#apply-interests').innerHTML=Object.entries(model.interests).map(([value,label])=>`<label><input type="checkbox" name="interest" value="${value}" ${value==='Actor'?'checked':''}>${label}</label>`).join('');
 form.elements.photos.onchange=()=>{for(const url of previews)URL.revokeObjectURL(url);previews=[];$('#apply-photo-preview').replaceChildren();$('#apply-error').textContent='';const files=[...form.elements.photos.files];if(files.length>4){$('#apply-error').textContent='Zgjidhni deri në 4 fotografi.';return}for(const file of files){const url=URL.createObjectURL(file);previews.push(url);const image=document.createElement('img');image.src=url;image.alt='Fotografi e zgjedhur';$('#apply-photo-preview').append(image)}};
 async function photo(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Përdorni fotografi JPEG, PNG ose WebP, deri në 8 MB secila.');
  let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw Error('Një fotografi nuk mund të lexohet. Zgjidhni një tjetër.')}try{const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('Shfletuesi nuk mund t’i përgatitë fotografitë.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);let blob;for(const quality of [.82,.7,.55]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=650*1024)return blob}throw Error('Një fotografi është ende shumë e madhe. Zgjidhni një version më të vogël.')}finally{bitmap.close()}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;$('#apply-error').textContent='';const fields=Object.fromEntries(new FormData(form)),files=[...form.elements.photos.files];let data;
  try{data=model.validate({...fields,languages:list(fields.languages),skills:list(fields.skills),interests:[...form.querySelectorAll('[name=interest]:checked')].map(input=>input.value),consent:form.elements.consent.checked});if(files.length<1||files.length>4)throw Error('Zgjidhni nga 1 deri në 4 fotografi.')}catch(error){$('#apply-error').textContent=error.message;return}
  busy=true;$('#apply-fields').disabled=true;$('#apply-submit').disabled=true;
  try{
   const body=new FormData();body.set('details',JSON.stringify({...data,consent:true,consentVersion:model.consentVersion,submissionKey:key}));body.set('website',fields.website||'');for(const [index,file] of files.entries()){$('#apply-status').textContent='Duke përgatitur fotografinë '+(index+1)+' nga '+files.length+'…';body.append('photos',await photo(file),'photo-'+(index+1)+'.jpg')}
   $('#apply-status').textContent='Duke dërguar aplikimin…';let response;try{response=await fetch('/api/public/casting/apply',{method:'POST',body})}catch{throw Error('Lidhja u ndërpre. Të dhënat janë ende në formular; provojeni përsëri.')}
   let result;try{result=await response.json()}catch{throw Error('Dërgimi nuk mund të konfirmohej. Provojeni përsëri.')}if(!response.ok)throw Error(result.error||'Aplikimi nuk mund të dërgohej.');form.hidden=true;$('#apply-success').hidden=false;$('#apply-success').focus();for(const url of previews)URL.revokeObjectURL(url);previews=[];form.reset();key=crypto.randomUUID();
  }catch(error){$('#apply-error').textContent=error.message}finally{busy=false;$('#apply-fields').disabled=false;$('#apply-submit').disabled=false;$('#apply-status').textContent=''}
 };
 fetch('/api/public/casting/info').then(async response=>{if(!response.ok)throw Error();const info=await response.json();$('#apply-loading').hidden=true;if(info.open)form.hidden=false;else $('#apply-closed').hidden=false}).catch(()=>{$('#apply-loading').textContent='Formulari nuk mund të hapet për momentin. Rifreskoni faqen dhe provoni përsëri.'});
})();
