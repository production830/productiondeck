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
  const gender=input.gender||'';if((!review&&gender==='')||(gender!==''&&!Object.hasOwn(ProductiondeckTaxonomy.genders,gender)))throw Error('Zgjidhni një vlerë të vlefshme për gjininë.');
  // Roles are assigned privately by the team, never by a public applicant.
  const assignedInterests=review?(input.interests||[]):[];
  if(!Array.isArray(assignedInterests)||assignedInterests.length>5||assignedInterests.some(value=>!Object.hasOwn(interests,value)))throw Error('Zgjidhni një klasifikim të vlefshëm për kastingun.');
  const previousCommercial=input.previousCommercial||'unknown';if(!['yes','no','unknown'].includes(previousCommercial))throw Error('Zgjidhni nëse keni marrë pjesë në reklama më parë.');
  const previousCommercialProjects=previousCommercial==='yes'?text(input.previousCommercialProjects,1200):'',previousCommercialRole=previousCommercial==='yes'?text(input.previousCommercialRole,300):'';
  if(previousCommercial==='yes'&&(!previousCommercialProjects||!previousCommercialRole))throw Error('Shënoni reklamat / kompanitë dhe rolin tuaj në ato reklama.');
  const list=(value,max,count)=>{if(!Array.isArray(value)||value.length>count||value.some(item=>typeof item!=='string'||item.trim().length>max))throw Error('Shkurtoni listën e aftësive ose etiketave.');return [...new Set(value.map(item=>item.trim()).filter(Boolean))]};
  let showreel=text(input.showreel,1000);if(showreel){try{const url=new URL(showreel);if(url.protocol!=='https:'||url.username||url.password)throw Error();showreel=url.href}catch{throw Error('Përdorni një link të plotë HTTPS për portfolion.')}}
  if(!review&&input.consent!==true)throw Error('Konfirmoni pëlqimin për ruajtjen dhe shqyrtimin e aplikimit.');
  return {firstName,lastName,phone,email,city,gender,playingAge:text(input.playingAge,50),height:text(input.height,50),interests:[...new Set(assignedInterests)],previousCommercial,previousCommercialProjects,previousCommercialRole,languages:list(input.languages||[],50,20),skills:list(input.skills,80,20),showreel,experience:text(input.experience,3000),tags:review?list(input.tags||[],50,30):[]};
 }
 globalThis.ProductiondeckCastingApplication=Object.freeze({interests,consentVersion,validate});
})();
