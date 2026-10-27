import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './helpers/auth-fixture.mjs';
import {handle} from '../worker/index.ts';
const {Request,crypto,URL,ReadableStream,TextEncoder}=globalThis;
const migration=readFileSync(new URL('../migrations/0015_nopal_launch_subscriptions.sql',import.meta.url),'utf8');
const input=()=>({email:' Person@Example.test ',language:'es',consent:true,consentVersion:'nopal-launch-v1'});
function launchFixture(){const f=fixture();f.sql.exec(migration);return f;}
const post=(f,body=input(),extra={})=>handle(new Request(f.env.AUTH_ORIGIN+'/api/public/launch-subscriptions',{method:'POST',headers:{Origin:f.env.AUTH_ORIGIN,'Content-Type':'application/json',...extra},body:typeof body==='string'?body:JSON.stringify(body)}),f.env);
test('launch requests persist normalized email, consent, language and one atomic audit, without login or email delivery',async()=>{
 const f=launchFixture();try{
  let r=await post(f);assert.equal(r.status,202);assert.deepEqual(await r.json(),{status:'saved'});assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('cache-control'),'no-store');
  const row=f.sql.prepare('SELECT * FROM nopal_launch_subscriptions').get();assert.equal(row.email,'person@example.test');assert.equal(row.language,'es');assert.equal(row.consent_version,'nopal-launch-v1');assert.equal(row.status,'requested');assert.equal(row.email_verified,0);assert.ok(!Number.isNaN(Date.parse(row.consented_at)));
  r=await post(f,{...input(),email:'person@example.test',language:'en'});assert.equal(r.status,202);assert.deepEqual(await r.json(),{status:'saved'});assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_events').get().n,1);assert.equal(f.sql.prepare('SELECT language FROM nopal_launch_subscriptions').get().language,'es');
  for(const table of ['profiles','sessions','auth_limits','admin_grants','admin_audit'])assert.equal(f.sql.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
  assert.deepEqual(f.upstream.stats,{puts:0,userChecks:0,authentications:0});
  assert.throws(()=>f.sql.exec("UPDATE nopal_launch_events SET action='requested'"),/append only/);assert.throws(()=>f.sql.exec('DELETE FROM nopal_launch_events'),/append only/);
 }finally{f.close();}
});
test('launch intake validates input on server and never stores rejected addresses or consent',async()=>{
 const f=launchFixture();try{
  for(const change of [{email:'invalid'},{email:'a\u0000@b.test'},{email:'x'.repeat(255)+'@a.test'},{email:42},{consent:false},{consent:'true'},{consentVersion:'other'},{language:'ko'}])assert.equal((await post(f,{...input(),...change})).status,400);
  for(const body of ['{bad','[]','null'])assert.equal((await post(f,body)).status,400);
  assert.equal((await post(f,' '.repeat(2049))).status,413);
  const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(' '.repeat(3000)));c.close();}});
  const r=await handle(new Request(f.env.AUTH_ORIGIN+'/api/public/launch-subscriptions',{method:'POST',headers:{Origin:f.env.AUTH_ORIGIN,'Content-Type':'application/json'},body:stream,duplex:'half'}),f.env);assert.equal(r.status,413);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,0);
 }finally{f.close();}
});
test('launch API enforces exact origin, JSON, method and no public subscriber list',async()=>{
 const f=launchFixture();try{
  for(const headers of [{Origin:'https://evil.test'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await post(f,input(),headers)).status,403);
  assert.equal((await post(f,input(),{'Content-Type':'text/plain'})).status,415);
  const r=await f.request('/api/public/launch-subscriptions');assert.equal(r.status,405);assert.equal(r.headers.get('Allow'),'POST');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await f.request('/api/admin/overview')).status,401);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,0);
 }finally{f.close();}
});
test('durable launch throttling is atomic and isolated from auth limits',async()=>{
 const f=launchFixture();try{
  for(let i=0;i<5;i++)assert.equal((await post(f)).status,202);
  const r=await post(f);assert.equal(r.status,429);assert.deepEqual(await r.json(),{code:'rate_limited'});assert.ok(Number(r.headers.get('Retry-After'))>0);
  assert.equal(f.sql.prepare('SELECT attempts FROM nopal_launch_limits').get().attempts,6);assert.equal(f.sql.prepare('SELECT count(*) n FROM auth_limits').get().n,0);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,1);
 }finally{f.close();}
});
test('database and audit failures never report success or leave partial subscription rows',async()=>{
 const f=launchFixture();try{
  f.sql.exec("CREATE TRIGGER reject_launch_audit BEFORE INSERT ON nopal_launch_events BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  let r=await post(f);assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'temporarily_unavailable'});assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,0);
  f.sql.exec('DROP TRIGGER reject_launch_audit');f.hooks.before=({query})=>{if(query.startsWith('SELECT s.id'))throw Error('synthetic read failure');};r=await post(f);assert.equal(r.status,503);delete f.hooks.before;
  assert.equal((await post(f)).status,202);assert.equal(f.sql.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').get().n,1);
 }finally{f.close();}
});
test('minimal migration keeps existing auth grants and business data unchanged',async()=>{
 const f=fixture();try{
  const cookie=await f.login();const before=f.sql.prepare('SELECT * FROM profiles').all();f.sql.exec(migration);assert.deepEqual(f.sql.prepare('SELECT * FROM profiles').all(),before);
  assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,403);
  assert.equal((await post(f,{...input(),id:crypto.randomUUID(),is_admin:true,role:'admin',status:'verified'})).status,202);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n,0);assert.equal((await f.request('/api/auth/session',undefined,cookie)).status,200);
 }finally{f.close();}
});
