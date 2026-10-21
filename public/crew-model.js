/* Shared crew-directory fields. No photos, login accounts, or permissions are created here. */
(()=>{
 const roles=Object.freeze({dp:'Drejtor fotografie (DP)',camera_operator:'Operator kamere',camera_assistant:'Asistent kamere (1st AC)',gaffer:'Ndriçues (Gaffer)',grip:'Grip',sound_recordist:'Tonist',makeup_artist:'Grimer / Makeup artist',hair_stylist:'Stilist flokësh',costume_designer:'Kostumograf',drone_operator:'Operator droni'});
 const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
 const fold=value=>ProductiondeckTaxonomy.fold(value);
 const known=new Map(Object.entries(roles).flatMap(([key,label])=>[[fold(key),key],[fold(label),key]]));
 for(const [alias,key] of Object.entries({'DP':'dp','Director of Photography':'dp','Cinematographer':'dp','Camera Operator':'camera_operator','1st AC':'camera_assistant','Camera Assistant':'camera_assistant','Gaffer':'gaffer','Sound Recordist':'sound_recordist','Makeup Artist':'makeup_artist','Hair Stylist':'hair_stylist','Costume Designer':'costume_designer','Drone Operator':'drone_operator'}))known.set(fold(alias),key);
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter valid crew member details.');
  const firstName=clean(input.firstName,100),lastName=clean(input.lastName,100);if(!firstName||!lastName)throw Error('Enter the person’s name and surname.');
  if(!Array.isArray(input.roles)||input.roles.length>10||input.roles.some(key=>typeof key!=='string'||!Object.hasOwn(roles,key)))throw Error('Choose roles from the list.');
  if(!Array.isArray(input.customRoles)||input.customRoles.length>5||input.customRoles.some(value=>typeof value!=='string'||!value.trim()||value.trim().length>80))throw Error('Use up to five other roles, with up to 80 characters each.');
  const selected=new Set(input.roles),customRoles=[],seen=new Set();
  for(const value of input.customRoles){const name=value.trim(),key=fold(name),existing=known.get(key);if(existing)selected.add(existing);else if(!seen.has(key)){customRoles.push(name);seen.add(key)}}
  if(!selected.size&&!customRoles.length)throw Error('Choose at least one role or enter another role.');
  const city=clean(input.city,120),canonicalCity=ProductiondeckTaxonomy.canonicalCity(city);if(city&&!canonicalCity)throw Error('Choose a city from the list.');
  const email=clean(input.email,320).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
  if(!['yes','no','unknown'].includes(input.workedBefore))throw Error('Choose a past collaboration status.');
  return {firstName,lastName,roles:[...selected],customRoles,city:canonicalCity,phone:clean(input.phone,100),email,dailyRate:clean(input.dailyRate,100),workedBefore:input.workedBefore,notes:clean(input.notes,3000)};
 }
 const labels=person=>[...(person.roles||[]).map(key=>roles[key]).filter(Boolean),...(person.customRoles||[])];
 const phoneLink=value=>{const text=String(value||'').trim();if(!/^\+?[\d\s()./-]{3,100}$/.test(text)||text.replace(/\D/g,'').length<3)return '';return 'tel:'+text.replace(/[^+\d]/g,'')};
 const fresh=()=>({firstName:'',lastName:'',roles:[],customRoles:[],city:'',phone:'',email:'',dailyRate:'',workedBefore:'unknown',notes:''});
 globalThis.ProductiondeckCrew=Object.freeze({roles,validate,labels,fold,phoneLink,fresh});
})();
