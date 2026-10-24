import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, details } from './helpers/auth-fixture.mjs';
import { assertAuthEnvironment, stagingOrigin, productionSupabaseURL } from '../worker/environment.ts';
const { URL } = globalThis;
const isolatedURL = 'https://abcdefghijklmnopqrst.supabase.co'; // Synthetic; never requested remotely.
function isolate(f) {
  f.env.AUTH_ENVIRONMENT = 'staging';
  f.env.AUTH_ORIGIN = stagingOrigin;
  f.env.SUPABASE_URL = isolatedURL;
}
test('staging rejects shared/missing provider or missing environment marker before any outbound request', async () => {
  const f = fixture();
  try {
    isolate(f);
    let calls = 0; f.upstream.hooks.fetch = p => { calls++; return p.normal(); };
    for (const url of [productionSupabaseURL, '', 'https://REPLACE_WITH_STAGING_PROJECT_REF.supabase.co']) {
      f.env.SUPABASE_URL = url;
      assert.equal((await f.loginResponse()).status, 503);
    }
    f.env.SUPABASE_URL = isolatedURL; delete f.env.AUTH_ENVIRONMENT;
    assert.equal((await f.loginResponse()).status, 503);
    f.env.AUTH_ENVIRONMENT = 'staging'; f.env.AUTH_ORIGIN = 'https://jalisco-produce-export.yukikato123123123.workers.dev';
    assert.equal((await f.loginResponse()).status, 503);
    assert.equal(calls, 0);
    assert.equal(await (await f.request('/')).text(), 'public');
  } finally { f.close(); }
});
test('isolated staging signup/recovery redirects, secure session, role boundaries and logout work locally', async () => {
  const f = fixture();
  try {
    isolate(f);
    const calls = [], fetcher = f.upstream.fetcher;
    globalThis.fetch = (url, options) => { calls.push(String(url)); return fetcher(url, options); };
    assert.equal((await f.request('/api/auth/signup', { ...details, email: 'test@example.test', password: 'valid-password-123' })).status, 200);
    assert.equal((await f.request('/api/auth/resend', { email: 'test@example.test' })).status, 200);
    assert.equal((await f.request('/api/auth/forgot-password', { email: 'test@example.test' })).status, 200);
    for (const url of calls) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, isolatedURL);
      assert.equal(parsed.searchParams.get('redirect_to'), stagingOrigin + (parsed.pathname.endsWith('/recover') ? '/verify-email?purpose=recovery' : '/verify-email'));
    }
    const code = f.upstream.issueCode('signup');
    const verified = await f.request('/api/auth/verify', { email: 'test@example.test', code, type: 'signup' });
    assert.equal(verified.status, 200);
    const header = verified.headers.get('set-cookie');
    assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Lax/);
    const cookie = header.split(';')[0];
    assert.equal((await f.request('/api/auth/session', undefined, cookie)).status, 200);
    assert.equal((await f.request('/api/auth/onboarding', details, cookie)).status, 200);
    assert.equal((await f.request('/api/producer/dashboard', undefined, cookie)).status, 200);
    assert.equal((await f.request('/api/buyer/dashboard', undefined, cookie)).status, 403);
    assert.equal((await f.request('/api/auth/logout', {}, cookie)).status, 200);
    assert.equal((await f.request('/api/auth/session', undefined, cookie)).status, 401);
    const fresh = await f.login();
    assert.equal((await f.request('/api/auth/session', undefined, fresh)).status, 200);
  } finally { f.close(); }
});
test('legacy shared-provider cookies and cookies from another isolated project cannot be replayed', async () => {
  const f = fixture();
  try {
    const legacy = await f.login();
    isolate(f);
    const before = f.upstream.stats.userChecks;
    assert.equal((await f.request('/api/auth/session', undefined, legacy)).status, 401);
    assert.equal(f.upstream.stats.userChecks, before);
    const isolated = await f.login();
    assert.equal((await f.request('/api/auth/session', undefined, isolated)).status, 200);
    f.env.SUPABASE_URL = 'https://tsrqponmlkjihgfedcba.supabase.co';
    const prior = f.upstream.stats.userChecks;
    assert.equal((await f.request('/api/auth/session', undefined, isolated)).status, 401);
    assert.equal(f.upstream.stats.userChecks, prior);
  } finally { f.close(); }
});
test('staging email rate limits expose only a safe classification, without automatic retries', async () => {
  const f = fixture();
  try {
    isolate(f);
    let calls = 0;
    f.upstream.hooks.fetch = () => { calls++; return f.upstream.failure(429, 'over_email_send_rate_limit'); };
    const response = await f.request('/api/auth/signup', { ...details, email: 'test@example.test', password: 'valid-password-123' });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    const body = await response.text();
    assert.equal(JSON.parse(body).code, 'email_rate_limited');
    assert.doesNotMatch(body, /PRIVATE|synthetic-token|person@example/);
    assert.equal(calls, 1);
    delete f.env.AUTH_ENVIRONMENT; f.env.AUTH_ORIGIN = 'https://app.example.test';
    const legacy = await f.request('/api/auth/signup', { ...details, email: 'test@example.test', password: 'valid-password-123' });
    assert.equal((await legacy.json()).code, undefined);
  } finally { f.close(); }
});
test('production environment validation retains its previous contract', () => {
  assert.doesNotThrow(() => assertAuthEnvironment({ AUTH_ORIGIN: 'https://jalisco-produce-export.yukikato123123123.workers.dev', SUPABASE_URL: productionSupabaseURL }));
});
test('new-project email templates separate one-time signup/recovery hashes and numeric codes', () => {
  for (const name of ['confirm-signup', 'recovery']) {
    const text = readFileSync(`staging/emails/${name}.html`, 'utf8');
    assert.ok(text.includes('{{ .Token }}'));
    assert.ok(text.includes(stagingOrigin + '/verify-email'));
    assert.ok(text.includes('{{ .TokenHash }}'));
    assert.ok(text.includes(name === 'recovery' ? 'type=recovery' : 'type=signup'));
    assert.doesNotMatch(text, /ConfirmationURL|access_token|refresh_token|jalisco-produce-export\./);
  }
});
