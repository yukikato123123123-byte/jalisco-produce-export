// Synthetic identities and disposable in-memory DB only. No real owner UUID/grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,details,accessEvent} from './helpers/auth-fixture.mjs';
const {Response}=globalThis;
const grants=f=>f.sql.prepare('SELECT count(*) n FROM admin_grants').get().n;
test('first successful login and onboarding never bootstrap an administrator',async()=>{const f=fixture();try{
 assert.equal(grants(f),0);const cookie=await f.login();assert.equal((await f.request('/api/auth/onboarding',details,cookie)).status,200);
 assert.equal(grants(f),0);assert.equal((await f.request('/api/admin/accounts',undefined,cookie)).status,403);
 }finally{f.close();}});
test('signup cannot choose admin or owner as its account role',async()=>{const f=fixture();try{
 for(const role of ['admin','owner'])assert.equal((await f.request('/api/auth/signup',{...details,role,email:'test@example.test',password:'valid-password-123'})).status,400);
 assert.equal(grants(f),0);assert.equal(f.upstream.stats.authentications,0);
 }finally{f.close();}});
test('owner flags and proposed subject values in provider metadata never grant access',async()=>{const f=fixture();try{
 const cookie=await f.login();f.upstream.hooks.fetch=async({path,method,normal})=>{const r=normal();return path.endsWith('/user')&&method==='GET'&&r.ok?Response.json({...await r.json(),user_metadata:{role:'owner',is_admin:true,owner:true,user_id:'synthetic-owner'},app_metadata:{role:'admin'}}):r;};
 assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,403);assert.equal(grants(f),0);
 }finally{f.close();}});
test('there is no browser grant/revoke path, even for a separately trusted administrator',async()=>{const f=fixture();try{
 const cookie=await f.login();const paths=['/api/admin/grants','/api/admin/grants/revoke','/api/admin/bootstrap'];
 for(const path of paths){assert.equal((await f.request(path,{user_id:'u1',role:'admin',approved:true})).status,401);assert.equal((await f.request(path,{user_id:'u1',role:'admin',approved:true},cookie)).status,403);}
 accessEvent(f,'grant','u1');
 for(const path of paths)assert.equal((await f.request(path,{user_id:'u2',role:'admin',approved:true},cookie)).status,404);
 assert.equal(grants(f),1);assert.equal(f.sql.prepare("SELECT count(*) n FROM admin_grants WHERE user_id='u2'").get().n,0);
 }finally{f.close();}});
test('a D1 grant cannot bypass a provider subject mismatch or unconfirmed identity',async()=>{const f=fixture();try{
 const cookie=await f.login();accessEvent(f,'grant','u1');
 for(const replacement of [{id:'different-provider-subject'},{email_confirmed_at:null}]){f.upstream.hooks.fetch=async({path,method,normal})=>{const r=normal();return path.endsWith('/user')&&method==='GET'&&r.ok?Response.json({...await r.json(),...replacement}):r;};assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,401);}
 }finally{f.close();}});
