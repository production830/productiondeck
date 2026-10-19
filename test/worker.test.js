import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker.js';
const admin='11111111-1111-4111-8111-111111111111',crew='22222222-2222-4222-8222-222222222222';
function fixture(){
 const tables={members:[{id:admin,email:'admin@example.test',name:'Admin',admin:true},{id:crew,email:'crew@example.test',name:'Crew',admin:false}],items:[],images:[],boards:[]};
 const objects=new Map(),calls=[];let storageFailure=false,strictAuth=false;
 const authAccounts=new Map([[admin,{id:admin,email:'admin@example.test',password:'admin-password-long',confirmed:true}],[crew,{id:crew,email:'crew@example.test',password:'crew-password-long',confirmed:true}]]);
 const issuedTokens=new Map([['admin-token',admin],['crew-token',crew]]);
 const response=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const upstream=async(raw,options={})=>{
  const u=new URL(raw),p=u.pathname,m=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  calls.push({path:p,query:u.search,options});
  assert.equal(u.origin,'https://test-project.supabase.co');
  if(p==='/auth/v1/token'){
   if(strictAuth&&!body.refresh_token){
    const account=[...authAccounts.values()].find(a=>a.email===body.email);
    if(!account||account.password!==body.password)return response({error_code:'invalid_credentials'},400);
    if(!account.confirmed)return response({error_code:'email_not_confirmed'},400);
    const token='token-'+account.id;issuedTokens.set(token,account.id);
    return response({user:{id:account.id},access_token:token,refresh_token:'refresh-'+account.id,expires_in:3600});
   }
   if(body.refresh_token)return response({user:{id:admin},access_token:'admin-token',refresh_token:'refresh-new',expires_in:3600});
   if(body.password==='wrong')return response({error:'bad password'},400);
   const id=body.email==='crew@example.test'?crew:admin;return response({user:{id},access_token:id===crew?'crew-token':'admin-token',refresh_token:'refresh',expires_in:3600});
  }
  if(p==='/auth/v1/user'){
   const token=options.headers.Authorization;if(token==='Bearer expired')return response({},401);
   if(m==='PUT')return response({id:admin});
   return response({id:issuedTokens.get(token.replace('Bearer ',''))||admin});
  }
  if(p==='/auth/v1/logout')return response(null,204);
  if(p==='/auth/v1/admin/users'&&m==='POST'){
   const id=crypto.randomUUID();authAccounts.set(id,{id,email:body.email,password:body.password,confirmed:body.email_confirm===true});return response({id});
  }
  if(p.startsWith('/auth/v1/admin/users/')&&m==='GET'){
   const account=authAccounts.get(p.split('/').pop());return account?response({id:account.id,email:account.email,email_confirmed_at:account.confirmed?'2026-01-01T00:00:00Z':null}):response({},404);
  }
  if(p.startsWith('/auth/v1/admin/users/')&&m==='PUT'){
   const id=p.split('/').pop(),account=authAccounts.get(id);if(!account)return response({},404);
   account.password=body.password;if(body.email_confirm===true)account.confirmed=true;return response({id});
  }
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
 return {req,tables,objects,calls,env,handle,upstream,authAccounts,enableStrictAuth:()=>{strictAuth=true},setStorageFailure:value=>{storageFailure=value}};
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
 f.setStorageFailure(false);for(let slot=0;slot<20;slot++)f.tables.images.push({id:crypto.randomUUID(),item_id:id,slot,mime:'image/jpeg'});
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

test('casting profiles normalize structured fields and preserve them through shared updates',async()=>{
 const f=fixture();const data={title:'Test talent',type:'casting',category:'Actor',city:'Test City',availability:'Check first',contact:'Agent contact',tags:['comedy'],casting:{playingAge:'25–35',height:'178 cm',languages:['English','Albanian','English'],skills:['Dance','Voice-over'],showreel:'https://example.test/reel',workedBefore:'yes'}};
 const created=await f.req('/api/items',{method:'POST',body:data});assert.equal(created.status,201);const {id}=await created.json();
 const stored=f.tables.items[0].data;assert.equal(stored.type,'casting');assert.deepEqual(stored.casting.languages,['English','Albanian']);assert.equal(stored.casting.workedBefore,'yes');
 let read=await(await f.req('/api/items',{cookie:'__Host-pd_access=crew-token'})).json();assert.equal(read[0].casting.playingAge,'25–35');assert.equal(read[0].casting.showreel,'https://example.test/reel');
 const update=await f.req('/api/items/'+id,{method:'PUT',body:{...data,casting:{...data.casting,skills:['Dance','Singing'],workedBefore:'no'}}});assert.equal(update.status,200);
 read=await(await f.req('/api/items')).json();assert.deepEqual(read[0].casting.skills,['Dance','Singing']);assert.equal(read[0].casting.workedBefore,'no');
 const board=await(await f.req('/api/boards',{method:'POST',body:{name:'Casting shortlist'}})).json();assert.equal((await f.req('/api/boards/'+board.id,{method:'PUT',body:{items:[id]}})).status,200);assert.deepEqual(f.tables.boards[0].items,[id]);
});
test('casting accepts optional fields but blocks unsafe portfolio links',async()=>{
 const f=fixture();const data={title:'Talent',type:'casting'};
 let r=await f.req('/api/items',{method:'POST',body:data});assert.equal(r.status,201);assert.equal(f.tables.items[0].data.casting.workedBefore,'unknown');assert.deepEqual(f.tables.items[0].data.casting.skills,[]);
 for(const showreel of ['javascript:alert(1)','data:text/html,script','http://example.test','https://username:password@example.test']){
  r=await f.req('/api/items',{method:'POST',body:{...data,casting:{showreel}}});assert.equal(r.status,400);
 }
 r=await f.req('/api/items',{method:'POST',body:{...data,type:'prop',casting:{showreel:'javascript:alert(1)'}}});assert.equal(r.status,201);assert.equal(f.tables.items.at(-1).data.casting,undefined);
 assert.equal((await f.req('/api/items',{cookie:'',method:'POST',body:data})).status,401);
});

test('a teammate created with a temporary password can sign in and bootstrap their own session',async()=>{
 const f=fixture();f.enableStrictAuth();const password='new-teammate-test-password';
 let r=await f.req('/api/users',{method:'POST',body:{name:'Test teammate',email:'New.Team@example.test ',password}});assert.equal(r.status,201);
 const member=f.tables.members.find(u=>u.email==='new.team@example.test');assert.ok(member);assert.equal(member.admin,false);
 const account=f.authAccounts.get(member.id);assert.equal(account.confirmed,true);assert.equal(account.password,password);
 r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'New.Team@Example.Test ',password}});assert.equal(r.status,200);
 const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.match(cookie,/__Host-pd_access=/);
 r=await f.req('/api/me',{cookie});assert.equal(r.status,200);const user=await r.json();assert.equal(user.id,member.id);assert.equal(user.email,member.email);assert.equal(user.admin,false);
 assert.equal((await f.req('/api/items',{cookie})).status,200);assert.equal((await f.req('/api/users',{cookie})).status,403);
});
test('password failures are distinct from expired sessions and confirmation errors',async()=>{
 const f=fixture();f.enableStrictAuth();
 let r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'crew@example.test',password:'incorrect'}});assert.equal(r.status,401);let b=await r.json();assert.equal(b.code,'invalid_credentials');assert.ok(!b.error.includes('expired'));
 f.authAccounts.get(crew).confirmed=false;
 r=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'crew@example.test',password:'crew-password-long'}});assert.equal(r.status,403);b=await r.json();assert.equal(b.code,'email_not_confirmed');assert.equal(r.headers.get('set-cookie'),null);
 r=await f.req('/api/me',{cookie:''});assert.equal((await r.json()).code,'session_expired');
});
test('administrator reset repairs an existing teammate without changing membership or library data',async()=>{
 const f=fixture();f.enableStrictAuth();f.authAccounts.get(crew).confirmed=false;
 f.tables.items.push({id:crypto.randomUUID(),data:{title:'Existing prop',type:'prop'}});const before=JSON.stringify(f.tables);
 assert.equal((await f.req('/api/users/'+crew+'/password',{method:'POST',cookie:'__Host-pd_access=crew-token',body:{password:'replacement-password'}})).status,403);
 assert.equal((await f.req('/api/users/'+admin+'/password',{method:'POST',body:{password:'replacement-password'}})).status,400);
 assert.equal((await f.req('/api/users/'+crypto.randomUUID()+'/password',{method:'POST',body:{password:'replacement-password'}})).status,404);
 assert.equal((await f.req('/api/users/'+crew+'/password',{method:'POST',body:{password:'short'}})).status,400);
 const r=await f.req('/api/users/'+crew+'/password',{method:'POST',body:{password:'replacement-password'}});assert.equal(r.status,200);assert.equal(await r.text(),'{"ok":true}');assert.equal(JSON.stringify(f.tables),before);
 assert.equal(f.authAccounts.get(crew).confirmed,true);
 let login=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'crew@example.test',password:'crew-password-long'}});assert.equal(login.status,401);
 login=await f.req('/api/login',{cookie:'',method:'POST',body:{email:'crew@example.test',password:'replacement-password'}});assert.equal(login.status,200);
 const update=f.calls.find(c=>c.path==='/auth/v1/admin/users/'+crew&&c.options.method==='PUT');assert.equal(update.options.headers.apikey,'test-service-secret');
});
test('upstream outages never masquerade as password failures or erase valid session cookies',async()=>{
 const f=fixture();
 for(const brokenPath of ['/auth/v1/user','/auth/v1/token']){
  const handle=createHandler(async(url,options)=>new URL(url).pathname===brokenPath?new Response(JSON.stringify({error_code:'unexpected_failure',message:'private upstream details'}),{status:500}):f.upstream(url,options));
  const login=brokenPath.endsWith('token');const request=new Request('https://library.example'+(login?'/api/login':'/api/me'),{method:login?'POST':'GET',headers:{Origin:'https://library.example',Cookie:'__Host-pd_access=admin-token'},body:login?JSON.stringify({email:'admin@example.test',password:'correct-password'}):undefined});
  const r=await handle(request,f.env);assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);const b=await r.json();assert.equal(b.code,'service_unavailable');assert.ok(!b.error.includes('expired'));assert.ok(!b.error.includes('private upstream'));
 }
});
test('disabled email login is actionable and refresh failure clears only invalid sessions',async()=>{
 const f=fixture();
 const handle=createHandler(async(url,options)=>new URL(url).pathname==='/auth/v1/token'?new Response(JSON.stringify({error_code:'email_provider_disabled'}),{status:400}):f.upstream(url,options));
 const r=await handle(new Request('https://library.example/api/login',{method:'POST',headers:{Origin:'https://library.example'},body:JSON.stringify({email:'crew@example.test',password:'test-password'})}),f.env);assert.equal(r.status,503);const b=await r.json();assert.equal(b.code,'email_provider_disabled');assert.match(b.error,/public signup can remain off/);
 const refreshHandle=createHandler(async(url,options)=>new URL(url).pathname==='/auth/v1/token'?new Response(JSON.stringify({error_code:'refresh_token_not_found'}),{status:400}):f.upstream(url,options));
 const expired=await refreshHandle(new Request('https://library.example/api/me',{headers:{Cookie:'__Host-pd_refresh=missing'}}),f.env);assert.equal(expired.status,401);assert.match(expired.headers.get('set-cookie'),/Max-Age=0/);
});

test('admin can test a teammate login without changing the password or issuing browser session cookies',async()=>{
 const f=fixture();f.enableStrictAuth();const before=JSON.stringify(f.tables);
 assert.equal((await f.req('/api/users/'+crew+'/check-login',{method:'POST',cookie:'__Host-pd_access=crew-token',body:{password:'crew-password-long'}})).status,403);
 let r=await f.req('/api/users/'+crew+'/check-login',{method:'POST',body:{password:'wrong'}});assert.equal(r.status,401);assert.equal((await r.json()).code,'invalid_credentials');
 r=await f.req('/api/users/'+crew+'/check-login',{method:'POST',body:{password:'crew-password-long'}});assert.equal(r.status,200);assert.match((await r.json()).message,/No password was changed/);assert.equal(r.headers.get('set-cookie'),null);
 assert.equal(f.authAccounts.get(crew).password,'crew-password-long');assert.equal(JSON.stringify(f.tables),before);
 assert.ok(f.calls.some(c=>c.path==='/auth/v1/logout'&&c.query==='?scope=local'));
 assert.ok(!f.calls.some(c=>c.path.startsWith('/auth/v1/admin/users/')&&c.options.method==='PUT'));
});
test('reset never claims success when the newly submitted password still fails login',async()=>{
 const f=fixture();f.enableStrictAuth();
 const handle=createHandler(async(url,options)=>new URL(url).pathname==='/auth/v1/token'?new Response(JSON.stringify({error_code:'invalid_credentials'}),{status:400}):f.upstream(url,options));
 const r=await handle(new Request('https://library.example/api/users/'+crew+'/password',{method:'POST',headers:{Origin:'https://library.example',Cookie:'__Host-pd_access=admin-token'},body:JSON.stringify({password:'new-long-password'})}),f.env);
 assert.equal(r.status,401);const b=await r.json();assert.equal(b.code,'invalid_credentials');assert.match(b.error,/did not verify sign-in/);
});
test('a team-list email mismatch is detected before any password is changed',async()=>{
 const f=fixture();f.enableStrictAuth();f.authAccounts.get(crew).email='different@example.test';
 const r=await f.req('/api/users/'+crew+'/password',{method:'POST',body:{password:'new-long-password'}});assert.equal(r.status,409);assert.equal((await r.json()).code,'account_email_mismatch');
 assert.equal(f.authAccounts.get(crew).password,'crew-password-long');assert.ok(!f.calls.some(c=>c.path.endsWith('/'+crew)&&c.options.method==='PUT'));
});
test('wrong-project legacy keys fail configuration checks rather than blaming a password',async()=>{
 const f=fixture();const key='header.'+Buffer.from(JSON.stringify({ref:'another-project'})).toString('base64url')+'.signature';
 const r=await f.handle(new Request('https://library.example/api/login',{method:'POST',headers:{Origin:'https://library.example'},body:JSON.stringify({email:'crew@example.test',password:'test-password'})}),{...f.env,SUPABASE_ANON_KEY:key});
 assert.equal(r.status,503);assert.equal((await r.json()).code,'auth_project_mismatch');assert.equal(f.calls.length,0);
});
test('an invalid Supabase API key is not reported as incorrect teammate credentials',async()=>{
 const f=fixture();const handle=createHandler(async()=>new Response(JSON.stringify({message:'Invalid API key'}),{status:401}));
 const r=await handle(new Request('https://library.example/api/login',{method:'POST',headers:{Origin:'https://library.example'},body:JSON.stringify({email:'crew@example.test',password:'test-password'})}),f.env);
 assert.equal(r.status,503);assert.equal((await r.json()).code,'auth_key_invalid');
});

test('locations and props accept photos 13 through 20 and reject a 21st',async()=>{
 for(const type of ['location','prop']){
  const f=fixture();const item=await(await f.req('/api/items',{method:'POST',body:{title:'Photo limit test',type}})).json();
  for(let slot=0;slot<12;slot++)f.tables.images.push({id:crypto.randomUUID(),item_id:item.id,slot,mime:'image/jpeg'});
  for(let n=13;n<=20;n++){
   const r=await f.req('/api/items/'+item.id+'/images',{method:'POST',body:Uint8Array.from([255,216,255,0])});assert.equal(r.status,201,'Photo '+n+' for '+type);
  }
  assert.equal(f.tables.images.length,20);assert.equal(f.tables.images.at(-1).slot,19);
  const r=await f.req('/api/items/'+item.id+'/images',{method:'POST',body:Uint8Array.from([255,216,255,0])});assert.equal(r.status,400);assert.match((await r.json()).error,/Maximum 20/);assert.equal(f.tables.images.length,20);
 }
});
test('casting keeps its 12-photo limit and existing slots can be filled',async()=>{
 const f=fixture();const item=await(await f.req('/api/items',{method:'POST',body:{title:'Casting photo test',type:'casting'}})).json();
 for(let slot=0;slot<12;slot++)if(slot!==5)f.tables.images.push({id:crypto.randomUUID(),item_id:item.id,slot,mime:'image/jpeg'});
 assert.equal((await f.req('/api/items/'+item.id+'/images',{method:'POST',body:Uint8Array.from([255,216,255,0])})).status,201);assert.equal(f.tables.images.at(-1).slot,5);
 const r=await f.req('/api/items/'+item.id+'/images',{method:'POST',body:Uint8Array.from([255,216,255,0])});assert.equal(r.status,400);assert.match((await r.json()).error,/Maximum 12/);
});
test('a database still using the old photo cap produces an actionable migration error',async()=>{
 const f=fixture();const item=await(await f.req('/api/items',{method:'POST',body:{title:'Migration test',type:'location'}})).json();
 const handle=createHandler(async(url,options)=>new URL(url).pathname==='/rest/v1/pd_images'&&options.method==='POST'?new Response(JSON.stringify({code:'23514'}),{status:400}):f.upstream(url,options));
 const r=await handle(new Request('https://library.example/api/items/'+item.id+'/images',{method:'POST',headers:{Origin:'https://library.example',Cookie:'__Host-pd_access=admin-token'},body:Uint8Array.from([255,216,255,0])}),f.env);
 assert.equal(r.status,503);const b=await r.json();assert.equal(b.code,'photo_limit_migration_required');assert.match(b.error,/002_twenty_photos/);assert.equal(f.objects.size,0);
});

test('thumbnail choices belong to the reference and survive unrelated metadata edits',async()=>{
 const f=fixture(),data={title:'Location',type:'location',tags:['test']};
 const first=await (await f.req('/api/items',{method:'POST',body:data})).json(),second=await (await f.req('/api/items',{method:'POST',body:{...data,title:'Other'}})).json();
 const bytes=new Uint8Array([255,216,255,0,0]);
 const photo=await (await f.req('/api/items/'+first.id+'/images',{method:'POST',body:bytes})).json();
 const other=await (await f.req('/api/items/'+second.id+'/images',{method:'POST',body:bytes})).json();
 assert.equal((await f.req('/api/items/'+first.id,{method:'PUT',body:{...data,coverImage:other.id}})).status,400);
 assert.equal((await f.req('/api/items/'+first.id,{method:'PUT',body:{...data,coverImage:'not-a-photo'}})).status,400);
 assert.equal((await f.req('/api/items/'+first.id,{method:'PUT',body:{...data,coverImage:photo.id}})).status,200);
 assert.equal((await f.req('/api/items/'+first.id,{method:'PUT',body:{...data,title:'Renamed'}})).status,200);
 const records=await (await f.req('/api/items')).json();assert.equal(records.find(x=>x.id===first.id).coverImage,photo.id);
 assert.equal((await f.req('/api/items',{method:'POST',body:{...data,coverImage:photo.id}})).status,400);
 assert.equal((await f.req('/api/items/'+first.id,{method:'PUT',body:{...data,coverImage:''}})).status,200);
});
test('Project Decks can be named and edited independently without deleting reference records',async()=>{
 const f=fixture(),location=await (await f.req('/api/items',{method:'POST',body:{title:'House',type:'location'}})).json(),talent=await (await f.req('/api/items',{method:'POST',body:{title:'Actor',type:'casting'}})).json();
 const deck=await (await f.req('/api/boards',{method:'POST',body:{name:'Campaign',items:[location.id,talent.id,location.id]}})).json();
 assert.deepEqual(f.tables.boards[0].items,[location.id,talent.id]);
 assert.equal((await f.req('/api/boards/'+deck.id,{method:'PUT',body:{name:'New campaign'}})).status,200);assert.deepEqual(f.tables.boards[0].items,[location.id,talent.id]);
 assert.equal((await f.req('/api/boards/'+deck.id,{method:'PUT',body:{items:[talent.id]}})).status,200);assert.equal(f.tables.boards[0].name,'New campaign');
 assert.equal((await f.req('/api/boards/'+deck.id,{method:'PUT',body:{name:'Wrong',items:['bad-id']}})).status,400);assert.equal(f.tables.boards[0].name,'New campaign');
 assert.equal((await f.req('/api/boards/'+deck.id,{method:'PUT',body:{name:' '}})).status,400);
 assert.equal((await f.req('/api/boards/'+deck.id,{method:'DELETE'})).status,200);assert.equal(f.tables.items.length,2);
});
