import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,details,accessEvent} from './helpers/auth-fixture.mjs';
import {accountDestination} from '../src/accountDestination.ts';
const {Response}=globalThis;
test('server grant controls login destination and every admin request; revocation is immediate',async()=>{
 const f=fixture();try{
  const cookie=await f.login();assert.equal((await f.request('/api/auth/onboarding',details,cookie)).status,200);
  const session=async()=>{const r=await f.request('/api/auth/session',undefined,cookie);assert.equal(r.status,200);return r.json();};
  assert.equal((await session()).is_admin,false);assert.equal(accountDestination(await session()),'/producer/dashboard');
  assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,403);
  accessEvent(f);assert.equal((await session()).is_admin,true);assert.equal(accountDestination(await session()),'/admin');
  assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,200);
  accessEvent(f,'revoke');assert.equal((await session()).is_admin,false);assert.equal(accountDestination(await session()),'/producer/dashboard');
  assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,403);
 }finally{f.close();}
});
test('metadata, another subject/project and recovery sessions never select administrator access',async()=>{
 const f=fixture();try{
  const cookie=await f.login();accessEvent(f,'grant','u2');
  f.upstream.hooks.fetch=async({path,method,normal})=>{const r=normal();return path.endsWith('/user')&&method==='GET'&&r.ok?Response.json({...await r.json(),user_metadata:{role:'admin',is_admin:true},app_metadata:{role:'admin'}}):r;};
  assert.equal((await(await f.request('/api/auth/session',undefined,cookie)).json()).is_admin,false);
  accessEvent(f,'grant','u1','other-project');
  assert.equal((await(await f.request('/api/auth/session',undefined,cookie)).json()).is_admin,false);
  const recovery=await f.login('recovery');const current=await(await f.request('/api/auth/session',undefined,recovery)).json();
  assert.equal(current.is_admin,false);assert.equal(accountDestination(current),'/reset-password');
  assert.equal((await f.request('/api/admin/overview',undefined,recovery)).status,403);
 }finally{f.close();}
});
test('ordinary buyer, onboarding, absent admin hint and recovery preserve their destinations',()=>{
 assert.equal(accountDestination({recovery:false,profile:{role:'buyer'},is_admin:false}),'/buyer/dashboard');
 assert.equal(accountDestination({recovery:false,profile:null}),'/onboarding');
 assert.equal(accountDestination({recovery:false,profile:{role:'producer'}}),'/producer/dashboard');
 assert.equal(accountDestination({recovery:true,profile:null,is_admin:true}),'/reset-password');
});
