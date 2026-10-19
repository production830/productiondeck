// Cloudflare Workers + Supabase. Secrets stay in Worker environment bindings.
const fail=(status,message,code)=>Object.assign(new Error(message),{status,code});
const clean=(v,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const email=v=>clean(v,320).toLowerCase();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const checkId=id=>{if(!uuid.test(id))throw fail(404,'Not found');return id};
const bucket='productiondeck-photos';
const security={
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'same-origin',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{...security,'Content-Type':'application/json'}})}
function itemData(b){
 if(!clean(b.title))throw fail(400,'Give this reference a name or title');
 if(!['location','prop','casting'].includes(b.type))throw fail(400,'Choose a location, prop, or casting profile');
 const data={title:clean(b.title),type:b.type,category:clean(b.category,80),city:clean(b.city,120),setting:clean(b.setting,40),availability:clean(b.availability,40)||'Available',tags:[...new Set((Array.isArray(b.tags)?b.tags:[]).map(t=>clean(t,50)).filter(Boolean))].slice(0,30),notes:clean(b.notes,5000),contact:clean(b.contact,500),address:clean(b.address,500),cost:clean(b.cost,100)};
 if(b.type==='casting'){
  const c=b.casting&&typeof b.casting==='object'&&!Array.isArray(b.casting)?b.casting:{};
  const list=(v,max)=>[...new Set((Array.isArray(v)?v:[]).map(x=>clean(x,max)).filter(Boolean))].slice(0,20);
  let showreel=clean(c.showreel,1000);
  if(showreel){try{const u=new URL(showreel);if(u.protocol!=='https:'||u.username||u.password)throw Error();showreel=u.href}catch{throw fail(400,'Use a complete HTTPS link for the showreel')}}
  data.casting={playingAge:clean(c.playingAge,50),height:clean(c.height,50),languages:list(c.languages,50),skills:list(c.skills,80),showreel,workedBefore:['yes','no','unknown'].includes(c.workedBefore)?c.workedBefore:'unknown'};
 }
 return data;
}

async function bytes(request,max){
 if(Number(request.headers.get('Content-Length'))>max)throw fail(413,'Upload is too large');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw fail(413,'Upload is too large')}parts.push(value)}
 const out=new Uint8Array(size);let at=0;for(const part of parts){out.set(part,at);at+=part.length}return out;
}
async function body(request){try{const b=JSON.parse(new TextDecoder().decode(await bytes(request,120000)));if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b}catch(e){if(e.status)throw e;throw fail(400,'Invalid JSON')}}
function imageMime(b){
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 const s=new TextDecoder().decode(b.slice(0,12));if(s.startsWith('RIFF')&&s.slice(8)==='WEBP')return 'image/webp';
 throw fail(400,'Use a JPEG, PNG, or WebP image');
}
export function createHandler(fetcher=fetch){
 return async function handle(request,env){
  let cookies=[];
  const finish=response=>{const out=new Response(response.body,response);for(const c of cookies)out.headers.append('Set-Cookie',c);return out};
  const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  const clear=()=>{cookies=[cookie('__Host-pd_access','',0),cookie('__Host-pd_refresh','',0)]};
  const setSession=session=>{cookies=[cookie('__Host-pd_access',session.access_token,session.expires_in||3600),cookie('__Host-pd_refresh',session.refresh_token,604800)]};
  const supplied=Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(v=>{const [k,...rest]=v.trim().split('=');try{return [k,decodeURIComponent(rest.join('='))]}catch{return [k,'']}}));
  try{
   const url=new URL(request.url),p=url.pathname;
   if(!p.startsWith('/api/')&&!p.startsWith('/media/')){
    if(!['GET','HEAD'].includes(request.method))throw fail(405,'Method not allowed');
    const response=await env.ASSETS.fetch(request);const out=new Response(response.body,response);for(const [k,v] of Object.entries(security))out.headers.set(k,v);return out;
   }
   if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)throw fail(403,'Invalid origin');
   if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)throw fail(503,'The library is not configured yet. Complete the Supabase setup in the project README.');
   const base=env.SUPABASE_URL.replace(/\/$/,'');
   if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))throw fail(503,'Check the Supabase Project URL in hosting settings.');
   // Legacy keys identify their project. Decode only for configuration checks; Supabase still verifies them.
   const projectRef=new URL(base).hostname.split('.')[0];
   for(const [name,key] of [['anon',env.SUPABASE_ANON_KEY],['service_role',env.SUPABASE_SERVICE_ROLE_KEY]]){
    let claims;try{const part=key.split('.')[1];if(part)claims=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')))}catch{}
    if(claims?.ref&&claims.ref!==projectRef)throw fail(503,'The Supabase '+name+' key belongs to a different project. Replace it in Cloudflare with the key from this library’s project.','auth_project_mismatch');
   }
   async function upstream(path,{method='GET',data,access,anon=false,raw=false,headers={}}={}){
    const key=anon?env.SUPABASE_ANON_KEY:env.SUPABASE_SERVICE_ROLE_KEY;
    let response;try{response=await fetcher(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+(access||key),...(data!==undefined&&!raw?{'Content-Type':'application/json'}:{}),...headers},body:data===undefined?undefined:raw?data:JSON.stringify(data)});}catch{throw fail(503,'The sign-in or data service is temporarily unavailable. Please try again.','service_unavailable')}
    if(raw&&response.ok)return response;
    const text=await response.text();let value;try{value=text?JSON.parse(text):null}catch{value=null}
    if(!response.ok){
     // Expose only explicit, actionable error categories, never raw upstream details or tokens.
     const auth=path.startsWith('/auth/'),code=value?.error_code||value?.code;
     if(response.status===429)throw fail(429,'Too many sign-in attempts or requests. Please wait a few minutes and try again.','rate_limited');
     if(response.status>=500)throw fail(503,'The sign-in or data service is temporarily unavailable. Please try again.','service_unavailable');
     if(auth){
      if(/^invalid api key$/i.test(value?.message||'')||code==='no_authorization'||code==='bad_jwt'&&path.includes('/token'))throw fail(503,'The Supabase sign-in key is invalid. Check SUPABASE_ANON_KEY in Cloudflare.','auth_key_invalid');
      if(code==='email_not_confirmed')throw fail(403,'This account needs email confirmation. Ask your administrator to use Reset password in Manage team.','email_not_confirmed');
      if(['email_provider_disabled','provider_disabled'].includes(code))throw fail(503,'Email/password sign-in is disabled in Supabase. Your administrator needs to enable the Email provider; public signup can remain off.','email_provider_disabled');
      if(code==='user_banned')throw fail(403,'This account is disabled. Ask your administrator to check its Supabase Auth status.','account_disabled');
      if(code==='same_password')throw fail(400,'Choose a new password that is different from the current password.','same_password');
      if(code==='weak_password')throw fail(400,'Choose a stronger password of at least 12 characters.','weak_password');
      if(['email_exists','user_already_exists'].includes(code))throw fail(409,'This login already exists. Use Reset password for the existing teammate.','account_exists');
      if(path.includes('grant_type=refresh_token')||path==='/auth/v1/user'&&response.status===401)throw fail(401,'Your session has expired. Please sign in again.','session_expired');
      if(path.includes('grant_type=password')&&(['invalid_credentials','invalid_grant'].includes(code)||!code&&[400,422].includes(response.status)))throw fail(401,'Email or password is incorrect. Use the password set for this library. Your administrator can reset it in Manage team.','invalid_credentials');
     }
     if(auth&&path.includes('/token'))throw fail(503,'The authentication service rejected sign-in for a reason other than a confirmed password mismatch. Check Supabase Authentication logs.','auth_request_rejected');
     if(response.status===409||code==='23505')throw fail(409,'This record already exists. Refresh and try again.');
     throw fail(502,'Could not complete the request. Check the library configuration and try again.');
    }
    return value;
   }
   const rest=(table,query='',options={})=>upstream('/rest/v1/pd_'+table+(query?'?'+query:''),options);
   async function membership(id){const rows=await rest('members','id=eq.'+checkId(id)+'&select=id,email,name,admin');return rows[0]}
   const authUser=access=>upstream('/auth/v1/user',{access,anon:true});
   if(p==='/api/login'&&request.method==='POST'){
    const b=await body(request);if(!email(b.email)||typeof b.password!=='string'||b.password.length>1024)throw fail(400,'Enter an email and password');
    const session=await upstream('/auth/v1/token?grant_type=password',{method:'POST',anon:true,data:{email:email(b.email),password:b.password}});
    if(!await membership(session.user.id))throw fail(403,'This account does not have access to this library');
    setSession(session);return finish(json({ok:true}));
   }
   if(p==='/api/logout'&&request.method==='POST'){
    if(supplied['__Host-pd_access'])try{await upstream('/auth/v1/logout?scope=local',{method:'POST',access:supplied['__Host-pd_access'],anon:true})}catch{}
    clear();return finish(json({ok:true}));
   }
   // Refresh tokens only on the single bootstrap request. Concurrent image requests never rotate cookies.
   let access=supplied['__Host-pd_access'],identity;
   if(access)try{identity=await authUser(access)}catch(e){if(e.status!==401)throw e}
   if(!identity&&p==='/api/me'&&supplied['__Host-pd_refresh']){
    try{const session=await upstream('/auth/v1/token?grant_type=refresh_token',{method:'POST',anon:true,data:{refresh_token:supplied['__Host-pd_refresh']}});access=session.access_token;identity=session.user;setSession(session)}catch(e){if(e.status!==401)throw e;clear()}
   }
   if(!identity)throw fail(401,'Please sign in.','session_expired');
   const user=await membership(identity.id);if(!user){clear();throw fail(401,'Your access to this library has been removed. Ask your administrator.','access_removed')}
   if(p==='/api/me'&&request.method==='GET')return finish(json(user));
   if(p==='/api/password'&&request.method==='POST'){
    const b=await body(request);if(typeof b.current!=='string'||b.current.length>1024||typeof b.password!=='string'||b.password.length<12||b.password.length>1024)throw fail(400,'Use a password between 12 and 1024 characters');
    const verification=await upstream('/auth/v1/token?grant_type=password',{method:'POST',anon:true,data:{email:user.email,password:b.current}});
    await upstream('/auth/v1/user',{method:'PUT',anon:true,access:verification.access_token,data:{password:b.password}});
    // Revoke refresh tokens, then clear cookies; reauthentication is required after a password change.
    await upstream('/auth/v1/logout?scope=global',{method:'POST',anon:true,access:verification.access_token});clear();return finish(json({ok:true}));
   }
   if(p==='/api/users'){
    if(!user.admin)throw fail(403,'Administrator access required');
    if(request.method==='GET')return finish(json(await rest('members','select=id,email,name,admin&order=name')));
    if(request.method==='POST'){
     const b=await body(request);if(!email(b.email).includes('@')||typeof b.password!=='string'||b.password.length<12||b.password.length>1024)throw fail(400,'Use an email and a password of at least 12 characters');
     const created=await upstream('/auth/v1/admin/users',{method:'POST',data:{email:email(b.email),password:b.password,email_confirm:true}});
     const id=created.id||created.user?.id;checkId(id);
     try{await rest('members','',{method:'POST',data:{id,email:email(b.email),name:clean(b.name)||email(b.email),admin:false}})}catch(e){try{await upstream('/auth/v1/admin/users/'+id,{method:'DELETE'})}catch{}throw e}
     return finish(json({ok:true},201));
    }
   }
   async function teammateAccount(id){
    const member=await membership(id);if(!member)throw fail(404,'Teammate not found');
    const result=await upstream('/auth/v1/admin/users/'+id);const account=result?.user||result;
    if(account?.id!==id)throw fail(502,'Supabase did not return the expected teammate account.','auth_account_mismatch');
    if(email(account.email)!==email(member.email))throw fail(409,'The team list email differs from the Supabase login email for this person. Ask the project owner to check Authentication → Users before changing this account.','account_email_mismatch');
    return member;
   }
   async function verifyTeammate(id,loginEmail,password){
    const verification=await upstream('/auth/v1/token?grant_type=password',{method:'POST',anon:true,data:{email:loginEmail,password}});
    try{
     if(verification?.user?.id!==id)throw fail(502,'The sign-in service returned a different account. Check the Supabase project configuration.','auth_account_mismatch');
    }finally{
     if(verification?.access_token)try{await upstream('/auth/v1/logout?scope=local',{method:'POST',anon:true,access:verification.access_token})}catch{}
    }
   }
   const checkMatch=p.match(/^\/api\/users\/([^/]+)\/check-login$/);
   if(checkMatch&&request.method==='POST'){
    if(!user.admin)throw fail(403,'Administrator access required');
    const id=checkId(checkMatch[1]);const member=await teammateAccount(id);
    const b=await body(request);if(typeof b.password!=='string'||!b.password.length||b.password.length>1024)throw fail(400,'Enter the library password to test');
    await verifyTeammate(id,member.email,b.password);
    return finish(json({ok:true,message:'Supabase accepted this email and password for the correct teammate. No password was changed.'}));
   }
   const resetMatch=p.match(/^\/api\/users\/([^/]+)\/password$/);
   if(resetMatch&&request.method==='POST'){
    if(!user.admin)throw fail(403,'Administrator access required');
    const id=checkId(resetMatch[1]);if(id===user.id)throw fail(400,'Use Change password for your own account.');
    const member=await teammateAccount(id);
    const b=await body(request);if(typeof b.password!=='string'||b.password.length<12||b.password.length>1024)throw fail(400,'Use a password between 12 and 1024 characters');
    await upstream('/auth/v1/admin/users/'+id,{method:'PUT',data:{password:b.password,email_confirm:true}});
    try{await verifyTeammate(id,member.email,b.password)}catch(e){throw fail(e.status||502,'Password updated, but Supabase did not verify sign-in: '+e.message,e.code||'login_verification_failed')}
    return finish(json({ok:true}));
   }
   let match=p.match(/^\/api\/users\/([^/]+)$/);
   if(match&&request.method==='DELETE'){
    if(!user.admin)throw fail(403,'Administrator access required');const id=checkId(match[1]);if(id===user.id)throw fail(400,'You cannot remove your own account');
    // Revoke membership first so even unexpired access tokens lose library access immediately.
    await rest('members','id=eq.'+id,{method:'DELETE'});
    await upstream('/auth/v1/admin/users/'+id,{method:'DELETE'});return finish(json({ok:true}));
   }
   if(p==='/api/items'&&request.method==='GET'){
    // PostgREST defaults to 1,000 rows; paginate to avoid silently dropping library records.
    const all=async(table,query)=>{let rows=[],page;do{page=await rest(table,query+'&limit=500&offset='+rows.length);rows.push(...page)}while(page.length===500);return rows};
    const [items,images]=await Promise.all([all('items','select=id,data,created&order=created.desc,id'),all('images','select=id,item_id,slot&order=id')]);
    const groups=new Map();for(const im of images){if(!groups.has(im.item_id))groups.set(im.item_id,[]);groups.get(im.item_id).push(im)}
    return finish(json(items.map(r=>({...r.data,id:r.id,created:r.created,images:(groups.get(r.id)||[]).sort((a,b)=>a.slot-b.slot).map(im=>im.id)}))));
   }
   if(p==='/api/items'&&request.method==='POST'){
    const data=itemData(await body(request)),id=crypto.randomUUID();await rest('items','',{method:'POST',data:{id,data}});return finish(json({id},201));
   }
   match=p.match(/^\/api\/items\/([^/]+)$/);
   if(match&&['PUT','DELETE'].includes(request.method)){
    const id=checkId(match[1]),rows=await rest('items','id=eq.'+id+'&select=id');if(!rows.length)throw fail(404,'Reference not found');
    if(request.method==='PUT'){await rest('items','id=eq.'+id,{method:'PATCH',data:{data:itemData(await body(request))}});return finish(json({ok:true}))}
    const images=await rest('images','item_id=eq.'+id+'&select=id');
    // Delete stored bytes before removing their metadata, so a storage failure can be retried.
    if(images.length)await upstream('/storage/v1/object/'+bucket,{method:'DELETE',data:{prefixes:images.map(im=>im.id)}});
    await rest('items','id=eq.'+id,{method:'DELETE'});return finish(json({ok:true}));
   }
   match=p.match(/^\/api\/items\/([^/]+)\/images$/);
   if(match&&request.method==='POST'){
    const item_id=checkId(match[1]);if(!(await rest('items','id=eq.'+item_id+'&select=id')).length)throw fail(404,'Reference not found');
    const taken=await rest('images','item_id=eq.'+item_id+'&select=slot');let slot=0;while(taken.some(im=>im.slot===slot))slot++;if(slot===12)throw fail(400,'Maximum 12 photos per reference');
    const data=await bytes(request,8*1024*1024),mime=imageMime(data),id=crypto.randomUUID();
    // Unique slots enforce the limit even when coworkers upload at the same time.
    await rest('images','',{method:'POST',data:{id,item_id,mime,slot}});
    try{await upstream('/storage/v1/object/'+bucket+'/'+id,{method:'POST',data,raw:true,headers:{'Content-Type':mime,'x-upsert':'false'}})}catch(e){try{await rest('images','id=eq.'+id,{method:'DELETE'})}catch{}throw e}
    return finish(json({id},201));
   }
   match=p.match(/^\/media\/([^/]+)$/);
   if(match&&request.method==='GET'){
    const id=checkId(match[1]),images=await rest('images','id=eq.'+id+'&select=mime');if(!images.length)throw fail(404,'Image not found');
    const photo=await upstream('/storage/v1/object/authenticated/'+bucket+'/'+id,{raw:true});return finish(new Response(photo.body,{headers:{...security,'Content-Type':images[0].mime}}));
   }
   if(p==='/api/boards'&&request.method==='GET')return finish(json(await rest('boards','select=id,name,items&order=name&limit=1000')));
   if(p==='/api/boards'&&request.method==='POST'){
    const b=await body(request),name=clean(b.name,100);if(!name)throw fail(400,'Name your shortlist');const id=crypto.randomUUID();await rest('boards','',{method:'POST',data:{id,name}});return finish(json({id},201));
   }
   match=p.match(/^\/api\/boards\/([^/]+)$/);
   if(match&&['PUT','DELETE'].includes(request.method)){
    const id=checkId(match[1]);if(!(await rest('boards','id=eq.'+id+'&select=id')).length)throw fail(404,'Shortlist not found');
    if(request.method==='DELETE'){await rest('boards','id=eq.'+id,{method:'DELETE'});return finish(json({ok:true}))}
    const b=await body(request);if(!Array.isArray(b.items)||b.items.length>500||b.items.some(id=>typeof id!=='string'||!uuid.test(id)))throw fail(400,'Invalid shortlist');
    await rest('boards','id=eq.'+id,{method:'PATCH',data:{items:[...new Set(b.items)]}});return finish(json({ok:true}));
   }
   throw fail(404,'Not found');
  }catch(e){return finish(json({error:e.status?e.message:'Something went wrong. Please try again.',...(e.code?{code:e.code}:{})},e.status||500))}
 };
}
export default {fetch:createHandler()};
