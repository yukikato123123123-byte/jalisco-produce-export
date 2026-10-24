import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, details,approveFixtureRegistrations } from './helpers/auth-fixture.mjs';
const sample={name:'Avocado',description:'Fresh',category:'Hass',quantity:'25',unit:'kg',price:'',currency:'',availability:'November',status:'draft'};
test('producer persistence, CRUD, public projection and authenticated ownership isolation',async()=>{
 const f=fixture();try{
  const a=await f.login(),b=await f.login(undefined,'u2');
  assert.equal((await f.request('/api/producer/dashboard')).status,401);
  await f.request('/api/auth/onboarding',details,a);
  await f.request('/api/auth/onboarding',{...details,company:'Other'},b);
  const profile={company:'Saved Farm',country:'Mexico',region:'Jalisco',bio:'Our farm',business_email:'business@example.test',business_phone:'123',public_contact:false};
  let r=await f.request('/api/producer/profile',profile,a);assert.equal(r.status,200);
  assert.equal((await (await f.request('/api/producer/dashboard',undefined,a)).json()).profile.company,'Saved Farm');
  assert.equal((await (await f.request('/api/producer/dashboard',undefined,b)).json()).profile.company,'Other');
  assert.equal((await f.request('/api/producer/profile',{...profile,business_email:'invalid'},a)).status,400);
  assert.equal((await f.request('/api/producer/items',{...sample,quantity:-1},a)).status,400);
  assert.equal((await f.request('/api/producer/items',{...sample,price:2,currency:''},a)).status,400);
  r=await f.request('/api/producer/items',sample,a);assert.equal(r.status,200);let data=await r.json();const id=data.items[0].id;
  assert.equal(data.summary.total,1);assert.equal(data.summary.public,0);
  assert.equal((await (await f.request('/api/public/produce')).json()).items.length,0);
  assert.equal((await f.request('/api/producer/items',{...sample,id,status:'public'},b)).status,404);
  assert.equal((await f.request('/api/producer/items',{id,action:'delete'},b)).status,404);
  assert.equal((await (await f.request('/api/producer/dashboard',undefined,b)).json()).items.length,0);
  r=await f.request('/api/producer/items',{...sample,id,status:'public'},a);data=await r.json();assert.equal(data.summary.public,0);assert.equal(data.summary.quantities.kg,undefined);assert.equal(data.summary.profileCompletion,100);
  assert.deepEqual((await(await f.request('/api/public/produce')).json()).items,[]);approveFixtureRegistrations(f);
  const visible=await(await f.request('/api/producer/dashboard',undefined,a)).json();assert.equal(visible.summary.public,1);assert.equal(visible.summary.quantities.kg,25);let pub=(await (await f.request('/api/public/produce')).json()).items[0];assert.equal(pub.company,'Saved Farm');assert.equal(pub.business_email,'');assert.equal(pub.user_id,undefined);assert.equal(pub.full_name,undefined);
  await f.request('/api/producer/profile',{...profile,public_contact:true},a);
  approveFixtureRegistrations(f);pub=(await (await f.request('/api/public/produce')).json()).items[0];assert.equal(pub.business_email,profile.business_email);
  await f.request('/api/producer/items',{...sample,id,status:'private'},a);assert.equal((await (await f.request('/api/public/produce')).json()).items.length,0);
  assert.equal((await f.request('/api/producer/items',{id,action:'delete'},a)).status,200);
  assert.equal((await (await f.request('/api/producer/dashboard',undefined,a)).json()).summary.total,0);
  const recovery=await f.login('recovery');assert.equal((await f.request('/api/producer/dashboard',undefined,recovery)).status,403);
  await f.request('/api/auth/logout',{},a);assert.equal((await f.request('/api/producer/items',sample,a)).status,401);
 }finally{f.close();}
});
test('buyer and unonboarded accounts cannot access producer endpoints',async()=>{const f=fixture();try{const c=await f.login();assert.equal((await f.request('/api/producer/dashboard',undefined,c)).status,403);await f.request('/api/auth/onboarding',{...details,role:'buyer'},c);assert.equal((await f.request('/api/producer/items',sample,c)).status,403);}finally{f.close();}});

test('public search filters, item links, currency checks and public projection use stored data',async()=>{
 const f=fixture();try{
  const c=await f.login();await f.request('/api/auth/onboarding',details,c);
  await f.request('/api/producer/profile',{company:'Origin Farm',country:'Mexico',region:'Jalisco',bio:'Private contact',business_email:'private@example.test',business_phone:'555',public_contact:false},c);
  for(const currency of ['usd','US','US1','USDD'])assert.equal((await f.request('/api/producer/items',{...sample,currency,price:'2'},c)).status,400);
  let r=await f.request('/api/producer/items',{...sample,status:'public',currency:'USD',price:'2'},c);assert.equal(r.status,200);const id=(await r.json()).items[0].id;
  await f.request('/api/producer/items',{...sample,name:'Secret draft'},c);
  await f.request('/api/producer/items',{...sample,name:'Secret private',status:'private'},c);
  approveFixtureRegistrations(f);for(const query of ['q=avocado','q=origin','region=jalisco&country=mexico&category=hass',`id=${id}`]){
   r=await f.request('/api/public/produce?'+query);assert.equal(r.status,200);const data=await r.json();assert.equal(data.items.length,1);assert.equal(data.items[0].business_email,'');assert.equal(data.items[0].business_phone,'');assert.equal(data.items[0].status,undefined);
  }
  assert.equal((await(await f.request('/api/public/produce?q=Secret')).json()).items.length,0);
  assert.equal((await(await f.request('/api/public/produce?region=unknown')).json()).items.length,0);
  assert.equal((await f.request('/api/public/produce?page=-1')).status,400);
  assert.equal((await f.request('/api/public/produce?q='+ 'x'.repeat(121))).status,400);
  assert.equal((await(await f.request('/api/public/produce?q=%27%20OR%201%3D1')).json()).items.length,0);
 }finally{f.close();}
});

test('buyer profiles and saved lists persist, ignore forged ownership, isolate roles and hide unpublished items',async()=>{
 const f=fixture();try{
  f.upstream.users.set('u3',{id:'u3',email:'other@example.test',password:'other-password-123',email_confirmed_at:'2026-10-22'});
  const producer=await f.login(),buyer=await f.login(undefined,'u2'),other=await f.login(undefined,'u3');
  await f.request('/api/auth/onboarding',details,producer);
  for(const c of [buyer,other])await f.request('/api/auth/onboarding',{...details,role:'buyer',company:'Original Buyer'},c);
  assert.equal((await f.request('/api/buyer/dashboard')).status,401);
  assert.equal((await f.request('/api/buyer/profile',{},producer)).status,403);
  assert.equal((await f.request('/api/producer/dashboard',undefined,buyer)).status,403);
  assert.equal((await f.request('/api/producer/profile',{},buyer)).status,403);
  assert.equal((await f.request('/api/producer/items',sample,buyer)).status,403);
  const profile={company:'Buyer Company',country:'US',region:'Texas',bio:'Our sourcing needs',user_id:'u3'};
  assert.equal((await f.request('/api/buyer/profile',profile,buyer)).status,200);
  assert.equal((await(await f.request('/api/buyer/dashboard?user_id=u3',undefined,buyer)).json()).profile.company,'Buyer Company');
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,other)).json()).profile.company,'Original Buyer');
  assert.equal((await f.request('/api/buyer/profile',{...profile,company:''},buyer)).status,400);
  const created=await(await f.request('/api/producer/items',{...sample,status:'public'},producer)).json();const id=created.items[0].id;
  approveFixtureRegistrations(f);for(let n=0;n<2;n++)assert.equal((await f.request('/api/buyer/saved-items',{id,action:'save',user_id:'u3'},buyer)).status,200);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,buyer)).json()).savedItems.length,1);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,other)).json()).savedItems.length,0);
  await f.request('/api/buyer/saved-items',{id,action:'remove',user_id:'u2'},other);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,buyer)).json()).savedItems.length,1);
  assert.equal((await f.request('/api/producer/items',{...sample,id},buyer)).status,403);
  assert.equal((await f.request('/api/producer/items',{id,action:'delete'},buyer)).status,403);
  await f.request('/api/producer/items',{...sample,id,status:'private'},producer);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,buyer)).json()).savedItems.length,0);
  assert.equal((await f.request('/api/buyer/saved-items',{id,action:'save'},other)).status,404);
  await f.request('/api/producer/items',{...sample,id,status:'public'},producer);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,buyer)).json()).savedItems.length,1);
  await f.request('/api/producer/items',{id,action:'delete'},producer);
  assert.equal((await(await f.request('/api/buyer/dashboard',undefined,buyer)).json()).savedItems.length,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM buyer_saved_items').get().n,0);
  await f.request('/api/auth/logout',{},buyer);
  assert.equal((await f.request('/api/buyer/dashboard',undefined,buyer)).status,401);
 }finally{f.close();}
});

test('public pagination is deterministic and filters are applied before the limit',async()=>{
 const f=fixture();try{
  f.sql.prepare('INSERT INTO profiles(user_id,full_name,company,country,role) VALUES(?,?,?,?,?)').run('p','Person','Farm','Mexico','producer');
  const insert=f.sql.prepare('INSERT INTO producer_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for(let n=0;n<53;n++)insert.run(String(n).padStart(3,'0'),'p',n===52?'Rare item':'Avocado','','Hass',10,'kg',null,'','','public','2026-10-22');
  approveFixtureRegistrations(f);const first=await(await f.request('/api/public/produce')).json(),second=await(await f.request('/api/public/produce?page=2')).json();
  assert.equal(first.items.length,50);assert.equal(first.hasMore,true);assert.equal(second.items.length,3);assert.equal(second.hasMore,false);
  assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,53);
  assert.equal((await(await f.request('/api/public/produce?q=Rare')).json()).items.length,1);
 }finally{f.close();}
});
