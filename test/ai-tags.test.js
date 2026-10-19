import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groups,chooseTags,samplePhotos,mergeTags} from '../public/ai-tags.js';

test('AI samples across the gallery and does not mutate photo selection',()=>{
 const photos=Array.from({length:20},(_,i)=>i);assert.deepEqual(samplePhotos(photos),[0,10,19]);assert.equal(photos.length,20);
 assert.deepEqual(samplePhotos([]),[]);assert.deepEqual(samplePhotos(['one']),['one']);
});
test('AI suppresses ambiguous and unknown visual descriptions',()=>{
 assert.deepEqual(chooseTags(groups.flatMap(g=>g.entries.map(([,label])=>({label,score:1})))),[]);
 const unknown=groups.filter(g=>g.entries.some(e=>!e[0])).flatMap(g=>g.entries.map(([tag,label])=>({label,score:tag?0:1})));
 assert.deepEqual(chooseTags(unknown),[]);assert.deepEqual(chooseTags([{label:'bad',score:NaN}]),[]);
});
test('room type and materials can both be suggested despite different overall scores',()=>{
 const results=[{label:'a kitchen',score:.8},{label:'a bedroom',score:.02},{label:'a location with exposed brick walls',score:.01},{label:'a location with concrete surfaces',score:.007}];
 assert.deepEqual(chooseTags(results),['kitchen','exposed brick','concrete']);
});
test('accepting tags preserves manual tags, deduplicates case and respects the saved tag limit',()=>{
 assert.deepEqual(mergeTags([' Manual tag ','WOOD'],['wood','kitchen','']),['Manual tag','WOOD','kitchen']);
 const original=Array.from({length:30},(_,i)=>'manual '+i);assert.deepEqual(mergeTags(original,['new']),original);
});
