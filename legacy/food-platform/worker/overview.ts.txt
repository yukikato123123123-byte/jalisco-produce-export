import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
// One D1 read statement: KPIs, charts and audit rows describe the same snapshot.
export async function overview(db:Database,projectRef:string){
 try{
 const result=await db.prepare(`WITH RECURSIVE days(day) AS (SELECT date('now','-6 days') UNION ALL SELECT date(day,'+1 day') FROM days WHERE day<date('now')), live_reviews AS (
 SELECT r.* FROM registration_reviews r LEFT JOIN producer_items i ON r.kind='product' AND i.id=r.target_id
 JOIN profiles p ON p.user_id=CASE WHEN r.kind='product' THEN i.user_id ELSE r.target_id END
 AND p.role=CASE WHEN r.kind='product' THEN 'producer' ELSE r.kind END
 ), live_inquiries AS (
 SELECT COALESCE((SELECT after_state FROM inquiry_workflow w WHERE w.inquiry_id=i.id ORDER BY sequence DESC LIMIT 1),i.status) AS state FROM inquiries i
 ), audit_rows AS (
 SELECT id,actor_id,action,target_id,after_state AS result,created_at FROM admin_audit
 UNION ALL SELECT id,actor_id,action,target_id,CASE WHEN action='draft_delete' THEN 'deleted' ELSE 'draft' END,created_at FROM admin_draft_events
 UNION ALL SELECT id,actor_id,'inquiry_'||action,inquiry_id,after_state,created_at FROM inquiry_workflow
 UNION ALL SELECT id,actor_id,kind||'_review',target_id,after_state,created_at FROM registration_review_events
 ), counts AS (
SELECT
   (SELECT count(*) FROM profiles) AS account_profiles,
   (SELECT count(*) FROM auth_users) AS authenticated_subjects,
   (SELECT count(*) FROM auth_users u WHERE NOT EXISTS(SELECT 1 FROM profiles a WHERE a.user_id=u.user_id)) AS pending_onboarding,
   (SELECT count(*) FROM live_reviews WHERE kind='producer') AS producers,
   (SELECT count(*) FROM producer_profiles) AS producer_profiles,
   (SELECT count(*) FROM profiles WHERE role='producer' AND NOT EXISTS(SELECT 1 FROM approved_public_items i WHERE i.user_id=profiles.user_id AND i.status='public')) AS producers_without_public_items,
   (SELECT count(*) FROM live_reviews WHERE kind='buyer') AS buyers,
   (SELECT count(*) FROM buyer_publications WHERE EXISTS(SELECT 1 FROM registration_reviews r WHERE r.kind='buyer' AND r.target_id=buyer_publications.user_id AND r.state='approved') AND published=1 AND consent_version='buyer-directory-v1' AND consented_at IS NOT NULL AND revoked_at IS NULL) AS public_buyers,
   (SELECT count(*) FROM live_inquiries WHERE state!='resolved') AS pending_inquiries,
   (SELECT count(*) FROM live_reviews WHERE kind='product') AS products,
   (SELECT count(*) FROM producer_items WHERE status='draft') AS drafts,
   ((SELECT count(*) FROM admin_audit)+(SELECT count(*) FROM inquiry_workflow)+(SELECT count(*) FROM registration_review_events)) AS audit_events,
   (SELECT count(*) FROM admin_grant_events WHERE project_ref=?) AS grant_events,
 (SELECT count(*) FROM live_reviews WHERE state='pending') AS pending_approvals,
 (SELECT count(*) FROM live_reviews WHERE kind='producer' AND state='pending') AS pending_producer,
 (SELECT count(*) FROM live_reviews WHERE kind='product' AND state='pending') AS pending_product,
 (SELECT count(*) FROM live_reviews WHERE kind='buyer' AND state='pending') AS pending_buyer
 ) SELECT json_object(
 'observed_at',strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 'counts',json((SELECT json_object('account_profiles',account_profiles,'authenticated_subjects',authenticated_subjects,'pending_onboarding',pending_onboarding,'producers',producers,'producer_profiles',producer_profiles,'producers_without_public_items',producers_without_public_items,'buyers',buyers,'public_buyers',public_buyers,'pending_inquiries',pending_inquiries,'products',products,'drafts',drafts,'audit_events',audit_events,'grant_events',grant_events,'pending_approvals',pending_approvals,'pending_producer',pending_producer,'pending_product',pending_product,'pending_buyer',pending_buyer) FROM counts)),
 'approvals',json((SELECT json_group_array(json_object('kind',kind,'pending',pending,'approved',approved,'rejected',rejected)) FROM (
 SELECT kinds.kind,COALESCE(sum(r.state='pending'),0) AS pending,COALESCE(sum(r.state='approved'),0) AS approved,COALESCE(sum(r.state='rejected'),0) AS rejected
 FROM (SELECT 'producer' AS kind UNION ALL SELECT 'product' UNION ALL SELECT 'buyer') kinds LEFT JOIN live_reviews r ON r.kind=kinds.kind GROUP BY kinds.kind
 ))),
 'inquiries',json_object('received',(SELECT count(*) FROM live_inquiries WHERE state='received'),'reviewing',(SELECT count(*) FROM live_inquiries WHERE state='reviewing'),'resolved',(SELECT count(*) FROM live_inquiries WHERE state='resolved')),
 'activityTrend',CASE WHEN EXISTS(SELECT 1 FROM audit_rows WHERE julianday(created_at) IS NULL OR julianday(created_at)>julianday('now')) THEN NULL ELSE json((SELECT json_group_array(json_object('day',day,'count',actions)) FROM (SELECT days.day,count(a.id) AS actions FROM days LEFT JOIN audit_rows a ON date(a.created_at)=days.day GROUP BY days.day ORDER BY days.day))) END,
 'recent',json((SELECT json_group_array(json_object('id',id,'actor_id',actor_id,'action',action,'target_id',target_id,'result',result,'created_at',created_at)) FROM (SELECT * FROM audit_rows ORDER BY created_at DESC,id LIMIT 8))),
 'recentProducts',json((SELECT json_group_array(json_object('id',i.id,'name',i.name,'state',i.status,'approval_state',COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='product' AND r.target_id=i.id),'pending'),'updated_at',i.updated_at)) FROM (SELECT * FROM producer_items ORDER BY updated_at DESC,id LIMIT 5) i))
 ) AS data`).bind(projectRef).first<{data:string}>();
 if(!result)throw new Failure(503,'Overview data unavailable.');
 return {...JSON.parse(result.data),health:{database:'Query succeeded',authentication:'This session was verified with the configured provider',email_delivery:'Email delivery is not configured.',account_scope:'Application records only; Supabase registrations that have never signed in are not available here',inquiries:'Authenticated submissions are stored; delivery is not emailed',logistics:'No shipment or document records configured'}};
 }catch{throw new Failure(503,'Overview data unavailable.');}
}
