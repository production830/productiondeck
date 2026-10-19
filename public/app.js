const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={items:[],boards:[],view:'all',tag:'',user:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,options={}){
 const perform=()=>fetch('/api/'+path,{...options,headers:{...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
 let r=await perform();
 if(r.status===401&&!['login','me','logout'].includes(path)){
  const refresh=await fetch('/api/me');if(refresh.ok)r=await perform();
 }
 let b;try{b=await r.json()}catch{throw Error('Could not connect. Please try again.')}
 if(!r.ok){if(r.status===401&&path!=='login'){showLogin();$$('dialog[open]').forEach(d=>d.close())}throw Error(b.error||'Request failed')}return b
}
const post=(path,b,method='POST')=>api(path,{method,body:JSON.stringify(b)});
function showLogin(){$('#login').hidden=false;$('#app').hidden=true;state.items=[];state.boards=[];$('#grid').replaceChildren();$('#detail-content').replaceChildren()}
function error(e){$('#notice').textContent=e.message}
async function load(){[state.items,state.boards]=await Promise.all([api('items'),api('boards')]);render()}
const kindName={location:'Location',prop:'Prop',casting:'Casting'};
const kindIcon={location:'⌖',prop:'◇',casting:'◎'};
const castList=value=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
function renderOptions(){
 const board=state.boards.find(b=>b.id===state.view);
 const scope=state.items.filter(x=>board?board.items.includes(x.id):state.view==='all'||x.type===state.view);
 const options={category:scope.map(x=>x.category),city:scope.map(x=>x.city),language:scope.flatMap(x=>x.casting?.languages||[]),skill:scope.flatMap(x=>x.casting?.skills||[])};
 const labels={category:'All categories',city:'Everywhere',language:'All languages',skill:'All skills'};
 for(const [key,all] of Object.entries(options)){
  const el=$('#filter-'+key),old=el.value,values=[...new Set(all.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  el.innerHTML=`<option value="">${labels[key]}</option>`+values.map(x=>`<option>${esc(x)}</option>`).join('');el.value=values.includes(old)?old:'';
 }
 $('#categories').innerHTML=[...new Set(state.items.map(x=>x.category).filter(Boolean))].map(x=>`<option value="${esc(x)}">`).join('');
}
function render(){
 renderOptions();
 const board=state.boards.find(b=>state.view===b.id),casting=state.view==='casting',title=board?board.name:state.view==='all'?'All references':state.view==='location'?'Locations':casting?'Casting':'Props';
 $('#breadcrumb').textContent=title;
 $('#view-title').innerHTML=state.view==='all'?'The production library<span>.</span>':esc(title)+'<span>.</span>';
 $('#view-description').textContent=board?'Your shared selection for this production.':state.view==='location'?'Spaces with character. Places with possibility.':state.view==='prop'?'The details that bring a story to life.':casting?'Familiar faces. Fresh talent. The right people for the story.':'The places, the details, the people. Ready for your next shoot.';
 $('#add').textContent=casting?'+ Add talent':'+ Add reference';$('#grid').dataset.kind=state.view;
 $$('.casting-filter').forEach(el=>el.hidden=!casting);$('#setting-filter').hidden=casting;$('#filters').classList.toggle('casting-mode',casting);
 for(const t of ['all','location','prop','casting']){
  $('#'+t+'-count').textContent=state.items.filter(x=>t==='all'||x.type===t).length;
  $(`[data-view="${t}"]`).classList.toggle('active',state.view===t);
 }
 $('#board-nav').innerHTML=state.boards.map(b=>`<button data-view="${b.id}" class="${state.view===b.id?'active':''}"><span>▱</span>${esc(b.name)}<b>${b.items.filter(id=>state.items.some(i=>i.id===id)).length}</b></button>`).join('');
 const scope=state.items.filter(x=>board?board.items.includes(x.id):state.view==='all'||x.type===state.view);
 const tags=[...new Set(scope.flatMap(x=>x.tags))].sort();
 $('#tags').innerHTML=(state.tag&&!tags.includes(state.tag)?[state.tag,...tags]:tags).slice(0,30).map(t=>`<button class="tag ${state.tag===t?'active':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')||'<span class="muted">Tags will appear as your collection grows.</span>';
 const query=$('#search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const filters=Object.fromEntries(['category','city','setting','availability'].map(k=>[k,$('#filter-'+k).value]));if(casting)filters.setting='';
 const language=casting?$('#filter-language').value:'',skill=casting?$('#filter-skill').value:'',history=casting?$('#filter-history').value:'';
 let items=scope.filter(x=>(!state.tag||x.tags.includes(state.tag))&&Object.entries(filters).every(([k,v])=>!v||x[k]===v)&&(!language||x.casting?.languages?.includes(language))&&(!skill||x.casting?.skills?.includes(skill))&&(!history||(x.casting?.workedBefore||'unknown')===history)&&query.every(q=>[x.title,x.category,x.city,x.notes,x.address,x.contact,x.casting?.playingAge,...(x.casting?.languages||[]),...(x.casting?.skills||[]),...x.tags].join(' ').toLowerCase().includes(q)));
 const sort=$('#sort').value;if(sort==='az')items.sort((a,b)=>a.title.localeCompare(b.title));else if(sort==='old')items.reverse();
 $('#result-count').textContent=items.length;$('#result-label').textContent=casting?(items.length===1?'talent profile':'talent profiles'):(items.length===1?'reference':'references');$('#delete-board').hidden=!board;
 const active=Object.values(filters).filter(Boolean).length+[state.tag,language,skill,history].filter(Boolean).length;$('#filter-count').textContent=active?'('+active+')':'';
 $('#grid').innerHTML=items.length?items.map(x=>{
  const talent=x.type==='casting',meta=talent?[x.category,x.city,x.casting?.playingAge&&'Playing age '+x.casting.playingAge]:[x.city,x.category];
  const chips=[...(talent?x.casting?.languages||[]:[]),...x.tags].slice(0,3);
  return `<article class="card ${talent?'talent-card':''}"><button class="card-open" data-open="${x.id}" aria-label="Open ${esc(x.title)}"><div class="card-image">${x.images.length?`<img src="/media/${x.images[0]}" alt="${esc(x.title)}" loading="lazy">`:`<div class="placeholder">${kindIcon[x.type]||'◇'}<small>${talent?'ADD A HEADSHOT':'ADD A PHOTO'}</small></div>`}<span class="type-badge">${kindIcon[x.type]||'◇'} ${kindName[x.type]?.toUpperCase()||'REFERENCE'}</span>${x.images.length?`<span class="photo-count">▧ ${x.images.length}</span>`:''}</div><div class="card-info"><h3>${esc(x.title)}</h3><div class="card-meta">${esc(meta.filter(Boolean).join(' · ')||'Details to be added')}</div><div class="card-tags">${talent&&x.casting?.workedBefore==='yes'?'<span class="worked-before">Worked with us</span>':''}${chips.map(t=>`<span>${esc(t)}</span>`).join('')}${x.availability==='Unavailable'?'<span>Unavailable</span>':''}</div></div></button></article>`;
 }).join(''):`<div class="empty"><span>${casting?'◎':'✳'}</span><h2>${casting?(scope.length?'No matching talent.':'Meet your next cast.'):(state.items.length?'Nothing here. Yet.':'Your collection starts here.')}</h2><p>${casting?'Build your team’s casting sheet with headshots, skills, languages, and people you’ve worked with.':state.items.length?'Try another search, clear your filters, or add a reference to this collection.':'Start with a location, a prop, or a talented person. Add photos and tags so your team can find them next time.'}</p><button class="primary" id="empty-add">${casting?'+ Add talent':'+ Add a reference'}</button></div>`;
}
function syncEditorType(){
 const form=$('#item-form'),casting=form.elements.type.value==='casting';
 $('#casting-fields').hidden=!casting;for(const el of $('#casting-fields').querySelectorAll('input,select'))el.disabled=!casting;
 $('#editor-setting').hidden=casting;$('#editor-address').hidden=casting;
 $('#title-label').textContent=casting?'Name *':'Title *';form.elements.title.placeholder=casting?'Actor or talent name':'e.g. Sunlit corner apartment';
 $('#category-label').textContent=casting?'Talent type / role':'Category';form.elements.category.placeholder=casting?'Actor, model, voice artist, extra…':'Apartment, furniture, vehicle…';
 $('#contact-label').textContent=casting?'Contact / agent':'Contact';$('#cost-label').textContent=casting?'Fee / day rate':'Cost / rental notes';$('#notes-label').textContent=casting?'Experience, credits & casting notes':'Production notes';
 form.elements.tags.placeholder=casting?'comedy, expressive, recurring talent':'warm light, industrial, vintage, concrete';
 form.elements.contact.placeholder=casting?'Agent or direct contact':'Owner or person to ask';form.elements.notes.placeholder=casting?'Previous campaigns, credits, experience, and working notes…':'Access, parking, power, dimensions, restrictions…';
 $('#photos-label').textContent=casting?'Headshots / photos':'Photos';
 if(!form.elements.id.value)$('#editor-title').textContent=casting?'Add talent':'Add a reference';
}
function openEditor(item){
 $('#item-form').reset();$('#save-error').textContent='';const form=$('#item-form');form.elements.id.value=item?.id||'';
 if(item){
  for(const [k,v] of Object.entries(item)){if(form.elements[k]&&k!=='images')form.elements[k].value=k==='tags'?v.join(', '):v}
  const c=item.casting||{};for(const [k,v] of Object.entries({cast_age:c.playingAge,cast_height:c.height,cast_languages:(c.languages||[]).join(', '),cast_skills:(c.skills||[]).join(', '),cast_history:c.workedBefore||'unknown',cast_reel:c.showreel}))form.elements[k].value=v||'';
 }else if(['location','prop','casting'].includes(state.view)){form.elements.type.value=state.view}
 syncEditorType();$('#editor-title').textContent=item?(item.type==='casting'?'Edit talent':'Edit reference'):(form.elements.type.value==='casting'?'Add talent':'Add a reference');$('#editor').showModal();
}
function openDetail(id){
 const x=state.items.find(i=>i.id===id);if(!x)return;const talent=x.type==='casting',c=x.casting||{};
 const pairs=talent?[['Talent type',x.category],['Based in',x.city],['Playing age',c.playingAge],['Height',c.height],['Languages',(c.languages||[]).join(', ')],['Skills',(c.skills||[]).join(', ')],['Worked with us',c.workedBefore==='yes'?'Yes':c.workedBefore==='no'?'No — new talent':'Not recorded'],['Availability',x.availability],['Contact / agent',x.contact],['Fee / day rate',x.cost]]:[['City / area',x.city],['Setting',x.setting],['Availability',x.availability],['Cost',x.cost],['Address / storage',x.address],['Contact',x.contact]];
 let showreel='';try{const u=new URL(c.showreel);if(u.protocol==='https:')showreel=u.href}catch{}
 $('#detail-content').innerHTML=`<div class="modal-head"><div><p class="eyebrow">${talent?'CASTING':x.type.toUpperCase()} / ${esc(x.category||'REFERENCE')}</p><h2>${esc(x.title)}</h2></div><button class="icon close" aria-label="Close">×</button></div><div class="gallery ${talent?'talent-gallery':''}">${x.images.map(im=>`<a href="/media/${im}" target="_blank" rel="noopener"><img src="/media/${im}" alt="${esc(x.title)}"></a>`).join('')}</div><div class="card-tags">${x.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><dl class="detail-data">${pairs.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v||'—')}</dd></div>`).join('')}</dl>${showreel?`<a class="showreel-link secondary" href="${esc(showreel)}" target="_blank" rel="noopener noreferrer">Open showreel / portfolio ↗</a>`:''}${x.notes?`<h3>${talent?'Experience & casting notes':'Production notes'}</h3><p class="detail-notes">${esc(x.notes)}</p>`:''}<div class="detail-controls"><button class="secondary" id="edit-detail">${talent?'Edit talent':'Edit reference'}</button><select id="detail-board" aria-label="Choose shortlist"><option value="">Add to shortlist…</option>${state.boards.map(b=>`<option value="${b.id}">${esc(b.name)}${b.items.includes(id)?' ✓':''}</option>`).join('')}</select><button class="text-button" id="delete-detail">${talent?'Delete profile':'Delete reference'}</button></div><p id="detail-error" role="alert"></p>`;
 $('#edit-detail').onclick=()=>{$('#detail').close();openEditor(x)};
 $('#delete-detail').onclick=async()=>{if(!confirm(`Delete “${x.title}” and its photos?`))return;try{await api('items/'+id,{method:'DELETE'});$('#detail').close();await load()}catch(e){$('#detail-error').textContent=e.message}};
 $('#detail-board').onchange=async e=>{const b=state.boards.find(b=>b.id===e.target.value);if(!b)return;try{const already=b.items.includes(id);await post('boards/'+b.id,{items:already?b.items.filter(i=>i!==id):[...b.items,id]},'PUT');await load();$('#detail-error').textContent=already?'Removed from '+b.name:'Added to '+b.name;e.target.value=''}catch(err){$('#detail-error').textContent=err.message}};
 if(!$('#detail').open)$('#detail').showModal();
}
async function team(){const users=await api('users');$('#members').innerHTML=users.map(u=>`<div class="member"><div>${esc(u.name)}${u.admin?' · Admin':''}<small>${esc(u.email)}</small></div>${u.id!==state.user.id?`<button class="text-button" data-remove-user="${u.id}">Remove access</button>`:''}</div>`).join('');if(!$('#team-modal').open)$('#team-modal').showModal()}
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-error').textContent='';try{await post('login',Object.fromEntries(new FormData(e.target)));e.target.reset();await boot()}catch(err){$('#login-error').textContent=err.message}finally{button.disabled=false}};
$('#signout').onclick=async()=>{try{await post('logout',{});showLogin()}catch(e){error(e)}};
$('#add').onclick=()=>openEditor();$('#item-form').elements.type.onchange=syncEditorType;$('#search').oninput=render;$('#sort').onchange=render;for(const f of $$('.filters select'))f.onchange=render;
$('#filter-toggle').onclick=()=>{$('#filters').hidden=!$('#filters').hidden;$('#filter-toggle').setAttribute('aria-expanded',String(!$('#filters').hidden))};
$('#reset').onclick=()=>{$$('.filters select').forEach(s=>s.value='');state.tag='';$('#search').value='';render()};
$('#add-board').onclick=()=>{$('#board-form').reset();$('#board-error').textContent='';$('#shortlist-modal').showModal()};
$('#board-form').onsubmit=async e=>{e.preventDefault();try{const b=await post('boards',{name:new FormData(e.target).get('name')});state.view=b.id;$('#shortlist-modal').close();await load()}catch(err){$('#board-error').textContent=err.message}};
$('#delete-board').onclick=async()=>{if(!confirm('Delete this shortlist? Your references will stay in the library.'))return;try{await api('boards/'+state.view,{method:'DELETE'});state.view='all';await load()}catch(e){error(e)}};
async function preparePhoto(file){
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser could not prepare this photo');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));if(!blob)throw Error('Could not prepare this photo');return blob;
 }finally{bitmap.close()}
}
$('#item-form').onsubmit=async e=>{e.preventDefault();const form=e.target,fd=new FormData(form),files=[...form.elements.photos.files],existing=state.items.find(x=>x.id===fd.get('id'));$('#save-error').textContent='';if(files.length+(existing?.images.length||0)>12){$('#save-error').textContent='Use up to 12 photos per reference.';return}if(files.some(f=>f.size>8*1024*1024)){ $('#save-error').textContent='Each photo must be 8 MB or smaller.';return}$('#save').disabled=true;let savedId='';try{const data=Object.fromEntries(fd);delete data.photos;data.tags=castList(data.tags);if(data.type==='casting')data.casting={playingAge:data.cast_age,height:data.cast_height,languages:castList(data.cast_languages),skills:castList(data.cast_skills),workedBefore:data.cast_history,showreel:data.cast_reel};for(const key of Object.keys(data))if(key.startsWith('cast_'))delete data[key];const id=existing?.id||(await post('items',data)).id;savedId=id;form.elements.id.value=id;if(existing)await post('items/'+id,data,'PUT');for(let i=0;i<files.length;i++){$('#save').textContent=`Uploading photo ${i+1} of ${files.length}…`;await api('items/'+id+'/images',{method:'POST',body:await preparePhoto(files[i])})}if(!existing&&state.boards.some(b=>b.id===state.view)){const b=state.boards.find(b=>b.id===state.view);await post('boards/'+b.id,{items:[...b.items,id]},'PUT')}$('#editor').close();await load()}catch(err){if(savedId){form.elements.photos.value='';try{await load()}catch{}$('#save-error').textContent='Reference saved, but a later step failed: '+err.message+' Re-select any missing photos to retry.'}else $('#save-error').textContent=err.message}finally{$('#save').disabled=false;$('#save').textContent='Save reference ↗'}};
$('#team').onclick=()=>team().catch(error);
$('#team-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await post('users',Object.fromEntries(new FormData(e.target)));e.target.reset();$('#team-error').textContent='';await team()}catch(err){$('#team-error').textContent=err.message}finally{e.submitter.disabled=false}};
document.addEventListener('click',async e=>{const close=e.target.closest('.close');if(close)close.closest('dialog').close();const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;state.tag='';$('#search').value='';$$('.filters select').forEach(s=>s.value='');render()}const tag=e.target.closest('[data-tag]');if(tag){state.tag=state.tag===tag.dataset.tag?'':tag.dataset.tag;render()}const card=e.target.closest('[data-open]');if(card)openDetail(card.dataset.open);if(e.target.id==='empty-add')openEditor();const member=e.target.closest('[data-remove-user]');if(member&&confirm('Remove this teammate’s access and sign them out?'))try{await api('users/'+member.dataset.removeUser,{method:'DELETE'});await team()}catch(err){$('#team-error').textContent=err.message}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('dialog[open]')&&!$('#app').hidden){e.preventDefault();$('#search').focus()}});
$('#password-button').onclick=()=>{$('#password-form').reset();$('#password-error').textContent='';$('#password-modal').showModal()};
$('#password-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await post('password',Object.fromEntries(new FormData(e.target)));$('#password-modal').close();showLogin();$('#login-error').textContent='Password updated. Please sign in with your new password.'}catch(err){$('#password-error').textContent=err.message}finally{e.submitter.disabled=false}};
async function boot(){try{state.user=await api('me');$('#user-name').textContent=state.user.name;$('#initial').textContent=state.user.name[0].toUpperCase();$('#team').hidden=!state.user.admin;$('#login').hidden=true;$('#app').hidden=false;await load()}catch(e){if(!$('#app').hidden)error(e);else showLogin()}}
boot();

setInterval(()=>{if(!$('#app').hidden&&!$('dialog[open]'))api('me').catch(error)},15*60*1000);
