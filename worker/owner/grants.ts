// Versioned, opt-in owner approval protocol. No bootstrap, key generation or D1 credentials.
import {OWNER_SCOPE,OWNER_ORIGIN,canonical,bytes,verifySignature,validatePolicy} from './crypto.ts';
import type {ApprovalPolicy} from './crypto.ts';
import type {Database,Statement} from '../authState.ts';
import {Failure} from '../provider.ts';

export const GRANT_PROTOCOL='owner-admin-grants-v1';
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export async function hexDigest(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(canonical(value)))),b=>b.toString(16).padStart(2,'0')).join('');}
function reject(status=403):never{throw new Failure(status,'Owner administrator gateway rejected the request.');}
export interface ProjectionDatabase extends Database {batch(statements:Statement[]):Promise<unknown>}
export type GrantIntent=typeof OWNER_SCOPE & {protocol:typeof GRANT_PROTOCOL;authority_epoch:number;policy_sha256:string;action:'grant'|'revoke';target_id:string;email:string;request_id:string;reason:string;operator_id:string;expected_event_id:string|null};
export type GrantEnvelope={key_id:string;payload:{intent:GrantIntent;approval_ref:string;issued_at:string;expires_at:string};signature:string};
export type GrantEvent={id:string;action:'grant'|'revoke';target_id:string;project_ref:string;operator_id:string;approver_id:string;approval_ref:string;approval_sha256:string;reason:string;expected_event_id:string|null;created_at:string};
export type Command={id:string;epoch:number;hash:string;event:GrantEvent;envelope:GrantEnvelope};
export type GrantRecord={epoch:number;event:GrantEvent};
export type Access={id:string;epoch:number;write:boolean;user:string;request_sha256:string;action?:{action:string;target_id:string;before_state:string;after_state:string;reason:string};created_at:string};
export type GrantState={activation_sha256:string;records:Record<string,GrantRecord>;pending?:Command;access?:Access};
export type Activation={payload:{operation:'activate_owner_admin_gateway';protocol:typeof GRANT_PROTOCOL;scope:typeof OWNER_SCOPE;origin:string;owner_id:string;bootstrap_sha256:string;previous_policy_sha256:string;capabilities:string[]};signature:string;recovery_signature:string;approval_signatures:{key_id:string;signature:string}[]};
export const capabilities=['admin_action','admin_read','grant','revoke','rotate_policy'];
export async function validateKeyRoles(root:string,recovery:string,policy:ApprovalPolicy){
 const seen=new Set([root,recovery]);if(seen.size!==2)reject(503);
 for(const entry of policy.approvers){const der=Uint8Array.from(atob(entry.public_key.replace(/-----[^\n]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));const pub=await crypto.subtle.importKey('spki',der,'Ed25519',true,['verify']);const jwk=await crypto.subtle.exportKey('jwk',pub);if(!jwk.x||seen.has(jwk.x))reject(503);seen.add(jwk.x);}
}
export async function validateActivation(raw:string|undefined,root:string,bootstrap:unknown,ownerId:string,previous:string|undefined):Promise<Activation>{
 let a:Activation;try{a=JSON.parse(raw??'');}catch{return reject(503);}
 const p=a?.payload;
 if(!p||Object.keys(a).sort().join(',')!=='approval_signatures,payload,recovery_signature,signature'||Object.keys(p).sort().join(',')!=='bootstrap_sha256,capabilities,operation,origin,owner_id,previous_policy_sha256,protocol,scope'||p.operation!=='activate_owner_admin_gateway'||p.protocol!==GRANT_PROTOCOL||canonical(p.scope)!==canonical(OWNER_SCOPE)||p.origin!==OWNER_ORIGIN||p.owner_id!==ownerId||!previous||!/^[a-f0-9]{64}$/.test(previous)||p.previous_policy_sha256!==previous||p.bootstrap_sha256!==await hexDigest(bootstrap)||canonical(p.capabilities)!==canonical(capabilities)||!await verifySignature(root,p,a.signature))reject(503);
 const b=bootstrap as {payload:{recovery:{public_key:string};policy:ApprovalPolicy}};
 if(!await verifySignature(b.payload.recovery.public_key,{operation:'accept_owner_admin_activation',role:'recovery',activation:p},a.recovery_signature)||!Array.isArray(a.approval_signatures)||a.approval_signatures.length!==b.payload.policy.approvers.length)reject(503);
 for(const entry of b.payload.policy.approvers){const der=Uint8Array.from(atob(entry.public_key.replace(/-----[^\n]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));const pub=await crypto.subtle.importKey('spki',der,'Ed25519',true,['verify']);const jwk=await crypto.subtle.exportKey('jwk',pub);const signature=a.approval_signatures.find(x=>x.key_id===entry.id)?.signature;if(!signature||!await verifySignature(jwk.x!,{operation:'accept_owner_admin_activation',role:'approver',activation:p},signature))reject(503);}
 return a;
}
export async function verifyGrant(envelope:GrantEnvelope,policy:ApprovalPolicy,intent:GrantIntent,now=Date.now()){
 await validatePolicy(policy);
 const p=envelope?.payload,entry=policy.approvers.find(x=>x.id===envelope?.key_id&&!x.disabled);
 if(!entry||!p||Object.keys(envelope).sort().join(',')!=='key_id,payload,signature'||Object.keys(p).sort().join(',')!=='approval_ref,expires_at,intent,issued_at'||canonical(p.intent)!==canonical(intent)||typeof p.approval_ref!=='string'||!p.approval_ref.trim()||p.approval_ref.length>200||p.approval_ref.includes('REPLACE_'))reject();
 const start=Date.parse(p.issued_at),end=Date.parse(p.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now+30000||end<=now||end<=start||end-start>3600000)reject();
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature))reject();
 const der=Uint8Array.from(atob(entry.public_key.replace(/-----[^\n]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('spki',der,'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(envelope.signature),c=>c.charCodeAt(0)),bytes(canonical(p))))reject();
 return {approver_id:entry.id,approval_ref:p.approval_ref,approval_sha256:await hexDigest(envelope)};
}

// Every endpoint is fixed and redirect-free; never return provider bodies or credentials.
export async function verifyOperator(request:Request,fetcher:typeof fetch=fetch):Promise<string>{
 const bearer=request.headers.get('Authorization');if(!bearer?.startsWith('Bearer ')||bearer.length>4096)reject(401);
 async function cf(path:string){const r=await fetcher('https://api.cloudflare.com/client/v4/'+path,{headers:{Authorization:bearer!},redirect:'manual',signal:AbortSignal.timeout(20000)});if(!r.ok)reject();const j=await r.json() as {success:boolean;result:Record<string,unknown>};if(!j.success)reject();return j.result;}
 const token=await cf('user/tokens/verify');if(token.status!=='active'||typeof token.id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(token.id))reject();
 const settings=await cf(`accounts/${OWNER_SCOPE.account_id}/workers/scripts/${OWNER_SCOPE.worker}/settings`);
 const b=settings.bindings as {name:string;type:string;id?:string;text?:string}[];if(!Array.isArray(b))reject();
 const v=(name:string)=>b.find(x=>x.name===name);
 if(v('DB')?.id!==OWNER_SCOPE.database_id||v('DB')?.type!=='d1'||v('AUTH_ENVIRONMENT')?.text!=='staging'||v('AUTH_ORIGIN')?.text!==OWNER_ORIGIN||v('SUPABASE_URL')?.text!==`https://${OWNER_SCOPE.project_ref}.supabase.co`||v('OWNER_ADMIN_MODE')?.text!==GRANT_PROTOCOL)reject();
 return 'cf-token:'+token.id;
}
export async function verifyTarget(request:Request,id:string,email:string,db:Database,action:string,fetcher:typeof fetch=fetch){
 if(!uuid(id)||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))reject(400);
 const token=request.headers.get('X-Supabase-Management-Token');if(!token||token.length>4096)reject(401);
 const query=`SELECT id::text,email,email_confirmed_at,banned_until,deleted_at FROM auth.users WHERE id='${id}'::uuid AND email='${email.replaceAll("'","''")}' LIMIT 2`;
 const r=await fetcher(`https://api.supabase.com/v1/projects/${OWNER_SCOPE.project_ref}/database/query/read-only`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),redirect:'manual',signal:AbortSignal.timeout(20000)});if(!r.ok)reject();
 const users=await r.json() as {id:string;email:string;email_confirmed_at:string;deleted_at:string|null;banned_until:string|null}[];
 if(!Array.isArray(users)||users.length!==1||users[0].id!==id||users[0].email!==email)reject();
 const u=users[0];if(action==='grant'&&(!Number.isFinite(Date.parse(u.email_confirmed_at))||u.deleted_at||u.banned_until&&(!Number.isFinite(Date.parse(u.banned_until))||Date.parse(u.banned_until)>Date.now())))reject();
 const account=await db.prepare('SELECT u.user_id FROM auth_users u JOIN profiles p ON p.user_id=u.user_id WHERE u.user_id=?').bind(id).first();if(!account)reject();
}
export async function projectionState(db:Database,id:string){return db.prepare('SELECT user_id,project_ref,last_event_id,revoked_at FROM admin_grants WHERE user_id=?').bind(id).first<{user_id:string;project_ref:string;last_event_id:string;revoked_at:string|null}>();}
export async function projectCommand(db:ProjectionDatabase,c:Command){
 const e=c.event;
 // Idempotent batch: receipt, immutable grant event and projection commit together.
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO owner_command_receipts(id,epoch,command_sha256,approval_sha256,outcome) VALUES(?,?,?,?,'applied')").bind(c.id,c.epoch,c.hash,e.approval_sha256),
  db.prepare("INSERT INTO admin_grant_events(id,action,target_id,project_ref,operator_id,approver_id,approval_ref,approval_sha256,reason,expected_event_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM admin_grant_events WHERE id=?) AND EXISTS(SELECT 1 FROM owner_command_receipts WHERE id=? AND command_sha256=? AND epoch=? AND outcome='applied')").bind(e.id,e.action,e.target_id,e.project_ref,e.operator_id,e.approver_id,e.approval_ref,e.approval_sha256,e.reason,e.expected_event_id,e.created_at,e.id,c.id,c.hash,c.epoch),
 ]);
 const receipt=await db.prepare('SELECT * FROM owner_command_receipts WHERE id=?').bind(c.id).first<{id:string;epoch:number;command_sha256:string;approval_sha256:string;outcome:string}>();
 const event=await db.prepare('SELECT * FROM admin_grant_events WHERE id=?').bind(c.id).first<GrantEvent>();
 if(!receipt||receipt.outcome!=='applied'||receipt.epoch!==c.epoch||receipt.command_sha256!==c.hash||receipt.approval_sha256!==e.approval_sha256||canonical(event)!==canonical(e))reject(503);
 const state=await projectionState(db,e.target_id);if(state?.last_event_id!==e.id||state.project_ref!==e.project_ref||(state.revoked_at===null)!==(e.action==='grant'))reject(503);
}
