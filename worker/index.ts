import { Failure, ProviderFailure, provider } from './provider.ts';
import { authenticationRevision, prepareUser, insertSession, currentSession, claimRecovery, finishRecovery } from './authState.ts';
import type { Database } from './authState.ts';
export interface Env { DB: Database; ASSETS: { fetch(request: Request): Promise<Response> }; AUTH_ORIGIN: string; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SESSION_ENCRYPTION_KEY: string }
type Profile = { full_name: string; company: string; country: string; role: 'producer' | 'buyer' };
type User = { id: string; email: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> };
const json = (value: unknown, status = 200, cookie?: string, retryAfter?: number) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...(cookie ? { 'Set-Cookie': cookie } : {}), ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } });
const generic = 'If this address is eligible, an email with a confirmation code will arrive. Check your inbox and spam folder.';
const bytes = (text: string) => new TextEncoder().encode(text);
async function hash(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(text))), n => n.toString(16).padStart(2, '0')).join(''); }
async function key(env: Env) { if (!/^[a-f0-9]{64}$/i.test(env.SESSION_ENCRYPTION_KEY)) throw new Failure(503, 'Authentication is not configured.'); return crypto.subtle.importKey('raw', new Uint8Array(env.SESSION_ENCRYPTION_KEY.match(/../g)!.map(v => parseInt(v, 16))), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function encrypt(value: string, env: Env) { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), bytes(value))); return btoa(String.fromCharCode(...iv, ...data)); }
async function decrypt(value: string, env: Env) { const data = Uint8Array.from(atob(value), c => c.charCodeAt(0)); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, await key(env), data.slice(12))); }
function cookieName(env: Env) { return env.AUTH_ORIGIN.startsWith('https:') ? '__Host-jalisco-session' : 'jalisco-session'; }
function cookie(env: Env, value: string, age: number) { return `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.AUTH_ORIGIN.startsWith('https:') ? '; Secure' : ''}`; }
function sessionId(request: Request, env: Env) { return request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName(env)}=`))?.split('=')[1] ?? ''; }
function email(value: unknown) { if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Failure(400, 'Enter a valid email address.'); return value.trim().toLowerCase(); }
function password(value: unknown) { if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new Failure(400, 'Use a password between 12 and 128 characters.'); return value; }
function profile(value: Record<string, unknown>): Profile { const result: Record<string, string> = {}; for (const name of ['full_name', 'company', 'country']) { if (typeof value[name] !== 'string' || !(value[name] as string).trim() || (value[name] as string).length > 120) throw new Failure(400, 'Enter your name, company or farm, and country (up to 120 characters each).'); result[name] = (value[name] as string).trim(); } if (!['producer', 'buyer'].includes(String(value.role))) throw new Failure(400, 'Choose Producer or Buyer.'); return { ...result, role: value.role } as Profile; }
async function readSession(request: Request, env: Env) {
  const id = sessionId(request, env); if (!/^[a-f0-9]{64}$/.test(id)) throw new Failure(401, 'Please sign in to continue.');
  const session = await currentSession(env.DB, await hash(id));
  if (!session) throw new Failure(401, 'Your session has expired or was revoked. Please sign in again.');
  await limitSessionReads(env, session.id);
  const token = await decrypt(session.token, env);
  let user: User;
  try { user = await provider(env, 'user', 'GET', undefined, token) as unknown as User; }
  catch (error) { if (error instanceof Failure && error.status === 401) throw new Failure(401, 'Your session is no longer valid. Please sign in again.'); throw error; }
  if (typeof user.id !== 'string' || !user.email_confirmed_at || user.id !== session.user_id) throw new Failure(401, 'Verify your email before continuing.');
  if (!await currentSession(env.DB, session.id)) throw new Failure(401, 'Your session was revoked. Please sign in again.');
  const saved = await env.DB.prepare('SELECT full_name, company, country, role FROM profiles WHERE user_id = ?').bind(user.id).first<Profile>();
  return { session, user, token, profile: saved };
}
async function createSession(payload: Record<string, unknown>, purpose: string, env: Env, revision: number, address: string) {
  if (typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number' || !Number.isFinite(payload.expires_in) || payload.expires_in < 1) throw new Failure(400, 'Unable to establish a session.');
  const user = await provider(env, 'user', 'GET', undefined, payload.access_token) as unknown as User;
  if (typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || email(user.email) !== address || !user.email_confirmed_at) throw new Failure(403, 'Verify your email before signing in.');
  const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  const age = Math.min(purpose === 'recovery' ? 600 : 3600, Math.floor(payload.expires_in));
  const generation = await prepareUser(env.DB, user.id);
  await insertSession(env.DB, { id: await hash(id), user_id: user.id, token: await encrypt(payload.access_token, env), expires: Date.now() + age * 1000, purpose, generation, recovery_claimed: 0 }, revision);
  return cookie(env, id, age);
}
function resetUncertain(env: Env) {
  return json({ recoveryConsumed: true, error: 'Password recovery could not be confirmed. This recovery session cannot be reused. Request a new recovery code and wait at least two minutes before retrying. If it persists, contact support.' }, 503, cookie(env, '', 0), 120);
}
async function limitSessionReads(env: Env, sessionId: string) {
  // Limits outbound /user checks without weakening revocation through a user cache.
  const bucket = Math.floor(Date.now() / 60000);
  const id = await hash(`session-read:${sessionId}:${bucket}`);
  const row = await env.DB.prepare('INSERT INTO auth_limits (id, attempts, expires) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(id, Date.now() + 120000).first<{ attempts: number }>();
  if (!row || row.attempts > 60) throw new Failure(429, 'Too many session checks. Please wait before trying again.', 60);
}
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try {
    if (!env.DB || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.AUTH_ORIGIN) throw new Failure(503, 'Authentication is not configured. Public pages remain available.');
    const origin = new URL(env.AUTH_ORIGIN);
    if (origin.origin !== env.AUTH_ORIGIN || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Failure(503, 'Authentication is not configured.');
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(env.SUPABASE_URL)) throw new Failure(503, 'Authentication is not configured.');
    await key(env);
    if (request.method !== 'GET' && request.method !== 'POST') throw new Failure(405, 'Method not allowed.');
    if (request.method === 'POST' && (request.headers.get('Origin') !== env.AUTH_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site' || !request.headers.get('Content-Type')?.startsWith('application/json'))) throw new Failure(403, 'Request origin rejected.');
    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) { await reader.cancel(); throw new Failure(413, 'Request is too large.'); } chunks.push(part.value); } }
      const buffer = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      const text = new TextDecoder().decode(buffer);
      try { body = JSON.parse(text); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); } catch { throw new Failure(400, 'Invalid request.'); }
      // Durable, atomic per-IP bucket; CF-Connecting-IP is trusted only on Cloudflare.
      const bucket = Math.floor(Date.now() / 600000);
      const rateKey = await hash(`${env.SESSION_ENCRYPTION_KEY}:${request.headers.get('CF-Connecting-IP') ?? 'local'}:${bucket}`);
      const rate = await env.DB.prepare('INSERT INTO auth_limits (id, attempts, expires) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(rateKey, Date.now() + 1200000).first<{ attempts: number }>();
      if ((!rate || rate.attempts > 30) && url.pathname !== '/api/auth/logout') throw new Failure(429, 'Too many attempts. Please try again later.', 600 - Math.floor(Date.now() / 1000) % 600);
      await env.DB.prepare('DELETE FROM auth_limits WHERE expires < ?').bind(Date.now()).run();
      await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run();
    }
    const path = url.pathname;
    if (request.method === 'POST' && path === '/api/auth/signup') {
      const details = profile(body), address = email(body.email), secret = password(body.password);
      try { await provider(env, 'signup', 'POST', { email: address, password: secret, data: details }); }
      catch (error) { if (!(error instanceof ProviderFailure) || error.code !== 'account_existence') throw error; }
      return json({ message: generic });
    }
    if (request.method === 'POST' && ['/api/auth/forgot-password', '/api/auth/resend'].includes(path)) {
      const address = email(body.email);
      try { await provider(env, path.endsWith('resend') ? 'resend' : 'recover', 'POST', { email: address, ...(path.endsWith('resend') ? { type: 'signup' } : {}) }); }
      catch (error) { if (!(error instanceof ProviderFailure) || error.code !== 'account_existence') throw error; }
      return json({ message: generic });
    }
    if (request.method === 'POST' && ['/api/auth/login', '/api/auth/verify'].includes(path)) {
      const address = email(body.email);
      const verifying = path.endsWith('verify');
      if (verifying && (!['signup', 'recovery'].includes(String(body.type)) || typeof body.code !== 'string' || !/^\d{6,10}$/.test(body.code))) throw new Failure(400, 'Enter the email code and its purpose.');
      // Capture BEFORE the provider authenticates credentials or consumes an OTP.
      const revision = await authenticationRevision(env.DB);
      const payload = await provider(env, verifying ? 'verify' : 'token?grant_type=password', 'POST', verifying ? { email: address, token: body.code, type: body.type } : { email: address, password: password(body.password) });
      const nextCookie = await createSession(payload, verifying && body.type === 'recovery' ? 'recovery' : 'normal', env, revision, address);
      const previous = sessionId(request, env); if (previous) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await hash(previous)).run();
      return json({ ok: true }, 200, nextCookie);
    }
    // Logout must revoke local proof even when the provider is unavailable.
    if (request.method === 'POST' && path === '/api/auth/logout') {
      const id = sessionId(request, env);
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await hash(id)).run();
      return json({ ok: true }, 200, cookie(env, '', 0));
    }
    const auth = await readSession(request, env);
    if (request.method === 'GET' && path === '/api/auth/session') return json({ user: { email: auth.user.email }, profile: auth.profile, recovery: auth.session.purpose === 'recovery', registration: auth.profile ? undefined : auth.user.user_metadata });
    if (request.method === 'POST' && path === '/api/auth/reset-password') {
      if (auth.session.purpose !== 'recovery') throw new Failure(403, 'Verify a password recovery code first.');
      const secret = password(body.password);
      await claimRecovery(env.DB, auth.session);
      try {
        await provider(env, 'user', 'PUT', { password: secret }, auth.token);
      } catch (cause) {
        // Definitive HTTP rejection: consume the proof and end the fence. No automatic retry.
        // Transport/5xx/malformed results may have changed the password: keep login blocked.
        if (cause instanceof ProviderFailure && !['transport_uncertain', 'upstream_uncertain', 'malformed_provider_response'].includes(cause.code)) {
          try { await finishRecovery(env.DB, auth.session); }
          catch { return resetUncertain(env); }
          return json({ recoveryConsumed: true, error: `${cause.message} This recovery session was consumed; request a new code.` }, cause.status, cookie(env, '', 0), cause.retryAfter);
        }
        return resetUncertain(env);
      }
      try { await finishRecovery(env.DB, auth.session); }
      catch { return resetUncertain(env); }
      return json({ ok: true }, 200, cookie(env, '', 0));
    }
    if (auth.session.purpose === 'recovery') throw new Failure(403, 'Complete password recovery before continuing.');
    if (request.method === 'POST' && path === '/api/auth/onboarding') {
      if (auth.profile) throw new Failure(409, 'Your account type is already set. Contact support to request a change.');
      const p = profile(body);
      await env.DB.prepare('INSERT INTO profiles (user_id, full_name, company, country, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING').bind(auth.user.id, p.full_name, p.company, p.country, p.role).run();
      return json({ ok: true });
    }
    if (request.method === 'GET' && ['/api/producer/dashboard', '/api/buyer/dashboard'].includes(path)) {
      if (!auth.profile) throw new Failure(403, 'Complete onboarding first.');
      if (auth.profile.role !== path.split('/')[2]) throw new Failure(403, 'This workspace is not available for your account type.');
      return json({ profile: auth.profile, message: 'Account workspace only. Inventory, sourcing, orders and logistics integrations are not implemented.' });
    }
    throw new Failure(404, 'Endpoint not found.');
  } catch (error) { return json({ error: error instanceof Failure ? error.message : 'Authentication is temporarily unavailable.' }, error instanceof Failure ? error.status : 503, undefined, error instanceof Failure ? error.retryAfter : undefined); }
}
export default { fetch: handle };
