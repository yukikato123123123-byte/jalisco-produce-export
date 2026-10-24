import {createPublicKey,createHash} from 'node:crypto';
import {lstatSync,realpathSync,openSync,fstatSync,readFileSync,closeSync,constants,mkdirSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep,dirname,join} from 'node:path';
import {homedir} from 'node:os';
import process from 'node:process';
import {STAGING,canonical} from './admin-grant.mjs';

const fail=()=>{throw Error('Protected approval material is missing, unsafe, or inconsistent.');};
const exists=p=>{try{return lstatSync(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const within=(a,b)=>{const p=relative(a,b);return p===''||(!p.startsWith('..'+sep)&&p!=='..'&&!isAbsolute(p));};
export function inspectPublicKey(pem){
 if(typeof pem!=='string'||pem.length>4096||!/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(pem))fail();
 let key;try{key=createPublicKey(pem);}catch{fail();}if(key.asymmetricKeyType!=='ed25519')fail();
 return {public_key:key.export({format:'pem',type:'spki'}),fingerprint:'SHA256:'+createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex')};
}
function directory(path,privateMode=true){
 const s=lstatSync(path);
 if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(path)!==path||s.uid!==process.getuid()||(s.mode&(privateMode?0o077:0o022)))fail();
}
export function keyDestination(root,{directory:explicit,home=homedir(),createParent=false}={}){
 root=realpathSync(root);
 const base=join(home,'.jalisco-admin'),destination=explicit??join(base,STAGING.project_ref);
 if(!isAbsolute(destination)||resolve(destination)!==destination||within(root,destination)||within(destination,root))fail();
 const parent=dirname(destination);
 if(!explicit&& !exists(base)){
  directory(home,false);
  if(createParent)mkdirSync(base,{mode:0o700});
  else return destination;
 }
 directory(parent);
 return destination;
}
function readProtected(path,max){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)||s.size>max||s.nlink!==1)fail();return readFileSync(fd,'utf8');}finally{closeSync(fd);}
}
export function readPreparedKey(path,root){
 keyDestination(root,{directory:path});directory(path);
 const key=inspectPublicKey(readProtected(join(path,'approval-public.pub'),4096));
 let receipt;try{receipt=JSON.parse(readProtected(join(path,'public-review.json'),16384));}catch{fail();}
 if(canonical(receipt.scope)!==canonical(STAGING)||receipt.algorithm!=='Ed25519'||receipt.fingerprint!==key.fingerprint||receipt.registered!==false||receipt.approval!=='UNVERIFIED')fail();
 // No private key is opened. Possession is established by the later signed grant.
 return key;
}
