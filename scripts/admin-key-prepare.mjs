#!/usr/bin/env node
// Explicit offline generation only; no policy registration, network or signing.
import {generateKeyPairSync} from 'node:crypto';
import {lstatSync,realpathSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {isAbsolute,resolve,relative,sep} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {inspectPublicKey} from './admin-trust-init.mjs';
import {prepareAdministrator} from './admin-prepare.mjs';
import {readFileSync} from 'node:fs';
import {keyDestination} from './lib/admin-key-store.mjs';
import {readRecoveryPolicy} from './lib/admin-key-recovery.mjs';
import {STAGING} from './lib/admin-grant.mjs';
const fail=()=>{throw Error('Offline key preparation rejected; inspect protected destination before retrying.');};
const exists=p=>{try{lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const within=(a,b)=>{const r=relative(a,b);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
export function parseKeyArgs(args){
 const o={};for(let i=0;i<args.length;i++){
  const k=args[i].slice(2);if(!args[i].startsWith('--')||Object.hasOwn(o,k))fail();
  if(k==='generate')o.generate=true;
  else if(['directory','email','confirm'].includes(k)&&args[i+1]&&!args[i+1].startsWith('--'))o[k]=args[++i];else fail();
 }return o;
}
export function prepareKey(o,{root=fileURLToPath(new URL('../',import.meta.url)),passphrase,home}={}){
 root=realpathSync(root);
 let report;
 if(o.recovery===true){
  readRecoveryPolicy(root);
  report={scope:STAGING};
 }else{
  report=prepareAdministrator({email:o.email,'key-mode':'new'},root);
  if(report.trust.policy!=='MISSING'||report.trust.owner_root!=='ABSENT'||report.key_preparation.keys.length)fail();
 }
 const dir=keyDestination(root,{directory:o.directory,home});
 if(typeof dir!=='string'||!isAbsolute(dir)||resolve(dir)!==dir||within(root,dir)||within(dir,root)||exists(dir))fail();
 if(!o.generate)return {mode:'PLAN_ONLY',directory:dir,generated:false,registered:false,target_verified:false,next_action:'Review the external owner-only destination and offline backup plan; generation requires explicit confirmation and a protected stdin passphrase.'};
 if(o.confirm!=='GENERATE OFFLINE STAGING APPROVAL KEY'||typeof passphrase!=='string'||passphrase.length<20||passphrase.length>1024||/[\r\n\0]/.test(passphrase))fail();
 keyDestination(root,{directory:o.directory,home,createParent:true});
 const pair=generateKeyPairSync('ed25519');
 const publicPem=pair.publicKey.export({format:'pem',type:'spki'});
 const encrypted=pair.privateKey.export({format:'pem',type:'pkcs8',cipher:'aes-256-cbc',passphrase});
 const reviewed=inspectPublicKey(publicPem);
 // New owner-only directory, exclusive writes. On uncertainty preserve partial
 // output for inspection; never overwrite, retry automatically or print secrets.
 mkdirSync(dir,{mode:0o700});
 function save(name,data){const fd=openSync(resolve(dir,name),'wx',0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}
 save('approval-private.pem',encrypted);save('approval-public.pub',publicPem);
 const receipt={scope:report.scope,fingerprint:reviewed.fingerprint,algorithm:'Ed25519',private_format:'encrypted PKCS8 / aes-256-cbc',approval:'UNVERIFIED',target_verified:false,registered:false};
 save('public-review.json',JSON.stringify(receipt,null,2)+'\n');
 const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
 return {mode:'OFFLINE_KEY_PREPARED',generated:true,registered:false,target_verified:false,fingerprint:reviewed.fingerprint,next_action:'Back up the encrypted private key and passphrase separately, review the public fingerprint, and obtain the actual target UUID via official management lookup before any account approval.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const o=parseKeyArgs(process.argv.slice(2));let passphrase;
  if(o.generate){if(process.stdin.isTTY)fail();passphrase=readFileSync(0,'utf8').replace(/\r?\n$/,'');}
  console.log(JSON.stringify(prepareKey(o,{passphrase}),null,2));
 }catch{console.error('Offline key preparation not confirmed. No registration, signature or grant was performed. Inspect the external destination before retrying.');process.exitCode=1;}
}
