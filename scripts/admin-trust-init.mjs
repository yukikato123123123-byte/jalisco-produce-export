#!/usr/bin/env node
// Local public trust enrollment only. No network, signing or private key handling.
import {lstatSync,realpathSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,mkdtempSync,linkSync,unlinkSync,rmdirSync} from 'node:fs';
import {resolve,isAbsolute,relative,sep} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {STAGING,canonical} from './lib/admin-grant.mjs';
import {readConfig} from './validate-deployment.mjs';
import {inspectPublicKey,readPreparedKey} from './lib/admin-key-store.mjs';
export {inspectPublicKey} from './lib/admin-key-store.mjs';

const fail=()=>{throw Error('Trust enrollment rejected. Check scope, public key, fingerprint, attestations and existing trust files.');};
const present=p=>{try{lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export function parseTrustArgs(args){
 const o={},allowed=new Set(['config','project','account','database','worker','approver','public-key','fingerprint','prepared-directory','operator','identity-ref','reason','approval-ref','confirm']);
 for(let i=0;i<args.length;i++){
  const name=args[i].slice(2);if(!args[i].startsWith('--')||Object.hasOwn(o,name))fail();
  if(name==='register')o.register=true;
  else if(allowed.has(name)&&args[i+1]&&!args[i+1].startsWith('--'))o[name]=args[++i];else fail();
 }
 return o;
}
function inside(root,path){
 if(typeof path!=='string'||isAbsolute(path)||path.split(/[\\/]/).some(p=>p==='..'||p==='.'))fail();
 const full=resolve(root,path),rel=relative(root,full);if(!rel||rel.startsWith('..'+sep)||isAbsolute(rel))fail();
 if(realpathSync(full)!==full||!lstatSync(full).isFile())fail();return full;
}
export function validateTrustConfig(config){
 if(config.name!==STAGING.worker||config.account_id!==STAGING.account_id||config.env||config.routes||config.route||config.vars?.AUTH_ENVIRONMENT!=='staging'||config.vars?.SUPABASE_URL!==`https://${STAGING.project_ref}.supabase.co`||config.vars?.AUTH_ORIGIN!==`https://${STAGING.worker}.yukikato123123123.workers.dev`||config.d1_databases?.length!==1||config.d1_databases[0].binding!=='DB'||config.d1_databases[0].database_id!==STAGING.database_id)fail();
}
export function initializeTrust(o,root=fileURLToPath(new URL('../',import.meta.url))){
 root=realpathSync(root);
 const prepared=Object.hasOwn(o,'prepared-directory');
 if(prepared&&(Object.hasOwn(o,'public-key')||Object.hasOwn(o,'fingerprint')))fail();
 const required=['config','project','account','database','worker','approver','operator','identity-ref','reason','approval-ref',...(prepared?['prepared-directory']:['public-key','fingerprint'])];
 if(required.some(k=>typeof o[k]!=='string'||!o[k].trim()||o[k].length>500||[...o[k]].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))fail();
 if(o.config!=='wrangler.staging.jsonc'||canonical({project_ref:o.project,account_id:o.account,database_id:o.database,worker:o.worker})!==canonical(STAGING)||! /^[A-Za-z0-9_-]{1,128}$/.test(o.approver))fail();
 const config=readConfig(inside(root,o.config));
 validateTrustConfig(config);
 const dir=resolve(root,'staging');if(realpathSync(dir)!==dir||!lstatSync(dir).isDirectory()||(lstatSync(dir).mode&0o022))fail();
 const policyPath=resolve(dir,'admin-approval-policy.json'),rootPath=resolve(dir,'owner-root-public.json');
 if(present(policyPath)||present(rootPath))fail();
 let publicKey;
 if(prepared)publicKey=readPreparedKey(o['prepared-directory'],root);
 else{const input=inside(root,o['public-key']);if(lstatSync(input).size>4096)fail();publicKey=inspectPublicKey(readFileSync(input,'utf8'));if(o.fingerprint!==publicKey.fingerprint)fail();}
 const fingerprint=publicKey.fingerprint;
 const policy={scope:STAGING,approvers:[{id:o.approver,public_key:publicKey.public_key}],registration:{operator:o.operator,identity_ref:o['identity-ref'],reason:o.reason,approval_ref:o['approval-ref'],fingerprint,fingerprint_format:'SHA256:lowercase-hex(SPKI-DER)',registered_at:new Date().toISOString()}};
 if(!o.register)return {mode:'dry-run',changed:false,scope:STAGING,fingerprint,identity_verified:false};
 if(o.confirm!==`REGISTER STAGING APPROVER ${o.approver} ${fingerprint}`)fail();
 // Publish a complete policy with no-replace semantics. Audit metadata is in
 // the SAME file, so policy and its enrollment record cannot split on failure.
 const temp=mkdtempSync(resolve(dir,'.admin-trust-')),staged=resolve(temp,'policy');
 try{
  const fd=openSync(staged,'wx',0o600);try{writeFileSync(fd,JSON.stringify(policy,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  if(present(policyPath)||present(rootPath)||realpathSync(dir)!==dir)fail();
  linkSync(staged,policyPath); // EEXIST also rejects a racing registration.
  const directory=openSync(dir,'r');try{fsyncSync(directory);}finally{closeSync(directory);}
 }finally{if(present(staged))unlinkSync(staged);rmdirSync(temp);}
 return {mode:'registered',changed:true,scope:STAGING,fingerprint,identity_verified:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(initializeTrust(parseTrustArgs(process.argv.slice(2))),null,2));}
 catch{console.error('Trust enrollment not confirmed. Inspect existing public trust files before retrying. No grant was performed.');process.exitCode=1;}
}
