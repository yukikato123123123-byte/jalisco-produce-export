import {QUESTIONNAIRE_VERSION,normalizedSurveyAnswers,surveyQuestions} from '../shared/researchSurvey.ts';
import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {adminPage,paginateAdmin} from './adminPagination.ts';
export async function researchPermission(db:Database,user:{id:string;email:string},project:string,results=false){
 // Bind a verified email permission to its first provider subject; later email reuse
 // cannot transfer permission. Every protected request rechecks the current grant.
 await db.prepare("UPDATE research_access SET bound_user_id=? WHERE target=? AND project_ref=? AND state='allowed' AND bound_user_id IS NULL").bind(user.id,'email:'+user.email.trim().toLowerCase(),project).run();
 const row=await db.prepare("SELECT target FROM research_access WHERE project_ref=? AND state='allowed' AND (?=0 OR results=1) AND (target=? OR (target=? AND bound_user_id=?)) LIMIT 1").bind(project,results?1:0,'user:'+user.id,'email:'+user.email.trim().toLowerCase(),user.id).first();
 if(!row)throw new Failure(403,'Research access is not available for this account.');
}
export async function researchAggregate(db:Database,project:string){const row=await db.prepare("SELECT json_object('total',count(*),'interest',json(COALESCE((SELECT json_group_array(json_object('value',interest,'count',n)) FROM (SELECT interest,count(*) n FROM research_responses WHERE project_ref=? GROUP BY interest)), '[]')),'clarity',json(COALESCE((SELECT json_group_array(json_object('value',clarity,'count',n)) FROM (SELECT clarity,count(*) n FROM research_responses WHERE project_ref=? GROUP BY clarity)), '[]')),'preference',json(COALESCE((SELECT json_group_array(json_object('value',preference,'count',n)) FROM (SELECT preference,count(*) n FROM research_responses WHERE project_ref=? GROUP BY preference)), '[]'))) AS data FROM research_responses WHERE project_ref=?").bind(project,project,project,project).first<{data:string}>();if(!row)throw new Failure(503,'Research data is unavailable.');return JSON.parse(row.data);}
export async function researchSubmit(db:Database,user:{id:string;email:string},project:string,body:Record<string,unknown>){
 const extended=body.questionnaireVersion===QUESTIONNAIRE_VERSION;
 if(body.questionnaireVersion!==undefined&&!extended&&body.questionnaireVersion!=='legacy-v1')throw new Failure(400,'Check the research answers and consent.');
 const answers=extended?normalizedSurveyAnswers(body):null;
 if(extended&&!answers||!extended&&surveyQuestions.some(q=>!['interest','clarity','preference','comment'].includes(q.key)&&q.key in body))throw new Failure(400,'Check the research answers and consent.');
 if(extended)body={...body,...answers};
 if(!Number.isInteger(body.interest)||Number(body.interest)<1||Number(body.interest)>5||!Number.isInteger(body.clarity)||Number(body.clarity)<1||Number(body.clarity)>5||!['powder','liquid','unsure'].includes(String(body.preference))||typeof body.comment!=='string'||body.comment.length>500||!['en','es'].includes(String(body.language))||body.consent!==true||body.consentVersion!=='nopahua-research-v1')throw new Failure(400,'Check the research answers and consent.');
 try{const row=await db.prepare("INSERT INTO research_responses(id,user_id,project_ref,interest,clarity,preference,comment,language,consent_version,created_at,questionnaire_version,answers_json) VALUES(?,?,?,?,?,?,?,?,'nopahua-research-v1',?,?,?) ON CONFLICT(user_id) DO NOTHING RETURNING id").bind(crypto.randomUUID(),user.id,project,body.interest,body.clarity,body.preference,body.comment.trim(),body.language,new Date().toISOString(),extended?QUESTIONNAIRE_VERSION:'legacy-v1',extended?JSON.stringify(answers):null).first();return {saved:true,alreadySubmitted:!row};}catch{throw new Failure(409,'Research submission could not be confirmed. Refresh your access before retrying.');}
}
// Both sources are immutable. Legacy records only contribute answers actually asked.
const responseSource=`SELECT id,project_ref,interest,clarity,preference,comment,language,created_at,questionnaire_version,
 COALESCE(answers_json,json_object('interest',interest,'clarity',clarity,'preference',preference,'comment',comment)) AS answer_data,answers_json,CASE WHEN comment LIKE 'STAGING VERIFICATION%' AND lower(comment) LIKE '%synthetic%' THEN 1 ELSE 0 END AS is_test
 FROM research_responses UNION ALL
 SELECT id,project_ref,json_extract(answers_json,'$.interest'),json_extract(answers_json,'$.clarity'),json_extract(answers_json,'$.preference'),json_extract(answers_json,'$.comment'),language,created_at,questionnaire_version,answers_json,answers_json,is_test FROM public_research_responses`;
async function surveyResults(db:Database,project:string,params:URLSearchParams){
 const from=params.get('from')??'',to=params.get('to')??'',language=params.get('language')??'',sort=params.get('sort')??'desc',tests=params.get('tests')??'0';
 if([from,to].some(v=>v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))||from&&to&&from>to||!['','en','es'].includes(language)||!['asc','desc'].includes(sort)||!['0','1'].includes(tests))throw new Failure(400,'Choose valid research filters.');
 const where="project_ref=? AND is_test=? AND (?='' OR substr(created_at,1,10)>=?) AND (?='' OR substr(created_at,1,10)<=?) AND (?='' OR language=?)";
 const values=[project,Number(tests),from,from,to,to,language,language];
 const records=`SELECT * FROM (${responseSource}) WHERE ${where}`;
 const summary=await db.prepare(`WITH records AS MATERIALIZED (${records}),
 bounds AS (SELECT count(*) AS total,MAX(1,(count(*)+9)/10) AS pages,MIN(?,MAX(1,(count(*)+9)/10)) AS current FROM records),
 entries AS (SELECT j.key,j.value FROM records,json_each(records.answer_data) j),
 choices AS (SELECT key,value FROM entries WHERE key!='situations' UNION ALL SELECT 'situations',j.value FROM entries,json_each(CASE WHEN entries.key='situations' THEN entries.value ELSE '[]' END) j WHERE entries.key='situations')
 SELECT json_object('page',current,'pageSize',10,'total',total,'totalPages',pages,'hasMore',json(CASE WHEN current<pages THEN 'true' ELSE 'false' END),
 'items',json((SELECT json_group_array(json(row)) FROM (SELECT json_object('id',id,'interest',interest,'clarity',clarity,'preference',preference,'comment',comment,'language',language,'created_at',created_at,'questionnaire_version',questionnaire_version,'answers',json(answers_json),'is_test',is_test) AS row FROM records ORDER BY created_at ${sort.toUpperCase()},id LIMIT 10 OFFSET ((SELECT current FROM bounds)-1)*10))),
 'aggregate',json_object('total',total,'questions',json(COALESCE((SELECT json_group_array(json_object('key',key,'value',value,'count',n)) FROM (SELECT key,value,count(*) n FROM choices WHERE key NOT IN ('comment','informationNeeded') GROUP BY key,value)),'[]')),'answered',json(COALESCE((SELECT json_group_array(json_object('key',key,'count',n)) FROM (SELECT key,count(*) n FROM entries WHERE key NOT IN ('comment','informationNeeded') OR length(trim(CAST(value AS TEXT)))>0 GROUP BY key)),'[]')))) AS data FROM bounds`).bind(...values,adminPage(params)).first<{data:string}>();
 if(!summary)throw new Failure(503,'Research data is unavailable.');
 const result=JSON.parse(summary.data),aggregate=result.aggregate;
 // Preserve the established three-question summary contract for other admin views.
 for(const key of ['interest','clarity','preference'])aggregate[key]=aggregate.questions.filter((v:{key:string})=>v.key===key).map((v:{value:unknown;count:number})=>({value:v.value,count:v.count}));
 return result;
}
export async function researchAdmin(db:Database,actor:string,project:string,path:string,method:string,body:Record<string,unknown>,params:URLSearchParams){
 if(path==='/api/admin/research-responses'){if(method!=='GET')throw new Failure(405,'Method not allowed.');return surveyResults(db,project,params);}
 if(method==='GET'){const q=params.get('q')??'',status=params.get('status')??'';if(q.length>254||!['','allowed','revoked'].includes(status))throw new Failure(400,'Choose valid research filters.');return paginateAdmin(db,"SELECT json_object('id',target,'target',target,'bound_user_id',bound_user_id,'state',state,'results',results,'granted_by',granted_by,'granted_at',granted_at,'updated_at',updated_at,'last_event_id',last_event_id,'reason',COALESCE((SELECT reason FROM research_access_events e WHERE e.id=a.last_event_id),'')) AS row FROM research_access a WHERE project_ref=? AND instr(lower(target),lower(?))>0 AND (?='' OR state=?)",[project,q,status,status],"json_extract(row,'$.updated_at') DESC,json_extract(row,'$.id')",adminPage(params));}
 if(method!=='POST')throw new Failure(405,'Method not allowed.');
 const input=typeof body.target==='string'?body.target.trim():'';let target=input;
 if(!input.startsWith('email:')&&!input.startsWith('user:'))target=input.includes('@')?'email:'+input.toLowerCase():'user:'+input;
 if(target.startsWith('email:')){target=target.toLowerCase();if(target.length>260||!/^email:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))throw new Failure(400,'Enter a valid email address.');}else if(!target.startsWith('user:')||target.length>85||!await db.prepare('SELECT user_id FROM auth_users WHERE user_id=?').bind(target.slice(5)).first())throw new Failure(400,'Use an existing user identifier or verified account email.');
 if(!['research_grant','research_revoke'].includes(String(body.action))||typeof body.results!=='boolean'||typeof body.reason!=='string'||body.reason.length>500||!(body.expected_event_id===null||typeof body.expected_event_id==='string'&&body.expected_event_id.length<=80))throw new Failure(400,'Check the research permission fields.');
 try{await db.prepare('INSERT INTO research_access_events(id,target,actor_id,project_ref,action,results,expected_event_id,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),target,actor,project,body.action,body.results?1:0,body.expected_event_id,body.reason.trim(),new Date().toISOString()).run();}catch{throw new Failure(409,'Research permission changed or administrator access was revoked. Refresh before retrying.');}
 return {ok:true};
}
