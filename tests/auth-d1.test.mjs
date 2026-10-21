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
    upstream.hooks.fetch = async p => { if (p.method === 'PUT') { entered.resolve(); await release.promise; } return p.normal(); };
    const pending = request('/api/auth/reset-password', { password: 'changed-password-123' }, recovery); await entered.promise;
    assert.ok([401,409].includes((await request('/api/auth/reset-password', { password: 'other-password-123' }, recovery)).status));
    assert.equal((await request('/api/auth/session', undefined, normal)).status, 401);
    release.resolve(); assert.equal((await pending).status, 200); assert.equal(upstream.stats.puts, 1);
    assert.equal((await db.prepare('SELECT generation FROM auth_users WHERE user_id=?').bind('u1').first()).generation, 2);
    const fresh = await login(); assert.equal((await request('/api/producer/dashboard', undefined, fresh)).status, 200);
  } finally { release.resolve(); await mf.dispose(); }
});
