// Public RFC test vector; no key generation, signing or live identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Buffer} from 'node:buffer';
import {createPublicKey} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {prepareAdministrator,parsePrepareArgs} from '../scripts/admin-prepare.mjs';
import {STAGING} from '../scripts/lib/admin-grant.mjs';
const {URL}=globalThis;
const pem=createPublicKey({key:Buffer.from('302a300506032b6570032100d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a','hex'),format:'der',type:'spki'}).export({format:'pem',type:'spki'});
const options={email:'synthetic@example.test',user:'11111111-1111-4111-8111-111111111111'};
function isolated(fn){
 const base=mkdtempSync(join(tmpdir(),'jalisco-prepare-')),root=join(base,'repo'),safe=join(base,'offline');
 mkdirSync(root);mkdirSync(safe,{mode:0o700});mkdirSync(join(root,'staging'));
 writeFileSync(join(root,'wrangler.staging.jsonc'),readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url)));
 try{return fn({root,safe});}finally{rmSync(base,{recursive:true,force:true});}
}
test('missing policy/key stays unverified; existing versus new planning never writes',()=>isolated(({root})=>{
 const before=readdirSync(join(root,'staging'));
 for(const mode of ['existing','new']){const r=prepareAdministrator({...options,'key-mode':mode},root);assert.equal(r.trust.policy,'MISSING');assert.equal(r.target.status,'UNVERIFIED_CANDIDATE');assert.equal(r.key_preparation.generated,false);assert.equal(r.changed,false);assert.match(r.next_action,mode==='new'?/Approve a separate offline/:/Provide the existing/);}
 assert.deepEqual(readdirSync(join(root,'staging')),before);
}));
test('discovers public files, computes shared fingerprint and never assumes approval',()=>isolated(({root})=>{
 writeFileSync(join(root,'staging/test.pub'),pem);const r=prepareAdministrator(options,root);
 const key=r.key_preparation.keys[0];assert.equal(key.status,'VALID_PUBLIC_KEY');assert.match(key.fingerprint,/^SHA256:[a-f0-9]{64}$/);assert.equal(key.approval,'UNVERIFIED');assert.equal(key.policy_match,false);
 assert.equal(readdirSync(join(root,'staging')).length,1);
}));
test('existing policy matches only public material; its signer identity is still unverified',()=>isolated(({root})=>{
 writeFileSync(join(root,'staging/test.pub'),pem);
 writeFileSync(join(root,'staging/admin-approval-policy.json'),JSON.stringify({scope:STAGING,approvers:[{id:'local-approver',public_key:pem}]}));
 const r=prepareAdministrator(options,root);assert.equal(r.trust.policy,'PRESENT_UNVERIFIED');assert.equal(r.key_preparation.keys[0].policy_match,true);assert.equal(r.trust.external_records,'UNVERIFIED');
 assert.equal(r.key_preparation.keys.every(k=>k.approval==='UNVERIFIED'),true);
}));
test('wrong-scope, empty and malformed policy blocks rather than falling back to fresh trust',()=>isolated(({root})=>{
 for(const value of ['{',JSON.stringify({scope:STAGING,approvers:[]}),JSON.stringify({scope:{...STAGING,worker:'other'},approvers:[{id:'one',public_key:pem}]})]){
  writeFileSync(join(root,'staging/admin-approval-policy.json'),value);const r=prepareAdministrator(options,root);assert.equal(r.trust.policy,'INVALID_OR_UNSAFE');assert.match(r.next_action,/STOP/);
 }
}));
test('owner-root presence, even dangling symlink, blocks direct enrollment guidance',()=>isolated(({root})=>{
 symlinkSync(join(root,'absent'),join(root,'staging/owner-root-public.json'));const r=prepareAdministrator(options,root);assert.match(r.trust.owner_root,/PRESENT/);assert.match(r.next_action,/STOP/);
}));
test('explicit external private path is metadata-only and never appears in report',()=>isolated(({root,safe})=>{
 const path=join(safe,'private-sentinel'),sentinel='synthetic-private-content-must-never-be-reported';writeFileSync(path,sentinel,{mode:0o600});
 const r=prepareAdministrator({...options,'private-key':path},root),output=JSON.stringify(r);
 assert.equal(r.key_preparation.private_key,'EXISTS_NOT_READ_OR_MATCHED');assert.equal(r.key_preparation.private_key_content_read,false);assert.equal(output.includes(sentinel),false);assert.equal(output.includes(path),false);
 assert.equal(readFileSync(path,'utf8'),sentinel);
 chmodSync(path,0o644);assert.throws(()=>prepareAdministrator({...options,'private-key':path},root));
}));
test('missing external private path remains a plan; unsafe/repository/symlink paths rejected',()=>isolated(({root,safe})=>{
 const missing=join(safe,'new-key');assert.equal(prepareAdministrator({...options,'private-key':missing,'key-mode':'new'},root).key_preparation.private_key,'ABSENT_NOT_CREATED');
 for(const path of ['relative.pem',join(root,'key.pem')])assert.throws(()=>prepareAdministrator({...options,'private-key':path},root));
 writeFileSync(join(safe,'target'),'not a key',{mode:0o600});symlinkSync(join(safe,'target'),join(safe,'alias'));
 assert.throws(()=>prepareAdministrator({...options,'private-key':join(safe,'alias')},root));assert.deepEqual(readdirSync(safe).sort(),['alias','target']);
}));
test('bad and symlink public inputs disclose no raw file content',()=>isolated(({root,safe})=>{
 writeFileSync(join(root,'staging/bad.pub'),'SYNTHETIC_SENSITIVE_MARKER');writeFileSync(join(safe,'key.pub'),pem);symlinkSync(join(safe,'key.pub'),join(root,'staging/alias.pub'));
 const r=prepareAdministrator(options,root);assert.equal(r.key_preparation.keys.every(k=>k.status==='INVALID_OR_UNSAFE'),true);assert.equal(JSON.stringify(r).includes('SYNTHETIC_SENSITIVE_MARKER'),false);
 assert.throws(()=>prepareAdministrator({...options,'public-key':'../key.pub'},root));
}));
test('wrong configuration and unsafe staging directory reject',()=>isolated(({root,safe})=>{
 const config=join(root,'wrangler.staging.jsonc'),old=readFileSync(config,'utf8');writeFileSync(config,'{"name":"other"}');assert.throws(()=>prepareAdministrator(options,root));writeFileSync(config,old);
 rmSync(join(root,'staging'),{recursive:true});symlinkSync(safe,join(root,'staging'));assert.throws(()=>prepareAdministrator(options,root));
}));
test('candidate/argument validation rejects token, signing and apply options',()=>isolated(({root})=>{
 for(const o of [{...options,email:'bad'},{...options,email:'a\u001b@b.test'},{...options,user:'invalid'},{...options,'key-mode':'generate'}])assert.throws(()=>prepareAdministrator(o,root));
 for(const args of [['--apply'],['--token','sentinel'],['--register'],['--email','a@b.test','--email','c@d.test'],['--email']])assert.throws(()=>parsePrepareArgs(args));
 assert.deepEqual(parsePrepareArgs(['--email',options.email]),{email:options.email});
}));
test('actual CLI is local-only, redacts environment sentinels and supports no writes',()=>{
 const output=execFileSync(process.execPath,[new URL('../scripts/admin-prepare.mjs',import.meta.url).pathname,'--email',options.email],{encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:'DO_NOT_PRINT_CF',SUPABASE_ACCESS_TOKEN:'DO_NOT_PRINT_SB'}});
 assert.equal(output.includes('DO_NOT_PRINT'),false);assert.match(output,/no writes \/ no network/);assert.match(output,/values NOT READ/);assert.match(output,/UUID: NOT PROVIDED/);assert.ok(output.split('\n').length<22);
});
