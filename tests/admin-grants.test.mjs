import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fixture,accessEvent,migrations} from './helpers/auth-fixture.mjs';
import {runGrant,canonical,STAGING,eventSQL,makeGateway} from '../scripts/lib/admin-grant.mjs';
import {parseArgs} from '../scripts/admin-grant.mjs';
const {URL,Response}=globalThis;
const subject='11111111-1111-4111-8111-111111111111';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const policy={scope:STAGING,approvers:[{id:'approved-owner',public_key:publicKey.export({type:'spki',format:'pem'})}]};
const config=JSON.parse(readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url),'utf8').replace(/^\s*\/\/.*$/gm,''));
function setup(){const f=fixture();f.sql.prepare("INSERT INTO profiles VALUES(?,'Synthetic','Synthetic Farm','MX','producer')").run(subject);f.sql.prepare('INSERT INTO auth_users(user_id) VALUES(?)').run(subject);
 const gateway={verifyScope:async()=> 'cf-token:synthetic',lookupUser:async()=>({id:subject,email:'test@example.test',email_confirmed_at:'2026-10-23T00:00:00Z'}),account:async()=>({known:true}),state:async id=>f.sql.prepare('SELECT * FROM admin_grants WHERE user_id=?').get(id)??null,event:async id=>f.sql.prepare('SELECT * FROM admin_grant_events WHERE id=?').get(id)??null,insertEvent:async e=>f.sql.prepare(eventSQL).run(e.id,e.action,e.target_id,e.project_ref,e.operator_id,e.approver_id,e.approval_ref,e.approval_sha256,e.reason,e.expected_event_id,e.created_at)};
 const o={config:'wrangler.staging.jsonc',project:STAGING.project_ref,user:subject,email:'test@example.test',action:'grant',request:randomUUID(),reason:'Synthetic approved operation',expected:'none'};
 return {f,gateway,o};}
function approval(intent,extra={}){const payload={intent,approval_ref:'synthetic-owner-approval',issued_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+300000).toISOString(),...extra};return {key_id:'approved-owner',payload,signature:sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64')};}
async function applied(s){const plan=await runGrant(s.o,{config,gateway:s.gateway});const envelope=approval(plan.intent);const o={...s.o,apply:true,approval:'synthetic.json',confirm:`APPLY ${s.o.action} ${subject} ${s.o.request}`};await runGrant(o,{config,policy,approval:envelope,gateway:s.gateway});return {o,envelope};}
test('default dry-run and offline plan never write; signed grant/revoke are audited and idempotent',async()=>{const s=setup();try{
 const offline=await runGrant({...s.o,offline:true},{config});assert.equal(offline.verified,false);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n,0);
 const plan=await runGrant(s.o,{config,gateway:s.gateway});assert.equal(plan.mode,'dry-run');assert.equal(plan.verified,true);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,0);
 const {o,envelope}=await applied(s);let row=s.f.sql.prepare('SELECT * FROM admin_grants').get();assert.equal(row.revoked_at,null);assert.equal(row.project_ref,STAGING.project_ref);assert.equal(row.last_event_id,s.o.request);
 assert.equal((await runGrant(o,{config,policy,approval:envelope,gateway:s.gateway})).already_recorded,true);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
 const revoke={...s.o,action:'revoke',request:randomUUID(),expected:s.o.request};const p=await runGrant(revoke,{config,gateway:s.gateway});await runGrant({...revoke,apply:true,approval:'synthetic.json',confirm:`APPLY revoke ${subject} ${revoke.request}`},{config,policy,approval:approval(p.intent),gateway:s.gateway});
 row=s.f.sql.prepare('SELECT * FROM admin_grants').get();assert.ok(row.revoked_at);assert.equal(row.last_event_id,revoke.request);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,2);
 const replay=await runGrant(o,{config,policy,approval:envelope,gateway:s.gateway});assert.equal(replay.current_active,false);assert.equal(replay.changed,false);
 }finally{s.f.close();}});
test('confirmation, independent signer, expiry and exact operation binding are mandatory',async()=>{const s=setup();try{const p=await runGrant(s.o,{config,gateway:s.gateway});const env=approval(p.intent);const o={...s.o,apply:true,approval:'synthetic.json',confirm:`APPLY grant ${subject} ${s.o.request}`};
 for(const [opts,pol,a] of [[{...o,confirm:''},policy,env],[{...o,offline:true},policy,env],[o,{...policy,approvers:[]},env],[o,policy,{...env,signature:'invalid'}],[o,policy,approval(p.intent,{expires_at:'2020-01-01T00:00:00Z'})],[o,policy,approval({...p.intent,operator_id:'cf-token:other'})],[o,policy,approval({...p.intent,reason:'Different request'})]])await assert.rejects(()=>runGrant(opts,{config,policy:pol,approval:a,gateway:s.gateway}));
 assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n,0);assert.throws(()=>parseArgs(['--policy','untrusted.json']),/Unknown/);assert.throws(()=>parseArgs(['--apply','--dry-run']),/Choose/);
 }finally{s.f.close();}});
test('project/config/identity/onboarding/transition mismatch fail before any write',async()=>{const s=setup();try{
 for(const o of [{...s.o,project:'other'},{...s.o,config:'wrangler.production.jsonc'},{...s.o,user:'not-a-uuid'},{...s.o,action:'owner'},{...s.o,action:'revoke'}])await assert.rejects(()=>runGrant(o,{config,gateway:s.gateway}));
 await assert.rejects(()=>runGrant(s.o,{config:{...config,account_id:'different'},gateway:s.gateway}));
 for(const identity of [null,{id:subject,email:'other@example.test',email_confirmed_at:'now'},{id:subject,email:s.o.email,email_confirmed_at:null},{id:subject,email:s.o.email,email_confirmed_at:'now',deleted_at:'now'}])await assert.rejects(()=>runGrant(s.o,{config,gateway:{...s.gateway,lookupUser:async()=>identity}}));
 await assert.rejects(()=>runGrant(s.o,{config,gateway:{...s.gateway,account:async()=>({known:false})}}));
 assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n,0);
 }finally{s.f.close();}});
test('audit or projection failure rolls back the complete transition; direct edits and replace are blocked',async()=>{const s=setup();try{
 s.f.sql.exec("CREATE TRIGGER fail_grant BEFORE INSERT ON admin_grants BEGIN SELECT RAISE(ABORT,'Synthetic audit/projection failure'); END");await assert.rejects(()=>applied(s),/unconfirmed/);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n,0);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,0);s.f.sql.exec('DROP TRIGGER fail_grant');await applied(s);
 assert.throws(()=>s.f.sql.exec("UPDATE admin_grants SET revoked_at='forged'"),/audited transition/);assert.throws(()=>s.f.sql.exec('DELETE FROM admin_grants'),/audited revoke/);assert.throws(()=>s.f.sql.exec("UPDATE admin_grant_events SET reason='changed'"),/append only/);assert.throws(()=>s.f.sql.exec('DELETE FROM admin_grant_events'),/append only/);
 const e=s.f.sql.prepare('SELECT * FROM admin_grant_events').get();assert.throws(()=>s.f.sql.prepare(eventSQL.replace('INSERT INTO','INSERT OR REPLACE INTO')).run(e.id,e.action,e.target_id,e.project_ref,e.operator_id,e.approver_id,e.approval_ref,e.approval_sha256,e.reason,e.expected_event_id,e.created_at),/already exists/);
 }finally{s.f.close();}});
test('stale approval cannot win a revoke/regrant race and failed audit cannot revoke access',async()=>{const s=setup();try{await applied(s);const r={...s.o,action:'revoke',request:randomUUID(),expected:s.o.request};const p=await runGrant(r,{config,gateway:s.gateway});
 s.f.sql.exec("CREATE TRIGGER fail_event BEFORE INSERT ON admin_grant_events BEGIN SELECT RAISE(ABORT,'Synthetic audit unavailable'); END");await assert.rejects(()=>runGrant({...r,apply:true,approval:'a',confirm:`APPLY revoke ${subject} ${r.request}`},{config,policy,approval:approval(p.intent),gateway:s.gateway}));assert.equal(s.f.sql.prepare('SELECT revoked_at FROM admin_grants').get().revoked_at,null);s.f.sql.exec('DROP TRIGGER fail_event');
 await runGrant({...r,apply:true,approval:'a',confirm:`APPLY revoke ${subject} ${r.request}`},{config,policy,approval:approval(p.intent),gateway:s.gateway});
 await assert.rejects(()=>runGrant({...s.o,request:randomUUID()},{config,gateway:s.gateway}),/state changed/);
 }finally{s.f.close();}});
test('runtime denies cross-project grants and access history has no web mutation route',async()=>{const f=fixture();try{const cookie=await f.login();accessEvent(f,'grant','u1','another-project');assert.equal((await f.request('/api/admin/grants',undefined,cookie)).status,403);assert.equal((await f.request('/api/admin/grants')).status,401);assert.equal((await f.request('/api/admin/grants',{action:'grant',target_id:'u2'},cookie)).status,403);}finally{f.close();}});
test('migration preserves legacy rows without silently granting them scoped access',()=>{const db=new DatabaseSync(':memory:');try{const boundary=migrations.findIndex(m=>m.includes('CREATE TABLE admin_grant_events'));assert.ok(boundary>0);migrations.slice(0,boundary).forEach(m=>db.exec(m));db.exec("INSERT INTO admin_grants VALUES('legacy','previous-operator','2020-01-01',NULL)");db.exec(migrations[boundary]);const row=db.prepare('SELECT * FROM admin_grants').get();assert.equal(row.user_id,'legacy');assert.equal(row.project_ref,null);assert.equal(row.last_event_id,null);assert.equal(db.prepare('SELECT count(*) n FROM admin_grant_events').get().n,0);}finally{db.close();}});
test('management errors never disclose tokens and bindings are checked before Auth queries',async()=>{
 const gateway=makeGateway({cloudflareToken:'synthetic-private-cf',supabaseToken:'synthetic-private-supabase',fetcher:async()=>Response.json({secret:'synthetic-private-cf'},{status:403})});await assert.rejects(()=>gateway.verifyScope(),e=>e.message.includes('403')&&!e.message.includes('synthetic-private'));
 let calls=0;const wrong=makeGateway({cloudflareToken:'synthetic',supabaseToken:'synthetic',fetcher:async()=>{calls++;return Response.json({success:true,result:calls===1?{status:'active',id:'operator'}:{bindings:[]}});}});await assert.rejects(()=>wrong.verifyScope(),/bindings/);assert.equal(calls,2);
});
test('offline signing requires pinned key, exact confirmation and meaningful approval reference',async()=>{
 const {signApproval}=await import('../scripts/admin-approve.mjs');const s=setup();try{const p=await runGrant(s.o,{config,gateway:s.gateway});const payload={...p.approval_payload_template,approval_ref:'approved-ticket-123'};const pem=privateKey.export({type:'pkcs8',format:'pem'});
 assert.throws(()=>signApproval(payload,'approved-owner',pem,policy,'wrong'),/explicitly confirm/);assert.throws(()=>signApproval(payload,'untrusted',pem,policy,`APPROVE ${s.o.request}`),/not trusted/);assert.throws(()=>signApproval(p.approval_payload_template,'approved-owner',pem,policy,`APPROVE ${s.o.request}`),/match/);
 const envelope=signApproval(payload,'approved-owner',pem,policy,`APPROVE ${s.o.request}`);assert.ok(envelope.signature);assert.ok(!JSON.stringify(envelope).includes('PRIVATE KEY'));
 }finally{s.f.close();}
});
test('a lost D1 write response is not retried automatically and reusing request ID is safe',async()=>{const s=setup();try{
 const plan=await runGrant(s.o,{config,gateway:s.gateway});const envelope=approval(plan.intent);const o={...s.o,apply:true,approval:'synthetic',confirm:`APPLY grant ${subject} ${s.o.request}`};let writes=0;const gateway={...s.gateway,insertEvent:async e=>{writes++;await s.gateway.insertEvent(e);throw new Error('Synthetic lost reply');}};
 await assert.rejects(()=>runGrant(o,{config,policy,approval:envelope,gateway}),/unconfirmed/);assert.equal(writes,1);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
 const replay=await runGrant(o,{config,policy,approval:envelope,gateway});assert.equal(replay.already_recorded,true);assert.equal(writes,1);
 }finally{s.f.close();}});
test('same request ID cannot authorize a different operation and stale SQL event is atomic',async()=>{const s=setup();try{
 const {o}=await applied(s);const changed={...o,reason:'Another operation'};const intent={...STAGING,action:o.action,target_id:o.user,email:o.email,request_id:o.request,reason:changed.reason,operator_id:'cf-token:synthetic',expected_event_id:null};await assert.rejects(()=>runGrant(changed,{config,policy,approval:approval(intent),gateway:s.gateway}),/already used/);
 const before=s.f.sql.prepare('SELECT * FROM admin_grants').get();assert.throws(()=>s.f.sql.prepare(eventSQL).run(randomUUID(),'revoke',subject,STAGING.project_ref,'cf-token:synthetic','approved-owner','approved','a'.repeat(64),'Stale SQL event',null,new Date().toISOString()),/state changed/);assert.deepEqual(s.f.sql.prepare('SELECT * FROM admin_grants').get(),before);assert.equal(s.f.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
 }finally{s.f.close();}});
test('business writes bind scope on the server and read-only history exposes the real event',async()=>{const f=fixture();try{
 const cookie=await f.login();accessEvent(f);f.sql.exec("INSERT INTO producer_items VALUES('item','u1','Nopal','','Cactus',10,'kg',NULL,'','','public','now')");
 const action={action:'product_status',target_id:'item',before_state:'public',after_state:'private',reason:'Review',project_ref:'forged-project',actor_id:'u2'};assert.equal((await f.request('/api/admin/actions',action,cookie)).status,200);assert.equal(f.sql.prepare('SELECT project_ref FROM admin_audit').get().project_ref,'auth.example.test');assert.throws(()=>f.sql.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),'u1','product_status','item','private','public','Wrong scope',new Date().toISOString(),'different-project'),/scoped admin grant/);assert.equal(f.sql.prepare('SELECT status FROM producer_items').get().status,'private');
 const history=await(await f.request('/api/admin/grants',undefined,cookie)).json();assert.equal(history.items.length,1);assert.equal(history.items[0].actor_id,'cf-token:synthetic');assert.equal(history.items[0].action,'grant');assert.equal((await f.request('/api/admin/grants',{action:'grant',target_id:'u2'},cookie)).status,404);
 }finally{f.close();}});
test('management adapter verifies real request shapes using isolated HTTP stubs only',async()=>{const s=setup();try{
 const writes=[];const cfSecret='private-cf-token-value',sbSecret='private-sb-token-value';
 const gateway=makeGateway({cloudflareToken:cfSecret,supabaseToken:sbSecret,fetcher:async(url,options)=>{
  const path=new URL(url).pathname;const ok=result=>Response.json({success:true,result});
  if(path==='/client/v4/user/tokens/verify')return ok({status:'active',id:'verified-operator'});
  if(path.endsWith('/settings'))return ok({bindings:[{name:'DB',type:'d1',id:STAGING.database_id},{name:'SUPABASE_URL',text:`https://${STAGING.project_ref}.supabase.co`},{name:'AUTH_ENVIRONMENT',text:'staging'},{name:'AUTH_ORIGIN',text:`https://${STAGING.worker}.yukikato123123123.workers.dev`}]});
  if(path.endsWith('/database/query/read-only')){assert.equal(options.headers.Authorization,'Bearer '+sbSecret);const body=JSON.parse(options.body);assert.match(body.query,/^SELECT .* FROM auth.users WHERE/);return Response.json([{id:subject,email:s.o.email,email_confirmed_at:'2026-10-23T00:00:00Z'}]);}
  assert.equal(options.headers.Authorization,'Bearer '+cfSecret);assert.ok(path.endsWith(`/d1/database/${STAGING.database_id}/query`));const {sql,params}=JSON.parse(options.body);let rows;
  if(sql.startsWith('INSERT')){writes.push(sql);s.f.sql.prepare(sql).run(...params);rows=[];}else rows=[s.f.sql.prepare(sql).get(...params)].filter(Boolean);
  return ok([{success:true,results:rows}]);
 }});
 const plan=await runGrant(s.o,{config,gateway});assert.equal(writes.length,0);assert.ok(!JSON.stringify(plan).includes(cfSecret));assert.ok(!JSON.stringify(plan).includes(sbSecret));
 await runGrant({...s.o,apply:true,approval:'synthetic',confirm:`APPLY grant ${subject} ${s.o.request}`},{config,gateway,policy,approval:approval(plan.intent)});assert.equal(writes.length,1);assert.equal(writes[0],eventSQL);
 }finally{s.f.close();}});
test('a banned existing user cannot receive a grant, but their existing access can be revoked',async()=>{const s=setup();try{
 const blocked={id:subject,email:s.o.email,email_confirmed_at:'2026-10-23T00:00:00Z',banned_until:'2099-01-01T00:00:00Z'};const gateway={...s.gateway,lookupUser:async()=>blocked};await assert.rejects(()=>runGrant(s.o,{config,gateway}),/non-banned/);await applied(s);
 const o={...s.o,action:'revoke',request:randomUUID(),expected:s.o.request};const plan=await runGrant(o,{config,gateway});const result=await runGrant({...o,apply:true,approval:'synthetic',confirm:`APPLY revoke ${subject} ${o.request}`},{config,gateway,policy,approval:approval(plan.intent)});assert.equal(result.changed,true);assert.ok(s.f.sql.prepare('SELECT revoked_at FROM admin_grants').get().revoked_at);
 }finally{s.f.close();}});
