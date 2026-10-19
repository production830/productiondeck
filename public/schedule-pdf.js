/* Branded landscape schedule PDF, generated locally with the shared self-hosted runtime. */
(()=>{
 async function generate({schedule,items=[],signal,progress=()=>{}}){
  const model=ProductiondeckSchedule,data=model.validate(schedule);if(!data.rows.length)throw Error('Add at least one row before exporting.');
  const alive=()=>{if(signal?.aborted)throw new DOMException('Export cancelled','AbortError')};alive();progress('Preparing schedule PDF…');
  const doc=await ProductiondeckPDF.createDocument({orientation:'landscape'});alive();const logo=await ProductiondeckPDF.logo(signal);alive();
  const ink=[32,39,28],muted=[105,114,96],line=[220,226,211],paper=[246,248,240],width=297,bottom=191;
  doc.setProperties({title:(data.project?data.project+' — ':'')+data.title,author:'Tatamata',subject:'Shooting Schedule',creator:'Tatamata Productiondeck'});
  const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const ref=id=>items.find(item=>item.id===id)?.title||schedule.referenceLabels?.[id]||'Reference removed';
  let y=29;
  function header(){doc.setFillColor(255,255,255);doc.rect(0,0,width,210,'F');const h=38*logo.height/logo.width;doc.addImage(logo.data,logo.format,14,10,38,h,'tatamata','FAST');doc.setFontSize(8);doc.setTextColor(...muted);doc.text('PRODUCTIONDECK / SHOOTING SCHEDULE',283,15,{align:'right'});doc.setDrawColor(...line);doc.line(14,23,283,23);y=32}
  function page(){doc.addPage();header()}
  function ensure(height){alive();if(y+height>bottom)page()}
  function block(label,value){if(!value)return;ensure(15);doc.setFontSize(7.5);doc.setTextColor(...muted);doc.text(label.toUpperCase(),14,y);y+=5;doc.setFontSize(10);doc.setTextColor(...ink);for(const line of doc.splitTextToSize(text(value),269)){ensure(5);doc.setFontSize(10);doc.setTextColor(...ink);doc.text(line,14,y);y+=4.6}y+=4}
  header();doc.setFontSize(21);doc.setTextColor(...ink);for(const title of doc.splitTextToSize(text(data.title),269)){ensure(10);doc.text(title,14,y);y+=9}y+=3;
  block('Projekti',data.project);const timeline=model.timeline(data),total=data.rows.reduce((sum,row)=>sum+row.duration,0);
  block('Data / klienti',[data.date?data.date.split('-').reverse().join('.'):'Data nuk është caktuar',data.client].filter(Boolean).join('  /  '));
  block('Orari',['Thirrja e ekipit: '+(data.crewCall||'—'),'Fillimi: '+data.startTime,'Përfundimi: '+timeline.at(-1).end,'Gjithsej: '+Math.floor(total/60)+'h '+total%60+'m'].join('  /  '));
  block('Pika e takimit',data.meetingPoint);block('Kontakti i produksionit',data.contact);block('Shënime të përgjithshme',data.notes);
  const widths=[28,69,48,59,65],headings=['Ora / min','Skena / veprimi','Lokacioni','Kasting / rekuizita','Shënime'];
  function tableHeader(){ensure(14);doc.setFillColor(...ink);doc.rect(14,y,269,9,'F');doc.setFontSize(8);doc.setTextColor(255,255,255);let x=14;for(let c=0;c<widths.length;c++){doc.text(headings[c],x+3,y+6);x+=widths[c]}y+=9}
  tableHeader();
  for(const [index,row] of timeline.entries()){
   alive();progress('Preparing row '+(index+1)+' of '+timeline.length+'…');
   const cells=[row.start+' - '+row.end+'\n'+row.duration+' min',[(row.shot?row.shot+' · ':'')+model.types[row.type],row.description].filter(Boolean).join('\n'),[row.locationId?ref(row.locationId):'',row.locationText].filter(Boolean).join('\n'),[row.talentIds.length?'Kasting: '+row.talentIds.map(ref).join(', '):'',row.propIds.length?'Rekuizita: '+row.propIds.map(ref).join(', '):''].filter(Boolean).join('\n'),row.notes];
   doc.setFontSize(8.5);const lines=cells.map((value,col)=>doc.splitTextToSize(text(value||'—'),widths[col]-6));let offset=0;const count=Math.max(...lines.map(value=>value.length));if(count*4.1+6<=150&&y+count*4.1+6>bottom){page();tableHeader()}
   while(offset<count){
    if(y+13>bottom){page();tableHeader()}
    const capacity=Math.max(1,Math.floor((bottom-y-6)/4.1)),length=Math.min(capacity,count-offset),height=length*4.1+6;
    doc.setFillColor(...(index%2?paper:[255,255,255]));doc.rect(14,y,269,height,'F');doc.setTextColor(...ink);doc.setFontSize(8.5);let x=14;
    for(let col=0;col<widths.length;col++){const chunk=lines[col].slice(offset,offset+length);if(col===0&&offset>0&&!chunk.length)chunk.push('(continued)');if(chunk.length)doc.text(chunk,x+3,y+5,{lineHeightFactor:1.37});x+=widths[col]}
    doc.setDrawColor(...line);doc.line(14,y+height,283,y+height);y+=height;offset+=length;
   }
  }
  alive();const pages=doc.getNumberOfPages();for(let number=1;number<=pages;number++){doc.setPage(number);doc.setDrawColor(...line);doc.line(14,197,283,197);doc.setFontSize(7);doc.setTextColor(...muted);const caption=doc.splitTextToSize('TATAMATA / '+text(data.project||data.title),235)[0];doc.text(caption,14,202);doc.text(number+' / '+pages,283,202,{align:'right'})}
  progress('Finishing schedule PDF…');return doc.output('blob');
 }
 globalThis.ProductiondeckSchedulePDF=Object.freeze({generate});
})();
