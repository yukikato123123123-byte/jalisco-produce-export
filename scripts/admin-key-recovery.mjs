#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {prepareKey} from './admin-key-prepare.mjs';
import {recoveryPayload,reviewRecovery} from './lib/admin-key-recovery.mjs';
export function main(args=process.argv.slice(2)){
 const mode=args.shift(),o={};
 for(let i=0;i<args.length;i+=2){const k=args[i]?.slice(2);if(!args[i]?.startsWith('--')||!['directory','request','approval-ref','envelope','confirm'].includes(k)||Object.hasOwn(o,k)||!args[i+1])throw Error('Invalid recovery arguments.');o[k]=args[i+1];}
 const root=fileURLToPath(new URL('../',import.meta.url));
 if(mode==='plan')return prepareKey({directory:o.directory,recovery:true});
 if(mode==='generate'){
  if(process.stdin.isTTY)throw Error('Protected passphrase stdin required.');
  return prepareKey({directory:o.directory,recovery:true,generate:true,confirm:o.confirm},{passphrase:readFileSync(0,'utf8').replace(/\r?\n$/,'')});
 }
 if(mode==='request')return {payload:recoveryPayload(root,o.directory,o.request,o['approval-ref']),registered:false};
 if(mode==='review')return reviewRecovery(root,o.directory,JSON.parse(readFileSync(o.envelope,'utf8')));
 throw Error('Use plan, generate, request or review. No registration command exists.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(main(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
