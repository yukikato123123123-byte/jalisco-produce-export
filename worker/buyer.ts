import type { Database } from './authState.ts';
import { Failure } from './provider.ts';
import { publicItems, text } from './producer.ts';
export async function buyer(db: Database, userId: string, base: Record<string,unknown>, path: string, method: string, body: Record<string,unknown>, params = new URLSearchParams()) {
  if (method === 'POST' && path === '/api/buyer/profile') {
    const company=text(body,'company',120,true), country=text(body,'country',120,true), region=text(body,'region',120), bio=text(body,'bio',2000);
    await db.prepare(`INSERT INTO buyer_profiles(user_id,company,country,region,bio) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET company=excluded.company,country=excluded.country,region=excluded.region,bio=excluded.bio`).bind(userId,company,country,region,bio).run();
  } else if (method === 'POST' && path === '/api/buyer/publication') {
    if (typeof body.publish !== 'boolean') throw new Failure(400,'Choose whether to publish your buyer directory profile.');
    const now=new Date().toISOString();
    if (!body.publish) {
      await db.prepare('UPDATE buyer_publications SET published=0,revoked_at=?,updated_at=? WHERE user_id=?').bind(now,now,userId).run();
    } else {
      if (body.explicit_consent !== true || body.consent_version !== 'buyer-directory-v1') throw new Failure(400,'Explicit consent to the current public directory notice is required.');
      const company=text(body,'company',120,true),country=text(body,'country',120,true),region=text(body,'region',120),markets=text(body,'markets',120),interests=text(body,'interests',300,true),introduction=text(body,'introduction',2000);
      await db.prepare(`INSERT INTO buyer_publications(user_id,public_id,company,country,region,markets,interests,introduction,published,consent_version,consented_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,1,'buyer-directory-v1',?,?)
        ON CONFLICT(user_id) DO UPDATE SET company=excluded.company,country=excluded.country,region=excluded.region,markets=excluded.markets,interests=excluded.interests,introduction=excluded.introduction,published=1,consent_version=excluded.consent_version,consented_at=excluded.consented_at,revoked_at=NULL,updated_at=excluded.updated_at`)
        .bind(userId,crypto.randomUUID(),company,country,region,markets,interests,introduction,now,now).run();
    }
  } else if (method === 'POST' && path === '/api/buyer/saved-items') {
    const id=text(body,'id',80,true);
    if (body.action === 'remove') {
      await db.prepare('DELETE FROM buyer_saved_items WHERE user_id=? AND item_id=?').bind(userId,id).run();
    } else if (body.action === 'save') {
      const item=await db.prepare(`INSERT INTO buyer_saved_items(user_id,item_id,created_at) SELECT ?,id,? FROM approved_public_items WHERE id=? AND status='public' ON CONFLICT(user_id,item_id) DO UPDATE SET item_id=excluded.item_id RETURNING item_id`).bind(userId,new Date().toISOString(),id).first();
      if (!item) throw new Failure(404,'Public item not found.');
    } else throw new Failure(400,'Choose save or remove.');
  } else if (!(method === 'GET' && path === '/api/buyer/dashboard')) throw new Failure(404,'Endpoint not found.');
  const profile=await db.prepare('SELECT company,country,region,bio FROM buyer_profiles WHERE user_id=?').bind(userId).first<Record<string,unknown>>();
  const saved=await publicItems(db,params,userId);
  const publication=await db.prepare(`SELECT public_id AS id,company,country,region,markets,interests,introduction,published,consent_version,consented_at,revoked_at,updated_at,COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='buyer' AND r.target_id=buyer_publications.user_id),'pending') AS approval_state FROM buyer_publications WHERE user_id=?`).bind(userId).first();
  return {profile:{...base,region:'',bio:'',...profile},publication,savedItems:saved.items,page:saved.page,hasMore:saved.hasMore};
}
