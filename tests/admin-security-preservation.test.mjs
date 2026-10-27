import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import ts from 'typescript';
const protectedFiles={
  "worker/authState.ts": "39c90df86356961d886dfa004c995010b2081686ccb4e27648737dc7f8951b7f",
  "worker/provider.ts": "748cbf24f322b25486893da43ac8b6e5e356855a709643272ec0e6e1eda618e6",
  "worker/environment.ts": "eb64115476c139f0ed8101c123acf3deebbb9d5ee36f019539c4137e3c5883ec",
  "worker/implicitRecovery.ts": "e52d53f3310e5a2387a7e275ca620cf65879b5925a2b5758bcb3c1941ca09d0f",
  "worker/owner/crypto.ts": "c7254d32f0e43f25cd6864ff7a71b0ecd5be6a3c2bd90f6857d4e50a0c400120",
  "worker/owner/authority.ts": "6d16decfcfca9e668c685a9333d1de997404af5c7ff4c3cafd3f4182d1a95866",
  "worker/owner/ui.ts": "04d1666d6b9a0abe8be9bfbf9d73cdcca77e2ffd8794477f906983a4de6fbf9b",
  "worker/owner/grants.ts": "358e492838878a1185682bc24f7805d6dd30ad7d7c5b54e15b21947c51aaf2d3",
  "worker/owner/gateway.ts": "98b6ea597a7f7a5a71fb8dd314a5908132a12c0ae3147d221e9c9b7f4fdb3d62",
  "worker/owner/router.ts": "7bb1645955d6336f7206d376854462e0228cca758dc26ecc38a321715dabdbfb",
  "migrations/0001_auth.sql": "496ef292228a972dc2aadcbfbd09a9928def3956f02209ab5e4aa1de6544286a",
  "migrations/0012_registration_reviews.sql": "050b101a9a485a0d18e14b777326e887f89e305ee3f7d5e255dbb4a2fc166361",
  "migrations/0003_auth_generations.sql": "5c37924c826c031cfdfcbe1d7f5220f511db6be7a472ac85cfe0cfcdf19c2ed4",
  "migrations/0013_product_images.sql": "35a4b01016c75b39e988520e0f203e8eefdc4b1370d9a4884d7892f9e72bfb44",
  "migrations/0007_admin_operations.sql": "a32918355b003b161649cb8e8d734eaf6d30332e31442d2a6af032c4e19f9eb6",
  "migrations/0006_buyer_publication.sql": "2f85bcc11341a92766c975896cf3aea15d6e987d143464c98d67f36ad27c29e7",
  "migrations/0015_nopal_launch_subscriptions.sql": "efb7740b142a2c9d6ba1f151d11411add7010729091a032b6d05a4a6450d39af",
  "migrations/0005_buyer_center.sql": "90c54e785db4e5ed245bd894f549ae3bdfc8b4907c82bf49be791a8efeb6b41a",
  "migrations/0011_inquiry_workflow.sql": "7721665ad6dcb1f0930c992403ead4d22e984a009560ca4dc14eb142d952cfff",
  "migrations/0010_inquiries.sql": "df0417cf0ca552b5b9645e0ebb81f6c4be13f354114b2977ba20b9222184487b",
  "migrations/0009_owner_command_receipts.sql": "172f738cee6f937ece7c6752d6e87fc4e28a7789ef28ac5c4feb07483ccbd1f2",
  "migrations/0002_limits_index.sql": "4250169077ae8f06773ec11ea6a5d6ed1570553513cc8b863f31879649d7403e",
  "migrations/0008_admin_grant_events.sql": "20cde025aa43af347ba88b28ab026f423e94379e940bd4fa5f9ca92f7c9b6379",
  "migrations/0016_nopal_customer_feedback.sql": "154570ebf5e7fa7774cc087195c11ee03e1b1b436485127d191bde439c76d158",
  "migrations/0004_producer_workspace.sql": "2f87885a4b8d314ef43668140283d40b311279abe71c42122dd2bb008be3e75e",
  "migrations/0014_admin_notifications_drafts.sql": "25a9a385cb8acf93b040250db70ee29d87934d9ebd5142ff6fa97fa2327ec330",
  "migrations/0017_nopahua_research.sql": "8f1db00415b197dd275f7a7e1e9b56159e5c5a69d773ed1b54b0661453b0e73d",
  "wrangler.staging.jsonc": "616eedc1661cafdbdf3376cf7a310692eb77001ee85e1bc324d89834ffbd1ad5",
  "wrangler.jsonc": "4ee45171dff03453942d7e223c752905dfd395e724b7bd27f9dd5b8fef6b4336",
  "wrangler.production.jsonc": "1674b7a215bb4484cf3d2c21d3ded3c9fce243ceaef3e51f6973f66c3c370f4e",
  "wrangler.local.jsonc": "9fb86f816748e837cae5d9e80a3a816342b96d4b6780afc226689d046d34ab38"
};
test('integration leaves authentication, owner authority, SQL policies and deployment configuration byte-identical',()=>{for(const [path,hash] of Object.entries(protectedFiles))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);});
const protectedFunctions={"worker/index.ts": ["key", "cookieName", "cookie", "sessionId", "email", "password", "profile", "readSession", "createSession", "resetUncertain", "limitSessionReads"], "worker/admin.ts": ["hasAdministratorGrant"]};
const functionHashes={
  "worker/index.ts:key": "3ccf03ef55537f55e299bd530972ffcee758c0b6219d21b014164b476ee5402b",
  "worker/index.ts:cookieName": "78b05c3b1f91fba9cc67e93dabea42127d8189a071c03d2b07120f11c019fe08",
  "worker/index.ts:cookie": "42ea119fdae6eaa71123d07ae1368e9765a3f3c86e4b90a4f3124c34b7cc5b80",
  "worker/index.ts:sessionId": "0103abc1813b867134fffbf219d6be8bc2269842acde10ef51b409a267ac74ed",
  "worker/index.ts:email": "b96b8801708a49dfb8f6d243dc2efcf11d601ef07a937caa1cfc5e0828189c77",
  "worker/index.ts:password": "0b18533fdce8b7064157f48dbc51753a8602307a13d5c3baffe78908abecf4d6",
  "worker/index.ts:profile": "07050cf8f1d1d8d216898b8e9b4c8a2752b3aec3810860ea737ac1a77bac35bf",
  "worker/index.ts:readSession": "813ce4da7d73fa29f1012199553a28728d94e287938555b573c8e47cd64bc556",
  "worker/index.ts:createSession": "bb4a8b36021812739820f1c075ba52f5cfc2314a80a61d28e15d9164ecc4fe80",
  "worker/index.ts:resetUncertain": "0964b8ff5ca65534ec49564eec096eb989824d995c224cdd03cca7733cc43ef6",
  "worker/index.ts:limitSessionReads": "60face47d28c026da72c89cac64d7a9ef8ed6206988c72a16411a5828dcb4156",
  "worker/admin.ts:hasAdministratorGrant": "4e28fab59c314a708ad00fed6a92c8d9892c411d25d5a0c302226a5a7d52a505"
};
test('routing additions leave every authentication helper and grant predicate unchanged',()=>{for(const [path,names] of Object.entries(protectedFunctions)){const s=readFileSync(path,'utf8'),f=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true);for(const name of names){const n=f.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n,name);assert.equal(createHash('sha256').update(n.getText(f)).digest('hex'),functionHashes[path+':'+name],name);}}});
