import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,readdirSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createPrivateKey,sign,randomUUID} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {prepareKey} from '../scripts/admin-key-prepare.mjs';
import {recoveryPayload,reviewRecovery} from '../scripts/lib/admin-key-recovery.mjs';
import {canonical,STAGING} from '../scripts/lib/admin-grant.mjs';
const passphrase='test-only-long-protected-passphrase';
function fixture(t){
 const base=mkdtempSync(join(tmpdir(),'key-recovery-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
 const root=join(base,'repo'),directory=join(base,'replacement');mkdirSync(root);mkdirSync(join(root,'staging'));
 for(const path of ['wrangler.staging.jsonc','staging/admin-approval-policy.json','staging/approval-public.pub'])copyFileSync(path,join(root,path));
 const before=readFileSync(join(root,'staging/admin-approval-policy.json'),'utf8');
 const generate=()=>prepareKey({directory,recovery:true,generate:true,confirm:'GENERATE OFFLINE STAGING APPROVAL KEY'},{root,passphrase});
 const unchanged=()=>assert.equal(readFileSync(join(root,'staging/admin-approval-policy.json'),'utf8'),before);
 return {root,directory,generate,unchanged};
}
function authorization(f){
 const owner=generateKeyPairSync('ed25519');writeFileSync(join(f.root,'staging/owner-root-public.json'),JSON.stringify({scope:STAGING,public_key:owner.publicKey.export({format:'jwk'}).x}));
 const payload=recoveryPayload(f.root,f.directory,randomUUID(),'external-owner-ticket-123');
 const candidate=createPrivateKey({key:readFileSync(join(f.directory,'approval-private.pem')),passphrase});
 const signature=(key,p)=>sign(null,Buffer.from(canonical(p)),key).toString('base64url');
 const seal=p=>({payload:p,owner_signature:signature(owner.privateKey,p),next_signature:signature(candidate,{operation:'accept_staging_approval_key_recovery',payload:p})});
 return {payload,seal};
}
test('rotation generation preserves existing material, encrypts separate key and refuses overwrite',t=>{
 const f=fixture(t);assert.equal(f.generate().registered,false);f.unchanged();
 assert.equal(statSync(f.directory).mode&0o777,0o700);
 assert.match(readFileSync(join(f.directory,'approval-private.pem'),'utf8'),/ENCRYPTED PRIVATE KEY/);
 for(const name of readdirSync(f.directory))assert.equal(statSync(join(f.directory,name)).mode&0o777,0o600);
 assert.throws(f.generate);f.unchanged();
});
test('absent owner root explicitly blocks recovery despite local policy metadata and confirmation',t=>{
 const f=fixture(t);f.generate();const payload=recoveryPayload(f.root,f.directory,randomUUID(),'local-confirmation');
 assert.throws(()=>reviewRecovery(f.root,f.directory,{payload,confirm:'YES',owner_signature:'self-approved'}),/RECOVERY_UNTRUSTED/);f.unchanged();
 assert.equal(readdirSync(join(f.root,'staging')).some(n=>n.startsWith('key-recovery-review-')),false);
});
test('independent owner and candidate signatures produce one auditable review, never registration',t=>{
 const f=fixture(t);f.generate();const {payload,seal}=authorization(f),envelope=seal(payload);
 const record=reviewRecovery(f.root,f.directory,envelope);assert.equal(record.registered,false);assert.equal(record.result,'VERIFIED_REVIEW_ONLY');
 assert.deepEqual(JSON.parse(readFileSync(join(f.root,'staging',`key-recovery-review-${payload.request_id}.json`),'utf8')),record);
 assert.throws(()=>reviewRecovery(f.root,f.directory,envelope),/already reviewed/);f.unchanged();
});
test('rejects bad signatures, expired/future requests and signed changes to scope, policy, key or operation',t=>{
 const f=fixture(t);f.generate();const {payload,seal}=authorization(f);
 for(const edit of [{scope:{...STAGING,worker:'production'}},{operation:'grant'},{protocol:'other'},{request_id:'local-string'},{previous_policy_sha256:'edited'},{old_fingerprint:'edited'},{next_fingerprint:'edited'},{expires_at:payload.expires_at+1},{issued_at:payload.issued_at+600000}])assert.throws(()=>reviewRecovery(f.root,f.directory,seal({...payload,...edit})));
 const good=seal(payload);
 for(const edit of [{owner_signature:good.next_signature},{next_signature:good.owner_signature}])assert.throws(()=>reviewRecovery(f.root,f.directory,{...good,...edit}),/signature/);
 assert.throws(()=>reviewRecovery(f.root,f.directory,good,payload.expires_at),/expired/);
 writeFileSync(join(f.root,'staging/admin-approval-policy.json'),readFileSync(join(f.root,'staging/admin-approval-policy.json'),'utf8').replace('PROJECT_OWNER','CHANGED_OWNER'));
 assert.throws(()=>reviewRecovery(f.root,f.directory,good),/does not match/);
});
test('audit failure cannot return successful review',t=>{
 const f=fixture(t);f.generate();const {payload,seal}=authorization(f);
 mkdirSync(join(f.root,'staging',`key-recovery-review-${payload.request_id}.json`));
 assert.throws(()=>reviewRecovery(f.root,f.directory,seal(payload)),/audit storage/);f.unchanged();
});
