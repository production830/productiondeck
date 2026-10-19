/* Metadata-based related records. Runs locally on the already-authorized catalog. */
(() => {
 const normalize=value=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):'';
 function tagMap(item){const tags=new Map();for(const tag of Array.isArray(item.tags)?item.tags:[]){const key=normalize(tag);if(key&&!tags.has(key))tags.set(key,tag.trim())}return tags}
 function findSimilar(current,items,limit=6){
  if(!current||!['location','prop'].includes(current.type)||!Array.isArray(items))return [];
  const ownTags=tagMap(current),category=normalize(current.category);
  return items.filter(item=>item&&item.id!==current.id&&item.type===current.type).map(item=>{
   const tags=tagMap(item),sharedTags=[...ownTags].filter(([key])=>tags.has(key)).map(([,label])=>label);
   const sameCategory=Boolean(category&&category===normalize(item.category));
   if(!sharedTags.length&&!sameCategory)return null;
   const union=new Set([...ownTags.keys(),...tags.keys()]).size;
   const score=sharedTags.length*4+(union?sharedTags.length/union*3:0)+(sameCategory?2:0);
   return {item,sharedTags,sameCategory,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.item.title||'').localeCompare(String(b.item.title||''))||String(a.item.id).localeCompare(String(b.item.id))).slice(0,Math.max(0,Math.min(12,Number(limit)||0)));
 }
 globalThis.ProductiondeckSimilarity=Object.freeze({findSimilar});
})();
