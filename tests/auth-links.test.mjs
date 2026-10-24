import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthLink} from '../src/authLinks.ts';
import {fixture} from './helpers/auth-fixture.mjs';
const {Response}=globalThis;
test('URL parser separates hash proofs, implicit signup sessions, recovery and PKCE callbacks',()=>{
 const hash='synthetic-link-hash-proof';
 for(const type of ['signup','email','recovery']){
  const r=readAuthLink(`?token_hash=${hash}&type=${type}`,'');assert.equal(r.error,'');assert.equal(r.hash,hash);assert.equal(r.purpose,type==='recovery'?'recovery':'signup');
 }
 assert.equal(readAuthLink('','#type=signup&access_token=synthetic-access-token-value').accessToken,'synthetic-access-token-value');
 assert.equal(readAuthLink('?purpose=recovery','').purpose,'recovery');
 assert.equal(readAuthLink('?purpose=recovery','#type=recovery&access_token=synthetic-access-token-value').accessToken,'synthetic-access-token-value');
 assert.match(readAuthLink('?code=synthetic-auth-code','').error,/PKCE/);
 for(const query of ['?type=invite&token_hash='+hash,'?token_hash=x&type=signup','?type=signup','?token_hash='+hash,'?token=secret&type=signup','?access_token=secret'])assert.notEqual(readAuthLink(query,'').error,'');
 assert.match(readAuthLink(`?type=signup&token_hash=${hash}`,'#type=recovery').error,/conflicting/);
 assert.match(readAuthLink('?type=signup&type=recovery','').error,/conflicting/);
 for(const type of ['signup','recovery']){
  const r=readAuthLink(`?type=${type}&error_code=otp_expired&error_description=PRIVATE`, '');assert.match(r.error,/invalid, expired or already used/);assert.doesNotMatch(r.error,/PRIVATE/);
 }
});
test('hash confirmation validates one-time provider proof, expiry, reuse and purpose before issuing sessions',async()=>{
 const f=fixture();try{
  const hash=f.upstream.issueHash('signup');
  const r=await f.request('/api/auth/confirm-link',{token_hash:hash,type:'email'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal((await f.request('/api/auth/session',undefined,cookie)).status,200);
  assert.equal((await f.request('/api/auth/reset-password',{password:'not-allowed-password'},cookie)).status,403);
  const used=await f.request('/api/auth/confirm-link',{token_hash:hash,type:'signup'});assert.equal(used.status,400);assert.match((await used.json()).error,/invalid, expired or already used/);assert.equal(used.headers.get('set-cookie'),null);
  const expired=f.upstream.issueHash('signup','u1',1);f.upstream.advance(2);assert.equal((await f.request('/api/auth/confirm-link',{token_hash:expired,type:'signup'})).status,400);
  const recovery=f.upstream.issueHash('recovery');assert.equal((await f.request('/api/auth/confirm-link',{token_hash:recovery,type:'signup'})).status,400);
  for(const body of [{token_hash:hash,type:'invite'},{token_hash:'x',type:'signup'},{token_hash:hash,type:'signup',access_token:'synthetic-token'},{code:'synthetic-code',type:'signup'}])assert.equal((await f.request('/api/auth/confirm-link',body)).status,400);
 }finally{f.close();}
});
test('recovery hashes give only recovery authority and reset consumes local proof',async()=>{
 const f=fixture();try{
  const r=await f.request('/api/auth/confirm-link',{token_hash:f.upstream.issueHash('recovery'),type:'recovery'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await(await f.request('/api/auth/session',undefined,cookie)).json()).recovery,true);
  for(const path of ['/api/producer/dashboard','/api/buyer/dashboard'])assert.equal((await f.request(path,undefined,cookie)).status,403);
  assert.equal((await f.request('/api/auth/reset-password',{password:'new-test-password-123'},cookie)).status,200);assert.equal(f.upstream.stats.puts,1);
  assert.equal((await f.request('/api/auth/reset-password',{password:'another-test-password'},cookie)).status,401);
 }finally{f.close();}
});
test('password login errors are distinct from link verification and unconfirmed email',async()=>{
 const f=fixture();try{
  const bad=await f.request('/api/auth/login',{email:'test@example.test',password:'wrong-test-password'});assert.equal(bad.status,400);assert.match((await bad.json()).error,/Email or password is incorrect/);
  const fetcher=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({code:'email_not_confirmed'}, {status:400});
  const unconfirmed=await f.request('/api/auth/login',{email:'test@example.test',password:'wrong-test-password'});assert.equal(unconfirmed.status,400);assert.match((await unconfirmed.json()).error,/Confirm your email/);
  globalThis.fetch=fetcher;
 }finally{f.close();}
});

test('actual GoTrue 403 otp_expired is a verification rejection, while configuration failures remain 503',async()=>{
 const f=fixture();try{
  globalThis.fetch=async()=>Response.json({code:403,error_code:'otp_expired',msg:'PRIVATE'}, {status:403});
  const expired=await f.request('/api/auth/confirm-link',{token_hash:'0'.repeat(64),type:'signup'});
  assert.equal(expired.status,400);assert.match((await expired.json()).error,/invalid, expired or already used/);assert.equal(expired.headers.get('set-cookie'),null);
  assert.equal((await f.request('/api/auth/login',{email:'test@example.test',password:'test-password-123'})).status,503);
  globalThis.fetch=async()=>Response.json({message:'Invalid API key'}, {status:403});
  assert.equal((await f.request('/api/auth/confirm-link',{token_hash:'0'.repeat(64),type:'signup'})).status,503);
 }finally{f.close();}
});

// This provider model accepts only exact token strings it issued. Mutating a
// JWT claim without a valid provider signature is therefore rejected at /user.
function implicitProof(f, overrides={}, method='otp') {
 const issued=f.upstream.mint('u1','recovery'), proof=f.upstream.tokens.get(issued.access_token);
 f.upstream.tokens.delete(issued.access_token);
 const now=Math.floor(Date.now()/1000);
 const claims={iss:f.env.SUPABASE_URL+'/auth/v1',sub:'u1',exp:now+3600,iat:now,amr:[{method,timestamp:now}],nonce:issued.access_token,...overrides};
 const encode=s=>globalThis.btoa(JSON.stringify(s)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const token=encode({alg:'ES256',typ:'JWT'})+'.'+encode(claims)+'.synthetic_signature';
 f.upstream.tokens.set(token,proof);return token;
}
test('implicit recovery callback creates limited session, changes provider password once and supports new password login',async()=>{
 const f=fixture();try{
  const token=implicitProof(f), r=await f.request('/api/auth/callback',{access_token:token,type:'recovery'});
  assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=600/);const cookie=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await(await f.request('/api/auth/session',undefined,cookie)).json()).recovery,true);
  assert.equal((await f.request('/api/buyer/dashboard',undefined,cookie)).status,403);
  assert.equal((await f.request('/api/auth/callback',{access_token:token,type:'recovery'})).status,400);
  const reset=await f.request('/api/auth/reset-password',{password:'changed-synthetic-password-123'},cookie);assert.equal(reset.status,200);assert.equal(f.upstream.stats.puts,1);
  assert.equal(f.upstream.users.get('u1').password,'changed-synthetic-password-123');
  assert.equal((await f.request('/api/auth/session',undefined,cookie)).status,401);
  assert.equal((await f.request('/api/auth/callback',{access_token:token,type:'recovery'})).status,400);
  const login=await f.request('/api/auth/login',{email:'test@example.test',password:'changed-synthetic-password-123'});assert.equal(login.status,200);
 }finally{f.close();}
});
test('implicit recovery rejects password sessions, expired or stale email proofs, wrong subjects/issuers and forged JWTs',async()=>{
 const f=fixture();try{
  const now=Math.floor(Date.now()/1000);
  const tokens=[implicitProof(f,{},'password'),implicitProof(f,{exp:now-1}),implicitProof(f,{amr:[{method:'otp',timestamp:now-601}]}),implicitProof(f,{iss:'https://wrong-project.example/auth/v1'}),implicitProof(f,{sub:'another-user'}),implicitProof(f,{amr:[]})];
  for(const token of tokens){const r=await f.request('/api/auth/callback',{type:'recovery',access_token:token});assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);}
  const valid=implicitProof(f), forged=valid.replace('synthetic_signature','altered_signature');
  assert.equal((await f.request('/api/auth/callback',{type:'recovery',access_token:forged})).status,401);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
  assert.equal(f.upstream.stats.puts,0);
 }finally{f.close();}
});
test('implicit proof lifetime is capped by email-proof age and token expiry; concurrent replay loses atomically',async()=>{
 const f=fixture();try{
  const now=Math.floor(Date.now()/1000), token=implicitProof(f,{exp:now+100});
  const [a,b]=await Promise.all([f.request('/api/auth/callback',{type:'recovery',access_token:token}),f.request('/api/auth/callback',{type:'recovery',access_token:token})]);
  assert.deepEqual([a.status,b.status].sort(),[200,400]);const r=a.status===200?a:b;
  const age=Number(r.headers.get('set-cookie').match(/Max-Age=(\d+)/)[1]);assert.ok(age>0&&age<=100);
  const recent=implicitProof(f,{amr:[{method:'otp',timestamp:now-590}]});const short=await f.request('/api/auth/callback',{type:'recovery',access_token:recent});assert.equal(short.status,200);
  const shortAge=Number(short.headers.get('set-cookie').match(/Max-Age=(\d+)/)[1]);assert.ok(shortAge>0&&shortAge<=10);
 }finally{f.close();}
});
