#!/usr/bin/env node
// Offline signatures only. No key generation, trust registration, network or database access.
import {readFileSync,writeFileSync} from 'node:fs';
import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {canonical,sha,STAGING} from './lib/admin-grant.mjs';
import {inspectPublicKey} from './lib/admin-key-store.mjs';
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
const fail=()=>{throw Error('Enrollment signing rejected. Review role, exact payload digest and independently compared public fingerprint.');};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function exact(value,fields){if(!isObject(value)||Object.keys(value).sort().join(',')!==[...fields].sort().join(','))fail();}
function raw(value,length){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))fail();const b=Buffer.from(value,'base64url');if(b.length!==length||b.toString('base64url')!==value)fail();return b;}
function uuid(value){if(typeof value!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))fail();}
function publicPolicy(policy){
 exact(policy,['scope','approvers']);if(canonical(policy.scope)!==canonical(STAGING)||!Array.isArray(policy.approvers)||policy.approvers.length<1||policy.approvers.length>4)fail();
 const ids=new Set(),keys=new Set();for(const entry of policy.approvers){
  exact(entry,['id','public_key',...(Object.hasOwn(entry??{},'disabled')?['disabled']:[])]);
  if(typeof entry.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(entry.id)||ids.has(entry.id)||Object.hasOwn(entry,'disabled')&&entry.disabled!==false)fail();
  const key=inspectPublicKey(entry.public_key);if(keys.has(key.fingerprint))fail();ids.add(entry.id);keys.add(key.fingerprint);
 }
}
function enrollmentPayload(role,payload){
 const p=role.endsWith('-accept')?payload.activation:payload;
 if(role.endsWith('-accept'))exact(payload,['operation','role','activation']);
 if(['root-bootstrap','root-policy'].includes(role)){
  exact(p,['operation','protocol','scope','origin','owner_id','epoch','recovery','policy',...(role==='root-bootstrap'?['pin']:[])]);
  exact(p.recovery,['id','public_key']);uuid(p.recovery.id);raw(p.recovery.public_key,32);publicPolicy(p.policy);
  if(role==='root-bootstrap'){
   exact(p.pin,['algorithm','iterations','salt','verifier']);
   if(p.pin.algorithm!=='PBKDF2-SHA256-HMAC-SHA256'||p.pin.iterations!==600000)fail();raw(p.pin.salt,16);raw(p.pin.verifier,32);
  }
 }else{
  exact(p,['operation','protocol','scope','origin','owner_id','bootstrap_sha256','previous_policy_sha256','capabilities']);
  if(typeof p.bootstrap_sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.bootstrap_sha256)||typeof p.previous_policy_sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.previous_policy_sha256)||canonical(p.capabilities)!==canonical(['admin_action','admin_read','grant','revoke','rotate_policy']))fail();
 }
 // Reject unexpected fields at every level before signing or producing an output record.
 if(canonical(p.scope)!==canonical(STAGING)||p.origin!==origin)fail();uuid(p.owner_id);
}
export function signEnrollment({role,payload,publicPem,fingerprint,privatePem,passphrase,confirmation}){
 const roles={'root-bootstrap':'owner_bootstrap','root-policy':'owner_policy_root','root-activation':'activate_owner_admin_gateway','recovery-accept':'accept_owner_admin_activation','approval-accept':'accept_owner_admin_activation'};
 if(!Object.hasOwn(roles,role)||payload?.operation!==roles[role]||confirmation!==`SIGN OWNER ENROLLMENT ${role} ${sha(canonical(payload))}`)fail();
 enrollmentPayload(role,payload);
 const p=role.endsWith('-accept')?payload.activation:payload;
 const fields=role==='root-bootstrap'?['operation','protocol','scope','origin','owner_id','epoch','recovery','pin','policy']:role==='root-policy'?['operation','protocol','scope','origin','owner_id','epoch','recovery','policy']:['operation','protocol','scope','origin','owner_id','bootstrap_sha256','previous_policy_sha256','capabilities'];
 if(Object.keys(p??{}).some(k=>!fields.includes(k))||role.endsWith('-accept')&&Object.keys(payload).some(k=>!['operation','role','activation'].includes(k)))fail();
 if(canonical(p?.scope)!==canonical(STAGING)||p.origin!==origin||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.owner_id)))fail();
 if(role==='root-bootstrap'&&(p.protocol!=='owner-pin-key-v1'||p.epoch!==1)||role==='root-policy'&&(p.protocol!=='owner-pin-key-v1'||p.epoch!==1)||['root-activation','recovery-accept','approval-accept'].includes(role)&&(p.protocol!=='owner-admin-grants-v1'||p.operation!=='activate_owner_admin_gateway'))fail();
 if(role==='recovery-accept'&&payload.role!=='recovery'||role==='approval-accept'&&payload.role!=='approver')fail();
 const expected=inspectPublicKey(publicPem);if(expected.fingerprint!==fingerprint)fail();
 let key;try{key=createPrivateKey({key:privatePem,format:'pem',...(passphrase===undefined?{}:{passphrase})});}catch{return fail();}
 if(key.asymmetricKeyType!=='ed25519'||inspectPublicKey(createPublicKey(key).export({format:'pem',type:'spki'})).fingerprint!==fingerprint)fail();
 const signature=sign(null,Buffer.from(canonical(payload)),key).toString('base64url');
 if(!verify(null,Buffer.from(canonical(payload)),createPublicKey(publicPem),Buffer.from(signature,'base64url')))fail();
 return {payload,signature};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),o={},required=['role','payload','public-key','fingerprint','out','confirm'];
  for(let i=0;i<args.length;i+=2){const k=args[i]?.slice(2);if(![...required,'passphrase-fd'].includes(k)||o[k]||!args[i+1])fail();o[k]=args[i+1];}
  if(required.some(k=>!o[k])||process.stdin.isTTY)fail();
  let passphrase;if(o['passphrase-fd']!==undefined){if(!/^(?:[3-9]|[1-9][0-9]{1,2})$/.test(o['passphrase-fd']))fail();passphrase=readFileSync(Number(o['passphrase-fd']),'utf8').replace(/\r?\n$/,'');}
  const record=signEnrollment({role:o.role,payload:JSON.parse(readFileSync(o.payload,'utf8')),publicPem:readFileSync(o['public-key'],'utf8'),fingerprint:o.fingerprint,privatePem:readFileSync(0,'utf8'),passphrase,confirmation:o.confirm});
  writeFileSync(o.out,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Offline signature saved. Ownership, enrollment and grant remain unverified.');
 }catch{console.error('Enrollment signing failed. No registration, deployment or grant was performed.');process.exitCode=1;}
}
