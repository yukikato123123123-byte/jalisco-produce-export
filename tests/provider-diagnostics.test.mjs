import test from 'node:test';
import assert from 'node:assert/strict';
import { provider } from '../worker/provider.ts';
const { console, Response } = globalThis;

test('credential errors survive numeric primary codes and OAuth error fields', async () => {
  const fetcher = globalThis.fetch;
  const env = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'PRIVATE KEY' };
  try {
    for (const payload of [{ code: 400, error_code: 'invalid_credentials' }, { error: 'invalid_credentials' }]) {
      globalThis.fetch = async () => Response.json(payload, { status: 400 });
      await assert.rejects(provider(env, 'token?grant_type=password', 'POST'), e => e.status === 400 && e.code === 'authentication_rejected');
    }
  } finally { globalThis.fetch = fetcher; }
});

test('OAuth invalid_grant is an authentication rejection rather than a service outage', async () => {
  const fetcher = globalThis.fetch, warn = console.warn, logs = [];
  globalThis.fetch = async () => Response.json({ error: 'invalid_grant', error_description: 'PRIVATE RESPONSE' }, { status: 400 });
  console.warn = line => logs.push(JSON.parse(line));
  try {
    await assert.rejects(provider({ AUTH_ENVIRONMENT: 'staging', SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'PRIVATE KEY' }, 'token?grant_type=password', 'POST'), e => e.status === 400 && e.code === 'authentication_rejected' && !e.message.includes('PRIVATE'));
    assert.equal(logs[0].category, 'invalid_grant');
    await assert.rejects(provider({ SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'PRIVATE KEY' }, 'signup', 'POST'), e => e.status === 503);
  } finally { globalThis.fetch = fetcher; console.warn = warn; }
});

test('staging diagnostics identify a rejected key without logging credentials or provider text', async () => {
  const fetcher = globalThis.fetch, warn = console.warn, logs = [];
  globalThis.fetch = async () => Response.json({ message: 'Invalid API key', extra: 'PRIVATE RESPONSE' }, { status: 401 });
  console.warn = line => logs.push(JSON.parse(line));
  const env = { AUTH_ENVIRONMENT: 'staging', SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'PRIVATE KEY' };
  try {
    await assert.rejects(provider(env, 'token?grant_type=password', 'POST', { password: 'PRIVATE PASSWORD' }), e => e.status === 503 && e.code === 'service_configuration');
    assert.deepEqual(logs, [{ event: 'auth_provider_failure', endpoint: 'token', status: 401, category: 'invalid_api_key' }]);
    logs.length = 0;
    delete env.AUTH_ENVIRONMENT;
    await assert.rejects(provider(env, 'token?grant_type=password', 'POST'));
    assert.deepEqual(logs, []);
  } finally { globalThis.fetch = fetcher; console.warn = warn; }
});

test('untrusted provider codes are reduced to a fixed category and failures stay closed', async () => {
  const fetcher = globalThis.fetch, warn = console.warn, logs = [];
  globalThis.fetch = async () => Response.json({ code: 'private_diagnostic', message: 'PRIVATE RESPONSE' }, { status: 500 });
  console.warn = line => logs.push(JSON.parse(line));
  try {
    await assert.rejects(provider({ AUTH_ENVIRONMENT: 'staging', SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'PRIVATE KEY' }, 'token?private=value'), e => e.status === 503);
    assert.deepEqual(logs, [{ event: 'auth_provider_failure', endpoint: 'token', status: 500, category: 'other_provider_rejection' }]);
  } finally { globalThis.fetch = fetcher; console.warn = warn; }
});
