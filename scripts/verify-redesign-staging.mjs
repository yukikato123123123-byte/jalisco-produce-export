// Read-only live smoke checks plus invalid-input/origin tests that never contact mail.
import console from 'node:console';
import {Buffer} from 'node:buffer';
const {fetch,AbortSignal}=globalThis;
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='https://jalisco-auth-staging.yukikato123123123.workers.dev';
const digest=value=>createHash('sha256').update(value).digest('hex');
const results=[];
async function check(path,expected,options){const response=await fetch(base+path,{signal:AbortSignal.timeout(20000),...options});const bytes=Buffer.from(await response.arrayBuffer());if(response.status!==expected)throw new Error(`${path}: expected ${expected}, received ${response.status}`);results.push({path,status:response.status,result:'PASS'});return bytes;}
const html=await check('/',200);
if(digest(html)!==digest(readFileSync('dist/index.html')))throw new Error('Live HTML differs from the verified build');
const paths=[...html.toString().matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m=>m[1]);
for(const path of paths){const bytes=await check(path,200);if(digest(bytes)!==digest(readFileSync('dist'+path)))throw new Error('Asset checksum mismatch');}
for(const path of ['/explore','/producers','/buyers','/logistics','/commercial','/readiness','/login','/signup','/verify-email','/forgot-password','/reset-password','/onboarding','/account','/producer/dashboard','/buyer/dashboard','/admin','/images/el-grullo-farm.jpeg','/images/el-grullo-fields.jpeg','/images/nopal-harvest.jpeg'])await check(path,200);
const producers=JSON.parse((await check('/api/public/producers',200)).toString());const products=JSON.parse((await check('/api/public/produce',200)).toString());const buyers=JSON.parse((await check('/api/public/buyers',200)).toString());
results.push({result:'PASS',liveProducerCount:producers.items.length,distinctProducerIds:new Set(producers.items.map(i=>i.id)).size,liveProductCount:products.items.length,liveBuyerCount:buyers.items.length});
for(const path of ['/api/auth/session','/api/producer/dashboard','/api/buyer/dashboard',...['overview','producers','buyers','products','inquiries','readiness','security'].map(v=>'/api/admin/'+v)])await check(path,401);
for(const path of ['/api/auth/login','/api/admin/actions'])await check(path,403,{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'});
for(const path of ['/api/auth/signup','/api/auth/login','/api/auth/forgot-password','/api/auth/resend','/api/auth/confirm-link'])await check(path,400,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
mkdirSync('.wrangler/redesign',{recursive:true});writeFileSync('.wrangler/redesign/live-http.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({result:'PASS',checks:results.length,htmlAndAssetChecksums:'match local build',producers:producers.items.length,products:products.items.length,buyers:buyers.items.length},null,2));
