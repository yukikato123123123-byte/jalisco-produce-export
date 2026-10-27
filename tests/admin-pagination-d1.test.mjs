import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {migrations} from './helpers/auth-fixture.mjs';
import {operationsRead} from '../worker/nopalOperations.ts';
const {URL,URLSearchParams}=globalThis;
const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
test('real D1 supports nested activity pagination, exact totals and clamped empty filters',{timeout:30000},async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-21',d1Databases:['DB']}));
 try{const db=await mf.getD1Database('DB');const schemas=[...migrations,...['0015_nopal_launch_subscriptions.sql','0016_nopal_customer_feedback.sql'].map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8'))];for(const schema of schemas)for(const sql of schema.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
 await db.batch(Array.from({length:21},(_,i)=>db.prepare("INSERT INTO nopal_launch_subscriptions(id,email,language,consent_version,consented_at) VALUES(?,?,'en','nopal-launch-v1','2026-10-01')").bind('test-'+i,`synthetic${i}@example.test`)));
 const data=await operationsRead(db,'activity-log','GET',new URLSearchParams({page:'3',source:'launch'}),'auth.example.test');assert.equal(data.total,21);assert.equal(data.page,3);assert.equal(data.items.length,1);assert.equal(data.hasMore,false);
 const empty=await operationsRead(db,'activity-log','GET',new URLSearchParams({page:'999999',source:'feedback'}),'auth.example.test');assert.equal(empty.total,0);assert.equal(empty.page,1);assert.deepEqual(empty.items,[]);
 }finally{await mf.dispose();}
});
