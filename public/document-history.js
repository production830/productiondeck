/* Shared saved-document controls and read-only previews. */
(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function menu(kind,id,title,copy='Duplicate'){
  return `<details class="document-menu"><summary aria-label="Actions for ${esc(title)}" title="Document actions"><span aria-hidden="true">•••</span></summary><div class="document-menu-options"><button type="button" data-${kind}-preview="${id}">Preview</button><button type="button" data-${kind}-open="${id}">Edit</button>${copy?`<button type="button" data-${kind}-copy="${id}">${copy}</button>`:''}<button type="button" class="document-delete" data-${kind}-delete="${id}">Delete</button></div></details>`;
 }
 function controls(prefix,noun){
  const list=document.querySelector('#'+prefix+'-list'),section=document.createElement('section');section.className='document-history-tools';
  section.innerHTML=`<div><h2>Saved history</h2><p class="muted">Saved ${noun} stay here until deleted. Preview or edit them at any time.</p></div><div class="document-history-filters"><input id="${prefix}-history-search" type="search" aria-label="Search saved ${noun}" placeholder="Search title, project, client or date…"><select id="${prefix}-history-sort" aria-label="Sort saved ${noun}"><option value="newest">Shoot date: newest first</option><option value="oldest">Shoot date: oldest first</option><option value="name">Title A–Z</option></select></div><p id="${prefix}-history-count" role="status"></p>`;
  list.before(section);return section;
 }
 function filter(records,prefix){
  const query=ProductiondeckTaxonomy.fold(document.querySelector('#'+prefix+'-history-search').value),sort=document.querySelector('#'+prefix+'-history-sort').value;
  const rows=records.filter(row=>ProductiondeckTaxonomy.fold([row.title,row.project,row.client,row.date,row.date?.split('-').reverse().join('.')].join(' ')).includes(query));
  rows.sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):!a.date&&!b.date?a.title.localeCompare(b.title):!a.date?1:!b.date?-1:(sort==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date))||a.title.localeCompare(b.title));
  document.querySelector('#'+prefix+'-history-count').textContent=rows.length+' of '+records.length+' saved';return rows;
 }
 const pairs=values=>`<dl class="document-preview-fields">${values.filter(([,v])=>v!==''&&v!==undefined&&v!==null).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
 function table(title,columns,rows){return `<section class="document-preview-section"><h3>${esc(title)}</h3>${rows.length?`<div class="document-preview-table" tabindex="0" role="region" aria-label="${esc(title)}"><table><thead><tr>${columns.map(([label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([,key])=>`<td>${esc(typeof key==='function'?key(row):row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="muted">No entries.</p>'}</section>`}
 let dialog=null;
 function preview({title,kind,html,edit}){
  if(!dialog){dialog=document.createElement('dialog');dialog.id='document-preview';dialog.className='document-preview';dialog.setAttribute('aria-labelledby','document-preview-title');document.body.append(dialog)}
  dialog.innerHTML=`<div class="modal-head"><div><p class="eyebrow">${esc(kind)} / SAVED PREVIEW</p><h2 id="document-preview-title">${esc(title)}</h2></div><button type="button" class="icon" data-preview-close aria-label="Close preview">×</button></div><p class="muted">Read-only preview of the saved document.</p><div class="document-preview-content" lang="sq">${html}</div><div class="modal-actions"><button type="button" class="secondary" data-preview-close>Close</button><button type="button" class="primary" data-preview-edit>Edit document</button></div>`;
  dialog.querySelectorAll('[data-preview-close]').forEach(button=>button.onclick=()=>dialog.close());dialog.querySelector('[data-preview-edit]').onclick=()=>{dialog.close();edit()};dialog.showModal();dialog.scrollTop=0;
 }
 function schedulePreview(schedule,items,edit){
  const name=id=>items.find(item=>item.id===id)?.title||schedule.referenceLabels?.[id]||'Reference removed';
  preview({title:schedule.title,kind:'Shooting schedule',edit,html:pairs([['Projekti',schedule.project],['Klienti',schedule.client],['Data',schedule.date],['Thirrja e ekipit',schedule.crewCall],['Fillimi',schedule.startTime],['Pika e takimit',schedule.meetingPoint],['Kontakti',schedule.contact],['Shënime',schedule.notes]])+table('Plani i xhirimit',[
   ['Ora',r=>r.start+' → '+r.end],['Lloji',r=>ProductiondeckSchedule.types[r.type]],['Skena / plani','shot'],['Përshkrimi','description'],['Lokacioni',r=>[r.locationId?name(r.locationId):'',r.locationText].filter(Boolean).join(' · ')],['Kasting',r=>r.talentIds.map(name).join(', ')],['Rekuizita',r=>r.propIds.map(name).join(', ')],['Shënime','notes']
  ],ProductiondeckSchedule.timeline(schedule))});
 }
 function callPreview(sheet,edit){const model=ProductiondeckCallSheet;preview({title:sheet.title,kind:'Call sheet',edit,html:pairs([['Dita',sheet.dayNumber+' / '+sheet.totalDays],['Statusi',sheet.status==='issued'?'Issued':'Draft'],...Object.entries(model.fields).filter(([key])=>key!=='title').map(([key,[label]])=>[label,sheet[key]])])+Object.entries(model.groups).map(([key,group])=>table(group.title,Object.entries(group.fields).map(([field,[label]])=>[label,field]),sheet[key])).join('')})}
 document.addEventListener('click',event=>{document.querySelectorAll('.document-menu[open]').forEach(menu=>{if(!menu.contains(event.target)||event.target.closest('button'))menu.open=false})});
 document.addEventListener('toggle',event=>{if(event.target.matches?.('.document-menu[open]'))document.querySelectorAll('.document-menu[open]').forEach(menu=>{if(menu!==event.target)menu.open=false})},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.document-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus()})});
 globalThis.ProductiondeckHistory=Object.freeze({menu,controls,filter,preview,schedulePreview,callPreview});
})();
