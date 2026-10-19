/* Shared fixed vocabulary used by both the browser and the Worker. */
(()=>{
 const labels=Object.freeze({location:'Location',prop:'Props',casting:'Casting'});
 const subcategories=Object.freeze([
  'City','Village','Outdoors','Indoors','Exterior','Interior','Car','Bus','Truck','Apartment','Building','Corporate','Office','Field','Stadium','Medical',
  'House','Villa','Loft','Penthouse','Studio','Bedroom','Living Room','Kitchen','Bathroom','Dining Room','Hallway','Staircase','Elevator','Basement','Attic','Garage','Rooftop','Balcony','Terrace','Courtyard','Garden','Park','Forest','Mountain','Beach','Lake','River','Farm','Barn','Road','Street','Bridge','Tunnel','Parking Lot','Warehouse','Factory','Workshop','Construction Site','Shop','Supermarket','Shopping Mall','Restaurant','Cafe','Bar','Hotel','School','University','Library','Museum','Theatre','Cinema','Church','Mosque','Gym','Swimming Pool','Sports Court','Hospital','Clinic','Laboratory','Pharmacy','Airport','Train Station','Furniture','Lighting','Electronics','Clothing','Accessories','Tools','Tableware','Actor','Model','Presenter','Voice Artist','Extra'
 ]);
 const normalize=value=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):'';
 const lookup=new Map(subcategories.map(value=>[normalize(value),value]));
 for(const [alias,target] of [['outdoor','Outdoors'],['indoor','Indoors'],['outdoor / exterior','Exterior'],['indoor / interior','Interior'],['voice-over','Voice Artist'],['voice artist','Voice Artist'],['voice actor','Voice Artist'],['café','Cafe'],['theater','Theatre'],['apartment / flat','Apartment'],['flat','Apartment'],['parking','Parking Lot'],['garden / terrace','Garden']])lookup.set(alias,target);
 const canonical=value=>lookup.get(normalize(value))||'';
 const isMain=value=>['location','locations','prop','props','casting','casting / talent'].includes(normalize(value));
 function legacyOf(item){return typeof item.legacyCategory==='string'&&item.legacyCategory.trim()?item.legacyCategory.trim():typeof item.category==='string'&&!isMain(item.category)?item.category.trim():''}
 function fromItem(item){
  if(Array.isArray(item.subcategories))return [...new Set(item.subcategories.map(canonical).filter(Boolean))].slice(0,5);
  const value=canonical(legacyOf(item));return value?[value]:[];
 }
 function record(item){return {...item,category:labels[item.type]||'',subcategories:fromItem(item),legacyCategory:legacyOf(item)}}
 globalThis.ProductiondeckTaxonomy=Object.freeze({labels,subcategories,canonical,normalize,isMain,legacyOf,fromItem,record});
})();
