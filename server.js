import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const dir=resolve(process.env.DATA_DIR||join(root,'data'));
mkdirSync(join(dir,'images'),{recursive:true});
const db=new DatabaseSync(join(dir,'productiondeck.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,admin INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,data TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,item_id TEXT REFERENCES items(id) ON DELETE CASCADE,mime TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS boards(id TEXT PRIMARY KEY,name TEXT NOT NULL,items TEXT NOT NULL DEFAULT '[]');`);
const hash=s=>createHash('sha256').update(s).digest('hex');
function password(p,s=randomBytes(16).toString('hex')){return s+':'+scryptSync(p,s,64).toString('hex')}
function verify(p,encoded){const [s,h]=encoded.split(':');return timingSafeEqual(Buffer.from(h,'hex'),scryptSync(p,s,64))}
const email=s=>String(s||'').trim().toLowerCase();
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
 const p=process.env.ADMIN_PASSWORD,e=email(process.env.ADMIN_EMAIL);
 if(!p||p.length<12||!e.includes('@')) throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) for first startup.');
 db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run(randomUUID(),e,'Administrator',password(p));
}
const secure=process.env.COOKIE_SECURE!=='false';
const attempts=new Map();
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function body(req,max=120000){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw fail(413,'Upload is too large');parts.push(part)}return Buffer.concat(parts)}
const jsonBody=async req=>{try{return JSON.parse((await body(req)).toString())}catch(e){if(e.status)throw e;throw fail(400,'Invalid JSON')}};
function clean(v,max=300){return String(v||'').trim().slice(0,max)}
function itemData(b){if(!clean(b.title))throw fail(400,'Give this reference a title');if(!['location','prop'].includes(b.type))throw fail(400,'Choose a location or prop');return {title:clean(b.title),type:b.type,category:clean(b.category,80),city:clean(b.city,120),setting:clean(b.setting,40),availability:clean(b.availability,40)||'Available',tags:[...new Set((Array.isArray(b.tags)?b.tags:[]).map(t=>clean(t,50)).filter(Boolean))].slice(0,30),notes:clean(b.notes,5000),contact:clean(b.contact,500),address:clean(b.address,500),cost:clean(b.cost,100)}}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function imageMime(b){if(b.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';throw fail(400,'Use a JPEG, PNG, or WebP image')}
export const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),p=u.pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin){if(new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Invalid origin')}
 if(p==='/api/login'&&req.method==='POST'){
  const b=await jsonBody(req),e=email(b.email),now=Date.now();
  if(attempts.size>10000)for(const [key,a] of attempts)if(now-a.start>900000)attempts.delete(key);
  const a=attempts.get(e)||{start:now,count:0};if(now-a.start>900000){a.start=now;a.count=0}a.count++;attempts.set(e,a);
  if(a.count>8)throw fail(429,'Too many attempts. Try again in 15 minutes.');
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(e);
  const valid=verify(String(b.password||''),user?.password||password('invalid','0'.repeat(32)));
  if(!user||!valid)throw fail(401,'Email or password is incorrect');
  attempts.delete(e);db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,now+7*86400000);
  return send(res,200,{ok:true},{'Set-Cookie':`pd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`});
 }
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)pd_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const user=token&&db.prepare('SELECT u.id,u.email,u.name,u.admin FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now());
 if(p.startsWith('/api/')||p.startsWith('/media/')){
  if(!user)throw fail(401,'Please sign in');
  if(p==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));return send(res,200,{ok:true},{'Set-Cookie':'pd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
  if(p==='/api/me')return send(res,200,user);
  if(p==='/api/password'&&req.method==='POST'){
   const b=await jsonBody(req),record=db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
   if(typeof b.current!=='string'||!verify(b.current,record.password))throw fail(400,'Current password is incorrect');
   if(typeof b.password!=='string'||b.password.length<12||b.password.length>1024)throw fail(400,'Use a password between 12 and 1024 characters');
   db.prepare('UPDATE users SET password=? WHERE id=?').run(password(b.password),user.id);
   db.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').run(user.id,hash(token));return send(res,200,{ok:true});
  }
  if(p==='/api/users'){
   if(!user.admin)throw fail(403,'Administrator access required');
   if(req.method==='GET')return send(res,200,db.prepare('SELECT id,name,email,admin FROM users').all());
   if(req.method==='POST'){const b=await jsonBody(req);if(!email(b.email).includes('@')||String(b.password||'').length<12)throw fail(400,'Use an email and a password of at least 12 characters');try{db.prepare('INSERT INTO users VALUES(?,?,?,?,0)').run(randomUUID(),email(b.email),clean(b.name)||email(b.email),password(b.password))}catch{throw fail(409,'This email already has an account')}return send(res,201,{ok:true})}
  }
  if(p.startsWith('/api/users/')&&req.method==='DELETE'){if(!user.admin)throw fail(403,'Administrator access required');const id=p.split('/').pop();if(id===user.id)throw fail(400,'You cannot remove your own account');db.prepare('DELETE FROM users WHERE id=?').run(id);return send(res,200,{ok:true})}
  if(p==='/api/items'&&req.method==='GET')return send(res,200,db.prepare('SELECT * FROM items ORDER BY created DESC').all().map(r=>({id:r.id,...JSON.parse(r.data),created:r.created,images:db.prepare('SELECT id FROM images WHERE item_id=?').all(r.id).map(x=>x.id)})));
  if(p==='/api/items'&&req.method==='POST'){const data=itemData(await jsonBody(req)),id=randomUUID();db.prepare('INSERT INTO items VALUES(?,?,?)').run(id,JSON.stringify(data),new Date().toISOString());return send(res,201,{id})}
  if(/^\/api\/items\/[^/]+$/.test(p)){
   const id=p.split('/').pop();if(!db.prepare('SELECT id FROM items WHERE id=?').get(id))throw fail(404,'Reference not found');
   if(req.method==='PUT'){db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(itemData(await jsonBody(req))),id);return send(res,200,{ok:true})}
   if(req.method==='DELETE'){const imgs=db.prepare('SELECT id FROM images WHERE item_id=?').all(id);db.prepare('DELETE FROM items WHERE id=?').run(id);for(const im of imgs)try{unlinkSync(join(dir,'images',im.id))}catch{}return send(res,200,{ok:true})}
  }
  if(/^\/api\/items\/[^/]+\/images$/.test(p)&&req.method==='POST'){
   const id=p.split('/')[3];if(!db.prepare('SELECT id FROM items WHERE id=?').get(id))throw fail(404,'Reference not found');
   if(db.prepare('SELECT COUNT(*) AS n FROM images WHERE item_id=?').get(id).n>=12)throw fail(400,'Maximum 12 photos per reference');
   const bytes=await body(req,8*1024*1024),mime=imageMime(bytes),im=randomUUID();writeFileSync(join(dir,'images',im),bytes);try{db.prepare('INSERT INTO images VALUES(?,?,?)').run(im,id,mime)}catch(e){unlinkSync(join(dir,'images',im));throw e}return send(res,201,{id:im});
  }
  if(p.startsWith('/media/')&&req.method==='GET'){const id=p.split('/').pop(),im=db.prepare('SELECT mime FROM images WHERE id=?').get(id);if(!im)throw fail(404,'Image not found');res.writeHead(200,{'Content-Type':im.mime,'Cache-Control':'private, no-store'});return res.end(readFileSync(join(dir,'images',id)))}
  if(p==='/api/boards'&&req.method==='GET')return send(res,200,db.prepare('SELECT * FROM boards ORDER BY name').all().map(b=>({...b,items:JSON.parse(b.items)})));
  if(p==='/api/boards'&&req.method==='POST'){const b=await jsonBody(req),name=clean(b.name,100);if(!name)throw fail(400,'Name your shortlist');const id=randomUUID();db.prepare('INSERT INTO boards(id,name) VALUES(?,?)').run(id,name);return send(res,201,{id})}
  if(p.startsWith('/api/boards/')){const id=p.split('/').pop();if(req.method==='PUT'){const b=await jsonBody(req);if(!Array.isArray(b.items)||b.items.length>500)throw fail(400,'Invalid shortlist');const ids=b.items.filter(x=>typeof x==='string'&&db.prepare('SELECT id FROM items WHERE id=?').get(x));db.prepare('UPDATE boards SET items=? WHERE id=?').run(JSON.stringify([...new Set(ids)]),id);return send(res,200,{ok:true})}if(req.method==='DELETE'){db.prepare('DELETE FROM boards WHERE id=?').run(id);return send(res,200,{ok:true})}}
  throw fail(404,'Not found');
 }
 const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
 if(!files[p]||!['GET','HEAD'].includes(req.method))throw fail(404,'Not found');
 const [f,mime]=files[p];res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:readFileSync(join(root,'public',f)));
 }catch(e){if(!e.status)console.error(e);if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'});else res.end()}});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Productiondeck ready on port '+(process.env.PORT||3000)));
