import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, validateDeployment } from '../scripts/validate-deployment.mjs';

function approvedFixture(target) {
  const config = readConfig(`wrangler.${target}.jsonc`);
  config.account_id = 'a'.repeat(32); // Synthetic account; no remote access.
  if (target === 'staging') {
    config.vars.AUTH_ORIGIN = 'https://staging.example.test';
    config.routes = [{ pattern: 'staging.example.test', custom_domain: true }];
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
test('isolated confirmed configuration shapes pass without making remote requests', () => {
  for (const target of ['staging', 'production']) assert.deepEqual(validateDeployment(approvedFixture(target), target), []);
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
