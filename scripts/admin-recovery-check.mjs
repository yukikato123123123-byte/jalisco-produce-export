#!/usr/bin/env node
// Read-only, offline readiness checks. Never reads private keys, credentials or stdin.
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {canonical,sha,STAGING} from './lib/admin-grant.mjs';
import {inspectPublicKey} from './lib/admin-key-store.mjs';
import {readConfig} from './validate-deployment.mjs';
import {validateOptions} from './lib/admin-grant.mjs';
import {validateActivation,GRANT_PROTOCOL} from '../worker/owner/grants.ts';
import {verifySignature,validatePinVerifier,validatePolicy,OWNER_ORIGIN} from '../worker/owner/crypto.ts';
import {publicPolicyRoot} from '../worker/owner/authority.ts';
const {URL}=globalThis;
function json(path){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.size>65536)throw Error('Unsafe review input.');return JSON.parse(readFileSync(path,'utf8'));}
export async function checkRecovery({root=fileURLToPath(new URL('../',import.meta.url)),bundle,review}={}){
 const config=readConfig(resolve(root,'wrangler.staging.jsonc'));
 validateOptions({config:'wrangler.staging.jsonc',project:STAGING.project_ref,user:'51f007ac-f719-4219-81c8-94922fcacc1c',email:'zacharymaynard182@gmail.com',request:'00000000-0000-4000-8000-000000000001',action:'grant',reason:'Offline readiness check'},config);
 const policy=json(resolve(root,'staging/admin-approval-policy.json')),previous=sha(canonical(policy));
 if(canonical(policy.scope)!==canonical(STAGING))throw Error('Preserved policy scope mismatch.');
 const key=inspectPublicKey(readFileSync(resolve(root,'staging/approval-public.pub'),'utf8'));
 if(!policy.approvers.some(x=>!x.disabled&&inspectPublicKey(x.public_key).fingerprint===key.fingerprint))throw Error('Preserved public key mismatch.');
 let artifacts={status:'ABSENT',cryptographically_valid:false};
 if(bundle){
  const b=json(resolve(bundle));if(Object.keys(b).sort().join(',')!=='activation,bootstrap,root'||!b.root||Object.keys(b.root).sort().join(',')!=='public_key,scope'||canonical(b.root.scope)!==canonical(STAGING)||!b.bootstrap||Object.keys(b.bootstrap).sort().join(',')!=='payload,policy_signature,signature')throw Error('Invalid enrollment bundle.');
  const installed=resolve(root,'staging/owner-root-public.json');if(existsSync(installed)&&canonical(json(installed))!==canonical(b.root))throw Error('Installed root differs from reviewed bundle.');
  const p=b.bootstrap?.payload;
  if(p?.operation!=='owner_bootstrap'||Object.keys(p).sort().join(',')!=='epoch,operation,origin,owner_id,pin,policy,protocol,recovery,scope'||p.protocol!=='owner-pin-key-v1'||p.origin!==OWNER_ORIGIN||canonical(p.scope)!==canonical(STAGING)||p.epoch!==1||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.owner_id)||!p.recovery||Object.keys(p.recovery).sort().join(',')!=='id,public_key'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.recovery.id)||!await verifySignature(b.root.public_key,p,b.bootstrap.signature)||!await verifySignature(b.root.public_key,publicPolicyRoot(p),b.bootstrap.policy_signature))throw Error('Invalid root-signed bootstrap.');
  validatePinVerifier(p.pin);await validatePolicy(p.policy);
  await validateActivation(JSON.stringify(b.activation),b.root.public_key,b.bootstrap,p.owner_id,previous);
  const rootKey=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:b.root.public_key},format:'jwk'}),recoveryKey=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:p.recovery.public_key},format:'jwk'});
  const rootFingerprint=inspectPublicKey(rootKey.export({format:'pem',type:'spki'})).fingerprint,recoveryFingerprint=inspectPublicKey(recoveryKey.export({format:'pem',type:'spki'})).fingerprint,approvals=p.policy.approvers.map(x=>inspectPublicKey(x.public_key).fingerprint);
  if(new Set([rootFingerprint,recoveryFingerprint,...approvals]).size!==2+approvals.length||approvals.includes(key.fingerprint))throw Error('Distinct replacement key roles required.');
  artifacts={status:'VALID_PUBLIC_BUNDLE_ONLY',cryptographically_valid:true,root_fingerprint:rootFingerprint,recovery_fingerprint:recoveryFingerprint,approval_fingerprints:approvals,bootstrap_sha256:sha(canonical(b.bootstrap)),activation_sha256:sha(canonical(b.activation))};
 }
 let human='NOT_SUPPLIED';
 if(review){const r=json(resolve(review));const fields=['review_id','reviewer','key_custodian','cloudflare_ownership_ref','supabase_ownership_ref','independent_channel_ref','unrecoverable_key_ref','fingerprint_comparison_ref'];if(canonical(r.scope)!==canonical(STAGING)||fields.some(k=>typeof r[k]!=='string'||!r[k].trim()||r[k].includes('REPLACE_'))||r.reviewer===r.key_custodian||r.previous_policy_sha256!==previous)throw Error('Review record is incomplete or does not match preserved policy.');if(bundle){const expected=Object.fromEntries(['root_fingerprint','recovery_fingerprint','approval_fingerprints','bootstrap_sha256','activation_sha256'].map(k=>[k,artifacts[k]]));if(canonical(r.reviewed_artifacts)!==canonical(expected))throw Error('Review record does not bind the exact candidate artifacts.');}human='REFERENCES_PRESENT_NOT_INDEPENDENTLY_VERIFIED';}
 return {mode:'READ_ONLY_OFFLINE',changed:false,scope:STAGING,preserved_policy_sha256:previous,preserved_public_fingerprint:key.fingerprint,root_file_present:existsSync(resolve(root,'staging/owner-root-public.json')),artifacts,human_review:human,credentials:'NOT_READ',remote_identity_and_bindings:'NOT_CHECKED',deployment_and_migration:'NOT_CHECKED',ready_for_execution:false,protocol:GRANT_PROTOCOL,required_separate_approvals:['independent ownership and reviewer','key generation and backups','root/recovery enrollment','policy transition','code and schema review','DO provisioning','D1 migration','deployment and activation','approval signing','exact administrator grant apply'],next_action:'Assign an independent reviewer and collect provider ownership evidence references; do not supply secrets.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),o={};for(let i=0;i<args.length;i+=2){const k=args[i]?.slice(2);if(!['bundle','review'].includes(k)||o[k]||!args[i+1])throw Error('Use only --bundle PUBLIC_JSON and --review REVIEW_JSON.');o[k]=args[i+1];}console.log(JSON.stringify(await checkRecovery(o),null,2));}catch{console.error('Read-only recovery check failed. Review scope, public artifacts and evidence references. No operation was performed.');process.exitCode=1;}
}
