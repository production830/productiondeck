/* Standard commercial call-sheet fields; documents remain editable snapshots. */
(()=>{
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
 const fields=Object.freeze({title:['Emri i call sheet',100],project:['Projekti',150],client:['Klienti',150],date:['Data e xhirimit',10],generalCall:['Thirrja e ekipit',5],shootStart:['Fillimi i xhirimit',5],breakfast:['Mëngjesi',5],lunch:['Dreka',5],wrap:['Përfundimi i pritshëm',20],meetingPoint:['Pika e takimit',500],productionContact:['Kontakti i produksionit',300],weather:['Parashikimi i motit',300],temperature:['Temperatura',80],sunrise:['Lindja e diellit',5],sunset:['Perëndimi i diellit',5],hospital:['Spitali më i afërt',200],hospitalAddress:['Adresa e spitalit',500],hospitalPhone:['Telefoni i spitalit',100],emergency:['Numri i emergjencës',100],safety:['Siguria / udhëzime',2000],notes:['Njoftime të përgjithshme',2000],issue:['Versioni / publikimi',80]});
 const groups=Object.freeze({locations:{title:'Lokacionet / parkingu',fields:{name:['Lokacioni',200],address:['Adresa',500],parking:['Parkingu / qasja',500],mapUrl:['Linku i hartës (HTTPS)',1000],notes:['Shënime',500]}},crew:{title:'Ekipi / kontaktet kryesore',fields:{department:['Departamenti',100],role:['Pozita',100],name:['Emri',150],phone:['Telefoni / kontakti',200],call:['Ora e thirrjes',5],notes:['Shënime',500]}},cast:{title:'Kasting / oraret individuale',fields:{name:['Emri i talentit',150],role:['Roli',150],contact:['Kontakti / agjenti',200],pickup:['Nisja / transporti',5],call:['Mbërritja',5],makeup:['Grimi',5],wardrobe:['Garderoba',5],onSet:['Në set',5],notes:['Shënime',500]}},plan:{title:'Plani i ditës',fields:{start:['Fillimi (24h)',20],end:['Mbarimi (24h)',20],scene:['Skena / veprimi',500],location:['Lokacioni',300],cast:['Kasting / rekuizita',500],notes:['Shënime',1000]}}});
 const clock=(value,overnight=false)=>!value||new RegExp('^([01]\\d|2[0-3]):[0-5]\\d'+(overnight?'( \\(\\+1d\\))?':'')+'$').test(value);
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter valid call sheet details.');const data={};
  for(const [key,[,max]] of Object.entries(fields))data[key]=clean(input[key],max);
  if(!data.title)throw Error('Give this call sheet a name.');
  if(data.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date+'T12:00:00Z'))||new Date(data.date+'T12:00:00Z').toISOString().slice(0,10)!==data.date))throw Error('Choose a valid shoot date.');
  for(const key of ['generalCall','shootStart','breakfast','lunch','sunrise','sunset','wrap'])if(!clock(data[key],key==='wrap'))throw Error('Use a valid 24-hour time for '+fields[key][0]+'.');
  if(!['draft','issued'].includes(input.status))throw Error('Choose Draft or Issued.');data.status=input.status;
  for(const key of ['dayNumber','totalDays']){if(!Number.isInteger(input[key])||input[key]<1||input[key]>365)throw Error('Shoot day numbers must be between 1 and 365.');data[key]=input[key]}if(data.dayNumber>data.totalDays)throw Error('The shoot day cannot exceed the total number of days.');
  data.sourceScheduleId=clean(input.sourceScheduleId,36);if(data.sourceScheduleId&&!uuid.test(data.sourceScheduleId))throw Error('Choose a valid source schedule.');
  for(const [group,definition] of Object.entries(groups)){
   if(!Array.isArray(input[group])||input[group].length>100)throw Error('Use up to 100 rows in each call sheet section.');const ids=new Set();
   data[group]=input[group].map(row=>{if(!row||typeof row!=='object'||!uuid.test(row.id)||ids.has(row.id))throw Error('Each section must have unique row identifiers.');ids.add(row.id);const out={id:row.id};for(const [key,[,max]] of Object.entries(definition.fields))out[key]=clean(row[key],max);
    for(const key of ['pickup','call','makeup','wardrobe','onSet','start','end'])if(Object.hasOwn(out,key)&&!clock(out[key],['start','end'].includes(key)))throw Error('Use valid 24-hour times in '+definition.title+'.');
    if(out.mapUrl){try{const url=new URL(out.mapUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();out.mapUrl=url.href}catch{throw Error('Use a complete HTTPS map link.')}}return out;
   });
  }
  return data;
 }
 function row(group){return {id:crypto.randomUUID(),...Object.fromEntries(Object.keys(groups[group].fields).map(key=>[key,'']))}}
 function fresh(){return {title:'Call sheet',project:'',client:'',date:'',generalCall:'',shootStart:'',breakfast:'',lunch:'',wrap:'',meetingPoint:'',productionContact:'',weather:'',temperature:'',sunrise:'',sunset:'',hospital:'',hospitalAddress:'',hospitalPhone:'',emergency:'',safety:'',notes:'',issue:'v1',status:'draft',dayNumber:1,totalDays:1,sourceScheduleId:'',locations:[row('locations')],crew:[{...row('crew'),role:'Producent'}],cast:[],plan:[]}}
 function fromSchedule(schedule,items=[]){
  const base=fresh(),timeline=ProductiondeckSchedule.timeline(ProductiondeckSchedule.validate(schedule)),find=id=>items.find(item=>item.id===id),name=id=>find(id)?.title||schedule.referenceLabels?.[id]||'Reference removed';
  Object.assign(base,{title:schedule.title,project:schedule.project||'',client:schedule.client||'',date:schedule.date||'',generalCall:schedule.crewCall||'',shootStart:schedule.startTime,wrap:timeline.at(-1)?.end||'',meetingPoint:schedule.meetingPoint||'',productionContact:schedule.contact||'',notes:schedule.notes||'',sourceScheduleId:uuid.test(schedule.id)?schedule.id:'',locations:[],cast:[]});
  const locations=new Map(),talent=new Set();
  base.plan=timeline.map(item=>{
   if(item.locationId||item.locationText){const key=item.locationId||item.locationText;if(!locations.has(key))locations.set(key,{...row('locations'),name:item.locationId?name(item.locationId):item.locationText,address:find(item.locationId)?.address||'',notes:item.locationText||''})}
   for(const id of item.talentIds)talent.add(id);
   return {...row('plan'),start:item.start,end:item.end,scene:[item.shot,ProductiondeckSchedule.types[item.type],item.description].filter(Boolean).join(' · '),location:[item.locationId?name(item.locationId):'',item.locationText].filter(Boolean).join(' · '),cast:[item.talentIds.length?'Kasting: '+item.talentIds.map(name).join(', '):'',item.propIds.length?'Rekuizita: '+item.propIds.map(name).join(', '):''].filter(Boolean).join(' / '),notes:item.notes||''};
  });
  base.locations=[...locations.values()];base.cast=[...talent].map(id=>({...row('cast'),name:name(id),contact:find(id)?.contact||''}));return validate(base);
 }
 globalThis.ProductiondeckCallSheet=Object.freeze({fields,groups,validate,fresh,row,fromSchedule,clock});
})();
