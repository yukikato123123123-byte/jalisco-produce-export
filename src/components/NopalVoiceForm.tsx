import {useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useLanguage} from '../localization';
import {translate} from '../i18n';
function clientReference(){try{const stored=sessionStorage.getItem('nopal.voice.client');if(stored&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored))return stored;const id=crypto.randomUUID();sessionStorage.setItem('nopal.voice.client',id);return id;}catch{return crypto.randomUUID();}}
export function NopalVoiceForm(){
 const {language}=useLanguage();const t=(v:string)=>translate(v,language);const [clientId]=useState(clientReference);
 const [state,setState]=useState<'idle'|'saving'|'saved'|'error'>('idle'),[error,setError]=useState(''),[email,setEmail]=useState('');
 const lock=useRef(false),request=useRef<{payload:string;id:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;lock.current=true;const data=new FormData(event.currentTarget);
  const fields={clientId,category:data.get('category'),message:data.get('message'),email:data.get('email'),privacyConsent:data.get('privacyConsent')==='on',replyConsent:data.get('replyConsent')==='on',privacyVersion:'nopal-voice-v1',language};
  const payload=JSON.stringify(fields);if(request.current?.payload!==payload)request.current={payload,id:crypto.randomUUID()};setState('saving');setError('');
  try{
   const response=await fetch('/api/public/feedback',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,id:request.current.id}),signal:AbortSignal.timeout(10000)});
   const value=await response.json();if(!response.ok||value?.status!=='saved'){
    const errors:Record<string,string>={invalid_category:'Choose a feedback type.',invalid_message:'Write a message of 10–4000 characters.',privacy_required:'Please agree to the feedback privacy notice.',reply_consent_required:'Provide an email and agree to a reply, or leave both blank.',invalid_email:'Enter a valid email address.',rate_limited:'Too many requests. Please wait before trying again.',request_conflict:'This request reference was already used. Refresh before sending a different message.'};
    throw new Error(errors[String(value?.code)]||'We could not confirm your feedback was saved. Please try again.');
   }
   setState('saved');
  }catch(cause){setError(cause instanceof Error&&['Choose a feedback type.','Write a message of 10–4000 characters.','Please agree to the feedback privacy notice.','Provide an email and agree to a reply, or leave both blank.','Enter a valid email address.','Too many requests. Please wait before trying again.','This request reference was already used. Refresh before sending a different message.'].includes(cause.message)?cause.message:'We could not confirm your feedback was saved. Please try again.');setState('error');}
  finally{lock.current=false;}
 }
 return <section className="nopal-voice nopal-frame" id="voice" aria-labelledby="nopal-voice-title"><div className="nopal-voice-intro"><p className="nopal-eyebrow" data-no-translate>NopaHua VOICE</p><h2 id="nopal-voice-title">{t('Help shape what comes next.')}</h2><p>{t('A thought, a question, a different perspective. Share it with the people shaping NopaHua.')}</p><p className="nopal-concept-note">{t('Your feedback is private. It is not published on the website or added to launch notifications.')}</p><span className="nopal-rule" aria-hidden="true"/></div>
  <div className="nopal-voice-form">{state==='saved'?<div role="status"><h3>{t('Your voice has been received.')}</h3><p>{t('Your feedback was saved for administrator review. No reply or email has been sent.')}</p></div>:<form onSubmit={submit} aria-busy={state==='saving'}>
   <fieldset disabled={state==='saving'}><label htmlFor="nopal-voice-category">{t('Feedback type')}</label><select id="nopal-voice-category" name="category" required defaultValue=""><option value="" disabled>{t('Choose a feedback type.')}</option>{[['idea','Product idea'],['opinion','Brand or product opinion'],['question','Question'],['other','Other suggestion']].map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select>
    <label htmlFor="nopal-voice-message">{t('Share your thoughts')}</label><textarea id="nopal-voice-message" name="message" minLength={10} maxLength={4000} rows={5} required aria-describedby="nopal-voice-privacy"/><p className="nopal-field-note">{t('10–4000 characters. Please do not include sensitive personal information.')}</p>
    <label htmlFor="nopal-voice-email">{t('Reply email (optional)')}</label><input id="nopal-voice-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/>
    <label className="nopal-consent"><input name="replyConsent" type="checkbox" disabled={!email.trim()} required={Boolean(email.trim())}/><span>{t('I agree that NopaHua may use this email only to reply to my feedback.')}</span></label>
    <label className="nopal-consent"><input name="privacyConsent" type="checkbox" required/><span>{t('I agree to the storage and private review of my feedback as described below.')}</span></label>
    <p id="nopal-voice-privacy">{t('We store your feedback type, message, language and consent date. An optional email is stored only with reply consent. Only authorized administrators can review this information. No email is sent by this form.')}</p>
    <button className="nopal-cta" type="submit">{t(state==='saving'?'SAVING…':'SEND MY THOUGHTS')}<span aria-hidden="true">⟶</span></button>
   </fieldset>{state==='error'&&<p role="alert">{t(error)}</p>}
  </form>}</div>
 </section>;
}
