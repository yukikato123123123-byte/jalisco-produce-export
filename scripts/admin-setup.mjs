#!/usr/bin/env node
// Separate local plan/key and online trust/dry-run stages. Never signs or applies grants.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {prepareKey} from './admin-key-prepare.mjs';
import {initializeTrust} from './admin-trust-init.mjs';
import {prepareAdministrator} from './admin-prepare.mjs';
import {keyDestination,readPreparedKey} from './lib/admin-key-store.mjs';
import {STAGING,runGrant,makeGateway} from './lib/admin-grant.mjs';
import {readConfig} from './validate-deployment.mjs';

const fail=()=>{throw Error('Setup rejected. Review the stage, protected key store, identity evidence and explicit confirmation.');};
export function parseSetupArgs(args){
 const o={stage:'plan',email:'administrator@example.test',user:'11111111-1111-4111-8111-111111111111'};
 if(args[0]&&!args[0].startsWith('--'))o.stage=args.shift();
 const seen=new Set(),values=new Set(['email','user','directory','confirm','identity-ref','approval-ref','reason','request']);
 for(let i=0;i<args.length;i++){
  const k=args[i].slice(2);if(!args[i].startsWith('--')||seen.has(k))fail();seen.add(k);
  if(['generate','register'].includes(k))o[k]=true;
  else if(values.has(k)&&args[i+1]&&!args[i+1].startsWith('--'))o[k]=args[++i];else fail();
 }
 if(!['plan','key','trust','dry-run'].includes(o.stage)||(o.generate&&o.stage!=='key')||(o.register&&o.stage!=='trust')||(o.confirm&&!(o.generate||o.register)))fail();
 return o;
}
export async function setupAdministrator(o,{root=fileURLToPath(new URL('../',import.meta.url)),home,passphrase,gateway}={}){
 const report=prepareAdministrator({email:o.email,user:o.user,'key-mode':'new'},root);
 if(report.trust.owner_root!=='ABSENT'||report.trust.policy==='INVALID_OR_UNSAFE')fail();
 const directory=keyDestination(root,{directory:o.directory,home});
 if(o.stage==='plan')return {mode:'PLAN_ONLY',changed:false,target:{email:o.email,user:o.user,verified:false},scope:STAGING,directory,trust:report.trust,stages:['key','trust','dry-run','offline approval signing','separately approved grant apply'],next_action:'Review the external key location and backup plan. No keys, identity lookup, registration or grant have been performed.'};
 if(o.stage==='key')return prepareKey({...o,directory:o.directory},{root,home,passphrase});
 if(!['trust','dry-run'].includes(o.stage))fail();
 let key;
 if(o.stage==='trust'){
  if(report.trust.policy!=='MISSING'||typeof o['identity-ref']!=='string'||!o['identity-ref'].trim()||typeof o['approval-ref']!=='string'||!o['approval-ref'].trim())fail();
  if(o.register&&o.confirm!=='REGISTER FIRST STAGING APPROVER')fail();
  key=readPreparedKey(directory,root);
 }
 if(!o.reason?.trim())fail();
 // Reuse exactly the official Auth UUID/email/status, deployed scope, onboarding,
 // and existing grant checks. This is always a no-write grant plan.
 const plan=await runGrant({config:'wrangler.staging.jsonc',project:STAGING.project_ref,user:o.user,email:o.email,action:'grant',request:o.request??randomUUID(),reason:o.reason},{config:readConfig(resolve(root,'wrangler.staging.jsonc')),gateway});
 if(o.stage==='dry-run')return plan;
 const result=initializeTrust({config:'wrangler.staging.jsonc',project:STAGING.project_ref,account:STAGING.account_id,database:STAGING.database_id,worker:STAGING.worker,approver:'staging-owner','prepared-directory':directory,operator:plan.intent.operator_id,'identity-ref':o['identity-ref'],reason:o.reason,'approval-ref':o['approval-ref'],register:o.register===true,confirm:o.register?`REGISTER STAGING APPROVER staging-owner ${key.fingerprint}`:undefined},root);
 return {...result,target_verified:true,target:{email:o.email,user:o.user},ownership_evidence:'Operator attestation; email and API access alone do not establish ownership.',grant_changed:false};
}
export async function main(args=process.argv.slice(2)){
 const o=parseSetupArgs([...args]);let passphrase,gateway;
 if(o.stage==='key'&&o.generate){if(o.confirm!=='GENERATE OFFLINE STAGING APPROVAL KEY'||process.stdin.isTTY)fail();passphrase=readFileSync(0,'utf8').replace(/\r?\n$/,'');}
 if(['trust','dry-run'].includes(o.stage))gateway=makeGateway({fetcher:globalThis.fetch,cloudflareToken:process.env.CLOUDFLARE_API_TOKEN,supabaseToken:process.env.SUPABASE_ACCESS_TOKEN});
 const result=await setupAdministrator(o,{passphrase,gateway});console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Setup stage failed. No grant was applied. Inspect the local trust/key state before retrying; never replace existing material.');process.exitCode=1;});
