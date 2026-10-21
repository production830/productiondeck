/* Standard portrait call-sheet layout, with repeated section headers and full long-text flow. */
(()=>{
 async function generate({sheet,signal,progress=()=>{}}){
  const data=ProductiondeckCallSheet.validate(sheet),alive=()=>{if(signal?.aborted)throw new DOMException('Export cancelled','AbortError')};alive();progress('Preparing call sheet PDF…');
  const doc=await ProductiondeckPDF.createDocument();alive();const logo=await ProductiondeckPDF.logo(signal);alive();
  const ink=[32,39,28],muted=[105,114,96],line=[220,226,211],paper=[246,248,240],bottom=279;let y=31;
  const clean=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  doc.setProperties({title:(data.project?data.project+' — ':'')+data.title,author:'Tatamata',subject:'Call Sheet',creator:'Tatamata Productiondeck'});
  function header(){doc.setFillColor(255,255,255);doc.rect(0,0,210,297,'F');doc.addImage(logo.data,logo.format,14,10,38,38*logo.height/logo.width,'tatamata','FAST');doc.setFontSize(8);doc.setTextColor(...muted);doc.text('CALL SHEET / '+(data.status==='issued'?'ISSUED':'DRAFT'),196,15,{align:'right'});doc.setDrawColor(...line);doc.line(14,23,196,23);y=31}
  function page(){doc.addPage();header()}
  function ensure(height){alive();if(y+height>bottom)page()}
  function heading(title){ensure(16);doc.setFontSize(10);doc.setTextColor(...ink);doc.text(title.toUpperCase(),14,y);y+=7}
  function block(label,value){if(!value)return;ensure(14);doc.setFontSize(7);doc.setTextColor(...muted);doc.text(label.toUpperCase(),14,y);y+=4.5;doc.setFontSize(9);for(const text of doc.splitTextToSize(clean(value),182)){ensure(5);doc.setFontSize(9);doc.setTextColor(...ink);doc.text(text,14,y);y+=4.2}y+=4}
  function grid(fields){for(let at=0;at<fields.length;at+=2){const pair=fields.slice(at,at+2);doc.setFontSize(9);const values=pair.map(([label,value])=>({label,lines:doc.splitTextToSize(clean(value||'—'),87)})),height=Math.max(...values.map(value=>value.lines.length*4.1+9));if(height>70){for(const [label,value] of pair)block(label,value||'—');continue}ensure(height);for(const [index,value] of values.entries()){const x=14+index*94;doc.setFontSize(7);doc.setTextColor(...muted);doc.text(value.label.toUpperCase(),x,y);doc.setFontSize(9);doc.setTextColor(...ink);doc.text(value.lines,x,y+4.5,{lineHeightFactor:1.3})}y+=height}}
  function table(title,labels,widths,rows){
   if(!rows.length)return;ensure(26);heading(title);
   function tableHeader(continued=false){if(continued){heading(title+' (continued)')}doc.setFillColor(...ink);doc.rect(14,y,182,8,'F');doc.setFontSize(7);doc.setTextColor(255,255,255);let x=14;for(let col=0;col<widths.length;col++){doc.text(labels[col],x+2,y+5.2);x+=widths[col]}y+=8}
   tableHeader();for(const [index,entry] of rows.entries()){
    alive();doc.setFontSize(8);const lines=entry.cells.map((value,col)=>doc.splitTextToSize(clean(value||'—'),widths[col]-4));const count=Math.max(...lines.map(value=>value.length));let offset=0;
    if(count*3.8+5<=210&&y+count*3.8+5>bottom){page();tableHeader(true)}
    while(offset<count){if(y+12>bottom){page();tableHeader(true)}const capacity=Math.max(1,Math.floor((bottom-y-5)/3.8)),size=Math.min(capacity,count-offset),height=size*3.8+5;doc.setFillColor(...(index%2?paper:[255,255,255]));doc.rect(14,y,182,height,'F');doc.setFontSize(8);doc.setTextColor(...ink);let x=14;
     for(let col=0;col<widths.length;col++){const chunk=lines[col].slice(offset,offset+size);if(chunk.length)doc.text(chunk,x+2,y+4.5,{lineHeightFactor:1.34});if(entry.links?.[col])doc.link(x,y,widths[col],height,{url:entry.links[col]});x+=widths[col]}doc.setDrawColor(...line);doc.line(14,y+height,196,y+height);y+=height;offset+=size;
    }
   }y+=8;
  }
  header();doc.setFontSize(19);doc.setTextColor(...ink);for(const line of doc.splitTextToSize(clean(data.project||data.title),182)){doc.text(line,14,y);y+=8}doc.setFontSize(10);doc.setTextColor(...muted);for(const line of doc.splitTextToSize(clean(data.title),182)){doc.text(line,14,y);y+=4.5}y+=6;
  ensure(29);doc.setFillColor(...paper);doc.roundedRect(14,y,182,25,2,2,'F');doc.setFontSize(7);doc.setTextColor(...muted);doc.text('THIRRJA E EKIPIT',18,y+6);doc.text('DATA E XHIRIMIT',86,y+6);doc.text('DITA / VERSIONI',149,y+6);doc.setTextColor(...ink);doc.setFontSize(21);doc.text(data.generalCall||'—',18,y+18);doc.setFontSize(11);doc.text(data.date?data.date.split('-').reverse().join('.'):'Not set',86,y+16);doc.setFontSize(9);doc.text(data.dayNumber+' / '+data.totalDays,149,y+13);const issue=doc.splitTextToSize(data.issue||'—',43);doc.text(issue.slice(0,1),149,y+19);y+=33;
  grid([['Versioni / publikimi',data.issue],['Statusi',data.status==='issued'?'ISSUED':'DRAFT'],['Klienti',data.client],['Kontakti i produksionit',data.productionContact],['Fillimi / mëngjesi',[data.shootStart||'—',data.breakfast||'—'].join(' / ')],['Dreka / përfundimi',[data.lunch||'—',data.wrap||'—'].join(' / ')],['Moti / temperatura',[data.weather,data.temperature].filter(Boolean).join(' / ')],['Lindja / perëndimi i diellit',[data.sunrise||'—',data.sunset||'—'].join(' / ')]]);
  block('Pika e takimit',data.meetingPoint);
  heading('Siguria / emergjencat');grid([['Spitali më i afërt',data.hospital],['Telefoni i spitalit / emergjenca',[data.hospitalPhone||'—',data.emergency||'—'].join(' / ')]]);block('Adresa e spitalit',data.hospitalAddress);block('Udhëzime të sigurisë',data.safety);
  progress('Preparing locations, cast calls and crew…');
  table('Lokacionet / parkingu',['Lokacioni','Adresa','Parkingu / shënime'],[42,70,70],data.locations.map(row=>({cells:[[row.name,row.mapUrl?'Map link':''].filter(Boolean).join('\n'),row.address,[row.parking,row.notes].filter(Boolean).join('\n')],links:[row.mapUrl]})));
  table('Kasting / oraret individuale',['Emri / roli','Kontakti','Transporti','Mbërritja','Grimi','Garderoba','Në set','Shënime'],[24,25,20,17,17,18,18,43],data.cast.map(row=>({cells:[[row.name,row.role].filter(Boolean).join('\n'),row.contact,row.pickup,row.call,row.makeup,row.wardrobe,row.onSet,row.notes]})));
  table('Ekipi / kontaktet kryesore',['Departamenti / pozita','Emri','Telefoni / kontakti','Thirrja','Shënime'],[38,36,42,22,44],data.crew.map(row=>({cells:[[row.department,row.role].filter(Boolean).join('\n'),row.name,row.phone,row.call,row.notes]})));
  table('Plani i ditës',['Orari','Skena / veprimi','Lokacioni','Kasting / shënime'],[31,57,38,56],data.plan.map(row=>({cells:[[row.start,row.end].filter(Boolean).join(' - '),row.scene,row.location,[row.cast,row.notes].filter(Boolean).join('\n')]})));
  block('Njoftime të përgjithshme',data.notes);alive();const total=doc.getNumberOfPages();for(let number=1;number<=total;number++){doc.setPage(number);doc.setDrawColor(...line);doc.line(14,285,196,285);doc.setFontSize(7);doc.setTextColor(...muted);const caption=doc.splitTextToSize('TATAMATA / '+clean(data.project||data.title)+' / '+(data.status==='issued'?'ISSUED':'DRAFT'),160)[0];doc.text(caption,14,290);doc.text(number+' / '+total,196,290,{align:'right'})}
  progress('Finishing call sheet PDF…');return doc.output('blob');
 }
 globalThis.ProductiondeckCallSheetPDF=Object.freeze({generate});
})();
