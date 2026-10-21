/* Applicant-entered fields only. Profile publication is a separate authenticated decision. */
(()=>{
 const interests=Object.freeze({Actor:'Aktor / aktore',Model:'Model / modele',Presenter:'Prezantues / prezantuese','Voice Artist':'Interpretim me zë',Extra:'Figurant / figurante'});
 const consentVersion='casting-2026-10-v1';
 const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
 function validate(input,{review=false}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Plotësoni të dhënat e aplikimit.');
  const firstName=text(input.firstName,100),lastName=text(input.lastName,100);if(!firstName||!lastName)throw Error('Shkruani emrin dhe mbiemrin.');
  const phone=text(input.phone,100),email=text(input.email,320).toLowerCase();if(phone.replace(/\D/g,'').length<5)throw Error('Shkruani një numër telefoni të vlefshëm.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Shkruani një adresë email të vlefshme.');
  const city=ProductiondeckTaxonomy.canonicalCity(input.city);if(!city)throw Error('Zgjidhni qytetin nga lista.');
  const gender=input.gender||'';if(gender!==''&&!Object.hasOwn(ProductiondeckTaxonomy.genders,gender))throw Error('Zgjidhni një vlerë të vlefshme për gjininë.');
  if(!Array.isArray(input.interests)||input.interests.length<1||input.interests.length>5||input.interests.some(value=>!Object.hasOwn(interests,value)))throw Error('Zgjidhni të paktën një fushë interesi.');
  const list=(value,max,count)=>{if(!Array.isArray(value)||value.length>count||value.some(item=>typeof item!=='string'||item.trim().length>max))throw Error('Shkurtoni listën e gjuhëve, aftësive ose etiketave.');return [...new Set(value.map(item=>item.trim()).filter(Boolean))]};
  let showreel=text(input.showreel,1000);if(showreel){try{const url=new URL(showreel);if(url.protocol!=='https:'||url.username||url.password)throw Error();showreel=url.href}catch{throw Error('Përdorni një link të plotë HTTPS për portfolion.')}}
  if(!review&&input.consent!==true)throw Error('Konfirmoni pëlqimin për ruajtjen dhe shqyrtimin e aplikimit.');
  return {firstName,lastName,phone,email,city,gender,playingAge:text(input.playingAge,50),height:text(input.height,50),interests:[...new Set(input.interests)],languages:list(input.languages,50,20),skills:list(input.skills,80,20),showreel,experience:text(input.experience,3000),tags:review?list(input.tags||[],50,30):[]};
 }
 globalThis.ProductiondeckCastingApplication=Object.freeze({interests,consentVersion,validate});
})();
