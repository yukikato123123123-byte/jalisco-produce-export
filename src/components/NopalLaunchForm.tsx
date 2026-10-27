import {useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useLanguage} from '../localization';
import {translate} from '../i18n';

export function NopalLaunchForm(){
 const {language}=useLanguage();const t=(text:string)=>translate(text,language);
 const [state,setState]=useState<'idle'|'saving'|'saved'|'error'>('idle');
 const [error,setError]=useState('');const pending=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current)return;
  const fields=new FormData(event.currentTarget);pending.current=true;setState('saving');setError('');
  try{
   const response=await fetch('/api/public/launch-subscriptions',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fields.get('email'),consent:fields.get('consent')==='on',language,consentVersion:'nopal-launch-v1'}),signal:AbortSignal.timeout(10000)});
   const data:unknown=await response.json();
   const result=data&&typeof data==='object'?data as Record<string,unknown>:{};
   if(!response.ok||result.status!=='saved'){
    const messages:Record<string,string>={invalid_email:'Enter a valid email address.',consent_required:'Please agree to receive the NopaHua launch notification.',invalid_language:'Choose a supported language.',rate_limited:'Too many requests. Please wait before trying again.'};
    throw new Error(messages[String(result.code)]||'Your request could not be saved. Please try again.');
   }
   setState('saved');
  }catch(e){setError(e instanceof Error&&['Enter a valid email address.','Please agree to receive the NopaHua launch notification.','Choose a supported language.','Too many requests. Please wait before trying again.'].includes(e.message)?e.message:'Your request could not be saved. Please try again.');setState('error');}
  finally{pending.current=false;}
 }
 return <section className="nopal-launch nopal-frame" id="launch" aria-labelledby="nopal-launch-title">
  <div><p className="nopal-eyebrow">{t('THE NEXT ENCOUNTER')}</p><h2 id="nopal-launch-title">{t('Be there when it begins.')}</h2><p>{t('Leave your email for the NopaHua launch notification. A launch date has not been announced.')}</p></div>
  <div className="nopal-launch-form">
   {state==='saved'?<div role="status"><h3>{t('Your request is saved.')}</h3><p>{t('No email has been sent. This request does not create an account or verify your email address.')}</p></div>:<form onSubmit={submit} aria-busy={state==='saving'}>
    <label htmlFor="nopal-launch-email">{t('Email address')}</label><div className="nopal-email-row"><input id="nopal-launch-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required disabled={state==='saving'} aria-describedby="nopal-launch-privacy"/><button className="nopal-cta" type="submit" disabled={state==='saving'}>{t(state==='saving'?'SAVING…':'NOTIFY ME')}</button></div>
    <label className="nopal-consent"><input name="consent" type="checkbox" required disabled={state==='saving'}/><span>{t('I agree to receive the NopaHua launch notification at this email address.')}</span></label>
    <p id="nopal-launch-privacy">{t('We store your email, language and consent date for this request. No purchase or account is required. This form saves a request; it does not send an email.')}</p>
    {state==='error'&&<p role="alert">{t(error)}</p>}
   </form>}
  </div>
 </section>;
}
