import {OWNER_SCOPE,OWNER_ORIGIN,canonical,decode,random,digest,verifySignature,publicRecoveryKey,validatePinVerifier,validatePolicy,checkPin,createPinVerifier} from './crypto.ts';
import type {PinVerifier,ApprovalPolicy} from './crypto.ts';
import {GRANT_PROTOCOL,hexDigest,validateActivation,validateKeyRoles,verifyOperator,verifyTarget,verifyGrant,projectionState,projectCommand} from './grants.ts';
import type {GrantState,GrantIntent,GrantEnvelope,Command,ProjectionDatabase} from './grants.ts';
import {administrator,administratorAction} from '../admin.ts';
import {Failure} from '../provider.ts';
export type RecoveryKey={id:string;public_key:string};
export type BootstrapPayload={operation:'owner_bootstrap';protocol:'owner-pin-key-v1';scope:typeof OWNER_SCOPE;origin:string;owner_id:string;epoch:1;recovery:RecoveryKey;pin:PinVerifier;policy:ApprovalPolicy};
export type SignedBootstrap={payload:BootstrapPayload;signature:string;policy_signature:string};
export type OwnerEnvironment={OWNER_ROOT_PUBLIC_KEY?:string;OWNER_BOOTSTRAP_MANIFEST?:string;OWNER_PIN_PEPPER?:string;OWNER_ADMIN_MODE?:string;OWNER_GRANT_ACTIVATION?:string;OWNER_PREVIOUS_POLICY_SHA256?:string;DB?:ProjectionDatabase};
export interface OwnerStorage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<unknown>;transaction<T>(callback:(tx:OwnerStorage)=>Promise<T>):Promise<T>}
export type OwnerObjectState={storage:OwnerStorage};
type Challenge={id:string;nonce:string;kind:'recover';request_id:string;epoch:number;expires_at:number;used:boolean;next_recovery?:RecoveryKey;next_policy?:ApprovalPolicy};
type OwnerSession={hash:string;epoch:number;expires_at:number};
type Audit={sequence:number;request_id:string;action:string;result:string;actor_id:string;owner_id:string;epoch:number;at:number};
type RecoveryEvent={payload:Record<string,unknown>;signature:string;next_signature:string};
type State={protocol:'owner-pin-key-v1';bootstrap:SignedBootstrap;owner_id:string;epoch:number;recovery:RecoveryKey;pin:PinVerifier;policy:ApprovalPolicy;challenges:Challenge[];sessions:OwnerSession[];attempts:{count:number;reset_at:number};rates:{peer:string;count:number;reset_at:number}[];audit:Audit[];audit_sequence:number;chain:RecoveryEvent[];admin?:GrantState};
class OwnerFailure extends Error{status:number;constructor(status:number){super('Owner request could not be completed.');this.status=status;}}
function fail(status=403):never{throw new OwnerFailure(status);}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export function publicPolicyRoot(p:BootstrapPayload){return {operation:'owner_policy_root',scope:p.scope,origin:p.origin,protocol:p.protocol,owner_id:p.owner_id,epoch:p.epoch,recovery:p.recovery,policy:p.policy};}
const key='owner-authority-pin-key-v1';const ttl=5*60_000;const cookie='__Host-jalisco-owner';
const reply=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
function audit(s:State,id:string,action:string,result:string,now:number,actor?:string){s.audit_sequence++;s.audit.push({sequence:s.audit_sequence,request_id:id,action,result,actor_id:actor??(action==='challenge'?'anonymous':s.recovery.id),owner_id:s.owner_id,epoch:s.epoch,at:now});if(s.audit.length>16)s.audit.shift();}
function intent(s:State,c:Challenge){return {operation:'owner_recovery',protocol:'owner-pin-key-v1',scope:OWNER_SCOPE,origin:OWNER_ORIGIN,owner_id:s.owner_id,expected_epoch:c.epoch,request_id:c.request_id,challenge_id:c.id,nonce:c.nonce,expires_at:c.expires_at,next_recovery:c.next_recovery,next_policy:c.next_policy};}
async function validateRecovery(r:RecoveryKey){if(!r||Object.keys(r).some(k=>!['id','public_key'].includes(k))||!uuid(r.id))fail(400);await publicRecoveryKey(r.public_key);}
// Authority is in a dedicated Durable Object, never in caller-writable D1 tables.
// No bootstrap HTTP endpoint: initialization requires an operator-pinned root and signed manifest.
export class OwnerAuthority {
 private storage:OwnerStorage;private env:OwnerEnvironment;
 constructor(state:OwnerObjectState,env:OwnerEnvironment){this.storage=state.storage;this.env=env;}
 private async initialized():Promise<State>{
  if(!this.env.OWNER_ROOT_PUBLIC_KEY||!this.env.OWNER_BOOTSTRAP_MANIFEST||!this.env.OWNER_PIN_PEPPER||decode(this.env.OWNER_PIN_PEPPER).length!==32)fail(503);
  const existing=await this.storage.get<State>(key);if(existing){if(existing.protocol!=='owner-pin-key-v1')fail(503);if(existing.admin||this.env.OWNER_ADMIN_MODE!==undefined||this.env.OWNER_GRANT_ACTIVATION!==undefined)return this.adminState();return existing;}
  let envelope:SignedBootstrap;try{envelope=JSON.parse(this.env.OWNER_BOOTSTRAP_MANIFEST);}catch{return fail(503);}const p=envelope.payload;if(Object.keys(envelope).some(k=>!['payload','signature','policy_signature'].includes(k))||!p||Object.keys(p).some(k=>!['operation','protocol','scope','origin','owner_id','epoch','recovery','pin','policy'].includes(k)))fail(503);
  if(p?.operation!=='owner_bootstrap'||p.protocol!=='owner-pin-key-v1'||canonical(p.scope)!==canonical(OWNER_SCOPE)||p.origin!==OWNER_ORIGIN||p.epoch!==1||!uuid(p.owner_id)||!await verifySignature(this.env.OWNER_ROOT_PUBLIC_KEY,p,envelope.signature))fail(503);
  if(!await verifySignature(this.env.OWNER_ROOT_PUBLIC_KEY,publicPolicyRoot(p),envelope.policy_signature))fail(503);
  validatePinVerifier(p.pin);await validatePolicy(p.policy);await validateRecovery(p.recovery);
  let admin:GrantState|undefined;
  if(this.env.OWNER_ADMIN_MODE!==undefined||this.env.OWNER_GRANT_ACTIVATION!==undefined){
   if(this.env.OWNER_ADMIN_MODE!==GRANT_PROTOCOL||!this.env.DB)fail(503);
   const activation=await validateActivation(this.env.OWNER_GRANT_ACTIVATION,this.env.OWNER_ROOT_PUBLIC_KEY,envelope,p.owner_id,this.env.OWNER_PREVIOUS_POLICY_SHA256);
   // Separate root/recovery/approval key roles; an approval key cannot enroll itself.
   await validateKeyRoles(this.env.OWNER_ROOT_PUBLIC_KEY,p.recovery.public_key,p.policy);
   admin={activation_sha256:await hexDigest(activation),records:{}};
  }
  return this.storage.transaction(async tx=>{const old=await tx.get<State>(key);if(old)return old;const s:State={protocol:'owner-pin-key-v1',bootstrap:envelope,owner_id:p.owner_id,epoch:1,recovery:p.recovery,pin:p.pin,policy:p.policy,challenges:[],sessions:[],attempts:{count:0,reset_at:0},rates:[],audit:[],audit_sequence:0,chain:[],...(admin?{admin}:{})};audit(s,crypto.randomUUID(),'bootstrap','registered',Date.now());await tx.put('audit:1',s.audit[0]);await tx.put(key,s);return s;});
 }
 private async transact<T>(fn:(s:State,tx:OwnerStorage)=>Promise<T>|T):Promise<T>{return this.storage.transaction(async tx=>{const s=await tx.get<State>(key);if(!s)fail(503);const before=s.audit_sequence;const result=await fn(s,tx);for(const event of s.audit.filter(e=>e.sequence>before))await tx.put('audit:'+event.sequence,event);await tx.put(key,s);return result;});}
 private async issue(body:Record<string,unknown>,peer:string):Promise<unknown>{
  if(body.kind!=='recover'||!uuid(body.request_id))fail(400);const now=Date.now();
  if(body.kind==='recover'){await validateRecovery(body.next_recovery as RecoveryKey);await validatePolicy(body.next_policy as ApprovalPolicy);const current=await this.storage.get<State>(key);if(current?.admin)await validateKeyRoles(this.env.OWNER_ROOT_PUBLIC_KEY!,(body.next_recovery as RecoveryKey).public_key,body.next_policy as ApprovalPolicy);}
  const output=await this.transact(s=>{
   s.rates=s.rates.filter(r=>r.reset_at>now);const rate=s.rates.find(r=>r.peer===peer);if(rate&&rate.count>=10||s.rates.reduce((n,r)=>n+r.count,0)>=60)fail(429);if(rate)rate.count++;else s.rates.push({peer,count:1,reset_at:now+60_000});
   s.challenges=s.challenges.filter(c=>c.expires_at>now);if(s.challenges.length>=16||s.challenges.some(c=>c.request_id===body.request_id)||s.chain.some(e=>e.payload.request_id===body.request_id))fail(409);
   if(body.kind==='recover'&&(s.recovery.id===(body.next_recovery as RecoveryKey).id||s.recovery.public_key===(body.next_recovery as RecoveryKey).public_key||s.policy.approvers.some(p=>(body.next_policy as ApprovalPolicy).approvers.some(n=>n.public_key===p.public_key))))fail(400);
   const c:Challenge={id:crypto.randomUUID(),nonce:random(),kind:body.kind as Challenge['kind'],request_id:body.request_id as string,epoch:s.epoch,expires_at:now+ttl,used:false};if(c.kind==='recover'){c.next_recovery=body.next_recovery as RecoveryKey;c.next_policy=body.next_policy as ApprovalPolicy;}s.challenges.push(c);audit(s,c.request_id,'challenge','issued',now);return {c,s};
  });
  return {challenge_id:output.c.id,intent:intent(output.s,output.c)};
 }
 private async recover(body:Record<string,unknown>):Promise<Response>{
  const snapshot=await this.storage.get<State>(key);if(!snapshot)fail(503);const now=Date.now();const c=snapshot.challenges.find(c=>c.id===body.challenge_id);if(!c||c.kind!=='recover'||c.used||c.epoch!==snapshot.epoch||c.expires_at<=now)fail(409);
  const payload=intent(snapshot,c);
  if(typeof body.signature!=='string'||!await verifySignature(snapshot.recovery.public_key,payload,body.signature)){
   await this.transact(s=>{audit(s,c.request_id,'recover','invalid_proof',now,'unverified');});return fail();
  }
  if(typeof body.next_signature!=='string'||!await verifySignature(c.next_recovery!.public_key,{operation:'accept_recovery_key',payload},body.next_signature))fail();
  // Reserve each signed attempt BEFORE expensive hashing; failed PIN attempts commit.
  await this.transact(s=>{if(s.admin?.pending||s.admin?.access)fail(409);const current=s.challenges.find(x=>x.id===c.id);if(s.epoch!==c.epoch||!current||current.used||current.expires_at<=Date.now())fail(409);if(s.attempts.reset_at<=now)s.attempts={count:0,reset_at:now+86_400_000};if(s.attempts.count>=10)fail(429);current.used=true;s.attempts.count++;audit(s,c.request_id,'recover','reserved',now);});
  let valid=false;try{valid=await checkPin(body.pin as string,snapshot.pin,this.env.OWNER_PIN_PEPPER!,snapshot.owner_id);}catch{/* Never log PIN, responses or key material. */}
  if(!valid){await this.transact(s=>{audit(s,c.request_id,'recover','invalid_proof',now);});return fail();}
  const pin=await createPinVerifier(body.pin as string,this.env.OWNER_PIN_PEPPER!,snapshot.owner_id);
  const token=random(),sessionHash=await digest(token);
  await this.transact(s=>{const current=s.challenges.find(x=>x.id===c.id);if(s.epoch!==c.epoch||!current?.used||c.expires_at<=Date.now()||s.chain.length>=16)fail(409);
   if(s.admin?.pending||s.admin?.access)fail(409);
   s.epoch++;s.recovery=c.next_recovery!;s.policy=c.next_policy!;s.pin=pin;s.sessions=[{hash:sessionHash,epoch:s.epoch,expires_at:Date.now()+600_000}];s.challenges=[];s.attempts={count:0,reset_at:0};s.chain.push({payload,signature:body.signature as string,next_signature:body.next_signature as string});audit(s,c.request_id,'recover','committed',Date.now(),snapshot.recovery.id);
  });
  return reply({ok:true,owner_epoch:snapshot.epoch+1},200,{'Set-Cookie':`${cookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=600`});
 }
 private async adminState():Promise<State>{
  // Read-only prepare/status must never initialize an authority or enroll an activation.
  const s=await this.storage.get<State>(key);
  if(!s?.admin||this.env.OWNER_ADMIN_MODE!==GRANT_PROTOCOL||!this.env.OWNER_ROOT_PUBLIC_KEY||!this.env.DB)fail(503);
  const a=await validateActivation(this.env.OWNER_GRANT_ACTIVATION,this.env.OWNER_ROOT_PUBLIC_KEY,s.bootstrap,s.owner_id,this.env.OWNER_PREVIOUS_POLICY_SHA256);
  if(s.admin.activation_sha256!==await hexDigest(a))fail(503);return s;
 }
 private async prepareGrant(request:Request,body:Record<string,unknown>){
  const s=await this.adminState(),operator=await verifyOperator(request);
  if(s.admin!.pending||s.admin!.access)fail(409);
  const action=body.action;if(!['grant','revoke'].includes(action as string)||!uuid(body.user)||!uuid(body.request)||typeof body.email!=='string'||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)fail(400);
  await verifyTarget(request,body.user,body.email,this.env.DB!,action as string);
  const state=await projectionState(this.env.DB!,body.user),record=s.admin!.records[body.user];
  // Never import a D1-only grant. It requires a separately audited migration decision.
  if(state&&(!record||state.last_event_id!==record.event.id||state.project_ref!==OWNER_SCOPE.project_ref))fail(409);
  if(!state&&record)fail(409);
  const expected=body.expected===undefined?state?.last_event_id??null:body.expected==='none'?null:body.expected;
  if(expected!==(state?.last_event_id??null)||(action==='grant'&&state?.revoked_at===null)||(action==='revoke'&&(!state||state.revoked_at!==null)))fail(409);
  const intent:GrantIntent={...OWNER_SCOPE,protocol:GRANT_PROTOCOL,authority_epoch:s.epoch,policy_sha256:await hexDigest(s.policy),action:action as 'grant'|'revoke',target_id:body.user,email:body.email,request_id:body.request,reason:body.reason,operator_id:operator,expected_event_id:expected as string|null};
  if(await this.storage.get('grant-event:'+body.request)||await this.storage.get('grant-cancelled:'+body.request))fail(409);
  return {mode:'dry-run',verified:true,changed:false,intent,approval_payload_template:{intent,approval_ref:'REPLACE_WITH_INDEPENDENT_APPROVAL_REFERENCE',issued_at:new Date().toISOString(),expires_at:new Date(Date.now()+1800000).toISOString()}};
 }
 private async applyGrant(request:Request,body:Record<string,unknown>){
  const envelope=body.approval as GrantEnvelope,p=envelope?.payload?.intent;
  if(!p||body.confirm!==`APPLY ${p.action} ${p.target_id} ${p.request_id}`)fail(400);
  const s=await this.adminState(),operator=await verifyOperator(request);
  if(p.operator_id!==operator)fail(403);
  const saved=await this.storage.get<Command>('grant-event:'+p.request_id);
  if(saved){if(saved.hash!==await hexDigest(envelope))fail(409);return {mode:'apply',changed:false,already_recorded:true,event_id:saved.id,authority_epoch:s.epoch};}
  // An uncertain projection resumes only the exact persisted command, never a fresh signature.
  const pending=s.admin!.pending;
  if(pending){if(pending.id!==p.request_id||pending.hash!==await hexDigest(envelope))fail(409);return this.finishGrant(pending);}
  const plan=await this.prepareGrant(request,{user:p.target_id,email:p.email,action:p.action,request:p.request_id,reason:p.reason,expected:p.expected_event_id??'none'});
  if(canonical(plan.intent)!==canonical(p))fail(409);
  const signed=await verifyGrant(envelope,s.policy,plan.intent),hash=await hexDigest(envelope);
  const command:Command={id:p.request_id,epoch:s.epoch,hash,envelope,event:{id:p.request_id,action:p.action,target_id:p.target_id,project_ref:p.project_ref,operator_id:operator,...signed,reason:p.reason,expected_event_id:p.expected_event_id,created_at:new Date().toISOString()}};
  await this.transact(async(current,tx)=>{if(current.epoch!==p.authority_epoch||await hexDigest(current.policy)!==p.policy_sha256||current.admin!.pending||current.admin!.access||(current.admin!.records[p.target_id]?.event.id??null)!==p.expected_event_id||await tx.get('grant-event:'+p.request_id)||await tx.get('grant-cancelled:'+p.request_id))fail(409);current.admin!.pending=command;audit(current,p.request_id,'admin_grant','reserved',Date.now(),operator);});
  return this.finishGrant(command);
 }
 private async finishGrant(c:Command){
  await projectCommand(this.env.DB!,c);
  await this.storage.transaction(async tx=>{const s=await tx.get<State>(key);if(!s?.admin||s.epoch!==c.epoch||s.admin.pending?.hash!==c.hash)fail(409);s.admin.records[c.event.target_id]={epoch:c.epoch,event:c.event};delete s.admin.pending;audit(s,c.id,'admin_grant','committed',Date.now(),c.event.operator_id);await tx.put('audit:'+s.audit_sequence,s.audit.at(-1));await tx.put('grant-event:'+c.id,c);await tx.put(key,s);});
  return {mode:'apply',changed:true,event_id:c.id,authority_epoch:c.epoch};
 }
 private async internalAdmin(body:Record<string,unknown>){
  const s=await this.adminState(),id=body.user as string,record=s.admin!.records[id];
  if(s.admin!.pending)fail(503);
  if(s.admin!.access){
   const a=s.admin!.access;if(!a.write||a.user!==id||a.request_sha256!==await hexDigest(body))fail(503);
   return this.finishAction(a);
  }
  const state=await projectionState(this.env.DB!,id);
  const allowed=!!record&&record.epoch===s.epoch&&record.event.action==='grant'&&state?.last_event_id===record.event.id&&state.revoked_at===null&&state.project_ref===OWNER_SCOPE.project_ref;
  if(body.kind==='check')return reply({is_admin:allowed});
  if(!allowed)fail(403);
  const path=body.path as string,method=body.method as string;if(!path?.startsWith('/api/admin/')||!['GET','POST'].includes(method))fail(400);
  if(method==='POST'&&path!=='/api/admin/actions')fail(404);
  const action=method==='POST'?administratorAction(body.body as Record<string,unknown>):undefined;
  const access={id:crypto.randomUUID(),epoch:s.epoch,write:method==='POST',user:id,request_sha256:await hexDigest(body),created_at:new Date().toISOString(),...(action?{action}:{})};
  await this.transact(current=>{if(current.epoch!==s.epoch||current.admin!.pending||current.admin!.access||canonical(current.admin!.records[id])!==canonical(record))fail(409);current.admin!.access=access;audit(current,access.id,'admin_access','reserved',Date.now(),id);});
  if(access.write)return this.finishAction(access);
  try{
   const result=await administrator(this.env.DB!,id,path,method,body.body as Record<string,unknown>,new URLSearchParams(body.query as string),OWNER_SCOPE.project_ref);
   await this.transact(current=>{if(current.admin?.access?.id!==access.id||current.epoch!==access.epoch)fail(503);delete current.admin.access;audit(current,access.id,'admin_access','committed',Date.now(),id);});
   return reply(result);
  }catch(error){
   // Reads cannot mutate D1. Uncertain writes retain the durable barrier for manual review.
   if(!access.write)await this.transact(current=>{if(current.admin?.access?.id===access.id){delete current.admin.access;audit(current,access.id,'admin_access','read_failed',Date.now(),id);}});
   throw error;
  }
 }
 private async finishAction(a:NonNullable<GrantState['access']>){
  if(!a.action)fail(503);const db=this.env.DB!,e={id:a.id,actor_id:a.user,...a.action,created_at:a.created_at,project_ref:OWNER_SCOPE.project_ref};
  // Same immutable audit ID on every reconciliation. Its trigger applies the mutation once.
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO owner_action_receipts(id,request_sha256,outcome) VALUES(?,?,'applied')").bind(a.id,a.request_sha256),
   db.prepare("INSERT INTO admin_audit(id,actor_id,action,target_id,before_state,after_state,reason,created_at,project_ref) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM admin_audit WHERE id=?) AND EXISTS(SELECT 1 FROM owner_action_receipts WHERE id=? AND request_sha256=? AND outcome='applied')").bind(e.id,e.actor_id,e.action,e.target_id,e.before_state,e.after_state,e.reason,e.created_at,e.project_ref,e.id,a.id,a.request_sha256),
  ]);
  const receipt=await db.prepare('SELECT * FROM owner_action_receipts WHERE id=?').bind(a.id).first<{request_sha256:string;outcome:string}>();if(receipt?.outcome!=='applied'||receipt.request_sha256!==a.request_sha256)fail(503);
  const saved=await db.prepare('SELECT * FROM admin_audit WHERE id=?').bind(a.id).first();if(canonical(saved)!==canonical(e))fail(503);
  await this.transact(async(s,tx)=>{if(s.epoch!==a.epoch||s.admin?.access?.id!==a.id)fail(409);delete s.admin.access;audit(s,a.id,'admin_access','committed',Date.now(),a.user);await tx.put('access-event:'+a.id,{outcome:'applied',epoch:a.epoch,request_sha256:a.request_sha256});});
  return reply({ok:true,request_id:a.id});
 }
 private async reconcile(request:Request,body:Record<string,unknown>){
  const operator=await verifyOperator(request),s=await this.adminState();
  if(body.confirm!==`RESOLVE OWNER COMMAND ${body.request}`||!uuid(body.request))fail(400);
  const c=s.admin!.pending,a=s.admin!.access;
  if(c?.id===body.request){
   if(c.event.operator_id!==operator)fail(403);
   if(body.action==='resume')return this.finishGrant(c);
   if(body.action!=='cancel')fail(400);
   await this.env.DB!.prepare("INSERT OR IGNORE INTO owner_command_receipts(id,epoch,command_sha256,approval_sha256,outcome) VALUES(?,?,?,?,'cancelled')").bind(c.id,c.epoch,c.hash,c.event.approval_sha256).run();
   const receipt=await this.env.DB!.prepare('SELECT * FROM owner_command_receipts WHERE id=?').bind(c.id).first<{outcome:string;command_sha256:string;epoch:number}>();
   if(receipt?.outcome==='applied')return this.finishGrant(c);
   if(receipt?.outcome!=='cancelled'||receipt.command_sha256!==c.hash||receipt.epoch!==c.epoch)fail(503);
   await this.storage.transaction(async tx=>{const current=await tx.get<State>(key);if(current?.admin?.pending?.hash!==c.hash)fail(409);delete current.admin.pending;audit(current,c.id,'admin_grant','cancelled',Date.now(),operator);await tx.put('audit:'+current.audit_sequence,current.audit.at(-1));await tx.put('grant-cancelled:'+c.id,c.hash);await tx.put(key,current);});
   return {cancelled:true,request_id:c.id};
  }
  if(a?.id!==body.request)fail(409);
  if(body.action==='resume'&&a.write)return (await this.finishAction(a)).json();
  if(body.action!=='cancel')fail(400);
  if(a.write){
   await this.env.DB!.prepare("INSERT OR IGNORE INTO owner_action_receipts(id,request_sha256,outcome) VALUES(?,?,'cancelled')").bind(a.id,a.request_sha256).run();
   const receipt=await this.env.DB!.prepare('SELECT * FROM owner_action_receipts WHERE id=?').bind(a.id).first<{outcome:string;request_sha256:string}>();
   if(receipt?.outcome==='applied')return (await this.finishAction(a)).json();
   if(receipt?.outcome!=='cancelled'||receipt.request_sha256!==a.request_sha256)fail(503);
  }
  await this.transact(async(current,tx)=>{if(current.admin?.access?.id!==a.id)fail(409);delete current.admin.access;audit(current,a.id,'admin_access','cancelled',Date.now(),operator);await tx.put('access-event:'+a.id,{outcome:'cancelled',epoch:a.epoch,request_sha256:a.request_sha256});});
  return {cancelled:true,request_id:a.id};
 }
 async fetch(request:Request):Promise<Response>{
  try{
   const url=new URL(request.url);if(url.origin!==OWNER_ORIGIN)fail(403);
   // Only Worker service-binding calls reach this path; the public router rejects it.
   if(url.pathname==='/internal/admin'&&request.method==='POST')return await this.internalAdmin(await request.json() as Record<string,unknown>);
   const grantRoute=url.pathname.startsWith('/api/owner/admin-grants/');
   if(grantRoute||url.pathname==='/api/owner/policy/current'&&this.env.OWNER_ADMIN_MODE!==undefined)await this.adminState();else await this.initialized();
   if(request.method==='GET'&&['/api/owner/policy/current','/api/owner/admin-grants/policy'].includes(url.pathname)){const s=await this.storage.get<State>(key);return reply({root:{payload:publicPolicyRoot(s!.bootstrap.payload),signature:s!.bootstrap.policy_signature},chain:s!.chain,epoch:s!.epoch,policy:s!.policy,...(s!.admin?{activation:JSON.parse(this.env.OWNER_GRANT_ACTIVATION??'null')}:{})});}
   if(request.method==='GET'&&url.pathname==='/api/owner/session'){
    const token=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))fail(401);const hash=await digest(token),s=await this.storage.get<State>(key);if(!s!.sessions.some(x=>x.hash===hash&&x.epoch===s!.epoch&&x.expires_at>Date.now()))fail(401);return reply({owner_id:s!.owner_id,owner_epoch:s!.epoch,role:'owner'});
   }
   if(request.method!=='POST')fail(405);if(request.headers.get('Origin')!==OWNER_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site'||!request.headers.get('Content-Type')?.startsWith('application/json'))fail(403);
   // Count bytes while streaming, before parsing attacker-controlled input.
   const reader=request.body?.getReader();let data='';let size=0;const decoder=new TextDecoder();if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>32768){await reader.cancel();fail(413);}data+=decoder.decode(chunk.value,{stream:true});}data+=decoder.decode();let body:Record<string,unknown>;try{body=JSON.parse(data);if(!body||typeof body!=='object'||Array.isArray(body))fail(400);}catch{return fail(400);}
   if(url.pathname==='/api/owner/admin-grants/prepare')return reply(await this.prepareGrant(request,body));
   if(url.pathname==='/api/owner/admin-grants/apply')return reply(await this.applyGrant(request,body));
   if(url.pathname==='/api/owner/admin-grants/reconcile')return reply(await this.reconcile(request,body));
   if(url.pathname==='/api/owner/admin-grants/status'){
    await verifyOperator(request);if(!uuid(body.request))fail(400);const s=await this.adminState(),saved=await this.storage.get<Command>('grant-event:'+body.request);
    return reply({request_id:body.request,recorded:!!saved,cancelled:!!await this.storage.get('grant-cancelled:'+body.request),access_result:await this.storage.get('access-event:'+body.request)??null,pending:s.admin!.pending?.id===body.request,blocking_request_id:s.admin!.pending?.id??null,blocked_by_access:s.admin!.access?{id:s.admin!.access.id,epoch:s.admin!.access.epoch,write:s.admin!.access.write}:null,authority_epoch:s.epoch});
   }
   if(url.pathname==='/api/owner/challenge')return reply(await this.issue(body,await digest(request.headers.get('CF-Connecting-IP')??'local')));
   if(url.pathname==='/api/owner/recover')return await this.recover(body);
   fail(404);
  }catch(e){return reply({error:'Owner request could not be completed.'},e instanceof OwnerFailure||e instanceof Failure?e.status:503);}
 }
}
