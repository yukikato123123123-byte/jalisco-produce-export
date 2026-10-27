import {attachImages} from './productImages.ts';
import type { Database } from './authState.ts';
import { Failure } from './provider.ts';
import { text } from './producer.ts';

// Only fields already published with public produce are used here. A public
// item's ID identifies a farm; provider IDs and account names stay private.
export async function publicProducers(db: Database, params: URLSearchParams) {
  const clauses = ["a.role='producer'", "EXISTS (SELECT 1 FROM approved_public_items i WHERE i.user_id=a.user_id AND i.status='public')"];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries({q: "COALESCE(p.company,a.company)", country: 'COALESCE(p.country,a.country)', region: "COALESCE(p.region,'')"})) {
    const value = text({[key]:params.get(key) ?? ''}, key, 120);
    if (value) {
      clauses.push(key === 'q' ? `(instr(lower(${column}),lower(?))>0 OR EXISTS (SELECT 1 FROM approved_public_items s WHERE s.user_id=a.user_id AND s.status='public' AND instr(lower(s.name || ' ' || s.category),lower(?))>0))` : `instr(lower(${column}),lower(?))>0`);
      values.push(value); if (key === 'q') values.push(value);
    }
  }
  if (params.has('id')) { clauses.push("a.user_id=(SELECT user_id FROM approved_public_items WHERE id=? AND status='public')"); values.push(text({id:params.get('id')},'id',80,true)); }
  const pageText=params.get('page') ?? '1';
  if (!/^[1-9][0-9]{0,5}$/.test(pageText)) throw new Failure(400,'Enter a valid page number.');
  const page=Number(pageText);
  const result=await db.prepare(`SELECT json_group_array(json(row)) AS data FROM (
    SELECT json_object('id',(SELECT MIN(id) FROM approved_public_items WHERE user_id=a.user_id AND status='public'),
      'company',COALESCE(p.company,a.company),'country',COALESCE(p.country,a.country),'region',COALESCE(p.region,''),'bio',COALESCE(p.bio,''),
      'business_email',CASE WHEN p.public_contact=1 THEN p.business_email ELSE '' END,
      'business_phone',CASE WHEN p.public_contact=1 THEN p.business_phone ELSE '' END,
      'items',json((SELECT json_group_array(json_object('id',id,'name',name,'category',category,'quantity',quantity,'unit',unit,'availability',availability)) FROM approved_public_items WHERE user_id=a.user_id AND status='public')))
    AS row FROM profiles a LEFT JOIN producer_profiles p ON p.user_id=a.user_id
    WHERE ${clauses.join(' AND ')} ORDER BY COALESCE(p.company,a.company),a.user_id LIMIT 51 OFFSET ?)`)
    .bind(...values,(page-1)*50).first<{data:string}>();
  const items=JSON.parse(result?.data ?? '[]');
  const products=await attachImages(db,items.flatMap((p:{items?:{id:string}[]})=>p.items??[]));for(const p of items)if(Array.isArray(p.items))p.items=p.items.map((i:{id:string})=>products.find(product=>product.id===i.id)||i);
  return {items:items.slice(0,50),page,hasMore:items.length>50};
}

// This projection intentionally never joins private buyer profiles or saved data.
export async function publicBuyers(db: Database, params: URLSearchParams) {
  const clauses=["EXISTS(SELECT 1 FROM registration_reviews r WHERE r.kind='buyer' AND r.target_id=a.user_id AND r.state='approved')","p.published=1","p.consent_version='buyer-directory-v1'","p.consented_at IS NOT NULL","p.revoked_at IS NULL","a.role='buyer'"];
  const values:unknown[]=[];
  for(const [key,column] of Object.entries({q:"p.company || ' ' || p.interests || ' ' || p.markets",country:'p.country',market:'p.markets',interest:'p.interests'})){
    const value=text({[key]:params.get(key)??''},key,120);
    if(value){clauses.push(`instr(lower(${column}),lower(?))>0`);values.push(value);}
  }
  if(params.has('id')){clauses.push('p.public_id=?');values.push(text({id:params.get('id')},'id',80,true));}
  const pageText=params.get('page')??'1';
  if(!/^[1-9][0-9]{0,5}$/.test(pageText))throw new Failure(400,'Enter a valid page number.');
  const page=Number(pageText);
  const result=await db.prepare(`SELECT json_group_array(json(row)) AS data FROM (
    SELECT json_object('id',p.public_id,'company',p.company,'country',p.country,'region',p.region,'markets',p.markets,'interests',p.interests,'introduction',p.introduction) AS row
    FROM buyer_publications p JOIN profiles a ON a.user_id=p.user_id WHERE ${clauses.join(' AND ')} ORDER BY p.company,p.public_id LIMIT 51 OFFSET ?)`)
    .bind(...values,(page-1)*50).first<{data:string}>();
  const items=JSON.parse(result?.data??'[]');
  return {items:items.slice(0,50),page,hasMore:items.length>50,publication:'consent-only',message:'Only buyer profiles published with explicit consent appear here. Private profiles and saved items stay private.'};
}
