#!/usr/bin/env node
// Offline approval signing. Private Ed25519 key arrives on stdin, never arguments/output.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createPrivateKey,sign} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {URL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {verifyOwnerPolicy} from './lib/owner-policy.mjs';
import {canonical,verifyApproval,STAGING} from './lib/admin-grant.mjs';
export function signApproval(payload,keyId,privatePem,policy,confirmation,now=Date.now(),passphrase){
 if(canonical(Object.fromEntries(Object.keys(STAGING).map(k=>[k,payload?.intent?.[k]])))!==canonical(STAGING)||confirmation!==`APPROVE ${payload?.intent?.request_id}`)throw new Error('Review the exact staging intent and explicitly confirm its request ID.');
 let signature;try{const key=createPrivateKey(passphrase===undefined?privatePem:{key:privatePem,format:'pem',passphrase});if(key.asymmetricKeyType!=='ed25519')throw new Error();signature=sign(null,Buffer.from(canonical(payload)),key).toString('base64');}catch{throw new Error('A trusted Ed25519 signing key is required.');}
 const envelope={key_id:keyId,payload,signature};verifyApproval(envelope,policy,payload.intent,now);return envelope;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),o={};const required=['payload','key-id','out','confirm'];const allowed=new Set([...required,'passphrase-fd']);for(let i=0;i<args.length;i+=2){const k=args[i]?.replace(/^--/,'');if(!args[i]?.startsWith('--')||!allowed.has(k)||o[k]||!args[i+1])throw new Error('Invalid signing arguments.');o[k]=args[i+1];}if(required.some(k=>!o[k]))throw new Error('All signing arguments are required.');
 const trustURL=new URL('../staging/owner-root-public.json',import.meta.url);const policy=existsSync(trustURL)?verifyOwnerPolicy(JSON.parse(readFileSync(new URL('../staging/owner-policy-chain.json',import.meta.url),'utf8')),JSON.parse(readFileSync(trustURL,'utf8'))):JSON.parse(readFileSync(new URL('../staging/admin-approval-policy.json',import.meta.url),'utf8'));const payload=JSON.parse(readFileSync(o.payload,'utf8'));
 if(process.stdin.isTTY)throw new Error('Provide the signing key through protected stdin; do not paste it into the terminal.');
 let passphrase;if(o['passphrase-fd']!==undefined){if(!/^(?:[3-9]|[1-9][0-9]{1,2})$/.test(o['passphrase-fd']))throw new Error();passphrase=readFileSync(Number(o['passphrase-fd']),'utf8').replace(/\r?\n$/,'');}
 const envelope=signApproval(payload,o['key-id'],readFileSync(0,'utf8'),policy,o.confirm,Date.now(),passphrase);writeFileSync(o.out,JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Signed approval saved. No database operation was performed.');
 }catch{console.error('Approval signing failed. Check policy, reviewed payload, confirmation and protected key input. No database operation was performed.');process.exitCode=1;}
}
