import {registrationNotifications,draftAction} from './adminExtras.ts';
import {adminImageRows} from './productImages.ts';
import {overview} from './overview.ts';
import {reviewList,reviewHistory,decideReview} from './reviews.ts';
import {readInquiries,manageInquiry} from './inquiries.ts';
import type { Database } from './authState.ts';
import { Failure } from './provider.ts';
import { text } from './fields.ts';
async function rows(db:Database,query:string,values:unknown[]=[]) {
 const row=await db.prepare(`SELECT json_group_array(json(row)) AS data FROM (${query})`).bind(...values).first<{data:string}>();
 return JSON.parse(row?.data??'[]');
}
async function hasAdministratorGrant(db:Database,userId:string,projectRef:string):Promise<boolean> {
 const grant=await db.prepare(`SELECT g.user_id FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id WHERE g.user_id=? AND g.revoked_at IS NULL AND g.project_ref=? AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant'`).bind(userId,projectRef).first();
 return !!grant;
}
function administratorAction(body:Record<string,unknown>){
 const action=text(body,'action',40,true),target=text(body,'target_id',80,true),before=text(body,'before_state',12,true),after=text(body,'after_state',12,true),reason=text(body,'reason',500,true);
 if(!['product_status','buyer_unpublish'].includes(action))throw new Failure(400,'Unsupported administrative action.');
 if(action==='product_status'&&(!['draft','public','private'].includes(before)||!['draft','public','private'].includes(after)))throw new Failure(400,'Choose a supported product publication state.');
 if(action==='buyer_unpublish'&&(before!=='1'||after!=='0'))throw new Failure(400,'Administrators can revoke a buyer listing, never grant consent or republish it.');
 if(before===after)throw new Failure(400,'Choose a different state.');
 return {action,target_id:target,before_state:before,after_state:after,reason};
}
export async function legacyAdministrator(db:Database,userId:string,path:string,method:string,body:Record<string,unknown>,params:URLSearchParams,projectRef:string) {
 if(!await hasAdministratorGrant(db,userId,projectRef))throw new Failure(403,'Administrator access is not configured for this account. A trusted owner grant is required.');
 if(path==='/api/admin/notifications')return registrationNotifications(db,userId,projectRef,method,body,params);
 const draftPath=/^\/api\/admin\/drafts\/([^/]+)$/.exec(path);if(draftPath){if(method!=='POST')throw new Failure(405,'Method not allowed.');return draftAction(db,userId,projectRef,draftPath[1],body);}
 const reviewPath=/^\/api\/admin\/reviews\/(producer|product|buyer)(?:\/([^/]+))?$/.exec(path);
 if(reviewPath){const [,kind,target]=reviewPath;if(method==='GET'){if(target)return reviewHistory(db,kind,target);const result=await reviewList(db,kind,params);return kind==='product'?{...result,items:await adminImageRows(db,result.items)}:result;}if(method==='POST'&&target)return decideReview(db,userId,projectRef,kind,target,body);throw new Failure(405,'Method not allowed.');}
 if(method==='POST') {
  if(/^\/api\/admin\/inquiries\/[^/]+$/.test(path))return manageInquiry(db,userId,projectRef,path.split('/').at(-1)!,body);
  if(path!=='/api/admin/actions')throw new Failure(404,'Endpoint not found.');
  const {action,target_id:target,before_state:before,after_state:after,reason}=administratorAction(body);
  try {await db.prepare('INSERT INTO admin_audit(id,actor_id,action,target_id,before_state,after_state,reason,created_at,project_ref) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,action,target,before,after,reason,new Date().toISOString(),projectRef).run();}
  catch {throw new Failure(409,'The result could not be confirmed. Refresh the record and audit log before retrying; access or record state may have changed.');}
  return {ok:true};
 }
 if(method!=='GET')throw new Failure(405,'Method not allowed.');
 const section=path.slice('/api/admin/'.length);
 if(section==='overview'){const result=await overview(db,projectRef);return {...result,recentProducts:await adminImageRows(db,result.recentProducts)};}
 const q=text({q:params.get('q')??''},'q',120),status=text({status:params.get('status')??''},'status',30);
 const raw=params.get('page')??'1';if(!/^[1-9][0-9]{0,5}$/.test(raw))throw new Failure(400,'Enter a valid page.');const page=Number(raw);
 const configs:Record<string,{query:string;values:unknown[]}>= {
  accounts:{query:`SELECT json_object('id',u.user_id,'full_name',a.full_name,'company',a.company,'country',a.country,'role',a.role,'state',CASE WHEN a.user_id IS NULL THEN 'onboarding_required' ELSE 'onboarded' END) AS row FROM (SELECT user_id FROM auth_users UNION SELECT user_id FROM profiles) u LEFT JOIN profiles a ON a.user_id=u.user_id WHERE instr(lower(COALESCE(a.full_name,'')||' '||COALESCE(a.company,'')||' '||u.user_id),lower(?))>0`,values:[q]},
  producers:{query:`SELECT json_object('id',a.user_id,'company',COALESCE(p.company,a.company),'country',COALESCE(p.country,a.country),'region',p.region,'bio',p.bio,'profile_saved',p.user_id IS NOT NULL,'approval_state',COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='producer' AND r.target_id=a.user_id),'pending'),'public_products',(SELECT count(*) FROM approved_public_items i WHERE i.user_id=a.user_id AND status='public'),'total_products',(SELECT count(*) FROM producer_items i WHERE i.user_id=a.user_id),'state',CASE WHEN EXISTS(SELECT 1 FROM approved_public_items i WHERE i.user_id=a.user_id AND status='public') THEN 'listed' ELSE 'unlisted' END) AS row FROM profiles a LEFT JOIN producer_profiles p ON p.user_id=a.user_id WHERE a.role='producer' AND instr(lower(COALESCE(p.company,a.company)),lower(?))>0`,values:[q]},
  buyers:{query:`SELECT json_object('id',a.user_id,'company',COALESCE(b.company,a.company),'country',COALESCE(b.country,a.country),'profile_saved',b.user_id IS NOT NULL,'public_id',p.public_id,'public_company',p.company,'published',COALESCE(p.published,0),'approval_state',COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='buyer' AND r.target_id=a.user_id),'pending'),'consent_version',p.consent_version,'consented_at',p.consented_at,'revoked_at',p.revoked_at,'interests',p.interests,'state',CASE WHEN p.published=1 AND p.revoked_at IS NULL AND p.consented_at IS NOT NULL AND p.consent_version='buyer-directory-v1' AND EXISTS(SELECT 1 FROM registration_reviews r WHERE r.kind='buyer' AND r.target_id=a.user_id AND r.state='approved') THEN 'listed' ELSE 'private' END) AS row FROM profiles a LEFT JOIN buyer_profiles b ON b.user_id=a.user_id LEFT JOIN buyer_publications p ON p.user_id=a.user_id WHERE a.role='buyer' AND instr(lower(COALESCE(b.company,a.company)||' '||COALESCE(p.company,'')),lower(?))>0`,values:[q]},
  products:{query:`SELECT json_object('id',i.id,'producer',COALESCE(p.company,a.company),'name',i.name,'description',i.description,'category',i.category,'quantity',i.quantity,'unit',i.unit,'price',i.price,'currency',i.currency,'availability',i.availability,'state',i.status,'approval_state',COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='product' AND r.target_id=i.id),'pending'),'updated_at',i.updated_at,'owner_id',i.user_id,'revision',(SELECT revision FROM registration_reviews WHERE kind='product' AND target_id=i.id),'draft_allowed',i.user_id=? AND i.status='draft' AND NOT EXISTS(SELECT 1 FROM registration_review_events e WHERE e.kind='product' AND e.target_id=i.id AND e.after_state='approved') AND NOT EXISTS(SELECT 1 FROM registration_reviews r WHERE r.kind='product' AND r.target_id=i.id AND r.state='approved') AND NOT EXISTS(SELECT 1 FROM buyer_saved_items s WHERE s.item_id=i.id),'images','No stored listing images','packaging','Not stored') AS row FROM producer_items i JOIN profiles a ON a.user_id=i.user_id LEFT JOIN producer_profiles p ON p.user_id=i.user_id WHERE instr(lower(i.name||' '||COALESCE(p.company,a.company)||' '||i.category),lower(?))>0`,values:[userId,q]},
  grants:{query:`SELECT json_object('id',id,'kind','access','actor_id',operator_id,'approver_id',approver_id,'action',action,'target_id',target_id,'project_ref',project_ref,'approval_ref',approval_ref,'approval_sha256',approval_sha256,'reason',reason,'expected_event_id',expected_event_id,'created_at',created_at,'state',action) AS row FROM admin_grant_events WHERE project_ref=? AND instr(lower(operator_id||' '||target_id||' '||action),lower(?))>0`,values:[projectRef,q]},
  security:{query:`SELECT json_object('id',id,'actor_id',actor_id,'action',action,'target_id',target_id,'before_state',before_state,'after_state',after_state,'reason',reason,'created_at',created_at,'state',action) AS row FROM (SELECT id,actor_id,action,target_id,before_state,after_state,reason,created_at FROM admin_audit UNION ALL SELECT id,actor_id,action,target_id,'draft',CASE WHEN action='draft_delete' THEN 'deleted' ELSE 'draft' END,reason,created_at FROM admin_draft_events UNION ALL SELECT id,actor_id,'inquiry_'||action,inquiry_id,before_state,after_state,reason,created_at FROM inquiry_workflow UNION ALL SELECT id,actor_id,kind||'_review',target_id,before_state,after_state,reason,created_at FROM registration_review_events) WHERE instr(lower(actor_id||' '||target_id||' '||action),lower(?))>0`,values:[q]},
  readiness:{query:`SELECT json_object('id',a.user_id,'company',COALESCE(p.company,a.company),'profile',CASE WHEN p.user_id IS NOT NULL AND p.company!='' AND p.country!='' AND p.region!='' AND p.bio!='' AND (p.business_email!='' OR p.business_phone!='') THEN 'complete · self-reported' ELSE 'incomplete' END,'public_products',(SELECT count(*) FROM approved_public_items i WHERE i.user_id=a.user_id AND status='public'),'packaging','unverified · not stored','quality_documents','unverified · not stored','export_documents','unverified · not stored','logistics','pending · no shipment records','state',CASE WHEN p.user_id IS NULL OR p.company='' OR p.country='' OR p.region='' OR p.bio='' OR (p.business_email='' AND p.business_phone='') THEN 'incomplete' ELSE 'unverified' END) AS row FROM profiles a LEFT JOIN producer_profiles p ON p.user_id=a.user_id WHERE a.role='producer' AND instr(lower(COALESCE(p.company,a.company)),lower(?))>0`,values:[q]}
 };
 if(section==='inquiries'||section.startsWith('inquiries/'))return readInquiries(db,params,undefined,section==='inquiries'?undefined:section.slice('inquiries/'.length));
 const config=configs[section];if(!config)throw new Failure(404,'Endpoint not found.');
 const items=await rows(db,`SELECT row FROM (${config.query}) WHERE (?='' OR json_extract(row,'$.state')=?) ORDER BY ${['security','grants'].includes(section)?"json_extract(row,'$.created_at') DESC,":''} json_extract(row,'$.id') LIMIT 51 OFFSET ?`,[...config.values,status,status,(page-1)*50]);
 return {items:section==='products'?await adminImageRows(db,items.slice(0,50)):items.slice(0,50),page,hasMore:items.length>50};
}
