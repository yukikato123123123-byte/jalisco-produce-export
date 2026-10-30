import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle } from '../../worker/index.ts';
const { Request, Response, URL, crypto } = globalThis;
export const migrations = ['0001_auth.sql', '0002_limits_index.sql', '0003_auth_generations.sql', '0004_producer_workspace.sql', '0005_buyer_center.sql', '0006_buyer_publication.sql', '0007_admin_operations.sql', '0008_admin_grant_events.sql','0010_inquiries.sql','0011_inquiry_workflow.sql','0012_registration_reviews.sql','0013_product_images.sql','0014_admin_notifications_drafts.sql','0017_nopahua_research.sql','0018_research_applicants.sql','0019_research_questionnaire.sql','0020_public_nopal_survey.sql'].map(name => readFileSync(new URL('../../migrations/' + name, import.meta.url), 'utf8'));
export function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
export const details = { full_name: 'Test Person', company: 'Test Farm', country: 'Mexico', role: 'producer' };
export function statefulProvider() {
  const users = new Map([['u1', { id: 'u1', email: 'test@example.test', password: 'valid-password-123', email_confirmed_at: '2026-10-21T00:00:00Z' }], ['u2', { id: 'u2', email: 'buyer@example.test', password: 'buyer-password-123', email_confirmed_at: '2026-10-21T00:00:00Z' }]]);
  const tokens = new Map(), codes = new Map(), hooks = {};
  let serial = 0, now = Date.now();
  const stats = { puts: 0, userChecks: 0, authentications: 0 };
  function issueCode(type, userId = 'u1', lifetime = 60000) { const code = String(100000 + ++serial); codes.set(code, { userId, type, expires: now + lifetime, used: false }); return code; }
  const failure = (status, code, retry = null) => Response.json({ code, msg: 'PRIVATE provider detail: synthetic-token, person@example.test' }, { status, headers: retry ? { 'Retry-After': retry } : {} });
  function issueHash(type, userId = 'u1', lifetime = 60000) { const code=issueCode(type,userId,lifetime), hash='synthetic-hash-proof-'+code; codes.set(hash,codes.get(code)); codes.delete(code); return hash; }
  function mint(userId, purpose = 'normal') { const access_token = 'synthetic-token-' + ++serial; tokens.set(access_token, { userId, expires: now + 3600000, purpose }); return { access_token, expires_in: 3600, refresh_token: 'never-store-synthetic-refresh' }; }
  async function fetcher(url, options) {
    const path = new URL(url).pathname, method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    if (path.endsWith('/user') && method === 'PUT') stats.puts++;
    if (path.endsWith('/user') && method === 'GET') stats.userChecks++;
    if (path.endsWith('/token') || path.endsWith('/verify')) stats.authentications++;
    const normal = () => {
      if (path.endsWith('/token')) { const user = [...users.values()].find(u => u.email === body.email); if (!user || user.password !== body.password) return failure(400, 'invalid_credentials'); return Response.json(mint(user.id)); }
      if (path.endsWith('/verify')) { const code = codes.get(body.token_hash ?? body.token); if (!code || code.used || code.expires <= now || code.type !== body.type || (!body.token_hash && users.get(code.userId).email !== body.email)) return failure(400, 'otp_expired'); code.used = true; return Response.json(mint(code.userId, code.type)); }
      if (path.endsWith('/user')) {
        const access = options.headers.Authorization?.replace(/^Bearer /, ''); const token = tokens.get(access);
        if (!token || token.expires <= now) return failure(401, 'bad_jwt');
        const user = users.get(token.userId);
        if (method === 'PUT') { user.password = body.password; return Response.json({ id: user.id }); }
        return Response.json({ id: user.id, email: user.email, email_confirmed_at: user.email_confirmed_at, user_metadata: { role: 'buyer' } });
      }
      return Response.json({});
    };
    return hooks.fetch ? hooks.fetch({ path, method, body, options, normal }) : normal();
  }
  return { users, tokens, codes, hooks, stats, mint, issueCode, issueHash, failure, fetcher, advance: ms => { now += ms; } };
}
export function fixture() {
  const sql = new DatabaseSync(':memory:'); migrations.forEach(migration => sql.exec(migration));
  const hooks = {}, upstream = statefulProvider();
  async function perform(kind, query, values) {
    if (hooks.before) await hooks.before({ kind, query, values });
    const result = kind === 'first' ? sql.prepare(query).get(...values) ?? null : sql.prepare(query).run(...values);
    if (hooks.after) await hooks.after({ kind, query, values, result });
    return result;
  }
  const env = { DB: { prepare(query) { return { values: [], bind(...values) { this.values = values; return this; }, first() { return perform('first', query, this.values); }, run() { return perform('run', query, this.values); } }; } }, ASSETS: { fetch: async () => new Response('public') }, AUTH_ORIGIN: 'https://app.example.test', SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic', SESSION_ENCRYPTION_KEY: 'ab'.repeat(32) };
  const original = globalThis.fetch; globalThis.fetch = upstream.fetcher;
  const request = (path, body, cookie) => handle(new Request(env.AUTH_ORIGIN + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  async function loginResponse(type, userId = 'u1') { const user = upstream.users.get(userId); return request(type ? '/api/auth/verify' : '/api/auth/login', type ? { email: user.email, code: upstream.issueCode(type, userId), type } : { email: user.email, password: user.password }); }
  async function login(type, userId) { const r = await loginResponse(type, userId); if (r.status !== 200) throw new Error('Synthetic login failed: ' + r.status); return r.headers.get('set-cookie').split(';')[0]; }
  return { env, sql, hooks, upstream, request, loginResponse, login, close() { globalThis.fetch = original; sql.close(); } };
}

// Only disposable fixtures use this helper; real grants require the operator CLI.
export function accessEvent(f, action='grant', userId='u1', projectRef='auth.example.test') {
 f.sql.prepare("INSERT INTO auth_users(user_id) VALUES(?) ON CONFLICT DO NOTHING").run(userId);
 f.sql.prepare("INSERT INTO profiles VALUES(?, 'Synthetic Person','Synthetic Farm','MX','producer') ON CONFLICT DO NOTHING").run(userId);
 const previous=f.sql.prepare('SELECT last_event_id FROM admin_grants WHERE user_id=?').get(userId);
 const id=crypto.randomUUID();
 f.sql.prepare('INSERT INTO admin_grant_events VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,action,userId,projectRef,'cf-token:synthetic','synthetic-owner','synthetic-approval','a'.repeat(64),'Synthetic test',previous?.last_event_id??null,new Date().toISOString());
 return id;
}
// Explicitly approved public fixtures, never used by Worker or remote scripts.
// Writes use the same scoped audit triggers as the production decision endpoint.
export function approveFixtureRegistrations(f){
 const actor=f.sql.prepare('SELECT user_id FROM profiles ORDER BY user_id LIMIT 1').get()?.user_id;if(!actor)return;
 const active=f.sql.prepare('SELECT user_id FROM admin_grants WHERE user_id=? AND revoked_at IS NULL').get(actor);
 if(!active)accessEvent(f,'grant',actor);
 for(const kind of ['producer','buyer','product'])for(const r of f.sql.prepare('SELECT * FROM registration_reviews WHERE kind=? AND state!=?').all(kind,'approved')){
  f.sql.prepare('INSERT INTO registration_review_events(id,kind,target_id,revision,actor_id,project_ref,before_state,after_state,expected_event_id,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),kind,r.target_id,r.revision,actor,'auth.example.test',r.state,'approved',r.last_event_id,'Explicitly approved disposable publication fixture',new Date().toISOString());
 }
 if(!active)accessEvent(f,'revoke',actor);
}
