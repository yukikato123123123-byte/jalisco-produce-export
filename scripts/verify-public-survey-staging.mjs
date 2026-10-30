// Explicit staging-only integration verification. Uses existing sessions, never changes grants.
// Usage: node --experimental-strip-types scripts/verify-public-survey-staging.mjs <admin-cookie-file> <ordinary-cookie-file>
// Submits exactly two clearly marked verification responses, excluded from real statistics.
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import process from 'node:process';
import console from 'node:console';
import {surveyQuestions,QUESTIONNAIRE_VERSION,CONSENT_VERSION} from '../shared/researchSurvey.ts';
import {translate} from '../src/i18n.ts';
const {URL,AbortSignal,crypto,fetch}=globalThis;
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
function sessionFile(path){const stat=statSync(path);if(!stat.isFile()||(stat.mode&0o077))throw Error('Session file must be owner-only.');const value=readFileSync(path,'utf8').trim();if(!/^__Host-jalisco-session=[^;\s]+$/.test(value))throw Error('Invalid staging session file.');return value;}
const [adminPath,ordinaryPath]=process.argv.slice(2);if(!adminPath||!ordinaryPath)throw Error('Provide protected administrator and ordinary session file paths.');
const adminCookie=sessionFile(adminPath),ordinaryCookie=sessionFile(ordinaryPath);
async function api(path,cookie){const r=await fetch(origin+path,{headers:cookie?{Cookie:cookie}:{},signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};}
const checks=[];
const check=(name,value)=>{if(!value)throw Error('Verification failed: '+name);checks.push(name);};
const anonymous=await api('/api/admin/research-responses');check('anonymous results denied with 401',anonymous.status===401);
const ordinary=await api('/api/admin/research-responses',ordinaryCookie);check('ordinary results denied with 403',ordinary.status===403);
const session=await api('/api/auth/session',ordinaryCookie);check('ordinary account verified without administrator grant',session.status===200&&session.data.is_admin===false);
const before=await api('/api/admin/research-responses',adminCookie);check('administrator results available',before.status===200);
const baseline=before.data.aggregate.total;
const marker='STAGING VERIFICATION ONLY '+crypto.randomUUID();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [width,language] of [[375,'en'],[1440,'es']]){
  const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));const t=s=>translate(s,language);
  const pageResponse=await page.goto(origin+'/research/nopahua?verification=1');check(`anonymous survey HTTP 200 ${width}`,pageResponse.status()===200);
  await page.getByRole('combobox',{name:'Language / Idioma'}).selectOption(language);await expect(page.getByRole('heading',{name:'Nopal',exact:true})).toBeVisible();
  await page.getByRole('button',{name:t('Start the research'),exact:true}).click();
  const answers={interest:4,clarity:3,nameImpression:'neutral',preference:'powder',mostInteresting:'visuals',informationNeeded:marker+' information',comment:marker+' reflection',servings:'seven',price:'50_99',purchaseIntent:'probably',situations:['home','trips']};
  for(let i=0;i<11;i++){
   const q=surveyQuestions[i];await expect(page.getByRole('heading',{name:t(q.title),exact:true})).toBeVisible();const value=answers[q.key];
   if(q.kind==='text')await page.locator('textarea[name="'+q.key+'"]').fill(value);
   else for(const option of Array.isArray(value)?value:[value])await page.locator('label.research-choice').filter({has:page.locator('input[value="'+option+'"]')}).click();
   if(i===0){await page.getByRole('combobox',{name:'Language / Idioma'}).selectOption(language==='en'?'es':'en');await expect(page.locator('input[value="4"]')).toBeChecked();await page.getByRole('combobox',{name:'Language / Idioma'}).selectOption(language);}
   await page.getByRole('button',{name:t(i===10?'Review your answers':'Continue'),exact:true}).click();
  }
  await expect(page.locator('.research-review li')).toHaveCount(11);
  await page.getByRole('button',{name:t('Edit question')+' 9',exact:true}).click();await expect(page.locator('input[value="50_99"]')).toBeChecked();await page.getByRole('button',{name:t('Return to review'),exact:true}).click();
  await page.locator('input[name=consent]').check();
  const savedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public/nopal-survey'&&r.request().method()==='POST');
  await page.getByRole('button',{name:t('Save research response'),exact:true}).click();const saved=await savedResponse;check(`server confirmed save ${width}`,saved.status()===201&&(await saved.json()).saved===true);
  await expect(page.getByRole('heading',{name:t('Your response is saved.'),exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:t('Your response is saved.'),exact:true})).toBeVisible();
  check(`no horizontal overflow ${width}`,await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth));
  const retry=await context.request.post(origin+'/api/public/nopal-survey',{headers:{Origin:origin},data:{...answers,language,verification:true,questionnaireVersion:QUESTIONNAIRE_VERSION,consentVersion:CONSENT_VERSION,consent:true}});check(`duplicate is idempotent ${width}`,retry.status()===200&&(await retry.json()).alreadySubmitted===true);
  check(`no browser errors ${width}`,errors.length===0);await context.close();
 }
 const after=await api('/api/admin/research-responses',adminCookie);check('real response total unchanged by verification',after.status===200&&after.data.aggregate.total===baseline);
 const verification=await api('/api/admin/research-responses?tests=1',adminCookie);check('test records stored and readable only in verification view',verification.status===200);
 const stored=verification.data.items.filter(v=>v.comment?.startsWith(marker));check('both live verification records persisted',stored.length===2&&stored.every(v=>v.is_test===1&&Object.keys(v.answers).length===11));
 check('response language persisted',stored.some(v=>v.language==='en')&&stored.some(v=>v.language==='es'));
 check('question statistics contain actual stored data',verification.data.aggregate.questions.some(v=>v.key==='situations'&&v.value==='trips'&&v.count>=2));
 const context=await browser.newContext();await context.addCookies([{name:'__Host-jalisco-session',value:adminCookie.slice(adminCookie.indexOf('=')+1),url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(origin+'/admin?section=research-results');await page.locator('.ops-topbar select').selectOption('en');await page.getByLabel('Verification responses only',{exact:true}).check();
 await expect(page.locator('.ops-data-cards')).toContainText(marker);
 for(const width of [375,1440]){await page.setViewportSize({width,height:1000});const details=page.locator('.ops-data-cards details').first();if(await details.getAttribute('open')===null)await details.locator('summary').click();await expect(details.locator('dl>div')).toHaveCount(11);check(`admin detail no overflow ${width}`,await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth));await page.screenshot({path:`/tmp/jalisco-nopal-admin-verified-${width}.png`,fullPage:true});}
 await context.close();
 const report={result:'PASS',origin,realResponses:baseline,newVerificationResponses:stored.length,verificationResponseIds:stored.map(v=>v.id),checks};writeFileSync('/tmp/jalisco-nopal-live-report.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
