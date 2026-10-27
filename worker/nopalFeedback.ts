import {adminPage,paginateAdmin} from './adminPagination.ts';
import {canReviewFeedback} from '../src/feedbackStates.ts';
import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {limitedBody} from './nopalLaunch.ts';
const categories=['idea','opinion','question','other'],states=['received','reviewing','resolved','archived'];
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),n=>n.toString(16).padStart(2,'0')).join('');
const reply=(v:unknown,status:number,retry?:number)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(retry?{'Retry-After':String(retry)}:{}),...(status===405?{Allow:'POST'}:{})}});
const invalid=(code:string,status=400)=>reply({code},status);
export async function submitFeedback(request:Request,env:{DB:Database;AUTH_ORIGIN:string;SESSION_ENCRYPTION_KEY?:string}){
 if(request.method!=='POST')return invalid('method_not_allowed',405);
 if(!env.AUTH_ORIGIN||new URL(request.url).origin!==env.AUTH_ORIGIN||request.headers.get('Origin')!==env.AUTH_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return invalid('origin_rejected',403);
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return invalid('invalid_content_type',415);
 const length=request.headers.get('Content-Length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>24576))return invalid('request_too_large',413);
 try{
  const body=await limitedBody(request,24576);if(body==='too_large')return invalid('request_too_large',413);if(!body)return invalid('invalid_request');
  if(!uuid(body.id)||!uuid(body.clientId))return invalid('invalid_request');
  if(typeof body.category!=='string'||!categories.includes(body.category))return invalid('invalid_category');
  const message=typeof body.message==='string'?body.message.trim().replace(/\r\n/g,'\n'):'';
  if(message.length<10||message.length>4000||Array.from(message).some(c=>c.charCodeAt(0)<32&&!['\n','\r','\t'].includes(c)))return invalid('invalid_message');
  if(body.privacyConsent!==true||body.privacyVersion!=='nopal-voice-v1')return invalid('privacy_required');
  if(body.language!=='en'&&body.language!=='es')return invalid('invalid_language');
  if(typeof body.replyConsent!=='boolean'||(body.email!==undefined&&typeof body.email!=='string'))return invalid('reply_consent_required');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||Array.from(email).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))return invalid('invalid_email');
  if(Boolean(email)!==body.replyConsent)return invalid('reply_consent_required');
  if(!env.DB)return invalid('temporarily_unavailable',503);
  const now=Date.now(),bucket=Math.floor(now/600000),secret=env.SESSION_ENCRYPTION_KEY??'local';
  const key=await digest(`nopal-voice-rate:${secret}:${request.headers.get('CF-Connecting-IP')??'local'}:${bucket}`);
  const rate=await env.DB.prepare('INSERT INTO nopal_feedback_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,now+1200000).first<{attempts:number}>();
  if(!rate||rate.attempts>5)return reply({code:'rate_limited'},429,600-Math.floor(now/1000)%600);
  await env.DB.prepare('DELETE FROM nopal_feedback_limits WHERE expires<?').bind(now).run();
  const fingerprint=await digest(JSON.stringify([body.clientId,body.category,message,email,body.replyConsent,body.language,'nopal-voice-v1']));
  const prior=await env.DB.prepare('SELECT submission_hash FROM nopal_feedback WHERE id=?').bind(body.id).first<{submission_hash:string}>();if(prior&&prior.submission_hash!==fingerprint)return invalid('request_conflict',409);
  await env.DB.prepare('INSERT INTO nopal_feedback(id,submission_hash,category,message,reply_email,reply_consent,privacy_version,language,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(body.id,fingerprint,body.category,message,email||null,body.replyConsent?1:0,'nopal-voice-v1',body.language,new Date(now).toISOString()).run();
  const stored=await env.DB.prepare("SELECT f.id FROM nopal_feedback f JOIN nopal_feedback_events e ON e.feedback_id=f.id AND e.action='received' WHERE f.submission_hash=?").bind(fingerprint).first();if(!stored)return invalid('request_conflict',409);
  return reply({status:'saved'},202);
 }catch{return invalid('temporarily_unavailable',503);}
}
// Called only after the unchanged administrator grant check. Writes re-check that grant in SQL.
export async function feedbackAdmin(db:Database,actor:string,project:string,id:string|undefined,method:string,body:Record<string,unknown>,params:URLSearchParams){
 if(id&&!uuid(id))throw new Failure(400,'Enter a valid feedback reference.');
 if(method==='GET'){
  if(id){const item=await db.prepare("SELECT id,category,message,reply_email,reply_consent,privacy_version,language,created_at,state,last_event_id,(SELECT created_at FROM nopal_feedback_events WHERE feedback_id=nopal_feedback_current.id AND action='review' ORDER BY sequence DESC LIMIT 1) AS last_handled_at FROM nopal_feedback_current WHERE id=?").bind(id).first();if(!item)throw new Failure(404,'Customer feedback was not found.');const historyPage=await paginateAdmin(db,"SELECT json_object('id',id,'action',action,'state',after_state,'before_state',before_state,'note',note,'actor_id',actor_id,'created_at',created_at) AS row,sequence AS sort_key FROM nopal_feedback_events WHERE feedback_id=?",[id],'sort_key',adminPage(params,'historyPage'));const {items:history,...historyPagination}=historyPage;return {item,history,historyPagination,can_manage:true};}
  const q=params.get('q')??'',status=params.get('status')??'';if(q.length>120||(status&&!states.includes(status)))throw new Failure(400,'Choose valid feedback filters.');const page=adminPage(params);
  const result=await paginateAdmin(db,"SELECT json_object('id',id,'category',category,'excerpt',substr(message,1,160),'reply_email',reply_email,'reply_consent',reply_consent,'created_at',created_at,'state',state,'language',language,'last_handled_at',(SELECT created_at FROM nopal_feedback_events WHERE feedback_id=nopal_feedback_current.id AND action='review' ORDER BY sequence DESC LIMIT 1)) AS row FROM nopal_feedback_current WHERE (?='' OR state=?) AND instr(lower(message||' '||COALESCE(reply_email,'')),lower(?))>0",[status,status,q],"json_extract(row,'$.created_at') DESC,json_extract(row,'$.id')",page);return {...result,can_manage:true};
 }
 if(method!=='POST'||!id)throw new Failure(405,'Method not allowed.');
 if(!uuid(body.id)||typeof body.before_state!=='string'||!states.includes(body.before_state)||typeof body.after_state!=='string'||!states.includes(body.after_state)||typeof body.expected_event_id!=='string'||body.expected_event_id.length>80||typeof body.note!=='string'||!body.note.trim()||body.note.trim().length>2000)throw new Failure(400,'Provide a status and an internal review note of 1–2000 characters.');
 if(!canReviewFeedback(body.before_state,body.after_state))throw new Failure(400,'That feedback status transition is not allowed.');
 const note=body.note.trim(),values=[body.id,id,actor,project,body.before_state,body.after_state,body.expected_event_id,note];
 const prior=await db.prepare('SELECT id,feedback_id,actor_id,project_ref,before_state,after_state,expected_event_id,note FROM nopal_feedback_events WHERE id=?').bind(body.id).first<Record<string,unknown>>();
 if(prior){if(JSON.stringify(['id','feedback_id','actor_id','project_ref','before_state','after_state','expected_event_id','note'].map(k=>prior[k]))!==JSON.stringify(values))throw new Failure(409,'The feedback request ID was already used.');return {ok:true};}
 try{await db.prepare("INSERT INTO nopal_feedback_events(id,feedback_id,actor_id,project_ref,before_state,after_state,expected_event_id,note,action,created_at) VALUES(?,?,?,?,?,?,?,?,'review',?)").bind(...values,new Date().toISOString()).run();}catch{throw new Failure(409,'Feedback or administrator access changed. Refresh before retrying.');}
 return {ok:true};
}
