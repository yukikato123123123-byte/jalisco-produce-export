import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/index.ts';
import { fixture,approveFixtureRegistrations } from './helpers/auth-fixture.mjs';
const { Request, Response }=globalThis;
function seed(f) {
  f.sql.exec(`INSERT INTO profiles VALUES ('farm','Private Person','Public Farm','Mexico','producer'),('other','Hidden Name','Other Farm','Mexico','producer'),('buyer','Private Buyer','Private Buyer Company','US','buyer');
    INSERT INTO producer_profiles VALUES ('farm','Public Farm','Mexico','Jalisco','Farm introduction','private@example.test','555-private',0);
    INSERT INTO buyer_profiles VALUES ('buyer','Private Buyer Company','US','Illinois','Private purchasing plans');
    INSERT INTO producer_items VALUES ('public-item','farm','Nopal','Public description','Cactus',250,'kg',NULL,'','Ask for season','public','2026-10-22'),('draft-item','farm','Secret crop','Private description','Secret',999,'kg',NULL,'','','draft','2026-10-22'),('hidden-item','other','Hidden produce','','',20,'kg',NULL,'','','private','2026-10-22');`);approveFixtureRegistrations(f);
}
test('public directory works without auth configuration and exposes only published fields',async()=>{
  const f=fixture();try{seed(f);
    const publicEnv={DB:f.env.DB,ASSETS:f.env.ASSETS};
    for(const path of ['/api/public/produce','/api/public/producers']){
      const r=await handle(new Request('https://app.example.test'+path),publicEnv);assert.equal(r.status,200);
      const body=await r.text();assert.match(body,/Public Farm/);for(const secret of ['Private Person','Private Buyer','Secret crop','Hidden produce','private@example.test','555-private','Private description','"user_id"'])assert.ok(!body.includes(secret),secret);
    }
    assert.equal((await handle(new Request('https://app.example.test/api/auth/session'),publicEnv)).status,503);
  }finally{f.close();}
});
test('producer search, region, paging and detail cannot reveal private items or profiles',async()=>{
  const f=fixture();try{seed(f);
    for(const query of ['q=nOpAl','q=Public%20Farm','country=Mex&region=jal','id=public-item']){
      const r=await f.request('/api/public/producers?'+query);assert.equal(r.status,200);const data=await r.json();assert.equal(data.items.length,1);assert.equal(data.items[0].id,'public-item');assert.equal(data.items[0].items.length,1);assert.equal(data.items[0].items[0].quantity,250);
    }
    for(const query of ['q=Secret','region=Texas','id=hidden-item','id=draft-item','page=2',"q='%20OR%201=1--"]){const data=await(await f.request('/api/public/producers?'+query)).json();assert.deepEqual(data.items,[]);}
    for(const query of ['page=0','page=1.1','q='+'a'.repeat(121)])assert.equal((await f.request('/api/public/producers?'+query)).status,400);
    f.sql.exec('UPDATE producer_profiles SET public_contact=1');assert.deepEqual((await(await f.request('/api/public/producers')).json()).items,[]);approveFixtureRegistrations(f);
    assert.equal((await(await f.request('/api/public/producers?id=public-item')).json()).items[0].business_email,'private@example.test');
  }finally{f.close();}
});
test('buyer directory never derives publication consent from private profiles or saved data',async()=>{
  const f=fixture();try{seed(f);f.sql.exec("INSERT INTO buyer_saved_items VALUES ('buyer','public-item','2026-10-22')");
    for(const query of ['', '?q=Private','?id=buyer','?country=US']){const r=await f.request('/api/public/buyers'+query);assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.items,[]);assert.equal(data.publication,'consent-only');assert.ok(!JSON.stringify(data).includes('Private Buyer Company'));}
  }finally{f.close();}
});
test('all administrator endpoints deny anonymous, normal and recovery users and ignore forged metadata',async()=>{
  const f=fixture();try{
    const anonymous=await f.request('/api/admin/overview');assert.equal(anonymous.status,401);
    const producer=await f.login();await f.request('/api/auth/onboarding',{full_name:'Test',company:'Farm',country:'Mexico',role:'producer'},producer);
    const buyer=await f.login(undefined,'u2');await f.request('/api/auth/onboarding',{full_name:'Buyer',company:'Buyer company',country:'US',role:'buyer'},buyer);
    const recovery=await f.login('recovery');
    f.upstream.hooks.fetch=async({path,method,normal})=>{const response=normal();if(path.endsWith('/user')&&method==='GET'&&response.ok)return Response.json({...await response.json(),user_metadata:{role:'admin'},app_metadata:{role:'admin'}});return response;};
    for(const cookie of [producer,buyer,recovery])for(const path of ['/api/admin','/api/admin/accounts','/api/admin/products','/api/admin/inquiries','/api/admin/accounts/target']){
      const r=await f.request(path,undefined,cookie);assert.equal(r.status,403);assert.ok(!('items' in await r.json()));
      assert.equal((await f.request(path,{action:'delete',role:'admin'},cookie)).status,403);
    }
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM profiles').get().n,2);
  }finally{f.close();}
});

const publication={publish:true,explicit_consent:true,consent_version:'buyer-directory-v1',company:'Public Sourcing Company',country:'US',region:'Illinois',markets:'Texas and Illinois',interests:'Nopal and avocado',introduction:'Public sourcing introduction'};
test('buyer publication requires fresh explicit consent and never publishes private profile data',async()=>{
 const f=fixture();try{
  const cookie=await f.login();await f.request('/api/auth/onboarding',{full_name:'Private Buyer Name',company:'Private Company',country:'US',role:'buyer'},cookie);
  await f.request('/api/buyer/profile',{company:'Private Company',country:'US',region:'Private Region',bio:'private@example.test and private contract details'},cookie);
  assert.deepEqual((await(await f.request('/api/public/buyers')).json()).items,[]);
  for(const body of [{...publication,explicit_consent:false},{...publication,explicit_consent:undefined},{...publication,consent_version:'old'},{...publication,publish:'true'},{...publication,interests:''}])assert.equal((await f.request('/api/buyer/publication',body,cookie)).status,400);
  assert.deepEqual((await(await f.request('/api/public/buyers')).json()).items,[]);
  let r=await f.request('/api/buyer/publication',publication,cookie);assert.equal(r.status,200);let owner=await r.json();const id=owner.publication.id;assert.equal(owner.publication.published,1);assert.equal(owner.publication.consent_version,'buyer-directory-v1');assert.ok(owner.publication.consented_at);
  assert.deepEqual((await(await f.request('/api/public/buyers')).json()).items,[]);approveFixtureRegistrations(f);
  const expected=['company','country','id','interests','introduction','markets','region'];
  for(const query of ['', '?q=nOpAl','?country=US&market=Illinois&interest=avocado','?id='+id]){
    r=await f.request('/api/public/buyers'+query);assert.equal(r.status,200);const data=await r.json();assert.equal(data.items.length,1);assert.deepEqual(Object.keys(data.items[0]).sort(),expected);assert.equal(data.items[0].company,publication.company);
    for(const privateValue of ['Private Buyer Name','Private Company','Private Region','private@example.test','contract details','u1'])assert.ok(!JSON.stringify(data).includes(privateValue));
  }
  for(const query of ['?q=missing','?country=Mexico','?market=Canada','?interest=apples','?id=u1','?page=2'])assert.deepEqual((await(await f.request('/api/public/buyers'+query)).json()).items,[]);
  for(const query of ['?page=0','?page=1.5','?market='+'a'.repeat(121)])assert.equal((await f.request('/api/public/buyers'+query)).status,400);
  await f.request('/api/buyer/profile',{company:'Changed private company',country:'CA',bio:'Updated private info'},cookie);
  assert.deepEqual((await(await f.request('/api/public/buyers?id='+id)).json()).items,[]);approveFixtureRegistrations(f);
  assert.equal((await(await f.request('/api/public/buyers?id='+id)).json()).items[0].company,publication.company);
  r=await f.request('/api/buyer/publication',{publish:false},cookie);assert.equal(r.status,200);assert.equal((await r.json()).publication.published,0);
  assert.deepEqual((await(await f.request('/api/public/buyers?id='+id)).json()).items,[]);
  assert.equal((await f.request('/api/buyer/publication',{...publication,explicit_consent:false},cookie)).status,400);
  owner=await(await f.request('/api/buyer/publication',{...publication,company:'Updated public company'},cookie)).json();assert.equal(owner.publication.id,id);assert.equal(owner.publication.revoked_at,null);
 }finally{f.close();}
});
test('publication writes are owner-bound and denied for anonymous, producer and recovery sessions',async()=>{
 const f=fixture();try{
  assert.equal((await f.request('/api/buyer/publication',publication)).status,401);
  const a=await f.login(),b=await f.login(undefined,'u2');
  await f.request('/api/auth/onboarding',{full_name:'Buyer',company:'Private buyer',country:'US',role:'buyer'},a);
  await f.request('/api/auth/onboarding',{full_name:'Producer',company:'Private producer',country:'MX',role:'producer'},b);
  assert.equal((await f.request('/api/buyer/publication',publication,b)).status,403);
  const recovery=await f.login('recovery');assert.equal((await f.request('/api/buyer/publication',publication,recovery)).status,403);
  const data=await(await f.request('/api/buyer/publication',{...publication,user_id:'u2',public_id:'attacker-controlled'},a)).json();assert.notEqual(data.publication.id,'attacker-controlled');
  assert.equal(f.sql.prepare('SELECT user_id FROM buyer_publications').get().user_id,'u1');
  assert.equal((await f.request('/api/buyer/publication',{publish:false,user_id:'u1'},b)).status,403);
  approveFixtureRegistrations(f);assert.equal((await(await f.request('/api/public/buyers')).json()).items.length,1);
 }finally{f.close();}
});
test('unpublishing another buyer cannot revoke the owner and missing consent fails closed',async()=>{
 const f=fixture();try{
  const a=await f.login(),b=await f.login(undefined,'u2');for(const cookie of [a,b])await f.request('/api/auth/onboarding',{full_name:'Buyer',company:'Private company',country:'US',role:'buyer'},cookie);
  const owner=await(await f.request('/api/buyer/publication',publication,a)).json();await f.request('/api/buyer/publication',{publish:false,user_id:'u1'},b);
  approveFixtureRegistrations(f);assert.equal((await(await f.request('/api/public/buyers?id='+owner.publication.id)).json()).items.length,1);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,b)).json()).publication,null);
  f.sql.exec("UPDATE buyer_publications SET published=0,consent_version='',consented_at=NULL");assert.deepEqual((await(await f.request('/api/public/buyers')).json()).items,[]);
  assert.throws(()=>f.sql.exec('UPDATE buyer_publications SET published=1'),/CHECK constraint/);
 }finally{f.close();}
});
