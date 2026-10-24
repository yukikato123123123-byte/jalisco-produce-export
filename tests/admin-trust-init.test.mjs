// Published public test vectors only: no private keys, key generation or signing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,lstatSync,readdirSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Buffer} from 'node:buffer';
import {createPublicKey,createHash} from 'node:crypto';
import {initializeTrust,parseTrustArgs} from '../scripts/admin-trust-init.mjs';
import {STAGING,verifyApproval} from '../scripts/lib/admin-grant.mjs';
const {URL}=globalThis;
// RFC 8032 test vector public key, not a real approver.
const der=Buffer.from('302a300506032b6570032100d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a','hex');
const publicPem=createPublicKey({key:der,format:'der',type:'spki'}).export({format:'pem',type:'spki'});
const fingerprint='SHA256:'+createHash('sha256').update(der).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'jalisco-trust-test-'));mkdirSync(join(root,'staging'),{mode:0o700});
 writeFileSync(join(root,'wrangler.staging.jsonc'),readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url)));
 writeFileSync(join(root,'test.pub'),publicPem);
 const o={config:'wrangler.staging.jsonc',project:STAGING.project_ref,account:STAGING.account_id,database:STAGING.database_id,worker:STAGING.worker,approver:'synthetic-approver','public-key':'test.pub',fingerprint,operator:'synthetic-project-manager','identity-ref':'local-identity-review-1',reason:'Synthetic initial enrollment','approval-ref':'local-approval-1'};
 const policy=join(root,'staging/admin-approval-policy.json');
 return {root,o,policy,register:()=>initializeTrust({...o,register:true,confirm:`REGISTER STAGING APPROVER ${o.approver} ${fingerprint}`},root),close:()=>rmSync(root,{recursive:true,force:true})};
}
function isolated(fn){const f=fixture();try{return fn(f);}finally{f.close();}}
test('default plan never writes; explicit registration is compatible with existing approval verification',()=>isolated(f=>{
 assert.equal(initializeTrust(f.o,f.root).changed,false);assert.equal(existsSync(f.policy),false);
 assert.equal(f.register().changed,true);const p=JSON.parse(readFileSync(f.policy,'utf8'));
 assert.deepEqual(p.scope,STAGING);assert.equal(p.approvers[0].public_key,publicPem);assert.equal(p.registration.fingerprint,fingerprint);assert.equal(p.registration.operator,f.o.operator);
 assert.equal(lstatSync(f.policy).mode&0o777,0o600);
 const now=Date.now(),intent={synthetic:true};
 assert.throws(()=>verifyApproval({key_id:f.o.approver,payload:{intent,approval_ref:'test-approval',issued_at:new Date(now).toISOString(),expires_at:new Date(now+60000).toISOString()},signature:''},p,intent,now),/signature is invalid/);
 assert.deepEqual(readdirSync(join(f.root,'staging')),['admin-approval-policy.json']);
}));
test('all fixed scope/config fields reject substitutions',()=>isolated(f=>{
 for(const field of ['config','project','account','database','worker'])assert.throws(()=>initializeTrust({...f.o,[field]:'wrong'},f.root));
 const path=join(f.root,'wrangler.staging.jsonc'),original=readFileSync(path,'utf8');
 for(const edit of [c=>c.account_id='wrong',c=>c.d1_databases[0].database_id='wrong',c=>c.vars.SUPABASE_URL='https://wrong.supabase.co',c=>c.name='production']){
  const c=JSON.parse(original.replace(/^\s*\/\/.*$/gm,''));edit(c);writeFileSync(path,JSON.stringify(c));assert.throws(()=>initializeTrust(f.o,f.root));
 }
 assert.equal(existsSync(f.policy),false);
}));
test('missing inputs and exact confirmation are mandatory',()=>isolated(f=>{
 for(const field of Object.keys(f.o)){const o={...f.o};delete o[field];assert.throws(()=>initializeTrust(o,f.root));}
 assert.throws(()=>initializeTrust({...f.o,register:true,confirm:'REGISTER'},f.root));assert.equal(existsSync(f.policy),false);
}));
test('fingerprint must exactly match SHA256 of public SPKI DER',()=>isolated(f=>{
 for(const fp of ['SHA256:'+'0'.repeat(64),fingerprint.toUpperCase(),''])assert.throws(()=>initializeTrust({...f.o,fingerprint:fp},f.root));
 assert.equal(existsSync(f.policy),false);
}));
test('malformed, wrong-algorithm and multiple public keys are rejected',()=>isolated(f=>{
 const ec=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:Buffer.from('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296','hex').toString('base64url'),y:Buffer.from('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5','hex').toString('base64url')}}).export({format:'pem',type:'spki'});
 for(const value of ['not a key',publicPem+publicPem,ec,'x'.repeat(4097)]){writeFileSync(join(f.root,'test.pub'),value);assert.throws(()=>initializeTrust(f.o,f.root));}
 assert.equal(existsSync(f.policy),false);
}));
test('existing policy or owner root, including dangling symlinks, always blocks',()=>{
 for(const name of ['admin-approval-policy.json','owner-root-public.json'])for(const symbolic of [false,true])isolated(f=>{
  const path=join(f.root,'staging',name);if(symbolic)symlinkSync(join(f.root,'missing'),path);else writeFileSync(path,'existing marker');
  assert.throws(()=>f.register());assert.ok(lstatSync(path));if(!symbolic)assert.equal(readFileSync(path,'utf8'),'existing marker');
 });
});
test('duplicate registration never replaces a policy',()=>isolated(f=>{
 f.register();const before=readFileSync(f.policy,'utf8');assert.throws(()=>f.register());assert.equal(readFileSync(f.policy,'utf8'),before);
}));
test('path traversal, absolute paths, input/config symlinks and staging symlinks are rejected',()=>isolated(f=>{
 for(const path of ['../test.pub','staging/../test.pub',join(f.root,'test.pub')])assert.throws(()=>initializeTrust({...f.o,'public-key':path},f.root));
 symlinkSync(join(f.root,'test.pub'),join(f.root,'alias.pub'));assert.throws(()=>initializeTrust({...f.o,'public-key':'alias.pub'},f.root));
 const config=join(f.root,'wrangler.staging.jsonc');rmSync(config);symlinkSync(join(f.root,'test.pub'),config);assert.throws(()=>initializeTrust(f.o,f.root));
}));
test('staging directory must be real and not writable by other OS users',()=>isolated(f=>{
 const dir=join(f.root,'staging');chmodSync(dir,0o777);assert.throws(()=>initializeTrust(f.o,f.root));chmodSync(dir,0o700);rmSync(dir,{recursive:true});symlinkSync(f.root,dir);assert.throws(()=>initializeTrust(f.o,f.root));
}));
test('CLI rejects unknown paths/options, duplicate flags and missing values',()=>{
 for(const args of [['--out','../policy'],['--root','/tmp'],['--config'],['--register','--register'],['--approver','one','--approver','two']])assert.throws(()=>parseTrustArgs(args));
 assert.deepEqual(parseTrustArgs(['--register']),{register:true});
});
