// Visual descriptions only: no guesses about people, addresses, rates or permissions.
export const groups = [
 {name:'setting',min:0.65,max:1,entries:[['interior','an indoor interior'],['exterior','an outdoor exterior']]},
 {name:'type',min:0.30,max:2,entries:[['kitchen','a kitchen'],['living room','a living room'],['bedroom','a bedroom'],['bathroom','a bathroom'],['office','an office'],['warehouse','a warehouse'],['studio','a photography studio'],['restaurant','a restaurant'],['cafe','a cafe'],['shop','a retail shop'],['hotel','a hotel lobby'],['hallway','a hallway'],['staircase','a staircase'],['rooftop','a rooftop'],['courtyard','a courtyard'],['garden','a garden'],['forest','a forest'],['beach','a beach'],['field','an open field'],['street','a city street'],['parking','a parking lot'],['terrace','a terrace'],['','a location of another type']]},
 {name:'style',min:0.35,max:1,entries:[['modern','a modern location'],['industrial','an industrial location'],['rustic','a rustic location'],['traditional','a traditional location'],['minimalist','a minimalist location'],['vintage','a vintage location'],['luxurious','a luxurious location'],['','a location without a distinctive architectural style']]},
 {name:'materials',min:0.24,max:2,entries:[['exposed brick','a location with exposed brick walls'],['concrete','a location with concrete surfaces'],['wood','a location with wooden surfaces'],['stone','a location with stone surfaces'],['glass','a location with glass surfaces'],['metal','a location with metal surfaces'],['white walls','a location with plain white walls'],['','a location with no prominent building materials']]},
 {name:'light',min:0.35,max:1,entries:[['natural light','a location lit by daylight'],['warm light','a location with warm artificial lighting'],['cool light','a location with cool artificial lighting'],['dark interior','a dark dimly lit interior'],['','a location with ordinary mixed lighting']]},
 {name:'color',min:0.40,max:1,entries:[['warm tones','a location decorated in warm earthy colors'],['cool tones','a location decorated in cool blue colors'],['neutral tones','a location decorated in neutral muted colors'],['colorful','a location decorated in bright vivid colors'],['greenery','a location full of green plants'],['','a location with no dominant color palette']]}
];
export const prompts=groups.flatMap(g=>g.entries.map(e=>e[1]));
// CLIP scores are relative comparisons, not calibrated confidence percentages.
// Normalizing within each family keeps room-type scores from hiding style/materials.
export function chooseTags(results){
 const scores=new Map(results.map(x=>[x.label,Number.isFinite(x.score)?Math.max(0,x.score):0]));
 return groups.flatMap(group=>{
  const candidates=group.entries.map(([tag,label])=>({tag,score:scores.get(label)||0}));
  const total=candidates.reduce((sum,x)=>sum+x.score,0);if(!total)return [];
  return candidates.sort((a,b)=>b.score-a.score).slice(0,group.max).filter(x=>x.tag&&x.score/total>=group.min).map(x=>x.tag);
 });
}
export function samplePhotos(photos,max=3){
 if(photos.length<=max)return [...photos];
 return Array.from({length:max},(_,i)=>photos[Math.round(i*(photos.length-1)/(max-1))]);
}
export function mergeTags(current,selected,limit=30){
 const result=[],seen=new Set();
 for(const value of [...current,...selected]){const tag=String(value).trim();if(!tag||seen.has(tag.toLowerCase()))continue;seen.add(tag.toLowerCase());result.push(tag)}
 return result.slice(0,limit);
}
