import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { URL } = globalThis;
import { currentSession } from '../worker/authState.ts';
import { migrations, statefulProvider, deferred, details } from './helpers/auth-fixture.mjs';
// Use Wrangler's pinned local-runtime dependencies, not another installed SDK.
const require = createRequire(new URL('../node_modules/wrangler/package.json', import.meta.url));
const { Miniflare, convertV4MiniflareOptions, Response: RuntimeResponse } = require('miniflare');
const { build } = require('esbuild');
test('actual workerd/D1 binding enforces recovery claim, generation fence and role checks', { timeout: 30000 }, async () => {
  const output = await build({ entryPoints: [new URL('../worker/index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'browser' });
  let outboundError = '';
  const upstream = statefulProvider(), entered = deferred(), release = deferred();
  const mf = new Miniflare(convertV4MiniflareOptions({ cf: false, telemetry: { enabled: false }, modules: true, script: output.outputFiles[0].text,
    compatibilityDate: '2026-10-21', d1Databases: ['DB'],
    bindings: { AUTH_ORIGIN: 'https://app.example.test', SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic', SESSION_ENCRYPTION_KEY: 'ab'.repeat(32) },
    serviceBindings: { ASSETS: async () => new RuntimeResponse('public') },
    outboundService: async request => {
      try {
      assert.equal(new URL(request.url).origin, 'https://auth.example.test');
      const response = await upstream.fetcher(request.url, { method: request.method, headers: { Authorization: request.headers.get('Authorization') }, body: request.method === 'GET' ? undefined : await request.text() });
      return new RuntimeResponse(await response.arrayBuffer(), { status: response.status, headers: response.headers });
      } catch (error) { outboundError = error.name; return new RuntimeResponse('{}', { status: 502 }); }
    },
  }));
  try {
    const db = await mf.getD1Database('DB');
    // D1 exec accepts complete SQL statements; keep trigger bodies together.
    for (const [index, migration] of migrations.entries()) {
      const statements = migration.replace(/--[^\n]*/g, '').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g);
      for (const statement of statements) await db.prepare(statement).run();
      if (index === 1) await db.prepare("INSERT INTO sessions (id,user_id,token,expires,purpose) VALUES ('legacy','legacy-user','synthetic',?,'normal')").bind(Date.now()+60000).run();
    }
    assert.equal((await db.prepare("SELECT generation FROM sessions WHERE id='legacy'").first()).generation, -1);
    await db.prepare("INSERT INTO auth_users(user_id) VALUES ('legacy-user')").run();
    assert.equal(await currentSession(db, 'legacy'), null);
    const request = (path, body, cookie) => mf.dispatchFetch('https://app.example.test' + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { Origin: 'https://app.example.test', 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    async function login(type) { const r = await request(type ? '/api/auth/verify' : '/api/auth/login', type ? { email: 'test@example.test', code: upstream.issueCode(type), type } : { email: 'test@example.test', password: upstream.users.get('u1').password }); assert.equal(r.status, 200, (await r.text()) + ' outbound=' + outboundError); return r.headers.get('set-cookie').split(';')[0]; }
    assert.equal(await (await request('/')).text(), 'public');
    const normal = await login(), recovery = await login('recovery');
    assert.equal((await request('/api/auth/onboarding', details, normal)).status, 200);
    assert.equal((await request('/api/producer/dashboard', undefined, normal)).status, 200);
    assert.equal((await request('/api/buyer/dashboard', undefined, normal)).status, 403);
    const created = await request('/api/producer/items', { name: 'Avocado', description: '', category: 'Hass', quantity: 20, unit: 'kg', price: '', currency: '', availability: '', status: 'public' }, normal);
    assert.equal(created.status, 200);
    const workspace = await created.json();
    assert.equal(workspace.summary.quantities.kg, undefined);
    assert.equal(workspace.summary.public,0);
    const publicResponse = await request('/api/public/produce');
    assert.equal(publicResponse.status, 200);
    const publicData = await publicResponse.json();
    // Publishing preference cannot bypass the new administrator review boundary.
    assert.deepEqual(publicData.items, []);
    assert.equal(workspace.items[0].name, 'Avocado');
    assert.equal(workspace.items[0].user_id, undefined);
    assert.equal((await db.prepare("SELECT state FROM registration_reviews WHERE kind='product' AND target_id=?").bind(workspace.items[0].id).first()).state,'pending');
    assert.equal((await request('/api/producer/items', { id: workspace.items[0].id, action: 'delete' }, normal)).status, 200);

    // Exercise implicit callback validation and its one-use reservation on real D1.
    const minted = upstream.mint('u1', 'recovery');
    const nowSeconds = Math.floor(Date.now() / 1000);
    const encode = value => globalThis.btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const implicit = encode({ alg: 'ES256', typ: 'JWT' }) + '.' + encode({ iss: 'https://auth.example.test/auth/v1', sub: 'u1', exp: nowSeconds + 3600, amr: [{ method: 'otp', timestamp: nowSeconds }] }) + '.synthetic_signature';
    upstream.tokens.set(implicit, upstream.tokens.get(minted.access_token));
    const callbackBody = { type: 'recovery', access_token: implicit };
    const callbacks = await Promise.all([request('/api/auth/callback', callbackBody), request('/api/auth/callback', callbackBody)]);
    assert.deepEqual(callbacks.map(r => r.status).sort(), [200, 400]);
    const implicitCookie = callbacks.find(r => r.status === 200).headers.get('set-cookie').split(';')[0];
    assert.equal((await (await request('/api/auth/session', undefined, implicitCookie)).json()).recovery, true);
    assert.equal((await request('/api/producer/dashboard', undefined, implicitCookie)).status, 403);
    assert.equal((await request('/api/auth/logout', {}, implicitCookie)).status, 200);
    upstream.hooks.fetch = async p => { if (p.method === 'PUT') { entered.resolve(); await release.promise; } return p.normal(); };
    const pending = request('/api/auth/reset-password', { password: 'changed-password-123' }, recovery); await entered.promise;
    assert.ok([401,409].includes((await request('/api/auth/reset-password', { password: 'other-password-123' }, recovery)).status));
    assert.equal((await request('/api/auth/session', undefined, normal)).status, 401);
    release.resolve(); assert.equal((await pending).status, 200); assert.equal(upstream.stats.puts, 1);
    assert.equal((await db.prepare('SELECT generation FROM auth_users WHERE user_id=?').bind('u1').first()).generation, 2);
    const fresh = await login(); assert.equal((await request('/api/producer/dashboard', undefined, fresh)).status, 200);
  } finally { release.resolve(); await mf.dispose(); }
});

test('actual isolated workerd/D1 sessions reject legacy cookies and preserve authorization/logout', { timeout: 30000 }, async () => {
  const origin = 'https://jalisco-auth-staging.yukikato123123123.workers.dev';
  const providerOrigin = 'https://abcdefghijklmnopqrst.supabase.co';
  const output = await build({ entryPoints: [new URL('../worker/index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'browser' });
  const upstream = statefulProvider();
  const mf = new Miniflare(convertV4MiniflareOptions({ cf: false, telemetry: { enabled: false }, modules: true, script: output.outputFiles[0].text,
    compatibilityDate: '2026-10-21', d1Databases: ['DB'],
    bindings: { AUTH_ENVIRONMENT: 'staging', AUTH_ORIGIN: origin, SUPABASE_URL: providerOrigin, SUPABASE_PUBLISHABLE_KEY: 'synthetic', SESSION_ENCRYPTION_KEY: 'ab'.repeat(32) },
    serviceBindings: { ASSETS: async () => new RuntimeResponse('public') },
    outboundService: async request => {
      assert.equal(new URL(request.url).origin, providerOrigin);
      const response = await upstream.fetcher(request.url, { method: request.method, headers: { Authorization: request.headers.get('Authorization') }, body: request.method === 'GET' ? undefined : await request.text() });
      return new RuntimeResponse(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    },
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const migration of migrations) {
      const statements = migration.replace(/--[^\n]*/g, '').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g);
      for (const statement of statements) await db.prepare(statement).run();
    }
    const request = (path, body, cookie, requestOrigin = origin) => mf.dispatchFetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const verified = await request('/api/auth/verify', { email: 'test@example.test', code: upstream.issueCode('signup'), type: 'signup' });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie').split(';')[0];
    assert.match(verified.headers.get('set-cookie'), /HttpOnly/);
    assert.match(verified.headers.get('set-cookie'), /Secure/);
    assert.equal((await request('/api/auth/session', undefined, cookie)).status, 200);
    assert.equal((await request('/api/auth/onboarding', details, cookie)).status, 200);
    assert.equal((await request('/api/buyer/dashboard', undefined, cookie)).status, 403);
    const oldCookie = '__Host-jalisco-session=' + 'c'.repeat(64);
    const { createHash } = await import('node:crypto');
    const row = await db.prepare('SELECT * FROM sessions LIMIT 1').first();
    await db.prepare('INSERT INTO sessions (id,user_id,token,expires,purpose,generation) VALUES (?,?,?,?,?,?)')
      .bind(createHash('sha256').update('c'.repeat(64)).digest('hex'), row.user_id, row.token, row.expires, row.purpose, row.generation).run();
    const checks = upstream.stats.userChecks;
    assert.equal((await request('/api/auth/session', undefined, oldCookie)).status, 401);
    assert.equal(upstream.stats.userChecks, checks);
    assert.equal((await request('/api/auth/signup', {}, undefined, 'https://untrusted.example.test')).status, 403);
    assert.equal((await request('/api/auth/logout', {}, cookie)).status, 200);
    assert.equal((await request('/api/auth/session', undefined, cookie)).status, 401);
  } finally { await mf.dispose(); }
});
