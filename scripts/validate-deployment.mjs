import { readFileSync } from 'node:fs';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const stagingDatabase = '7712d6bb-2414-44d3-9282-cb5b941d740e';
const productionOrigin = 'https://jalisco-produce-export.yukikato123123123.workers.dev';
export function readConfig(path) {
  // These repository configs use JSON plus whole-line comments, not arbitrary JSONC.
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''));
}
export function validateDeployment(config, target) {
  const errors = [];
  if (!['staging', 'production'].includes(target)) return ['Choose staging or production.'];
  const fail = (condition, message) => { if (!condition) errors.push(message); };
  fail(!/REPLACE_|localhost|127\.0\.0\.1/.test(JSON.stringify(config)), 'Resolve all placeholders and remove local-only values.');
  fail(/^[a-f0-9]{32}$/i.test(config.account_id ?? ''), 'Confirm the target Cloudflare account ID.');
  fail(config.name === (target === 'staging' ? 'jalisco-auth-staging' : 'jalisco-produce-export'), 'Unexpected target Worker name.');
  fail(config.main === 'worker/index.ts', 'The authentication Worker entry point is required.');
  fail(config.assets?.directory === './dist' && config.assets?.binding === 'ASSETS' && config.assets?.not_found_handling === 'single-page-application', 'Preserve the existing SPA assets and ASSETS binding.');
  fail(JSON.stringify(config.assets?.run_worker_first) === '["/api/*"]', 'API requests must run the Worker first.');
  fail(!config.previews && !config.env && !config.route, 'Use explicit persistent configs without Preview or inherited environment overrides.');
  fail(config.preview_urls === false, 'Disable alternate version preview URLs.');
  const db = config.d1_databases?.[0];
  fail(config.d1_databases?.length === 1 && db?.binding === 'DB' && db?.migrations_dir === 'migrations', 'Use one explicit DB binding and the reviewed migrations directory.');
  fail(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db?.database_id ?? '') && db?.database_id !== '00000000-0000-0000-0000-000000000000', 'Confirm a real target D1 UUID.');
  fail(Boolean(db?.database_name) && !/REPLACE_/.test(db?.database_name ?? ''), 'Confirm the target D1 name.');
  fail(target === 'staging' ? db?.database_id === stagingDatabase && db?.database_name === 'jalisco-auth-staging' : db?.database_id !== stagingDatabase && !/staging|local/i.test(db?.database_name ?? ''), 'Production and staging databases must be isolated.');
  const origin = config.vars?.AUTH_ORIGIN;
  let validOrigin = false;
  try { const url = new URL(origin); validOrigin = url.protocol === 'https:' && url.origin === origin; } catch { /* No values in diagnostics. */ }
  fail(validOrigin && (target === 'production' ? origin === productionOrigin : origin !== productionOrigin), 'Confirm a distinct, exact HTTPS origin for this target.');
  fail(config.vars?.SUPABASE_URL === 'https://xchkkdfelwzzpyorjeks.supabase.co', 'Use the owner-specified existing Supabase project.');
  fail(!config.vars?.SESSION_ENCRYPTION_KEY && !config.vars?.SUPABASE_PUBLISHABLE_KEY, 'Keep authentication keys in Worker secrets.');
  const routes = config.routes ?? [];
  if (config.workers_dev === true) {
    fail(routes.length === 0, 'Do not add routes alongside the selected workers.dev origin.');
    fail(validOrigin && new URL(origin).hostname.endsWith('.workers.dev'), 'Confirm the workers.dev origin before enabling it.');
  } else {
    fail(validOrigin && config.workers_dev === false && routes.length === 1 && routes[0]?.custom_domain === true && routes[0]?.pattern === new URL(origin).hostname, 'Configure one exact staging custom domain or explicitly approve workers.dev.');
  }
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!['staging', 'production'].includes(target)) { console.error('Choose staging or production.'); process.exitCode = 1; }
  else {
    const errors = validateDeployment(readConfig(`wrangler.${target}.jsonc`), target);
    if (errors.length) { console.error(errors.map(message => `- ${message}`).join('\n')); process.exitCode = 1; }
    else console.log('Non-secret configuration checks passed. This does not authorize deployment or verify remote resources, secrets, migrations, provider settings, or live email.');
  }
}
