import {applicantsAdmin,recordApplicant,recordSignupApplicant,ResearchAccountFailure} from './researchApplicants.ts';
import {producer,publicItems} from './producer.ts';
import {buyer} from './buyer.ts';
import {publicProducers,publicBuyers} from './directory.ts';
import {submitInquiry,readInquiries} from './inquiries.ts';
import {adminPreview} from './adminPreview.ts';
import {imageFile,cleanupImages,manageImages,uploadImage} from './productImages.ts';
import {retiredPage,retiredImage,knownPage,unavailablePage} from './retiredRoutes.ts';
import {researchPermission,researchSubmit} from './research.ts';
import {publicResearch} from './publicResearch.ts';
import {submitFeedback} from './nopalFeedback.ts';
import {launchSubscription} from './nopalLaunch.ts';
import { ownerPage } from './owner/ui.ts';
import { ownerRoute } from './owner/router.ts';
import type { OwnerNamespace } from './owner/router.ts';
import {usesOwnerGateway,ownerAdmin,ownerAdminHint} from './owner/gateway.ts';
export { OwnerAuthority } from './owner/authority.ts';
import { administrator, hasAdministratorGrant } from './admin.ts';
import { verifiedRecoveryClaims } from './implicitRecovery.ts';
import { Failure, ProviderFailure, provider } from './provider.ts';
import { authenticationRevision, prepareUser, insertSession, currentSession, claimRecovery, finishRecovery } from './authState.ts';
import type { Database } from './authState.ts';
import { assertAuthEnvironment, isolatedStaging } from './environment.ts';
export interface Env { SUPABASE_STORAGE_SERVICE_ROLE_KEY?:string; OWNER_ADMIN_MODE?:string; OWNER_ROOT_PUBLIC_KEY?:string; OWNER_GRANT_ACTIVATION?:string; OWNER_AUTHORITY?: OwnerNamespace; AUTH_ENVIRONMENT?: string; DB: Database; ASSETS: { fetch(request: Request): Promise<Response> }; AUTH_ORIGIN: string; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SESSION_ENCRYPTION_KEY: string }
type Profile = { full_name: string; company: string; country: string; role: 'producer' | 'buyer' };
type User = { id: string; email: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> };
const json = (value: unknown, status = 200, cookie?: string, retryAfter?: number) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...(cookie ? { 'Set-Cookie': cookie } : {}), ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } });
const generic = 'If this address is eligible, a confirmation email will arrive. Open its link to finish signing up. Check your inbox and spam folder.';
const bytes = (text: string) => new TextEncoder().encode(text);
async function hash(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(text))), n => n.toString(16).padStart(2, '0')).join(''); }
async function key(env: Env) { if (!/^[a-f0-9]{64}$/i.test(env.SESSION_ENCRYPTION_KEY)) throw new Failure(503, 'Authentication is not configured.'); return crypto.subtle.importKey('raw', new Uint8Array(env.SESSION_ENCRYPTION_KEY.match(/../g)!.map(v => parseInt(v, 16))), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function sessionHash(id: string, env: Env) { return hash(isolatedStaging(env) ? `${env.SUPABASE_URL}:${id}` : id); }
async function encrypt(value: string, env: Env) { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), bytes(value))); return btoa(String.fromCharCode(...iv, ...data)); }
async function decrypt(value: string, env: Env) { const data = Uint8Array.from(atob(value), c => c.charCodeAt(0)); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, await key(env), data.slice(12))); }
function cookieName(env: Env) { return env.AUTH_ORIGIN.startsWith('https:') ? '__Host-jalisco-session' : 'jalisco-session'; }
function cookie(env: Env, value: string, age: number) { return `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.AUTH_ORIGIN.startsWith('https:') ? '; Secure' : ''}`; }
function sessionId(request: Request, env: Env) { return request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName(env)}=`))?.split('=')[1] ?? ''; }
function email(value: unknown) { if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Failure(400, 'Enter a valid email address.'); return value.trim().toLowerCase(); }
function password(value: unknown) { if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new Failure(400, 'Use a password between 12 and 128 characters.'); return value; }
function profile(value: Record<string, unknown>): Profile { const result: Record<string, string> = {}; for (const name of ['full_name', 'company', 'country']) { if (typeof value[name] !== 'string' || !(value[name] as string).trim() || (value[name] as string).length > 120) throw new Failure(400, 'Check the existing account metadata (up to 120 characters per field).'); result[name] = (value[name] as string).trim(); } if (!['producer', 'buyer'].includes(String(value.role))) throw new Failure(400, 'Invalid existing account category.'); return { ...result, role: value.role } as Profile; }
async function readSession(request: Request, env: Env) {
  const id = sessionId(request, env); if (!/^[a-f0-9]{64}$/.test(id)) throw new Failure(401, 'Please sign in to continue.');
  const session = await currentSession(env.DB, await sessionHash(id, env));
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
  await insertSession(env.DB, { id: await sessionHash(id, env), user_id: user.id, token: await encrypt(payload.access_token, env), expires: Date.now() + age * 1000, purpose, generation, recovery_claimed: 0 }, revision);
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
  if(url.pathname==='/admin/preview'||url.pathname==='/api/staging/admin-preview'||url.pathname.startsWith('/api/staging/admin-preview/'))return adminPreview(request,env);
  if(['/research','/research/'].includes(url.pathname)&&request.method==='GET')return new Response(null,{status:302,headers:{Location:'/research/nopahua'+url.search,'Cache-Control':'no-store'}});
  if(retiredPage(url.pathname)||retiredImage(url.pathname))return unavailablePage(410);
  if(!url.pathname.startsWith('/api/')&&!knownPage(url.pathname)&&!url.pathname.startsWith('/assets/')&&!url.pathname.startsWith('/images/')&&!['/owner','/owner/client.js','/favicon.ico'].includes(url.pathname))return unavailablePage(404);
  if(url.pathname==='/onboarding')return new Response(null,{status:303,headers:{Location:'/account','Cache-Control':'no-store'}});
  if ((url.pathname === '/owner' || url.pathname === '/owner/client.js') && request.method === 'GET') return ownerPage(url.pathname);
  if (url.pathname.startsWith('/api/owner/')) return ownerRoute(request, env.OWNER_AUTHORITY);
  if(['/research/nopahua','/research/nopahua/'].includes(url.pathname)&&request.method==='GET'){
    const response=await env.ASSETS.fetch(request);const next=new Response(response.body,response);
    next.headers.set('Cache-Control','no-store');next.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');return next;
  }
  if(url.pathname.startsWith('/research/nopahua'))return new Response('Results are restricted to administrators.',{status:403,headers:{'Cache-Control':'no-store'}});
  if(url.pathname==='/api/public/nopal-survey')return publicResearch(request,env);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if(url.pathname==='/api/public/feedback')return submitFeedback(request,env);
  if(url.pathname==='/api/public/launch-subscriptions')return launchSubscription(request,env);
  try {
    const imagePath=/^\/api\/product-images\/([^/]+)\/(thumb|full)$/.exec(url.pathname);
    if(request.method==='GET'&&imagePath)return await imageFile(env,imagePath[1],imagePath[2],async owner=>{
      try{const a=await readSession(request,env);if(a.session.purpose==='recovery')return false;if(a.user.id===owner&&a.profile?.role==='producer')return true;return usesOwnerGateway(env)?ownerAdminHint(env,a.user.id):hasAdministratorGrant(env.DB,a.user.id,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''));}catch(e){if(e instanceof Failure&&[401,403].includes(e.status))return false;throw e;}
    });
    const uploadPath=/^\/api\/producer\/items\/([^/]+)\/images\/upload$/.exec(url.pathname);
    if(request.method==='POST'&&uploadPath){
      if(request.headers.get('Origin')!==env.AUTH_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site'||!request.headers.get('Content-Type')?.startsWith('multipart/form-data;'))throw new Failure(403,'Request origin rejected.');
      assertAuthEnvironment(env);const a=await readSession(request,env);if(a.session.purpose==='recovery')throw new Failure(403,'Complete password recovery before continuing.');if(a.profile?.role!=='producer')throw new Failure(403,'A producer account is required.');
      return json(await uploadImage(request,env,a.user.id,uploadPath[1]));
    }
    // Published read-only data does not require a configured auth provider.
    if (request.method === 'GET' && ['/api/public/produce','/api/public/producers','/api/public/buyers'].includes(url.pathname)) {
      if (!env.DB) throw new Failure(503, 'The public directory is temporarily unavailable.');
      if (url.pathname === '/api/public/producers') return json(await publicProducers(env.DB,url.searchParams));
      if (url.pathname === '/api/public/buyers') return json(await publicBuyers(env.DB,url.searchParams));
      return json(await publicItems(env.DB,url.searchParams));
    }
    if (!env.DB || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.AUTH_ORIGIN) throw new Failure(503, 'Authentication is not configured. Public pages remain available.');
    const origin = new URL(env.AUTH_ORIGIN);
    if (origin.origin !== env.AUTH_ORIGIN || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Failure(503, 'Authentication is not configured.');
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(env.SUPABASE_URL)) throw new Failure(503, 'Authentication is not configured.');
    assertAuthEnvironment(env);
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
      const details=body.registration_type==='research'?{full_name:typeof body.full_name==='string'?body.full_name.trim().slice(0,120):'',registration_type:'research'}:profile(body), address=email(body.email), secret=password(body.password);
      const redirect = `signup?redirect_to=${encodeURIComponent(`${env.AUTH_ORIGIN}/verify-email`)}`;
      try { const result=await provider(env, redirect, 'POST', { email: address, password: secret, data: details });if(body.registration_type==='research')await recordSignupApplicant(env,result); }
      catch (error) { if (!(error instanceof ProviderFailure) || error.code !== 'account_existence') throw error; }
      return json({ message: generic });
    }
    if (request.method === 'POST' && ['/api/auth/forgot-password', '/api/auth/resend'].includes(path)) {
      const address = email(body.email);
      const resend = path.endsWith('resend');
      const endpoint = resend ? `resend?redirect_to=${encodeURIComponent(`${env.AUTH_ORIGIN}/verify-email`)}` : isolatedStaging(env) ? `recover?redirect_to=${encodeURIComponent(`${env.AUTH_ORIGIN}/verify-email?purpose=recovery`)}` : 'recover';
      try { await provider(env, endpoint, 'POST', { email: address, ...(resend ? { type: 'signup' } : {}) }); }
      catch (error) { if (!(error instanceof ProviderFailure) || error.code !== 'account_existence') throw error; }
      return json({ message: generic });
    }
    if (request.method === 'POST' && path === '/api/auth/confirm-link') {
      // A verified one-time provider proof, never a client-supplied session purpose.
      const purpose = body.type === 'email' ? 'signup' : body.type;
      if ((purpose !== 'signup' && purpose !== 'recovery') || typeof body.token_hash !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(body.token_hash) || body.access_token !== undefined || body.code !== undefined) throw new Failure(400, 'Invalid authentication link. Request a new email for the intended action.');
      const revision = await authenticationRevision(env.DB);
      const payload = await provider(env, 'verify', 'POST', { token_hash: body.token_hash, type: purpose });
      if (typeof payload.access_token !== 'string') throw new Failure(400, 'Unable to verify this authentication link.');
      const user = await provider(env, 'user', 'GET', undefined, payload.access_token) as unknown as User;
      if (typeof user.email !== 'string' || !user.email_confirmed_at) throw new Failure(403, 'Email verification is required.');
      const nextCookie = await createSession(payload, purpose === 'recovery' ? 'recovery' : 'normal', env, revision, email(user.email));
      const previous = sessionId(request, env);
      if (previous) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sessionHash(previous, env)).run();
      return json({ ok: true }, 200, nextCookie);
    }
    if (request.method === 'POST' && path === '/api/auth/callback') {
      if ((body.type !== 'signup' && body.type !== 'recovery') || typeof body.access_token !== 'string' || body.access_token.length < 20 || body.access_token.length > 8192) {
        throw new Failure(400, 'The confirmation link is invalid or expired. Request a new confirmation email.');
      }
      // Validate the provider token before creating the local HttpOnly session.
      const revision = await authenticationRevision(env.DB);
      const verified = await provider(env, 'user', 'GET', undefined, body.access_token) as unknown as User;
      if (typeof verified.id !== 'string' || typeof verified.email !== 'string' || !verified.email_confirmed_at) {
        throw new Failure(403, 'Verify your email before signing in.');
      }
      const recovering = body.type === 'recovery';
      let expiresIn = 3600;
      if (recovering) {
        const proof = verifiedRecoveryClaims(body.access_token, verified.id, env.SUPABASE_URL);
        expiresIn = proof.expiresIn;
        // Reserve the proof atomically through its signed JWT expiry. This uses
        // a separate hash namespace from rate buckets and existing expiry cleanup.
        const proofId = await hash(`implicit-recovery:${env.SUPABASE_URL}:${body.access_token}`);
        const consumed = await env.DB.prepare('INSERT INTO auth_limits (id, attempts, expires) VALUES (?, 1, ?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(proofId, proof.expiresAt).first();
        if (!consumed) throw new Failure(400, 'This recovery session is invalid, expired or already used. Request a new recovery email.');
      }
      const nextCookie = await createSession(
        { access_token: body.access_token, expires_in: expiresIn },
        recovering ? 'recovery' : 'normal', env, revision, email(verified.email)
      );
      const previous = sessionId(request, env);
      if (previous) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sessionHash(previous, env)).run();
      return json({ ok: true }, 200, nextCookie);
    }
    if (request.method === 'POST' && ['/api/auth/login', '/api/auth/verify'].includes(path)) {
      const address = email(body.email);
      const verifying = path.endsWith('verify');
      if (verifying && (!['signup', 'recovery'].includes(String(body.type)) || typeof body.code !== 'string' || !/^\d{6,10}$/.test(body.code))) throw new Failure(400, 'Enter the email code and its purpose.');
      // Capture BEFORE the provider authenticates credentials or consumes an OTP.
      const revision = await authenticationRevision(env.DB);
      const payload = await provider(env, verifying ? 'verify' : 'token?grant_type=password', 'POST', verifying ? { email: address, token: body.code, type: body.type } : { email: address, password: password(body.password) });
      const nextCookie = await createSession(payload, verifying && body.type === 'recovery' ? 'recovery' : 'normal', env, revision, address);
      const researchUser=payload.user as {id:string;email:string;created_at?:string;email_confirmed_at?:string;user_metadata?:Record<string,unknown>}|undefined;
      if(!verifying||body.type!=='recovery'){if(researchUser?.user_metadata?.registration_type==='research')await recordApplicant(env.DB,researchUser,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''),'signup',researchUser.id);}
      const previous = sessionId(request, env); if (previous) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sessionHash(previous, env)).run();
      return json({ ok: true }, 200, nextCookie);
    }
    // Logout must revoke local proof even when the provider is unavailable.
    if (request.method === 'POST' && path === '/api/auth/logout') {
      const id = sessionId(request, env);
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sessionHash(id, env)).run();
      return json({ ok: true }, 200, cookie(env, '', 0));
    }
    const auth = await readSession(request, env);
    if (request.method === 'GET' && path === '/api/auth/session') {
      const recovery = auth.session.purpose === 'recovery';
      const is_admin = !recovery && (usesOwnerGateway(env) ? await ownerAdminHint(env,auth.user.id) : await hasAdministratorGrant(env.DB, auth.user.id, new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/, '')));
      return json({ user: { email: auth.user.email }, profile: auth.profile, recovery, is_admin, registration: auth.profile ? undefined : auth.user.user_metadata });
    }
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
    if(path==='/api/research/application'){if(request.method!=='POST')throw new Failure(405,'Method not allowed.');await recordApplicant(env.DB,auth.user,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''),'self',auth.user.id);return json({saved:true});}
    if(path==='/api/inquiries'||path.startsWith('/api/inquiries/')){
      if(path==='/api/inquiries'&&request.method==='POST')return json(await submitInquiry(env.DB,auth.user,body),201);
      if(request.method==='GET')return json(await readInquiries(env.DB,url.searchParams,auth.user.id,path==='/api/inquiries'?undefined:path.slice('/api/inquiries/'.length)));
      throw new Failure(405,'Method not allowed.');
    }
    if(path.startsWith('/api/research/')){
      const project=new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,'');
      if(!['/api/research/access','/api/research/responses','/api/research/results'].includes(path))throw new Failure(404,'Endpoint not found.');
      if(path==='/api/research/results')throw new Failure(403,'Results are restricted to administrators.');
      await researchPermission(env.DB,auth.user,project);
      if(path==='/api/research/access'&&request.method==='GET')return json({allowed:true,submitted:!!await env.DB.prepare('SELECT id FROM research_responses WHERE user_id=? AND project_ref=?').bind(auth.user.id,project).first()});
      if(path==='/api/research/responses'&&request.method==='POST')return json(await researchSubmit(env.DB,auth.user,project,body),201);
      throw new Failure(405,'Method not allowed.');
    }
    // Provider-verified subject + server-only owner grant. Metadata is never authority.
    if (path === '/api/admin' || path.startsWith('/api/admin/')) {
      if(usesOwnerGateway(env)){const response=await ownerAdmin(env,{kind:'request',user:auth.user.id,path,method:request.method,body,query:url.searchParams.toString()});if(response.ok&&request.method==='GET'&&/^\/api\/admin\/customer-feedback(?:\/|$)/.test(path))return json({...await response.json() as Record<string,unknown>,can_manage:false});return response;}
      if(path==='/api/admin/research-applicants')return json(await applicantsAdmin(env,auth.user.id,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''),request.method,body,url.searchParams));
      const result=await administrator(env.DB,auth.user.id,path,request.method,body,url.searchParams,new URL(env.SUPABASE_URL).hostname.replace(/\.supabase\.co$/,''));
      if(request.method==='POST'&&/^\/api\/admin\/drafts\/[^/]+$/.test(path)&&body.action==='draft_delete')try{await cleanupImages(env,auth.user.id);}catch{/* Durable image tombstones are retried by the existing cleanup job. */}
      return json(result);
    }
    if (request.method === 'POST' && path === '/api/auth/onboarding') {
      if (auth.profile) throw new Failure(409, 'Your account type is already set. Contact support to request a change.');
      const p = profile(body);
      await env.DB.prepare('INSERT INTO registration_notifications(user_id,full_name,company,country,role,email,created_at) VALUES(?,?,?,?,?,?,?)').bind(auth.user.id,p.full_name,p.company,p.country,p.role,email(auth.user.email),new Date().toISOString()).run();
      return json({ ok: true });
    }
    if (path.startsWith('/api/producer/')) {
      if (auth.profile?.role !== 'producer') throw new Failure(403, 'A producer account is required.');
      const imageAction=/^\/api\/producer\/items\/([^/]+)\/images(?:\/(discard))?$/.exec(path);
      if(imageAction)return json(await manageImages(env,auth.user.id,imageAction[1],request.method,body,!!imageAction[2]));
      const result=await producer(env.DB, auth.user.id, auth.profile, path, request.method, body);if(body.action==='delete')await cleanupImages(env,auth.user.id);return json(result);
    }
    if (path.startsWith('/api/buyer/')) {
      if (auth.profile?.role !== 'buyer') throw new Failure(403, 'A buyer account is required.');
      return json(await buyer(env.DB, auth.user.id, auth.profile, path, request.method, body, url.searchParams));
    }
    throw new Failure(404, 'Endpoint not found.');
  } catch (error) { return json({ error: error instanceof Failure ? error.message : 'Authentication is temporarily unavailable.', ...(error instanceof ResearchAccountFailure ? {verificationStatus:error.verificationStatus,verificationReason:error.verificationReason} : {}), ...(isolatedStaging(env) && error instanceof ProviderFailure && error.code === 'email_rate_limited' ? { code: 'email_rate_limited' } : {}) }, error instanceof Failure ? error.status : 503, undefined, error instanceof Failure ? error.retryAfter : undefined); }
}
export default {fetch:handle,async scheduled(_event:unknown,env:Env){if(env.AUTH_ENVIRONMENT==='staging')await cleanupImages(env);}};
