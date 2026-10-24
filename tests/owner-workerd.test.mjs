import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ownerFixture,signature} from './helpers/owner-fixture.mjs';
import {OWNER_ORIGIN} from '../worker/owner/crypto.ts';
const {URL}=globalThis;const require=createRequire(new URL('../node_modules/wrangler/package.json',import.meta.url));const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
test('actual SQLite Durable Object atomically recovers with PIN and offline signatures only',{timeout:30000},async()=>{
 const f=await ownerFixture(),p=await f.prepare();const bundle=await build({stdin:{contents:"import {OwnerAuthority} from './worker/owner/authority.ts';export {OwnerAuthority};export default {fetch(r,e){return e.OWNER_AUTHORITY.get(e.OWNER_AUTHORITY.idFromName('synthetic')).fetch(r)}}",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-21',durableObjects:{OWNER_AUTHORITY:{className:'OwnerAuthority',useSQLite:true}},bindings:f.env}));
 try{const request=(path,body,headers={})=>mf.dispatchFetch(OWNER_ORIGIN+'/api/owner/'+path,{method:body?'POST':'GET',headers:{...(body?{Origin:OWNER_ORIGIN,'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const c=await(await request('challenge',{kind:'recover',request_id:p.payload.request_id,next_recovery:p.payload.next_recovery,next_policy:p.payload.next_policy})).json();const payload=c.intent,body={challenge_id:c.challenge_id,pin:f.pin,signature:signature(f.recovery,payload),next_signature:signature(p.next,{operation:'accept_recovery_key',payload})};const results=await Promise.all([request('recover',body),request('recover',body)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const cookie=results.find(r=>r.status===200).headers.get('Set-Cookie').split(';')[0];assert.equal((await request('session',undefined,{Cookie:cookie})).status,200);assert.equal((await request('recover',body)).status,409);assert.equal((await(await request('policy/current')).json()).epoch,2);
 }finally{await mf.dispose();}
});
