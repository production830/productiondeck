/* Shared schedule rules: stable data values, Albanian reference fields. */
(()=>{
 const types=Object.freeze({scene:'Xhirim',setup:'Përgatitje',travel:'Udhëtim',break:'Pushim',wrap:'Përfundim'});
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
 const time=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter valid shooting schedule details.');
  const title=text(input.title,100);if(!title)throw Error('Give this shoot day a name.');
  const date=text(input.date,10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw Error('Choose a valid shoot date.');
  if(!time(input.startTime))throw Error('Choose a start time in 24-hour format.');
  const crewCall=text(input.crewCall,5);if(crewCall&&!time(crewCall))throw Error('Choose a valid crew call time.');
  if(!Array.isArray(input.rows)||input.rows.length>100)throw Error('Use up to 100 schedule rows.');
  const ids=new Set();
  const rows=input.rows.map(row=>{
   if(!row||typeof row!=='object'||!uuid.test(row.id)||ids.has(row.id))throw Error('Schedule rows must have unique identifiers.');ids.add(row.id);
   if(!Object.hasOwn(types,row.type))throw Error('Choose a valid row type.');
   if(!Number.isInteger(row.duration)||row.duration<1||row.duration>720)throw Error('Each duration must be between 1 and 720 minutes.');
   const selected=(value)=>{if(!Array.isArray(value)||value.length>30||value.some(id=>typeof id!=='string'||!uuid.test(id)))throw Error('Choose valid references for each schedule row.');return [...new Set(value)]};
   const locationId=text(row.locationId,36);if(locationId&&!uuid.test(locationId))throw Error('Choose a valid location.');
   return {id:row.id,type:row.type,duration:row.duration,shot:text(row.shot,50),description:text(row.description,500),locationId,locationText:text(row.locationText,300),talentIds:selected(row.talentIds),propIds:selected(row.propIds),notes:text(row.notes,1000)};
  });
  if(rows.reduce((sum,row)=>sum+row.duration,0)>1440)throw Error('A shooting schedule can cover up to 24 hours. Use another shoot day for longer plans.');
  return {title,project:text(input.project,150),date,startTime:input.startTime,crewCall,client:text(input.client,150),meetingPoint:text(input.meetingPoint,500),contact:text(input.contact,300),notes:text(input.notes,2000),rows};
 }
 const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
 const clock=total=>String(Math.floor((total%1440)/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')+(total>=1440?' (+'+Math.floor(total/1440)+'d)':'');
 function timeline(schedule){let at=minutes(schedule.startTime);return schedule.rows.map(row=>{const start=at;at+=Number(row.duration)||0;return {...row,start:clock(start),end:clock(at)}})}
 const referenceIds=schedule=>[...new Set(schedule.rows.flatMap(row=>[row.locationId,...row.talentIds,...row.propIds]).filter(Boolean))];
 globalThis.ProductiondeckSchedule=Object.freeze({types,validate,time,clock,timeline,referenceIds});
})();
