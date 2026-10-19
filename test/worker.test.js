import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker.js';
const admin='11111111-1111-4111-8111-111111111111',crew='22222222-2222-4222-8222-222222222222';
function fixture(){
 const tables={members:[{id:admin,email:'admin@example.test',name:'Admin',admin:true},{id:crew,email:'crew@example.test',name:'Crew',admin:false}],items:[],images:[],boards:[]};
 const objects=new Map(),calls=[];let storageFailure=false;
 const response=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const upstream=async(raw,options={})=>{
  const u=new URL(raw),p=u.pathname,m=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  calls.push({path:p,query:u.search,options});
  assert.equal(u.origin,'https://test-project.supabase.co');
  if(p==='/auth/v1/token'){
   if(body.refresh_token)return response({user:{id:admin},access_token:'admin-token',refresh_token:'refresh-new',expires_in:3600});
   if(body.password==='wrong')return response({error:'bad password'},400);
   const id=body.email==='crew@example.test'?crew:admin;return response({user:{id},access_token:id===crew?'crew-token':'admin-token',refresh_token:'refresh',expires_in:3600});
  }
  if(p==='/auth/v1/user'){
   const token=options.headers.Authorization;if(token==='Bearer expired')return response({},401);
   if(m==='PUT')return response({id:admin});
   return response({id:token==='Bearer crew-token'?crew:admin});
  }
  if(p==='/auth/v1/logout')return response(null,204);
  if(p==='/auth/v1/admin/users'&&m==='POST')return response({id:crypto.randomUUID()});
  if(p.startsWith('/auth/v1/admin/users/')&&m==='DELETE')return response({ok:true});
  if(p.startsWith('/rest/v1/pd_')){
   assert.equal(options.headers.apikey,'test-service-secret');
   const table=p.split('pd_')[1],rows=tables[table];assert.ok(rows,'Unknown table '+table);
   const filter=rows=>rows.filter(row=>[...u.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3)));
   if(m==='GET'){const limit=Number(u.searchParams.get('limit')||1000),offset=Number(u.searchParams.get('offset')||0);return response(filter(rows).slice(offset,offset+limit))}
   if(m==='POST'){
    if(table==='images'&&rows.some(r=>r.item_id===body.item_id&&r.slot===body.slot))return response({code:'23505'},409);
    rows.push({...body,...(table==='items'?{created:new Date().toISOString()}:{}),...(table==='boards'?{items:body.items||[]}: {})});return response(null,201);
   }
   if(m==='PATCH'){for(const row of filter(rows))Object.assign(row,body);return response(null,204)}
   if(m==='DELETE'){const deleted=filter(rows);tables[table]=rows.filter(r=>!deleted.includes(r));if(table==='items')tables.images=tables.images.filter(im=>!deleted.some(i=>i.id===im.item_id));return response(null,204)}
  }
  if(p.startsWith('/storage/v1/object/')){
   assert.equal(options.headers.apikey,'test-service-secret');
   if(storageFailure)return response({error:'quota exceeded'},400);
   const id=p.split('/').pop();
   if(m==='POST'){objects.set(id,body);return response({Key:id},200)}
   if(m==='DELETE'){for(const id of body.prefixes)objects.delete(id);return response({ok:true})}
   if(m==='GET')return objects.has(id)?new Response(objects.get(id),{headers:{'Content-Type':'image/png'}}):response({},404);
  }
  throw Error('Unexpected upstream '+m+' '+raw);
 };
 const handle=createHandler(upstream);
 const env={SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service-secret',ASSETS:{fetch:async()=>new Response('<html>library</html>')}};
 async function req(path,{method='GET',body,cookie='__Host-pd_access=admin-token',origin='https://library.example',headers={}}={}){
  return handle(new Request('https://library.example'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...headers},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)}),env);
 }
 return {req,tables,objects,calls,env,handle,setStorageFailure:value=>{storageFailure=value}};
}
test('protected API and media reject anonymous, cross-origin, and nonmembers before data access',async()=>{
 const f=fixture();assert.equal((await f.req('/api/items',{cookie:''})).status,401);assert.equal((await f.req('/media/'+admin,{cookie:''})).status,401);assert.equal(f.calls.length,0);
 assert.equal((await f.req('/api/items',{method:'POST',body:{},origin:'https://evil.example'})).status,403);assert.equal(f.calls.length,0);
 f.tables.members.splice(0,1);assert.equal((await f.req('/api/items')).status,401);assert.ok(!f.calls.some(c=>c.path.endsWith('pd_items')));
});
test('login keeps access/refresh tokens HttpOnly and does not expose service secrets',async()=>{
 const f=fixture();let r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'admin@example.test',password:'a-long-password'}});assert.equal(r.status,200);assert.equal(await r.text(),'{"ok":true}');assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.match(r.headers.get('set-cookie'),/__Host-pd_refresh/);
 r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'admin@example.test',password:'wrong'}});assert.equal(r.status,401);
 f.tables.members.splice(0,1);r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'admin@example.test',password:'good'}});assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);
});
test('refresh is allowed only on me and logout clears both cookies',async()=>{
 const f=fixture();const cookie='__Host-pd_refresh=refresh';assert.equal((await f.req('/api/items',{cookie})).status,401);
 let r=await f.req('/api/me',{cookie});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/admin-token/);
 r=await f.req('/api/logout',{method:'POST',body:{}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
});
test('shared record/shortlist lifecycle and private photo access',async()=>{
 const f=fixture();let r=await f.req('/api/items',{method:'POST',body:{title:'Loft',type:'location',tags:['white','white']}});assert.equal(r.status,201);const {id}=await r.json();
 const read=await(await f.req('/api/items',{cookie:'__Host-pd_access=crew-token'})).json();assert.equal(read[0].id,id);assert.deepEqual(read[0].tags,['white']);
 const photo=Uint8Array.from([137,80,78,71,13,10,26,10,0,1,2]);r=await f.req('/api/items/'+id+'/images',{method:'POST',body:photo});assert.equal(r.status,201);const image=await r.json();
 r=await f.req('/media/'+image.id);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),photo);
 r=await f.req('/api/boards',{method:'POST',body:{name:'Campaign'}});const board=await r.json();assert.equal(r.status,201);
 assert.equal((await f.req('/api/boards/'+board.id,{method:'PUT',body:{items:[id,id]}})).status,200);assert.deepEqual(f.tables.boards[0].items,[id]);
 assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{title:'Updated loft',type:'location'}})).status,200);assert.equal(f.tables.items[0].data.title,'Updated loft');
 assert.equal((await f.req('/api/items/'+id,{method:'DELETE'})).status,200);assert.equal(f.objects.size,0);assert.equal((await f.req('/media/'+image.id)).status,404);
});
test('upload validation, reservation rollback, max photos and missing records',async()=>{
 const f=fixture();await f.req('/api/items',{method:'POST',body:{title:'Chair',type:'prop'}});const id=f.tables.items[0].id;
 let r=await f.req('/api/items/'+id+'/images',{method:'POST',body:new TextEncoder().encode('<svg>')});assert.equal(r.status,400);assert.equal(f.tables.images.length,0);
 const photo=Uint8Array.from([255,216,255,0]);f.setStorageFailure(true);r=await f.req('/api/items/'+id+'/images',{method:'POST',body:photo});assert.equal(r.status,502);assert.equal(f.tables.images.length,0);
 f.setStorageFailure(false);for(let slot=0;slot<12;slot++)f.tables.images.push({id:crypto.randomUUID(),item_id:id,slot,mime:'image/jpeg'});
 assert.equal((await f.req('/api/items/'+id+'/images',{method:'POST',body:photo})).status,400);
 assert.equal((await f.req('/api/items/not-an-id',{method:'DELETE'})).status,404);
 assert.equal((await f.req('/api/items',{method:'POST',body:{title:'Invalid',type:'script'}})).status,400);
 assert.equal((await f.req('/api/items',{method:'POST',body:'invalid JSON'})).status,400);
});
test('administrator boundaries and immediate membership revocation',async()=>{
 const f=fixture(),crewCookie='__Host-pd_access=crew-token';assert.equal((await f.req('/api/users',{cookie:crewCookie})).status,403);
 assert.equal((await f.req('/api/users/'+admin,{method:'DELETE'})).status,400);
 assert.equal((await f.req('/api/users',{method:'POST',body:{name:'New person',email:'new@example.test',password:'a-password-long-enough'}})).status,201);assert.equal(f.tables.members.length,3);assert.equal(f.tables.members[2].admin,false);
 assert.equal((await f.req('/api/users/'+crew,{method:'DELETE'})).status,200);assert.equal((await f.req('/api/items',{cookie:crewCookie})).status,401);
});
test('catalog reads paginate beyond the Supabase 1000-row default',async()=>{
 const f=fixture();for(let i=0;i<1100;i++)f.tables.items.push({id:crypto.randomUUID(),created:String(i),data:{title:'Item '+i,type:'prop'}});
 const r=await f.req('/api/items');assert.equal(r.status,200);assert.equal((await r.json()).length,1100);assert.equal(f.calls.filter(c=>c.path.endsWith('pd_items')).length,3);
});
test('missing setup fails closed and static responses contain security headers',async()=>{
 const f=fixture();const r=await f.handle(new Request('https://library.example/api/items'),{});assert.equal(r.status,503);assert.ok(!(await r.text()).includes('test-service-secret'));
 const page=await f.req('/');assert.equal(page.status,200);assert.equal(page.headers.get('X-Frame-Options'),'DENY');
});
test('password change verifies old password and clears the current session',async()=>{
 const f=fixture();assert.equal((await f.req('/api/password',{method:'POST',body:{current:'wrong',password:'new-password-long'}})).status,401);
 const r=await f.req('/api/password',{method:'POST',body:{current:'correct',password:'new-password-long'}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.ok(f.calls.some(c=>c.path==='/auth/v1/user'&&c.options.method==='PUT'));
});
