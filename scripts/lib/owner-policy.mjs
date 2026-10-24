const {AbortSignal}=globalThis;
// Verify the public chain, then compare against a fresh HTTPS authority response.
// This module never grants a role or accepts a policy selected by an HTTP caller.
import {createPublicKey,verify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {canonical,STAGING} from './admin-grant.mjs';
const origin=`https://${STAGING.worker}.yukikato123123123.workers.dev`;
function signature(key,payload,sig){try{const k=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:key},format:'jwk'});return verify(null,Buffer.from(canonical(payload)),k,Buffer.from(sig,'base64url'));}catch{return false;}}
const reject=()=>{throw new Error('Owner policy chain is invalid, stale or unavailable.');};
export function verifyOwnerPolicy(bundle,trust){
 if(canonical(trust?.scope)!==canonical(STAGING)||!trust.public_key||!bundle?.root)reject();const root=bundle.root,p=root.payload;
 if(p?.operation!=='owner_policy_root'||canonical(p.scope)!==canonical(STAGING)||p.origin!==origin||p.protocol!=='owner-pin-key-v1'||p.epoch!==1||!signature(trust.public_key,p,root.signature)||!Array.isArray(bundle.chain)||bundle.chain.length>64)reject();
 let epoch=1,recovery=p.recovery,policy=p.policy;const ids=new Set();
 for(const e of bundle.chain){const n=e.payload;if(n?.operation!=='owner_recovery'||n.owner_id!==p.owner_id||n.expected_epoch!==epoch||canonical(n.scope)!==canonical(STAGING)||n.origin!==origin||n.protocol!=='owner-pin-key-v1'||ids.has(n.request_id)||!n.next_recovery||!n.next_policy||!signature(recovery.public_key,n,e.signature)||!signature(n.next_recovery.public_key,{operation:'accept_recovery_key',payload:n},e.next_signature))reject();ids.add(n.request_id);epoch++;recovery=n.next_recovery;policy=n.next_policy;}
 if(bundle.epoch!==epoch||canonical(bundle.policy)!==canonical(policy)||canonical(policy?.scope)!==canonical(STAGING)||!policy.approvers?.length)reject();return policy;
}
export async function fetchOwnerPolicy(trust,fetcher=globalThis.fetch){
 let r;try{r=await fetcher(origin+'/api/owner/policy/current',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{reject();}if(!r.ok)reject();let bundle;try{bundle=await r.json();}catch{reject();}return verifyOwnerPolicy(bundle,trust);
}
