// Merge tags against the latest record, with a conditional write to protect concurrent edits.
import './public/vision-core.js';
export async function saveAutoTags({request,p,body,checkId,rest,isDocument}){
 const match=p.match(/^\/api\/items\/([^/]+)\/auto-tags$/);if(!match)return null;
 const fail=(status,message)=>Object.assign(Error(message),{status});if(request.method!=='POST')throw fail(405,'Method not allowed');const id=checkId(match[1]),input=await body(request);
 if(input.version!=='clip-laion-v1'||!Array.isArray(input.tags)||input.tags.length>12||input.tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>50))throw fail(400,'Invalid automatic tags');
 const proposed=input.tags.map(tag=>tag.trim());
 for(let retry=0;retry<3;retry++){
  const row=(await rest('items','id=eq.'+id+'&select=id,data'))[0];if(!row||isDocument(row.data))throw fail(404,'Reference not found');if(!['location','prop'].includes(row.data.type))throw fail(400,'Automatic tagging is available only for locations and props.');
  const photoIds=(await rest('images','item_id=eq.'+id+'&select=id&order=id')).map(image=>image.id).sort();
  const tags=ProductiondeckVisionCore.merge(row.data.tags||[],proposed),data={...row.data,tags,autoTagging:{version:input.version,analyzedAt:new Date().toISOString(),photoIds}};
  const updated=await rest('items','id=eq.'+id+'&data=eq.'+encodeURIComponent(JSON.stringify(row.data)),{method:'PATCH',data:{data},headers:{Prefer:'return=representation'}});
  if(updated?.length)return {ok:true,tags,added:tags.filter(tag=>!(row.data.tags||[]).includes(tag)).length};
 }
 throw fail(409,'Someone is editing this reference. Retry automatic tagging after their changes are saved.');
}
