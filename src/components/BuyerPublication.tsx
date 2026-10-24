import {Localized} from '../localization';
export type BuyerPublicationRecord={id:string;company:string;country:string;region:string;markets:string;interests:string;introduction:string;published:number;updated_at:string;approval_state?:string};
export function BuyerPublication({publication,busy,onSave}:{publication?:BuyerPublicationRecord|null;busy:boolean;onSave:(values:Record<string,unknown>)=>void}) {
  return <Localized><section id="public-buyer-profile" aria-labelledby="public-buyer-title"><h3 id="public-buyer-title">Public buyer directory profile</h3>
    <p>Your company profile above stays private. Publish a separate introduction only if you want producers to discover your business. Do not include personal contact details, internal inquiries or contract information.</p>
    <p role="status">{publication?.published?(publication.approval_state==='approved'?'Your directory profile is public.':'Your publication choice is enabled. Public visibility requires administrator approval.'):'Your directory profile is private.'}</p>
    {publication?.published&&publication.approval_state==='approved'&&<p><a className="text-link" href={`/buyers/${encodeURIComponent(publication.id)}`}>View your public buyer profile </a></p>}
    <form key={publication?.updated_at||'unpublished'} onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));onSave({...values,publish:true,explicit_consent:values.explicit_consent==='on',consent_version:'buyer-directory-v1'});}}>
      <fieldset className="account-fields workspace-fields" disabled={busy}>
        {(['company','country','region','markets','interests'] as const).map(k=><label key={k}>{({company:'Public company name',country:'Public company country',region:'Public company region',markets:'Public target markets',interests:'Public produce interests'})[k]}<input name={k} defaultValue={publication?.[k]||''} maxLength={k==='interests'?300:120} required={['company','country','interests'].includes(k)}/></label>)}
        <label className="field-wide">Public company introduction<textarea name="introduction" rows={4} maxLength={2000} defaultValue={publication?.introduction||''}/></label>
        <label className="field-wide"><input className="producer-check" type="checkbox" name="explicit_consent" required/> I explicitly agree to publish these company details, location, target markets, produce interests and introduction to everyone in the buyer directory. I can withdraw publication at any time. (Notice version: buyer-directory-v1)</label>
        <button>{publication?.published?'Update public buyer profile':'Publish buyer profile'}</button>
      </fieldset>
    </form>
    {publication?.published&&<button className="button-secondary" disabled={busy} onClick={()=>onSave({publish:false})}>Unpublish buyer profile</button>}
  </section></Localized>;
}
