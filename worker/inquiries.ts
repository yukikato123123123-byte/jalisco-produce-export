import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
function field(body:Record<string,unknown>,key:string,max:number,min=0){const v=body[key];if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new Failure(400,'Check the inquiry fields and length limits.');return v.trim();}
async function rows(db:Database,sql:string,values:unknown[]){const r=await db.prepare(`SELECT json_group_array(json(row)) AS data FROM (${sql})`).bind(...values).first<{data:string}>();return JSON.parse(r?.data??'[]');}
export async function readInquiries(db:Database,params:URLSearchParams,user?:string,id?:string){
 if(id&&!uuid(id))throw new Failure(404,'Inquiry not found.');
 const raw=params.get('page')??'1';if(!/^[1-9][0-9]{0,5}$/.test(raw))throw new Failure(400,'Enter a valid page.');
 const page=Number(raw),q=(params.get('q')??'').slice(0,120),status=(params.get('status')??'').slice(0,30);
 const items=await rows(db,"SELECT json_object('id',id,'company',company,'email',email,'destination',destination,'product',product,'quantityKg',quantity_kg,'packaging',packaging,'terms',terms,'questions',questions,'state',COALESCE((SELECT after_state FROM inquiry_workflow w WHERE w.inquiry_id=inquiries.id ORDER BY sequence DESC LIMIT 1),status),'created_at',created_at) AS row FROM inquiries WHERE (? IS NULL OR user_id=?) AND (? IS NULL OR id=?) AND instr(lower(company||' '||product),lower(?))>0 AND (?='' OR (?='unresolved' AND COALESCE((SELECT after_state FROM inquiry_workflow w WHERE w.inquiry_id=inquiries.id ORDER BY sequence DESC LIMIT 1),status)!='resolved') OR COALESCE((SELECT after_state FROM inquiry_workflow w WHERE w.inquiry_id=inquiries.id ORDER BY sequence DESC LIMIT 1),status)=?) ORDER BY created_at DESC,id LIMIT 51 OFFSET ?",[user??null,user??null,id??null,id??null,q,status,status,status,(page-1)*50]);
 if(id){if(!items.length)throw new Failure(404,'Inquiry not found.');return {item:items[0],workflow:await rows(db,"SELECT json_object('id',id,'action',action,'actor_id',actor_id,'state',after_state,'message',message,'email_status',email_status,'language',language,'created_at',created_at) AS row FROM inquiry_workflow WHERE inquiry_id=? ORDER BY sequence",[id]),history:await rows(db,"SELECT json_object('id',id,'action',action,'created_at',created_at) AS row FROM inquiry_events WHERE inquiry_id=? ORDER BY created_at,id",[id])};}
 return {items:items.slice(0,50),page,hasMore:items.length>50};
}
export async function submitInquiry(db:Database,user:{id:string;email:string},body:Record<string,unknown>){
 if(!uuid(body.id))throw new Failure(400,'A valid inquiry request ID is required.');
 const company=field(body,'company',120,2),destination=field(body,'destination',120,1),product=field(body,'product',120,1),terms=field(body,'terms',120,1),packaging=field(body,'packaging',1000),questions=field(body,'questions',2000);
 if(typeof body.email!=='string'||body.email.trim().toLowerCase()!==user.email.toLowerCase())throw new Failure(400,'Use the verified email address of your signed-in account.');
 const raw=body.quantityKg;if(typeof raw!=='string'||!raw.trim())throw new Failure(400,'Enter at least 0.001 kg, with up to three decimal places.');
 const quantity=Number(raw),grams=quantity*1000;
 if(!Number.isFinite(quantity)||quantity<0.001||!Number.isSafeInteger(Math.round(grams))||Math.abs(grams-Math.round(grams))>0.000001)throw new Failure(400,'Enter at least 0.001 kg, with up to three decimal places.');
 const values=[body.id,user.id,company,user.email,destination,product,quantity,packaging,terms,questions];
 await db.prepare("INSERT INTO inquiries(id,user_id,company,email,destination,product,quantity_kg,packaging,terms,questions,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'received',?) ON CONFLICT(id) DO NOTHING").bind(...values,new Date().toISOString()).run();
 const saved=await db.prepare('SELECT id,user_id,company,email,destination,product,quantity_kg,packaging,terms,questions FROM inquiries WHERE id=? AND user_id=?').bind(body.id,user.id).first<Record<string,unknown>>();
 const keys=['id','user_id','company','email','destination','product','quantity_kg','packaging','terms','questions'];
 if(!saved||JSON.stringify(keys.map(k=>saved[k]))!==JSON.stringify(values))throw new Failure(409,'The inquiry request ID was already used. Refresh your inquiry list before retrying.');
 return {ok:true,id:body.id,status:'received'};
}

export async function manageInquiry(db:Database,actor:string,projectRef:string,id:string,body:Record<string,unknown>){
 if(!uuid(id)||!uuid(body.id))throw new Failure(400,'A valid inquiry request ID is required.');
 const action=body.action,before=body.before_state,after=body.after_state;
 if(!['status','reply'].includes(String(action))||!['received','reviewing','resolved'].includes(String(before))||!['received','reviewing','resolved'].includes(String(after)))throw new Failure(400,'Choose a supported inquiry state.');
 const reason=field(body,'reason',500,1),message=field(body,'message',5000,action==='reply'?1:0);
 if((action==='status'&&(before===after||message!==''))||(action==='reply'&&before!==after))throw new Failure(400,'Check the inquiry action and state.');
 const language=body.language;if(language!=='en'&&language!=='es')throw new Failure(400,'Choose a supported language.');
 const values=[body.id,id,actor,projectRef,action,before,after,message,reason,language];
 const existing=await db.prepare('SELECT * FROM inquiry_workflow WHERE id=?').bind(body.id).first<Record<string,unknown>>();
 if(existing){const keys=['id','inquiry_id','actor_id','project_ref','action','before_state','after_state','message','reason','language'];if(JSON.stringify(keys.map(k=>existing[k]))!==JSON.stringify(values))throw new Failure(409,'The request ID was already used.');return {ok:true,email_status:'not_configured'};}
 try{await db.prepare('INSERT INTO inquiry_workflow(id,inquiry_id,actor_id,project_ref,action,before_state,after_state,message,reason,language,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(...values,new Date().toISOString()).run();}
 catch{throw new Failure(409,'The inquiry changed or access was revoked. Refresh before retrying.');}
 return {ok:true,email_status:'not_configured'};
}
