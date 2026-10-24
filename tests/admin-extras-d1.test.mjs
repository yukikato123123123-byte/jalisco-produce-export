// Disposable in-memory workerd/D1 only. No existing local or remote DB is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {migrations,statefulProvider} from './helpers/auth-fixture.mjs';
const {URL}=globalThis;
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response:RuntimeResponse}=require('miniflare');
const {build}=require('esbuild');
test('real workerd/D1 atomic completed registrations, notification reads and draft audit/delete',{timeout:30000},async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const upstream=statefulProvider();
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',d1Databases:['DB'],bindings:{AUTH_ORIGIN:'https://app.example.test',SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'synthetic',SESSION_ENCRYPTION_KEY:'ab'.repeat(32)},serviceBindings:{ASSETS:async()=>new RuntimeResponse('public')},outboundService:async req=>{const r=await upstream.fetcher(req.url,{method:req.method,headers:{Authorization:req.headers.get('Authorization')},body:req.method==='GET'?undefined:await req.text()});return new RuntimeResponse(await r.arrayBuffer(),{status:r.status,headers:r.headers});}}));
 try{
  const db=await mf.getD1Database('DB');for(const migration of migrations)for(const sql of migration.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
  const request=(path,body,cookie)=>mf.dispatchFetch('https://app.example.test'+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:'https://app.example.test','Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async id=>{const user=upstream.users.get(id);const r=await request('/api/auth/login',{email:user.email,password:user.password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const owner=await login('u1'),buyer=await login('u2');
  for(const [cookie,role] of [[owner,'producer'],[buyer,'buyer']])assert.equal((await request('/api/auth/onboarding',{full_name:'Disposable '+role,company:'Fixture',country:'MX',role},cookie)).status,200);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM registration_notifications').first()).n,2);
  await db.prepare("INSERT INTO admin_grant_events VALUES('grant-extras','grant','u1','auth.example.test','synthetic-operator','owner','approval',?,'Disposable grant',NULL,'2026-10-23')").bind('c'.repeat(64)).run();
  assert.equal((await request('/api/admin/notifications',undefined,buyer)).status,403);
  const feed=await(await request('/api/admin/notifications',undefined,owner)).json();assert.equal(feed.unread_count,2);
  assert.equal((await request('/api/admin/notifications',{through:feed.through},owner)).status,200);assert.equal((await(await request('/api/admin/notifications',undefined,owner)).json()).unread_count,0);
  const created=await(await request('/api/producer/items',{name:'D1 draft',description:'',category:'Fruit',quantity:1,unit:'kg',price:'',currency:'',availability:'',status:'draft'},owner)).json();
  const row=(await(await request('/api/admin/products',undefined,owner)).json()).items.find(r=>r.id===created.saved_item_id);
  for(const action of ['draft_keep','draft_delete'])assert.equal((await request('/api/admin/drafts/'+row.id,{action,updated_at:row.updated_at,revision:row.revision,reason:'Disposable D1 check'},owner)).status,200);
  assert.equal((await db.prepare('SELECT count(*) n FROM producer_items').first()).n,0);assert.equal((await db.prepare('SELECT count(*) n FROM admin_draft_events').first()).n,2);assert.equal((await db.prepare('SELECT count(*) n FROM profiles').first()).n,2);
 }finally{await mf.dispose();}
});
