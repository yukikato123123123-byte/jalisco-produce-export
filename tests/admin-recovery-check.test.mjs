import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ownerFixture,signature,edKey,approvalPolicy} from './helpers/owner-fixture.mjs';
import {checkRecovery} from '../scripts/admin-recovery-check.mjs';
import {hexDigest,GRANT_PROTOCOL,capabilities} from '../worker/owner/grants.ts';
import {OWNER_SCOPE,OWNER_ORIGIN} from '../worker/owner/crypto.ts';
const {URL}=globalThis;
test('offline readiness never upgrades references to ownership proof and changes no files',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jalisco-readiness-'));try{
  mkdirSync(join(dir,'staging'));writeFileSync(join(dir,'wrangler.staging.jsonc'),readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url)));
  const old=edKey(),policy=approvalPolicy(old);writeFileSync(join(dir,'staging/admin-approval-policy.json'),JSON.stringify(policy));writeFileSync(join(dir,'staging/approval-public.pub'),old.pem);
  const before=readdirSync(join(dir,'staging'));const plan=await checkRecovery({root:dir});assert.equal(plan.ready_for_execution,false);assert.equal(plan.human_review,'NOT_SUPPLIED');assert.equal(plan.root_file_present,false);assert.deepEqual(readdirSync(join(dir,'staging')),before);
  const f=await ownerFixture(),bootstrap=JSON.parse(f.env.OWNER_BOOTSTRAP_MANIFEST),p={operation:'activate_owner_admin_gateway',protocol:GRANT_PROTOCOL,scope:OWNER_SCOPE,origin:OWNER_ORIGIN,owner_id:bootstrap.payload.owner_id,bootstrap_sha256:await hexDigest(bootstrap),previous_policy_sha256:plan.preserved_policy_sha256,capabilities};
  const activation={payload:p,signature:signature(f.root,p),recovery_signature:signature(f.recovery,{operation:'accept_owner_admin_activation',role:'recovery',activation:p}),approval_signatures:[{key_id:f.approver.id,signature:signature(f.approver,{operation:'accept_owner_admin_activation',role:'approver',activation:p})}]};
  const bundle=join(dir,'bundle.json');writeFileSync(bundle,JSON.stringify({root:{scope:OWNER_SCOPE,public_key:f.root.public_key},bootstrap,activation}));
  const review=join(dir,'review.json'),r={scope:OWNER_SCOPE,review_id:'external-review',reviewer:'independent-reviewer',key_custodian:'custodian',cloudflare_ownership_ref:'cf-record',supabase_ownership_ref:'sb-record',independent_channel_ref:'channel-record',unrecoverable_key_ref:'owner-record',fingerprint_comparison_ref:'comparison-record',previous_policy_sha256:plan.preserved_policy_sha256};writeFileSync(review,JSON.stringify(r));
  const publicReport=await checkRecovery({root:dir,bundle});r.reviewed_artifacts=Object.fromEntries(['root_fingerprint','recovery_fingerprint','approval_fingerprints','bootstrap_sha256','activation_sha256'].map(k=>[k,publicReport.artifacts[k]]));writeFileSync(review,JSON.stringify(r));
  const report=await checkRecovery({root:dir,bundle,review});assert.equal(report.artifacts.cryptographically_valid,true);assert.equal(report.ready_for_execution,false);assert.equal(report.human_review,'REFERENCES_PRESENT_NOT_INDEPENDENTLY_VERIFIED');assert.equal(JSON.stringify(report).includes(f.pin),false);
  r.reviewer=r.key_custodian;writeFileSync(review,JSON.stringify(r));await assert.rejects(()=>checkRecovery({root:dir,bundle,review}));
  activation.recovery_signature='invalid';writeFileSync(bundle,JSON.stringify({root:{scope:OWNER_SCOPE,public_key:f.root.public_key},bootstrap,activation}));await assert.rejects(()=>checkRecovery({root:dir,bundle}));
  assert.equal(readFileSync(join(dir,'staging/admin-approval-policy.json'),'utf8'),JSON.stringify(policy));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
