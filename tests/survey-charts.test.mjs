import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,accessEvent} from './helpers/auth-fixture.mjs';
import {QUESTIONNAIRE_VERSION,CONSENT_VERSION} from '../shared/researchSurvey.ts';
const endpoint='/api/admin/research-responses';
const answers={interest:4,clarity:3,nameImpression:'neutral',preference:'powder',mostInteresting:'visuals',informationNeeded:'Isolated original information',comment:'Isolated original reflection',servings:'seven',price:'50_99',purchaseIntent:'probably',situations:['home','trips']};
test('trend, full question counts and independently paginated written originals share the same filtered snapshot',async()=>{
 const f=fixture();try{const admin=await f.login();accessEvent(f);
 for(let i=0;i<14;i++)f.sql.prepare('INSERT INTO public_research_responses VALUES(?,?,?,?,?,?,?,?,?)').run('chart-'+i,'chart-hash-'+i,'auth.example.test',QUESTIONNAIRE_VERSION,JSON.stringify({...answers,preference:i%2?'powder':'liquid',informationNeeded:i===0?'':'Isolated original information '+i,comment:'<script>literal text</script> '+i}),i%2?'en':'es',CONSENT_VERSION,i===13?1:0,`2026-10-${i<7?'01':'02'}T12:00:00.000Z`);
 const get=async query=>{const r=await f.request(endpoint+query,undefined,admin);assert.equal(r.status,200);return r.json();};
 const all=await get('');assert.equal(all.total,13);assert.equal(all.items.length,10);assert.deepEqual(all.aggregate.trend,[{date:'2026-10-01',count:7},{date:'2026-10-02',count:6}]);assert.equal(all.aggregate.trend.reduce((n,v)=>n+v.count,0),all.total);
 assert.equal(all.aggregate.questions.filter(v=>v.key==='preference').reduce((n,v)=>n+v.count,0),13);
 assert.equal(all.aggregate.questions.filter(v=>v.key==='situations').reduce((n,v)=>n+v.count,0),26);
 assert.equal(all.aggregate.answered.find(v=>v.key==='informationNeeded').count,12);
 assert.equal(all.written.total,25);assert.equal(all.written.items.length,10);assert.ok(all.written.items.some(v=>v.text.startsWith('<script>literal text</script>')));
 const next=await get('?page=2&writtenPage=3');assert.deepEqual(next.aggregate,all.aggregate);assert.equal(next.items.length,3);assert.equal(next.written.items.length,5);assert.equal(next.written.total,25);
 const english=await get('?language=en&from=2026-10-02&to=2026-10-02');const dbCount=f.sql.prepare("SELECT count(*) n FROM public_research_responses WHERE is_test=0 AND language='en' AND substr(created_at,1,10)='2026-10-02'").get().n;assert.equal(english.total,dbCount);assert.equal(dbCount,3);assert.deepEqual(english.aggregate.trend,[{date:'2026-10-02',count:3}]);assert.equal(english.written.total,6);assert.ok(english.written.items.every(v=>v.language==='en'&&v.created_at.startsWith('2026-10-02')));
 const empty=await get('?from=2026-11-01');assert.equal(empty.total,0);assert.deepEqual(empty.aggregate.trend,[]);assert.deepEqual(empty.aggregate.questions,[]);assert.equal(empty.written.total,0);assert.deepEqual(empty.written.items,[]);
 const verification=await get('?tests=1');assert.equal(verification.total,1);assert.equal(verification.aggregate.trend[0].count,1);assert.equal(verification.written.total,2);
 assert.equal((await f.request(endpoint+'?writtenPage=0',undefined,admin)).status,400);
 assert.equal((await f.request(endpoint)).status,401);const ordinary=await f.login(null,'u2');assert.equal((await f.request(endpoint+'?writtenPage=2',undefined,ordinary)).status,403);
 }finally{f.close();}
});
