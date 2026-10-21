import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './account.css';
type Profile = { full_name: string; company: string; country: string; role: 'producer' | 'buyer' };
type Session = { user: { email: string }; profile: Profile | null; recovery: boolean; registration?: Partial<Profile> };
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
    throw new AccountRequestError(typeof result.error === 'string' ? result.error : 'Unable to complete your request.', retry, result.recoveryConsumed === true);
  }
  return result;
}
const routes = ['/login', '/signup', '/forgot-password', '/verify-email', '/reset-password', '/onboarding', '/producer/dashboard', '/buyer/dashboard'];
export function isAccountPage() { return routes.includes(window.location.pathname); }
function ProfileFields({ initial = {} }: { initial?: Partial<Profile> }) {
  return <><fieldset className="account-role"><legend>Account type</legend>{(['producer', 'buyer'] as const).map(role => <label key={role}><input type="radio" name="role" value={role} defaultChecked={initial.role === role} required/><span>{role === 'producer' ? 'Producer' : 'Buyer'}<small>{role === 'producer' ? 'Represent your farm or company' : 'Explore sourcing opportunities'}</small></span></label>)}</fieldset><label>Full name<input name="full_name" autoComplete="name" maxLength={120} defaultValue={initial.full_name} required/></label><label>Company or farm name<input name="company" autoComplete="organization" maxLength={120} defaultValue={initial.company} required/></label><label>Country<input name="country" autoComplete="country-name" maxLength={120} defaultValue={initial.country} required/></label></>;
}
export function AccountPages() {
  const path = window.location.pathname;
  const protectedPage = ['/onboarding', '/reset-password', '/producer/dashboard', '/buyer/dashboard'].includes(path);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(protectedPage);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState<{ profile: Profile; message: string } | null>(null);
  const [registered, setRegistered] = useState(false);
  const [recovery, setRecovery] = useState(path === '/reset-password');
  useEffect(() => {
    if (!protectedPage) return;
    let disposed = false;
    accountRequest('/api/auth/session').then(async (value: Session) => {
      if (disposed) return;
      if (value.recovery && path !== '/reset-password') { window.location.replace('/reset-password'); return; }
      if (path === '/reset-password' && !value.recovery) throw new Error('Verify a password recovery code first.');
      if (!value.profile && path.includes('/dashboard')) { window.location.replace('/onboarding'); return; }
      if (value.profile && path === '/onboarding') { window.location.replace(`/${value.profile.role}/dashboard`); return; }
      setSession(value);
      if (path.includes('/dashboard')) { const result = await accountRequest(`/api${path}`); if (!disposed) setDashboard(result); }
    }).catch(() => { if (!disposed) setError('Access unavailable. Sign in with the appropriate account, or verify a recovery code.'); }).finally(() => { if (!disposed) setChecking(false); });
    return () => { disposed = true; };
  }, [path, protectedPage]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (path === '/signup') { const result = await accountRequest('/api/auth/signup', values); setMessage(result.message); setRegistered(true); }
      else if (path === '/forgot-password') { const result = await accountRequest('/api/auth/forgot-password', values); setMessage(result.message); }
      else if (path === '/verify-email') { await accountRequest('/api/auth/verify', { ...values, type: recovery ? 'recovery' : 'signup' }); window.location.assign(recovery ? '/reset-password' : '/onboarding'); }
      else if (path === '/reset-password') { await accountRequest('/api/auth/reset-password', values); setMessage('Your password has been updated. Sign in again with your new password.'); setSession(null); }
      else if (path === '/onboarding') { await accountRequest('/api/auth/onboarding', values); const current: Session = await accountRequest('/api/auth/session'); window.location.assign(`/${current.profile!.role}/dashboard`); }
      else { await accountRequest('/api/auth/login', values); const current: Session = await accountRequest('/api/auth/session'); window.location.assign(current.profile ? `/${current.profile.role}/dashboard` : '/onboarding'); }
    } catch (cause) { setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'The request timed out. Please try again.'); if (cause instanceof AccountRequestError) { setCooldown(cause.retryAfter); if (cause.recoveryConsumed) setSession(null); } }
    finally { setBusy(false); }
  }
  async function logout() { setBusy(true); setError(''); try { await accountRequest('/api/auth/logout', {}); window.location.assign('/login'); } catch { setError('Unable to sign out. Please try again.'); } finally { setBusy(false); } }
  async function resend(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const result = await accountRequest('/api/auth/resend', Object.fromEntries(new FormData(event.currentTarget).entries())); setMessage(result.message); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request a code.'); if (cause instanceof AccountRequestError) setCooldown(cause.retryAfter); } finally { setBusy(false); } }
  const titles: Record<string, string> = { '/login': 'Welcome back.', '/signup': 'Grow your connections.', '/forgot-password': 'A fresh start.', '/verify-email': 'Check your inbox.', '/reset-password': 'Choose a new password.', '/onboarding': 'Your place in the network.' };
  const showForm = !checking && (!protectedPage || session) && !dashboard && !registered && !(path === '/reset-password' && message);
  return <div className="account-page"><header className="account-header"><a className="brand" href="/">Jalisco Produce Export<small>SUPPLY · ORIGIN · LOGISTICS</small></a><a href="/">Explore the public site ↗</a></header><main className={`account-layout ${dashboard ? 'account-wide' : ''}`}><aside className="account-intro"><p className="eyebrow">ORIGIN · CONNECTION · POSSIBILITY</p><h1>{dashboard ? `Your ${dashboard.profile.role} workspace.` : 'Rooted in Jalisco.\nConnected by trust.'}</h1><p>Your account is a starting point for future producer and buyer workflows. The public map and producer presentation are always open.</p><a href="/">Return to the public map ↗</a><div className="account-art" role="img" aria-label="Illustrative nopal artwork"/></aside><section className="account-card" aria-labelledby="account-title"><p className="eyebrow">JALISCO PRODUCE EXPORT</p><h2 id="account-title">{dashboard ? `Welcome, ${dashboard.profile.full_name}.` : titles[path] || 'Account'}</h2>{checking && <p role="status">Checking your session…</p>}{error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-success" role="status">{message}</p>}
    {dashboard && <><dl><dt>Account type</dt><dd>{dashboard.profile.role}</dd><dt>Company or farm</dt><dd>{dashboard.profile.company}</dd><dt>Country</dt><dd>{dashboard.profile.country}</dd></dl><p>{dashboard.message}</p><p>Email confirmation establishes email access only. It does not verify a farm, supplier, or commercial eligibility.</p><button disabled={busy} onClick={logout}>Sign out</button></>}
    {showForm && <form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy || cooldown > 0} className="account-fields">
      {(path === '/signup' || path === '/onboarding') && <ProfileFields initial={session?.registration}/>}
      {['/signup', '/login', '/forgot-password', '/verify-email'].includes(path) && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
      {['/signup', '/login', '/reset-password'].includes(path) && <div><label htmlFor="account-password">{path === '/reset-password' ? 'New password' : 'Password'}</label><input id="account-password" name="password" type="password" minLength={12} maxLength={128} aria-describedby="password-help" autoComplete={path === '/login' ? 'current-password' : 'new-password'} required/><small id="password-help">12–128 characters. Use a unique password.</small></div>}
      {path === '/verify-email' && <><label>Code purpose<select value={recovery ? 'recovery' : 'signup'} onChange={e => setRecovery(e.target.value === 'recovery')}><option value="signup">Confirm my email</option><option value="recovery">Recover my password</option></select></label><label>Email confirmation code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required/></label><p>Use the code sent to your email. Expired or already used codes require a new request.</p></>}
      {path === '/signup' && <p>Choose your account type carefully. It is fixed after onboarding; no farm or supplier verification is implied.</p>}
      {path === '/onboarding' && <p>Confirm your details to complete onboarding. Your account type cannot be changed here afterwards.</p>}
      <button type="submit">{cooldown ? `Try again in ${cooldown}s` : busy ? 'Please wait…' : path === '/signup' ? 'Create account' : path === '/forgot-password' ? 'Send recovery code' : path === '/verify-email' ? 'Verify code' : path === '/reset-password' ? 'Update password' : path === '/onboarding' ? 'Complete onboarding' : 'Sign in'}</button>
    </fieldset></form>}
    {path === '/verify-email' && <details><summary>Need a new confirmation code?</summary><form onSubmit={resend}><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><button disabled={busy || cooldown > 0}>{cooldown ? `Try again in ${cooldown}s` : 'Resend confirmation code'}</button><p>For password recovery, request a new code from Forgot password.</p></form></details>}
    <nav className="account-links" aria-label="Account navigation"><a href="/login">Sign in</a><a href="/signup">Create account</a><a href="/forgot-password">Forgot password?</a><a href="/verify-email">Enter email code</a></nav>{session && !dashboard && <button disabled={busy} onClick={logout}>Sign out</button>}
  </section></main><footer>Jalisco Produce Export · Account access does not imply verified supply or commercial commitments.</footer></div>;
}
