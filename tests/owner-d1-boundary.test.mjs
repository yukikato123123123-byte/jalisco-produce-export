// Local boundary tests only: synthetic provider, disposable SQLite and in-memory keys.
// These assertions deliberately do NOT claim an atomic DO/D1 recovery integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,details,accessEvent} from './helpers/auth-fixture.mjs';
import {ownerFixture} from './helpers/owner-fixture.mjs';
import {verifyApproval} from '../scripts/lib/admin-grant.mjs';

const snapshot=f=>({
 grants:f.sql.prepare('SELECT * FROM admin_grants ORDER BY user_id').all(),
 events:f.sql.prepare('SELECT * FROM admin_grant_events ORDER BY id').all(),
 audit:f.sql.prepare('SELECT * FROM admin_audit ORDER BY id').all(),
});

test('a genuinely recovered local owner session cannot authorize D1 admin access or impersonate Supabase',async()=>{
 const f=fixture();try{
  const ordinary=await f.login();
  assert.equal((await f.request('/api/auth/onboarding',details,ordinary)).status,200);
  const owner=await ownerFixture(),prepared=await owner.prepare();
  const recovered=await owner.request('recover',prepared.body);
  assert.equal(recovered.status,200);
  const cookie=recovered.headers.get('set-cookie').split(';')[0];
  assert.equal((await owner.request('session',undefined,{Cookie:cookie})).status,200);
  const before=snapshot(f);
  assert.equal((await f.request('/api/admin/overview',undefined,cookie)).status,401);
  assert.equal((await f.request('/api/admin/overview',undefined,ordinary+'; '+cookie)).status,403);
  assert.equal((await f.request('/api/admin/grants',{role:'owner'},ordinary+'; '+cookie)).status,403);
  assert.deepEqual(snapshot(f),before);
  // Existing independently provisioned admin grants keep their original boundary.
  accessEvent(f);
  assert.equal((await f.request('/api/admin/overview',undefined,ordinary)).status,200);
  const granted=snapshot(f);
  const next=await owner.prepare(prepared.next);
  assert.equal((await owner.request('recover',next.body)).status,200);
  assert.equal((await owner.request('session',undefined,{Cookie:cookie})).status,401);
  assert.deepEqual(snapshot(f),granted);
 }finally{f.close();}
});

test('owner recovery signatures cannot substitute for the existing signed admin approval',async()=>{
 const f=fixture();try{
  const owner=await ownerFixture(),prepared=await owner.prepare();
  const before=snapshot(f);
  const envelope={key_id:owner.approver.id,payload:prepared.payload,signature:prepared.body.signature};
  const policy=JSON.parse(owner.env.OWNER_BOOTSTRAP_MANIFEST).payload.policy;
  assert.throws(()=>verifyApproval(envelope,policy,{},Date.now()),/does not match this exact operation/);
  assert.throws(()=>verifyApproval(envelope,prepared.payload.next_policy,{},Date.now()));
  owner.storage.failAtPut=owner.storage.putCalls+3;
  const failed=await owner.request('recover',prepared.body);
  assert.equal(failed.status,503);
  assert.equal(failed.headers.has('set-cookie'),false);
  const state=await owner.storage.get();
  assert.equal(state.epoch,1);
  assert.equal(state.recovery.id,owner.recovery.id);
  assert.equal(state.sessions.length,0);
  assert.equal((await owner.request('recover',prepared.body)).status,409);
  assert.deepEqual(snapshot(f),before);
 }finally{f.close();}
});
