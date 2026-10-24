import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerFixture,signature} from './helpers/owner-fixture.mjs';
import {signEnrollment} from '../scripts/owner-enrollment-sign.mjs';
import {inspectPublicKey} from '../scripts/lib/admin-key-store.mjs';
import {sha,canonical} from '../scripts/lib/admin-grant.mjs';
import {publicPolicyRoot} from '../worker/owner/authority.ts';
const {structuredClone}=globalThis;
test('offline enrollment signatures require exact public fingerprint, payload, role and confirmation',async()=>{
 const f=await ownerFixture(),p=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST).payload;
 for(const [role,payload] of [['root-bootstrap',p],['root-policy',publicPolicyRoot(p)]]){
  const o={role,payload,publicPem:f.root.pem,fingerprint:inspectPublicKey(f.root.pem).fingerprint,privatePem:f.root.privateKey.export({format:'pem',type:'pkcs8',cipher:'aes-256-cbc',passphrase:'synthetic-test-passphrase'}),passphrase:'synthetic-test-passphrase',confirmation:`SIGN OWNER ENROLLMENT ${role} ${sha(canonical(payload))}`};
  assert.equal(signEnrollment(o).signature,signature(f.root,payload));
  for(const edit of [{confirmation:'wrong'},{fingerprint:inspectPublicKey(f.approver.pem).fingerprint},{passphrase:'wrong'},{role:'root-activation'},{payload:{...payload,scope:{...p.scope,worker:'production'}}}])assert.throws(()=>signEnrollment({...o,...edit}));
 }
});
test('nested private material, plaintext PIN and unknown fields never enter signed enrollment output',async()=>{
 const f=await ownerFixture(),original=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST).payload;
 const signPayload=payload=>signEnrollment({role:'root-bootstrap',payload,publicPem:f.root.pem,fingerprint:inspectPublicKey(f.root.pem).fingerprint,privatePem:f.root.privateKey.export({format:'pem',type:'pkcs8'}),confirmation:`SIGN OWNER ENROLLMENT root-bootstrap ${sha(canonical(payload))}`});
 for(const mutate of [
  p=>{p.policy.approvers[0].private_key='synthetic-private-material';},
  p=>{p.recovery.private_key='synthetic-private-material';},
  p=>{p.pin.pin='12345678901';},
  p=>{p.pin.pepper='synthetic-pepper';},
  p=>{p.policy.api_token='synthetic-token';},
  p=>{p.policy.approvers[0].public_key=f.root.privateKey.export({format:'pem',type:'pkcs8'});},
  p=>{p.recovery.public_key='not-an-ed25519-public-key';},
  p=>{p.pin='12345678901';},
 ]){const payload=structuredClone(original);mutate(payload);assert.throws(()=>signPayload(payload));}
 assert.equal(signPayload(original).signature,signature(f.root,original));
});
test('activation and both possession signatures retain the exact reviewed role and schema',async()=>{
 const f=await ownerFixture(),bootstrap=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST);
 const activation={operation:'activate_owner_admin_gateway',protocol:'owner-admin-grants-v1',scope:bootstrap.payload.scope,origin:bootstrap.payload.origin,owner_id:bootstrap.payload.owner_id,bootstrap_sha256:sha(canonical(bootstrap)),previous_policy_sha256:'a'.repeat(64),capabilities:['admin_action','admin_read','grant','revoke','rotate_policy']};
 for(const [role,key,payload] of [
  ['root-activation',f.root,activation],
  ['recovery-accept',f.recovery,{operation:'accept_owner_admin_activation',role:'recovery',activation}],
  ['approval-accept',f.approver,{operation:'accept_owner_admin_activation',role:'approver',activation}],
 ]){
  const call=p=>signEnrollment({role,payload:p,publicPem:key.pem,fingerprint:inspectPublicKey(key.pem).fingerprint,privatePem:key.privateKey.export({format:'pem',type:'pkcs8'}),confirmation:`SIGN OWNER ENROLLMENT ${role} ${sha(canonical(p))}`});
  assert.equal(call(payload).signature,signature(key,payload));
  const bad=structuredClone(payload),p=bad.activation??bad;p.secret='synthetic-private-value';assert.throws(()=>call(bad));
  const missing=structuredClone(payload);delete (missing.activation??missing).bootstrap_sha256;assert.throws(()=>call(missing));
 }
});
