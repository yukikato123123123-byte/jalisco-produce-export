import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, deferred, details } from './helpers/auth-fixture.mjs';
const { Response } = globalThis;
const reset = { password: 'changed-password-123' };
test('one atomic recovery claim authorizes exactly one concurrent provider password update', async () => {
  const f = fixture(); const ready = deferred(), claims = deferred(), entered = deferred(), release = deferred();
  try {
    const c = await f.login('recovery'); let arrivals = 0;
    f.hooks.before = async p => { if (p.query.startsWith('UPDATE sessions SET recovery_claimed')) { if (++arrivals === 2) ready.resolve(); await claims.promise; } };
    f.upstream.hooks.fetch = async p => { if (p.path.endsWith('/user') && p.method === 'PUT') { entered.resolve(); await release.promise; } return p.normal(); };
    const attempts = [f.request('/api/auth/reset-password', reset, c), f.request('/api/auth/reset-password', reset, c)];
    await ready.promise; claims.resolve(); await entered.promise;
    assert.equal((await Promise.race(attempts)).status, 409); assert.equal(f.upstream.stats.puts, 1);
    release.resolve(); assert.deepEqual((await Promise.all(attempts)).map(r => r.status).sort(), [200, 409]);
    assert.equal((await f.request('/api/auth/reset-password', reset, c)).status, 401); assert.equal(f.upstream.stats.puts, 1);
  } finally { claims.resolve(); release.resolve(); f.close(); }
});
test('login started before reset cannot finish afterward; fresh post-reset login succeeds', async () => {
  const f = fixture(); const entered = deferred(), release = deferred();
  try {
    const recovery = await f.login('recovery'); let held = false;
    f.upstream.hooks.fetch = async p => { if (p.path.endsWith('/token') && !held) { held = true; const result = p.normal(); entered.resolve(); await release.promise; return result; } return p.normal(); };
    const login = f.loginResponse(); await entered.promise;
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 200);
    release.resolve(); const stale = await login; assert.equal(stale.status, 409); assert.equal(stale.headers.get('set-cookie'), null);
    const fresh = await f.login(); assert.equal((await f.request('/api/auth/session', undefined, fresh)).status, 200);
  } finally { release.resolve(); f.close(); }
});
test('conditional session insertion loses a race to generation increment', async () => {
  const f = fixture(); const entered = deferred(), release = deferred();
  try {
    const recovery = await f.login('recovery'); let held = false;
    f.hooks.before = async p => { if (p.query.startsWith('INSERT INTO sessions') && !held) { held = true; entered.resolve(); await release.promise; } };
    const login = f.loginResponse(); await entered.promise;
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 200);
    release.resolve(); assert.equal((await login).status, 409); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM sessions WHERE purpose='normal'").get().n, 0);
  } finally { release.resolve(); f.close(); }
});
test('an already inserted session is revoked when the generation advances; no reliance on cleanup', async () => {
  const f = fixture(); const entered = deferred(), release = deferred();
  try {
    const recovery = await f.login('recovery'); let held = false;
    f.hooks.after = async p => { if (p.query.startsWith('INSERT INTO sessions') && !held) { held = true; entered.resolve(); await release.promise; } };
    const login = f.loginResponse(); await entered.promise;
    f.hooks.before = p => { if (p.query.startsWith('DELETE FROM sessions WHERE user_id')) throw new Error('synthetic cleanup failure'); };
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 200);
    release.resolve(); const late = await login; assert.equal(late.status, 200);
    assert.equal((await f.request('/api/auth/session', undefined, late.headers.get('set-cookie').split(';')[0])).status, 401);
    assert.ok(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n > 0);
  } finally { release.resolve(); f.close(); }
});
test('normal login during reset is denied; completion fences authentication started during reset', async () => {
  const f = fixture(); const entered = deferred(), release = deferred();
  try {
    const recovery = await f.login('recovery');
    f.upstream.hooks.fetch = async p => { if (p.method === 'PUT') { entered.resolve(); await release.promise; } return p.normal(); };
    const pending = f.request('/api/auth/reset-password', reset, recovery); await entered.promise;
    assert.equal((await f.loginResponse()).status, 409);
    release.resolve(); assert.equal((await pending).status, 200); assert.equal((await f.loginResponse()).status, 200);
  } finally { release.resolve(); f.close(); }
});
test('definitive provider rejection consumes recovery proof, revokes old sessions, and permits a fresh attempt', async () => {
  const f = fixture();
  try {
    const normal = await f.login(), recovery = await f.login('recovery');
    f.upstream.hooks.fetch = p => p.method === 'PUT' ? f.upstream.failure(422, 'weak_password') : p.normal();
    const failed = await f.request('/api/auth/reset-password', reset, recovery); assert.equal(failed.status, 400); assert.equal((await failed.json()).recoveryConsumed, true);
    assert.equal(f.sql.prepare('SELECT reset_blocked FROM auth_users').get().reset_blocked, 0);
    assert.equal((await f.request('/api/auth/session', undefined, normal)).status, 401); assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 401);
    f.upstream.hooks.fetch = null; assert.equal((await f.loginResponse()).status, 200);
    const fresh = await f.login('recovery'); assert.equal((await f.request('/api/auth/reset-password', reset, fresh)).status, 200);
  } finally { f.close(); }
});
for (const fault of ['transport', '5xx', 'finalization']) test(`uncertain ${fault} reset stays fenced, requires fresh proof, and never reuses the claimed session`, async () => {
  const f = fixture();
  try {
    const normal = await f.login(), recovery = await f.login('recovery');
    if (fault === 'finalization') f.hooks.before = p => { if (p.query.startsWith('UPDATE auth_users SET reset_blocked')) throw new Error('synthetic D1 failure'); };
    else f.upstream.hooks.fetch = p => { if (p.method !== 'PUT') return p.normal(); if (fault === 'transport') throw new Error('synthetic timeout'); return f.upstream.failure(500, 'unexpected_failure'); };
    const failed = await f.request('/api/auth/reset-password', reset, recovery); assert.equal(failed.status, 503); assert.match((await failed.json()).error, /new recovery code/);
    assert.equal(f.sql.prepare('SELECT reset_blocked FROM auth_users').get().reset_blocked, 1);
    assert.equal((await f.request('/api/auth/session', undefined, normal)).status, 401); assert.equal((await f.loginResponse()).status, 409);
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 401);
    f.hooks.before = null; f.upstream.hooks.fetch = null;
    const fresh = await f.login('recovery'); assert.equal((await f.request('/api/auth/reset-password', reset, fresh)).status, 409);
    // Simulate passage of the pending-operation lease; expiry alone NEVER unlocks login.
    f.sql.prepare('UPDATE auth_users SET reset_deadline=0').run(); assert.equal((await f.loginResponse()).status, 409);
    assert.equal((await f.request('/api/auth/reset-password', reset, fresh)).status, 200); assert.equal((await f.loginResponse()).status, 200);
  } finally { f.close(); }
});
test('database claim failure never calls provider PUT; failed issuance never sets a cookie', async () => {
  const f = fixture();
  try {
    const recovery = await f.login('recovery');
    f.hooks.before = p => { if (p.query.startsWith('UPDATE sessions SET recovery_claimed')) throw new Error('synthetic claim failure'); };
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 503); assert.equal(f.upstream.stats.puts, 0);
    assert.equal(f.sql.prepare('SELECT recovery_claimed FROM sessions').get().recovery_claimed, 0);
    f.hooks.before = p => { if (p.query.startsWith('INSERT INTO sessions')) throw new Error('synthetic insert failure'); };
    const failed = await f.loginResponse(); assert.equal(failed.status, 503); assert.equal(failed.headers.get('set-cookie'), null);
  } finally { f.close(); }
});
test('token-to-user binding rejects wrong identities, invalid tokens and expired provider tokens', async () => {
  const f = fixture();
  try {
    const c = await f.login(); const token = [...f.upstream.tokens.values()][0]; token.userId = 'u2';
    assert.equal((await f.request('/api/auth/session', undefined, c)).status, 401);
    f.upstream.hooks.fetch = p => p.path.endsWith('/token') ? Response.json(f.upstream.mint('u2')) : p.normal();
    assert.equal((await f.loginResponse()).status, 403); f.upstream.hooks.fetch = null;
    const good = await f.login(); f.upstream.tokens.clear(); assert.equal((await f.request('/api/auth/session', undefined, good)).status, 401);
    const expires = await f.login(); f.upstream.advance(3600001); assert.equal((await f.request('/api/auth/session', undefined, expires)).status, 401);
  } finally { f.close(); }
});
test('stateful provider-contract OTP expiry, reuse and purpose checks fail closed in the Worker', async () => {
  const f = fixture();
  try {
    const code = f.upstream.issueCode('recovery'); const base = { email: 'test@example.test', code };
    assert.equal((await f.request('/api/auth/verify', { ...base, type: 'signup' })).status, 400);
    const verified = await f.request('/api/auth/verify', { ...base, type: 'recovery' }); assert.equal(verified.status, 200);
    assert.equal((await f.request('/api/auth/verify', { ...base, type: 'recovery' })).status, 400);
    const c = verified.headers.get('set-cookie').split(';')[0]; assert.equal((await f.request('/api/auth/onboarding', details, c)).status, 403);
    const expired = f.upstream.issueCode('signup', 'u1', 1); f.upstream.advance(2);
    assert.equal((await f.request('/api/auth/verify', { ...base, code: expired, type: 'signup' })).status, 400);
  } finally { f.close(); }
});
test('per-session read limit bounds provider calls without caching identity or revocation', async t => {
  const now=Date.now();t.mock.method(Date,'now',()=>now);
  const f = fixture();
  try {
    const c = await f.login(); const before = f.upstream.stats.userChecks;
    for (let i=0; i<60; i++) assert.equal((await f.request('/api/auth/session', undefined, c)).status, 200);
    const limited = await f.request('/api/auth/session', undefined, c); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
    assert.equal(f.upstream.stats.userChecks-before, 60);
    assert.equal((await f.request('/api/auth/logout', {}, c)).status, 200);
  } finally { f.close(); }
});
for (const [status, code, expected] of [[400, 'email_provider_disabled', 503], [401, 'invalid_api_key', 503], [403, 'signup_disabled', 503], [422, 'email_address_invalid', 400], [429, 'over_email_send_rate_limit', 429], [500, 'unexpected_failure', 503], [400, 'unknown_future_code', 503], [422, 'unknown_future_code', 503]]) test(`provider ${status}/${code} is classified without email success or private details`, async () => {
  const f = fixture(); try {
    f.upstream.hooks.fetch = () => f.upstream.failure(status, code, status === 429 ? '2' : null);
    for (const path of ['/api/auth/signup', '/api/auth/forgot-password', '/api/auth/resend']) {
      const r = await f.request(path, { ...details, email: 'test@example.test', password: 'valid-password-123' });
      assert.equal(r.status, expected); const text = await r.text(); assert.doesNotMatch(text, /PRIVATE|person@example|synthetic-token|eligible|unknown_future_code/); assert.match(text, /error/);
      if (status === 429) assert.equal(r.headers.get('Retry-After'), '2');
    }
  } finally { f.close(); }
});
test('account-existence outcomes match accepted guidance while password validation remains an error', async () => {
  const f = fixture(); try {
    const body = { ...details, email: 'test@example.test', password: 'valid-password-123' }; const accepted = await (await f.request('/api/auth/signup', body)).text();
    for (const code of ['user_already_exists', 'email_exists']) { f.upstream.hooks.fetch = () => f.upstream.failure(422, code); const r = await f.request('/api/auth/signup', body); assert.equal(r.status, 200); assert.equal(await r.text(), accepted); }
    f.upstream.hooks.fetch = () => f.upstream.failure(422, 'weak_password'); const weak = await f.request('/api/auth/signup', body); assert.equal(weak.status, 400); assert.match((await weak.json()).error, /stronger password/);
    for (const path of ['/api/auth/forgot-password', '/api/auth/resend']) {
      f.upstream.hooks.fetch = null; const existing = await (await f.request(path, body)).text(); f.upstream.hooks.fetch = () => f.upstream.failure(400, 'user_not_found'); const unknown = await f.request(path, body); assert.equal(unknown.status, 200); assert.equal(await unknown.text(), existing);
    }
  } finally { f.close(); }
});
test('generation checks preserve producer/buyer boundaries and expire recovery proof', async () => {
  const f = fixture(); try {
    const producer = await f.login(), buyer = await f.login(undefined, 'u2');
    assert.equal((await f.request('/api/auth/onboarding', details, producer)).status, 200); assert.equal((await f.request('/api/auth/onboarding', { ...details, role: 'buyer' }, buyer)).status, 200);
    assert.equal((await f.request('/api/producer/dashboard', undefined, buyer)).status, 403); assert.equal((await f.request('/api/buyer/dashboard', undefined, producer)).status, 403); assert.equal((await f.request('/api/producer/dashboard', undefined, producer)).status, 200);
    assert.equal((await f.request('/api/auth/onboarding', { ...details, role: 'buyer' }, producer)).status, 409);
    const recovery = await f.login('recovery'); f.sql.prepare("UPDATE sessions SET expires=0 WHERE purpose='recovery'").run(); assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 401); assert.equal(f.upstream.stats.puts, 0);
  } finally { f.close(); }
});
test('a committed claim with a lost database response fails closed and never updates the provider', async () => {
  const f = fixture(); try {
    const normal = await f.login(), recovery = await f.login('recovery');
    f.hooks.after = p => { if (p.query.startsWith('UPDATE sessions SET recovery_claimed')) throw new Error('synthetic lost reply after commit'); };
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 503); assert.equal(f.upstream.stats.puts, 0);
    assert.equal((await f.request('/api/auth/session', undefined, normal)).status, 401);
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 401);
    assert.equal(f.sql.prepare('SELECT reset_blocked FROM auth_users').get().reset_blocked, 1);
  } finally { f.close(); }
});
test('database snapshot failure prevents authentication from even reaching the provider', async () => {
  const f = fixture(); try {
    f.hooks.before = p => { if (p.query.startsWith('SELECT revision FROM auth_clock')) throw new Error('synthetic snapshot failure'); };
    const r = await f.loginResponse(); assert.equal(r.status, 503); assert.equal(r.headers.get('set-cookie'), null); assert.equal(f.upstream.stats.authentications, 0);
  } finally { f.close(); }
});
test('lost finalization reply is safe even when its generation transaction already committed', async () => {
  const f = fixture(); try {
    const normal = await f.login(), recovery = await f.login('recovery');
    f.hooks.after = p => { if (p.query.startsWith('UPDATE auth_users SET reset_blocked')) throw new Error('synthetic lost finalization reply'); };
    const r = await f.request('/api/auth/reset-password', reset, recovery); assert.equal(r.status, 503); assert.equal((await r.json()).recoveryConsumed, true);
    const state = f.sql.prepare('SELECT * FROM auth_users').get(); assert.equal(state.generation, 2); assert.equal(state.reset_blocked, 0);
    assert.equal((await f.request('/api/auth/session', undefined, normal)).status, 401); assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 401);
    f.hooks.after = null; assert.equal((await f.loginResponse()).status, 200);
  } finally { f.close(); }
});
test('another user reset does not reject a first-ever login for an unrelated identity', async () => {
  const f = fixture(); const entered = deferred(), release = deferred();
  try {
    const recovery = await f.login('recovery');
    f.upstream.hooks.fetch = async p => { if (p.path.endsWith('/token') && p.body.email === 'buyer@example.test') { const result = p.normal(); entered.resolve(); await release.promise; return result; } return p.normal(); };
    const unrelated = f.loginResponse(undefined, 'u2'); await entered.promise;
    assert.equal((await f.request('/api/auth/reset-password', reset, recovery)).status, 200); release.resolve(); assert.equal((await unrelated).status, 200);
  } finally { release.resolve(); f.close(); }
});
