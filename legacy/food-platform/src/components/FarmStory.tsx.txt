import { Localized } from '../localization';
export function FarmStory({full=false}:{full?:boolean}) {
  return <Localized><section className="farm-story" aria-labelledby="farm-story-heading">
    <div className="farm-story-copy"><p className="eyebrow">ORIGIN · CONNECTION · POSSIBILITY</p><h2 id="farm-story-heading">A connection that<br/>starts at the source.</h2><p>Nopal fields, open skies and the landscape of Jalisco. A closer look at the farm, through photographs supplied by Edgar.</p><p>The existing producer dossier reports El Grullo, Jalisco as the origin. Supply figures are producer reported; recurring availability, export eligibility and specifications still need confirmation.</p><a className="text-link" href={full?'/#contact':'/producers/field-notes'}>{full?'Request producer information ':'Discover the farm '}</a></div>
    <figure><img src="/images/el-grullo-fields.jpeg" alt="Nopal growing on sloping fields beside wooded hills" loading="lazy"/><figcaption>At the source · Farm photograph supplied by Edgar</figcaption></figure>
    {full&&<figure className="harvest-story"><img src="/images/nopal-harvest.jpeg" alt="Freshly harvested nopal in a wooden crate at the farm" loading="lazy"/><figcaption>From the harvest · This photograph does not establish packaging specifications, current stock or export approval.</figcaption></figure>}
  </section></Localized>;
}
