// Admin-issued, one-use account setup links. No passwords or links are emailed automatically.
const problem=(status,message,code)=>Object.assign(Error(message),{status,code});
const normalize=value=>String(value||'').trim().toLowerCase();
const validHash=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{32,256}$/.test(value);
export async function completeAccountSetup({request,env,body,upstream,membership}){
 if(request.method!=='POST')throw problem(405,'Method not allowed');
 const data=await body(request);
 if(!validHash(data.tokenHash))throw problem(400,'This setup link is incomplete. Ask your administrator for a new link.','setup_link_invalid');
 if(typeof data.password!=='string'||data.password.length<12||data.password.length>1024)throw problem(400,'Choose a password of at least 12 characters.');
 if(!env.ACCOUNT_SETUP_LIMIT)throw problem(503,'Account setup is temporarily unavailable. Ask your administrator to check the deployment.');
 if(!(await env.ACCOUNT_SETUP_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)throw problem(429,'Too many attempts. Wait a minute before trying again.');
 let recovery;
 try{recovery=await upstream('/auth/v1/verify',{method:'POST',anon:true,data:{token_hash:data.tokenHash,type:'recovery'}})}catch(error){if(error.status>=500||error.status===429)throw error;throw problem(400,'This setup link has expired or was already used. Ask your administrator for a new link.','setup_link_expired')}
 try{
  const member=await membership(recovery?.user?.id);
  if(!member||normalize(member.email)!==normalize(recovery.user.email))throw problem(403,'This login does not match an authorized team account. Ask your administrator to check its account status.','account_email_mismatch');
  if(!recovery.access_token)throw problem(502,'The account service did not return a valid setup session.');
  await upstream('/auth/v1/user',{method:'PUT',anon:true,access:recovery.access_token,data:{password:data.password}});
  const session=await upstream('/auth/v1/token?grant_type=password',{method:'POST',anon:true,data:{email:normalize(recovery.user.email),password:data.password}});
  if(session.user?.id!==member.id)throw problem(502,'The account service returned a different login.','auth_account_mismatch');
  return session;
 }finally{if(recovery?.access_token)try{await upstream('/auth/v1/logout?scope=local',{method:'POST',anon:true,access:recovery.access_token})}catch{}}
}
export async function accountTools({request,p,user,checkId,membership,upstream}){
 const match=p.match(/^\/api\/users\/([^/]+)\/(status|setup-link)$/);if(!match)return null;
 if(!user.admin)throw problem(403,'Administrator access required');
 const id=checkId(match[1]),action=match[2];
 if(request.method!==(action==='status'?'GET':'POST'))throw problem(405,'Method not allowed');
 const member=await membership(id);if(!member)throw problem(404,'Teammate not found');
 let account;try{const result=await upstream('/auth/v1/admin/users/'+id);account=result?.user||result}catch(error){if(error.code==='account_not_found'){const message='This team member has no matching Supabase login. The project owner needs to repair their Auth account before they can sign in.';if(action==='status')return {ok:false,state:'missing_login',message};throw problem(409,message,'account_not_found')}throw error}
 if(account?.id!==id)throw problem(502,'The account service returned a different user.','auth_account_mismatch');
 const matches=normalize(account.email)===normalize(member.email),disabled=Boolean(account.banned_until&&Date.parse(account.banned_until)>Date.now()),confirmed=Boolean(account.email_confirmed_at||account.confirmed_at);
 if(action==='status')return {ok:matches&&!disabled&&confirmed,state:!matches?'email_mismatch':disabled?'disabled':!confirmed?'unconfirmed':'ready',email:member.email,loginEmail:account.email,message:!matches?'The team email and Supabase login email differ. Ask the project owner to reconcile these accounts.':disabled?'Supabase has disabled this account. Ask the project owner to review its ban status.':!confirmed?'The email is unconfirmed. Create a private setup link so your teammate can set their own password.':'The team email and confirmed Supabase account match. If password sign-in fails, create a private setup link; this check does not test their password.'};
 if(!matches||disabled)throw problem(409,!matches?'The team email and Supabase login email differ. Check account status before issuing a link.':'This account is disabled in Supabase. Check account status first.');
 if(id===user.id)throw problem(400,'Use Change password for your own administrator account.');
 // Confirm only this existing, authorized email account; never create a public signup.
 if(!confirmed)await upstream('/auth/v1/admin/users/'+id,{method:'PUT',data:{email_confirm:true}});
 const result=await upstream('/auth/v1/admin/generate_link',{method:'POST',data:{type:'recovery',email:normalize(account.email)}});
 const hash=result?.hashed_token||result?.properties?.hashed_token,issuedId=result?.user?.id||result?.id;
 if(!validHash(hash)||issuedId!==id)throw problem(502,'The account service did not return a setup link for the expected teammate.','auth_account_mismatch');
 return {ok:true,email:member.email,url:new URL('/account-setup.html#token='+encodeURIComponent(hash),request.url).href};
}
