import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownerFixture,signature,edKey,approvalPolicy} from './helpers/owner-fixture.mjs';
import {OWNER_SCOPE,OWNER_ORIGIN,createPinVerifier} from '../worker/owner/crypto.ts';
import {verifyOwnerPolicy} from '../scripts/lib/owner-policy.mjs';
import {handle} from '../worker/index.ts';
const {Request}=globalThis;
test('PIN alone, ordinary user/admin cookies, bearer tokens and metadata never establish ownership',async()=>{
 const f=await ownerFixture();for(const body of [{pin:f.pin},{role:'owner',is_admin:true,pin:f.pin}])assert.notEqual((await f.request('recover',body,{Cookie:'__Host-jalisco-session=ordinary',Authorization:'Bearer synthetic'})).status,200);
 assert.equal((await f.request('bootstrap',{role:'owner'})).status,404);assert.equal((await f.request('session',undefined,{Cookie:'__Host-jalisco-session=ordinary'})).status,401);assert.equal((await f.request('login',{kind:'login'})).status,404);assert.equal((await handle(new Request(OWNER_ORIGIN+'/api/owner/session'),{})).status,503);
});
test('PIN plus offline proofs recover ownership without Gmail/passkeys and invalidate prior sessions/keys',async()=>{
 const f=await ownerFixture(),a=await f.prepare();const first=await f.request('recover',a.body);assert.equal(first.status,200);const cookie=first.headers.get('set-cookie').split(';')[0];assert.equal((await f.request('session',undefined,{Cookie:cookie})).status,200);
 const b=await f.prepare(a.next);assert.equal((await f.request('recover',b.body)).status,200);assert.equal((await f.request('session',undefined,{Cookie:cookie})).status,401);assert.equal((await f.request('recover',a.body)).status,409);
 const c=await f.prepare();assert.equal((await f.request('recover',c.body)).status,403);const bundle=await(await f.request('policy/current')).json();assert.equal(bundle.epoch,3);assert.equal(verifyOwnerPolicy(bundle,{scope:OWNER_SCOPE,public_key:f.root.public_key}).approvers[0].id,b.nextApprover.id);assert.equal('pin' in bundle.root.payload,false);
});
test('wrong PIN persists failure count and consumes challenge without granting a session',async()=>{
 const f=await ownerFixture(),p=await f.prepare();p.body.pin=(f.pin[0]==='0'?'1':'0')+f.pin.slice(1);assert.equal((await f.request('recover',p.body)).status,403);const s=await f.storage.get();assert.equal(s.epoch,1);assert.equal(s.attempts.count,1);assert.equal(s.sessions.length,0);assert.equal((await f.request('recover',p.body)).status,409);
});
test('wrong current or replacement-key signatures fail without consuming PIN attempts',async()=>{
 const f=await ownerFixture(),p=await f.prepare();for(const edit of [{signature:'invalid'},{next_signature:'invalid'}])assert.equal((await f.request('recover',{...p.body,...edit})).status,403);assert.equal((await f.storage.get()).attempts.count,0);assert.equal((await f.request('recover',p.body)).status,200);
});
test('signature binds project, target, operation, protocol and replacement policy',async()=>{
 const f=await ownerFixture();for(const edit of [{scope:{...OWNER_SCOPE,database_id:randomUUID()}},{owner_id:randomUUID()},{operation:'grant'},{protocol:'different'},{next_policy:approvalPolicy(edKey())}]){const p=await f.prepare();assert.equal((await f.request('recover',{...p.body,signature:signature(f.recovery,{...p.payload,...edit})})).status,403);}assert.equal((await f.storage.get()).epoch,1);
});
test('expired and duplicate requests fail closed',async()=>{
 const f=await ownerFixture(),p=await f.prepare();const s=await f.storage.get();s.challenges[0].expires_at=Date.now()-1;await f.storage.put('',s);assert.equal((await f.request('recover',p.body)).status,409);
 const q=await f.prepare();assert.equal((await f.request('recover',q.body)).status,200);assert.equal((await f.request('recover',q.body)).status,409);
});
test('concurrent valid recoveries commit exactly one epoch and one success audit',async()=>{
 const f=await ownerFixture(),a=await f.prepare(),b=await f.prepare();const responses=await Promise.all([f.request('recover',a.body),f.request('recover',b.body)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const s=await f.storage.get();assert.equal(s.epoch,2);assert.equal(s.chain.length,1);assert.equal(s.audit.filter(e=>e.result==='committed').length,1);
});
test('final audit failure rolls back keys, policy, epoch and session changes',async()=>{
 const f=await ownerFixture(),p=await f.prepare();f.storage.failAtPut=f.storage.putCalls+3;assert.equal((await f.request('recover',p.body)).status,503);const s=await f.storage.get();assert.equal(s.epoch,1);assert.equal(s.recovery.id,f.recovery.id);assert.equal(s.chain.length,0);assert.equal(s.sessions.length,0);assert.equal(s.attempts.count,1);assert.equal((await f.request('recover',p.body)).status,409);
});
test('unsigned attacks cannot burn PIN budget; signed attempts stop at the atomic limit',async()=>{
 const f=await ownerFixture(),p=await f.prepare();for(let i=0;i<11;i++)assert.equal((await f.request('recover',{...p.body,signature:'invalid'})).status,403);const s=await f.storage.get();assert.equal(s.attempts.count,0);s.attempts={count:10,reset_at:Date.now()+86400000};await f.storage.put('',s);assert.equal((await f.request('recover',p.body)).status,429);
});
test('offline signing, public policy verification and salted PIN storage expose no secrets',async()=>{
 const {signRecovery}=await import('../scripts/owner-sign.mjs');const f=await ownerFixture(),p=await f.prepare(),confirm=`SIGN OWNER RECOVERY ${p.payload.request_id}`;
 const first=signRecovery({payload:p.payload},f.recovery.privateKey.export({type:'pkcs8',format:'pem'}),'recover',confirm),final=signRecovery(first,p.next.privateKey.export({type:'pkcs8',format:'pem'}),'accept',confirm);assert.equal(JSON.stringify(final).includes('PRIVATE KEY'),false);assert.equal((await f.request('recover',{...p.body,signature:final.signature,next_signature:final.next_signature})).status,200);
 const s=await f.storage.get();assert.equal(JSON.stringify(s).includes(f.pin),false);assert.equal(JSON.stringify(s).includes(f.pepper),false);const again=await createPinVerifier(f.pin,f.pepper,s.owner_id);assert.notEqual(s.pin.salt,again.salt);assert.equal(s.pin.iterations,600000);const b=await(await f.request('policy/current')).json();assert.throws(()=>verifyOwnerPolicy({...b,epoch:1},{scope:OWNER_SCOPE,public_key:f.root.public_key}));assert.ok(await f.storage.get('audit:1'));
});
test('CSRF, malformed and oversized input are rejected without credential disclosure',async()=>{
 const f=await ownerFixture();assert.equal((await f.request('challenge',{kind:'recover',request_id:randomUUID()},{Origin:'https://evil.example'})).status,403);
 const headers={Origin:OWNER_ORIGIN,'Content-Type':'application/json'};for(const [body,status] of [['{',400],['{"x":"'+'x'.repeat(32769)+'"}',413]])assert.equal((await f.authority.fetch(new Request(OWNER_ORIGIN+'/api/owner/recover',{method:'POST',headers,body}))).status,status);
 const result=await(await f.request('recover',{pin:f.pin})).text();assert.equal(result.includes(f.pin),false);
});
