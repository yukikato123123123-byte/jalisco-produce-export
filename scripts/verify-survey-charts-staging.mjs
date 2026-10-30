// Read-only survey verification against existing D1 records. No survey/grant/config writes.
// Usage: node --experimental-strip-types scripts/verify-survey-charts-staging.mjs <owner-only-json-file>
// Input shape: {admin:{email,password}, ordinary:{email,password}}. Never put this file in Git.
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {surveyQuestions} from '../shared/researchSurvey.ts';
import {translateAdmin} from '../src/adminI18n.ts';
import process from 'node:process';
import console from 'node:console';
const {fetch,AbortSignal,URLSearchParams}=globalThis;
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
const project='heaswpawzuuijxurlfoz';
const file=process.argv[2];const info=statSync(file);if(!info.isFile()||(info.mode&0o077))throw Error('Provide an owner-only credential file.');
const credentials=JSON.parse(readFileSync(file,'utf8'));
const sql=`SELECT id,language,created_at,answers_json,interest,clarity,preference,comment,CASE WHEN comment LIKE 'STAGING VERIFICATION%' AND lower(comment) LIKE '%synthetic%' THEN 1 ELSE 0 END AS is_test FROM research_responses WHERE project_ref='${project}' UNION ALL SELECT id,language,created_at,answers_json,NULL,NULL,NULL,NULL,is_test FROM public_research_responses WHERE project_ref='${project}'`;
const query=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--remote','--config','wrangler.staging.jsonc','--command',sql,'--json'],{encoding:'utf8',maxBuffer:10000000});
if(query.status!==0)throw Error('Read-only D1 query failed.');
const records=JSON.parse(query.stdout)[0].results.map(row=>({...row,answers:row.answers_json?JSON.parse(row.answers_json):{interest:row.interest,clarity:row.clarity,preference:row.preference,comment:row.comment}}));
const sessions=[];let browser;
const check=(name,condition)=>{if(!condition)throw Error('Verification failed: '+name);};
async function request(path,cookie){const r=await fetch(origin+path,{headers:cookie?{Cookie:cookie}:{},signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};}
async function login(input){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});check('existing account login',r.status===200);const cookie=r.headers.get('set-cookie')?.split(';')[0];check('session cookie',!!cookie);sessions.push(cookie);return cookie;}
function filtered(params){return records.filter(row=>row.is_test===Number(params.get('tests')||0)&&(!params.get('language')||row.language===params.get('language'))&&(!params.get('from')||row.created_at.slice(0,10)>=params.get('from'))&&(!params.get('to')||row.created_at.slice(0,10)<=params.get('to')));}
function compare(data,params){const rows=filtered(params);check('D1 total',data.total===rows.length&&data.aggregate.total===rows.length);
 const dates=new Map();for(const row of rows){const day=row.created_at.slice(0,10);dates.set(day,(dates.get(day)||0)+1);}
 check('trend totals',data.aggregate.trend.reduce((n,v)=>n+v.count,0)===rows.length&&data.aggregate.trend.length===dates.size&&data.aggregate.trend.every(v=>dates.get(v.date)===v.count));
 for(const q of surveyQuestions){const answered=rows.filter(row=>q.key in row.answers&&(q.kind!=='text'||String(row.answers[q.key]).trim().length>0)).length;check('question answered '+q.key,(data.aggregate.answered.find(v=>v.key===q.key)?.count??0)===answered);if(q.kind!=='text'){const opts=q.kind==='scale'?[1,2,3,4,5]:q.options.map(v=>v.value);for(const value of opts){const n=rows.filter(row=>Array.isArray(row.answers[q.key])?row.answers[q.key].includes(value):row.answers[q.key]===value).length;check('choice count '+q.key,(data.aggregate.questions.find(v=>v.key===q.key&&v.value===value)?.count??0)===n);}}}
 const written=rows.flatMap(row=>['informationNeeded','comment'].filter(key=>typeof row.answers[key]==='string'&&row.answers[key].trim()).map(key=>({response_id:row.id,question:key,text:row.answers[key]})));check('written count',data.written.total===written.length);check('written originals',data.written.items.every(item=>written.some(v=>v.response_id===item.response_id&&v.question===item.question&&v.text===item.text)));
 return rows.length;
}
try{
 const admin=await login(credentials.admin),ordinary=await login(credentials.ordinary);
 check('administrator authority',(await request('/api/auth/session',admin)).data.is_admin===true);check('ordinary authority',(await request('/api/auth/session',ordinary)).data.is_admin===false);
 check('anonymous 401',(await request('/api/admin/research-responses')).status===401);check('ordinary 403',(await request('/api/admin/research-responses',ordinary)).status===403);
 const comparisons=[];for(const query of ['', 'language=en','language=es','from=2099-01-01','page=2&writtenPage=2','tests=1']){const response=await request('/api/admin/research-responses?'+query,admin);check('administrator statistics',response.status===200);comparisons.push({query,total:compare(response.data,new URLSearchParams(query))});}
 const real=records.filter(v=>v.is_test===0);if(real.length){const day=real[0].created_at.slice(0,10),params=new URLSearchParams({from:day,to:day});const response=await request('/api/admin/research-responses?'+params,admin);comparisons.push({query:params.toString(),total:compare(response.data,params)});}
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext();await context.addCookies([{name:'__Host-jalisco-session',value:admin.slice(admin.indexOf('=')+1),url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 const views=[];
 for(const [width,language] of [[375,'en'],[1440,'es']]){await page.setViewportSize({width,height:1000});await page.goto(origin+'/admin?section=research-results');await page.locator('.ops-topbar select').selectOption(language);const t=s=>translateAdmin(s,language);await expect(page.getByTestId('survey-valid-total')).toHaveText(String(real.length));await expect(page.locator('.survey-question-chart')).toHaveCount(11);await expect(page.locator('.survey-stack-row')).toHaveCount(11);
  const response=await request('/api/admin/research-responses',admin);for(const q of surveyQuestions){if(q.kind==='text')continue;const opts=q.kind==='scale'?[1,2,3,4,5]:q.options.map(v=>v.value);for(const value of opts){const n=response.data.aggregate.questions.find(v=>v.key===q.key&&v.value===value)?.count??0;const option=page.locator('.survey-question-chart[data-question="'+q.key+'"] [data-option="'+value+'"]');await expect(option).toHaveAttribute('data-count',String(n));const percentage=(real.length?n*100/real.length:0).toLocaleString(language==='es'?'es-MX':'en-US',{maximumFractionDigits:1});await expect(option).toContainText(n+' ('+percentage+'%)');}}
  await page.getByLabel(t('Language'),{exact:true}).selectOption('en');await expect(page.getByTestId('survey-valid-total')).toHaveText(String(real.filter(v=>v.language==='en').length));await page.getByLabel(t('Language'),{exact:true}).selectOption('es');await expect(page.getByTestId('survey-valid-total')).toHaveText(String(real.filter(v=>v.language==='es').length));await page.getByLabel(t('Language'),{exact:true}).selectOption('');await expect(page.getByTestId('survey-valid-total')).toHaveText(String(real.length));
  check('mobile/desktop overflow',await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth));await page.locator('.survey-visualizations').screenshot({path:`/tmp/nopal-charts-live-${width}-${language}.png`});
  await page.getByLabel(t('From date'),{exact:true}).fill('2099-01-01');await expect(page.getByTestId('survey-valid-total')).toHaveText('0');await expect(page.locator('.survey-question-chart')).toHaveCount(11);await expect(page.locator('.survey-visualizations')).not.toContainText('NaN');await expect(page.locator('.survey-visualizations')).not.toContainText('Infinity');await page.getByLabel(t('From date'),{exact:true}).fill('');views.push({width,language,countsMatchD1:true,filters:true,zeroState:true,overflow:false});
 }
 check('browser errors',errors.length===0);await context.close();
 const publicPage=await fetch(origin+'/research/nopahua',{signal:AbortSignal.timeout(20000)});check('public survey still accessible',publicPage.status===200);
 const report={result:'PASS',realResponses:real.length,excludedVerificationResponses:records.length-real.length,databaseComparisons:comparisons,views,anonymous:401,ordinary:403,publicSurvey:200,surveyWrites:0};writeFileSync('/tmp/nopal-charts-live-report.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();for(const cookie of sessions){const logout=await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});check('verification session logout',logout.status===200);check('denied after logout',(await request('/api/admin/research-responses',cookie)).status===401);}}
