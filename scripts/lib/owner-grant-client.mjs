import {createPublicKey,verify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {canonical,STAGING,sha,validateOptions,verifyApproval} from './admin-grant.mjs';
import {verifyOwnerPolicy} from './owner-policy.mjs';
const {AbortSignal}=globalThis;
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
const protocol='owner-admin-grants-v1';
const fail=()=>{throw Error('Owner grant gateway unavailable or review does not match. No direct D1 fallback is permitted.');};
export async function runOwnerGrant(o,{config,trust,previousPolicy,approval,cloudflareToken,supabaseToken,fetcher=globalThis.fetch}){
 validateOptions(o,config);
 if(o.offline||!trust||canonical(trust.scope)!==canonical(STAGING)||!cloudflareToken||!supabaseToken)fail();
 async function call(path,body){let r;try{r=await fetcher(origin+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:body?{'Content-Type':'application/json',Origin:origin,Authorization:`Bearer ${cloudflareToken}`,'X-Supabase-Management-Token':supabaseToken}:{},...(body?{body:JSON.stringify(body)}:{})});}catch{fail();}if(!r.ok)fail();try{return await r.json();}catch{fail();}}
 const bundle=await call('/api/owner/admin-grants/policy'),policy=verifyOwnerPolicy(bundle,trust),a=bundle.activation,p=a?.payload;
 let valid=false;try{const key=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:trust.public_key},format:'jwk'});valid=verify(null,Buffer.from(canonical(p)),key,Buffer.from(a.signature,'base64url'));}catch{/* No provider or key material in errors. */}
 if(!valid||p?.operation!=='activate_owner_admin_gateway'||p.protocol!==protocol||p.origin!==origin||p.owner_id!==bundle.root.payload.owner_id||canonical(p.scope)!==canonical(STAGING)||p.previous_policy_sha256!==sha(canonical(previousPolicy))||canonical(p.capabilities)!==canonical(['admin_action','admin_read','grant','revoke','rotate_policy']))fail();
 if(o.status)return call('/api/owner/admin-grants/status',{request:o.request});
 if(o.resolve){if(o.confirm!==`RESOLVE OWNER COMMAND ${o.request}`)fail();return call('/api/owner/admin-grants/reconcile',{request:o.request,action:o.resolve,confirm:o.confirm});}
 if(o.apply){
  const intent=approval?.payload?.intent;
  // Verify the exact requested operation locally too; server rechecks epoch, identity and state.
  if(!intent||intent.protocol!==protocol||intent.authority_epoch!==bundle.epoch||intent.policy_sha256!==sha(canonical(policy))||canonical(Object.fromEntries(Object.keys(STAGING).map(k=>[k,intent[k]])))!==canonical(STAGING)||intent.target_id!==o.user||intent.email!==o.email||intent.action!==o.action||intent.request_id!==o.request||intent.reason!==o.reason||o.expected===undefined||intent.expected_event_id!==(o.expected==='none'?null:o.expected))fail();
  verifyApproval(approval,policy,intent,Date.now());
  return call('/api/owner/admin-grants/apply',{approval,confirm:o.confirm});
 }
 const result=await call('/api/owner/admin-grants/prepare',{user:o.user,email:o.email,action:o.action,request:o.request,reason:o.reason,...(o.expected!==undefined?{expected:o.expected}:{})});
 const i=result.intent;
 if(result.mode!=='dry-run'||result.changed!==false||!result.verified||!i||i.protocol!==protocol||i.authority_epoch!==bundle.epoch||i.policy_sha256!==sha(canonical(policy))||canonical(Object.fromEntries(Object.keys(STAGING).map(k=>[k,i[k]])))!==canonical(STAGING)||i.target_id!==o.user||i.email!==o.email||i.action!==o.action||i.request_id!==o.request||i.reason!==o.reason)fail();
 return result;
}
