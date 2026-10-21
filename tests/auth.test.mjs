import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle } from '../worker/index.ts';
const { Request, Response, URL } = globalThis;
const details = { full_name: 'Test Person', company: 'Test Farm', country: 'Mexico', role: 'producer' };
function fixture() {
  const sql = new DatabaseSync(':memory:'); for (const name of ['0001_auth.sql', '0002_limits_index.sql', '0003_auth_generations.sql']) sql.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
  const env = { DB: { prepare(query) { return { values: [], bind(...values) { this.values = values; return this; }, async first() { return sql.prepare(query).get(...this.values) ?? null; }, async run() { return sql.prepare(query).run(...this.values); } }; } }, ASSETS: { async fetch() { return new Response('public'); } }, AUTH_ORIGIN: 'https://app.example.test', SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic', SESSION_ENCRYPTION_KEY: 'ab'.repeat(32) };
  let fail = false, confirmed = true; const calls = [], original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (fail) return Response.json({ error: 'DO NOT LEAK' }, { status: 500 });
    if (String(url).endsWith('/user') && options.method === 'GET') return Response.json({ id: 'u1', email: 'test@example.test', email_confirmed_at: confirmed ? '2026-10-21' : null, user_metadata: { role: 'buyer' } });
    if (String(url).includes('/token?') || String(url).endsWith('/verify')) { const body = JSON.parse(options.body); if (body.password === 'invalid-password' || body.token === '000000') return Response.json({ code: body.token === '000000' ? 'otp_expired' : 'invalid_credentials', error: 'DO NOT LEAK' }, { status: 400 }); return Response.json({ access_token: 'synthetic-provider-token', refresh_token: 'DO NOT STORE', expires_in: 3600 }); }
    return Response.json({});
  };
  const request = (path, body, cookie, origin = env.AUTH_ORIGIN) => handle(new Request(env.AUTH_ORIGIN + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  const loginResponse = type => request(type ? '/api/auth/verify' : '/api/auth/login', type ? { email: 'test@example.test', code: '123456', type } : { email: 'test@example.test', password: 'valid-password-123' });
  const login = async type => { const r = await loginResponse(type); assert.equal(r.status, 200); return r.headers.get('set-cookie').split(';')[0]; };
  return { env, sql, request, login, loginResponse, calls, fail: () => { fail = true; }, unconfirmed: () => { confirmed = false; }, close: () => { globalThis.fetch = original; sql.close(); } };
}
test('public assets require no auth; missing configuration fails closed', async () => { const f = fixture(); try { assert.equal(await (await handle(new Request('https://app.example.test/'), { ASSETS: f.env.ASSETS })).text(), 'public'); assert.equal((await handle(new Request('https://app.example.test/api/auth/session'), {})).status, 503); } finally { f.close(); } });
test('registration validation, actual provider invocation, conditional guidance and outage handling', async () => { const f = fixture(); try {
  for (const body of [{}, { ...details, email: 'bad', password: 'short' }, { ...details, role: 'admin', email: 'test@example.test', password: 'valid-password-123' }]) assert.equal((await f.request('/api/auth/signup', body)).status, 400);
  assert.equal(f.calls.length, 0); const r = await f.request('/api/auth/signup', { ...details, email: 'test@example.test', password: 'valid-password-123' }); assert.equal(r.status, 200); assert.match((await r.json()).message, /If this address is eligible/); assert.equal(r.headers.get('set-cookie'), null); assert.match(f.calls.at(-1).url, /\/signup$/);
  f.fail(); assert.equal((await f.request('/api/auth/signup', { ...details, email: 'test@example.test', password: 'valid-password-123' })).status, 503);
} finally { f.close(); } });
test('CSRF rejection and durable request rate limit', async () => { const f = fixture(); try {
  assert.equal((await f.request('/api/auth/login', {}, null, 'https://evil.example')).status, 403); assert.equal(f.calls.length, 0);
  for (let n = 0; n < 30; n++) assert.equal((await f.request('/api/auth/forgot-password', { email: 'test@example.test' })).status, 200);
  assert.equal((await f.request('/api/auth/forgot-password', { email: 'test@example.test' })).status, 429);
} finally { f.close(); } });
test('invalid login, opaque encrypted sessions, secure cookie flags, forged and expired sessions', async () => { const f = fixture(); try {
  const bad = await f.request('/api/auth/login', { email: 'test@example.test', password: 'invalid-password' }); assert.equal(bad.status, 400); assert.doesNotMatch(await bad.text(), /DO NOT LEAK/);
  const r = await f.loginResponse(); assert.equal(r.status, 200); const cookie = r.headers.get('set-cookie'); for (const flag of ['HttpOnly', 'SameSite=Lax', 'Secure', 'Max-Age=3600']) assert.ok(cookie.includes(flag));
  const row = f.sql.prepare('SELECT * FROM sessions').get(); assert.notEqual(row.id, cookie.split('=')[1].split(';')[0]); assert.doesNotMatch(row.token, /synthetic|DO NOT STORE/);
  assert.equal((await f.request('/api/auth/session', undefined, cookie.split(';')[0])).status, 200); assert.equal((await f.request('/api/auth/session', undefined, '__Host-jalisco-session=' + 'c'.repeat(64))).status, 401);
  f.sql.prepare('UPDATE sessions SET expires=0').run(); assert.equal((await f.request('/api/auth/session', undefined, cookie.split(';')[0])).status, 401); f.unconfirmed(); assert.equal((await f.loginResponse()).status, 403);
} finally { f.close(); } });
test('server role isolation, onboarding requirement and immutable roles ignore provider metadata', async () => { const f = fixture(); try {
  for (const role of ['producer', 'buyer']) assert.equal((await f.request(`/api/${role}/dashboard`)).status, 401);
  const c = await f.login(); assert.equal((await f.request('/api/producer/dashboard', undefined, c)).status, 403);
  assert.equal((await f.request('/api/auth/onboarding', details, c)).status, 200); assert.equal((await f.request('/api/producer/dashboard', undefined, c)).status, 200); assert.equal((await f.request('/api/buyer/dashboard', undefined, c)).status, 403);
  assert.equal((await f.request('/api/auth/onboarding', { ...details, role: 'buyer' }, c)).status, 409); assert.throws(() => f.sql.prepare("UPDATE profiles SET role='buyer'").run(), /immutable/);
  f.sql.prepare('DELETE FROM profiles').run(); await f.request('/api/auth/onboarding', { ...details, role: 'buyer' }, c); assert.equal((await f.request('/api/buyer/dashboard', undefined, c)).status, 200); assert.equal((await f.request('/api/producer/dashboard', undefined, c)).status, 403);
} finally { f.close(); } });
test('confirmation, expired codes, recovery-only authority, reset and all-app-session revocation', async () => { const f = fixture(); try {
  assert.equal((await f.request('/api/auth/verify', { email: 'test@example.test', code: '000000', type: 'signup' })).status, 400);
  const c = await f.login('signup'); assert.equal((await f.request('/api/auth/reset-password', { password: 'changed-password-123' }, c)).status, 403);
  const recovery = await f.login('recovery'); assert.equal((await f.request('/api/auth/onboarding', details, recovery)).status, 403); assert.equal((await f.request('/api/producer/dashboard', undefined, recovery)).status, 403);
  assert.equal((await f.request('/api/auth/reset-password', { password: 'short' }, recovery)).status, 400); assert.equal((await f.request('/api/auth/reset-password', { password: 'changed-password-123' }, recovery)).status, 200);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n, 0); assert.equal((await f.request('/api/auth/session', undefined, c)).status, 401);
} finally { f.close(); } });
test('logout immediately revokes local session despite provider outage', async () => { const f = fixture(); try { const c = await f.login(); f.fail(); const r = await f.request('/api/auth/logout', {}, c); assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /Max-Age=0/); assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n, 0); } finally { f.close(); } });

import './auth-security.test.mjs';
import './auth-d1.test.mjs';
