import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {text} from './producer.ts';
export async function registrationNotifications(db:Database,admin:string,project:string,method:string,body:Record<string,unknown>,params:URLSearchParams){
 if(method==='POST'){
  const through=body.through,id=body.id;
  if((!Number.isSafeInteger(through)||Number(through)<0)&&(!Number.isSafeInteger(id)||Number(id)<1))throw new Failure(400,'Choose a notification or the displayed notification limit.');
  if(id!==undefined&&!await db.prepare('SELECT id FROM registration_notifications WHERE id=?').bind(id).first())throw new Failure(404,'Notification not found.');
  try{await db.prepare(`INSERT INTO admin_notification_reads(notification_id,admin_id,project_ref,read_at) SELECT id,?,?,? FROM registration_notifications WHERE ${id!==undefined?'id=?':'id<=?'} ON CONFLICT(notification_id,admin_id) DO NOTHING`).bind(admin,project,new Date().toISOString(),id??through).run();}catch{throw new Failure(409,'Notification update could not be confirmed. Refresh notifications before retrying.');}
 }else if(method!=='GET')throw new Failure(405,'Method not allowed.');
 const before=params.get('before')||'9007199254740991';if(!/^[1-9][0-9]{0,15}$/.test(before)||!Number.isSafeInteger(Number(before)))throw new Failure(400,'Enter a valid notification cursor.');
 const row=await db.prepare(`SELECT (SELECT count(*) FROM registration_notifications n WHERE NOT EXISTS(SELECT 1 FROM admin_notification_reads a WHERE a.notification_id=n.id AND a.admin_id=?)) AS unread_count,COALESCE((SELECT max(id) FROM registration_notifications),0) AS through,(SELECT json_group_array(json(item)) FROM (SELECT json_object('id',n.id,'user_id',n.user_id,'name',n.full_name,'email',n.email,'role',n.role,'created_at',n.created_at,'state',COALESCE(r.state,'pending'),'read',EXISTS(SELECT 1 FROM admin_notification_reads a WHERE a.notification_id=n.id AND a.admin_id=?)) AS item FROM registration_notifications n LEFT JOIN registration_reviews r ON r.kind=n.role AND r.target_id=n.user_id WHERE n.id<? ORDER BY n.id DESC LIMIT 50)) AS items`).bind(admin,admin,Number(before)).first<{unread_count:number;through:number;items:string}>();
 if(!row)throw new Failure(503,'Notifications are temporarily unavailable.');return {...row,items:JSON.parse(row.items||'[]')};
}
export async function draftAction(db:Database,admin:string,project:string,target:string,body:Record<string,unknown>){
 if(!['draft_keep','draft_delete'].includes(String(body.action)))throw new Failure(400,'Choose Keep as Draft or Delete Draft.');
 const updated=text(body,'updated_at',80,true),reason=text(body,'reason',500,true);if(!Number.isSafeInteger(body.revision)||Number(body.revision)<1)throw new Failure(400,'Refresh the draft before changing it.');
 try{const event=await db.prepare('INSERT INTO admin_draft_events(id,actor_id,project_ref,action,target_id,target_name,expected_updated_at,expected_revision,reason,created_at) VALUES(?,?,?,?,?,COALESCE((SELECT name FROM producer_items WHERE id=?),\'\'),?,?,?,?) RETURNING id').bind(crypto.randomUUID(),admin,project,body.action,target,target,updated,body.revision,reason,new Date().toISOString()).first();if(!event)throw new Error();}catch{throw new Failure(409,'Draft change could not be confirmed. Refresh the record and audit log before retrying. Only your own unapproved drafts without approval history can be changed.');}
 return {ok:true,deleted:body.action==='draft_delete'};
}
