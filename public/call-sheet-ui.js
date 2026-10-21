/* Independent call sheets, with explicit one-time schedule import and local PDF export. */
(()=>{
 const $=selector=>document.querySelector(selector),model=globalThis.ProductiondeckCallSheet;
 let api,post,state,esc,saved=[],schedules=[],draft=null,current=null,dirty=false,busy=false,exporting=false,controller=null,sequence=0;
 const status=value=>{$('#call-status').textContent=value},error=value=>{$('#call-error').textContent=value};
 const date=value=>value?value.split('-').reverse().join('.'):'Date not set';
 const textareaKeys=['meetingPoint','safety','notes','address','parking','scene'];
 function input(key,value,max,{row=false}={}){
  const name=row?'data-field="'+key+'"':'name="'+key+'"',multiline=textareaKeys.includes(key),kind=key==='date'?'date':['generalCall','shootStart','breakfast','lunch','sunrise','sunset','pickup','call','makeup','wardrobe','onSet'].includes(key)?'time':key==='mapUrl'?'url':'text';
  return multiline?`<textarea ${name} rows="2" maxlength="${max}">${esc(value||'')}</textarea>`:`<input ${name} type="${kind}" maxlength="${max}" value="${esc(value||'')}" ${key==='title'?'required':''} ${key==='mapUrl'?'placeholder="https://…"':''}>`;
 }
 function section(keys){return '<div class="form-grid" lang="sq">'+keys.map(key=>`<label class="${['safety','notes','meetingPoint'].includes(key)?'wide':''}">${model.fields[key][0]}${key==='title'?' *':''}${input(key,draft[key],model.fields[key][1])}</label>`).join('')+'</div>'}
 function renderFields(){
  $('#call-production-fields').innerHTML=section(['title','project','client','date'])+`<div class="form-grid" lang="sq"><label>Dita e xhirimit<input name="dayNumber" type="number" min="1" max="365" required value="${draft.dayNumber}"></label><label>Gjithsej ditë<input name="totalDays" type="number" min="1" max="365" required value="${draft.totalDays}"></label><label>Versioni / publikimi${input('issue',draft.issue,80)}</label><label>Statusi<select name="status"><option value="draft" ${draft.status==='draft'?'selected':''}>Draft</option><option value="issued" ${draft.status==='issued'?'selected':''}>Issued</option></select></label></div>`;
  $('#call-timing-fields').innerHTML=section(['generalCall','shootStart','breakfast','lunch','wrap','meetingPoint','productionContact']);
  $('#call-safety-fields').innerHTML=section(['weather','temperature','sunrise','sunset','hospital','hospitalAddress','hospitalPhone','emergency','safety','notes']);
 }
 function renderRows(){for(const [group,definition] of Object.entries(model.groups)){
  $('#call-'+group+'-rows').innerHTML=draft[group].map((row,index)=>`<section class="call-entry" data-call-group="${group}" data-call-row="${row.id}"><div class="call-entry-head"><strong>${String(index+1).padStart(2,'0')}</strong><div class="row"><button type="button" class="icon" data-call-action="up" aria-label="Move row up" ${index?'':'disabled'}>↑</button><button type="button" class="icon" data-call-action="down" aria-label="Move row down" ${index===draft[group].length-1?'disabled':''}>↓</button><button type="button" class="text-button" data-call-action="remove">Remove</button></div></div><div class="form-grid" lang="sq">${Object.entries(definition.fields).map(([key,[label,max]])=>`<label class="${['notes','scene'].includes(key)?'wide':''}">${label}${input(key,row[key],max,{row:true})}</label>`).join('')}</div></section>`).join('')||'<p class="muted">No entries yet.</p>';
 }}
 function read(){
  if(!draft)return;const form=$('#call-form');for(const key of Object.keys(model.fields))draft[key]=form.elements[key].value;
  draft.status=form.elements.status.value;draft.dayNumber=Number(form.elements.dayNumber.value);draft.totalDays=Number(form.elements.totalDays.value);
  for(const group of Object.keys(model.groups))draft[group]=[...$('#call-'+group+'-rows').querySelectorAll('[data-call-row]')].map(row=>({id:row.dataset.callRow,...Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value]))}));
 }
 function renderList(){
  const visible=ProductiondeckHistory.filter(saved,'call');
  $('#call-list').innerHTML=saved.length?(visible.length?visible.map(sheet=>`<article class="schedule-card"><div class="call-card-meta"><p class="eyebrow">${esc(date(sheet.date))}</p><span class="call-status-badge">${sheet.status==='issued'?'ISSUED':'DRAFT'}</span>${ProductiondeckHistory.menu('call',sheet.id,sheet.title)}</div><h2>${esc(sheet.title)}</h2><p>${esc(sheet.project||sheet.client||'Call sheet')}</p><small>Day ${sheet.dayNumber} of ${sheet.totalDays} · Crew call ${esc(sheet.generalCall||'not set')}</small><div class="row"><button type="button" class="secondary" data-call-preview="${sheet.id}">Preview</button><button type="button" class="text-button" data-call-open="${sheet.id}">Edit</button></div></article>`).join(''):'<p class="muted">No saved call sheets match your search.</p>'):'<div class="empty"><span>▤</span><h2>One clear plan for the whole crew.</h2><p>Start with a blank call sheet or import a saved shooting schedule, then add individual calls and production details.</p><button id="call-first" class="primary" type="button">+ New call sheet</button></div>';
 }
 async function reload(){const request=++sequence;$('#call-page-error').textContent='';try{const records=await api('call-sheets');if(request!==sequence)return;saved=records.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title));renderList()}catch(err){if(request===sequence)$('#call-page-error').textContent=err.message}}
 async function open(sheet,copy=false){
  current=copy?null:sheet||null;draft=sheet?structuredClone(sheet):model.fresh();if(copy){delete draft.id;delete draft.revision;draft.title=(draft.title+' — copy').slice(0,100);draft.date='';draft.status='draft';for(const group of Object.keys(model.groups))draft[group]=draft[group].map(row=>({...row,id:crypto.randomUUID()}))}
  dirty=copy;error('');status('');$('#call-import').innerHTML='<option value="">Choose saved shooting schedule…</option>';$('#call-import-note').textContent=draft.sourceScheduleId?'Imported schedule snapshot. Changes to the original schedule do not update this sheet.':'';
  renderFields();renderRows();$('#call-editor-title').textContent=current?'Edit call sheet':'New call sheet';$('#call-editor').showModal();$('#call-form').elements.title.focus();
  const opened=draft;try{const records=await api('schedules');if(draft!==opened)return;schedules=records;$('#call-import').innerHTML='<option value="">Choose saved shooting schedule…</option>'+records.map(item=>`<option value="${item.id}">${esc(item.title)} · ${esc(date(item.date))}</option>`).join('')}catch(err){if(draft===opened)$('#call-import-note').textContent='Could not load saved schedules. You can fill this call sheet manually. '+err.message}
 }
 function close(){if(busy)return;if(dirty&&!confirm('Discard unsaved changes to this call sheet?'))return;controller?.abort();dirty=false;$('#call-editor').close()}
 function init(dependencies){({api,post,state,esc}=dependencies);
  const history=ProductiondeckHistory.controls('call','call sheets');history.addEventListener('input',renderList);history.addEventListener('change',renderList);
  $('#call-new').onclick=()=>open();$('#call-close').onclick=close;$('#call-cancel').onclick=close;$('#call-editor').addEventListener('cancel',event=>{event.preventDefault();close()});$('#call-editor').addEventListener('close',()=>{controller?.abort();draft=null;current=null;dirty=false});
  $('#call-list').onclick=async event=>{if(event.target.id==='call-first'){open();return}const button=event.target.closest('button');if(!button)return;const id=button.dataset.callPreview||button.dataset.callOpen||button.dataset.callCopy||button.dataset.callDelete,sheet=saved.find(row=>row.id===id);if(!sheet)return;if(button.dataset.callPreview)ProductiondeckHistory.callPreview(sheet,()=>open(sheet));else if(button.dataset.callOpen)open(sheet);else if(button.dataset.callCopy)open(sheet,true);else if(confirm('Delete “'+sheet.title+'”? Schedules and library references will be kept.')){button.disabled=true;try{await api('call-sheets/'+id,{method:'DELETE'});await reload()}catch(err){$('#call-page-error').textContent=err.message;button.disabled=false}}};
  $('#call-form').addEventListener('input',event=>{if(busy||exporting||event.target.id==='call-import')return;read();dirty=true;status('Unsaved changes')});
  $('#call-form').addEventListener('click',event=>{
   const add=event.target.closest('[data-call-add]'),action=event.target.closest('[data-call-action]');if(!add&&!action||busy||exporting)return;read();
   if(add){const group=add.dataset.callAdd;if(draft[group].length>=100){error('Use up to 100 rows in each section.');return}draft[group].push(model.row(group))}
   else{const card=action.closest('[data-call-row]'),group=card.dataset.callGroup,index=draft[group].findIndex(row=>row.id===card.dataset.callRow);if(action.dataset.callAction==='remove'){if(!confirm('Remove this entry?'))return;draft[group].splice(index,1)}else{const next=index+(action.dataset.callAction==='up'?-1:1);if(next>=0&&next<draft[group].length)[draft[group][index],draft[group][next]]=[draft[group][next],draft[group][index]]}}
   dirty=true;status('Unsaved changes');renderRows();
  });
  $('#call-import-button').onclick=()=>{
   if(busy||exporting)return;const schedule=schedules.find(row=>row.id===$('#call-import').value);if(!schedule){error('Choose a saved shooting schedule first.');return}
   if(!confirm('Replace the current fields and rows with an editable copy of this schedule? The original schedule will be kept.'))return;
   try{draft=model.fromSchedule(schedule,state.items);dirty=true;renderFields();renderRows();error('');status('Schedule imported. Review the details, add individual calls, and save this call sheet.');$('#call-import-note').textContent='Imported as a copy. Individual cast calls, weather and emergency details need to be filled in.'}catch(err){error(err.message)}
  };
  $('#call-form').onsubmit=async event=>{event.preventDefault();if(busy||exporting)return;read();let data;try{data=model.validate(draft)}catch(err){error(err.message);return}busy=true;error('');status('Saving…');lock(true);
   try{const document=await post(current?'call-sheets/'+current.id:'call-sheets',{...data,revision:current?.revision},current?'PUT':'POST');current=document;draft={...draft,...document};dirty=false;status('Saved for your team.');$('#call-editor-title').textContent='Edit call sheet';await reload()}catch(err){error(err.message);status('Changes have not been saved.')}finally{busy=false;lock(false)}
  };
  $('#call-download').onclick=async()=>{if(busy||exporting||!$('#call-form').reportValidity())return;read();let data;try{data=model.validate(draft)}catch(err){error(err.message);return}exporting=true;error('');lock(true);controller=new AbortController();
   try{const blob=await ProductiondeckCallSheetPDF.generate({sheet:data,signal:controller.signal,progress:status});if(controller.signal.aborted)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=ProductiondeckPDF.filename((data.project?data.project+' - ':'')+data.title+(data.date?' - '+data.date:'')+' - '+data.status);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('PDF downloaded.'+(dirty||!current?' Save to keep these changes for the team.':''))}catch(err){if(err.name!=='AbortError')error(err.message);status('')}finally{controller=null;exporting=false;lock(false)}
  };
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
 }
 function lock(value){$('#call-fields').disabled=value;$('#call-save').disabled=value;$('#call-download').disabled=value}
 function route(){const active=location.hash==='#call-sheets';$('#app').classList.toggle('call-workspace-mode',active);$('#call-nav').classList.toggle('active',active);if(active){$('#breadcrumb').textContent='Call Sheets';reload()}return active}
 globalThis.ProductiondeckCallSheetUI=Object.freeze({init,route});
})();
