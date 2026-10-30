import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../worker.js';
const admin='11111111-1111-4111-8111-111111111111',crew='22222222-2222-4222-8222-222222222222';
function fixture(){
 const tables={members:[{id:admin,email:'admin@example.test',name:'Admin',admin:true},{id:crew,email:'crew@example.test',name:'Crew',admin:false}],items:[],images:[],boards:[]};
 const objects=new Map(),calls=[];let storageFailure=false,strictAuth=false;
 const authAccounts=new Map([[admin,{id:admin,email:'admin@example.test',password:'admin-password-long',confirmed:true}],[crew,{id:crew,email:'crew@example.test',password:'crew-password-long',confirmed:true}]]);
 const setupTokens=new Map();
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
   if(m==='PUT'){const id=issuedTokens.get(token.replace('Bearer ',''))||admin;if(body.password)authAccounts.get(id).password=body.password;return response({id})}
   return response({id:issuedTokens.get(token.replace('Bearer ',''))||admin});
  }
  if(p==='/auth/v1/admin/generate_link'){const account=[...authAccounts.values()].find(a=>a.email===body.email);if(!account)return response({},404);const hash=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');setupTokens.set(hash,account.id);return response({id:account.id,hashed_token:hash})}
  if(p==='/auth/v1/verify'){const id=setupTokens.get(body.token_hash);if(!id)return response({error_code:'otp_expired'},403);setupTokens.delete(body.token_hash);const account=authAccounts.get(id),token='recovery-'+id;account.confirmed=true;issuedTokens.set(token,id);return response({user:{id,email:account.email},access_token:token,refresh_token:'recovery-refresh',expires_in:3600})}
  if(p==='/auth/v1/logout')return response(null,204);
  if(p==='/auth/v1/admin/users'&&m==='POST'){
   const id=crypto.randomUUID();authAccounts.set(id,{id,email:body.email,password:body.password,confirmed:body.email_confirm===true});return response({id});
  }
  if(p.startsWith('/auth/v1/admin/users/')&&m==='GET'){
   const account=authAccounts.get(p.split('/').pop());return account?response({id:account.id,email:account.email,email_confirmed_at:account.confirmed?'2026-01-01T00:00:00Z':null,banned_until:account.banned_until}):response({},404);
  }
  if(p.startsWith('/auth/v1/admin/users/')&&m==='PUT'){
   const id=p.split('/').pop(),account=authAccounts.get(id);if(!account)return response({},404);
   if(body.password!==undefined)account.password=body.password;if(body.email_confirm===true)account.confirmed=true;return response({id});
  }
  if(p.startsWith('/auth/v1/admin/users/')&&m==='DELETE')return response({ok:true});
  if(p.startsWith('/rest/v1/pd_')){
   assert.equal(options.headers.apikey,'test-service-secret');
   const table=p.split('pd_')[1],rows=tables[table];assert.ok(rows,'Unknown table '+table);
   const filter=rows=>rows.filter(row=>[...u.searchParams].every(([key,value])=>{const field=key.startsWith('data->>')?row.data?.[key.slice(7)]:row[key];return value.startsWith('eq.')?(key==='data'?JSON.stringify(field):String(field))===value.slice(3):value.startsWith('not.in.(')?!value.slice(8,-1).split(',').includes(String(field)):value.startsWith('neq.')?String(field)!==value.slice(4):value.startsWith('in.(')?value.slice(4,-1).split(',').includes(String(field)):true}));
   if(m==='GET'){const limit=Number(u.searchParams.get('limit')||1000),offset=Number(u.searchParams.get('offset')||0);return response(filter(rows).slice(offset,offset+limit))}
   if(m==='POST'){
    const old=body?.id&&rows.find(row=>row.id===body.id);if(old){if(options.headers.Prefer==='resolution=merge-duplicates'){Object.assign(old,body);return response(null,204)}return response({code:'23505'},409)}
    if(table==='images'&&rows.some(r=>r.item_id===body.item_id&&r.slot===body.slot))return response({code:'23505'},409);
    rows.push({...body,...(table==='items'?{created:new Date().toISOString()}:{}),...(table==='boards'?{items:body.items||[]}: {})});return response(null,201);
   }
   if(m==='PATCH'){const changed=filter(rows);for(const row of changed)Object.assign(row,body);return options.headers.Prefer==='return=representation'?response(changed):response(null,204)}
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
 const env={ACCOUNT_SETUP_LIMIT:{limit:async()=>({success:true})},SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service-secret',CASTING_IP_LIMIT:{limit:async()=>({success:true})},CASTING_GLOBAL_LIMIT:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('<html>library</html>')}};
 async function req(path,{method='GET',body,cookie='__Host-pd_access=admin-token',origin='https://library.example',headers={}}={}){
  return handle(new Request('https://library.example'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...headers},body:body===undefined?undefined:body instanceof Uint8Array||body instanceof FormData?body:JSON.stringify(body)}),env);
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
 const f=fixture();const data={title:'Test talent',type:'casting',category:'Actor',city:'Prishtina',availability:'Check first',contact:'Agent contact',tags:['comedy'],casting:{playingAge:'25–35',height:'178 cm',languages:['English','Albanian','English'],skills:['Dance','Voice-over'],showreel:'https://example.test/reel',workedBefore:'yes'}};
 const created=await f.req('/api/items',{method:'POST',body:data});assert.equal(created.status,201);const {id}=await created.json();
 const stored=f.tables.items[0].data;assert.equal(stored.type,'casting');assert.deepEqual(stored.casting.languages,['English','Albanian']);assert.equal(stored.casting.workedBefore,'yes');
 let read=await(await f.req('/api/items',{cookie:'__Host-pd_access=crew-token'})).json();assert.equal(read[0].casting.playingAge,'25–35');assert.equal(read[0].casting.showreel,'https://example.test/reel');
 const update=await f.req('/api/items/'+id,{method:'PUT',body:{...data,casting:{...data.casting,skills:['Dance','Singing'],workedBefore:'no'}}});assert.equal(update.status,200);
 read=await(await f.req('/api/items')).json();assert.deepEqual(read[0].casting.skills,['Dance','Singing']);assert.equal(read[0].casting.workedBefore,'no');
 const {languages:removedLanguages,...visibleCasting}=read[0].casting;
 assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{...data,title:'Edited without a language field',casting:visibleCasting}})).status,200);
 read=await(await f.req('/api/items')).json();assert.deepEqual(read[0].casting.languages,['English','Albanian']);assert.deepEqual(read[0].casting.skills,['Dance','Singing']);
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

test('fixed categories validate up to ten predefined subcategories and keep tags independent',async()=>{
 const f=fixture(),data={title:'Reference',type:'location',subcategories:['City','Interior','Apartment','Building','Office','Graffiti','Mural','Wall','Facade','Street Art'],tags:['custom look']};
 const created=await f.req('/api/items',{method:'POST',body:data});assert.equal(created.status,201);const {id}=await created.json();
 const record=f.tables.items.find(x=>x.id===id).data;assert.equal(record.category,'Lokacion');assert.deepEqual(record.subcategories,data.subcategories);assert.deepEqual(record.tags,['custom look']);
 for(const subcategories of [['City','Village','Interior','Exterior','Office','Apartment','Wall','Graffiti','Mural','Facade','Street Art'],['Made up'],['City',123],null,'Office'])assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{...data,subcategories}})).status,400);
 assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{...data,type:'unknown'}})).status,400);
 assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{...data,subcategories:['office','Office']}})).status,200);assert.deepEqual(f.tables.items[0].data.subcategories,['Office']);
 const edit={title:'Renamed',type:'location',tags:['other manual tag']};assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:edit})).status,200);assert.deepEqual(f.tables.items[0].data.subcategories,['Office']);
});
test('legacy read compatibility does not rewrite stored data and edits preserve the previous category',async()=>{
 const f=fixture(),id=crypto.randomUUID();f.tables.items.push({id,created:'2026-01-01',data:{title:'Archive',type:'location',category:'Unusual former category',tags:['keep me']}});
 const read=(await (await f.req('/api/items')).json())[0];assert.equal(read.category,'Lokacion');assert.equal(read.legacyCategory,'Unusual former category');assert.deepEqual(read.subcategories,[]);assert.equal(f.tables.items[0].data.category,'Unusual former category');
 assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{title:'Archive',type:'location',subcategories:['Warehouse'],tags:['keep me']}})).status,200);
 const saved=f.tables.items[0].data;assert.equal(saved.legacyCategory,'Unusual former category');assert.deepEqual(saved.subcategories,['Warehouse']);assert.deepEqual(saved.tags,['keep me']);
});

test('new city writes use standardized spellings, reject unknown cities and preserve legacy entries on their original records',async()=>{
 const f=fixture(),data={title:'Mural',type:'location',city:'Prishtina',subcategories:['Grafiti','Mural','Mur'],tags:['manual wording']};
 let response=await f.req('/api/items',{method:'POST',body:data});assert.equal(response.status,201);const {id}=await response.json();assert.equal(f.tables.items[0].data.city,'Prishtinë');assert.deepEqual(f.tables.items[0].data.subcategories,['Graffiti','Mural','Wall']);
 response=await f.req('/api/items',{method:'POST',body:{...data,city:'New typo'}});assert.equal(response.status,400);
 response=await f.req('/api/items/'+id,{method:'PUT',body:{...data,city:'New typo'}});assert.equal(response.status,400);assert.equal(f.tables.items[0].data.city,'Prishtinë');
 response=await f.req('/api/items/'+id,{method:'PUT',body:{...data,city:'Tirana'}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.city,'Tiranë');
 f.tables.items[0].data.city='Old custom area';response=await f.req('/api/items/'+id,{method:'PUT',body:{...data,city:'Old custom area'}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.city,'Old custom area');
 response=await f.req('/api/items/'+id,{method:'PUT',body:{title:'Renamed mural',type:'location'}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.city,'Old custom area');
 response=await f.req('/api/items/'+id,{method:'PUT',body:{...data,city:'Skopje'}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.city,'Shkup');
});

const scheduleBody=()=>({title:'Shoot day 1',project:'Campaign Çela',date:'2026-10-20',startTime:'23:30',crewCall:'23:00',client:'Test client',meetingPoint:'Studio',contact:'Crew contact',notes:'Production notes',rows:[{id:crypto.randomUUID(),type:'scene',duration:90,shot:'01',description:'Opening',locationId:'',locationText:'',talentIds:[],propIds:[],notes:'Working notes'}]});
test('standalone shared schedules save, edit, duplicate and delete without becoming library references',async()=>{
 const f=fixture(),body=scheduleBody();let r=await f.req('/api/schedules',{method:'POST',body});assert.equal(r.status,201);const original=await r.json();assert(original.revision);assert.equal(original.project,'Campaign Çela');
 assert.equal((await (await f.req('/api/items')).json()).length,0);assert.equal((await f.req('/api/items/'+original.id,{method:'PUT',body:{title:'Oops',type:'location'}})).status,404);assert.equal((await f.req('/api/items/'+original.id,{method:'DELETE'})).status,404);assert.equal((await f.req('/api/items/'+original.id+'/images',{method:'POST',raw:new Uint8Array([255,216,255])})).status,404);
 const listing=await (await f.req('/api/schedules',{cookie:'__Host-pd_access=crew-token'})).json();assert.equal(listing.length,1);assert.equal(listing[0].id,original.id);
 r=await f.req('/api/schedules/'+original.id,{method:'PUT',body:{...body,title:'Changed',revision:original.revision}});assert.equal(r.status,200);const updated=await r.json();assert.notEqual(updated.revision,original.revision);
 assert.equal((await f.req('/api/schedules/'+original.id,{method:'PUT',body:{...body,title:'Stale',revision:original.revision}})).status,409);assert.equal((await (await f.req('/api/schedules/'+original.id)).json()).title,'Changed');
 r=await f.req('/api/schedules',{method:'POST',body:{...updated,title:'Day 2',date:'2026-10-21'}});assert.equal(r.status,201);const copy=await r.json();assert.notEqual(copy.id,original.id);assert.equal((await(await f.req('/api/schedules')).json()).length,2);
 const deck=await(await f.req('/api/boards',{method:'POST',body:{name:'Independent deck'}})).json();assert.equal((await f.req('/api/boards/'+deck.id,{method:'DELETE'})).status,200);assert.equal((await(await f.req('/api/schedules')).json()).length,2);
 assert.equal((await f.req('/api/schedules/'+original.id,{method:'DELETE'})).status,200);assert.equal((await f.req('/api/schedules/'+original.id)).status,404);assert.equal((await(await f.req('/api/schedules')).json()).length,1);
});
test('schedule references are type checked and snapshotted, and removed references can be cleared',async()=>{
 const f=fixture();const refs=[];for(const type of ['location','prop','casting'])refs.push(await(await f.req('/api/items',{method:'POST',body:{title:type+' reference',type}})).json());
 const body=scheduleBody();body.rows[0].locationId=refs[0].id;body.rows[0].propIds=[refs[1].id];body.rows[0].talentIds=[refs[2].id];
 let response=await f.req('/api/schedules',{method:'POST',body});assert.equal(response.status,201);const record=await response.json();assert.equal(record.referenceLabels[refs[0].id],'location reference');assert.equal((await(await f.req('/api/items')).json()).length,3);
 const bad=structuredClone(body);bad.rows[0].locationId=refs[1].id;assert.equal((await f.req('/api/schedules',{method:'POST',body:bad})).status,400);
 await f.req('/api/items/'+refs[0].id,{method:'DELETE'});assert.equal((await(await f.req('/api/schedules/'+record.id)).json()).referenceLabels[refs[0].id],'location reference');
 assert.equal((await f.req('/api/schedules/'+record.id,{method:'PUT',body:{...body,revision:record.revision}})).status,400);body.rows[0].locationId='';assert.equal((await f.req('/api/schedules/'+record.id,{method:'PUT',body:{...body,revision:record.revision}})).status,200);
 assert.equal((await f.req('/api/schedules/'+refs[1].id,{method:'DELETE'})).status,404);
});
test('schedule mutations reject bad durations, dates and shapes atomically, and require membership',async()=>{
 const f=fixture(),body=scheduleBody();for(const patch of [{date:'2026-02-30'},{startTime:'25:00'},{rows:[{...body.rows[0],duration:0}]},{rows:[{...body.rows[0],duration:721}]},{rows:[{...body.rows[0],talentIds:['not-a-uuid']}]},{rows:[body.rows[0],body.rows[0]]}])assert.equal((await f.req('/api/schedules',{method:'POST',body:{...body,...patch}})).status,400);
 assert.equal(f.tables.items.length,0);assert.equal((await f.req('/api/schedules',{cookie:''})).status,401);assert.equal((await f.req('/api/schedules',{method:'POST',body,cookie:''})).status,401);
});

test('call sheets are shared private documents with atomic revision checks and independent deletion',async()=>{
 const f=fixture(),body=ProductiondeckCallSheet.fresh();body.title='Call sheet Çela';body.date='2026-10-21';body.generalCall='07:30';body.hospital='Test hospital';
 let response=await f.req('/api/call-sheets',{method:'POST',body});assert.equal(response.status,201);const sheet=await response.json();assert(sheet.revision);assert.equal((await(await f.req('/api/items')).json()).length,0);assert.equal((await(await f.req('/api/schedules')).json()).length,0);
 assert.equal((await(await f.req('/api/call-sheets',{cookie:'__Host-pd_access=crew-token'})).json()).length,1);
 for(const method of ['PUT','DELETE'])assert.equal((await f.req('/api/items/'+sheet.id,{method,body:method==='PUT'?{title:'No',type:'location'}:undefined})).status,404);
 assert.equal((await f.req('/api/items/'+sheet.id+'/images',{method:'POST',raw:new Uint8Array([255,216,255])})).status,404);assert.equal((await f.req('/api/schedules/'+sheet.id,{method:'DELETE'})).status,404);
 response=await f.req('/api/call-sheets/'+sheet.id,{method:'PUT',body:{...body,title:'Updated',revision:sheet.revision}});assert.equal(response.status,200);const updated=await response.json();assert.notEqual(updated.revision,sheet.revision);
 assert.equal((await f.req('/api/call-sheets/'+sheet.id,{method:'PUT',body:{...body,revision:sheet.revision}})).status,409);assert.equal((await(await f.req('/api/call-sheets/'+sheet.id)).json()).title,'Updated');
 const schedule=await(await f.req('/api/schedules',{method:'POST',body:scheduleBody()})).json();assert.equal((await f.req('/api/call-sheets/'+schedule.id,{method:'DELETE'})).status,404);
 assert.equal((await f.req('/api/call-sheets/'+sheet.id,{method:'DELETE'})).status,200);assert.equal((await f.req('/api/call-sheets/'+sheet.id)).status,404);assert.equal((await(await f.req('/api/schedules')).json()).length,1);
});
test('call sheet validation and membership checks reject invalid writes without creating records',async()=>{
 const f=fixture(),body=ProductiondeckCallSheet.fresh();for(const patch of [{dayNumber:2,totalDays:1},{date:'2026-02-30'},{generalCall:'24:00'},{locations:[{...body.locations[0],mapUrl:'http://example.test'}]}])assert.equal((await f.req('/api/call-sheets',{method:'POST',body:{...body,...patch}})).status,400);assert.equal(f.tables.items.length,0);
 assert.equal((await f.req('/api/call-sheets',{cookie:''})).status,401);assert.equal((await f.req('/api/call-sheets',{method:'POST',body,cookie:''})).status,401);assert.equal((await f.req('/api/call-sheets',{method:'POST',body,origin:'https://other.test'})).status,403);
});

test('casting gender is optional, validated and preserved for older clients, and never stored on other reference types',async()=>{
 const f=fixture(),body={title:'Talent',type:'casting',casting:{gender:'female',playingAge:'25–35'}};
 let response=await f.req('/api/items',{method:'POST',body});assert.equal(response.status,201);const {id}=await response.json();assert.equal(f.tables.items[0].data.casting.gender,'female');
 response=await f.req('/api/items/'+id,{method:'PUT',body:{title:'Renamed',type:'casting',casting:{playingAge:'30–40'}}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.casting.gender,'female');
 response=await f.req('/api/items/'+id,{method:'PUT',body:{...body,casting:{gender:'male'}}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.casting.gender,'male');
 for(const gender of ['invalid',null,42,{},'__proto__'])assert.equal((await f.req('/api/items/'+id,{method:'PUT',body:{...body,casting:{gender}}})).status,400);
 response=await f.req('/api/items/'+id,{method:'PUT',body:{...body,casting:{gender:''}}});assert.equal(response.status,200);assert.equal(f.tables.items[0].data.casting.gender,'');
 for(const type of ['location','prop']){response=await f.req('/api/items',{method:'POST',body:{title:type,type,casting:{gender:'female'}}});assert.equal(response.status,201);const saved=f.tables.items.at(-1).data;assert(!Object.hasOwn(saved,'casting'));assert(!Object.hasOwn(saved,'gender'))}
 response=await f.req('/api/items',{method:'POST',body:{title:'Legacy talent',type:'casting'}});assert.equal(response.status,201);assert.equal(f.tables.items.at(-1).data.casting.gender,'');
});

test('crew contacts save multiple roles, custom roles and contacts independently of library and account data',async()=>{
 const f=fixture(),body={...ProductiondeckCrew.fresh(),firstName:'Arbër',lastName:'Çela',roles:['dp','camera_operator'],customRoles:['DIT'],city:'Prishtina',phone:'+383 44 123 456',email:'crew.external@example.test',dailyRate:'150 € / day',notes:'Own camera kit',workedBefore:'yes'};
 let response=await f.req('/api/crew',{method:'POST',body});assert.equal(response.status,201);const person=await response.json();assert.equal(person.city,'Prishtinë');assert.deepEqual(person.roles,['dp','camera_operator']);assert.deepEqual(person.customRoles,['DIT']);assert.equal(f.tables.members.length,2);assert.equal((await(await f.req('/api/items')).json()).length,0);assert.equal((await(await f.req('/api/schedules')).json()).length,0);assert.equal((await(await f.req('/api/call-sheets')).json()).length,0);
 assert.equal((await(await f.req('/api/crew',{cookie:'__Host-pd_access=crew-token'})).json()).length,1);response=await f.req('/api/crew/'+person.id,{method:'PUT',body:{...body,roles:[],customRoles:['Steadicam operator'],revision:person.revision}});assert.equal(response.status,200);const changed=await response.json();assert.notEqual(changed.revision,person.revision);assert.deepEqual(changed.roles,[]);assert.deepEqual(changed.customRoles,['Steadicam operator']);
 assert.equal((await f.req('/api/crew/'+person.id,{method:'PUT',body:{...body,revision:person.revision}})).status,409);assert.equal((await(await f.req('/api/crew/'+person.id)).json()).notes,'Own camera kit');
 for(const method of ['PUT','DELETE'])assert.equal((await f.req('/api/items/'+person.id,{method,body:method==='PUT'?{title:'No',type:'casting'}:undefined})).status,404);assert.equal((await f.req('/api/items/'+person.id+'/images',{method:'POST',raw:new Uint8Array([255,216,255])})).status,404);assert.equal((await f.req('/api/schedules/'+person.id,{method:'DELETE'})).status,404);assert.equal((await f.req('/api/call-sheets/'+person.id,{method:'DELETE'})).status,404);
 const reference=await(await f.req('/api/items',{method:'POST',body:{title:'Actor',type:'casting'}})).json();assert.equal((await f.req('/api/crew/'+reference.id,{method:'DELETE'})).status,404);assert.equal((await f.req('/api/crew/'+person.id,{method:'DELETE'})).status,200);assert.equal((await f.req('/api/crew/'+person.id)).status,404);assert.equal((await(await f.req('/api/items')).json()).length,1);assert.equal(f.tables.members.length,2);
});
test('crew validation, session and origin checks prevent invalid or unauthorized writes',async()=>{
 const f=fixture(),body={...ProductiondeckCrew.fresh(),firstName:'A',lastName:'B',roles:['dp']};for(const patch of [{roles:[],customRoles:[]},{roles:['unknown']},{email:'not-an-email'},{city:'Misspelled city'}])assert.equal((await f.req('/api/crew',{method:'POST',body:{...body,...patch}})).status,400);assert.equal(f.tables.items.length,0);
 assert.equal((await f.req('/api/crew',{cookie:''})).status,401);assert.equal((await f.req('/api/crew',{method:'POST',body,cookie:''})).status,401);assert.equal((await f.req('/api/crew',{method:'POST',body,origin:'https://other.test'})).status,403);
});

const applicationInput=()=>({firstName:'Arbër',lastName:'Çela',phone:'+383 44 123 456',email:'applicant@example.test',city:'Prishtina',gender:'male',playingAge:'25–35',height:'178 cm',languages:['Shqip'],skills:['Dance'],interests:['Actor'],showreel:'',experience:'Applicant experience',consent:true,consentVersion:ProductiondeckCastingApplication.consentVersion,submissionKey:crypto.randomUUID()});
const applicationPhoto=()=>new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1aiiisSAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==','base64'));
function applicationForm(input=applicationInput(),photos=[applicationPhoto()]){const form=new FormData();form.set('details',JSON.stringify(input));form.set('website','');for(const photo of photos)form.append('photos',new Blob([photo],{type:'image/jpeg'}),'photo.jpg');return form}
test('public applications stay private and pending with their photos until one authenticated approval',async()=>{
 const f=fixture(),input=applicationInput();assert.equal((await(await f.req('/api/public/casting/info',{cookie:''})).json()).open,true);
 const response=await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm({...input,type:'casting',status:'approved',tags:['forged']})});assert.equal(response.status,200,await response.clone().text());assert.deepEqual(Object.keys(await response.json()).sort(),['message','ok']);assert.equal(f.tables.members.length,2);
 const stored=f.tables.items.find(row=>row.data.type==='casting_application');assert.equal(stored.data.status,'pending');assert.equal(stored.data.candidate.city,'Prishtinë');assert.deepEqual(stored.data.candidate.tags,[]);assert.equal(stored.data.consent.version,ProductiondeckCastingApplication.consentVersion);assert.equal(f.tables.images.length,1);const image=f.tables.images[0].id;
 assert.equal((await(await f.req('/api/items')).json()).length,0);assert.equal((await f.req('/media/'+image,{cookie:''})).status,401);assert.equal((await f.req('/media/'+image)).status,200);assert.equal((await f.req('/api/casting-applications',{cookie:''})).status,401);assert.equal((await f.req('/api/public/casting/'+stored.id,{cookie:''})).status,404);
 assert.equal((await f.req('/api/items/'+stored.id,{method:'PUT',body:{title:'Bypass',type:'casting'}})).status,404);assert.equal((await f.req('/api/items/'+stored.id,{method:'DELETE'})).status,404);assert.equal((await f.req('/api/items/'+stored.id+'/images',{method:'POST',body:applicationPhoto()})).status,404);
 let apps=await(await f.req('/api/casting-applications')).json();assert.deepEqual(apps[0].images,[image]);const candidate={...apps[0].candidate,firstName:'Edited',tags:['commercial']};let edited=await f.req('/api/casting-applications/'+stored.id,{method:'PUT',body:{candidate,revision:apps[0].revision}});assert.equal(edited.status,200);const updated=await edited.json();assert.notEqual(updated.revision,apps[0].revision);assert.equal((await(await f.req('/api/items')).json()).length,0);
 assert.equal((await f.req('/api/casting-applications/'+stored.id+'/approve',{method:'POST',body:{candidate,revision:apps[0].revision}})).status,409);
 const approve=()=>f.req('/api/casting-applications/'+stored.id+'/approve',{method:'POST',body:{candidate,revision:updated.revision}});const approvals=await Promise.all([approve(),approve()]);assert.deepEqual(approvals.map(response=>response.status).sort(),[200,409]);
 const items=await(await f.req('/api/items')).json();assert.equal(items.length,1);assert.equal(items[0].type,'casting');assert.equal(items[0].title,'Edited Çela');assert.deepEqual(items[0].images,[image]);assert.equal(items[0].coverImage,image);assert.deepEqual(items[0].tags,['commercial']);assert.equal(items[0].casting.gender,'male');assert.equal(items[0].castingApplication.consent.version,ProductiondeckCastingApplication.consentVersion);assert.equal((await(await f.req('/api/casting-applications')).json()).length,0);
 assert.equal((await f.req('/api/casting-applications/'+stored.id,{method:'DELETE',body:{revision:updated.revision}})).status,409);assert(f.objects.has(image));assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(input)})).status,200);assert.equal(f.tables.items.length,1);
 assert.equal((await f.req('/api/items/'+stored.id,{method:'PUT',body:{title:'Renamed approved talent',type:'casting',casting:{gender:'male'}}})).status,200);assert(f.tables.items[0].data.castingApplication.consent);
});
test('applications can be paused and public submissions validate consent, image bounds and rate limits',async()=>{
 const f=fixture(),valid=applicationInput();for(const input of [{...valid,consent:false},{...valid,city:'New typo'},{...valid,email:'invalid'},{...valid,previousCommercial:'yes',previousCommercialProjects:'',previousCommercialRole:''}])assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(input)})).status,400);
 for(const photos of [[],Array(5).fill(applicationPhoto()),[new Uint8Array([255,216,255,217])],[new Uint8Array(701*1024)]])assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(valid,photos)})).status,400);assert.equal(f.tables.items.length,0);
 assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',origin:'https://evil.test',body:applicationForm(valid)})).status,403);
 f.env.CASTING_IP_LIMIT.limit=async()=>({success:false});assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(valid)})).status,429);f.env.CASTING_IP_LIMIT.limit=async()=>({success:true});f.env.CASTING_GLOBAL_LIMIT.limit=async()=>({success:false});assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(valid)})).status,429);f.env.CASTING_GLOBAL_LIMIT.limit=async()=>({success:true});
 assert.equal((await f.req('/api/casting-applications/intake',{method:'POST',body:{open:false}})).status,200);assert.equal((await(await f.req('/api/public/casting/info',{cookie:''})).json()).open,false);assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(valid)})).status,403);
 assert.equal((await f.req('/api/casting-applications/intake',{method:'POST',body:{open:true}})).status,200);assert.equal((await(await f.req('/api/public/casting/info',{cookie:''})).json()).open,true);assert.equal((await(await f.req('/api/items')).json()).length,0);delete f.env.CASTING_IP_LIMIT;assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(valid)})).status,503);
});
test('rejection deletes private photos and cannot race an approval into a missing library image',async()=>{
 const f=fixture();await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm()});let application=(await(await f.req('/api/casting-applications')).json())[0];assert.equal((await f.req('/api/casting-applications/'+application.id,{method:'DELETE',body:{revision:application.revision}})).status,200);assert.equal(f.tables.items.length,0);assert.equal(f.tables.images.length,0);assert.equal(f.objects.size,0);
 await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm()});application=(await(await f.req('/api/casting-applications')).json())[0];const result=await Promise.all([f.req('/api/casting-applications/'+application.id+'/approve',{method:'POST',body:{candidate:application.candidate,revision:application.revision}}),f.req('/api/casting-applications/'+application.id,{method:'DELETE',body:{revision:application.revision}})]);assert.deepEqual(result.map(response=>response.status).sort(),[200,409]);if(f.tables.items.length){assert.equal(f.tables.items[0].data.type,'casting');assert.equal(f.tables.images.length,1);assert.equal(f.objects.size,1)}else{assert.equal(f.tables.images.length,0);assert.equal(f.objects.size,0)}
});
test('failed uploads never enter Casting and incomplete private uploads can be removed safely',async()=>{
 const f=fixture();f.setStorageFailure(true);assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm()})).status,502);assert.equal((await(await f.req('/api/items')).json()).length,0);const application=(await(await f.req('/api/casting-applications')).json())[0];assert.equal(application.status,'uploading');assert.equal((await f.req('/api/casting-applications/'+application.id+'/approve',{method:'POST',body:{candidate:application.candidate,revision:application.revision}})).status,409);assert.equal((await f.req('/api/casting-applications/'+application.id,{method:'DELETE',body:{revision:application.revision}})).status,409);
 f.setStorageFailure(false);f.tables.items[0].data.submittedAt='2020-01-01T00:00:00Z';assert.equal((await f.req('/api/casting-applications/'+application.id,{method:'DELETE',body:{revision:application.revision}})).status,200);assert.equal(f.tables.items.length,0);assert.equal(f.tables.images.length,0);
});

test('the pending queue is bounded and a recoverable upload failure cleans up every reserved object and row',async()=>{
 const f=fixture();for(let index=0;index<200;index++)f.tables.items.push({id:crypto.randomUUID(),data:{type:'casting_application',status:'pending'}});assert.equal((await(await f.req('/api/public/casting/info',{cookie:''})).json()).open,false);assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm()})).status,503);assert.equal(f.tables.images.length,0);
 const clean=fixture(),handler=createHandler(async(url,options)=>{if(url.includes('/storage/v1/object/')&&options.method==='POST')return new Response('{}',{status:503});return clean.upstream(url,options)});const form=applicationForm();const response=await handler(new Request('https://library.example/api/public/casting/apply',{method:'POST',headers:{Origin:'https://library.example'},body:form}),clean.env);assert.equal(response.status,503);assert.equal(clean.tables.items.length,0);assert.equal(clean.tables.images.length,0);assert.equal(clean.objects.size,0);
});


test('private setup links let a teammate choose a verified password and sign in once without an email service',async()=>{
 const f=fixture();f.enableStrictAuth();f.authAccounts.get(crew).confirmed=false;
 let r=await f.req('/api/users/'+crew+'/status');assert.equal((await r.json()).state,'unconfirmed');
 r=await f.req('/api/users/'+crew+'/setup-link',{method:'POST',body:{}});assert.equal(r.status,200);const link=await r.json(),hash=new URL(link.url).hash.slice(7);assert.equal(new URL(link.url).pathname,'/account-setup.html');assert(!new URL(link.url).search);assert.equal(link.email,'crew@example.test');assert.equal(r.headers.get('set-cookie'),null);
 const setup={tokenHash:hash,password:'new-verified-teammate-password'};
 r=await f.req('/api/account-setup',{method:'POST',cookie:'',body:setup});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(f.authAccounts.get(crew).password,setup.password);assert.equal(f.authAccounts.get(admin).password,'admin-password-long');assert.equal((await r.json()).ok,true);
 r=await f.req('/api/account-setup',{method:'POST',cookie:'',body:setup});assert.equal(r.status,400);assert.equal((await r.json()).code,'setup_link_expired');assert.equal(r.headers.get('set-cookie'),null);
 r=await f.req('/api/login',{method:'POST',cookie:'',body:{email:'crew@example.test',password:setup.password}});assert.equal(r.status,200);
 assert.equal((await(await f.req('/api/users/'+crew+'/status')).json()).state,'ready');
});
test('account diagnostics distinguish email mismatch, disabled and missing Auth accounts without changing passwords',async()=>{
 const f=fixture();f.authAccounts.get(crew).email='other@example.test';assert.equal((await(await f.req('/api/users/'+crew+'/status')).json()).state,'email_mismatch');assert.equal((await f.req('/api/users/'+crew+'/setup-link',{method:'POST',body:{}})).status,409);
 f.authAccounts.get(crew).email='crew@example.test';f.authAccounts.get(crew).banned_until='2099-01-01T00:00:00Z';assert.equal((await(await f.req('/api/users/'+crew+'/status')).json()).state,'disabled');assert.equal((await f.req('/api/users/'+crew+'/setup-link',{method:'POST',body:{}})).status,409);
 f.authAccounts.delete(crew);assert.equal((await(await f.req('/api/users/'+crew+'/status')).json()).state,'missing_login');assert(!f.calls.some(call=>call.path==='/auth/v1/admin/generate_link'));
});
test('setup tools require administrator rights, valid private token, membership, same origin and rate limiting',async()=>{
 const f=fixture();f.enableStrictAuth();const endpoint='/api/users/'+crew+'/setup-link';
 assert.equal((await f.req(endpoint,{method:'POST',body:{},cookie:''})).status,401);assert.equal((await f.req(endpoint,{method:'POST',body:{},cookie:'__Host-pd_access=crew-token'})).status,403);assert.equal((await f.req('/api/users/'+admin+'/setup-link',{method:'POST',body:{}})).status,400);
 const link=await(await f.req(endpoint,{method:'POST',body:{}})).json(),body={tokenHash:new URL(link.url).hash.slice(7),password:'new-verified-password-long'};
 assert.equal((await f.req('/api/account-setup',{method:'POST',cookie:'',body,origin:'https://evil.example'})).status,403);
 assert.equal((await f.req('/api/account-setup',{method:'POST',cookie:'',body:{...body,password:'weak'}})).status,400);
 f.env.ACCOUNT_SETUP_LIMIT={limit:async()=>({success:false})};assert.equal((await f.req('/api/account-setup',{method:'POST',cookie:'',body})).status,429);
 f.env.ACCOUNT_SETUP_LIMIT={limit:async()=>({success:true})};f.tables.members=f.tables.members.filter(row=>row.id!==crew);assert.equal((await f.req('/api/account-setup',{method:'POST',cookie:'',body})).status,403);assert.equal(f.authAccounts.get(crew).password,'crew-password-long');
});
test('automatic tagging adds tags without replacing manual tags, references, photos or internal document data',async()=>{
 const f=fixture(),created=await(await f.req('/api/items',{method:'POST',body:{title:'Green bar',type:'location',tags:['Hand picked'],notes:'Keep private notes'}})).json();
 let r=await f.req('/api/items/'+created.id+'/auto-tags',{method:'POST',body:{version:'clip-laion-v1',tags:['E gjelbër','Bar']}});assert.equal(r.status,200);assert.deepEqual((await r.json()).tags,['Hand picked','E gjelbër','Bar']);const row=f.tables.items.find(row=>row.id===created.id);assert.equal(row.data.notes,'Keep private notes');assert.equal(row.data.autoTagging.version,'clip-laion-v1');
 assert.equal((await f.req('/api/items/'+created.id+'/auto-tags',{method:'POST',cookie:'',body:{version:'clip-laion-v1',tags:['Bad']}})).status,401);
 const talent=await(await f.req('/api/items',{method:'POST',body:{title:'Actor',type:'casting'}})).json();assert.equal((await f.req('/api/items/'+talent.id+'/auto-tags',{method:'POST',body:{version:'clip-laion-v1',tags:['Bar']}})).status,400);
 assert.equal((await f.req('/api/items/'+created.id+'/auto-tags',{method:'POST',body:{version:'wrong-model',tags:['Bar']}})).status,400);
 assert.equal((await f.req('/api/items/'+created.id,{method:'PUT',body:{...row.data,title:'Renamed bar'}})).status,200);assert.equal(row.data.autoTagging.version,'clip-laion-v1');
});

test('commercial history stays private until approval and is retained in Casting notes while team roles stay optional',async()=>{
 const f=fixture(),input={...applicationInput(),previousCommercial:'yes',previousCommercialProjects:'Client A campaign',previousCommercialRole:'Background performer',interests:['Presenter']};
 assert.equal((await f.req('/api/public/casting/apply',{method:'POST',cookie:'',body:applicationForm(input)})).status,200);
 let application=(await(await f.req('/api/casting-applications')).json())[0];assert.deepEqual(application.candidate.interests,[]);assert.equal(application.candidate.previousCommercialRole,'Background performer');assert.equal((await(await f.req('/api/items')).json()).length,0);
 const candidate={...application.candidate,previousCommercialProjects:'Client A and Client B campaigns'};assert.equal((await f.req('/api/casting-applications/'+application.id,{method:'PUT',body:{candidate,revision:application.revision}})).status,200);
 application=(await(await f.req('/api/casting-applications')).json())[0];assert.equal((await f.req('/api/casting-applications/'+application.id+'/approve',{method:'POST',body:{candidate:application.candidate,revision:application.revision}})).status,200);
 const profile=(await(await f.req('/api/items')).json())[0];assert(profile.notes.includes('Client A and Client B campaigns'));assert(profile.notes.includes('Background performer'));assert.equal(profile.casting.workedBefore,'unknown');assert.deepEqual(profile.subcategories,[]);
});
