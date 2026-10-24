// All generated material is disposable test-only, outside the actual repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,rmSync,symlinkSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {prepareKey,parseKeyArgs} from '../scripts/admin-key-prepare.mjs';
import {inspectPublicKey} from '../scripts/admin-trust-init.mjs';
import {signApproval} from '../scripts/admin-approve.mjs';
import {STAGING,verifyApproval} from '../scripts/lib/admin-grant.mjs';
const {URL}=globalThis;
const secret='synthetic-test-only-passphrase-123456';
function isolated(fn){
 const base=mkdtempSync(join(tmpdir(),'jalisco-offline-key-test-')),root=join(base,'repo'),safe=join(base,'offline');
 mkdirSync(root);mkdirSync(join(root,'staging'));mkdirSync(safe,{mode:0o700});
 writeFileSync(join(root,'wrangler.staging.jsonc'),readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url)));
 const o={email:'synthetic@example.test',directory:join(safe,'new-key')};
 try{return fn({root,safe,o});}finally{rmSync(base,{recursive:true,force:true});}
}
test('default is a no-write plan and never enrolls an account',()=>isolated(({root,safe,o})=>{
 const result=prepareKey(o,{root});assert.equal(result.generated,false);assert.equal(result.target_verified,false);assert.deepEqual(readdirSync(safe),[]);
}));
test('explicit isolated generation encrypts private material, publishes only public fingerprint, and reuses existing signer',()=>isolated(({root,o})=>{
 const result=prepareKey({...o,generate:true,confirm:'GENERATE OFFLINE STAGING APPROVAL KEY'},{root,passphrase:secret});
 assert.equal(result.registered,false);assert.equal(result.target_verified,false);
 const encrypted=readFileSync(join(o.directory,'approval-private.pem'),'utf8'),pub=readFileSync(join(o.directory,'approval-public.pub'),'utf8');
 assert.match(encrypted,/BEGIN ENCRYPTED PRIVATE KEY/);assert.throws(()=>createPrivateKey(encrypted));assert.throws(()=>createPrivateKey({key:encrypted,passphrase:'wrong'}));
 const privateKey=createPrivateKey({key:encrypted,passphrase:secret});assert.equal(createPublicKey(privateKey).export({format:'pem',type:'spki'}),pub);
 assert.equal(inspectPublicKey(pub).fingerprint,result.fingerprint);assert.equal(lstatSync(o.directory).mode&0o777,0o700);
 for(const file of readdirSync(o.directory))assert.equal(lstatSync(join(o.directory,file)).mode&0o777,0o600);
 const now=Date.now(),payload={intent:{...STAGING,action:'grant',request_id:'11111111-1111-4111-8111-111111111111'},approval_ref:'synthetic-only',issued_at:new Date(now).toISOString(),expires_at:new Date(now+60000).toISOString()},policy={scope:STAGING,approvers:[{id:'synthetic',public_key:pub}]};
 const envelope=signApproval(payload,'synthetic',encrypted,policy,`APPROVE ${payload.intent.request_id}`,now,secret);
 assert.equal(verifyApproval(envelope,policy,payload.intent,now).approver_id,'synthetic');
 assert.throws(()=>signApproval(payload,'synthetic',encrypted,policy,`APPROVE ${payload.intent.request_id}`,now,'wrong'));
 const printed=JSON.stringify(result);assert.equal(printed.includes(secret),false);assert.equal(printed.includes('PRIVATE KEY'),false);assert.equal(printed.includes(encrypted),false);
 assert.deepEqual(readdirSync(join(root,'staging')),[]);
 const before=encrypted;assert.throws(()=>prepareKey({...o,generate:true,confirm:'GENERATE OFFLINE STAGING APPROVAL KEY'},{root,passphrase:secret}));assert.equal(readFileSync(join(o.directory,'approval-private.pem'),'utf8'),before);
}));
test('missing confirmation and weak/malformed passphrase cannot create a destination',()=>isolated(({root,safe,o})=>{
 for(const passphrase of [undefined,'short','x'.repeat(20)+'\n'])assert.throws(()=>prepareKey({...o,generate:true,confirm:'GENERATE OFFLINE STAGING APPROVAL KEY'},{root,passphrase}));
 assert.throws(()=>prepareKey({...o,generate:true},{root,passphrase:secret}));assert.deepEqual(readdirSync(safe),[]);
}));
test('repository, ancestor, relative, existing, symlink and permissive parent paths reject',()=>isolated(({root,safe,o})=>{
 for(const path of [join(root,'new-key'),root,'relative',safe])assert.throws(()=>prepareKey({...o,directory:path},{root}));
 symlinkSync(safe,join(root,'alias'));assert.throws(()=>prepareKey({...o,directory:join(root,'alias/new')},{root}));
 chmodSync(safe,0o755);assert.throws(()=>prepareKey(o,{root}));
}));
test('existing trust and local key candidates block replacement generation',()=>isolated(({root,o})=>{
 for(const name of ['admin-approval-policy.json','owner-root-public.json','existing.pub']){
  const p=join(root,'staging',name);writeFileSync(p,'marker');assert.throws(()=>prepareKey(o,{root}));rmSync(p);
 }
}));
test('CLI rejects remote, overwrite, key-content and policy-registration arguments',()=>{
 for(const args of [['--register'],['--apply'],['--passphrase','secret'],['--force'],['--email'],['--generate','--generate']])assert.throws(()=>parseKeyArgs(args));
 assert.deepEqual(parseKeyArgs(['--email','synthetic@example.test']),{email:'synthetic@example.test'});
});
