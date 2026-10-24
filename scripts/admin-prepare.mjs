#!/usr/bin/env node
// Read-only local preparation: never reads a private key or environment tokens.
import {lstatSync,realpathSync,readdirSync,openSync,readFileSync,closeSync,constants} from 'node:fs';
import {resolve,relative,isAbsolute,dirname,extname,sep} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {inspectPublicKey,validateTrustConfig} from './admin-trust-init.mjs';
import {STAGING,canonical} from './lib/admin-grant.mjs';
import {readConfig} from './validate-deployment.mjs';
const reject=()=>{throw Error('Preparation rejected. Check candidate inputs, public files and staging configuration.');};
const exists=p=>{try{return lstatSync(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const beneath=(root,p)=>{const r=relative(root,p);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
function readPublic(path,max=65536){
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max||realpathSync(path)!==path)reject();
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{return readFileSync(fd,'utf8');}finally{closeSync(fd);}
}
export function parsePrepareArgs(args){
 const o={},allowed=new Set(['email','user','key-mode','public-key','private-key']);
 for(let i=0;i<args.length;i+=2){const k=args[i]?.slice(2);if(!args[i]?.startsWith('--')||!allowed.has(k)||Object.hasOwn(o,k)||!args[i+1]||args[i+1].startsWith('--'))reject();o[k]=args[i+1];}
 return o;
}
export function prepareAdministrator(o,root=fileURLToPath(new URL('../',import.meta.url))){
 root=realpathSync(root);
 if(typeof o.email!=='string'||o.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)||[...o.email].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))reject();
 if(o.user!==undefined&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(o.user))reject();
 const mode=o['key-mode']??'existing';if(!['existing','new'].includes(mode))reject();
 const configPath=resolve(root,'wrangler.staging.jsonc');readPublic(configPath);validateTrustConfig(readConfig(configPath));
 const staging=resolve(root,'staging');if(!exists(staging)?.isDirectory()||realpathSync(staging)!==staging)reject();
 const rootPresent=!!exists(resolve(staging,'owner-root-public.json'));
 const policyPath=resolve(staging,'admin-approval-policy.json');let policyState='MISSING',policy=null;
 if(exists(policyPath)){
  try{policy=JSON.parse(readPublic(policyPath));if(canonical(policy.scope)!==canonical(STAGING)||!Array.isArray(policy.approvers)||!policy.approvers.length)reject();
   for(const entry of policy.approvers)if(typeof entry.id!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(entry.id))reject();else inspectPublicKey(entry.public_key);
   if(new Set(policy.approvers.map(e=>e.id)).size!==policy.approvers.length)reject();
   policyState='PRESENT_UNVERIFIED';
  }catch{policyState='INVALID_OR_UNSAFE';policy=null;}
 }
 const paths=new Set(readdirSync(staging).filter(n=>n.endsWith('.pub')).map(n=>resolve(staging,n)));
 if(o['public-key']){const p=resolve(root,o['public-key']);if(extname(p)!=='.pub'||(o['public-key'].split(/[\\/]/).includes('..')))reject();paths.add(p);}
 const keys=[];
 for(const path of paths){
  try{const key=inspectPublicKey(readPublic(path,4096));const matching=(policy?.approvers??[]).filter(e=>!e.disabled&&inspectPublicKey(e.public_key).fingerprint===key.fingerprint);
   keys.push({source:'public-file',status:'VALID_PUBLIC_KEY',fingerprint:key.fingerprint,policy_match:matching.length>0,approval:'UNVERIFIED'});
  }catch{keys.push({source:'public-file',status:'INVALID_OR_UNSAFE',approval:'UNVERIFIED'});}
 }
 for(const entry of policy?.approvers??[])keys.push({source:'local-policy',status:entry.disabled?'DISABLED':'PUBLIC_KEY_IN_POLICY',fingerprint:inspectPublicKey(entry.public_key).fingerprint,approval:'UNVERIFIED'});
 // Inspect only the explicit private-key path's metadata; NEVER open/read it.
 let privateStatus='NOT_CHECKED';
 if(o['private-key']){
  const p=o['private-key'];if(!isAbsolute(p)||beneath(root,resolve(p)))reject();
  const stat=exists(p);
  if(stat){if(realpathSync(p)!==p||!stat.isFile()||(stat.mode&0o077)||stat.uid!==process.getuid())reject();privateStatus='EXISTS_NOT_READ_OR_MATCHED';}
  else{const parent=dirname(p),s=lstatSync(parent);if(realpathSync(parent)!==parent||!s.isDirectory()||(s.mode&0o077)||s.uid!==process.getuid())reject();privateStatus='ABSENT_NOT_CREATED';}
 }
 const blocked=rootPresent||policyState==='INVALID_OR_UNSAFE';
 let next;
 if(blocked)next='STOP: existing owner root or unsafe policy requires review; never delete or bypass it.';
 else if(policyState==='PRESENT_UNVERIFIED')next='Confirm the existing policy signer identity/fingerprint and target identity, then separately authorize online admin-grant dry-run.';
 else if(!keys.some(k=>k.status==='VALID_PUBLIC_KEY'))next=mode==='new'?'Approve a separate offline Ed25519 key-generation/backup step using admin-key-prepare.mjs outside the repository; no key has been generated.':'Provide the existing approval PUBLIC key (.pub), or explicitly choose new-key preparation; do not send a private key.';
 else next='Confirm the public fingerprint and identity evidence, then separately approve admin-trust-init enrollment; no policy is registered.';
 return {mode:'LOCAL_PREPARATION_ONLY',scope:STAGING,target:{email:o.email,user_id:o.user??null,status:'UNVERIFIED_CANDIDATE'},trust:{policy:policyState,owner_root:rootPresent?'PRESENT_BLOCKS_DIRECT_APPLY':'ABSENT',external_records:'UNVERIFIED'},key_preparation:{mode,private_key:privateStatus,private_key_content_read:false,generated:false,keys},account_verification:{status:'NOT_RUN',procedure:'In the approved Supabase management path for this scope, look up the exact email and require exactly one existing confirmed, non-deleted, non-banned Auth user. Compare its UUID with the candidate; never infer identity from email alone. Then use existing admin-grant online dry-run to verify UUID/email, deployed bindings, onboarding and grant state.',session_match:'NOT_VERIFIED: the current browser session is not compared by these CLIs.',required_environment_names:['CLOUDFLARE_API_TOKEN','SUPABASE_ACCESS_TOKEN'],environment_read:false},next_action:next,changed:false};
}
export function formatPreparation(r){
 const lines=[r.mode+' (no writes / no network)',
  `Target: ${r.target.email} | UUID: ${r.target.user_id??'NOT PROVIDED'} | UNVERIFIED`,
  `Scope: ${r.scope.project_ref} / ${r.scope.worker} / wrangler.staging.jsonc`,
  `Cloudflare: ${r.scope.account_id} | D1: ${r.scope.database_id}`,
  `Policy: ${r.trust.policy} | owner-root: ${r.trust.owner_root}`,
  'Signer identity / external approval records: UNVERIFIED',
  `Key mode: ${r.key_preparation.mode} | private file: ${r.key_preparation.private_key} | generation: NOT RUN`];
 for(const key of r.key_preparation.keys.slice(0,4))lines.push(`Public key: ${key.status} | ${key.fingerprint??'NO VALID FINGERPRINT'} | approval UNVERIFIED`);
 if(r.key_preparation.keys.length>4)lines.push(`${r.key_preparation.keys.length-4} additional public-key entries; review locally before selecting a signer.`);
 if(!r.key_preparation.keys.length)lines.push('Public key: MISSING (external stores not searched)');
 lines.push('Account verification: NOT RUN; exact-email management lookup -> one confirmed/active Auth user -> compare UUID.',
  'Then separately authorized admin-grant online dry-run checks bindings, onboarding and grant state; browser session match remains UNVERIFIED.',
  'Later environment names: CLOUDFLARE_API_TOKEN / SUPABASE_ACCESS_TOKEN (values NOT READ).',
  'NEXT: '+r.next_action);
 return lines.join('\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(formatPreparation(prepareAdministrator(parsePrepareArgs(process.argv.slice(2)))));}
 catch{console.error('Local preparation failed. Check public inputs and protected external paths. No registration, signature or grant was performed.');process.exitCode=1;}
}
