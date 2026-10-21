import './public/casting-application-model.js';
const model=globalThis.ProductiondeckCastingApplication;
const intakeId='c4571000-0000-4000-8000-000000000001';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bucket='productiondeck-photos',maxPhotos=4,maxPhotoBytes=700*1024,maxBody=3*1024*1024,maxPending=200;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isApplication=value=>value?.type==='casting_application';
async function intake(rest){const rows=await rest('items','id=eq.'+intakeId+'&select=id,data');return rows[0]?.data?.type==='casting_intake'?rows[0].data.open!==false:true}
async function applicationId(key,secret){const encoded=new TextEncoder(),hmac=await crypto.subtle.importKey('raw',encoded.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,encoded.encode('casting-application:'+key)));digest[6]=(digest[6]&15)|64;digest[8]=(digest[8]&63)|128;const hex=[...digest.slice(0,16)].map(value=>value.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)}
export function jpegDimensions(data){
 if(data.length<20||data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217)throw fail(400,'Fotografia nuk është një skedar JPEG i vlefshëm. Provojeni përsëri.');
 let at=2;while(at+4<data.length){if(data[at++]!==255)break;while(data[at]===255)at++;const marker=data[at++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;const length=data[at]*256+data[at+1];if(length<2||at+length>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)break;const height=data[at+3]*256+data[at+4],width=data[at+5]*256+data[at+6];if(width<1||height<1||width>1600||height>1600)throw fail(400,'Fotografitë duhet të përgatiten nga formulari para dërgimit.');return {width,height}}at+=length}
 throw fail(400,'Fotografia nuk mund të lexohet. Provoni një fotografi tjetër.');
}
const accepted=()=>({ok:true,message:'Aplikimi u dërgua për shqyrtim. Faleminderit!'});
export async function publicCasting({request,env,p,rest,upstream,bytes}){
 if(p==='/api/public/casting/info'&&request.method==='GET'){
  const open=await intake(rest),rows=open?await rest('items','data->>type=eq.casting_application&select=id&limit=201'):[];return {open:open&&rows.length<maxPending,maxPhotos,maxPhotoBytes,consentVersion:model.consentVersion};
 }
 if(p!=='/api/public/casting/apply'||request.method!=='POST')throw fail(404,'Not found');
 if(!env.CASTING_IP_LIMIT||!env.CASTING_GLOBAL_LIMIT)throw fail(503,'Aplikimet nuk janë në dispozicion për momentin. Provojeni më vonë.');
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';const ipResult=await env.CASTING_IP_LIMIT.limit({key:ip});if(!ipResult.success)throw fail(429,'Ju lutemi prisni pak para se të provoni përsëri.');const globalResult=await env.CASTING_GLOBAL_LIMIT.limit({key:'casting-intake'});if(!globalResult.success)throw fail(429,'Ka shumë kërkesa për momentin. Provojeni përsëri pas pak.');
 if(!await intake(rest))throw fail(403,'Aplikimet janë mbyllur për momentin.');
 const contentType=request.headers.get('Content-Type')||'';if(!/^multipart\/form-data;\s*boundary=/i.test(contentType))throw fail(400,'Përdorni formularin e aplikimit.');
 const raw=await bytes(request,maxBody);let form;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':contentType},body:raw}).formData()}catch{throw fail(400,'Formulari nuk mund të lexohet. Provojeni përsëri.')}
 if([...form].length>8)throw fail(400,'Formular i pavlefshëm.');if(String(form.get('website')||'').trim())return accepted();
 let input;try{const value=form.get('details');if(typeof value!=='string'||value.length>20000)throw Error();input=JSON.parse(value)}catch{throw fail(400,'Të dhënat e aplikimit nuk mund të lexohen.')}
 let candidate;try{candidate=model.validate(input)}catch(error){throw fail(400,error.message)}
 if(input.consentVersion!==model.consentVersion)throw fail(400,'Rifreskoni formularin për të lexuar kushtet e fundit para aplikimit.');
 if(typeof input.submissionKey!=='string'||!uuid.test(input.submissionKey))throw fail(400,'Rifreskoni formularin para se të aplikoni.');
 const files=form.getAll('photos');if(files.length<1||files.length>maxPhotos||files.some(file=>typeof file==='string'||!file.size||file.size>maxPhotoBytes))throw fail(400,'Dërgoni nga 1 deri në 4 fotografi të përgatitura nga formulari.');
 const photos=[];for(const file of files){const data=new Uint8Array(await file.arrayBuffer());jpegDimensions(data);photos.push(data)}
 const id=await applicationId(input.submissionKey,env.SUPABASE_SERVICE_ROLE_KEY),existing=await rest('items','id=eq.'+id+'&select=id,data');
 if(existing.length){if(isApplication(existing[0].data)&&existing[0].data.status==='pending'||existing[0].data.type==='casting'&&existing[0].data.castingApplication)return accepted();throw fail(409,'Aplikimi po përpunohet ende. Prisni pak dhe provojeni përsëri.')}
 const pending=await rest('items','data->>type=eq.casting_application&select=id&limit=201');if(pending.length>=maxPending)throw fail(503,'Aplikimet janë ndalur përkohësisht. Provojeni më vonë.');
 const document={type:'casting_application',status:'uploading',candidate,submittedAt:new Date().toISOString(),consent:{acceptedAt:new Date().toISOString(),version:model.consentVersion},revision:crypto.randomUUID()};
 await rest('items','',{method:'POST',data:{id,data:document}});const photoIds=[];
 try{
  for(const [slot,data] of photos.entries()){const imageId=crypto.randomUUID();photoIds.push(imageId);await rest('images','',{method:'POST',data:{id:imageId,item_id:id,slot,mime:'image/jpeg'}});await upstream('/storage/v1/object/'+bucket+'/'+imageId,{method:'POST',data,raw:true,headers:{'Content-Type':'image/jpeg','x-upsert':'false'}})}
  const changed=await rest('items','id=eq.'+id+'&data->>type=eq.casting_application&data->>status=eq.uploading&data->>revision=eq.'+document.revision,{method:'PATCH',data:{data:{...document,status:'pending'}},headers:{Prefer:'return=representation'}});if(!changed?.length)throw fail(409,'Aplikimi nuk mund të përfundohej. Provojeni përsëri.');return accepted();
 }catch(error){
  let removed=true;if(photoIds.length)try{await upstream('/storage/v1/object/'+bucket,{method:'DELETE',data:{prefixes:photoIds}})}catch{removed=false}
  if(removed)try{await rest('items','id=eq.'+id+'&data->>type=eq.casting_application&data->>status=eq.uploading',{method:'DELETE'})}catch{}
  throw fail(error.status||503,'Dërgimi i fotografive nuk përfundoi. Provojeni përsëri.');
 }
}
export async function reviewCasting({request,p,rest,upstream,body,user,itemData}){
 if(p==='/api/casting-applications/intake'){
  if(request.method==='GET')return {open:await intake(rest),maxPending};
  if(request.method==='POST'){const input=await body(request);if(typeof input.open!=='boolean')throw fail(400,'Choose whether applications are open.');const data={type:'casting_intake',open:input.open,updated:new Date().toISOString(),updatedBy:user.id};await rest('items','on_conflict=id',{method:'POST',data:{id:intakeId,data},headers:{Prefer:'resolution=merge-duplicates'}});return {open:input.open,maxPending}}
  throw fail(405,'Method not allowed');
 }
 if(p==='/api/casting-applications'&&request.method==='GET'){
  let rows=[],page;do{page=await rest('items','data->>type=eq.casting_application&select=id,data,created&order=created.asc,id&limit=100&offset='+rows.length);rows.push(...page)}while(page.length===100);rows=rows.filter(row=>isApplication(row.data));const images=[];
  for(let at=0;at<rows.length;at+=100){const group=rows.slice(at,at+100);images.push(...await rest('images','item_id=in.('+group.map(row=>row.id).join(',')+')&select=id,item_id,slot&limit=400'))}
  return rows.map(row=>({...row.data,id:row.id,images:images.filter(image=>image.item_id===row.id).sort((a,b)=>a.slot-b.slot).map(image=>image.id)}));
 }
 const match=p.match(/^\/api\/casting-applications\/([^/]+)(?:\/(approve))?$/);if(!match||!uuid.test(match[1]))throw fail(404,'Application not found');
 const id=match[1],rows=await rest('items','id=eq.'+id+'&select=id,data'),record=rows[0];if(!record||!isApplication(record.data))throw fail(409,'This application has already been reviewed or removed. Refresh the queue.');
 const input=await body(request);if(input.revision!==record.data.revision)throw fail(409,'This application was changed by someone else. Reopen it before reviewing.');
 const query='id=eq.'+id+'&data->>type=eq.casting_application&data->>revision=eq.'+record.data.revision;
 if(request.method==='DELETE'&&!match[2]){
  if(record.data.status==='uploading'&&Date.now()-Date.parse(record.data.submittedAt)<10*60*1000)throw fail(409,'Photos are still uploading. Try removing an incomplete upload after ten minutes.');
  if(record.data.status!=='rejecting'){const locked=await rest('items',query,{method:'PATCH',data:{data:{...record.data,status:'rejecting'}},headers:{Prefer:'return=representation'}});if(!locked?.length)throw fail(409,'This application changed. Refresh the queue.')}
  const images=await rest('images','item_id=eq.'+id+'&select=id');if(images.length)await upstream('/storage/v1/object/'+bucket,{method:'DELETE',data:{prefixes:images.map(image=>image.id)}});
  await rest('items',query+'&data->>status=eq.rejecting',{method:'DELETE'});return {ok:true};
 }
 if(record.data.status!=='pending')throw fail(409,'Only completed pending applications can be edited or approved.');
 let candidate;try{candidate=model.validate(input.candidate,{review:true})}catch(error){throw fail(400,error.message)}
 if(request.method==='PUT'&&!match[2]){const data={...record.data,candidate,revision:crypto.randomUUID(),updated:new Date().toISOString(),reviewedBy:user.id};const changed=await rest('items',query+'&data->>status=eq.pending',{method:'PATCH',data:{data},headers:{Prefer:'return=representation'}});if(!changed?.length)throw fail(409,'This application changed. Refresh the queue.');return {...data,id}}
 if(request.method==='POST'&&match[2]==='approve'){
  const images=await rest('images','item_id=eq.'+id+'&select=id,slot&order=slot');if(!images.length||images.length>maxPhotos)throw fail(400,'The application photos are incomplete.');
  const profile=itemData({title:candidate.firstName+' '+candidate.lastName,type:'casting',subcategories:candidate.interests,city:candidate.city,availability:'Check first',coverImage:images.sort((a,b)=>a.slot-b.slot)[0].id,tags:candidate.tags,contact:candidate.phone+' · '+candidate.email,notes:candidate.experience,casting:{gender:candidate.gender,playingAge:candidate.playingAge,height:candidate.height,languages:candidate.languages,skills:candidate.skills,showreel:candidate.showreel,workedBefore:'unknown'}});
  profile.castingApplication={submittedAt:record.data.submittedAt,consent:record.data.consent,approvedAt:new Date().toISOString(),approvedBy:user.id};const changed=await rest('items',query+'&data->>status=eq.pending',{method:'PATCH',data:{data:profile},headers:{Prefer:'return=representation'}});if(!changed?.length)throw fail(409,'This application has already been reviewed. Refresh the queue.');return {id,title:profile.title};
 }
 throw fail(405,'Method not allowed');
}
