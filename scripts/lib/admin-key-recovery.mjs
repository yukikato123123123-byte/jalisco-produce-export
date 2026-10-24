// Offline review only. A receipt is never a grant or a registered approval policy.
import {readFileSync,lstatSync,realpathSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {createPublicKey,verify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {canonical,sha,STAGING} from './admin-grant.mjs';
import {inspectPublicKey,readPreparedKey} from './admin-key-store.mjs';
import {validateTrustConfig} from '../admin-trust-init.mjs';
import {readConfig} from '../validate-deployment.mjs';
export const OLD_FINGERPRINT='SHA256:911f43e48a44503d627aa3a3bea6ca07fd0da8174b7aa916f7d915b1336f006a';
const fail=message=>{throw Error(message);};
function readPublic(path){
 const s=lstatSync(path);
 if(!s.isFile()||s.isSymbolicLink()||s.size>65536||realpathSync(path)!==path)fail('Unsafe public recovery input.');
 return JSON.parse(readFileSync(path,'utf8'));
}
export function readRecoveryPolicy(root){
 validateTrustConfig(readConfig(resolve(root,'wrangler.staging.jsonc')));
 const policy=readPublic(resolve(root,'staging/admin-approval-policy.json'));
 if(canonical(policy.scope)!==canonical(STAGING)||!Array.isArray(policy.approvers)||!policy.approvers.some(e=>!e.disabled&&inspectPublicKey(e.public_key).fingerprint===OLD_FINGERPRINT))fail('Expected preserved staging policy is missing or changed.');
 return policy;
}
export function recoveryPayload(root,directory,requestId,approvalRef,now=Date.now()){
 const policy=readRecoveryPolicy(root),key=readPreparedKey(directory,root);
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId)||typeof approvalRef!=='string'||!approvalRef.trim()||approvalRef.length>200||[...approvalRef].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))fail('A request UUID and external approval reference are required.');
 if(key.fingerprint===OLD_FINGERPRINT)fail('A distinct replacement key is required.');
 return {operation:'review_staging_approval_key_recovery',protocol:'staging-key-recovery-review-v1',scope:STAGING,request_id:requestId,approval_ref:approvalRef,old_fingerprint:OLD_FINGERPRINT,previous_policy_sha256:sha(canonical(policy)),next_public_key:key.public_key,next_fingerprint:key.fingerprint,issued_at:now,expires_at:now+300000};
}
function validSignature(key,payload,signature){
 try{return key.asymmetricKeyType==='ed25519'&&typeof signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(signature)&&verify(null,Buffer.from(canonical(payload)),key,Buffer.from(signature,'base64url'));}catch{return false;}
}
export function reviewRecovery(root,directory,envelope,now=Date.now()){
 // Fixed, previously authenticated owner anchor only. No --root, confirmation,
 // local policy registration metadata or replacement-key self-approval fallback.
 let trust;try{trust=readPublic(resolve(root,'staging/owner-root-public.json'));}catch{fail('RECOVERY_UNTRUSTED: independently authenticated owner root is absent or unsafe; no registration is permitted.');}
 if(canonical(trust.scope)!==canonical(STAGING)||typeof trust.public_key!=='string')fail('RECOVERY_UNTRUSTED: invalid owner root.');
 const p=envelope?.payload;
 const expected=recoveryPayload(root,directory,p?.request_id,p?.approval_ref,p?.issued_at);
 if(canonical(p)!==canonical(expected)||!Number.isSafeInteger(p.issued_at)||!Number.isSafeInteger(p.expires_at)||p.issued_at>now||p.expires_at<=now)fail('Recovery request is expired, malformed or does not match preserved policy and candidate.');
 let owner;try{owner=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:trust.public_key},format:'jwk'});}catch{fail('RECOVERY_UNTRUSTED: invalid owner root.');}
 const candidate=createPublicKey(p.next_public_key);
 if(!validSignature(owner,p,envelope.owner_signature)||!validSignature(candidate,{operation:'accept_staging_approval_key_recovery',payload:p},envelope.next_signature))fail('Owner authorization or replacement-key possession signature is invalid.');
 const record={result:'VERIFIED_REVIEW_ONLY',registered:false,scope:STAGING,request_id:p.request_id,reviewed_at:now,owner_root_sha256:sha(canonical(trust)),envelope_sha256:sha(canonical(envelope)),envelope};
 // Exclusive publication binds audit + local replay marker in one file. Any
 // uncertain write fails; preserve partial evidence and never retry automatically.
 const dir=resolve(root,'staging');
 if(realpathSync(dir)!==dir||(lstatSync(dir).mode&0o022))fail('Unsafe audit directory.');
 const path=resolve(dir,`key-recovery-review-${p.request_id.toLowerCase()}.json`);
 let fd;try{fd=openSync(path,'wx',0o600);}catch{fail('Request ID already reviewed or audit storage unavailable.');}
 try{writeFileSync(fd,JSON.stringify(record,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
 const d=openSync(dir,'r');try{fsyncSync(d);}finally{closeSync(d);}
 return record;
}
