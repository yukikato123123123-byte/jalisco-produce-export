import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {URL,crypto}=globalThis;
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response:RuntimeResponse}=require('miniflare');
const {build}=require('esbuild');
test('real workerd/D1 atomically stores private feedback and receipt and deduplicates concurrent retries',{timeout:30000},async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',d1Databases:['DB'],bindings:{AUTH_ORIGIN:'https://app.example.test'},serviceBindings:{ASSETS:async()=>new RuntimeResponse('public')}}));
 try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE auth_users(user_id TEXT PRIMARY KEY)').run();await db.prepare('CREATE TABLE admin_grants(user_id TEXT,revoked_at TEXT,project_ref TEXT,last_event_id TEXT)').run();await db.prepare('CREATE TABLE admin_grant_events(id TEXT,project_ref TEXT,target_id TEXT,action TEXT)').run();
 const schema=readFileSync(new URL('../migrations/0016_nopal_customer_feedback.sql',import.meta.url),'utf8');for(const sql of schema.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
 const body={id:crypto.randomUUID(),clientId:crypto.randomUUID(),category:'idea',message:'Synthetic workerd feedback fixture.',email:'',replyConsent:false,privacyConsent:true,privacyVersion:'nopal-voice-v1',language:'en'};
 const send=(data=body)=>mf.dispatchFetch('https://app.example.test/api/public/feedback',{method:'POST',headers:{Origin:'https://app.example.test','Content-Type':'application/json'},body:JSON.stringify(data)});
 for(const r of await Promise.all([send(),send(),send({...body,id:crypto.randomUUID()})])){assert.equal(r.status,202);assert.deepEqual(await r.json(),{status:'saved'});}
 assert.equal((await db.prepare('SELECT count(*) n FROM nopal_feedback').first()).n,1);assert.equal((await db.prepare('SELECT count(*) n FROM nopal_feedback_events').first()).n,1);
 assert.equal((await send({...body,privacyConsent:false})).status,400);assert.equal((await mf.dispatchFetch('https://app.example.test/api/public/feedback')).status,405);
 await db.prepare("CREATE TRIGGER reject_receipt BEFORE INSERT ON nopal_feedback_events BEGIN SELECT RAISE(ABORT,'synthetic rejection'); END;").run();assert.equal((await send({...body,id:crypto.randomUUID(),clientId:crypto.randomUUID()})).status,503);assert.equal((await db.prepare('SELECT count(*) n FROM nopal_feedback').first()).n,1);
 }finally{await mf.dispose();}
});
