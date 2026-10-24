import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownerFixture,signature} from './helpers/owner-fixture.mjs';
import {readConfig} from '../scripts/validate-deployment.mjs';
import {runOwnerGrant} from '../scripts/lib/owner-grant-client.mjs';
import {makeGateway,sha,canonical,STAGING} from '../scripts/lib/admin-grant.mjs';
import {signApproval} from '../scripts/admin-approve.mjs';
import {parseArgs} from '../scripts/admin-grant.mjs';
const {URL,Response,structuredClone}=globalThis;
test('owner-aware CLI pins root and policy, uses only fixed HTTPS gateway, and separates dry-run/apply/status/resolution',async()=>{
 const f=await ownerFixture(),bootstrap=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST),previousPolicy={scope:STAGING,approvers:[]},p={operation:'activate_owner_admin_gateway',protocol:'owner-admin-grants-v1',origin:'https://jalisco-auth-staging.yukikato123123123.workers.dev',scope:STAGING,owner_id:bootstrap.payload.owner_id,previous_policy_sha256:sha(canonical(previousPolicy)),capabilities:['admin_action','admin_read','grant','revoke','rotate_policy']};
 const bundle=await(await f.request('policy/current')).json();bundle.activation={payload:p,signature:signature(f.root,p)};
 const o={config:'wrangler.staging.jsonc',project:STAGING.project_ref,user:randomUUID(),email:'synthetic@example.test',action:'grant',reason:'Synthetic review',request:randomUUID(),expected:'none'};
 const intent={...STAGING,protocol:p.protocol,authority_epoch:1,policy_sha256:sha(canonical(bundle.policy)),action:o.action,target_id:o.user,email:o.email,request_id:o.request,reason:o.reason,operator_id:'cf-token:synthetic',expected_event_id:null};
 const payload={intent,approval_ref:'synthetic-review',issued_at:new Date().toISOString(),expires_at:new Date(Date.now()+300000).toISOString()},calls=[];
 let tamper=false;
 const deps={config:readConfig(new URL('../wrangler.staging.jsonc',import.meta.url).pathname),trust:{scope:STAGING,public_key:f.root.public_key},previousPolicy,cloudflareToken:'synthetic-cf',supabaseToken:'synthetic-sb',fetcher:async(url,options)=>{const u=new URL(url);assert.equal(u.origin,p.origin);assert.equal(options.redirect,'error');calls.push(u.pathname);if(u.pathname.endsWith('/policy')){const b=structuredClone(bundle);if(tamper)b.epoch++;return Response.json(b);}assert.equal(options.headers.Authorization,'Bearer synthetic-cf');assert.equal(options.headers['X-Supabase-Management-Token'],'synthetic-sb');if(u.pathname.endsWith('/prepare'))return Response.json({mode:'dry-run',verified:true,changed:false,intent,approval_payload_template:payload});return Response.json({changed:false});}};
 const result=await runOwnerGrant(o,deps);assert.equal(result.changed,false);assert.ok(!calls.some(x=>x.endsWith('/apply')));
 const key=f.approver.privateKey.export({format:'pem',type:'pkcs8'}),approval=signApproval(payload,f.approver.id,key,bundle.policy,`APPROVE ${o.request}`);
 await runOwnerGrant({...o,apply:true,approval:'synthetic-path',confirm:`APPLY grant ${o.user} ${o.request}`},{...deps,approval});assert.ok(calls.at(-1).endsWith('/apply'));
 await runOwnerGrant({...o,status:true},deps);assert.ok(calls.at(-1).endsWith('/status'));
 await runOwnerGrant({...o,resolve:'resume',confirm:`RESOLVE OWNER COMMAND ${o.request}`},deps);assert.ok(calls.at(-1).endsWith('/reconcile'));
 const count=calls.length;await assert.rejects(()=>runOwnerGrant({...o,resolve:'cancel',confirm:'wrong'},deps));assert.equal(calls.length,count+1);
 tamper=true;await assert.rejects(()=>runOwnerGrant(o,deps));
 await assert.rejects(()=>runOwnerGrant(o,{...deps,trust:undefined}));
});
test('legacy CLI rejects remote owner mode even if no local root exists',async()=>{
 const g=makeGateway({cloudflareToken:'synthetic-cf',supabaseToken:'synthetic-sb',fetcher:async url=>Response.json({success:true,result:url.endsWith('/verify')?{status:'active',id:'synthetic'}:{bindings:[{name:'OWNER_ADMIN_MODE',text:'owner-admin-grants-v1'}]}})});
 await assert.rejects(()=>g.verifyScope(),/Direct D1 grant execution is disabled/);
});
test('CLI cannot combine read-only dry-run with a mutation resolution',()=>{
 assert.throws(()=>parseArgs(['--owner-aware','--dry-run','--resolve','cancel']));
 assert.throws(()=>parseArgs(['--owner-aware','--apply','--status']));
 assert.throws(()=>parseArgs(['--resolve','resume']));
});
