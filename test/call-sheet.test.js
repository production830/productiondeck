import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/call-sheet-model.js';
import '../public/call-sheet-pdf.js';
const model=ProductiondeckCallSheet;
test('call sheet validates industry fields, dates, times, day numbers and safe map links',()=>{
 const data=model.fresh();data.title='Çela — Dita 1';data.date='2026-10-21';data.generalCall='07:30';data.wrap='01:30 (+1d)';data.locations[0].mapUrl='https://maps.google.com/?q=Prishtina';assert.equal(model.validate(data).title,data.title);
 for(const patch of [{date:'2026-02-30'},{generalCall:'25:00'},{dayNumber:2,totalDays:1},{dayNumber:0},{status:'unknown'},{locations:[{...data.locations[0],mapUrl:'javascript:alert(1)'}]},{locations:[{...data.locations[0],mapUrl:'https://user:pass@example.test'}]},{crew:Array(101).fill(model.row('crew'))}])assert.throws(()=>model.validate({...data,...patch}));
 const duplicated={...data,cast:[{...model.row('cast'),call:'24:00'}]};assert.throws(()=>model.validate(duplicated),/24-hour/);assert.throws(()=>model.validate({...data,locations:[data.locations[0],data.locations[0]]}),/unique/);
});
test('schedule import snapshots references without guessing individual calls or emergency details',()=>{
 const location=crypto.randomUUID(),talent=crypto.randomUUID(),prop=crypto.randomUUID();const schedule={id:crypto.randomUUID(),title:'Night shoot',project:'Pranverë',date:'2026-10-21',startTime:'23:30',crewCall:'23:00',rows:[{id:crypto.randomUUID(),type:'scene',duration:90,shot:'1A',description:'Opening',locationId:location,locationText:'Side entrance',talentIds:[talent],propIds:[prop],notes:'Row notes'}]};
 const items=[{id:location,title:'Studio',address:'Prishtinë'},{id:talent,title:'Arbër',contact:'Agent phone'},{id:prop,title:'Chair'}],before=structuredClone(schedule);const sheet=model.fromSchedule(schedule,items);assert.equal(sheet.generalCall,'23:00');assert.equal(sheet.wrap,'01:00 (+1d)');assert.equal(sheet.locations[0].address,'Prishtinë');assert.equal(sheet.cast[0].name,'Arbër');assert.equal(sheet.cast[0].contact,'Agent phone');assert.equal(sheet.cast[0].call,'');assert.equal(sheet.hospital,'');assert.equal(sheet.weather,'');assert.equal(sheet.emergency,'');assert(sheet.plan[0].cast.includes('Chair'));assert.deepEqual(schedule,before);sheet.plan[0].scene='Changed';assert.equal(schedule.rows[0].description,'Opening');
});
test('call sheet PDF validates and cancels before loading browser dependencies',async()=>{
 await assert.rejects(ProductiondeckCallSheetPDF.generate({sheet:{...model.fresh(),title:''}}),/name/);const controller=new AbortController();controller.abort();await assert.rejects(ProductiondeckCallSheetPDF.generate({sheet:model.fresh(),signal:controller.signal}),{name:'AbortError'});
});
