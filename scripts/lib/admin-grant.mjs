import {Buffer} from 'node:buffer';
const {AbortSignal}=globalThis;
import {createHash,verify,createPublicKey} from 'node:crypto';
export const STAGING={project_ref:'heaswpawzuuijxurlfoz',account_id:'89dd3e659cece6bdf3181b991a2a0bd2',database_id:'7712d6bb-2414-44d3-9282-cb5b941d740e',worker:'jalisco-auth-staging'};
export const eventSQL='INSERT INTO admin_grant_events(id,action,target_id,project_ref,operator_id,approver_id,approval_ref,approval_sha256,reason,expected_event_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
export const canonical=value=>JSON.stringify(value===null||typeof value!=='object'?value:Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])));
export const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=message=>{throw new Error(message);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export function validateOptions(o,config){
 if(o.config!=='wrangler.staging.jsonc'||config.name!==STAGING.worker||config.account_id!==STAGING.account_id||config.vars?.AUTH_ENVIRONMENT!=='staging'||config.vars?.SUPABASE_URL!==`https://${STAGING.project_ref}.supabase.co`||config.vars?.AUTH_ORIGIN!==`https://${STAGING.worker}.yukikato123123123.workers.dev`||config.d1_databases?.length!==1||config.d1_databases[0].database_id!==STAGING.database_id||config.d1_databases[0].binding!=='DB'||config.env||config.routes||config.route)fail('Only the reviewed staging configuration is supported.');
 if(o.project!==STAGING.project_ref||!uuid(o.user)||!uuid(o.request)||!['grant','revoke'].includes(o.action)||typeof o.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)||!o.reason?.trim()||o.reason.length>500||o.email.length>254||(o.expected!==undefined&&o.expected!=='none'&&!uuid(o.expected)))fail('Provide a staging project, existing UUID/email, request UUID, action and reason.');
 if(o.apply&&(o.offline||!o.approval||o.confirm!==`APPLY ${o.action} ${o.user} ${o.request}`))fail('Apply requires a signed approval and exact explicit confirmation; offline apply is forbidden.');
}
export function verifyApproval(envelope,policy,intent,now){
 if(!policy||canonical(policy.scope)!==canonical(STAGING)||!Array.isArray(policy.approvers))fail('An independently approved staging approval policy is required.');
 const entry=policy.approvers.find(v=>v.id===envelope?.key_id);
 if(!entry||entry.disabled||!entry.public_key)fail('Approval signer is not trusted.');
 const payload=envelope.payload;
 if(!payload||canonical(payload.intent)!==canonical(intent)||typeof payload.approval_ref!=='string'||!payload.approval_ref.trim()||payload.approval_ref.length>200||payload.approval_ref.includes('REPLACE_'))fail('Signed approval does not match this exact operation.');
 const start=Date.parse(payload.issued_at),end=Date.parse(payload.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now+30000||end<=now||end<=start||end-start>3600000)fail('Approval must be current and valid for at most one hour.');
 let valid=false;try{const key=createPublicKey(entry.public_key);valid=key.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(canonical(payload)),key,Buffer.from(envelope.signature??'','base64'));}catch{/* Fail closed without printing material. */}
 if(!valid)fail('Approval signature is invalid.');
 return {approver_id:entry.id,approval_ref:payload.approval_ref,approval_sha256:sha(canonical(envelope))};
}
export async function runGrant(o,{config,policy,approval,gateway,now=()=>Date.now()}){
 validateOptions(o,config);
 if(o.offline)return {mode:'offline-plan',verified:false,changed:false,scope:STAGING,action:o.action,target_id:o.user,request_id:o.request,reason:o.reason,blocked:'No identity, bindings, approval or database verification was performed.'};
 const operator=await gateway.verifyScope();
 if(typeof operator!=='string'||!operator.startsWith('cf-token:'))fail('A verified Cloudflare operator token identity is required.');
 const identity=await gateway.lookupUser(o.user,o.email);
 if(!identity||identity.id!==o.user||identity.email!==o.email)fail('Exactly one matching existing Auth user is required.');
 if(o.action==='grant'&&(!Number.isFinite(Date.parse(identity.email_confirmed_at))||identity.deleted_at||(identity.banned_until&&(!Number.isFinite(Date.parse(identity.banned_until))||Date.parse(identity.banned_until)>now()))))fail('Grant requires a confirmed, non-deleted and non-banned Auth user.');
 const account=await gateway.account(o.user);if(!account?.known)fail('The existing user must sign in and complete application onboarding first.');
 const state=await gateway.state(o.user);
 if(state&&(state.project_ref!==STAGING.project_ref||!state.last_event_id))fail('Legacy or cross-project grant requires separate review.');
 const expected=o.expected===undefined?state?.last_event_id??null:o.expected==='none'?null:o.expected;
 const intent={...STAGING,action:o.action,target_id:o.user,email:o.email,request_id:o.request,reason:o.reason,operator_id:operator,expected_event_id:expected};
 const existing=await gateway.event(o.request);
 if(existing){
  if(existing.action!==o.action||existing.target_id!==o.user||existing.project_ref!==STAGING.project_ref||existing.operator_id!==operator||existing.expected_event_id!==expected||existing.reason!==o.reason)fail('Request ID was already used for a different operation.');
  if(!o.apply)return {mode:'dry-run',verified:true,changed:false,already_recorded:true,intent};
  const signed=verifyApproval(approval,policy,intent,now());
  if(existing.action!==o.action||existing.target_id!==o.user||existing.project_ref!==STAGING.project_ref||existing.operator_id!==operator||existing.expected_event_id!==expected||existing.reason!==o.reason||existing.approval_sha256!==signed.approval_sha256)fail('Request ID was already used for a different operation.');
  return {mode:'apply',changed:false,already_recorded:true,event_id:o.request,current_active:!!state&&state.revoked_at===null,current_event_id:state?.last_event_id??null};
 }
 if(expected!==(state?.last_event_id??null))fail('Grant state changed; prepare a fresh approval.');
 if((o.action==='grant'&&state&&state.revoked_at===null)||(o.action==='revoke'&&(!state||state.revoked_at!==null)))fail('Requested transition is not valid for the current state.');
 if(!o.apply)return {mode:'dry-run',verified:true,changed:false,intent,approval_payload_template:{intent,approval_ref:'REPLACE_WITH_INDEPENDENT_APPROVAL_REFERENCE',issued_at:new Date(now()).toISOString(),expires_at:new Date(now()+1800000).toISOString()}};
 const signed=verifyApproval(approval,policy,intent,now());
 const event={id:o.request,action:o.action,target_id:o.user,project_ref:STAGING.project_ref,operator_id:operator,...signed,reason:o.reason,expected_event_id:expected,created_at:new Date(now()).toISOString()};
 // No retry on an uncertain write. The request ID can be queried or replayed safely.
 try{await gateway.insertEvent(event);}catch{fail('Write outcome is unconfirmed. Inspect the event by request ID and grant state before retrying.');}
 const saved=await gateway.event(o.request);if(!saved||saved.approval_sha256!==event.approval_sha256)fail('Write acknowledgement could not be verified. Inspect the request ID before retrying.');
 return {mode:'apply',changed:true,event_id:o.request,action:o.action,target_id:o.user};
}
export function makeGateway({fetcher,cloudflareToken,supabaseToken}){
 if(!cloudflareToken||!supabaseToken)fail('CLOUDFLARE_API_TOKEN and SUPABASE_ACCESS_TOKEN must be supplied securely in the operator environment.');
 const base=`https://api.cloudflare.com/client/v4/accounts/${STAGING.account_id}`;
 async function request(url,token,method='GET',body){let response;try{response=await fetcher(url,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{fail('Management request failed; no raw provider response is logged.');}if(!response.ok)fail(`Management request rejected (HTTP ${response.status}).`);try{return await response.json();}catch{fail('Management response was malformed.');}}
 async function cf(path,method='GET',body){const result=await request(path.startsWith('https:')?path:base+path,cloudflareToken,method,body);if(result.success!==true)fail('Cloudflare management query was rejected.');return result.result;}
 async function query(sql,params=[]){const result=await cf(`/d1/database/${STAGING.database_id}/query`,'POST',{sql,params});if(!Array.isArray(result)||result.length!==1||result[0].success!==true)fail('D1 query failed.');return result[0].results;}
 return {
  async verifyScope(){const token=await cf('https://api.cloudflare.com/client/v4/user/tokens/verify');if(token.status!=='active'||typeof token.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(token.id))fail('Cloudflare operator token is not active.');const settings=await cf(`/workers/scripts/${STAGING.worker}/settings`);const b=settings.bindings??[];const value=name=>b.find(v=>v.name===name);if(['OWNER_ADMIN_MODE','OWNER_ROOT_PUBLIC_KEY','OWNER_GRANT_ACTIVATION','OWNER_AUTHORITY'].some(name=>value(name)))fail('Owner enrollment is configured remotely; use the epoch-fenced owner-aware gateway. Direct D1 grant execution is disabled.');if(value('DB')?.id!==STAGING.database_id||value('DB')?.type!=='d1'||value('SUPABASE_URL')?.text!==`https://${STAGING.project_ref}.supabase.co`||value('AUTH_ENVIRONMENT')?.text!=='staging'||value('AUTH_ORIGIN')?.text!==`https://${STAGING.worker}.yukikato123123123.workers.dev`)fail('Deployed bindings do not match the reviewed staging scope.');return 'cf-token:'+token.id;},
  async lookupUser(id,email){
   // Values are strictly UUID/email validated; escape single quotes in the email.
   const escaped=email.replaceAll("'","''");const data=await request(`https://api.supabase.com/v1/projects/${STAGING.project_ref}/database/query/read-only`,supabaseToken,'POST',{query:`SELECT id::text,email,email_confirmed_at,banned_until,deleted_at FROM auth.users WHERE id='${id}'::uuid AND email='${escaped}' LIMIT 2`});
   if(!Array.isArray(data)||data.length!==1)fail('Auth lookup must return exactly one matching existing user.');return data[0];
  },
  async account(id){const data=await query('SELECT EXISTS(SELECT 1 FROM auth_users u JOIN profiles p ON p.user_id=u.user_id WHERE u.user_id=?) AS known',[id]);return {known:data?.[0]?.known===1};},
  async state(id){return (await query('SELECT user_id,project_ref,last_event_id,revoked_at FROM admin_grants WHERE user_id=?',[id]))[0]??null;},
  async event(id){return (await query('SELECT * FROM admin_grant_events WHERE id=?',[id]))[0]??null;},
  async insertEvent(e){await query(eventSQL,[e.id,e.action,e.target_id,e.project_ref,e.operator_id,e.approver_id,e.approval_ref,e.approval_sha256,e.reason,e.expected_event_id,e.created_at]);}
 };
}
