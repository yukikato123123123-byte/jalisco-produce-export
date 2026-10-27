import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {hasAdministratorGrant} from './admin.ts';
import {adminPage,paginateAdmin} from './adminPagination.ts';
import {researchAdmin} from './research.ts';
type AuthUser={id:string;email:string;created_at?:string;email_confirmed_at?:string|null;user_metadata?:Record<string,unknown>;identities?:unknown[]};
type Environment={DB:Database;SUPABASE_URL:string;SUPABASE_STORAGE_SERVICE_ROLE_KEY?:string};
export class ResearchAccountFailure extends Failure {
 readonly verificationStatus:number;
 readonly verificationReason:string;
 constructor(status:number,reason='upstream_rejected'){super(503,'Research account verification is unavailable.');this.verificationStatus=status;this.verificationReason=reason;}
}
const address=(v:unknown)=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v.trim().toLowerCase():null;
export async function recordApplicant(db:Database,user:AuthUser,project:string,source:'signup'|'self'|'administrator',actor:string){
 const email=address(user.email);if(!email||typeof user.id!=='string'||!user.id||user.id.length>80)throw new Failure(503,'Research application could not be saved. Sign in and retry your application.');
 await db.prepare("INSERT INTO research_applicants(user_id,project_ref,email,auth_created_at,email_confirmed_at,requested_at,source,recorded_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,email_confirmed_at=excluded.email_confirmed_at WHERE research_applicants.project_ref=excluded.project_ref").bind(user.id,project,email,user.created_at&&Number.isFinite(Date.parse(user.created_at))?user.created_at:null,user.email_confirmed_at||null,new Date().toISOString(),source,actor).run();
}
export async function recordSignupApplicant(env:Environment,payload:Record<string,unknown>){
 const user=(payload.user||payload) as AuthUser;
 // GoTrue may return obfuscated users with empty identities for duplicate signup.
 if(!user.id||!user.email||Array.isArray(user.identities)&&user.identities.length===0)return;
 await recordApplicant(env.DB,user,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''),'signup',user.id);
}
async function authAdmin(env:Environment,path:string){
 if(!env.SUPABASE_STORAGE_SERVICE_ROLE_KEY)throw new ResearchAccountFailure(0,'credential_missing');
 let headers:Headers;
 try{headers=new Headers({apikey:env.SUPABASE_STORAGE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_STORAGE_SERVICE_ROLE_KEY});}catch{throw new ResearchAccountFailure(0,'credential_header_invalid');}
 let status=0;
 try{
  const r=await fetch(env.SUPABASE_URL+'/auth/v1/admin/'+path,{headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
  status=r.status;if(!r.ok)throw new ResearchAccountFailure(status);return await r.json();
 }catch(error){if(error instanceof ResearchAccountFailure)throw error;throw new ResearchAccountFailure(status,status?'invalid_response':error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'transport_timeout':'transport_error');}
}
export async function applicantsAdmin(env:Environment,actor:string,project:string,method:string,body:Record<string,unknown>,params:URLSearchParams){
 if(!await hasAdministratorGrant(env.DB,actor,project))throw new Failure(403,'Administrator access is not configured for this account. A trusted owner grant is required.');
 if(method==='POST'){
  if(body.action==='register_existing'){
   const email=address(body.email);if(!email)throw new Failure(400,'Enter a valid email address.');
   // Explicit administrator intent, not automatic classification of every Auth account.
   for(let page=1;page<=25;page++){
    const data=await authAdmin(env,'users?page='+page+'&per_page=100');const users=data.users as AuthUser[];
    if(!Array.isArray(users))throw new Failure(503,'Research account verification is unavailable.');
    const match=users.find(u=>address(u.email)===email);
    if(match){await recordApplicant(env.DB,match,project,'administrator',actor);return {ok:true};}
    if(users.length<100)throw new Failure(404,'No existing account was found.');
   }
   throw new Failure(503,'Research account verification is unavailable.');
  }
  if(!['research_grant','research_revoke'].includes(String(body.action))||typeof body.user_id!=='string')throw new Failure(400,'Check the research permission fields.');
  const applicant=await env.DB.prepare('SELECT email FROM research_applicants WHERE user_id=? AND project_ref=?').bind(body.user_id,project).first<{email:string}>();
  if(!applicant)throw new Failure(404,'Research applicant not found.');
  const live=await authAdmin(env,'users/'+encodeURIComponent(body.user_id)) as AuthUser;
  if(live.id!==body.user_id||address(live.email)!==applicant.email)throw new Failure(409,'Research account identity changed. Review before retrying.');
  if(typeof body.reason!=='string'||!body.reason.trim())throw new Failure(400,'Check the research permission fields.');
  const userAccess=await env.DB.prepare('SELECT last_event_id,state FROM research_access WHERE target=? AND project_ref=?').bind('user:'+body.user_id,project).first<{last_event_id:string;state:string}>();
  const emailAccess=await env.DB.prepare('SELECT state FROM research_access WHERE target=? AND project_ref=?').bind('email:'+applicant.email,project).first<{state:string}>();
  if(userAccess&&emailAccess?.state==='allowed')throw new Failure(409,'Multiple research permissions exist. Review Research Access before changing this applicant.');
  return researchAdmin(env.DB,actor,project,'/api/admin/research-access','POST',{...body,target:userAccess?'user:'+body.user_id:'email:'+applicant.email,results:false},params);
 }
 if(method!=='GET')throw new Failure(405,'Method not allowed.');
 const q=params.get('q')||'',status=params.get('status')||'';
 if(q.length>254||!['','pending','approved','rejected'].includes(status))throw new Failure(400,'Choose valid research filters.');
 const query="SELECT json_object('id',u.user_id,'email',u.email,'auth_created_at',u.auth_created_at,'email_confirmed',CASE WHEN u.email_confirmed_at IS NULL THEN 0 ELSE 1 END,'requested_at',u.requested_at,'status',CASE WHEN EXISTS(SELECT 1 FROM research_access x WHERE x.project_ref=u.project_ref AND x.state='allowed' AND x.target IN ('user:'||u.user_id,'email:'||u.email)) THEN 'approved' WHEN a.state='revoked' THEN 'rejected' ELSE 'pending' END,'access_state',CASE WHEN EXISTS(SELECT 1 FROM research_access x WHERE x.project_ref=u.project_ref AND x.state='allowed' AND x.target IN ('user:'||u.user_id,'email:'||u.email)) THEN 'allowed' ELSE COALESCE(a.state,'pending') END,'submitted',EXISTS(SELECT 1 FROM research_responses r WHERE r.user_id=u.user_id AND r.project_ref=u.project_ref),'processed_at',a.updated_at,'expected_event_id',a.last_event_id) AS row FROM research_applicants u LEFT JOIN research_access a ON a.project_ref=u.project_ref AND a.target=COALESCE((SELECT x.target FROM research_access x WHERE x.project_ref=u.project_ref AND x.target='user:'||u.user_id),'email:'||u.email) WHERE u.project_ref=? AND instr(lower(u.email),lower(?))>0";
 const filtered='SELECT row FROM ('+query+") WHERE (?='' OR json_extract(row,'$.status')=?)";
 const page=await paginateAdmin(env.DB,filtered,[project,q,status,status],"json_extract(row,'$.requested_at') DESC,json_extract(row,'$.id')",adminPage(params));
 // Refresh only the ten selected subjects. Never send the Auth user list to the browser.
 page.items=await Promise.all(page.items.map(async row=>{const user=await authAdmin(env,'users/'+encodeURIComponent(row.id)) as AuthUser;if(user.id!==row.id||address(user.email)!==row.email)throw new Failure(409,'Research account identity changed. Review before retrying.');return {...row,email_confirmed:user.email_confirmed_at?1:0,auth_created_at:user.created_at||row.auth_created_at};}));
 return page;
}
