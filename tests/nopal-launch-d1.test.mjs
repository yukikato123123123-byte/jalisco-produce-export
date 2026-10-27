// Disposable in-memory workerd/D1. No existing local or remote records are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {URL}=globalThis;
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response:RuntimeResponse}=require('miniflare');
const {build}=require('esbuild');
test('real workerd/D1 stores launch requests and atomic audit, deduplicates concurrent requests and isolates public access',{timeout:30000},async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',d1Databases:['DB'],bindings:{AUTH_ORIGIN:'https://app.example.test'},serviceBindings:{ASSETS:async()=>new RuntimeResponse('public')}}));
 try{
  const db=await mf.getD1Database('DB'),schema=readFileSync(new URL('../migrations/0015_nopal_launch_subscriptions.sql',import.meta.url),'utf8');
  for(const sql of schema.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
  const body={email:'duplicate@example.test',language:'en',consent:true,consentVersion:'nopal-launch-v1'};
  const request=(data=body,origin='https://app.example.test')=>mf.dispatchFetch('https://app.example.test/api/public/launch-subscriptions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const responses=await Promise.all([request(),request(),request()]);for(const r of responses){assert.equal(r.status,202);assert.deepEqual(await r.json(),{status:'saved'});assert.equal(r.headers.get('set-cookie'),null);}
  assert.equal((await db.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').first()).n,1);assert.equal((await db.prepare('SELECT count(*) n FROM nopal_launch_events').first()).n,1);
  assert.equal((await request(body,'https://evil.test')).status,403);assert.equal((await request({...body,consent:false})).status,400);
  assert.equal((await request({...body,email:'other1@example.test'})).status,202);assert.equal((await request({...body,email:'other2@example.test'})).status,202);const limit=await request();assert.equal(limit.status,429);assert.ok(Number(limit.headers.get('Retry-After'))>0);
  assert.equal((await mf.dispatchFetch('https://app.example.test/api/public/launch-subscriptions')).status,405);
  assert.equal((await db.prepare('SELECT count(*) n FROM nopal_launch_subscriptions').first()).n,3);assert.equal((await db.prepare('SELECT count(*) n FROM nopal_launch_events').first()).n,3);
 }finally{await mf.dispose();}
});
