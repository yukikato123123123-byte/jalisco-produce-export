import { Failure } from './provider.ts';

export const productionSupabaseURL = 'https://xchkkdfelwzzpyorjeks.supabase.co';
const productionOrigin = 'https://jalisco-produce-export.yukikato123123123.workers.dev';
export const stagingOrigin = 'https://jalisco-auth-staging.yukikato123123123.workers.dev';
export interface AuthEnvironment { AUTH_ORIGIN: string; SUPABASE_URL: string; AUTH_ENVIRONMENT?: string }
export function isolatedStaging(env: AuthEnvironment) {
  return env.AUTH_ENVIRONMENT === 'staging' || env.AUTH_ORIGIN === stagingOrigin;
}
export function assertAuthEnvironment(env: AuthEnvironment) {
  if (!isolatedStaging(env)) return; // Preserve the existing local/production contract.
  let validOrigin = false;
  try { const url = new URL(env.AUTH_ORIGIN); validOrigin = url.protocol === 'https:' && url.origin === env.AUTH_ORIGIN; } catch { /* Never include configuration values in errors. */ }
  if (env.AUTH_ENVIRONMENT !== 'staging' || !validOrigin || env.AUTH_ORIGIN === productionOrigin ||
      !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.SUPABASE_URL) ||
      env.SUPABASE_URL === productionSupabaseURL) {
    throw new Failure(503, 'Staging authentication requires its isolated Supabase project.');
  }
}
