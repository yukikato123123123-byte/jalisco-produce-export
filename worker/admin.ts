import {legacyAdministrator} from './legacyAdmin.ts';
import {researchAdmin} from './research.ts';
import {operationsRead} from './nopalOperations.ts';
import {feedbackAdmin} from './nopalFeedback.ts';
import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
import {text} from './fields.ts';
export async function hasAdministratorGrant(db:Database,userId:string,projectRef:string):Promise<boolean> {
 const grant=await db.prepare(`SELECT g.user_id FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id WHERE g.user_id=? AND g.revoked_at IS NULL AND g.project_ref=? AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant'`).bind(userId,projectRef).first();
 return !!grant;
}
export function administratorAction(body:Record<string,unknown>){
 const action=text(body,'action',40,true),target=text(body,'target_id',80,true),before=text(body,'before_state',12,true),after=text(body,'after_state',12,true),reason=text(body,'reason',500,true);
 if(!['product_status','buyer_unpublish'].includes(action))throw new Failure(400,'Unsupported administrative action.');
 if(action==='product_status'&&(!['draft','public','private'].includes(before)||!['draft','public','private'].includes(after)))throw new Failure(400,'Choose a supported product publication state.');
 if(action==='buyer_unpublish'&&(before!=='1'||after!=='0'))throw new Failure(400,'This historical action only permits withdrawal.');
 if(before===after)throw new Failure(400,'Choose a different state.');
 return {action,target_id:target,before_state:before,after_state:after,reason};
}
export async function administrator(db:Database,userId:string,path:string,method:string,body:Record<string,unknown>,params:URLSearchParams,projectRef:string){
 if(!await hasAdministratorGrant(db,userId,projectRef))throw new Failure(403,'Administrator access is not configured for this account. A trusted owner grant is required.');
 if(['/api/admin/research-access','/api/admin/research-responses'].includes(path))return researchAdmin(db,userId,projectRef,path,method,body,params);
 const feedback=/^\/api\/admin\/customer-feedback(?:\/([^/]+))?$/.exec(path);if(feedback)return feedbackAdmin(db,userId,projectRef,feedback[1],method,body,params);
 if(['operations-overview','launch-list','activity-log','concept-product','ritual','origin','settings'].some(id=>path==='/api/admin/'+id))return operationsRead(db,path.slice('/api/admin/'.length),method,params,projectRef);
 return legacyAdministrator(db,userId,path,method,body,params,projectRef);
}
