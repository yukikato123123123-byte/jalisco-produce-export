// Actual local SQLite DO + D1 + Worker, with an entirely stubbed outbound network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {ownerFixture,signature} from './helpers/owner-fixture.mjs';
import {migrations,statefulProvider} from './helpers/auth-fixture.mjs';
import {OWNER_SCOPE,OWNER_ORIGIN} from '../worker/owner/crypto.ts';
import {hexDigest,GRANT_PROTOCOL,capabilities} from '../worker/owner/grants.ts';
import {signApproval} from '../scripts/admin-approve.mjs';
const {URL,Response}=globalThis,require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response:RuntimeResponse}=require('miniflare'),{build}=require('esbuild');
test('real workerd/SQLite authority and D1 commit a signed grant, action and revoke',{timeout:60000},async()=>{
 const f=await ownerFixture(),bootstrap=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST),uid='11111111-1111-4111-8111-111111111111',email='synthetic@example.test';
 const p={operation:'activate_owner_admin_gateway',protocol:GRANT_PROTOCOL,scope:OWNER_SCOPE,origin:OWNER_ORIGIN,owner_id:bootstrap.payload.owner_id,bootstrap_sha256:await hexDigest(bootstrap),previous_policy_sha256:'a'.repeat(64),capabilities};
 const activation={payload:p,signature:signature(f.root,p),recovery_signature:signature(f.recovery,{operation:'accept_owner_admin_activation',role:'recovery',activation:p}),approval_signatures:[{key_id:f.approver.id,signature:signature(f.approver,{operation:'accept_owner_admin_activation',role:'approver',activation:p})}]};
 const env={...f.env,OWNER_ADMIN_MODE:GRANT_PROTOCOL,OWNER_GRANT_ACTIVATION:JSON.stringify(activation),OWNER_PREVIOUS_POLICY_SHA256:p.previous_policy_sha256,AUTH_ENVIRONMENT:'staging',AUTH_ORIGIN:OWNER_ORIGIN,SUPABASE_URL:`https://${OWNER_SCOPE.project_ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'synthetic',SESSION_ENCRYPTION_KEY:'ab'.repeat(32)};
 const upstream=statefulProvider();upstream.users.set(uid,{...upstream.users.get('u1'),id:uid,email});
 const bundle=await build({entryPoints:[new URL('../worker/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',d1Databases:['DB'],durableObjects:{OWNER_AUTHORITY:{className:'OwnerAuthority',useSQLite:true}},bindings:env,serviceBindings:{ASSETS:async()=>new RuntimeResponse('public')},outboundService:async req=>{
  let r;if(req.url.startsWith('https://api.cloudflare.com/'))r=Response.json({success:true,result:req.url.endsWith('verify')?{status:'active',id:'synthetic'}:{bindings:[{name:'DB',type:'d1',id:OWNER_SCOPE.database_id},{name:'AUTH_ENVIRONMENT',text:'staging'},{name:'AUTH_ORIGIN',text:OWNER_ORIGIN},{name:'SUPABASE_URL',text:env.SUPABASE_URL},{name:'OWNER_ADMIN_MODE',text:GRANT_PROTOCOL}]}});
  else if(req.url.startsWith('https://api.supabase.com/')){assert.ok(req.url.endsWith('/query/read-only'));r=Response.json([{id:uid,email,email_confirmed_at:'2026-01-01',deleted_at:null,banned_until:null}]);}
  else if(req.url.startsWith(env.SUPABASE_URL+'/auth/v1/'))r=await upstream.fetcher(req.url,{method:req.method,headers:{Authorization:req.headers.get('Authorization')},body:req.method==='GET'?undefined:await req.text()});
  else throw Error('Unexpected outbound request');
  return new RuntimeResponse(await r.arrayBuffer(),{status:r.status,headers:r.headers});
 }}));
 try{
  const db=await mf.getD1Database('DB');for(const sqlFile of [...migrations,readFileSync(new URL('../migrations/0009_owner_command_receipts.sql',import.meta.url),'utf8')])for(const sql of sqlFile.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g))await db.prepare(sql).run();
  const request=(path,body,cookie,management=false)=>mf.dispatchFetch(OWNER_ORIGIN+path,{method:body?'POST':'GET',headers:{...(body?{Origin:OWNER_ORIGIN,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(management?{Authorization:'Bearer synthetic-cf','X-Supabase-Management-Token':'synthetic-sb'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/api/owner/policy/current')).status,503);assert.equal((await request('/api/owner/session')).status,401);
  const login=await request('/api/auth/login',{email,password:'valid-password-123'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/auth/onboarding',{full_name:'Synthetic',company:'Farm',country:'MX',role:'producer'},cookie)).status,200);
  assert.equal((await request('/api/admin/overview',undefined,cookie)).status,403);
  async function grant(action='grant',expected='none'){
   const id=randomUUID(),r=await request('/api/owner/admin-grants/prepare',{user:uid,email,action,request:id,reason:'Synthetic approval',expected},undefined,true);assert.equal(r.status,200);const plan=await r.json(),payload={...plan.approval_payload_template,approval_ref:'synthetic-review'};
   const approval=signApproval(payload,f.approver.id,f.approver.privateKey.export({format:'pem',type:'pkcs8'}),bootstrap.payload.policy,`APPROVE ${id}`);
   const applied=await request('/api/owner/admin-grants/apply',{approval,confirm:`APPLY ${action} ${uid} ${id}`},undefined,true);assert.equal(applied.status,200);return id;
  }
  const id=await grant();assert.equal((await request('/api/admin/overview',undefined,cookie)).status,200);assert.equal((await(await request('/api/auth/session',undefined,cookie)).json()).is_admin,true);
  const product=await request('/api/producer/items',{name:'Nopal',description:'Fresh',category:'Cactus',quantity:'10',unit:'kg',price:'',currency:'',availability:'November',status:'draft'},cookie);const item=(await product.json()).items[0];
  const action=await request('/api/admin/actions',{action:'product_status',target_id:item.id,before_state:'draft',after_state:'public',reason:'Synthetic review'},cookie);assert.equal(action.status,200);
  assert.equal((await db.prepare('SELECT count(*) n FROM admin_audit').first()).n,1);assert.equal((await db.prepare('SELECT count(*) n FROM owner_action_receipts').first()).n,1);
  await grant('revoke',id);assert.equal((await request('/api/admin/overview',undefined,cookie)).status,403);assert.equal((await request('/api/admin/overview')).status,401);
  assert.equal((await db.prepare('SELECT count(*) n FROM admin_grant_events').first()).n,2);assert.equal((await db.prepare('SELECT count(*) n FROM owner_command_receipts').first()).n,2);
 }finally{await mf.dispose();}
});
