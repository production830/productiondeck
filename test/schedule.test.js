import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/schedule-model.js';
import '../public/schedule-pdf.js';
const model=globalThis.ProductiondeckSchedule;
const row=(duration=30)=>({id:crypto.randomUUID(),type:'scene',duration,shot:'1',description:'Opening',locationId:'',locationText:'',talentIds:[],propIds:[],notes:''});
const schedule=()=>({title:'Shoot day',project:'Pranverë',date:'2026-10-20',startTime:'23:30',crewCall:'23:00',rows:[row(90),row(30)]});
test('schedule timing follows row durations and explicitly labels the next day',()=>{
 const data=model.validate(schedule());assert.deepEqual(model.timeline(data).map(row=>[row.start,row.end]),[['23:30','01:00 (+1d)'],['01:00 (+1d)','01:30 (+1d)']]);data.rows.reverse();assert.equal(model.timeline(data)[0].end,'00:00 (+1d)');
});
test('schedule validation rejects invalid dates, duplicate rows and more than 24 hours',()=>{
 assert.throws(()=>model.validate({...schedule(),date:'2026-02-30'}),/valid shoot date/);assert.throws(()=>model.validate({...schedule(),rows:[row(720),row(720),row(1)]}),/24 hours/);assert.throws(()=>model.validate({...schedule(),rows:Array.from({length:101},()=>row(1))}),/100 schedule rows/);
 const data=schedule();data.rows.push(data.rows[0]);assert.throws(()=>model.validate(data),/unique identifiers/);assert.throws(()=>model.validate({...schedule(),startTime:'24:00'}),/start time/);assert.equal(model.validate({...schedule(),rows:[]}).rows.length,0);
});
test('schedule PDF validates and cancels before loading browser dependencies',async()=>{
 await assert.rejects(ProductiondeckSchedulePDF.generate({schedule:{...schedule(),rows:[]}}),/at least one row/);
 const controller=new AbortController();controller.abort();await assert.rejects(ProductiondeckSchedulePDF.generate({schedule:schedule(),signal:controller.signal}),{name:'AbortError'});
});
