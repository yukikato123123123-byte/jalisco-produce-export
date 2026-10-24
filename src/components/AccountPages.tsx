import {Localized} from '../localization';
import { readAuthLink } from '../authLinks';
import { accountDestination } from '../accountDestination';
import { BuyerCenter } from './BuyerCenter';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { ProducerDashboard } from './ProducerDashboard';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './account.css';
type Profile = { full_name: string; company: string; country: string; role: 'producer' | 'buyer' };
type Session = { user: { email: string }; profile: Profile | null; recovery: boolean; is_admin?: boolean; registration?: Partial<Profile> };
class AccountRequestError extends Error {
  retryAfter: number; recoveryConsumed: boolean;
  constructor(message: string, retryAfter = 0, recoveryConsumed = false) { super(message); this.retryAfter = retryAfter; this.recoveryConsumed = recoveryConsumed; }
}
export async function accountRequest(path: string, values?: Record<string, unknown>) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...(values ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) } : {}), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) {
    const seconds = Number(response.headers.get('Retry-After'));
    const retry = response.status === 429 || response.headers.has('Retry-After') ? Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, Math.ceil(seconds)) : 60 : 0;
    const message = result.code === 'email_rate_limited' ? 'Email sending is temporarily limited. Wait before requesting another email; the timer does not guarantee the email limit has reset.' : typeof result.error === 'string' ? result.error : 'Unable to complete your request.';
    throw new AccountRequestError(message, retry, result.recoveryConsumed === true);
  }
  return result;
}
const routes = ['/login', '/signup', '/forgot-password', '/verify-email', '/reset-password', '/onboarding', '/producer/dashboard', '/buyer/dashboard', '/account', '/workspace', '/buyer'];
export function isAccountPage() { return routes.includes(window.location.pathname); }
function ProfileFields({ initial = {} }: { initial?: Partial<Profile> }) {
  return <Localized><><fieldset className="account-role"><legend>Account type</legend>{(['producer', 'buyer'] as const).map(role => <label key={role}><input type="radio" name="role" value={role} defaultChecked={initial.role === role} required/><span>{role === 'producer' ? 'Producer' : 'Buyer'}<small>{role === 'producer' ? 'Represent your farm or company' : 'Explore sourcing opportunities'}</small></span></label>)}</fieldset><label>Full name<input name="full_name" autoComplete="name" maxLength={120} defaultValue={initial.full_name} required/></label><label>Company or farm name<input name="company" autoComplete="organization" maxLength={120} defaultValue={initial.company} required/></label><label>Country<input name="country" autoComplete="country-name" maxLength={120} defaultValue={initial.country} required/></label></></Localized>;
}
export function AccountPages() {
  const path = ({'/workspace':'/producer/dashboard','/buyer':'/buyer/dashboard'} as Record<string,string>)[window.location.pathname] || window.location.pathname;
  const protectedPage = ['/account', '/onboarding', '/reset-password', '/producer/dashboard', '/buyer/dashboard'].includes(path);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(protectedPage);
  const [arrival] = useState(() => path === '/verify-email' ? readAuthLink(window.location.search, window.location.hash) : null);
  const [busy, setBusy] = useState(!!(arrival && !arrival.error && (arrival.hash || arrival.accessToken)));
  const requestInFlight = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const callbackStarted = useRef(false);
  const [error, setError] = useState(arrival?.error || '');
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState<{ profile: Profile; message: string } | null>(null);
  const [registered, setRegistered] = useState(false);
  const [recovery, setRecovery] = useState(path === '/reset-password' || arrival?.purpose === 'recovery');
  useEffect(() => {
    if (!arrival || callbackStarted.current) return;
    callbackStarted.current = true;
    // Scrub query hashes, authorization codes, tokens and fragments before any API call.
    if (arrival.hasParameters) window.history.replaceState(null, '', `/verify-email${arrival.purpose === 'recovery' ? '?purpose=recovery' : ''}`);
    if (arrival.error || (!arrival.hash && !arrival.accessToken)) return;
    requestInFlight.current = true;
    const path = arrival.hash ? '/api/auth/confirm-link' : '/api/auth/callback';
    const body = arrival.hash ? { token_hash: arrival.hash, type: arrival.purpose } : { access_token: arrival.accessToken, type: arrival.purpose };
    accountRequest(path, body)
      .then(() => window.location.replace(arrival.purpose === 'recovery' ? '/reset-password' : '/onboarding'))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to verify this link. Request a new email for the intended action.'))
      .finally(() => { requestInFlight.current = false; setBusy(false); });
  }, [arrival]);

  useEffect(() => {
    if (!protectedPage) return;
    let disposed = false;
    accountRequest('/api/auth/session').then(async (value: Session) => {
      if (disposed) return;
      if (value.recovery && path !== '/reset-password') { window.location.replace('/reset-password'); return; }
      if (path === '/reset-password' && !value.recovery) throw new Error('Verify a password recovery code first.');
      if (value.is_admin && ['/account','/onboarding'].includes(path)) { window.location.replace(accountDestination(value)); return; }
      if (!value.profile && path.includes('/dashboard')) { window.location.replace('/onboarding'); return; }
      if (value.profile && path === '/onboarding') { window.location.replace(`/${value.profile.role}/dashboard`); return; }
      if (path === '/account') { window.location.replace(value.profile ? `/${value.profile.role}/dashboard` : '/onboarding'); return; }
      setSession(value);
      if (value.profile && path.includes('/dashboard') && !path.startsWith(`/${value.profile.role}/`)) throw new Error('This page requires the appropriate account type.');
      if (path.includes('/dashboard')) { const result = await accountRequest(`/api${path}`); if (!disposed) setDashboard(result); }
    }).catch(() => { if (!disposed) setError('Access unavailable. Sign in with the appropriate account, or verify a recovery code.'); }).finally(() => { if (!disposed) setChecking(false); });
    return () => { disposed = true; };
  }, [path, protectedPage]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || cooldown > 0) return;
    requestInFlight.current = true; setBusy(true); setError(''); setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (path === '/signup') { const result = await accountRequest('/api/auth/signup', values); setMessage(result.message); setRegistered(true); }
      else if (path === '/forgot-password') { const result = await accountRequest('/api/auth/forgot-password', values); setMessage(result.message); }
      else if (path === '/verify-email') { await accountRequest('/api/auth/verify', { ...values, type: recovery ? 'recovery' : 'signup' }); window.location.assign(recovery ? '/reset-password' : '/onboarding'); }
      else if (path === '/reset-password') { await accountRequest('/api/auth/reset-password', values); setMessage('Your password has been updated. Sign in again with your new password.'); setSession(null); }
      else if (path === '/onboarding') { await accountRequest('/api/auth/onboarding', values); const current: Session = await accountRequest('/api/auth/session'); window.location.assign(accountDestination(current)); }
      else { await accountRequest('/api/auth/login', values); const current: Session = await accountRequest('/api/auth/session'); window.location.assign(accountDestination(current)); }
    } catch (cause) { setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'The request timed out. Please try again.'); if (cause instanceof AccountRequestError) { setCooldown(cause.retryAfter); if (cause.recoveryConsumed) setSession(null); } }
    finally { requestInFlight.current = false; setBusy(false); }
  }
  async function logout() { if (requestInFlight.current) return; requestInFlight.current = true; setBusy(true); setError(''); try { await accountRequest('/api/auth/logout', {}); window.location.assign('/login'); } catch { setError('Unable to sign out. Please try again.'); } finally { requestInFlight.current = false; setBusy(false); } }
  async function resend(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (requestInFlight.current || cooldown > 0) return; requestInFlight.current = true; setBusy(true); setError(''); setMessage(''); try { const result = await accountRequest('/api/auth/resend', Object.fromEntries(new FormData(event.currentTarget).entries())); setMessage(result.message); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request a code.'); if (cause instanceof AccountRequestError) setCooldown(cause.retryAfter); } finally { requestInFlight.current = false; setBusy(false); } }
  const titles: Record<string, string> = { '/login': 'Welcome back.', '/signup': 'Grow your connections.', '/forgot-password': 'A fresh start.', '/verify-email': 'Check your inbox.', '/reset-password': 'Choose a new password.', '/onboarding': 'Your place in the network.' };
  const showForm = !checking && (!protectedPage || session) && !dashboard && !path.includes('/dashboard') && path !== '/account' && !registered && !(path === '/reset-password' && message);
  return <Localized><div className="account-page"><SiteHeader/><main className={`account-layout ${dashboard ? 'account-wide' : ''}`}><aside className="account-intro"><p className="eyebrow">ORIGIN · CONNECTION · POSSIBILITY</p><h1>{dashboard ? (dashboard.profile.role === 'producer' ? 'My Workspace' : 'Buyer Center') : 'Rooted in Jalisco.\nConnected by trust.'}</h1><p>Explore public produce, manage your buyer profile, or maintain your farm and produce in your role’s workspace. The public map remains open.</p><a href="/">Return to the public map </a><div className="account-art farm-account-art" role="img" aria-label="Nopal fields from the farm photographs supplied by Edgar"/></aside><section className="account-card" aria-labelledby="account-title"><p className="eyebrow">JALISCO PRODUCE EXPORT</p><h2 id="account-title">{path === '/verify-email' && recovery ? 'Recover your password.' : dashboard ? `Welcome, ${dashboard.profile.full_name}.` : titles[path] || 'Account'}</h2>{checking && <p role="status">Checking your session…</p>}{error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-success" role="status">{message}</p>}
    {session?.profile && !dashboard && error && <p><a href={`/${session.profile.role}/dashboard`}>Open your {session.profile.role === 'producer' ? 'My Workspace' : 'Buyer Center'}</a></p>}
    {dashboard?.profile.role === 'producer' && <ProducerDashboard/>}
    {dashboard?.profile.role === 'buyer' && <BuyerCenter/>}
    {dashboard && <><p>Email confirmation establishes email access only. It does not verify a farm, supplier, or commercial eligibility.</p><button className="button-secondary" disabled={busy} onClick={logout}>Sign out</button></>}
    {showForm && <form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy || cooldown > 0} className="account-fields">
      {(path === '/signup' || path === '/onboarding') && <ProfileFields initial={session?.registration}/>}
      {['/signup', '/login', '/forgot-password', '/verify-email'].includes(path) && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
      {['/signup', '/login', '/reset-password'].includes(path) && <div><label htmlFor="account-password">{path === '/reset-password' ? 'New password' : 'Password'}</label><input id="account-password" name="password" type="password" minLength={12} maxLength={128} aria-describedby="password-help" autoComplete={path === '/login' ? 'current-password' : 'new-password'} required/><small id="password-help">12–128 characters. Use a unique password.</small></div>}
      {path === '/verify-email' && <><label>Code purpose<select value={recovery ? 'recovery' : 'signup'} onChange={e => setRecovery(e.target.value === 'recovery')}><option value="signup">Confirm my email</option><option value="recovery">Recover my password</option></select></label><label>Email confirmation code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required/></label><p>Use the confirmation link for signup or the recovery link for password reset. You can also enter the matching numeric code from the email. Invalid, expired or already used links and codes require a new request.</p></>}
      {path === '/signup' && <p>Choose your account type carefully. It is fixed after onboarding; no farm or supplier verification is implied.</p>}
      {path === '/onboarding' && <p>Confirm your details to complete onboarding. Your account type cannot be changed here afterwards.</p>}
      <button type="submit">{cooldown ? `Try again in ${cooldown}s` : busy ? 'Please wait…' : path === '/signup' ? 'Create account' : path === '/forgot-password' ? 'Send recovery code' : path === '/verify-email' ? 'Verify code' : path === '/reset-password' ? 'Update password' : path === '/onboarding' ? 'Complete onboarding' : 'Sign in'}</button>
    </fieldset></form>}
    {path === '/verify-email' && <details><summary>Need a new confirmation code?</summary><form onSubmit={resend}><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><button disabled={busy || cooldown > 0}>{cooldown ? `Try again in ${cooldown}s` : 'Resend confirmation code'}</button><p>For password recovery, request a new code from Forgot password.</p></form></details>}
    <nav className="account-links" aria-label="Account navigation"><a href="/login">Sign in</a><a href="/signup">Create account</a><a href="/forgot-password">Forgot password?</a><a href="/verify-email">Enter email code</a></nav>{session && !dashboard && <button className="button-secondary" disabled={busy} onClick={logout}>Sign out</button>}
  </section></main><SiteFooter/></div></Localized>;
}
