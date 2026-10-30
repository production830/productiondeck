/* Local, direct PDF generation. No reference data is sent to a PDF service. */
(()=>{
 let runtime,font;
 const alive=signal=>{if(signal?.aborted)throw new DOMException('Export cancelled','AbortError')};
 const clean=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 const filename=name=>(clean(name).replace(/[^\p{L}\p{N} ._-]/gu,'-').trim().replace(/^[.\s]+|[.\s]+$/g,'').slice(0,100)||'Project Deck')+'.pdf';
 async function loadRuntime(){
  if(globalThis.jspdf?.jsPDF)return globalThis.jspdf.jsPDF;
  if(!runtime)runtime=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/pdf/jspdf.umd.min.js';script.onload=()=>globalThis.jspdf?.jsPDF?resolve(globalThis.jspdf.jsPDF):reject(Error('The PDF software did not load. Refresh Productiondeck and retry.'));script.onerror=()=>{script.remove();reject(Error('The PDF software could not load. Refresh Productiondeck and retry.'))};document.head.append(script)}).catch(error=>{runtime=null;throw error});
  return runtime;
 }
 async function fontData(){
  if(!font)font=fetch('/vendor/pdf/NotoSans-Regular.ttf').then(async response=>{
   if(!response.ok)throw Error('The PDF font could not load. Refresh Productiondeck and retry.');
   const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
  }).catch(error=>{font=null;throw error});return font;
 }
 async function picture(url,{signal,refresh}={}){
  alive(signal);let response=await fetch(url,{credentials:'same-origin',signal});
  if(response.status===401&&refresh){await refresh();alive(signal);response=await fetch(url,{credentials:'same-origin',signal})}
  if(!response.ok)throw Error('A photo could not be loaded for the PDF. Please retry the export.');
  const object=URL.createObjectURL(await response.blob()),image=new Image();
  try{
   image.src=object;await image.decode();alive(signal);const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext('2d');if(!context)throw Error('This browser could not prepare the PDF photos.');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const format=url.endsWith('.svg')?'PNG':'JPEG';return {data:canvas.toDataURL(format==='PNG'?'image/png':'image/jpeg',0.85),format,width:canvas.width,height:canvas.height};
  }finally{image.src='';URL.revokeObjectURL(object)}
 }
 async function createDocument(options={}){
  const [PDF,encodedFont]=await Promise.all([loadRuntime(),fontData()]);
  const doc=new PDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true,...options});doc.addFileToVFS('NotoSans.ttf',encodedFont);doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans','normal');return doc;
 }
 const photosOf=item=>{const photos=item.images||[];return item.coverImage&&photos.includes(item.coverImage)?[item.coverImage,...photos.filter(id=>id!==item.coverImage)]:photos};
 async function generate({name,items,options={},signal,refresh,progress=()=>{}}){
  if(!Array.isArray(items)||!items.length)throw Error('Add at least one reference to this Project Deck.');
  alive(signal);progress('Preparing the PDF…');const [PDF,encodedFont]=await Promise.all([loadRuntime(),fontData()]);alive(signal);
  const doc=new PDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});doc.addFileToVFS('NotoSans.ttf',encodedFont);doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans','normal');
  doc.setProperties({title:clean(name),author:'Tatamata',subject:'Project Deck',creator:'Tatamata Productiondeck'});
  const logo=await picture('/brand/tatamata-horizontal.svg',{signal});
  const color={ink:[32,39,28],olive:[106,124,80],muted:[105,114,96],line:[220,226,211],paper:[246,248,240]};
  const textColor=colorName=>doc.setTextColor(...color[colorName]);
  const imageFit=(image,x,y,width,height,alias)=>{const ratio=Math.min(width/image.width,height/image.height);doc.addImage(image.data,image.format||'JPEG',x+(width-image.width*ratio)/2,y+(height-image.height*ratio)/2,image.width*ratio,image.height*ratio,alias,'FAST')};
  const background=()=>{doc.setFillColor(255,255,255);doc.rect(0,0,210,297,'F')};
  const rule=y=>{doc.setDrawColor(...color.line);doc.setLineWidth(.25);doc.line(18,y,192,y)};
  const header=()=>{background();imageFit(logo,18,10,42,9,'tatamata');doc.setFontSize(8);textColor('muted');doc.text('PRODUCTIONDECK / PROJECT DECK',192,15,{align:'right'});rule(23)};
  background();imageFit(logo,18,20,62,14,'tatamata');doc.setFontSize(9);textColor('olive');doc.text('PROJECT DECK',18,58);
  doc.setFontSize(30);textColor('ink');const title=doc.splitTextToSize(clean(name),174);doc.text(title,18,78,{lineHeightFactor:1.25});let coverY=78+(title.length-1)*13.3+13;
  doc.setFontSize(10);textColor('muted');doc.text(new Date().toLocaleDateString('sq-AL',{day:'numeric',month:'long',year:'numeric'})+'  /  '+items.length+' references',18,coverY);coverY+=10;
  doc.setFontSize(8);doc.text(options.internal?'INTERNAL DETAILS INCLUDED':'PROJECT SELECTION',18,coverY);coverY+=10;
  const coverPhotos=photosOf(items.find(item=>photosOf(item).length)||items[0]);const cover=coverPhotos.length?await picture('/media/'+encodeURIComponent(coverPhotos[0]),{signal,refresh}):null;alive(signal);
  const heroHeight=Math.min(105,248-coverY);doc.setFillColor(...color.paper);doc.rect(18,coverY,174,heroHeight,'F');if(cover)imageFit(cover,18,coverY,174,heroHeight,'photo-'+coverPhotos[0]);
  const counts=['location','prop','casting'].map(type=>({type,count:items.filter(item=>item.type===type).length}));
  doc.setFontSize(10);textColor('ink');doc.text(counts.map(({type,count})=>count+' '+({location:count===1?'location':'locations',prop:count===1?'prop':'props',casting:count===1?'casting profile':'casting profiles'}[type])).join('   /   '),18,265);
  let y=34,currentTitle='';
  const continuation=()=>{doc.addPage();header();doc.setFontSize(11);textColor('ink');const lines=doc.splitTextToSize(currentTitle+' (continued)',174);doc.text(lines,18,34);y=34+lines.length*5+7};
  const ensure=height=>{alive(signal);if(y+height>272)continuation()};
  const block=(label,value)=>{
   const text=clean(value).trim();if(!text)return;ensure(18);doc.setFontSize(7.5);textColor('olive');doc.text(label.toUpperCase(),18,y);y+=5;
   doc.setFontSize(10);textColor('ink');const lines=doc.splitTextToSize(text,174);
   for(const line of lines){ensure(6);doc.setFontSize(10);textColor('ink');doc.text(line,18,y);y+=5.3}y+=4;
  };
  const metadata=entries=>{
   const fields=entries.filter(([,value])=>clean(value).trim());
   for(let at=0;at<fields.length;at+=2){
    const pair=fields.slice(at,at+2);doc.setFontSize(10);const wrapped=pair.map(([label,value])=>({label,lines:doc.splitTextToSize(clean(value),82)}));const height=Math.max(...wrapped.map(field=>field.lines.length*5.3+10));
    if(height>100){for(const [label,value] of pair)block(label,value);continue}
    ensure(height);for(const [column,field] of wrapped.entries()){const x=18+column*89;doc.setFontSize(7.5);textColor('olive');doc.text(field.label.toUpperCase(),x,y);doc.setFontSize(10);textColor('ink');doc.text(field.lines,x,y+5,{lineHeightFactor:1.5})}y+=height;
   }
  };
  for(let index=0;index<items.length;index++){
   alive(signal);const item=items[index];currentTitle=clean(item.title);progress('Preparing '+(index+1)+' of '+items.length+': '+currentTitle);
   doc.addPage();header();doc.setFontSize(8);textColor('olive');doc.text(String(index+1).padStart(2,'0')+' / '+(ProductiondeckTaxonomy.labels[item.type]||'Reference').toUpperCase(),18,33);
   doc.setFontSize(22);textColor('ink');const titleLines=doc.splitTextToSize(currentTitle,174);doc.text(titleLines,18,46,{lineHeightFactor:1.2});y=46+(titleLines.length-1)*9.3+10;
   ensure(101);doc.setFillColor(...color.paper);doc.rect(18,y,174,92,'F');const photos=photosOf(item);
   if(photos.length){const image=cover&&photos[0]===coverPhotos[0]?cover:await picture('/media/'+encodeURIComponent(photos[0]),{signal,refresh});imageFit(image,18,y,174,92,'photo-'+photos[0])}else{doc.setFontSize(10);textColor('muted');doc.text('No photo added',105,y+46,{align:'center'})}y+=101;
   if(options.extraPhotos&&photos.length>1){ensure(39);for(const [at,id] of photos.slice(1,4).entries()){const image=await picture('/media/'+encodeURIComponent(id),{signal,refresh});doc.setFillColor(...color.paper);doc.rect(18+at*59,y,56,33,'F');imageFit(image,18+at*59,y,56,33,'photo-'+id)}y+=41}
   const fields=[["Nënkategoritë",ProductiondeckTaxonomy.fromItem(item).map(ProductiondeckTaxonomy.label).join(' · ')],["Qyteti",item.city],["Ambienti",item.type==='casting'?'':ProductiondeckTaxonomy.display(item.setting)],["Disponueshmëria",ProductiondeckTaxonomy.display(item.availability)],["Etiketa",(item.tags||[]).join(' · ')]];
   if(item.type==='casting'){
    const casting=item.casting||{};fields.push(["Gjinia",ProductiondeckTaxonomy.genders[casting.gender]||"Nuk është shënuar"],["Mosha për role",casting.playingAge],["Gjatësia",casting.height],["Aftësitë",(casting.skills||[]).join(', ')],["Ka punuar me ne",casting.workedBefore==='yes'?"Po":casting.workedBefore==='no'?"Jo":"Nuk është shënuar"],["Video prezantuese / portfolio",casting.showreel]);
   }
   if(options.internal)fields.push(["Kontakti / agjenti",item.contact],["Adresa / ruajtja",item.address],["Kostoja / shënime për qiranë",item.cost]);
   metadata(fields);
   if(options.notes)block("Shënime për produksionin",item.notes);
  }
  alive(signal);const total=doc.getNumberOfPages();for(let page=1;page<=total;page++){
   doc.setPage(page);rule(282);doc.setFontSize(7);textColor('muted');doc.text('TATAMATA / '+clean(name).slice(0,70),18,288);doc.text(page+' / '+total,192,288,{align:'right'});
  }
  progress('Finishing the PDF…');return doc.output('blob');
 }
 globalThis.ProductiondeckPDF=Object.freeze({generate,filename,createDocument,logo:signal=>picture('/brand/tatamata-horizontal.svg',{signal})});
})();
