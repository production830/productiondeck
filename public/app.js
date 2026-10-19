const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const taxonomy=globalThis.ProductiondeckTaxonomy;
const homeReady=document.body.dataset.homeReady==='true';
const state={items:[],boards:[],view:'all',tag:'',user:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sessionRefresh=null;
async function refreshSession(){
 if(!sessionRefresh)sessionRefresh=fetch('/api/me').finally(()=>{sessionRefresh=null});
 return (await sessionRefresh).clone();
}
async function api(path,options={}){
 const perform=()=>path==='me'?refreshSession():fetch('/api/'+path,{...options,headers:{...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
 let r=await perform();
 if(r.status===401&&!['login','me','logout'].includes(path)){
  const refreshed=await refreshSession();r=refreshed.ok?await perform():refreshed;
 }
 let b;try{b=await r.json()}catch{throw Error('Could not connect. Please try again.')}
 if(!r.ok){
  if(r.status===401&&path!=='login'){showLogin();$$('dialog[open]').forEach(d=>d.close())}
  throw Object.assign(Error(b.error||'Request failed'),{status:r.status,code:b.code});
 }
 return b;
}
const post=(path,b,method='POST')=>api(path,{method,body:JSON.stringify(b)});
function showLogin(){state.user=null;const home=homeReady&&(!location.hash||location.hash==='#home');$('#home').hidden=!home;$('#login').hidden=home;$('#app').hidden=true;state.items=[];state.boards=[];$('#grid').replaceChildren();$('#detail-content').replaceChildren()}
function error(e){$('#notice').textContent=e.message}
async function load(){[state.items,state.boards]=await Promise.all([api('items'),api('boards')]);state.items=state.items.map(taxonomy.record);render()}
const kindName=taxonomy.labels;
const kindIcon={location:'⌖',prop:'◇',casting:'◎'};
const galleryPhotos=item=>{const photos=item.images||[];return item.coverImage&&photos.includes(item.coverImage)?[item.coverImage,...photos.filter(id=>id!==item.coverImage)]:photos};
const maxPhotosFor=type=>['location','prop'].includes(type)?20:12;
const castList=value=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
function renderOptions(){
 const board=state.boards.find(b=>b.id===state.view);
 const scope=state.items.filter(x=>board?board.items.includes(x.id):state.view==='all'||x.type===state.view);
 const options={city:scope.map(x=>x.city),language:scope.flatMap(x=>x.casting?.languages||[]),skill:scope.flatMap(x=>x.casting?.skills||[])};
 const labels={city:'Everywhere',language:'All languages',skill:'All skills'};
 for(const [key,all] of Object.entries(options)){
  const el=$('#filter-'+key),old=el.value,values=[...new Set(all.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  el.innerHTML=`<option value="">${labels[key]}</option>`+values.map(x=>`<option>${esc(x)}</option>`).join('');el.value=values.includes(old)?old:'';
 }
 const subcategory=$('#filter-subcategory'),selected=subcategory.value;subcategory.innerHTML='<option value="">All subcategories</option>'+taxonomy.subcategories.map(value=>`<option>${esc(value)}</option>`).join('');subcategory.value=selected;
 const locked=['location','prop','casting'].includes(state.view);$('#filter-type').disabled=locked;if(locked)$('#filter-type').value=state.view;
}
function render(){
 renderOptions();
 const board=state.boards.find(b=>state.view===b.id),casting=state.view==='casting'||$('#filter-type').value==='casting',title=board?board.name:state.view==='all'?'All references':state.view==='location'?'Locations':casting?'Casting':'Props';
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
 const filters=Object.fromEntries(['type','city','setting','availability'].map(k=>[k,$('#filter-'+k).value]));if(casting)filters.setting='';
 const subcategory=$('#filter-subcategory').value;
 const language=casting?$('#filter-language').value:'',skill=casting?$('#filter-skill').value:'',history=casting?$('#filter-history').value:'';
 let items=scope.filter(x=>(!state.tag||x.tags.includes(state.tag))&&(!subcategory||x.subcategories.includes(subcategory))&&Object.entries(filters).every(([k,v])=>!v||x[k]===v)&&(!language||x.casting?.languages?.includes(language))&&(!skill||x.casting?.skills?.includes(skill))&&(!history||(x.casting?.workedBefore||'unknown')===history)&&query.every(q=>[x.title,x.category,x.legacyCategory,...x.subcategories,x.city,x.notes,x.address,x.contact,x.casting?.playingAge,...(x.casting?.languages||[]),...(x.casting?.skills||[]),...x.tags].join(' ').toLowerCase().includes(q)));
 const sort=$('#sort').value;if(sort==='az')items.sort((a,b)=>a.title.localeCompare(b.title));else if(sort==='old')items.reverse();
 $('#result-count').textContent=items.length;$('#result-label').textContent=casting?(items.length===1?'talent profile':'talent profiles'):(items.length===1?'reference':'references');$('#delete-board').hidden=!board;$('#edit-board').hidden=!board;$('#export-board').hidden=!board;$('#export-board').disabled=!board||!board.items.some(id=>state.items.some(item=>item.id===id));
 const active=Object.values(filters).filter(Boolean).length+[state.tag,subcategory,language,skill,history].filter(Boolean).length;$('#filter-count').textContent=active?'('+active+')':'';
 $('#grid').innerHTML=items.length?items.map(x=>{
  const talent=x.type==='casting',meta=talent?[x.subcategories.slice(0,2).join(' · '),x.city,x.casting?.playingAge&&'Playing age '+x.casting.playingAge]:[x.city,x.subcategories.slice(0,2).join(' · ')];
  const chips=[...(talent?x.casting?.languages||[]:[]),...x.tags].slice(0,3);
  return `<article class="card ${talent?'talent-card':''}"><button class="card-open" data-open="${x.id}" aria-label="Open ${esc(x.title)}"><div class="card-image">${x.images.length?`<img src="/media/${galleryPhotos(x)[0]}" alt="${esc(x.title)}" loading="lazy">`:`<div class="placeholder">${kindIcon[x.type]||'◇'}<small>${talent?'ADD A HEADSHOT':'ADD A PHOTO'}</small></div>`}<span class="type-badge">${kindIcon[x.type]||'◇'} ${kindName[x.type]?.toUpperCase()||'REFERENCE'}</span>${x.images.length?`<span class="photo-count">▧ ${x.images.length}</span>`:''}</div><div class="card-info"><h3>${esc(x.title)}</h3><div class="card-meta">${esc(meta.filter(Boolean).join(' · ')||'Details to be added')}</div><div class="card-tags">${talent&&x.casting?.workedBefore==='yes'?'<span class="worked-before">Worked with us</span>':''}${chips.map(t=>`<span>${esc(t)}</span>`).join('')}${x.availability==='Unavailable'?'<span>Unavailable</span>':''}</div></div></button>${board?`<button type="button" class="deck-remove" data-remove-deck-item="${x.id}" aria-label="Remove ${esc(x.title)} from this Project Deck">×</button>`:''}</article>`;
 }).join(''):`<div class="empty"><span>${casting?'◎':'✳'}</span><h2>${casting?(scope.length?'No matching talent.':'Meet your next cast.'):(state.items.length?'Nothing here. Yet.':'Your collection starts here.')}</h2><p>${casting?'Build your team’s casting sheet with headshots, skills, languages, and people you’ve worked with.':state.items.length?'Try another search, clear your filters, or add a reference to this collection.':'Start with a location, a prop, or a talented person. Add photos and tags so your team can find them next time.'}</p><button class="primary" id="empty-add">${casting?'+ Add talent':'+ Add a reference'}</button></div>`;
}
let selectedSubcategories=new Set();
function renderSubcategories(){
 const query=taxonomy.normalize($('#subcategory-search').value),limit=selectedSubcategories.size>=5;
 $('#subcategory-count').textContent=selectedSubcategories.size+' of 5 selected';
 $('#selected-subcategories').innerHTML=[...selectedSubcategories].map(value=>`<button type="button" class="selected-subcategory" data-remove-subcategory="${esc(value)}" aria-label="Remove ${esc(value)}">${esc(value)} <span aria-hidden="true">×</span></button>`).join('');
 const values=taxonomy.subcategories.filter(value=>taxonomy.normalize(value).includes(query));
 $('#subcategory-options').innerHTML=values.map(value=>`<label><input type="checkbox" value="${esc(value)}" ${selectedSubcategories.has(value)?'checked':limit?'disabled':''}><span>${esc(value)}</span></label>`).join('')||'<p class="muted">No matching subcategories.</p>';
}
$('#subcategory-search').oninput=renderSubcategories;
$('#subcategory-options').onchange=e=>{if(e.target.type!=='checkbox')return;const value=e.target.value;if(e.target.checked&&selectedSubcategories.size<5)selectedSubcategories.add(value);else selectedSubcategories.delete(value);renderSubcategories()};
$('#selected-subcategories').onclick=e=>{const button=e.target.closest('[data-remove-subcategory]');if(button){selectedSubcategories.delete(button.dataset.removeSubcategory);renderSubcategories()}};
$('#clear-subcategories').onclick=()=>{selectedSubcategories.clear();renderSubcategories()};
function syncEditorType(){
 const form=$('#item-form'),casting=form.elements.type.value==='casting';
 $('#casting-fields').hidden=!casting;for(const el of $('#casting-fields').querySelectorAll('input,select'))el.disabled=!casting;
 $('#editor-setting').hidden=casting;$('#editor-address').hidden=casting;
 $('#title-label').textContent=casting?'Name *':'Title *';form.elements.title.placeholder=casting?'Actor or talent name':'e.g. Sunlit corner apartment';
 $('#contact-label').textContent=casting?'Contact / agent':'Contact';$('#cost-label').textContent=casting?'Fee / day rate':'Cost / rental notes';$('#notes-label').textContent=casting?'Experience, credits & casting notes':'Production notes';
 form.elements.tags.placeholder=casting?'comedy, expressive, recurring talent':'warm light, industrial, vintage, concrete';
 form.elements.contact.placeholder=casting?'Agent or direct contact':'Owner or person to ask';form.elements.notes.placeholder=casting?'Previous campaigns, credits, experience, and working notes…':'Access, parking, power, dimensions, restrictions…';
 $('#photos-label').textContent=casting?'Headshots / photos':'Photos';
 $('#photo-help').textContent='JPEG, PNG, WebP · up to '+maxPhotosFor(form.elements.type.value)+' total · 8 MB input each · resized for browsing';
 if(!form.elements.id.value)$('#editor-title').textContent=casting?'Add talent':'Add a reference';
}
function openEditor(item){
 clearCoverPreviews();$('#item-form').reset();selectedSubcategories=new Set(taxonomy.fromItem(item||{}));$('#save-error').textContent='';const form=$('#item-form');form.elements.id.value=item?.id||'';
 if(item){
  for(const [k,v] of Object.entries(item)){if(form.elements[k]&&k!=='images')form.elements[k].value=k==='tags'?v.join(', '):v}
  const c=item.casting||{};for(const [k,v] of Object.entries({cast_age:c.playingAge,cast_height:c.height,cast_languages:(c.languages||[]).join(', '),cast_skills:(c.skills||[]).join(', '),cast_history:c.workedBefore||'unknown',cast_reel:c.showreel}))form.elements[k].value=v||'';
 }else if(['location','prop','casting'].includes(state.view)){form.elements.type.value=state.view}
 syncEditorType();renderSubcategories();$('#legacy-category-note').hidden=!item?.legacyCategory;$('#legacy-category-note').textContent=item?.legacyCategory?'Previous category kept: '+item.legacyCategory:'';renderCoverPicker();$('#editor-title').textContent=item?(item.type==='casting'?'Edit talent':'Edit reference'):(form.elements.type.value==='casting'?'Add talent':'Add a reference');$('#editor').showModal();
}
let activeDetail=null;
const photoArrow=direction=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction==='previous'?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg>`;
function photoViewer(item){
 const photos=galleryPhotos(item);
 if(!photos.length)return '<div class="photo-empty">No photos added yet.</div>';
 return `<section class="photo-viewer" aria-label="${esc(item.title)} photos"><div class="photo-stage" id="photo-stage"><img id="detail-photo" src="/media/${photos[0]}" alt="${esc(item.title)} — photo 1 of ${photos.length}">${photos.length>1?`<button type="button" class="photo-arrow photo-previous" id="photo-previous" aria-label="Previous photo">${photoArrow('previous')}</button><button type="button" class="photo-arrow photo-next" id="photo-next" aria-label="Next photo">${photoArrow('next')}</button>`:''}</div><div class="photo-caption"><span id="photo-position" role="status" aria-live="polite">Photo 1 of ${photos.length}</span><a id="photo-open" href="/media/${photos[0]}" target="_blank" rel="noopener">Open image ↗</a></div>${photos.length>1?`<div class="photo-thumbnails" aria-label="Choose a photo">${photos.map((im,index)=>`<button type="button" class="photo-thumbnail" data-photo-index="${index}" aria-label="View photo ${index+1}" aria-current="${index===0?'true':'false'}"><img src="/media/${im}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</section>`;
}
function setDetailPhoto(index){
 const item=activeDetail&&state.items.find(x=>x.id===activeDetail.id),photos=item?galleryPhotos(item):[];
 if(!photos.length||!$('#detail').open)return;
 activeDetail.index=(index+photos.length)%photos.length;
 const at=activeDetail.index;$('#detail-photo').src='/media/'+photos[at];$('#detail-photo').alt=item.title+' — photo '+(at+1)+' of '+photos.length;
 $('#photo-position').textContent='Photo '+(at+1)+' of '+photos.length;$('#photo-open').href='/media/'+photos[at];
 $$('#detail [data-photo-index]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.photoIndex)===at)));
 const selected=$('#detail [data-photo-index="'+at+'"]'),strip=selected?.parentElement;
 if(selected&&strip){if(selected.offsetLeft<strip.scrollLeft)strip.scrollLeft=selected.offsetLeft;else if(selected.offsetLeft+selected.offsetWidth>strip.scrollLeft+strip.clientWidth)strip.scrollLeft=selected.offsetLeft+selected.offsetWidth-strip.clientWidth}
}
function relatedRecords(item){
 if(!['location','prop'].includes(item.type))return '';
 const matches=ProductiondeckSimilarity.findSimilar(item,state.items),label=item.type==='location'?'Similar locations':'Similar props';
 return `<section class="related-section" aria-labelledby="related-title"><div class="related-heading"><h3 id="related-title">${label}</h3><span>Shared tags & subcategories</span></div>${matches.length?`<div class="related-grid">${matches.map(({item:other,sharedTags,sameCategory})=>`<button class="related-card" type="button" data-related-id="${other.id}" aria-label="Open ${esc(other.title)}"><div class="related-image">${other.images?.length?`<img src="/media/${galleryPhotos(other)[0]}" alt="" loading="lazy">`:`<span aria-hidden="true">${kindIcon[other.type]}</span>`}</div><div class="related-info"><strong>${esc(other.title)}</strong><small>${esc([other.subcategories?.slice(0,2).join(' · '),other.city].filter(Boolean).join(' · '))}</small><div class="related-reasons">${sharedTags.slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('')}${!sharedTags.length&&sameCategory?'<span>Shared subcategory</span>':''}</div></div></button>`).join('')}</div>`:'<p class="related-empty">No matching references yet. Shared tags and subcategories will bring similar finds here as your library grows.</p>'}</section>`;
}
function openDetail(id){
 const x=state.items.find(i=>i.id===id);if(!x)return;activeDetail={id,index:0};const talent=x.type==='casting',c=x.casting||{};
 const pairs=talent?[['Category',kindName[x.type]],['Subcategories',x.subcategories.join(', ')],['Based in',x.city],['Playing age',c.playingAge],['Height',c.height],['Languages',(c.languages||[]).join(', ')],['Skills',(c.skills||[]).join(', ')],['Worked with us',c.workedBefore==='yes'?'Yes':c.workedBefore==='no'?'No — new talent':'Not recorded'],['Availability',x.availability],['Contact / agent',x.contact],['Fee / day rate',x.cost]]:[['Category',kindName[x.type]],['Subcategories',x.subcategories.join(', ')],['City / area',x.city],['Setting',x.setting],['Availability',x.availability],['Cost',x.cost],['Address / storage',x.address],['Contact',x.contact]];
 let showreel='';try{const u=new URL(c.showreel);if(u.protocol==='https:')showreel=u.href}catch{}
 $('#detail-content').innerHTML=`<div class="modal-head"><div><p class="eyebrow">${talent?'CASTING':x.type.toUpperCase()} / ${esc(x.subcategories.join(' · ')||'REFERENCE')}</p><h2 id="detail-title" tabindex="-1">${esc(x.title)}</h2></div><button class="icon close" aria-label="Close">×</button></div>${photoViewer(x)}${relatedRecords(x)}<div class="card-tags">${x.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><dl class="detail-data">${pairs.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v||'—')}</dd></div>`).join('')}</dl>${showreel?`<a class="showreel-link secondary" href="${esc(showreel)}" target="_blank" rel="noopener noreferrer">Open showreel / portfolio ↗</a>`:''}${x.notes?`<h3>${talent?'Experience & casting notes':'Production notes'}</h3><p class="detail-notes">${esc(x.notes)}</p>`:''}<div class="detail-controls"><button class="secondary" id="edit-detail">${talent?'Edit talent':'Edit reference'}</button><select id="detail-board" aria-label="Choose Project Deck"><option value="">Add to Project Deck…</option>${state.boards.map(b=>`<option value="${b.id}">${esc(b.name)}${b.items.includes(id)?' ✓':''}</option>`).join('')}</select><button class="text-button" id="delete-detail">${talent?'Delete profile':'Delete reference'}</button></div><p id="detail-error" role="alert"></p>`;
 $('#edit-detail').onclick=()=>{$('#detail').close();openEditor(x)};
 $('#delete-detail').onclick=async()=>{if(!confirm(`Delete “${x.title}” and its photos?`))return;try{await api('items/'+id,{method:'DELETE'});$('#detail').close();await load()}catch(e){$('#detail-error').textContent=e.message}};
 $('#detail-board').onchange=async e=>{const b=state.boards.find(b=>b.id===e.target.value);if(!b)return;try{const already=b.items.includes(id);await post('boards/'+b.id,{items:already?b.items.filter(i=>i!==id):[...b.items,id]},'PUT');await load();$('#detail-error').textContent=already?'Removed from '+b.name:'Added to '+b.name;e.target.value=''}catch(err){$('#detail-error').textContent=err.message}};
 $('#detail').setAttribute('aria-labelledby','detail-title');
 if(!$('#detail').open)$('#detail').showModal();
 $('#detail').scrollTop=0;$('#detail-title').focus({preventScroll:true});
 if($('#photo-previous'))$('#photo-previous').onclick=()=>setDetailPhoto(activeDetail.index-1);
 if($('#photo-next'))$('#photo-next').onclick=()=>setDetailPhoto(activeDetail.index+1);
 $$('#detail [data-photo-index]').forEach(button=>button.onclick=()=>setDetailPhoto(Number(button.dataset.photoIndex)));
 $$('#detail [data-related-id]').forEach(button=>button.onclick=()=>openDetail(button.dataset.relatedId));
 const stage=$('#photo-stage');if(stage){let start=null;stage.onpointerdown=e=>{if(e.pointerType==='touch')start={x:e.clientX,y:e.clientY}};stage.onpointercancel=()=>{start=null};stage.onpointerup=e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))setDetailPhoto(activeDetail.index+(dx<0?1:-1))}}

}
async function team(){
 const users=await api('users');$('#members').innerHTML=users.map(u=>`<div class="member"><div>${esc(u.name)}${u.admin?' · Admin':''}<small>${esc(u.email)}</small></div>${u.id!==state.user.id?`<div class="member-actions"><button class="text-button" data-reset-user="${u.id}" data-reset-name="${esc(u.name)}">Reset password</button><button class="text-button" data-remove-user="${u.id}">Remove access</button></div>`:''}</div>`).join('');
 if(!$('#team-modal').open)$('#team-modal').showModal();
}
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-error').textContent='';try{await post('login',Object.fromEntries(new FormData(e.target)));e.target.reset();await boot({afterLogin:true})}catch(err){$('#login-error').textContent=err.message}finally{button.disabled=false}};
$('#signout').onclick=async()=>{try{await post('logout',{});location.hash='home';showLogin()}catch(e){error(e)}};
$('#add').onclick=()=>openEditor();$('#item-form').elements.type.onchange=syncEditorType;$('#search').oninput=render;$('#sort').onchange=render;for(const f of $$('.filters select'))f.onchange=render;
$('#filter-toggle').onclick=()=>{$('#filters').hidden=!$('#filters').hidden;$('#filter-toggle').setAttribute('aria-expanded',String(!$('#filters').hidden))};
$('#reset').onclick=()=>{$$('.filters select').forEach(s=>s.value='');state.tag='';$('#search').value='';render()};
let deckSelection=new Set();
function renderDeckSelection(){
 const query=$('#deck-search').value.trim().toLowerCase();
 const items=state.items.filter(x=>[x.title,x.type,x.category,x.legacyCategory,...x.subcategories,x.city,...x.tags].join(' ').toLowerCase().includes(query));
 $('#deck-selection').innerHTML=items.map(item=>`<label class="deck-choice"><input type="checkbox" data-deck-choice="${item.id}" ${deckSelection.has(item.id)?'checked':''}>${item.images.length?`<img src="/media/${galleryPhotos(item)[0]}" alt="" loading="lazy">`:'<span class="deck-choice-placeholder">◇</span>'}<span><strong>${esc(item.title)}</strong><small>${esc(kindName[item.type])}${item.subcategories.length?' · '+esc(item.subcategories.slice(0,2).join(', ')):''}</small></span></label>`).join('')||'<p class="muted">No matching references. Add references to your library to include them here.</p>';
 $('#deck-selection-count').textContent=deckSelection.size+' selected · up to 500 references';
}
function editDeck(board){
 $('#board-form').reset();$('#board-error').textContent='';$('#board-form').elements.id.value=board?.id||'';$('#board-form').elements.name.value=board?.name||'';
 $('#board-modal-title').textContent=board?'Edit Project Deck':'New Project Deck';$('#board-save').textContent=board?'Save Project Deck ↗':'Create Project Deck ↗';
 deckSelection=new Set((board?.items||[]).filter(id=>state.items.some(x=>x.id===id)));renderDeckSelection();$('#shortlist-modal').showModal();
}
$('#add-board').onclick=()=>editDeck();$('#edit-board').onclick=()=>editDeck(state.boards.find(x=>x.id===state.view));
$('#deck-search').oninput=renderDeckSelection;
$('#deck-selection').onchange=e=>{if(!e.target.dataset.deckChoice)return;const id=e.target.dataset.deckChoice;if(e.target.checked)deckSelection.add(id);else deckSelection.delete(id);$('#deck-selection-count').textContent=deckSelection.size+' selected · up to 500 references'};
$('#board-form').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;$('#board-error').textContent='';
 try{if(deckSelection.size>500)throw Error('Choose up to 500 references for a Project Deck.');const id=e.target.elements.id.value,data={name:e.target.elements.name.value,items:[...deckSelection]};const result=await post(id?'boards/'+id:'boards',data,id?'PUT':'POST');state.view=id||result.id;$('#shortlist-modal').close();await load()}catch(err){$('#board-error').textContent=err.message}finally{button.disabled=false}
};
$('#delete-board').onclick=async()=>{if(!confirm('Delete this Project Deck? Its locations, props and casting profiles will stay in the library.'))return;try{await api('boards/'+state.view,{method:'DELETE'});state.view='all';await load()}catch(e){error(e)}};
let coverURLs=[];
function clearCoverPreviews(){for(const url of coverURLs)URL.revokeObjectURL(url);coverURLs=[]}
function renderCoverPicker(){
 const form=$('#item-form'),previous=form.elements.cover_choice?.value||'',item=state.items.find(x=>x.id===form.elements.id.value);clearCoverPreviews();
 const choices=(item?.images||[]).map((id,i)=>({value:'saved:'+id,url:'/media/'+id,label:'Saved photo '+(i+1)}));
 for(const [i,file] of [...form.elements.photos.files].entries()){const url=URL.createObjectURL(file);coverURLs.push(url);choices.push({value:'new:'+i,url,label:'New photo '+(i+1)})}
 const preferred=choices.some(c=>c.value===previous)?previous:item?.coverImage?'saved:'+item.coverImage:choices[0]?.value;
 $('#cover-picker').hidden=!choices.length;
 $('#cover-grid').innerHTML=choices.map((c,i)=>`<label class="cover-choice"><input type="radio" name="cover_choice" value="${c.value}" ${(c.value===preferred||!choices.some(x=>x.value===preferred)&&i===0)?'checked':''}><img src="${c.url}" alt="${esc(c.label)}"><span>${esc(c.label)}</span><small>Use as thumbnail</small></label>`).join('');
}
$('#item-form').elements.photos.onchange=renderCoverPicker;$('#editor').addEventListener('close',clearCoverPreviews);
async function preparePhoto(file){
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser could not prepare this photo');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));if(!blob)throw Error('Could not prepare this photo');return blob;
 }finally{bitmap.close()}
}
$('#item-form').onsubmit=async e=>{
 e.preventDefault();const form=e.target,fd=new FormData(form),files=[...form.elements.photos.files],existing=state.items.find(x=>x.id===fd.get('id')),coverChoice=fd.get('cover_choice')||'';$('#save-error').textContent='';
 if(files.length+(existing?.images.length||0)>maxPhotosFor(fd.get('type'))){$('#save-error').textContent='Use up to '+maxPhotosFor(fd.get('type'))+' photos for this reference.';return}
 if(files.some(f=>f.size>8*1024*1024)){ $('#save-error').textContent='Each photo must be 8 MB or smaller.';return}
 $('#save').disabled=true;let savedId='';
 try{
  const data=Object.fromEntries(fd);delete data.photos;delete data.cover_choice;data.subcategories=[...selectedSubcategories];data.tags=castList(data.tags);
  if(coverChoice.startsWith('saved:'))data.coverImage=coverChoice.slice(6);
  if(data.type==='casting')data.casting={playingAge:data.cast_age,height:data.cast_height,languages:castList(data.cast_languages),skills:castList(data.cast_skills),workedBefore:data.cast_history,showreel:data.cast_reel};
  for(const key of Object.keys(data))if(key.startsWith('cast_'))delete data[key];
  const id=existing?.id||(await post('items',data)).id;savedId=id;form.elements.id.value=id;
  if(existing)await post('items/'+id,data,'PUT');
  let newCover='';
  for(let i=0;i<files.length;i++){$('#save').textContent=`Uploading photo ${i+1} of ${files.length}…`;const photo=await api('items/'+id+'/images',{method:'POST',body:await preparePhoto(files[i])});if(coverChoice==='new:'+i)newCover=photo.id}
  if(newCover)await post('items/'+id,{...data,coverImage:newCover},'PUT');
  if(!existing&&state.boards.some(b=>b.id===state.view)){const b=state.boards.find(b=>b.id===state.view);await post('boards/'+b.id,{items:[...b.items,id]},'PUT')}
  $('#editor').close();await load();
 }catch(err){if(savedId){form.elements.photos.value='';try{await load()}catch{}renderCoverPicker();$('#save-error').textContent='Reference saved, but a later step failed: '+err.message+' Re-select any missing photos to retry.'}else $('#save-error').textContent=err.message}
 finally{$('#save').disabled=false;$('#save').textContent='Save reference ↗'}
};
let pdfController=null;
$('#export-board').onclick=()=>{
 const deck=state.boards.find(x=>x.id===state.view);if(!deck)return;$('#pdf-form').reset();$('#pdf-error').textContent='';$('#pdf-status').textContent='';
 const count=deck.items.filter(id=>state.items.some(item=>item.id===id)).length;$('#pdf-summary').textContent=deck.name+' · '+count+' reference'+(count===1?'':'s')+'. All deck references are exported, regardless of the current browse filters.';$('#pdf-modal').showModal();
};
$('#pdf-modal').addEventListener('close',()=>pdfController?.abort());
$('#pdf-form').onsubmit=async e=>{
 e.preventDefault();const deck=state.boards.find(x=>x.id===state.view);if(!deck||pdfController)return;const button=$('#pdf-download');button.disabled=true;$('#pdf-error').textContent='';pdfController=new AbortController();
 try{
  const items=deck.items.map(id=>state.items.find(item=>item.id===id)).filter(Boolean);if(!items.length)throw Error('Add at least one reference to this Project Deck first.');
  const options={extraPhotos:e.target.elements.extraPhotos.checked,notes:e.target.elements.notes.checked,internal:e.target.elements.internal.checked};
  const blob=await ProductiondeckPDF.generate({name:deck.name,items:structuredClone(items),options,signal:pdfController.signal,refresh:()=>api('me'),progress:message=>{$('#pdf-status').textContent=message}});
  if(pdfController.signal.aborted)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=ProductiondeckPDF.filename(deck.name);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#pdf-status').textContent='PDF downloaded. Review it before sharing.';
 }catch(err){if(err.name!=='AbortError')$('#pdf-error').textContent=err.message;$('#pdf-status').textContent=''}finally{pdfController=null;button.disabled=false}
};
$('#team').onclick=()=>team().catch(error);
$('#team-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await post('users',Object.fromEntries(new FormData(e.target)));e.target.reset();$('#team-error').textContent='';await team()}catch(err){$('#team-error').textContent=err.message}finally{e.submitter.disabled=false}};
document.addEventListener('click',async e=>{const close=e.target.closest('.close');if(close)close.closest('dialog').close();const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;state.tag='';$('#search').value='';$$('.filters select').forEach(s=>s.value='');render()}const tag=e.target.closest('[data-tag]');if(tag){state.tag=state.tag===tag.dataset.tag?'':tag.dataset.tag;render()}const card=e.target.closest('[data-open]');if(card)openDetail(card.dataset.open);if(e.target.id==='empty-add')openEditor();const member=e.target.closest('[data-remove-user]');if(member&&confirm('Remove this teammate’s access and sign them out?'))try{await api('users/'+member.dataset.removeUser,{method:'DELETE'});await team()}catch(err){$('#team-error').textContent=err.message}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('dialog[open]')&&!$('#app').hidden){e.preventDefault();$('#search').focus()}});
$('#password-button').onclick=()=>{$('#password-form').reset();$('#password-error').textContent='';$('#password-modal').showModal()};
$('#password-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await post('password',Object.fromEntries(new FormData(e.target)));$('#password-modal').close();showLogin();$('#login-error').textContent='Password updated. Please sign in with your new password.'}catch(err){$('#password-error').textContent=err.message}finally{e.submitter.disabled=false}};
async function boot({afterLogin=false}={}){
 try{
  state.user=await api('me');$('#user-name').textContent=state.user.name;$('#initial').textContent=state.user.name[0].toUpperCase();$('#team').hidden=!state.user.admin;await load();routeWorkspace();
 }catch(e){
  if(!$('#app').hidden){error(e);return}
  showLogin();
  if(afterLogin&&e.status===401&&e.code!=='access_removed')$('#login-error').textContent='Sign-in succeeded, but your browser did not keep the session. Open this website directly in a normal browser tab and allow its cookies.';
  else if(afterLogin||e.status!==401)$('#login-error').textContent=e.message;
 }
}
function routeWorkspace(){
 const home=homeReady&&(!location.hash||location.hash==='#home');$('#home').hidden=!home;
 if(home){$('#login').hidden=true;$('#app').hidden=true;$$('dialog[open]').forEach(d=>d.close());return}
 if(!state.user){showLogin();return}
 $('#login').hidden=true;$('#app').hidden=false;
 const view={'#locations':'location','#props':'prop','#casting':'casting'}[location.hash];if(view){state.view=view;state.tag='';$('#search').value='';$$('.filters select').forEach(s=>s.value='')}
 render();
}
window.addEventListener('hashchange',()=>{routeWorkspace();if(state.user&&!$('#app').hidden)api('me').then(()=>load()).catch(error)});
document.addEventListener('click',async e=>{const remove=e.target.closest('[data-remove-deck-item]');if(!remove)return;const board=state.boards.find(x=>x.id===state.view);if(!board)return;remove.disabled=true;try{await post('boards/'+board.id,{items:board.items.filter(id=>id!==remove.dataset.removeDeckItem)},'PUT');await load()}catch(err){remove.disabled=false;error(err)}});
boot();

setInterval(()=>{if(state.user&&!$('dialog[open]'))api('me').catch(error)},15*60*1000);

document.addEventListener('click',e=>{
 const button=e.target.closest('[data-reset-user]');if(!button)return;
 $('#reset-teammate-form').reset();$('#reset-teammate-form').elements.id.value=button.dataset.resetUser;
 $('#reset-teammate-name').textContent=button.dataset.resetName;$('#reset-teammate-error').textContent='';$('#reset-teammate-modal').showModal();
});
$('#reset-teammate-form').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;$('#test-teammate-login').disabled=true;$('#reset-teammate-error').textContent='';
 try{
  const fd=new FormData(e.target);await post('users/'+fd.get('id')+'/password',{password:fd.get('password')});
  e.target.reset();$('#reset-teammate-modal').close();$('#team-error').textContent='Password reset and sign-in verified with Supabase. Share the new library password privately with your teammate.';
 }catch(err){$('#reset-teammate-error').textContent=err.message+(err.code?' (Code: '+err.code+')':'')}finally{button.disabled=false;$('#test-teammate-login').disabled=false}
};

$('#test-teammate-login').onclick=async()=>{
 const form=$('#reset-teammate-form'),password=form.elements.password.value,button=$('#test-teammate-login');
 if(!password){$('#reset-teammate-error').textContent='Enter the library password you want to test.';return}
 button.disabled=true;form.querySelector('button.primary').disabled=true;$('#reset-teammate-error').textContent='Checking with Supabase…';
 try{const result=await post('users/'+form.elements.id.value+'/check-login',{password});$('#reset-teammate-error').textContent=result.message}
 catch(err){$('#reset-teammate-error').textContent=err.message+(err.code?' (Code: '+err.code+')':'')}
 finally{button.disabled=false;form.querySelector('button.primary').disabled=false}
};

document.addEventListener('keydown',e=>{
 if(!$('#detail').open||!activeDetail||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 e.preventDefault();setDetailPhoto(activeDetail.index+(e.key==='ArrowRight'?1:-1));
});
$('#detail').addEventListener('close',()=>{activeDetail=null});
