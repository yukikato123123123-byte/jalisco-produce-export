// Synthetic keys/PINs live only in process memory; no private-key files.
import {generateKeyPairSync,sign,randomUUID,randomBytes} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {OwnerAuthority,publicPolicyRoot} from '../../worker/owner/authority.ts';
import {OWNER_SCOPE,OWNER_ORIGIN,canonical,encode,createPinVerifier} from '../../worker/owner/crypto.ts';
const {Request,structuredClone}=globalThis;
export class MemoryOwnerStorage {
 constructor(){this.values=new Map();this.tail=Promise.resolve();this.failPut=false;this.putCalls=0;this.failAtPut=-1;}
 async get(key='owner-authority-pin-key-v1'){return structuredClone(this.values.get(key||'owner-authority-pin-key-v1'));}
 async put(key,value){if(this.failPut)throw Error('Synthetic unavailable audit storage');this.values.set(key||'owner-authority-pin-key-v1',structuredClone(value));}
 async transaction(fn){const previous=this.tail;let release;this.tail=new Promise(r=>release=r);await previous;const values=structuredClone(this.values);try{const result=await fn({get:async key=>structuredClone(values.get(key)),put:async(key,v)=>{this.putCalls++;if(this.failPut||this.putCalls===this.failAtPut)throw Error('Synthetic unavailable audit storage');values.set(key,structuredClone(v));}});this.values=values;return result;}finally{release();}}
}
export function edKey(){const p=generateKeyPairSync('ed25519');return {id:randomUUID(),privateKey:p.privateKey,public_key:p.publicKey.export({format:'jwk'}).x,pem:p.publicKey.export({format:'pem',type:'spki'})};}
export const signature=(key,payload)=>sign(null,Buffer.from(canonical(payload)),key.privateKey).toString('base64url');
export const approvalPolicy=key=>({scope:OWNER_SCOPE,approvers:[{id:key.id,public_key:key.pem}]});
export async function ownerFixture(){
 const root=edKey(),recovery=edKey(),approver=edKey(),pepper=encode(randomBytes(32)),pin=[...randomBytes(11)].map(n=>n%10).join(''),owner_id=randomUUID();
 const payload={operation:'owner_bootstrap',protocol:'owner-pin-key-v1',scope:OWNER_SCOPE,origin:OWNER_ORIGIN,owner_id,epoch:1,recovery:{id:recovery.id,public_key:recovery.public_key},pin:await createPinVerifier(pin,pepper,owner_id),policy:approvalPolicy(approver)};
 const bootstrap={payload,signature:signature(root,payload),policy_signature:signature(root,publicPolicyRoot(payload))};const env={OWNER_ROOT_PUBLIC_KEY:root.public_key,OWNER_BOOTSTRAP_MANIFEST:JSON.stringify(bootstrap),OWNER_PIN_PEPPER:pepper},storage=new MemoryOwnerStorage(),authority=new OwnerAuthority({storage},env);
 const request=async(path,body,headers={})=>authority.fetch(new Request(OWNER_ORIGIN+'/api/owner/'+path,{method:body?'POST':'GET',headers:{...(body?{Origin:OWNER_ORIGIN,'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined}));
 async function prepare(current=recovery){const next=edKey(),nextApprover=edKey();const c=await(await request('challenge',{kind:'recover',request_id:randomUUID(),next_recovery:{id:next.id,public_key:next.public_key},next_policy:approvalPolicy(nextApprover)})).json();const payload=c.intent;return {next,nextApprover,c,payload,body:{challenge_id:c.challenge_id,signature:signature(current,payload),next_signature:signature(next,{operation:'accept_recovery_key',payload}),pin}};}
 return {root,recovery,approver,pin,pepper,env,storage,authority,request,prepare};
}
