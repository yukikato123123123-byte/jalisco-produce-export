import {paginateAdmin} from './adminPagination.ts';
import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {nopalProduct,nopalRitual,nopalOrigin} from '../src/nopalContent.ts';
// Private read models only: administrator() performs the unchanged grant check first.
// Materialize the existing platform ledger before combining brand receipts; hosted D1
// rejects a single flat six-source compound SELECT even though local SQLite accepts it.
const activity=`WITH platform_activity AS MATERIALIZED (SELECT 'platform:'||id AS id,actor_id,action,target_id,after_state AS result,reason AS note,created_at,'platform' AS source FROM admin_audit WHERE project_ref=?
 UNION ALL SELECT 'draft:'||id,actor_id,action,target_id,CASE WHEN action='draft_delete' THEN 'deleted' ELSE 'draft' END,reason,created_at,'platform' FROM admin_draft_events WHERE project_ref=?
 UNION ALL SELECT 'inquiry:'||id,actor_id,'inquiry_'||action,inquiry_id,after_state,reason,created_at,'platform' FROM inquiry_workflow WHERE project_ref=?
 UNION ALL SELECT 'registration:'||id,actor_id,kind||'_review',target_id,after_state,reason,created_at,'platform' FROM registration_review_events WHERE project_ref=? UNION ALL SELECT 'research:'||id,actor_id,action,target,CASE WHEN action='research_grant' THEN 'allowed' ELSE 'revoked' END,reason,created_at,'research' FROM research_access_events WHERE project_ref=?) SELECT * FROM platform_activity
 UNION ALL SELECT 'feedback:'||id,actor_id,CASE WHEN action='received' THEN 'feedback_received' WHEN before_state=after_state THEN 'feedback_note' ELSE 'feedback_status' END,feedback_id,after_state,note,created_at,'feedback' FROM nopal_feedback_events WHERE action='received' OR project_ref=?
 UNION ALL SELECT 'launch:'||id,NULL,'launch_requested',subscription_id,'requested','',created_at,'launch' FROM nopal_launch_events`;
const refs=(project:string)=>Array(6).fill(project);
async function activityPage(db:Database,params:URLSearchParams,project:string){const {page,q,status,from,to}=filters(params),source=params.get('source')??'';if(status||(source&&!['feedback','launch','platform','research'].includes(source)))throw new Failure(400,'Choose a valid activity source.');return paginateAdmin(db,`SELECT json_object('id',id,'actor_id',actor_id,'action',action,'target_id',target_id,'state',result,'result',result,'note',note,'created_at',created_at,'source',source) AS row FROM (${activity}) WHERE (?='' OR source=?) AND instr(lower(COALESCE(actor_id,'')||' '||target_id||' '||action),lower(?))>0 AND (?='' OR date(created_at)>=?) AND (?='' OR date(created_at)<=?)`,[...refs(project),source,source,q,from,from,to,to],"json_extract(row,'$.created_at') DESC,json_extract(row,'$.id') DESC",page);}
function filters(params:URLSearchParams){const raw=params.get('page')??'1',q=params.get('q')??'',status=params.get('status')??'',from=params.get('from')??'',to=params.get('to')??'';const date=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;if(!/^[1-9][0-9]{0,5}$/.test(raw)||q.length>120||!date(from)||!date(to)||(from&&to&&from>to))throw new Failure(400,'Choose valid operations filters.');return {page:Number(raw),q,status,from,to};}
async function readOperations(db:Database,section:string,method:string,params:URLSearchParams,project:string){
 if(method!=='GET')throw new Failure(405,'These operations are read-only.');
 if(section==='concept-product')return {content:nopalProduct,source:'src/nopalContent.ts',read_only:true};
 if(section==='ritual')return {content:nopalRitual,source:'src/nopalContent.ts',read_only:true};
 if(section==='origin')return {content:nopalOrigin,source:'src/nopalContent.ts',read_only:true};
 if(section==='settings')return {preference_scope:'browser',email_service:'not_configured'};
 if(section==='operations-overview'){
  const result=await db.prepare("SELECT json_object('responses',(SELECT count(*) FROM research_responses WHERE project_ref=?),'research_access',(SELECT count(*) FROM research_access WHERE project_ref=? AND state='allowed'),'customer_feedback',(SELECT count(*) FROM nopal_feedback),'launch_list',(SELECT count(*) FROM nopal_launch_subscriptions)) AS data").bind(project,project).first<{data:string}>();if(!result)throw new Failure(503,'Brand operations data is unavailable.');
  const {items:recent,...recentPagination}=await activityPage(db,params,project);return {counts:JSON.parse(result.data),email_service:'not_configured',recent,recentPagination};
 }
 const {page,q,status,from,to}=filters(params);
 if(section==='launch-list'){
  if(status&&status!=='requested')throw new Failure(400,'Choose a valid launch request status.');
  const result=await paginateAdmin(db,"SELECT json_object('id',id,'email',email,'created_at',consented_at,'language',language,'state',status,'consent_version',consent_version,'email_verified',email_verified,'duplicate_policy','unique_email') AS row FROM nopal_launch_subscriptions WHERE instr(email,lower(?))>0 AND (?='' OR status=?) AND (?='' OR date(consented_at)>=?) AND (?='' OR date(consented_at)<=?)",[q,status,status,from,from,to,to],"json_extract(row,'$.created_at') DESC,json_extract(row,'$.id')",page);return {...result,email_service:'not_configured'};
 }
 if(section==='activity-log')return activityPage(db,params,project);
 throw new Failure(404,'Endpoint not found.');
}

export async function operationsRead(db:Database,section:string,method:string,params:URLSearchParams,project:string){try{return await readOperations(db,section,method,params,project);}catch(error){if(error instanceof Failure)throw error;throw new Failure(503,'Brand operations data is unavailable.');}}
