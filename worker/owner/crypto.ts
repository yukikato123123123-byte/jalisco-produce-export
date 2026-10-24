// No private keys or plaintext PINs are persisted by this module.
export const OWNER_SCOPE = Object.freeze({project_ref:'heaswpawzuuijxurlfoz',account_id:'89dd3e659cece6bdf3181b991a2a0bd2',database_id:'7712d6bb-2414-44d3-9282-cb5b941d740e',worker:'jalisco-auth-staging'});
export const OWNER_ORIGIN='https://jalisco-auth-staging.yukikato123123123.workers.dev';
export const PIN_ITERATIONS=600_000;
export function canonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
}
export const bytes=(value:string)=>new TextEncoder().encode(value);
export function encode(value:Uint8Array):string{return btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decode(value:string):Uint8Array<ArrayBuffer>{if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value)||value.length>16384)throw new Error('Invalid encoding');const decoded=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));if(encode(decoded)!==value)throw new Error('Non-canonical encoding');return decoded;}
export const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value:string):Promise<string>{return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(value))));}
export async function publicRecoveryKey(raw:string):Promise<CryptoKey>{const b=decode(raw);if(b.length!==32)throw new Error('Invalid key');return crypto.subtle.importKey('raw',b,'Ed25519',false,['verify']);}
export async function verifySignature(raw:string,payload:unknown,signature:string):Promise<boolean>{try{return await crypto.subtle.verify('Ed25519',await publicRecoveryKey(raw),decode(signature),bytes(canonical(payload)));}catch{return false;}}
export type PinVerifier={algorithm:'PBKDF2-SHA256-HMAC-SHA256';iterations:number;salt:string;verifier:string};
async function pinMac(pin:string,salt:string,pepper:string,ownerId:string):Promise<Uint8Array<ArrayBuffer>> {
 if(!/^[0-9]{11}$/.test(pin)||decode(pepper).length!==32||decode(salt).length!==16)throw new Error('Invalid PIN configuration');
 const key=await crypto.subtle.importKey('raw',bytes(pin),'PBKDF2',false,['deriveBits']);
 const stretched=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:decode(salt),iterations:PIN_ITERATIONS},key,256);
 const mac=await crypto.subtle.importKey('raw',decode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',mac,bytes(canonical({domain:'jalisco-owner-pin-v1',scope:OWNER_SCOPE,owner_id:ownerId,salt,stretched:encode(new Uint8Array(stretched))}))));
}
export async function createPinVerifier(pin:string,pepper:string,ownerId:string):Promise<PinVerifier>{const salt=encode(crypto.getRandomValues(new Uint8Array(16)));return {algorithm:'PBKDF2-SHA256-HMAC-SHA256',iterations:PIN_ITERATIONS,salt,verifier:encode(await pinMac(pin,salt,pepper,ownerId))};}
export function validatePinVerifier(v:PinVerifier):void{if(!v||Object.keys(v).some(k=>!['algorithm','iterations','salt','verifier'].includes(k))||v?.algorithm!=='PBKDF2-SHA256-HMAC-SHA256'||v.iterations!==PIN_ITERATIONS||decode(v.salt).length!==16||decode(v.verifier).length!==32)throw new Error('Invalid PIN verifier');}
export async function checkPin(pin:string,v:PinVerifier,pepper:string,ownerId:string):Promise<boolean>{validatePinVerifier(v);if(!/^[0-9]{11}$/.test(pin))return false;const actual=await pinMac(pin,v.salt,pepper,ownerId),expected=decode(v.verifier);let difference=actual.length^expected.length;for(let i=0;i<actual.length;i++)difference|=actual[i]^expected[i];return difference===0;}
export type ApprovalPolicy={scope:typeof OWNER_SCOPE;approvers:{id:string;public_key:string;disabled?:boolean}[]};
export async function validatePolicy(policy:ApprovalPolicy):Promise<void>{
 if(!policy||Object.keys(policy).some(k=>!['scope','approvers'].includes(k))||canonical(policy?.scope)!==canonical(OWNER_SCOPE)||!Array.isArray(policy.approvers)||policy.approvers.length<1||policy.approvers.length>4)throw new Error('Invalid policy');
 const ids=new Set<string>(),keys=new Set<string>();for(const entry of policy.approvers){if(Object.keys(entry).some(k=>!['id','public_key','disabled'].includes(k))||!/^[A-Za-z0-9_-]{1,80}$/.test(entry.id)||ids.has(entry.id)||keys.has(entry.public_key)||entry.disabled!==undefined&&entry.disabled!==false)throw new Error('Invalid approver');ids.add(entry.id);keys.add(entry.public_key);
 const pem=entry.public_key;if(typeof pem!=='string'||pem.length>200||!/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(pem))throw new Error('Public key required');
 const der=Uint8Array.from(atob(pem.replace(/-----[^\n]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));await crypto.subtle.importKey('spki',der,'Ed25519',false,['verify']);}
}
