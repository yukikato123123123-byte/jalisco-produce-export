#!/usr/bin/env node
import {readFileSync,existsSync} from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import {fileURLToPath,URL} from 'node:url';
import {resolve} from 'node:path';
import {readConfig} from './validate-deployment.mjs';
import {runGrant,makeGateway} from './lib/admin-grant.mjs';
import {runOwnerGrant} from './lib/owner-grant-client.mjs';
export function parseArgs(args){const result={config:'wrangler.staging.jsonc',apply:false,offline:false};const values=new Set(['config','project','user','email','action','reason','request','expected','approval','confirm','resolve']);const seen=new Set();for(let i=0;i<args.length;i++){const key=args[i].replace(/^--/,'');if(!args[i].startsWith('--')||seen.has(key))throw new Error('Unknown or duplicate argument.');seen.add(key);if(['apply','offline','dry-run','owner-aware','status'].includes(key)){if(key!=='dry-run')result[key]=true;}else if(values.has(key)&&args[i+1]&&!args[i+1].startsWith('--'))result[key]=args[++i];else throw new Error('Unknown argument or missing value.');}if(seen.has('dry-run')&&(result.apply||result.resolve||result.status)||result.status&&(result.apply||!result['owner-aware'])||result.resolve&&(!result['owner-aware']||result.apply||result.status||!['resume','cancel'].includes(result.resolve)))throw new Error('Choose dry-run, status or apply.');return result;}
export async function main(args=process.argv.slice(2)){
 const o=parseArgs(args);const root=fileURLToPath(new URL('../',import.meta.url));
 if(o.config!=='wrangler.staging.jsonc')throw new Error('Only the explicit staging config is supported.');
 const config=readConfig(resolve(root,o.config));
 if(o['owner-aware']){
  let trust,previousPolicy,approval;try{trust=JSON.parse(readFileSync(resolve(root,'staging/owner-root-public.json'),'utf8'));previousPolicy=JSON.parse(readFileSync(resolve(root,'staging/admin-approval-policy.json'),'utf8'));if(o.apply)approval=JSON.parse(readFileSync(o.approval,'utf8'));}catch{throw Error('Independently enrolled owner root and preserved policy are required. No direct D1 fallback.');}
  const result=await runOwnerGrant(o,{config,trust,previousPolicy,approval,cloudflareToken:process.env.CLOUDFLARE_API_TOKEN,supabaseToken:process.env.SUPABASE_ACCESS_TOKEN});console.log(JSON.stringify(result,null,2));return result;
 }
 // The trust anchor is deliberately fixed, never chosen by --policy or an HTTP caller.
 let policy,approval;if(o.apply){try{const trustPath=resolve(root,'staging/owner-root-public.json');if(existsSync(trustPath))throw new Error('Owner-aware grant commits require an epoch-fenced gateway; direct D1 apply is disabled.');policy=JSON.parse(readFileSync(resolve(root,'staging/admin-approval-policy.json'),'utf8'));approval=JSON.parse(readFileSync(o.approval,'utf8'));}catch(error){if(error.message.includes('epoch-fenced'))throw error;throw new Error('Approved policy or signed approval file is missing or invalid.');}}
 const gateway=o.offline?null:makeGateway({fetcher:globalThis.fetch,cloudflareToken:process.env.CLOUDFLARE_API_TOKEN,supabaseToken:process.env.SUPABASE_ACCESS_TOKEN});
 const result=await runGrant(o,{config,policy,approval,gateway});console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
