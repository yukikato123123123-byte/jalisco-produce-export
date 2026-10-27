import {LegacyLocalized as Localized} from '../legacyLocalization';
import {useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {accountRequest} from './AccountPages';
export function BuyerInquiry(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');const requestId=useRef(crypto.randomUUID()),lock=useRef(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setSaved('');try{const fields=Object.fromEntries(new FormData(e.currentTarget).entries());const result=await accountRequest('/api/inquiries',{...fields,id:requestId.current});setSaved(result.id);requestId.current=crypto.randomUUID();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <Localized><section id="contact" className="business-section inquiry-section" aria-labelledby="inquiry-heading"><div className="business-heading"><div><p className="eyebrow">CONTACT & REQUIREMENTS</p><h2 id="inquiry-heading">Submit an inquiry</h2></div><p>Sign in with a verified email to save your inquiry. Submission does not confirm a price, booking or supplier delivery.</p></div><div className="account-card"><form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy} className="account-fields"><div className="form-grid">
 <label>Company *<input name="company" autoComplete="organization" required minLength={2} maxLength={120}/></label><label>Verified account email *<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
 <label>Destination *<input name="destination" required maxLength={120}/></label><label>Product *<input name="product" required maxLength={120}/></label>
 <label>Required volume (kg, up to 3 decimals) *<input name="quantityKg" type="number" min="0.001" step="0.001" required/></label><label>Preferred delivery terms *<input name="terms" required maxLength={120}/></label>
 <label className="full-width">Packaging requirements<textarea name="packaging" maxLength={1000}/></label><label className="full-width">Message<textarea name="questions" maxLength={2000}/></label></div>
 <button type="submit">{busy?'Saving inquiry…':'Submit inquiry'}</button></fieldset></form>{error&&<p className="account-error" role="alert">{error}</p>}{saved&&<div role="status"><strong>Inquiry saved.</strong><p>Reference: <span data-no-translate>{saved}</span></p><p>No email has been sent. Review your saved inquiry in My inquiries.</p></div>}<nav className="account-links"><a href="/login">Sign in</a><a href="/inquiries">My inquiries</a></nav></div></section></Localized>;
}
