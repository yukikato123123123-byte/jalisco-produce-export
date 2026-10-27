// Disposable SQLite and synthetic keys only. No management endpoint is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture,details,accessEvent,deferred} from './helpers/auth-fixture.mjs';
import {ownerFixture,signature,edKey} from './helpers/owner-fixture.mjs';
import {OwnerAuthority} from '../worker/owner/authority.ts';
import {OWNER_SCOPE,OWNER_ORIGIN} from '../worker/owner/crypto.ts';
import {hexDigest,GRANT_PROTOCOL,capabilities,projectCommand} from '../worker/owner/grants.ts';
import {signApproval} from '../scripts/admin-approve.mjs';
const {Request,Response,URL,structuredClone,fetch:originalFetch}=globalThis;
const uid='11111111-1111-4111-8111-111111111111',email='synthetic@example.test';
export async function grantFixture(){
 const app=fixture(),owner=await ownerFixture();
 app.sql.exec(readFileSync(new URL('../migrations/0009_owner_command_receipts.sql',import.meta.url),'utf8'));
 app.upstream.users.set(uid,{...app.upstream.users.get('u1'),id:uid,email});
 Object.assign(app.env,{AUTH_ENVIRONMENT:'staging',AUTH_ORIGIN:OWNER_ORIGIN,SUPABASE_URL:`https://${OWNER_SCOPE.project_ref}.supabase.co`});
 let batches=0,failBefore=false,failAfter=false;
 const db={prepare:app.env.DB.prepare,batch:async statements=>{batches++;if(failBefore)throw Error('Synthetic D1 outage');app.sql.exec('BEGIN');try{for(const s of statements)await s.run();app.sql.exec('COMMIT');}catch(e){app.sql.exec('ROLLBACK');throw e;}if(failAfter)throw Error('Synthetic lost response');}};
 const bootstrap=JSON.parse(owner.env.OWNER_BOOTSTRAP_MANIFEST),payload={operation:'activate_owner_admin_gateway',protocol:GRANT_PROTOCOL,scope:OWNER_SCOPE,origin:OWNER_ORIGIN,owner_id:bootstrap.payload.owner_id,bootstrap_sha256:await hexDigest(bootstrap),previous_policy_sha256:'a'.repeat(64),capabilities};
 const activation={payload,signature:signature(owner.root,payload),recovery_signature:signature(owner.recovery,{operation:'accept_owner_admin_activation',role:'recovery',activation:payload}),approval_signatures:[{key_id:owner.approver.id,signature:signature(owner.approver,{operation:'accept_owner_admin_activation',role:'approver',activation:payload})}]};
 Object.assign(owner.env,{DB:db,OWNER_ADMIN_MODE:GRANT_PROTOCOL,OWNER_GRANT_ACTIVATION:JSON.stringify(activation),OWNER_PREVIOUS_POLICY_SHA256:payload.previous_policy_sha256});
 const headers={Authorization:'Bearer synthetic-cf','X-Supabase-Management-Token':'synthetic-sb'};
 let managementCalls=0,ban=false,wrongScope=false;
 globalThis.fetch=async(url,options={})=>{
  if(url.startsWith('https://api.cloudflare.com/')){managementCalls++;if(url.endsWith('verify'))return Response.json({success:true,result:{status:'active',id:'synthetic'}});return Response.json({success:true,result:{bindings:[{name:'DB',type:'d1',id:wrongScope?'wrong':OWNER_SCOPE.database_id},{name:'AUTH_ENVIRONMENT',text:'staging'},{name:'AUTH_ORIGIN',text:OWNER_ORIGIN},{name:'SUPABASE_URL',text:app.env.SUPABASE_URL},{name:'OWNER_ADMIN_MODE',text:GRANT_PROTOCOL}]}});}
  if(url.startsWith('https://api.supabase.com/')){managementCalls++;assert.ok(url.endsWith('/query/read-only'));assert.ok(JSON.parse(options.body).query.startsWith('SELECT '));return Response.json([{id:uid,email,email_confirmed_at:'2026-01-01',deleted_at:null,banned_until:ban?'2099-01-01':null}]);}
  return app.upstream.fetcher(url,options);
 };
 const recreate=()=>{owner.authority=new OwnerAuthority({storage:owner.storage},owner.env);};recreate();
 const request=(path,body)=>owner.authority.fetch(new Request(OWNER_ORIGIN+'/api/owner/'+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Origin:OWNER_ORIGIN,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 const internal=body=>owner.authority.fetch(new Request(OWNER_ORIGIN+'/internal/admin',{method:'POST',body:JSON.stringify(body)}));
 Object.assign(app.env,{OWNER_ADMIN_MODE:GRANT_PROTOCOL,OWNER_ROOT_PUBLIC_KEY:owner.root.public_key,OWNER_GRANT_ACTIVATION:owner.env.OWNER_GRANT_ACTIVATION,OWNER_AUTHORITY:{idFromName:n=>n,get:()=>({fetch:r=>owner.authority.fetch(r)})}});
 const cookie=await app.login(undefined,uid);assert.equal((await app.request('/api/auth/onboarding',details,cookie)).status,200);
 const options=(action='grant',expected)=>({user:uid,email,action,request:randomUUID(),reason:'Synthetic approved access',...(expected?{expected}:{})});
 async function prepare(o=options()){const r=await request('admin-grants/prepare',o);return {r,plan:await r.json(),options:o};}
 function approve(plan,key=owner.approver){const p={...plan.approval_payload_template,approval_ref:'synthetic-review'};return signApproval(p,key.id,key.privateKey.export({format:'pem',type:'pkcs8'}),{scope:OWNER_SCOPE,approvers:[{id:key.id,public_key:key.pem}]},`APPROVE ${p.intent.request_id}`);}
 const apply=approval=>request('admin-grants/apply',{approval,confirm:`APPLY ${approval.payload.intent.action} ${uid} ${approval.payload.intent.request_id}`});
 const init=async()=>{await request('session');return request('policy/current');};
 return {app,owner,activation,headers,request,internal,cookie,options,prepare,approve,apply,init,recreate,db,set failBefore(v){failBefore=v;},set failAfter(v){failAfter=v;},set ban(v){ban=v;},set wrongScope(v){wrongScope=v;},get batches(){return batches;},get managementCalls(){return managementCalls;},close(){app.close();globalThis.fetch=originalFetch;}};
}
test('prepare is read-only, cannot bootstrap, and real grant/revoke uses one audited authority',async()=>{
 const f=await grantFixture();try{
  assert.equal((await f.prepare()).r.status,503);assert.equal(f.owner.storage.values.size,0);
  assert.equal((await f.init()).status,200);const before=structuredClone(f.owner.storage.values),writes=f.batches;
  const {r,plan}=await f.prepare();assert.equal(r.status,200);assert.equal(plan.changed,false);assert.deepEqual(f.owner.storage.values,before);assert.equal(f.batches,writes);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,403);
  const signed=f.approve(plan);assert.equal((await f.apply(signed)).status,200);
  assert.equal((await f.apply(signed)).status,200);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
  assert.equal((await(await f.app.request('/api/auth/session',undefined,f.cookie)).json()).is_admin,true);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,200);
  const revoke=await f.prepare(f.options('revoke',plan.intent.request_id));assert.equal(revoke.r.status,200);assert.equal((await f.apply(f.approve(revoke.plan))).status,200);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,403);
  assert.equal((await f.app.request('/api/admin/overview')).status,401);
 }finally{f.close();}
});
test('untrusted activation, candidate key possession and scope fail closed',async()=>{
 for(const edit of ['root','recovery','approver','previous','mode']){const f=await grantFixture();try{
  if(edit==='root')f.activation.signature=signature(edKey(),f.activation.payload);
  if(edit==='recovery')f.activation.recovery_signature='invalid';
  if(edit==='approver')f.activation.approval_signatures[0].signature='invalid';
  if(edit==='previous')f.owner.env.OWNER_PREVIOUS_POLICY_SHA256='b'.repeat(64);
  if(edit==='mode')f.owner.env.OWNER_ADMIN_MODE='unknown';
  f.owner.env.OWNER_GRANT_ACTIVATION=JSON.stringify(f.activation);f.recreate();assert.equal((await f.init()).status,503);assert.equal(f.owner.storage.values.size,0);
 }finally{f.close();}}
});
test('D1-only grants, incomplete enrollment and direct public internal-path calls cannot elevate',async()=>{
 const f=await grantFixture();try{await f.init();accessEvent(f.app,'grant',uid,OWNER_SCOPE.project_ref);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,403);assert.equal((await f.prepare()).r.status,409);
  delete f.app.env.OWNER_ADMIN_MODE;assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,503);
  assert.equal((await f.app.request('/api/auth/session',undefined,f.cookie)).status,503);
  assert.equal((await f.app.request('/internal/admin',{user:uid,kind:'check'},f.cookie)).status,404); // Public Worker never exposes the authority internal endpoint.
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM owner_command_receipts').get().n,0);
 }finally{f.close();}
});
test('expired, changed, wrong signer, banned identity and wrong deployed scope never reserve a grant',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare(),valid=f.approve(plan);
  for(const edit of [e=>{e.signature='A'.repeat(86)+'==';},e=>{e.payload.intent.authority_epoch++;},e=>{e.payload.intent.reason='changed';},e=>{e.key_id='untrusted';},e=>{e.payload.expires_at='2000-01-01';}]){const e=structuredClone(valid);edit(e);assert.notEqual((await f.apply(e)).status,200);}
  f.ban=true;assert.equal((await f.apply(valid)).status,403);f.ban=false;f.wrongScope=true;assert.equal((await f.apply(valid)).status,403);
  assert.equal((await f.owner.storage.get()).admin.pending,undefined);assert.equal(f.batches,0);
 }finally{f.close();}
});
test('lost D1 acknowledgement persists across eviction, blocks recovery, and resumes one command',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare(),signed=f.approve(plan);f.failAfter=true;
  assert.equal((await f.apply(signed)).status,503);const pending=(await f.owner.storage.get()).admin.pending;assert.ok(pending);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,503);
  const recovery=await f.owner.prepare();assert.equal((await f.request('recover',recovery.body)).status,409);
  f.recreate();f.failAfter=false;const r=await f.request('admin-grants/reconcile',{request:pending.id,action:'resume',confirm:`RESOLVE OWNER COMMAND ${pending.id}`});assert.equal(r.status,200);
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,200);
 }finally{f.close();}
});
test('cancel before a late projection is terminal and cannot reuse the request ID',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();f.failBefore=true;assert.equal((await f.apply(f.approve(plan))).status,503);
  const c=(await f.owner.storage.get()).admin.pending;f.failBefore=false;
  assert.equal((await f.request('admin-grants/reconcile',{request:c.id,action:'cancel',confirm:`RESOLVE OWNER COMMAND ${c.id}`})).status,200);
  await assert.rejects(()=>projectCommand(f.db,c));assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,0);
  assert.equal((await f.prepare({...f.options(),request:c.id})).r.status,409);
 }finally{f.close();}
});
test('audit failure rolls back authority acknowledgement; status never claims completed',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();f.app.hooks.after=async({query})=>{if(query.startsWith('SELECT * FROM owner_command_receipts'))f.owner.storage.failPut=true;};
  assert.equal((await f.apply(f.approve(plan))).status,503);f.owner.storage.failPut=false;delete f.app.hooks.after;
  const status=await(await f.request('admin-grants/status',{request:plan.intent.request_id})).json();assert.equal(status.recorded,false);assert.equal(status.pending,true);
  assert.equal((await f.request('admin-grants/reconcile',{request:plan.intent.request_id,action:'resume',confirm:`RESOLVE OWNER COMMAND ${plan.intent.request_id}`})).status,200);
 }finally{f.close();}
});
test('recovery fences grants and old approvals; fresh signed revoke/regrant restores access',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();assert.equal((await f.apply(f.approve(plan))).status,200);
  const rev=await f.prepare(f.options('revoke',plan.intent.request_id)),old=f.approve(rev.plan),r=await f.owner.prepare();assert.equal((await f.request('recover',r.body)).status,200);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,403);assert.equal((await f.apply(old)).status,409);
  const fresh=await f.prepare(f.options('revoke',plan.intent.request_id));assert.equal((await f.apply(f.approve(fresh.plan,r.nextApprover))).status,200);
  const grant=await f.prepare(f.options('grant',fresh.plan.intent.request_id));assert.equal((await f.apply(f.approve(grant.plan,r.nextApprover))).status,200);
  assert.equal((await f.app.request('/api/admin/overview',undefined,f.cookie)).status,200);
 }finally{f.close();}
});
test('concurrent grant approvals commit once and a pending write blocks epoch rotation',async()=>{
 const f=await grantFixture();try{await f.init();const a=await f.prepare(),b=await f.prepare();const results=await Promise.all([f.apply(f.approve(a.plan)),f.apply(f.approve(b.plan))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,1);
  const gate=deferred(),entered=deferred();f.app.hooks.before=async({query})=>{if(query.includes('SELECT\n   (SELECT count(*)')){entered.resolve();await gate.promise;}};
  const read=f.app.request('/api/admin/overview',undefined,f.cookie);await entered.promise;const rec=await f.owner.prepare();assert.equal((await f.request('recover',rec.body)).status,409);gate.resolve();assert.equal((await read).status,200);
 }finally{f.close();}
});
test('publication mutation and audit reconcile once after a lost D1 response',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();await f.apply(f.approve(plan));
  const product=await f.app.request('/api/producer/items',{name:'Nopal',description:'Fresh',category:'Cactus',quantity:'10',unit:'kg',price:'',currency:'',availability:'November',status:'draft'},f.cookie);assert.equal(product.status,200);const item=(await product.json()).items[0];
  const action={action:'product_status',target_id:item.id,before_state:'draft',after_state:'public',reason:'Synthetic review'};
  f.failAfter=true;assert.equal((await f.app.request('/api/admin/actions',action,f.cookie)).status,503);
  const pending=(await f.owner.storage.get()).admin.access;assert.ok(pending.write);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,1);
  const recovery=await f.owner.prepare();assert.equal((await f.request('recover',recovery.body)).status,409);
  f.recreate();f.failAfter=false;assert.equal((await f.app.request('/api/admin/actions',action,f.cookie)).status,200);
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,1);assert.equal(f.app.sql.prepare('SELECT status FROM producer_items WHERE id=?').get(item.id).status,'public');
  // Invalid input is rejected before reserving a durable command.
  assert.equal((await f.app.request('/api/admin/actions',{...action,after_state:'invalid'},f.cookie)).status,400);assert.equal((await f.owner.storage.get()).admin.access,undefined);
 }finally{f.close();}
});
test('D1 trigger failure rolls back receipt; explicit cancellation releases a failed mutation',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();await f.apply(f.approve(plan));
  const body={action:'product_status',target_id:'missing-item',before_state:'draft',after_state:'public',reason:'Synthetic missing record'};
  assert.equal((await f.app.request('/api/admin/actions',body,f.cookie)).status,503);const pending=(await f.owner.storage.get()).admin.access;
  assert.equal(f.app.sql.prepare('SELECT count(*) n FROM owner_action_receipts').get().n,0);
  const r=await f.request('admin-grants/reconcile',{request:pending.id,action:'cancel',confirm:`RESOLVE OWNER COMMAND ${pending.id}`});assert.equal(r.status,200);assert.equal((await r.json()).cancelled,true);
  assert.equal((await f.owner.storage.get()).admin.access,undefined);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,0);
 }finally{f.close();}
});
test('a cancelled receipt wins against an in-flight delayed grant batch',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare(),signed=f.approve(plan),entered=deferred(),gate=deferred(),batch=f.db.batch;
  f.db.batch=async statements=>{entered.resolve();await gate.promise;return batch(statements);};
  const apply=f.apply(signed);await entered.promise;
  const id=plan.intent.request_id;assert.equal((await f.request('admin-grants/reconcile',{request:id,action:'cancel',confirm:`RESOLVE OWNER COMMAND ${id}`})).status,200);
  gate.resolve();assert.equal((await apply).status,503);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,0);
  const status=await(await f.request('admin-grants/status',{request:id})).json();assert.equal(status.cancelled,true);assert.equal(status.pending,false);assert.equal(status.recorded,false);
 }finally{f.close();}
});
test('explicit cancellation fences an old long read before disclosure and permits recovery',async()=>{
 const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();await f.apply(f.approve(plan));
  const gate=deferred(),entered=deferred();f.app.hooks.before=async({query})=>{if(query.includes('SELECT\n   (SELECT count(*)')){entered.resolve();await gate.promise;}};
  const read=f.app.request('/api/admin/overview',undefined,f.cookie);await entered.promise;const a=(await f.owner.storage.get()).admin.access;
  assert.equal((await f.request('admin-grants/reconcile',{request:a.id,action:'cancel',confirm:`RESOLVE OWNER COMMAND ${a.id}`})).status,200);
  const recovery=await f.owner.prepare();assert.equal((await f.request('recover',recovery.body)).status,200);gate.resolve();const r=await read;assert.equal(r.status,503);assert.equal('counts' in await r.json(),false);
 }finally{f.close();}
});
test('a legacy authority cannot silently acquire grant powers from a new environment setting',async()=>{
 const f=await grantFixture();try{
  const mode=f.owner.env.OWNER_ADMIN_MODE,activation=f.owner.env.OWNER_GRANT_ACTIVATION;delete f.owner.env.OWNER_ADMIN_MODE;delete f.owner.env.OWNER_GRANT_ACTIVATION;f.recreate();await f.init();
  const before=structuredClone(f.owner.storage.values);Object.assign(f.owner.env,{OWNER_ADMIN_MODE:mode,OWNER_GRANT_ACTIVATION:activation});f.recreate();
  assert.equal((await f.prepare()).r.status,503);assert.equal((await f.request('session')).status,503);assert.deepEqual(f.owner.storage.values,before);
 }finally{f.close();}
});

test('coexisting administrator APIs do not expand the owner gateway POST allowlist',async()=>{const f=await grantFixture();try{await f.init();const {plan}=await f.prepare();assert.equal((await f.apply(f.approve(plan))).status,200);for(const name of ['0015_nopal_launch_subscriptions.sql','0016_nopal_customer_feedback.sql'])f.app.sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));for(const path of ['/api/admin/overview','/api/admin/operations-overview','/api/admin/research-access'])assert.equal((await f.app.request(path,undefined,f.cookie)).status,200);const before=f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n;for(const path of ['/api/admin/notifications','/api/admin/drafts/item','/api/admin/reviews/product/item','/api/admin/inquiries/item','/api/admin/research-access','/api/admin/customer-feedback/item'])assert.equal((await f.app.request(path,{action:'research_grant'},f.cookie)).status,404,path);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM admin_grant_events').get().n,before);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM research_access').get().n,0);assert.equal(f.app.sql.prepare('SELECT count(*) n FROM owner_action_receipts').get().n,0);}finally{f.close();}});
