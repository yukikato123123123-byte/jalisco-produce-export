import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
export const imageBucket='jalisco-product-images-staging';
export type ImageEnvironment={DB:Database;SUPABASE_URL:string;SUPABASE_STORAGE_SERVICE_ROLE_KEY?:string};
export type ImageRecord={id:string;product_id:string;owner_id:string;object_path:string;thumb_path:string;mime:string;width:number;height:number;state:string};
export type ImageInfo={id:string;product_id:string;thumbnail:string;url:string;width:number;height:number;position:number;primary:boolean};
const MAX=5*1024*1024;
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(data:Uint8Array){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Validate actual encoded headers, dimensions and container boundaries, never filenames.
export function inspectImage(data:Uint8Array,mime:string,thumbnail=false){
 const fail=()=>{throw new Failure(400,'Choose a valid JPEG, PNG or WebP image.');};
 if(!data.length||data.length>(thumbnail?512*1024:MAX))throw new Failure(413,'Each photo must be 5 MB or smaller.');
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);let type='',width=0,height=0;
 if(data.length>=45&&data.slice(0,8).every((b,i)=>b===[137,80,78,71,13,10,26,10][i])){
  type='image/png';let offset=8,first=true,hasData=false,ended=false;
  while(offset+12<=data.length){const n=v.getUint32(offset),tag=String.fromCharCode(...data.slice(offset+4,offset+8));if(n>data.length-offset-12)fail();if(crc(data.subarray(offset+4,offset+8+n))!==v.getUint32(offset+8+n))fail();if(first){if(tag!=='IHDR'||n!==13)fail();width=v.getUint32(offset+8);height=v.getUint32(offset+12);first=false;}if(tag==='IDAT'&&n>0)hasData=true;offset+=n+12;if(tag==='IEND'){if(n!==0||offset!==data.length)fail();ended=true;break;}}
  if(!hasData||!ended)fail();
 }else if(data.length>=64&&data[0]===255&&data[1]===216&&data.at(-2)===255&&data.at(-1)===217){
  type='image/jpeg';let p=2,scan=false;while(p+4<data.length){if(data[p++]!==255)fail();while(data[p]===255)p++;const marker=data[p++];if(marker===218){scan=true;break;}const n=v.getUint16(p);if(n<2||p+n>data.length)fail();if([192,193,194].includes(marker)){if(n<8)fail();height=v.getUint16(p+3);width=v.getUint16(p+5);}p+=n;}if(!scan)fail();
 }else if(data.length>=30&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP'&&v.getUint32(4,true)+8===data.length){
  type='image/webp';const tag=String.fromCharCode(...data.slice(12,16));const u24=(p:number)=>data[p]+data[p+1]*256+data[p+2]*65536;
  if(tag==='VP8X'){width=u24(24)+1;height=u24(27)+1;}else if(tag==='VP8L'&&data[20]===47){width=1+((data[21]|data[22]<<8)&16383);height=1+((data[22]>>6|data[23]<<2|data[24]<<10)&16383);}else if(tag==='VP8 '&&data[23]===157&&data[24]===1&&data[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
 }
 if(!type||mime!==type||!width||!height||width*height>20000000||width>8192||height>8192||(thumbnail&&(width>640||height>640)))fail();
 return {mime:type,width,height};
}
function headers(env:ImageEnvironment){if(!env.SUPABASE_STORAGE_SERVICE_ROLE_KEY)throw new Failure(503,'Photo storage is not configured.');return {Authorization:'Bearer '+env.SUPABASE_STORAGE_SERVICE_ROLE_KEY,apikey:env.SUPABASE_STORAGE_SERVICE_ROLE_KEY};}
async function storage(env:ImageEnvironment,path:string,init:RequestInit={}){const r=await fetch(env.SUPABASE_URL+'/storage/v1/'+path,{...init,headers:{...headers(env),...init.headers}});if(!r.ok)throw new Failure(503,'Photo storage is temporarily unavailable.');return r;}
export async function imageList(db:Database,product:string){const row=await db.prepare(`SELECT json_group_array(json_object('id',f.id,'product_id',f.product_id,'thumbnail','/api/product-images/'||f.id||'/thumb','url','/api/product-images/'||f.id||'/full','width',f.width,'height',f.height,'position',CAST(j.key AS INTEGER),'primary',CAST(j.key AS INTEGER)=0)) AS data FROM product_image_sets s,json_each(s.image_ids) j JOIN product_image_files f ON f.id=j.value AND f.state='ready' WHERE s.product_id=? ORDER BY CAST(j.key AS INTEGER)`).bind(product).first<{data:string}>();return (JSON.parse(row?.data??'[]') as ImageInfo[]).sort((a,b)=>a.position-b.position);}
export async function attachImages<T extends {id:string}>(db:Database,items:T[]):Promise<(T&{images:ImageInfo[];image_version:number})[]>{
 if(!items.length)return [];
 const row=await db.prepare(`SELECT json_group_array(json_object('product_id',s.product_id,'version',s.version,'ids',json(s.image_ids),'files',json((SELECT json_group_array(json_object('id',f.id,'width',f.width,'height',f.height)) FROM product_image_files f WHERE f.product_id=s.product_id AND f.state='ready')))) AS data FROM product_image_sets s WHERE s.product_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(items.map(i=>i.id))).first<{data:string}>();
 const sets=JSON.parse(row?.data??'[]') as {product_id:string;version:number;ids:string[];files:{id:string;width:number;height:number}[]}[];
 return items.map(item=>{const s=sets.find(s=>s.product_id===item.id);return {...item,image_version:s?.version??0,images:(s?.ids??[]).map((id,position)=>{const f=s!.files.find(f=>f.id===id)!;return f?{...f,product_id:item.id,thumbnail:`/api/product-images/${id}/thumb`,url:`/api/product-images/${id}/full`,position,primary:position===0}:null;}).filter((v):v is ImageInfo=>!!v)};});
}

export async function adminImageRows<T extends {id:string}>(db:Database,rows:T[]){return (await attachImages(db,rows)).map(({images,...row})=>({...row,image_data:JSON.stringify(images)}));}
export async function ownedProduct(db:Database,owner:string,id:string){if(!await db.prepare('SELECT id FROM producer_items WHERE id=? AND user_id=?').bind(id,owner).first())throw new Failure(404,'Item not found.');}
export async function cleanupImages(env:ImageEnvironment,owner?:string){
 // Durable deletion state is the retry queue. No arbitrary paths are accepted.
 const row=await env.DB.prepare(`SELECT json_group_array(json_object('id',id,'object_path',object_path,'thumb_path',thumb_path)) AS data FROM (SELECT * FROM product_image_files f WHERE (? IS NULL OR owner_id=?) AND NOT EXISTS(SELECT 1 FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=f.id) AND (state='deleting' OR julianday(created_at)<julianday('now','-1 day')) LIMIT 40)`).bind(owner??null,owner??null).first<{data:string}>();
 for(const f of JSON.parse(row?.data??'[]') as ImageRecord[]){try{const claimed=await env.DB.prepare("UPDATE product_image_files SET state='deleting' WHERE id=? AND NOT EXISTS(SELECT 1 FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=product_image_files.id) RETURNING id").bind(f.id).first();if(!claimed)continue;await storage(env,'object/'+imageBucket,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[f.object_path,f.thumb_path]})});await env.DB.prepare("DELETE FROM product_image_files WHERE id=? AND NOT EXISTS(SELECT 1 FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=product_image_files.id)").bind(f.id).run();}catch{/* Keep the durable cleanup row for scheduled retry. */}}
}
export async function uploadImage(request:Request,env:ImageEnvironment,owner:string,product:string){
 await ownedProduct(env.DB,owner,product);headers(env);
 const key=`image-upload:${owner}:${Math.floor(Date.now()/600000)}`;const rate=await env.DB.prepare('INSERT INTO auth_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,Date.now()+1200000).first<{attempts:number}>();if(!rate||rate.attempts>20)throw new Failure(429,'Too many photo uploads. Please wait before trying again.',600);
 const reader=request.body?.getReader();if(!reader)throw new Failure(400,'Choose a photo to upload.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>6*1024*1024){await reader.cancel();throw new Failure(413,'Each photo must be 5 MB or smaller.');}chunks.push(next.value);}
 const payload=new Uint8Array(size);let p=0;for(const chunk of chunks){payload.set(chunk,p);p+=chunk.length;}
 const form=await new Response(payload,{headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData();
 let fieldCount=0;form.forEach(()=>fieldCount++);const source=form.get('photo'),thumb=form.get('thumbnail');if(!(source instanceof File)||!(thumb instanceof File)||fieldCount!==2)throw new Failure(400,'Choose a photo and its thumbnail.');
 const data=new Uint8Array(await source.arrayBuffer()),small=new Uint8Array(await thumb.arrayBuffer());const info=inspectImage(data,source.type);inspectImage(small,thumb.type,true);
 const id=crypto.randomUUID(),path=`${owner}/${product}/${id}`,now=new Date().toISOString();
 try{await env.DB.prepare("INSERT INTO product_image_files VALUES(?,?,?,?,?,?,?,?,?,'uploading',?)").bind(id,product,owner,path+'/full',path+'/thumb',info.mime,data.length,info.width,info.height,now).run();}catch{throw new Failure(409,'Too many pending photos. Save or remove the pending photos first.');}
 try{
  await storage(env,'object/'+imageBucket+'/'+path+'/full',{method:'POST',headers:{'Content-Type':info.mime,'x-upsert':'false'},body:data});
  await storage(env,'object/'+imageBucket+'/'+path+'/thumb',{method:'POST',headers:{'Content-Type':thumb.type,'x-upsert':'false'},body:small});
  const ready=await env.DB.prepare("UPDATE product_image_files SET state='ready' WHERE id=? AND state='uploading' AND product_id=? AND EXISTS(SELECT 1 FROM producer_items p WHERE p.id=product_image_files.product_id AND p.user_id=product_image_files.owner_id) RETURNING id").bind(id,product).first();if(!ready)throw new Error();
  return {image:{id,product_id:product,thumbnail:`/api/product-images/${id}/thumb`,url:`/api/product-images/${id}/full`,width:info.width,height:info.height,position:0,primary:false}};
 }catch{await env.DB.prepare("UPDATE product_image_files SET state='deleting' WHERE id=?").bind(id).run();await cleanupImages(env,owner);throw new Failure(503,'Photo upload failed. Existing photos were preserved.');}
}
export async function manageImages(env:ImageEnvironment,owner:string,product:string,method:string,body:Record<string,unknown>,discard=false){
 await ownedProduct(env.DB,owner,product);
 if(discard){if(!uuid.test(String(body.id)))throw new Failure(400,'Choose a valid photo.');await env.DB.prepare("UPDATE product_image_files SET state='deleting' WHERE id=? AND product_id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=product_image_files.id)").bind(body.id,product,owner).run();await cleanupImages(env,owner);return {ok:true};}
 if(method==='POST')await env.DB.prepare('INSERT INTO product_image_sets(product_id) VALUES(?) ON CONFLICT DO NOTHING').bind(product).run();
 if(method==='POST'){
  const ids=body.ids;if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(ids).size!==ids.length||!Number.isInteger(body.version))throw new Failure(400,'Choose up to five photos in display order.');
  const current=await env.DB.prepare('SELECT image_ids,version FROM product_image_sets WHERE product_id=?').bind(product).first<{image_ids:string;version:number}>();const json=JSON.stringify(ids);
  if(current?.image_ids!==json){try{const updated=await env.DB.prepare('UPDATE product_image_sets SET image_ids=?,version=version+1 WHERE product_id=? AND version=? RETURNING version').bind(json,product,body.version).first();if(!updated)throw new Error();}catch{throw new Failure(409,'Photos changed or are unavailable. Refresh before saving again.');}}
  await cleanupImages(env,owner);
 }
 const set=await env.DB.prepare('SELECT version FROM product_image_sets WHERE product_id=?').bind(product).first<{version:number}>();return {images:await imageList(env.DB,product),version:set?.version??0};
}
export async function imageFile(env:ImageEnvironment,id:string,variant:string,canReadPrivate:(owner:string)=>Promise<boolean>){
 if(!uuid.test(id)||!['thumb','full'].includes(variant))throw new Failure(404,'Photo not found.');
 const f=await env.DB.prepare("SELECT * FROM product_image_files WHERE id=? AND state='ready'").bind(id).first<ImageRecord>();if(!f)throw new Failure(404,'Photo not found.');
 const visible=await env.DB.prepare("SELECT p.id FROM approved_public_items p JOIN product_image_sets s ON s.product_id=p.id,json_each(s.image_ids) j WHERE p.id=? AND p.status='public' AND j.value=?").bind(f.product_id,id).first();
 const attached=await env.DB.prepare('SELECT product_id FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=?').bind(id).first();
 if(!visible&&!await canReadPrivate((f as ImageRecord&{owner_id:string}).owner_id))throw new Failure(404,'Photo not found.');
 // Even a known URL must recheck D1 after unpublish/rejection. Never issue public signed URLs.
 const r=await storage(env,'object/authenticated/'+imageBucket+'/'+(variant==='thumb'?f.thumb_path:f.object_path));
 return new Response(r.body,{headers:{'Content-Type':r.headers.get('Content-Type')||f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer',...(attached?{}:{'X-Robots-Tag':'noindex'})}});
}
