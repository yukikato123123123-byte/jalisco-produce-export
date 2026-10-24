import {attachImages} from './productImages.ts';
import type { Database } from './authState.ts';
import { Failure } from './provider.ts';
export function text(b: Record<string, unknown>, k: string, max: number, required = false) {
  const v = b[k] ?? '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Failure(400, `Enter a valid ${k} (maximum ${max} characters).`);
  return v.trim();
}
function number(b: Record<string, unknown>, k: string, optional = false) {
  if (optional && (b[k] === '' || b[k] === null || b[k] === undefined)) return null;
  if (!['string', 'number'].includes(typeof b[k]) || String(b[k]).trim() === '') throw new Failure(400, `Enter a valid ${k}.`);
  const v = Number(b[k]); if (!Number.isFinite(v) || v < 0 || v > 1e12) throw new Failure(400, `Enter a non-negative ${k} up to 1 trillion.`); return v;
}
async function rows(db: Database, query: string, values: unknown[] = []) {
  const r = await db.prepare(`SELECT json_group_array(json(row)) AS data FROM (${query})`).bind(...values).first<{data: string}>();
  return JSON.parse(r?.data ?? '[]');
}
const itemColumns = 'id, name, description, category, quantity, unit, price, currency, availability, status, updated_at';
export async function publicItems(db: Database, params = new URLSearchParams(), savedBy?: string) {
  const clauses = ["i.status='public'"], values: unknown[] = [];
  for (const [key, expression] of Object.entries({q: "i.name || ' ' || i.description || ' ' || i.category || ' ' || COALESCE(p.company,a.company)", country: 'COALESCE(p.country,a.country)', region: "COALESCE(p.region,'')", category: 'i.category'})) {
    const value = text({[key]:params.get(key) ?? ''},key,120);
    if (value) { clauses.push(`instr(lower(${expression}),lower(?)) > 0`); values.push(value); }
  }
  if (params.has('id')) { clauses.push('i.id=?'); values.push(text({id:params.get('id')},'id',80,true)); }
  if (savedBy) { clauses.push('EXISTS (SELECT 1 FROM buyer_saved_items s WHERE s.item_id=i.id AND s.user_id=?)'); values.push(savedBy); }
  const pageText=params.get('page') ?? '1';
  if (!/^[1-9][0-9]{0,5}$/.test(pageText)) throw new Failure(400,'Enter a valid page number.');
  const page=Number(pageText);
  const items = await rows(db, `SELECT json_object('id',i.id,'name',i.name,'description',i.description,'category',i.category,'quantity',i.quantity,'unit',i.unit,'price',i.price,'currency',i.currency,'availability',i.availability,'company',COALESCE(p.company,a.company),'country',COALESCE(p.country,a.country),'region',COALESCE(p.region,''),'bio',COALESCE(p.bio,''),'business_email',CASE WHEN p.public_contact=1 THEN p.business_email ELSE '' END,'business_phone',CASE WHEN p.public_contact=1 THEN p.business_phone ELSE '' END) AS row FROM approved_public_items i JOIN profiles a ON a.user_id=i.user_id LEFT JOIN producer_profiles p ON p.user_id=i.user_id WHERE ${clauses.join(' AND ')} ORDER BY i.updated_at DESC, i.id LIMIT 51 OFFSET ?`,[...values,(page-1)*50]);
  return {items:await attachImages(db,items.slice(0,50)),page,hasMore:items.length>50};
}
export async function producer(db: Database, userId: string, base: Record<string, unknown>, path: string, method: string, b: Record<string, unknown>) {
  let savedItemId:string|undefined;
  if (method === 'POST' && path === '/api/producer/profile') {
    const company = text(b,'company',120,true), country = text(b,'country',120,true), region = text(b,'region',120), bio = text(b,'bio',2000), email = text(b,'business_email',254), phone = text(b,'business_phone',80);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Failure(400,'Enter a valid business email.');
    if (typeof b.public_contact !== 'boolean') throw new Failure(400,'Choose whether to publish business contact information.');
    await db.prepare(`INSERT INTO producer_profiles(user_id,company,country,region,bio,business_email,business_phone,public_contact) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET company=excluded.company,country=excluded.country,region=excluded.region,bio=excluded.bio,business_email=excluded.business_email,business_phone=excluded.business_phone,public_contact=excluded.public_contact`).bind(userId,company,country,region,bio,email,phone,b.public_contact?1:0).run();
  } else if (method === 'POST' && path === '/api/producer/items') {
    const id = b.id === undefined ? crypto.randomUUID() : text(b,'id',80,true);savedItemId=id;
    if (b.action === 'delete') {
      const deleted = await db.prepare('DELETE FROM producer_items WHERE id=? AND user_id=? RETURNING id').bind(id,userId).first();
      if (!deleted) throw new Failure(404,'Item not found.');
    } else {
      const name=text(b,'name',120,true), description=text(b,'description',2000), category=text(b,'category',120,true), quantity=number(b,'quantity'), unit=text(b,'unit',30,true), price=number(b,'price',true), currency=text(b,'currency',3), availability=text(b,'availability',200), status=text(b,'status',10,true);
      if (!['draft','public','private'].includes(status)) throw new Failure(400,'Choose draft, public or private.');
      if ((price !== null && !/^[A-Z]{3}$/.test(currency)) || (currency && !/^[A-Z]{3}$/.test(currency))) throw new Failure(400,'Use a three-letter uppercase currency code.');
      if (b.id !== undefined) {
        const updated=await db.prepare(`UPDATE producer_items SET name=?,description=?,category=?,quantity=?,unit=?,price=?,currency=?,availability=?,status=?,updated_at=? WHERE id=? AND user_id=? RETURNING id`).bind(name,description,category,quantity,unit,price,currency,availability,status,new Date().toISOString(),id,userId).first();
        if (!updated) throw new Failure(404,'Item not found.');
      } else await db.prepare('INSERT INTO producer_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,userId,name,description,category,quantity,unit,price,currency,availability,status,new Date().toISOString()).run();
    }
  } else if (!(method === 'GET' && path === '/api/producer/dashboard')) throw new Failure(404,'Endpoint not found.');
  const saved=await db.prepare('SELECT company,country,region,bio,business_email,business_phone,public_contact FROM producer_profiles WHERE user_id=?').bind(userId).first<Record<string,unknown>>();
  const profile={...base,region:'',bio:'',business_email:'',business_phone:'',public_contact:0,...saved};
  const items=await rows(db,`SELECT json_object(${itemColumns.split(', ').map(k=>`'${k}',${k}`).join(',')},'approval_state',COALESCE((SELECT state FROM registration_reviews r WHERE r.kind='product' AND r.target_id=producer_items.id),'pending')) AS row FROM producer_items WHERE user_id=? ORDER BY updated_at DESC, id`,[userId]);
  const registrationReview=await db.prepare("SELECT state FROM registration_reviews WHERE kind='producer' AND target_id=?").bind(userId).first<{state:string}>();
  const publiclyVisible=(i:{status:string;approval_state:string})=>i.status==='public'&&i.approval_state==='approved'&&registrationReview?.state==='approved';
  const quantities: Record<string,number>={};
  for (const i of items) if(publiclyVisible(i)) quantities[i.unit]=(quantities[i.unit]??0)+i.quantity;
  const complete=['company','country','region','bio'].filter(k=>profile[k as keyof typeof profile]).length + (profile.business_email || profile.business_phone ? 1:0);
  return {profile,items:await attachImages(db,items),saved_item_id:savedItemId,registration_review:registrationReview?.state??'pending',summary:{total:items.length,public:items.filter(publiclyVisible).length,quantities,profileCompletion:Math.round(complete/5*100)}};
}
