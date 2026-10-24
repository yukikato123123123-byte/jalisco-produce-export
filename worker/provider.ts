export class Failure extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
export class ProviderFailure extends Failure {
  code: string;
  // Codes are internal classification only, never raw diagnostics or public payloads.
  constructor(status: number, message: string, code: string, retryAfter?: number) { super(status, message, retryAfter); this.code = code; }
}
interface ProviderEnv { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; AUTH_ENVIRONMENT?: string }
function diagnostic(env: ProviderEnv, path: string, status: number, category: string) {
  if (env.AUTH_ENVIRONMENT !== 'staging') return;
  const endpoint = path.split('?')[0];
  console.warn(JSON.stringify({ event: 'auth_provider_failure', endpoint: ['token', 'user', 'verify', 'signup', 'resend', 'recover'].includes(endpoint) ? endpoint : 'other', status, category }));
}
const unavailable = 'Authentication service is temporarily unavailable. Try again later.';
export async function provider(env: ProviderEnv, path: string, method = 'GET', body?: unknown, token?: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, {
      method, headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000), redirect: 'manual',
    });
  } catch { diagnostic(env, path, 0, 'transport_uncertain'); throw new ProviderFailure(503, unavailable, 'transport_uncertain'); }
  if (!response.ok) {
    let code = '';
    let invalidKey = false;
    try { const data = await response.json() as { code?: unknown; error_code?: unknown; error?: unknown; message?: unknown }; invalidKey = data.message === 'Invalid API key'; const value = [data.code, data.error_code, data.error].find(value => typeof value === 'string' && /^[a-z_]{1,80}$/.test(value)); if (typeof value === 'string') code = value; } catch { /* Do not expose provider messages or response bodies. */ }
    diagnostic(env, path, response.status, invalidKey || code === 'invalid_api_key' ? 'invalid_api_key' : ['invalid_credentials', 'invalid_grant', 'email_not_confirmed', 'over_email_send_rate_limit', 'email_provider_disabled', 'signup_disabled', 'otp_expired', 'otp_disabled', 'invalid_grant'].includes(code) ? code : 'other_provider_rejection');
    if (response.status >= 500) throw new ProviderFailure(503, unavailable, 'upstream_uncertain');
    if (response.status === 429) {
      const supplied = Number(response.headers.get('Retry-After'));
      const retry = Number.isFinite(supplied) && supplied > 0 ? Math.min(3600, Math.ceil(supplied)) : 60;
      throw new ProviderFailure(429, 'Too many attempts. Please wait before trying again.', code === 'over_email_send_rate_limit' ? 'email_rate_limited' : 'rate_limited', retry);
    }
    // GoTrue uses 403 otp_expired for invalid/expired/consumed proofs.
    // Classify that specific verify outcome before generic key/config failures.
    const endpoint = path.split('?')[0];
    if (endpoint === 'verify' && [400, 403, 422].includes(response.status) && ['otp_expired', 'otp_disabled'].includes(code)) throw new ProviderFailure(400, 'The verification link or code is invalid, expired or already used. Request a new email for the intended action.', 'authentication_rejected');
    // HTTP auth/config failures are never converted into accepted email requests.
    const badToken = path === 'user' && ['bad_jwt', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned', 'no_authorization'].includes(code);
    if (badToken) throw new ProviderFailure(401, 'Your session is no longer valid. Please sign in again.', 'invalid_session');
    if (response.status === 401 || response.status === 403) throw new ProviderFailure(503, unavailable, 'service_configuration');
    if (response.status !== 400 && response.status !== 422) throw new ProviderFailure(503, unavailable, 'unexpected_status');
    const signup = endpoint === 'signup', emailAction = endpoint === 'recover' || endpoint === 'resend';
    // OAuth token errors can use `error: invalid_grant` instead of GoTrue's `code`.
    if (endpoint === 'token' && ['invalid_credentials', 'invalid_grant'].includes(code)) throw new ProviderFailure(400, 'Email or password is incorrect. Check your sign-in details. This is a password sign-in failure, not an email-link verification result.', 'authentication_rejected');
    if (endpoint === 'verify' && ['otp_expired', 'otp_disabled', 'invalid_credentials'].includes(code)) throw new ProviderFailure(400, 'The verification link or code is invalid, expired or already used. Request a new email for the intended action.', 'authentication_rejected');
    if (code === 'email_not_confirmed' && endpoint === 'token') throw new ProviderFailure(400, 'Confirm your email before signing in. Open your signup confirmation email.', 'authentication_rejected');
    if (signup && ['user_already_exists', 'email_exists'].includes(code) || emailAction && ['user_not_found', 'user_banned'].includes(code)) throw new ProviderFailure(400, 'Unable to complete authentication.', 'account_existence');
    if (code === 'weak_password' || code === 'same_password') throw new ProviderFailure(400, 'Choose a different, stronger password that meets the account password policy.', 'password_validation');
    if (['email_address_invalid', 'validation_failed'].includes(code)) throw new ProviderFailure(400, 'Check the submitted details and try again.', 'input_validation');
    if (['invalid_credentials', 'email_not_confirmed', 'user_banned', 'otp_expired', 'otp_disabled'].includes(code) && !emailAction && !signup) throw new ProviderFailure(400, 'Unable to complete authentication. Check your details or request a new code.', 'authentication_rejected');
    throw new ProviderFailure(503, unavailable, 'unclassified_provider_error');
  }
  if (response.status === 204) return {};
  try { const result: unknown = await response.json(); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result as Record<string, unknown>; }
  catch { throw new ProviderFailure(503, unavailable, 'malformed_provider_response'); }
}
