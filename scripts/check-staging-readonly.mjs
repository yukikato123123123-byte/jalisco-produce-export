#!/usr/bin/env node
// Fixed-scope read-only diagnostics. No keys, registrations, approval decisions or writes.
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {STAGING,canonical,validateOptions} from './lib/admin-grant.mjs';
import {readConfig} from './validate-deployment.mjs';
const {AbortSignal,URL}=globalThis;
const subject={id:'11111111-1111-4111-8111-111111111111',email:'administrator@example.test'};
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
export async function checkStagingReadonly({cloudflareToken,supabaseToken,approvalFilePresent=false,fetcher=globalThis.fetch,now=Date.now()}={}){
 const report={mode:'READ_ONLY',scope:STAGING,approval_file_present:approvalFilePresent,approval_authorized:false,approval_verification:approvalFilePresent?'REQUIRES_INDEPENDENT_SIGNATURE_AND_IDENTITY_REVIEW':'NO_RECORD',cloudflare:{status:'NOT_CONNECTED'},supabase:{status:'NOT_CONNECTED'},supabase_connection_source:'PROCESS_ENVIRONMENT_MANAGEMENT_API_ONLY',supabase_mcp_connection:'NOT_CHECKED_BY_SCRIPT',migration:'NOT_RECHECKED',operational_changes_performed:false};
 async function request(url,token,body){
  try{
   const r=await fetcher(url,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)return {ok:false,http_status:r.status};
   return {ok:true,data:await r.json()};
  }catch{return {ok:false,error:'TRANSPORT_OR_RESPONSE_FAILURE'};}
 }
 if(cloudflareToken){
  const base=`https://api.cloudflare.com/client/v4/accounts/${STAGING.account_id}`;
  const settings=await request(`${base}/workers/scripts/${STAGING.worker}/settings`,cloudflareToken);
  if(!settings.ok||settings.data?.success!==true)report.cloudflare={status:'UNVERIFIED',...(settings.http_status?{http_status:settings.http_status}:{})};
  else{
   const bindings=settings.data.result?.bindings;
   const v=name=>Array.isArray(bindings)?bindings.find(x=>x.name===name):undefined;
   const matches=v('DB')?.id===STAGING.database_id&&v('DB')?.type==='d1'&&v('SUPABASE_URL')?.text===`https://${STAGING.project_ref}.supabase.co`&&v('AUTH_ENVIRONMENT')?.text==='staging'&&v('AUTH_ORIGIN')?.text===origin;
   report.cloudflare={status:matches?'VERIFIED':'SCOPE_MISMATCH',scope_matches:matches,owner_gateway_configured:v('OWNER_ADMIN_MODE')?.text==='owner-admin-grants-v1'&&!!v('OWNER_AUTHORITY')};
   if(matches){
    const sql='SELECT (SELECT count(*) FROM auth_users WHERE user_id=?) AS known_user,(SELECT count(*) FROM profiles WHERE user_id=?) AS onboarded,(SELECT count(*) FROM admin_grants WHERE user_id=?) AS grant_rows,(SELECT count(*) FROM admin_grant_events WHERE target_id=? AND project_ref=?) AS grant_events,(SELECT count(*) FROM sessions WHERE user_id=? AND purpose=? AND expires>?) AS stored_unexpired_normal_sessions';
    const result=await request(`${base}/d1/database/${STAGING.database_id}/query`,cloudflareToken,{sql,params:[subject.id,subject.id,subject.id,subject.id,STAGING.project_ref,subject.id,'normal',now]});
    const data=result.data?.result?.[0],row=data?.results?.[0];
    const fields=['known_user','onboarded','grant_rows','grant_events','stored_unexpired_normal_sessions'];
    if(result.ok&&result.data?.success===true&&data?.success===true&&data.meta?.rows_written===0&&data.meta?.changed_db===false&&row&&fields.every(k=>Number.isSafeInteger(row[k])&&row[k]>=0))report.application={status:'VERIFIED_READ_ONLY',...Object.fromEntries(fields.map(k=>[k,row[k]])),rows_written:0,browser_session_verified:false};
    else report.application={status:'UNVERIFIED',...(result.http_status?{http_status:result.http_status}:{})};
   }
  }
 }
 if(supabaseToken){
  const query=`SELECT id::text,email,email_confirmed_at,banned_until,deleted_at FROM auth.users WHERE id='${subject.id}'::uuid AND email='${subject.email}' LIMIT 2`;
  const r=await request(`https://api.supabase.com/v1/projects/${STAGING.project_ref}/database/query/read-only`,supabaseToken,{query});
  const users=r.data,u=Array.isArray(users)&&users.length===1?users[0]:null;
  if(r.ok&&u?.id===subject.id&&u.email===subject.email)report.supabase={status:'IDENTITY_MATCHED',confirmed:Number.isFinite(Date.parse(u.email_confirmed_at)),deleted:!!u.deleted_at,banned:!!u.banned_until&&(!Number.isFinite(Date.parse(u.banned_until))||Date.parse(u.banned_until)>now),ownership_independently_verified:false};
  else report.supabase={status:'UNVERIFIED',...(r.http_status?{http_status:r.http_status}:{})};
 }
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==2)throw Error();
  const root=fileURLToPath(new URL('../',import.meta.url)),config=readConfig(join(root,'wrangler.staging.jsonc'));
  validateOptions({config:'wrangler.staging.jsonc',project:STAGING.project_ref,user:subject.id,email:subject.email,request:'00000000-0000-4000-8000-000000000001',action:'grant',reason:'Read-only connection verification'},config);
  const base=join(homedir(),'.jalisco-admin/replacement-review-20261023'),requestRecord=JSON.parse(readFileSync(join(base,'ownership-review.request.json'),'utf8'));
  if(canonical(requestRecord.scope)!==canonical(STAGING)||requestRecord.subject?.uid!==subject.id||requestRecord.subject?.email!==subject.email)throw Error();
  let cloudflareToken=process.env.CLOUDFLARE_API_TOKEN,credentialState=cloudflareToken?'ENVIRONMENT_TOKEN':'NOT_CONNECTED';
  if(!cloudflareToken){try{const raw=readFileSync(join(homedir(),'.config/.wrangler/config/default.toml'),'utf8'),expires=raw.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];if(expires&&Date.parse(expires)>Date.now()){cloudflareToken=raw.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];credentialState=cloudflareToken?'EXISTING_OAUTH':'NOT_CONNECTED';}else credentialState='OAUTH_EXPIRED_OR_UNVERIFIABLE';}catch{/* No credential searching or output. */}}
  const report=await checkStagingReadonly({cloudflareToken,supabaseToken:process.env.SUPABASE_ACCESS_TOKEN,approvalFilePresent:existsSync(join(base,'ownership-review.json'))});
  console.log(JSON.stringify({...report,cloudflare_credential_state:credentialState,...(credentialState==='OAUTH_EXPIRED_OR_UNVERIFIABLE'?{refresh_existing_connection_command:'npx wrangler whoami'}:{})},null,2));
 }catch{console.error('Read-only check stopped: review the fixed staging scope, request record and existing connection. No operation was performed.');process.exitCode=1;}
}
