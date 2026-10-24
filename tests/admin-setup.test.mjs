import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,chmodSync,symlinkSync,rmSync,rmdirSync,readdirSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {setupAdministrator,parseSetupArgs} from '../scripts/admin-setup.mjs';
import {prepareKey} from '../scripts/admin-key-prepare.mjs';
import {readPreparedKey} from '../scripts/lib/admin-key-store.mjs';
import {initializeTrust} from '../scripts/admin-trust-init.mjs';
import {STAGING,verifyApproval} from '../scripts/lib/admin-grant.mjs';
import {signApproval} from '../scripts/admin-approve.mjs';
const {URL}=globalThis;
const passphrase='isolated-test-only-encryption-passphrase';
const user='11111111-1111-4111-8111-111111111111',email='synthetic@example.test';
async function isolated(fn){
 const base=mkdtempSync(join(tmpdir(),'jalisco-setup-test-')),root=join(base,'repo'),home=join(base,'home');
 mkdirSync(root);mkdirSync(join(root,'staging'),{mode:0o700});mkdirSync(home,{mode:0o700});
 writeFileSync(join(root,'wrangler.staging.jsonc'),readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url)));
 const directory=join(home,'.jalisco-admin',STAGING.project_ref),policy=join(root,'staging/admin-approval-policy.json');
 const options={stage:'plan',email,user},calls=[];
 const gateway={verifyScope:async()=>{calls.push('scope');return 'cf-token:synthetic';},lookupUser:async(id,address)=>{calls.push('identity');assert.equal(id,user);assert.equal(address,email);return {id,email:address,email_confirmed_at:'2026-01-01T00:00:00Z'};},account:async()=>({known:true}),state:async()=>null,event:async()=>null,insertEvent:async()=>{assert.fail('Setup must never insert a grant event');}};
 const deps={root,home,passphrase,gateway};
 const generate=()=>setupAdministrator({...options,stage:'key',generate:true,confirm:'GENERATE OFFLINE STAGING APPROVAL KEY'},deps);
 const trust={...options,stage:'trust','identity-ref':'reviewed-project-control','approval-ref':'explicit-enrollment-approval',reason:'Synthetic first enrollment'};
 try{return await fn({root,home,directory,policy,options,deps,gateway,calls,generate,trust});}finally{rmSync(base,{recursive:true,force:true});}
}
test('default plan and key plan use protected default location without writes or network',()=>isolated(async f=>{
 for(const stage of ['plan','key']){const result=await setupAdministrator({...f.options,stage},f.deps);assert.equal(result.directory,f.directory);assert.equal(existsSync(join(f.home,'.jalisco-admin')),false);}
 assert.deepEqual(f.calls,[]);assert.deepEqual(readdirSync(join(f.root,'staging')),[]);
}));
test('separate generation and trust registration automatically hand off fingerprint; signing still required',()=>isolated(async f=>{
 const generated=await f.generate();assert.equal(generated.generated,true);assert.equal(existsSync(f.policy),false);
 assert.equal(lstatSync(join(f.home,'.jalisco-admin')).mode&0o777,0o700);assert.equal(lstatSync(f.directory).mode&0o777,0o700);
 const key=readPreparedKey(f.directory,f.root);assert.equal(key.fingerprint,generated.fingerprint);
 const before=readFileSync(join(f.directory,'approval-private.pem'),'utf8');assert.match(before,/BEGIN ENCRYPTED PRIVATE KEY/);
 const plan=await setupAdministrator(f.trust,f.deps);assert.equal(plan.changed,false);assert.equal(plan.target_verified,true);assert.equal(existsSync(f.policy),false);
 const result=await setupAdministrator({...f.trust,register:true,confirm:'REGISTER FIRST STAGING APPROVER'},f.deps);
 assert.equal(result.grant_changed,false);assert.equal(result.fingerprint,key.fingerprint);
 const policy=JSON.parse(readFileSync(f.policy,'utf8'));assert.equal(policy.approvers[0].public_key,key.public_key);assert.equal(policy.registration.identity_ref,f.trust['identity-ref']);
 const dry=await setupAdministrator({...f.options,stage:'dry-run',reason:'Explicit account grant review'},f.deps);assert.equal(dry.changed,false);assert.equal(dry.intent.target_id,user);
 const payload={...dry.approval_payload_template,approval_ref:'separate-grant-approval'};
 assert.throws(()=>verifyApproval({key_id:'staging-owner',payload,signature:''},policy,dry.intent,Date.now()));
 const signed=signApproval(payload,'staging-owner',before,policy,`APPROVE ${dry.intent.request_id}`,Date.now(),passphrase);
 assert.equal(verifyApproval(signed,policy,dry.intent,Date.now()).approver_id,'staging-owner');
 await assert.rejects(f.generate);await assert.rejects(()=>setupAdministrator({...f.trust,register:true,confirm:'REGISTER FIRST STAGING APPROVER'},f.deps));
 assert.equal(readFileSync(join(f.directory,'approval-private.pem'),'utf8'),before);
 assert.equal(JSON.stringify([generated,plan,result,dry]).includes(passphrase),false);assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);
}));
test('confirmation and ownership evidence stay explicit; no default registration',()=>isolated(async f=>{
 await assert.rejects(()=>setupAdministrator({...f.options,stage:'key',generate:true,confirm:'wrong'},f.deps));assert.equal(existsSync(join(f.home,'.jalisco-admin')),false);
 await f.generate();
 for(const edit of [{'identity-ref':''},{'approval-ref':''},{reason:''},{register:true,confirm:'wrong'}])await assert.rejects(()=>setupAdministrator({...f.trust,...edit},f.deps));
 assert.deepEqual(f.calls,[]);assert.equal(existsSync(f.policy),false);
}));
test('official UUID/email/confirmed/active/onboarding and remote scope checks precede registration',()=>isolated(async f=>{
 await f.generate();
 const apply={...f.trust,register:true,confirm:'REGISTER FIRST STAGING APPROVER'};
 for(const identity of [null,{id:'22222222-2222-4222-8222-222222222222',email,email_confirmed_at:'2026-01-01'},{id:user,email:'other@example.test',email_confirmed_at:'2026-01-01'},{id:user,email,email_confirmed_at:null},{id:user,email,email_confirmed_at:'2026-01-01',deleted_at:'2026-01-01'},{id:user,email,email_confirmed_at:'2026-01-01',banned_until:'2999-01-01'}]){
  await assert.rejects(()=>setupAdministrator(apply,{...f.deps,gateway:{...f.gateway,lookupUser:async()=>identity}}));assert.equal(existsSync(f.policy),false);
 }
 await assert.rejects(()=>setupAdministrator(apply,{...f.deps,gateway:{...f.gateway,account:async()=>({known:false})}}));
 await assert.rejects(()=>setupAdministrator(apply,{...f.deps,gateway:{...f.gateway,verifyScope:async()=>{throw Error('denied');}}}));assert.equal(existsSync(f.policy),false);
}));
test('receipt mismatch, unsafe permissions and symlinks reject automated handoff',()=>isolated(async f=>{
 await f.generate();const receipt=join(f.directory,'public-review.json'),original=readFileSync(receipt,'utf8');
 for(const edit of [v=>v.fingerprint='SHA256:'+'0'.repeat(64),v=>v.scope.project_ref='other',v=>v.algorithm='RSA',v=>v.registered=true]){const v=JSON.parse(original);edit(v);writeFileSync(receipt,JSON.stringify(v));assert.throws(()=>readPreparedKey(f.directory,f.root));}writeFileSync(receipt,original);
 chmodSync(receipt,0o644);assert.throws(()=>readPreparedKey(f.directory,f.root));chmodSync(receipt,0o600);
 const pub=join(f.directory,'approval-public.pub'),originalPub=readFileSync(pub);rmSync(pub);symlinkSync(receipt,pub);assert.throws(()=>readPreparedKey(f.directory,f.root));rmSync(pub);writeFileSync(pub,originalPub,{mode:0o600});
 chmodSync(join(f.home,'.jalisco-admin'),0o755);assert.throws(()=>readPreparedKey(f.directory,f.root));
 assert.equal(existsSync(f.policy),false);
}));
test('default storage rejects repository, unsafe or symlinked parent and existing trust',()=>isolated(async f=>{
 assert.throws(()=>prepareKey({email},{root:f.root,home:f.root}));
 mkdirSync(join(f.home,'.jalisco-admin'),{mode:0o755});await assert.rejects(f.generate);rmdirSync(join(f.home,'.jalisco-admin'));
 symlinkSync(f.root,join(f.home,'.jalisco-admin'));await assert.rejects(f.generate);rmSync(join(f.home,'.jalisco-admin'));
 writeFileSync(join(f.root,'staging/owner-root-public.json'),'existing root');await assert.rejects(f.generate);assert.equal(existsSync(f.directory),false);
}));
test('prepared-directory trust API rejects mixed manual fingerprints and never reads private material',()=>isolated(async f=>{
 await f.generate();rmSync(join(f.directory,'approval-private.pem'));
 const o={config:'wrangler.staging.jsonc',project:STAGING.project_ref,account:STAGING.account_id,database:STAGING.database_id,worker:STAGING.worker,approver:'synthetic','prepared-directory':f.directory,operator:'synthetic','identity-ref':'reviewed',reason:'review','approval-ref':'approved'};
 assert.equal(initializeTrust(o,f.root).changed,false);assert.throws(()=>initializeTrust({...o,fingerprint:'untrusted'},f.root));
}));
test('CLI cannot combine stages, apply, supply secrets, select a policy, or skip confirmation',()=>{
 for(const args of [['apply'],['--apply'],['trust','--generate'],['key','--register'],['plan','--confirm','anything'],['--token','secret'],['--passphrase','secret'],['--policy','other'],['--email','a@b.test','--email','a@b.test']])assert.throws(()=>parseSetupArgs(args));
 const plan=parseSetupArgs([]);assert.equal(plan.stage,'plan');assert.equal(plan.user,'51f007ac-f719-4219-81c8-94922fcacc1c');
 const output=execFileSync(process.execPath,['scripts/admin-setup.mjs'],{encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:'SENTINEL_CF',SUPABASE_ACCESS_TOKEN:'SENTINEL_SB'}});
 assert.equal(output.includes('SENTINEL'),false);assert.equal(JSON.parse(output).changed,false);
});
