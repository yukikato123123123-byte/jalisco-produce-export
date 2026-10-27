import type {Database} from './authState.ts';

type LaunchEnv={DB:Database;AUTH_ORIGIN:string;SESSION_ENCRYPTION_KEY?:string};
const reply=(value:unknown,status:number,retry?:number)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(retry?{'Retry-After':String(retry)}:{})}});
const fail=(code:string,status:number)=>reply({code},status);
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
export async function limitedBody(request:Request,maximum=2048){
 const reader=request.body?.getReader();if(!reader)return null;
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maximum){await reader.cancel();return 'too_large' as const;}chunks.push(part.value);}
 const data=new Uint8Array(size);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.byteLength;}
 try{const body:unknown=JSON.parse(new TextDecoder().decode(data));return body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:null;}catch{return null;}
}
export async function launchSubscription(request:Request,env:LaunchEnv):Promise<Response>{
 if(request.method!=='POST')return new Response(JSON.stringify({code:'method_not_allowed'}),{status:405,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Allow':'POST'}});
 // An independent public intake. It neither reads nor creates authentication sessions.
 const origin=new URL(request.url).origin;
 if(!env.AUTH_ORIGIN||origin!==env.AUTH_ORIGIN||request.headers.get('Origin')!==env.AUTH_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('origin_rejected',403);
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return fail('invalid_content_type',415);
 const length=request.headers.get('Content-Length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))return fail('request_too_large',413);
 try{
  const body=await limitedBody(request);if(body==='too_large')return fail('request_too_large',413);if(!body)return fail('invalid_request',400);
  const address=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(!address||address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||Array.from(address).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))return fail('invalid_email',400);
  if(body.consent!==true||body.consentVersion!=='nopal-launch-v1')return fail('consent_required',400);
  if(body.language!=='en'&&body.language!=='es')return fail('invalid_language',400);
  if(!env.DB)return fail('temporarily_unavailable',503);
  const now=Date.now(),bucket=Math.floor(now/600000),ip=request.headers.get('CF-Connecting-IP')??'local';
  // Match the existing Worker rate-limit pattern; never persist a raw IP or secret.
  const key=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`nopal-launch:${env.SESSION_ENCRYPTION_KEY??'local'}:${ip}:${bucket}`)));
  const rate=await env.DB.prepare('INSERT INTO nopal_launch_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,now+1200000).first<{attempts:number}>();
  if(!rate||rate.attempts>5)return reply({code:'rate_limited'},429,600-Math.floor(now/1000)%600);
  await env.DB.prepare('DELETE FROM nopal_launch_limits WHERE expires<?').bind(now).run();
  // Parameterized, atomic INSERT and trigger audit. Duplicate addresses do not change consent.
  // Same response for existing/new requests prevents public address enumeration.
  await env.DB.prepare('INSERT INTO nopal_launch_subscriptions(id,email,language,consent_version,consented_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),address,body.language,'nopal-launch-v1',new Date(now).toISOString()).run();
  const saved=await env.DB.prepare("SELECT s.id FROM nopal_launch_subscriptions s JOIN nopal_launch_events e ON e.subscription_id=s.id AND e.action='requested' WHERE s.email=?").bind(address).first<{id:string}>();
  if(!saved)return fail('temporarily_unavailable',503);
  return reply({status:'saved'},202);
 }catch{return fail('temporarily_unavailable',503);}
}
