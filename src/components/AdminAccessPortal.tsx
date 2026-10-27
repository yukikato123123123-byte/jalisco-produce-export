import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {accountRequest} from './AccountPages';
import {useLanguage} from '../localization';
import {translate} from '../i18n';
import {AdminPortalScene} from './AdminPortalScene';
import './admin-portal.css';

type Props={checking:boolean;accessError:string;onAuthenticated:()=>Promise<void>;onRetry:()=>void};
export function AdminAccessPortal({checking,accessError,onAuthenticated,onRetry}:Props){
 const {language,setLanguage}=useLanguage();const t=(text:string)=>translate(text,language);
 const [busy,setBusy]=useState(false),[show,setShow]=useState(false),[error,setError]=useState(''),[focused,setFocused]=useState(false),[burst,setBurst]=useState(0),[cooldown,setCooldown]=useState(0);
 const locked=useRef(false),mounted=useRef(true);const title=t('NopaHua · Private administration');
 useEffect(()=>{document.title=title;},[title]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(cooldown<=0)return;const timer=window.setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked.current||checking||cooldown>0)return;
  locked.current=true;const data=new FormData(e.currentTarget);setBusy(true);setError('');setBurst(v=>v+1);
  try{
   // Start convergence and its wave before the request; reduced motion skips this short prelude.
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>window.setTimeout(resolve,340));
   if(!mounted.current)return;
   await accountRequest('/api/auth/login',{email:data.get('email'),password:data.get('password')});
   const session=await accountRequest('/api/auth/session');
   if(session.recovery)throw new Error('Complete password recovery before continuing.');
   if(session.is_admin!==true)throw new Error('This account does not have administrator access. A trusted owner grant is required.');
   // The parent repeats the existing protected request. A client-side hint alone never opens it.
   await onAuthenticated();
  }catch(cause){setError(cause instanceof Error&&cause.name!=='TimeoutError'?cause.message:'The request timed out. Please try again.');const retry=(cause as {retryAfter?:unknown})?.retryAfter;if(typeof retry==='number'&&retry>0)setCooldown(Math.min(3600,retry));}
  finally{locked.current=false;setBusy(false);}
 }
 const message=busy?'':error||accessError;
 return <main className={`admin-access-portal ${focused?'portal-focused':''} ${busy?'portal-pending':''}`}>
  <AdminPortalScene focused={focused} burst={burst}/>
  <header className="portal-top"><a className="portal-brand" href="/" aria-label={t('NopaHua home')} data-no-translate>NopaHua</a><span>{t('PRIVATE ACCESS')}</span><div className="portal-language" role="group" aria-label="Language / Idioma" data-no-translate><button type="button" lang="es" aria-label="Español" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>ES</button><span>/</span><button type="button" lang="en" aria-label="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button></div></header>
  <aside className="portal-coordinate" aria-hidden="true"><span/>{t('IDENTITY VERIFICATION')}<br/>{t('SECURE ENVIRONMENT')}</aside>
  <section className="portal-interface" aria-labelledby="portal-title">
   <div className="portal-heading"><h1 id="portal-title" data-no-translate>NopaHua</h1><p>{t('ADMINISTRATION')}</p><span>{t('PRIVATE ACCESS PORTAL')}</span></div>
   <div className="portal-glass-panel">
    <h2>{t('ADMINISTRATOR SIGN IN')}</h2>
    {checking&&<p className="portal-feedback" role="status">{t('Checking administrator access and loading records…')}</p>}
    {message&&<div className="portal-feedback portal-error" role="alert">{t(message)}</div>}
    <form onSubmit={submit} aria-busy={busy||checking} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false);}}>
     <label htmlFor="portal-email">{t('EMAIL ADDRESS')}</label><input id="portal-email" name="email" type="email" autoComplete="username" inputMode="email" maxLength={254} required placeholder={t('Enter your administrator email')} disabled={busy}/>
     <label htmlFor="portal-password">{t('PASSWORD')}</label><div className="portal-password"><input id="portal-password" name="password" type={show?'text':'password'} autoComplete="current-password" minLength={12} maxLength={128} required placeholder={t('Enter your password')} disabled={busy}/><button type="button" aria-label={t(show?'Hide password':'Show password')} aria-pressed={show} onClick={()=>setShow(v=>!v)} disabled={busy}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>{show&&<path d="m3 3 18 18"/>}</svg></button></div>
     <button className="portal-unlock" type="submit" disabled={busy||checking||cooldown>0}>{busy?t('VERIFYING ACCESS…'):cooldown>0?t(`Try again in ${cooldown}s`):t('UNLOCK ACCESS')}<span aria-hidden="true">⟶</span></button>
     {busy&&<p className="portal-feedback" role="status">{t('Verifying your session and administrator permission…')}</p>}
    </form>
    <a className="portal-forgot" href="/forgot-password">{t('FORGOT PASSWORD?')}</a>
    <div className="portal-restriction"><span/>{t('AUTHORIZED PERSONNEL ONLY')}</div>
    {accessError&&<button className="portal-retry" type="button" onClick={onRetry} disabled={busy||checking}>{t('Retry access')}</button>}
   </div>
   <a className="portal-return" href="/">{t('Return to NopaHua')}</a>
  </section>
 </main>;
}
