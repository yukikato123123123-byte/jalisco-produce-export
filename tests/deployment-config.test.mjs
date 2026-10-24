import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, validateDeployment } from '../scripts/validate-deployment.mjs';

function approvedFixture(target, stagingMode = 'custom-domain') {
  const config = readConfig(`wrangler.${target}.jsonc`);
  config.account_id = 'a'.repeat(32); // Synthetic account; no remote access.
  if (target === 'staging') {
    // Select the whole routing mode; do not inherit the user's deployment choice.
    config.vars.SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
    config.workers_dev = stagingMode === 'workers-dev';
    config.vars.AUTH_ORIGIN = config.workers_dev
      ? 'https://jalisco-auth-staging.example.workers.dev'
      : 'https://staging.example.test';
    config.routes = config.workers_dev ? [] : [{ pattern: 'staging.example.test', custom_domain: true }];
  } else {
    config.d1_databases[0].database_id = '11111111-2222-3333-4444-555555555555';
    config.d1_databases[0].database_name = 'auth-production-test-fixture';
  }
  return config;
}
test('unconfirmed account and origin cannot pass the release preflight', () => {
  for (const target of ['staging', 'production']) {
    const config = approvedFixture(target);
    config.account_id = 'REPLACE_WITH_APPROVED_ACCOUNT_ID';
    config.vars.AUTH_ORIGIN = 'REPLACE_WITH_APPROVED_ORIGIN';
    assert.ok(validateDeployment(config, target).length);
  }
});
test('isolated custom-domain staging, workers.dev staging and production shapes pass', () => {
  assert.deepEqual(validateDeployment(approvedFixture('staging', 'custom-domain'), 'staging'), []);
  assert.deepEqual(validateDeployment(approvedFixture('staging', 'workers-dev'), 'staging'), []);
  assert.deepEqual(validateDeployment(approvedFixture('production'), 'production'), []);
});
test('production preflight rejects the known staging database and API/static routing loss', () => {
  const config = approvedFixture('production');
  config.d1_databases = readConfig('wrangler.staging.jsonc').d1_databases;
  assert.ok(validateDeployment(config, 'production').includes('Production and staging databases must be isolated.'));
  config.assets.run_worker_first = [];
  assert.ok(validateDeployment(config, 'production').includes('API requests must run the Worker first.'));
});
test('staging preflight rejects the production origin, wildcard routes and plaintext keys', () => {
  const config = approvedFixture('staging');
  config.vars.AUTH_ORIGIN = 'https://jalisco-produce-export.yukikato123123123.workers.dev';
  config.routes = [{ pattern: '*.example.test', custom_domain: true }];
  config.vars.SESSION_ENCRYPTION_KEY = 'synthetic-test-value';
  const errors = validateDeployment(config, 'staging');
  assert.ok(errors.includes('Confirm a distinct, exact HTTPS origin for this target.'));
  assert.ok(errors.includes('Keep authentication keys in Worker secrets.'));
  assert.ok(errors.some(message => message.includes('exact staging custom domain')));
});

test('workers.dev staging rejects routes and a custom-domain origin independently', () => {
  const routed = approvedFixture('staging', 'workers-dev');
  routed.routes = [{ pattern: '*.example.test', custom_domain: true }];
  assert.deepEqual(validateDeployment(routed, 'staging'), [
    'Do not add routes alongside the selected workers.dev origin.',
  ]);

  const wrongOrigin = approvedFixture('staging', 'workers-dev');
  wrongOrigin.vars.AUTH_ORIGIN = 'https://staging.example.test';
  assert.deepEqual(validateDeployment(wrongOrigin, 'staging'), [
    'Confirm the workers.dev origin before enabling it.',
  ]);
});
test('workers.dev staging also rejects production origin and plaintext keys', () => {
  const config = approvedFixture('staging', 'workers-dev');
  config.vars.AUTH_ORIGIN = 'https://jalisco-produce-export.yukikato123123123.workers.dev';
  config.vars.SUPABASE_PUBLISHABLE_KEY = 'synthetic-test-value';
  const errors = validateDeployment(config, 'staging');
  assert.ok(errors.includes('Confirm a distinct, exact HTTPS origin for this target.'));
  assert.ok(errors.includes('Keep authentication keys in Worker secrets.'));
});
test('custom-domain staging rejects a route that does not match its exact origin', () => {
  const config = approvedFixture('staging', 'custom-domain');
  config.routes = [{ pattern: 'other.example.test', custom_domain: true }];
  assert.deepEqual(validateDeployment(config, 'staging'), [
    'Configure one exact staging custom domain or explicitly approve workers.dev.',
  ]);
});

test('staging release rejects production provider and unresolved provider while template checks stay explicit', () => {
  const config = approvedFixture('staging');
  config.vars.SUPABASE_URL = 'https://xchkkdfelwzzpyorjeks.supabase.co';
  assert.ok(validateDeployment(config, 'staging').includes('Staging must use a distinct confirmed Supabase project.'));
  assert.ok(validateDeployment(config, 'staging', { allowUnconfiguredStagingProvider: true }).includes('Staging must use a distinct confirmed Supabase project.'));
  config.vars.SUPABASE_URL = 'https://REPLACE_WITH_STAGING_PROJECT_REF.supabase.co';
  assert.ok(validateDeployment(config, 'staging').length);
  assert.deepEqual(validateDeployment(config, 'staging', { allowUnconfiguredStagingProvider: true }), []);
  config.vars.AUTH_ENVIRONMENT = undefined;
  assert.ok(validateDeployment(config, 'staging', { allowUnconfiguredStagingProvider: true }).length);
});
test('only staging routes its read-only preview through the Worker gate',()=>{
 const c=approvedFixture('staging');c.assets.run_worker_first=['/api/*'];
 assert.ok(validateDeployment(c,'staging').includes('API requests must run the Worker first.'));
 const p=approvedFixture('production');p.assets.run_worker_first=['/api/*','/admin/preview'];
 assert.ok(validateDeployment(p,'production').includes('API requests must run the Worker first.'));
});
