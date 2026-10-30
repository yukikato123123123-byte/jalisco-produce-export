import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,accessEvent} from './helpers/auth-fixture.mjs';
import {QUESTIONNAIRE_VERSION,CONSENT_VERSION,normalizedSurveyAnswers} from '../shared/researchSurvey.ts';
const {Request}=globalThis;
const body={questionnaireVersion:QUESTIONNAIRE_VERSION,consentVersion:CONSENT_VERSION,consent:true,interest:4,clarity:3,nameImpression:'neutral',preference:'powder',mostInteresting:'visuals',informationNeeded:'Synthetic information',comment:'Synthetic isolated response',servings:'seven',price:'50_99',purchaseIntent:'probably',situations:['home','trips'],language:'es'};
const endpoint='/api/public/nopal-survey';
async function challenge(f){const r=await f.request(endpoint);assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];f.sql.prepare("UPDATE auth_limits SET expires=expires-4000 WHERE id LIKE 'survey:%'").run();return cookie;}
test('anonymous submission persists all eleven answers; retries, reload and concurrency keep one immutable record',async()=>{const f=fixture();try{
 assert.equal((await f.request('/research/nopahua')).status,200);
 const cookie=await challenge(f);const results=await Promise.all([f.request(endpoint,body,cookie),f.request(endpoint,body,cookie)]);assert.ok(results.every(r=>[200,201].includes(r.status)));
 const row=f.sql.prepare('SELECT * FROM public_research_responses').get();assert.equal(Object.keys(JSON.parse(row.answers_json)).length,11);assert.equal(JSON.parse(row.answers_json).informationNeeded,body.informationNeeded);assert.equal(row.language,'es');assert.equal(row.is_test,0);
 assert.equal((await(await f.request(endpoint,undefined,cookie)).json()).submitted,true);
 assert.equal((await(await f.request(endpoint,{...body,interest:1},cookie)).json()).saved,true);assert.deepEqual(f.sql.prepare('SELECT * FROM public_research_responses').get(),row);
 assert.throws(()=>f.sql.exec('DELETE FROM public_research_responses'),/retained/);assert.throws(()=>f.sql.exec("UPDATE public_research_responses SET language='en'"),/immutable/);
 }finally{f.close();}});
test('validation, origin, proof lifetime, minimum duration, rate limiting and failures cannot claim saved',async()=>{const f=fixture();try{
 assert.equal((await f.request(endpoint,body)).status,409);const first=await f.request(endpoint);const cookie=first.headers.get('set-cookie').split(';')[0];assert.equal((await f.request(endpoint,body,cookie)).status,429);
 f.sql.prepare("UPDATE auth_limits SET expires=expires-4000 WHERE id LIKE 'survey:%'").run();
 for(const patch of [{consent:false},{situations:['unsure','home']},{price:'fake'},{language:'fr'},{informationNeeded:'x'.repeat(501)},{website:'spam'},{questionnaireVersion:'bad'}])assert.equal((await f.request(endpoint,{...body,...patch},cookie)).status,400);
 const cross=await import('../worker/index.ts');assert.equal((await cross.handle(new Request(f.env.AUTH_ORIGIN+endpoint,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify(body)}),f.env)).status,403);
 f.sql.prepare("UPDATE auth_limits SET expires=0 WHERE id LIKE 'survey:%'").run();assert.equal((await f.request(endpoint,body,cookie)).status,409);
 const fresh=await challenge(f);f.hooks.before=({query})=>{if(query.startsWith('INSERT INTO public_research_responses'))throw Error('Simulated unavailable D1');};const failed=await f.request(endpoint,body,fresh);assert.equal(failed.status,503);assert.ok(!(await failed.json()).saved);f.hooks.before=undefined;
 for(let i=0;i<35;i++)await f.request(endpoint,body);assert.equal((await f.request(endpoint,body,fresh)).status,429);assert.equal(f.sql.prepare('SELECT count(*) n FROM public_research_responses').get().n,0);
 }finally{f.close();}});
test('only administrator can read results; all question statistics, filters, sorting and pagination come from stored data; tests excluded',async()=>{const f=fixture();try{
 const admin=await f.login();accessEvent(f);const user=await f.login(null,'u2');
 for(const path of ['/api/admin/research-responses','/api/research/results']){assert.equal((await f.request(path)).status,401);assert.equal((await f.request(path,undefined,user)).status,403);}
 assert.equal((await f.request('/research/nopahua/results')).status,403);
 // Insert isolated stored records directly to exercise aggregation across more than one page.
 for(let i=0;i<13;i++)f.sql.prepare('INSERT INTO public_research_responses VALUES(?,?,?,?,?,?,?,?,?)').run('fixture-'+String(i).padStart(2,'0'),'hash-'+i,'auth.example.test',QUESTIONNAIRE_VERSION,JSON.stringify(normalizedSurveyAnswers({...body,comment:'Synthetic '+i})),i%2?'en':'es',CONSENT_VERSION,i===12?1:0,`2026-10-${String(i+1).padStart(2,'0')}T00:00:00.000Z`);
 const result=await(await f.request('/api/admin/research-responses',undefined,admin)).json();assert.equal(result.total,12);assert.equal(result.items.length,10);assert.equal(result.aggregate.total,12);assert.equal(result.items[0].id,'fixture-11');
 assert.equal(result.aggregate.questions.find(q=>q.key==='situations'&&q.value==='home').count,12);assert.equal(result.aggregate.questions.find(q=>q.key==='price').count,12);assert.equal(result.aggregate.answered.length,11);
 const page=await(await f.request('/api/admin/research-responses?page=2&sort=asc',undefined,admin)).json();assert.equal(page.items.length,2);assert.equal(page.items[0].id,'fixture-10');
 const filtered=await(await f.request('/api/admin/research-responses?from=2026-10-03&to=2026-10-06&language=en',undefined,admin)).json();assert.equal(filtered.total,2);assert.equal(filtered.aggregate.total,2);
 const tests=await(await f.request('/api/admin/research-responses?tests=1',undefined,admin)).json();assert.equal(tests.total,1);assert.equal(tests.items[0].is_test,1);
 // Explicit legacy staging-verification convention is projected as test metadata, never rewritten.
 await f.request('/api/admin/research-access',{target:'user:u2',action:'research_grant',results:false,reason:'Isolated fixture',expected_event_id:null},admin);
 const legacy=await f.request('/api/research/responses',{interest:2,clarity:2,preference:'unsure',comment:'STAGING VERIFICATION — synthetic test record',language:'en',consent:true,consentVersion:CONSENT_VERSION},user);assert.equal(legacy.status,201);
 const legacyRow=f.sql.prepare('SELECT * FROM research_responses').get();
 const realAfter=await(await f.request('/api/admin/research-responses',undefined,admin)).json();assert.equal(realAfter.total,12);
 const testsAfter=await(await f.request('/api/admin/research-responses?tests=1',undefined,admin)).json();assert.equal(testsAfter.total,2);assert.deepEqual(f.sql.prepare('SELECT * FROM research_responses').get(),legacyRow);
 assert.equal((await f.request('/api/admin/research-responses?sort=injection',undefined,admin)).status,400);
 assert.equal((await f.request('/api/admin/research-responses?from=2026-02-31',undefined,admin)).status,400);
 accessEvent(f,'revoke');assert.equal((await f.request('/api/admin/research-responses',undefined,admin)).status,403);
 }finally{f.close();}});
test('verification flag cannot enter production results and requires staging mode',async()=>{const f=fixture();try{const cookie=await challenge(f);assert.equal((await f.request(endpoint,{...body,verification:true},cookie)).status,400);f.env.AUTH_ENVIRONMENT='staging';assert.equal((await f.request(endpoint,{...body,verification:true},cookie)).status,201);assert.equal(f.sql.prepare('SELECT is_test FROM public_research_responses').get().is_test,1);}finally{f.close();}});
