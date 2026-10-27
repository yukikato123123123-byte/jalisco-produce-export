// Disposable in-memory workerd/D1 only. No existing local or remote DB is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {migrations,statefulProvider} from './helpers/auth-fixture.mjs';
const {URL,Response}=globalThis;
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response:RuntimeResponse}=require('miniflare');
const {build}=require('esbuild');
test('real workerd/D1 enforces trusted admin grants and atomic publication/audit writes',{timeout:30000},async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const upstream=statefulProvider();upstream.hooks.fetch=async({path,method,normal})=>{const r=normal();return path.endsWith('/user')&&method==='GET'&&r.ok?Response.json({...await r.json(),user_metadata:{role:'admin',is_admin:true}}):r;};
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',d1Databases:['DB'],bindings:{AUTH_ORIGIN:'https://app.example.test',SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'synthetic',SESSION_ENCRYPTION_KEY:'ab'.repeat(32)},serviceBindings:{ASSETS:async()=>new RuntimeResponse('public')},outboundService:async req=>{const r=await upstream.fetcher(req.url,{method:req.method,headers:{Authorization:req.headers.get('Authorization')},body:req.method==='GET'?undefined:await req.text()});return new RuntimeResponse(await r.arrayBuffer(),{status:r.status,headers:r.headers});}}));
 try{
  const db=await mf.getD1Database('DB');for(const migration of migrations)for(const sql of migration.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
  const request=(path,body,cookie)=>mf.dispatchFetch('https://app.example.test'+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:'https://app.example.test','Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async id=>{const user=upstream.users.get(id);const r=await request('/api/auth/login',{email:user.email,password:user.password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  assert.equal((await request('/api/admin/accounts')).status,401);
  const ordinary=await login('u1'),admin=await login('u2');
  await db.prepare("INSERT INTO profiles VALUES('u1','Producer','Farm','Mexico','producer'),('u2','Buyer','Buyer','US','buyer')").run();
  await db.prepare("INSERT INTO producer_items VALUES('item','u1','Nopal','','Cactus',10,'kg',NULL,'','','public','2026-10-22')").run();
  await db.prepare("INSERT INTO buyer_publications VALUES('u2','public-buyer','Buyer','US','','','Nopal','',1,'buyer-directory-v1','2026-10-22',NULL,'2026-10-22')").run();
  assert.equal((await request('/api/admin/overview',undefined,admin)).status,403);
  await db.prepare("INSERT INTO admin_grant_events VALUES('grant-1','grant','u2','auth.example.test','cf-token:synthetic','owner','approval',?,'Synthetic grant',NULL,'2026-10-23')").bind('a'.repeat(64)).run();
  for(const section of ['overview','accounts','producers','buyers','products','inquiries','readiness','security']){assert.equal((await request('/api/admin/'+section,undefined,ordinary)).status,403);assert.equal((await request('/api/admin/'+section,undefined,admin)).status,200);}
  const action={action:'product_status',target_id:'item',before_state:'public',after_state:'private',reason:'Synthetic review'};
  assert.equal((await request('/api/admin/actions',action,ordinary)).status,403);assert.equal((await request('/api/admin/actions',action,admin)).status,200);
  assert.equal((await db.prepare('SELECT status FROM producer_items').first()).status,'private');assert.equal((await db.prepare('SELECT actor_id FROM admin_audit').first()).actor_id,'u2');
  assert.equal((await request('/api/admin/actions',action,admin)).status,409);assert.equal((await db.prepare('SELECT count(*) n FROM admin_audit').first()).n,1);
  assert.equal((await request('/api/admin/actions',{action:'buyer_unpublish',target_id:'public-buyer',before_state:'1',after_state:'0',reason:'Synthetic revocation'},admin)).status,200);assert.equal((await db.prepare('SELECT published FROM buyer_publications').first()).published,0);
  await assert.rejects(()=>db.prepare('DELETE FROM admin_audit').run(),/append only/);
  await assert.rejects(()=>db.prepare("UPDATE admin_grants SET revoked_at='forged'").run(),/audited transition/);
  await db.prepare("CREATE TRIGGER fail_access_audit BEFORE INSERT ON admin_grant_events BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END").run();
  await assert.rejects(()=>db.prepare("INSERT INTO admin_grant_events VALUES('failed-revoke','revoke','u2','auth.example.test','cf-token:synthetic','owner','approval',?,'Failed revoke','grant-1','2026-10-24')").bind('b'.repeat(64)).run(),/Synthetic audit failure/);
  assert.equal((await db.prepare('SELECT revoked_at FROM admin_grants').first()).revoked_at,null);
  assert.equal((await db.prepare('SELECT count(*) n FROM admin_grant_events').first()).n,1);
  await db.prepare('DROP TRIGGER fail_access_audit').run();
  await db.prepare("INSERT INTO admin_grant_events VALUES('revoke-1','revoke','u2','auth.example.test','cf-token:synthetic','owner','approval',?,'Synthetic revoke','grant-1','2026-10-24')").bind('b'.repeat(64)).run();assert.equal((await request('/api/admin/accounts',undefined,admin)).status,403);
 }finally{await mf.dispose();}
});
