import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/deck-pdf.js';
const pdf=globalThis.ProductiondeckPDF;
test('PDF filenames keep Albanian names and remove path/control characters',()=>{
 assert.equal(pdf.filename('Pranverë — Çela'),'Pranverë - Çela.pdf');
 assert.equal(pdf.filename('...'),'Project Deck.pdf');
 const name=pdf.filename('../../unsafe<>:\\/?\u0000');assert(!/[\\/<>:?\u0000]/.test(name));assert(!name.startsWith('.'));assert(name.endsWith('.pdf'));assert(pdf.filename('a'.repeat(300)).length<=104);
});
test('empty and cancelled PDF exports fail before loading software or photos',async()=>{
 await assert.rejects(pdf.generate({name:'Empty',items:[]}),/at least one reference/);
 const controller=new AbortController();controller.abort();await assert.rejects(pdf.generate({name:'Cancelled',items:[{id:'test'}],signal:controller.signal}),error=>error.name==='AbortError');
});
