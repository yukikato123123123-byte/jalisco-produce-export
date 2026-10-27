import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../worker/index.ts';
const {Request,Response}=globalThis;
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
function environment(){return {AUTH_ENVIRONMENT:'staging',AUTH_ORIGIN:origin,SUPABASE_URL:'https://heaswpawzuuijxurlfoz.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic',SESSION_ENCRYPTION_KEY:'ab'.repeat(32),DB:{prepare(){assert.fail('Preview must not access D1');}},ASSETS:{fetch:async()=>new Response('<html>synthetic app shell</html>',{headers:{'Content-Type':'text/html'}})}};}
const call=(path,env=environment(),method='GET',headers={})=>handle(new Request(origin+path,{method,headers}),env);
test('staging preview reuses app shell and returns only synthetic records without database access',async()=>{
 const page=await call('/admin/preview');assert.equal(page.status,200);assert.match(await page.text(),/app shell/);assert.equal(page.headers.get('X-Robots-Tag'),'noindex, nofollow');
 for(const s of ['overview','accounts','producers','buyers','products','inquiries','readiness','security','grants']){
  const r=await call('/api/staging/admin-preview/'+s,environment(),'GET',{Cookie:'__Host-jalisco-session='+'a'.repeat(64)});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.has('Set-Cookie'),false);
  const data=await r.json();assert.equal(data.preview,true);assert.equal(data.read_only,true);assert.equal(data.data_source,'synthetic');assert.doesNotMatch(JSON.stringify(data),/51f007ac|zacharymaynard182|approval_signature|session_token/);
  if(['grants','security'].includes(s))assert.deepEqual(data.items,[]);
 }
});
test('production, wrong project, wrong origin and missing staging marker have no preview',async()=>{
 for(const edit of [{AUTH_ENVIRONMENT:'production'},{AUTH_ENVIRONMENT:undefined},{SUPABASE_URL:'https://xchkkdfelwzzpyorjeks.supabase.co'},{AUTH_ORIGIN:'https://other.example'}]){
  for(const path of ['/admin/preview','/api/staging/admin-preview/accounts'])assert.equal((await call(path,{...environment(),...edit})).status,404);
 }
 assert.equal((await handle(new Request('https://other.example/api/staging/admin-preview/overview'),environment())).status,404);
});
test('all preview write methods are rejected and never fall through to real administrator actions',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])for(const path of ['/admin/preview','/api/staging/admin-preview/overview','/api/staging/admin-preview/actions']){
  const r=await call(path,environment(),method);assert.equal(r.status,405);assert.equal(r.headers.get('Allow'),'GET');
 }
 assert.equal((await call('/api/staging/admin-preview/actions')).status,404);
 assert.equal((await call('/api/admin/overview')).status,401);
 assert.equal((await call('/api/auth/session')).status,401);
});
test('preview filtering is limited to synthetic rows and invalid paths/pages fail closed',async()=>{
 const r=await call('/api/staging/admin-preview/products?q=avocado&status=public');assert.deepEqual((await r.json()).items.map(x=>x.id),['sample-avocado']);
 assert.equal((await call('/api/staging/admin-preview/products?page=0')).status,400);
 assert.deepEqual((await(await call('/api/staging/admin-preview/products?page=2')).json()).items,[]);
 assert.equal((await call('/api/staging/admin-preview/__proto__')).status,404);
});
