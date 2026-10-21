/* Standalone shared shooting schedules. Library data stays behind the existing session. */
(()=>{
 const $=selector=>document.querySelector(selector),model=globalThis.ProductiondeckSchedule;
 let api,post,catalog,escape,saved=[],current=null,draft=null,dirty=false,busy=false,pdfBusy=false,controller=null,loadSequence=0;
 const row=(type='scene',description='',duration=30)=>({id:crypto.randomUUID(),type,description,duration,shot:'',locationId:'',locationText:'',talentIds:[],propIds:[],notes:''});
 const fresh=()=>({title:'Shoot day',project:'',date:'',startTime:'08:00',crewCall:'07:30',client:'',meetingPoint:'',contact:'',notes:'',rows:[row('setup','Përgatitja e setit',30),row('scene','',60),row('break','Pushimi i drekës',30),row('scene','',60),row('wrap','Përfundimi i xhirimit',15)]});
 const label=id=>catalog.items.find(item=>item.id===id)?.title||draft?.referenceLabels?.[id]||'Reference removed';
 const listDate=date=>date?date.split('-').reverse().join('.'):'Date not set';
 const message=value=>{$('#schedule-error').textContent=value};
 function read(){
  if(!draft)return;for(const name of ['title','project','date','startTime','crewCall','client','meetingPoint','contact','notes'])draft[name]=$('#schedule-form').elements[name].value;
  draft.rows=[...$('#schedule-rows').children].map(card=>{const value=name=>card.querySelector('[name="'+name+'"]').value;return {id:card.dataset.rowId,type:value('rowType'),duration:Number(value('duration')),shot:value('shot'),description:value('description'),locationId:value('locationId'),locationText:value('locationText'),notes:value('rowNotes'),talentIds:[...card.querySelectorAll('[name=talent]:checked')].map(el=>el.value),propIds:[...card.querySelectorAll('[name=prop]:checked')].map(el=>el.value)}});
 }
 function timings(){
  if(!draft||!model.time(draft.startTime))return;const timeline=model.timeline(draft);
  for(const [index,card] of [...$('#schedule-rows').children].entries()){card.querySelector('.schedule-row-time').textContent=timeline[index].start+' → '+timeline[index].end;card.querySelector('.schedule-row-number').textContent=String(index+1).padStart(2,'0')}
  const total=draft.rows.reduce((sum,row)=>sum+(Number(row.duration)||0),0);$('#schedule-total').textContent=draft.rows.length+' rows · '+Math.floor(total/60)+'h '+total%60+'m'+(timeline.length?' · Wrap '+timeline.at(-1).end:'');
 }
 function choices(type,ids){
  const available=catalog.items.filter(item=>item.type===type),missing=ids.filter(id=>!available.some(item=>item.id===id));
  return [...available,...missing.map(id=>({id,title:label(id)+' (removed)'}))].map(item=>`<label><input type="checkbox" name="${type==='casting'?'talent':'prop'}" value="${escape(item.id)}" ${ids.includes(item.id)?'checked':''}>${escape(item.title)}</label>`).join('')||'<small class="muted">No references yet. Add them in the library.</small>';
 }
 function renderRows(){
  const locations=catalog.items.filter(item=>item.type==='location');
  $('#schedule-rows').innerHTML=draft.rows.map((item,index)=>`<section class="schedule-row" data-row-id="${item.id}"><div class="schedule-row-head"><span class="schedule-row-number">${index+1}</span><strong class="schedule-row-time"></strong><div class="schedule-row-actions"><button type="button" class="icon" data-row-action="up" aria-label="Move row up" ${index===0?'disabled':''}>↑</button><button type="button" class="icon" data-row-action="down" aria-label="Move row down" ${index===draft.rows.length-1?'disabled':''}>↓</button><button type="button" class="text-button" data-row-action="duplicate">Duplicate</button><button type="button" class="text-button" data-row-action="remove">Remove</button></div></div><div class="schedule-row-fields" lang="sq"><label>Lloji<select name="rowType">${Object.entries(model.types).map(([key,value])=>`<option value="${key}" ${item.type===key?'selected':''}>${value}</option>`).join('')}</select></label><label>Kohëzgjatja (min)<input name="duration" type="number" min="1" max="720" required value="${item.duration}"></label><label>Skena / plani<input name="shot" maxlength="50" value="${escape(item.shot)}" placeholder="p.sh. 01 / A"></label><label class="schedule-wide">Përshkrimi<textarea name="description" maxlength="500" rows="2" placeholder="Çfarë do të xhirohet?">${escape(item.description)}</textarea></label><label>Lokacioni<select name="locationId"><option value="">Zgjidhni nga biblioteka</option>${locations.map(location=>`<option value="${location.id}" ${location.id===item.locationId?'selected':''}>${escape(location.title)}</option>`).join('')}${item.locationId&&!locations.some(location=>location.id===item.locationId)?`<option value="${escape(item.locationId)}" selected>${escape(label(item.locationId))} (removed)</option>`:''}</select></label><label class="schedule-wide">Lokacion / adresë shtesë<input name="locationText" maxlength="300" value="${escape(item.locationText)}" placeholder="p.sh. Studio 2, hyrja nga oborri"></label><details class="schedule-reference-picker"><summary>Kasting (${item.talentIds.length})</summary><div>${choices('casting',item.talentIds)}</div></details><details class="schedule-reference-picker"><summary>Rekuizita (${item.propIds.length})</summary><div>${choices('prop',item.propIds)}</div></details><label class="schedule-wide">Shënime<textarea name="rowNotes" rows="2" maxlength="1000" placeholder="Pajisjet, veshjet, udhëzimet…">${escape(item.notes)}</textarea></label></div></section>`).join('');timings();$('#schedule-empty').hidden=Boolean(draft.rows.length);
 }
 function showList(){
  const visible=ProductiondeckHistory.filter(saved,'schedule');
  $('#schedule-list').innerHTML=saved.length?(visible.length?visible.map(schedule=>`<article class="schedule-card"><div class="document-card-heading"><p class="eyebrow">${escape(listDate(schedule.date))}</p>${ProductiondeckHistory.menu('schedule',schedule.id,schedule.title,'Duplicate day')}</div><h2>${escape(schedule.title)}</h2><p>${escape(schedule.project||schedule.client||'Shooting schedule')}</p><small>${schedule.rows.length} rows · ${escape(schedule.startTime)}${schedule.rows.length?' → '+escape(model.timeline(schedule).at(-1).end):''}</small><div class="row"><button type="button" class="secondary" data-schedule-preview="${schedule.id}">Preview</button><button type="button" class="text-button" data-schedule-open="${schedule.id}">Edit</button></div></article>`).join(''):'<p class="muted">No saved schedules match your search.</p>'):'<div class="empty"><span>▤</span><h2>Your next shoot, planned.</h2><p>Create a shoot day, plan the timing, and export a schedule for your crew.</p><button type="button" class="primary" id="schedule-first">+ New schedule</button></div>';
 }
 async function reload(){const sequence=++loadSequence;$('#schedule-page-error').textContent='';try{const records=await api('schedules');if(sequence!==loadSequence)return;saved=records.sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||a.title.localeCompare(b.title));showList()}catch(error){if(sequence===loadSequence)$('#schedule-page-error').textContent=error.message}}
 function open(schedule,duplicate=false){
  current=duplicate?null:schedule||null;draft=schedule?structuredClone(schedule):fresh();
  if(duplicate){delete draft.id;delete draft.revision;draft.title=(draft.title+' — copy').slice(0,100);draft.date='';draft.rows=draft.rows.map(item=>({...item,id:crypto.randomUUID()}))}
  $('#schedule-form').reset();for(const name of ['title','project','date','startTime','crewCall','client','meetingPoint','contact','notes'])$('#schedule-form').elements[name].value=draft[name]||'';
  $('#schedule-editor-title').textContent=current?'Edit shooting schedule':'New shooting schedule';message('');$('#schedule-status').textContent='';dirty=duplicate;renderRows();$('#schedule-editor').showModal();$('#schedule-form').elements.title.focus();
 }
 function close(){if(busy)return;if(dirty&&!confirm('Discard unsaved changes to this schedule?'))return;controller?.abort();dirty=false;$('#schedule-editor').close()}
 function init(dependencies){
  ({api,post,state:catalog,esc:escape}=dependencies);
  const history=ProductiondeckHistory.controls('schedule','shooting schedules');history.addEventListener('input',showList);history.addEventListener('change',showList);
  $('#schedule-new').onclick=()=>open();
  $('#schedule-list').onclick=async event=>{
   if(event.target.id==='schedule-first'){open();return}
   const target=event.target.closest('button');if(!target)return;const id=target.dataset.schedulePreview||target.dataset.scheduleOpen||target.dataset.scheduleCopy||target.dataset.scheduleDelete,schedule=saved.find(item=>item.id===id);if(!schedule)return;
   if(target.dataset.schedulePreview)ProductiondeckHistory.schedulePreview(schedule,catalog.items,()=>open(schedule));else if(target.dataset.scheduleOpen)open(schedule);else if(target.dataset.scheduleCopy)open(schedule,true);else if(confirm('Delete “'+schedule.title+'”? Library references will be kept.')){target.disabled=true;try{await api('schedules/'+id,{method:'DELETE'});await reload()}catch(error){$('#schedule-page-error').textContent=error.message;target.disabled=false}}
  };
  $('#schedule-editor').addEventListener('cancel',event=>{event.preventDefault();close()});$('#schedule-close').onclick=close;$('#schedule-cancel').onclick=close;
  $('#schedule-editor').addEventListener('close',()=>{controller?.abort();current=null;draft=null;dirty=false});
  $('#schedule-form').addEventListener('input',()=>{if(busy||pdfBusy)return;read();dirty=true;$('#schedule-status').textContent='Unsaved changes';timings()});
  $('#schedule-form').addEventListener('change',event=>{if(event.target.name==='talent'||event.target.name==='prop'){const details=event.target.closest('details'),type=event.target.name==='talent'?'Kasting':'Rekuizita';details.querySelector('summary').textContent=type+' ('+details.querySelectorAll('input:checked').length+')'}});
  $('#schedule-add-row').onclick=()=>{read();if(draft.rows.length>=100){message('Use up to 100 rows.');return}draft.rows.push(row());dirty=true;$('#schedule-status').textContent='Unsaved changes';renderRows();$('#schedule-rows').lastElementChild.scrollIntoView({block:'nearest'})};
  $('#schedule-rows').onclick=event=>{const action=event.target.closest('[data-row-action]');if(!action||busy||pdfBusy)return;read();const index=draft.rows.findIndex(item=>item.id===action.closest('[data-row-id]').dataset.rowId),name=action.dataset.rowAction;
   if(name==='duplicate'){if(draft.rows.length>=100){message('Use up to 100 rows.');return}draft.rows.splice(index+1,0,{...structuredClone(draft.rows[index]),id:crypto.randomUUID()})}
   if(name==='remove'){if(!confirm('Remove this schedule row?'))return;draft.rows.splice(index,1)}
   if(name==='up'&&index>0)[draft.rows[index-1],draft.rows[index]]=[draft.rows[index],draft.rows[index-1]];
   if(name==='down'&&index<draft.rows.length-1)[draft.rows[index+1],draft.rows[index]]=[draft.rows[index],draft.rows[index+1]];
   dirty=true;$('#schedule-status').textContent='Unsaved changes';renderRows();
  };
  $('#schedule-form').onsubmit=async event=>{
   event.preventDefault();if(busy||pdfBusy)return;read();message('');let data;try{data=model.validate(draft)}catch(error){message(error.message);return}
   busy=true;$('#schedule-save').disabled=true;$('#schedule-download').disabled=true;$('#schedule-status').textContent='Saving…';$('#schedule-fields').disabled=true;
   try{const document=await post(current?'schedules/'+current.id:'schedules',{...data,revision:current?.revision},current?'PUT':'POST');current=document;draft={...draft,...document};dirty=false;$('#schedule-status').textContent='Saved for your team.';$('#schedule-editor-title').textContent='Edit shooting schedule';await reload()}
   catch(error){message(error.message);$('#schedule-status').textContent='Changes have not been saved.'}
   finally{busy=false;$('#schedule-fields').disabled=false;$('#schedule-save').disabled=false;$('#schedule-download').disabled=false}
  };
  $('#schedule-download').onclick=async()=>{
   if(busy||pdfBusy||!$('#schedule-form').reportValidity())return;read();message('');let data;try{data=model.validate(draft);if(!data.rows.length)throw Error('Add at least one row before exporting.')}catch(error){message(error.message);return}
   pdfBusy=true;$('#schedule-fields').disabled=true;$('#schedule-save').disabled=true;$('#schedule-download').disabled=true;controller=new AbortController();
   try{const blob=await ProductiondeckSchedulePDF.generate({schedule:{...data,referenceLabels:draft.referenceLabels},items:structuredClone(catalog.items),signal:controller.signal,progress:message=>{$('#schedule-status').textContent=message}});if(controller.signal.aborted)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=ProductiondeckPDF.filename((data.project?data.project+' - ':'')+data.title+(data.date?' - '+data.date:''));document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#schedule-status').textContent='PDF downloaded.'+(dirty||!current?' Save to keep these changes for the team.':'')}
   catch(error){if(error.name!=='AbortError')message(error.message);$('#schedule-status').textContent=''}finally{controller=null;pdfBusy=false;$('#schedule-fields').disabled=false;$('#schedule-save').disabled=false;$('#schedule-download').disabled=false}
  };
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
 }
 function route(){const active=location.hash==='#schedules';$('#app').classList.toggle('schedule-workspace-mode',active);$('#schedule-nav').classList.toggle('active',active);if(active){$('#breadcrumb').textContent='Shooting Schedules';reload()}return active}
 globalThis.ProductiondeckScheduleUI=Object.freeze({init,route});
})();
