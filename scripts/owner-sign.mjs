#!/usr/bin/env node
// Existing private key on protected stdin ONLY. Never generates or prints a key.
import {readFileSync,writeFileSync} from 'node:fs';
import {createPrivateKey,sign} from 'node:crypto';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,STAGING} from './lib/admin-grant.mjs';
export function signRecovery(request,pem,mode,confirmation){
 const p=request?.payload;const origin=`https://${STAGING.worker}.yukikato123123123.workers.dev`;
 if(!['recover','accept'].includes(mode)||p?.operation!=='owner_recovery'||canonical(p.scope)!==canonical(STAGING)||p.origin!==origin||p.protocol!=='owner-pin-key-v1'||p.expires_at<=Date.now()||p.expires_at>Date.now()+300000||confirmation!==`SIGN OWNER RECOVERY ${p.request_id}`)throw new Error('Exact unexpired staging recovery review is required.');
 const key=createPrivateKey(pem);if(key.asymmetricKeyType!=='ed25519')throw new Error('Existing Ed25519 key required.');
 const payload=mode==='accept'?{operation:'accept_recovery_key',payload:p}:p;
 const signature=sign(null,Buffer.from(canonical(payload)),key).toString('base64url');
 return mode==='accept'?{payload:p,signature:request.signature,next_signature:signature}:{payload:p,signature};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),options={};const keys=['request','out','mode','confirm'];for(let i=0;i<args.length;i+=2){const k=args[i]?.replace(/^--/,'');if(!args[i]?.startsWith('--')||!keys.includes(k)||options[k]||!args[i+1])throw new Error();options[k]=args[i+1];}if(keys.some(k=>!options[k])||process.stdin.isTTY)throw new Error();
 const result=signRecovery(JSON.parse(readFileSync(options.request,'utf8')),readFileSync(0,'utf8'),options.mode,options.confirm);writeFileSync(options.out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Recovery envelope saved. No remote operation performed.');
 }catch{console.error('Recovery signing failed. Review the protected input, exact scope and confirmation.');process.exitCode=1;}
}
