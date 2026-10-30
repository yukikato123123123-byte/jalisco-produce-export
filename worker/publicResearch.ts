import type {Env} from './index.ts';
import {Failure} from './provider.ts';
import {limitedBody} from './nopalLaunch.ts';
import {QUESTIONNAIRE_VERSION,CONSENT_VERSION,normalizedSurveyAnswers} from '../shared/researchSurvey.ts';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const cookieName='nopal-survey';
const tokenFrom=(r:Request)=>r.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';
const reply=(value:unknown,status=200,cookie?:string,retry?:number)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{}),...(retry?{'Retry-After':String(retry)}:{})}});
export async function publicResearch(request:Request,env:Env){
 try{
  if(!env.DB||!env.SESSION_ENCRYPTION_KEY||!env.SUPABASE_URL)throw new Failure(503,'Research is temporarily unavailable.');
  if(new URL(request.url).origin!==env.AUTH_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Failure(403,'Request origin rejected.');
  const project=new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''),now=Date.now();
  const token=tokenFrom(request),validToken=/^[a-f0-9]{64}$/.test(token);
  const submissionHash=validToken?await digest('nopal-survey:'+token):'';
  const prior=validToken?await env.DB.prepare('SELECT id FROM public_research_responses WHERE submission_hash=? AND project_ref=?').bind(submissionHash,project).first():null;
  if(request.method==='GET'&&prior)return reply({allowed:true,submitted:true});
  if(!['GET','POST'].includes(request.method))throw new Failure(405,'Method not allowed.');
  if(request.method==='POST'&&(request.headers.get('Origin')!==env.AUTH_ORIGIN||request.headers.get('Content-Type')?.split(';')[0]!=='application/json'))throw new Failure(403,'Request origin rejected.');
  const bucket=Math.floor(now/600000),ipHash=await digest(`nopal-survey-rate:${env.SESSION_ENCRYPTION_KEY}:${request.headers.get('CF-Connecting-IP')??'local'}:${bucket}`);
  const rate=await env.DB.prepare('INSERT INTO auth_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(ipHash,now+1200000).first<{attempts:number}>();
  if(!rate||rate.attempts>30)throw new Failure(429,'Too many attempts. Please try again later.',600);
  const challenge=validToken?await env.DB.prepare('SELECT expires FROM auth_limits WHERE id=?').bind('survey:'+submissionHash).first<{expires:number}>():null;
  if(request.method==='GET'){
   if(challenge&&challenge.expires>now)return reply({allowed:true,submitted:false});
   const fresh=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   await env.DB.prepare('INSERT INTO auth_limits(id,attempts,expires) VALUES(?,0,?)').bind('survey:'+await digest('nopal-survey:'+fresh),now+86400000).run();
   return reply({allowed:true,submitted:false},200,`${cookieName}=${fresh}; Path=/api/public/nopal-survey; HttpOnly; SameSite=Strict; Max-Age=31536000${env.AUTH_ORIGIN.startsWith('https:')?'; Secure':''}`);
  }
  const body=await limitedBody(request,8192);if(body==='too_large')throw new Failure(413,'Request is too large.');
  if(!body)throw new Failure(400,'Check the research answers and consent.');
  const answers=normalizedSurveyAnswers(body);
  if(!answers||body.questionnaireVersion!==QUESTIONNAIRE_VERSION||body.consent!==true||body.consentVersion!==CONSENT_VERSION||!['en','es'].includes(String(body.language))||body.website!==undefined&&body.website!=='')throw new Failure(400,'Check the research answers and consent.');
  if(prior)return reply({saved:true,alreadySubmitted:true},200);
  if(!challenge||challenge.expires<=now)throw new Failure(409,'Refresh the survey before retrying.');
  if(now<challenge.expires-86400000+3000)throw new Failure(429,'Please review your answers before submitting.',3);
  const isTest=body.verification===true;
  if(isTest&&env.AUTH_ENVIRONMENT!=='staging')throw new Failure(400,'Verification responses are available only in staging.');
  await env.DB.prepare('INSERT INTO public_research_responses(id,submission_hash,project_ref,questionnaire_version,answers_json,language,consent_version,is_test,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(submission_hash) DO NOTHING').bind(crypto.randomUUID(),submissionHash,project,QUESTIONNAIRE_VERSION,JSON.stringify(answers),body.language,CONSENT_VERSION,isTest?1:0,new Date(now).toISOString()).run();
  const stored=await env.DB.prepare('SELECT id FROM public_research_responses WHERE submission_hash=? AND project_ref=?').bind(submissionHash,project).first();
  if(!stored)throw new Failure(503,'Your response could not be confirmed. Please try again.');
  return reply({saved:true,verification:isTest},201);
 }catch(e){return reply({error:e instanceof Failure?e.message:'Research is temporarily unavailable.'},e instanceof Failure?e.status:503,undefined,e instanceof Failure?e.retryAfter:undefined);}
}
