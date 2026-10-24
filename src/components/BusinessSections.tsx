import { sampleData as data } from '../sampleData';
import { Localized } from '../localization';
import { StatusBadge } from './StatusBadge';

export const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

function SectionHeading({ step, title, description, id }: { step: string; title: string; description: string; id: string }) {
  return <Localized><div className="business-heading"><div><p className="eyebrow">{step}</p><h2 id={id}>{title}</h2></div><p>{description}</p></div></Localized>;
}

export function ProducerDossier() {
  return <Localized><section id="supply" className="business-section dossier-grid" aria-label="Producer dossier and commercial readiness">
    <article className="panel dossier-card" aria-labelledby="producer-heading">
      <div className="dossier-card-heading"><h2 id="producer-heading">Producer Profile</h2><span className="dossier-index">01 / ORIGIN & SUPPLY</span></div>
      <dl className="dossier-fields">{data.producerFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd><span>{field.value}</span><StatusBadge state={field.state} label={field.badgeLabel}/>{field.note && <small>{field.note}</small>}</dd></div>)}</dl>
      <details className="dossier-footnote"><summary>About this producer presentation</summary><p>{data.producer.description}</p><p>{data.product.note}</p></details>
    </article>
    <article className="panel dossier-card commercial-card" aria-labelledby="commercial-heading">
      <div className="dossier-card-heading"><h2 id="commercial-heading">Commercial Readiness</h2><span className="dossier-index">REVIEW STATUS</span></div>
      <dl className="commercial-fields">{data.commercialReadiness.map(field => <div key={field.label}><dt>{field.label}</dt><dd><StatusBadge state={field.state} label={field.value === 'Pending confirmation' || field.value === 'Evidence required' || field.value === 'Review required' ? field.value : undefined}/>{!['Pending confirmation', 'Evidence required', 'Review required'].includes(field.value) && <span>{field.value}</span>}</dd></div>)}</dl>
      <p className="dossier-note">No current field is verified or backed by an actual quotation. <a href="#documents">Review evidence checklist </a></p>
    </article>
  </section></Localized>;
}

export function PackagingSection() {
  const specs = ['Net carton weight', 'Carton dimensions', 'Pallet configuration', 'Packaging standard', 'Harvest season', 'Recurring supply capacity'];
  return <Localized><section id="packaging" className="business-section" aria-labelledby="packaging-heading">
    <SectionHeading id="packaging-heading" step="PACKAGING & SUPPLY" title="Confirm the pack before quoting." description="486 cartons were reported for the latest harvest. Net weight, dimensions, packaging standard, and recurring capacity have not been supplied."/>
    <div className="packaging-layout panel"><div className="carton-illustration"><svg viewBox="0 0 400 250" role="img" aria-label="Neutral carton schematic; dimensions and packing standard are unknown"><path d="m65 92 168-58 110 61v70l-167 64-111-71Z" fill="#133b42" stroke="#4e8f8f"/><path d="m65 92 111 70 167-67M176 162v67M142 66l112 65" stroke="#4e8f8f"/><text x="135" y="198" fill="#a5ddd0" fontSize="11">ILLUSTRATION</text></svg><strong>Packaging under review</strong><small>Neutral illustration · not actual producer packaging</small></div><div className="packaging-content"><dl className="packaging-specs">{specs.map(label => <div key={label}><dt>{label}</dt><dd>Pending confirmation</dd></div>)}</dl><p className="section-disclosure">Slightly more than 10 metric tonnes is an approximate reported total, not an exact weight. No per-carton weight or pack-out conversion is calculated.</p></div></div>
  </section></Localized>;
}

export function PricingSection() {
  return <Localized><section id="pricing" className="business-section" aria-labelledby="pricing-heading">
    <SectionHeading id="pricing-heading" step="COMMERCIAL TERMS" title="Build the quotation with confirmed details." description="No nopal price, buyer commitment, or freight quotation has been supplied."/>
    <div className="pricing-grid">{data.pricing.map(price => <article key={price.id} className="price-card panel"><p className="example-label"><StatusBadge state={price.state} label="EVIDENCE REQUIRED"/></p><h3>{price.label}</h3><p className="unknown-price">Pending confirmation</p><p className="named-place">{price.namedPlace}</p><details className="price-scope"><summary>Information needed</summary><p>{price.scope}</p></details><a href="#contact">Request producer information <span aria-hidden="true"></span></a></article>)}</div><p className="section-disclosure">{data.pricingNotice}</p>
  </section></Localized>;
}

export function DocumentationSection() {
  return <Localized><section id="documents" className="business-section" aria-labelledby="documents-heading">
    <SectionHeading id="documents-heading" step="05 / EXPORT READINESS" title="Readiness at a glance." description="Operational review states; no verified eligibility, permits, certificates, or compliance approvals are represented."/>
    <div className="readiness-overview panel">{data.readinessOverview.map(field => <div key={field.label}><span>{field.label}</span><StatusBadge state={field.state} label={field.value}/></div>)}</div>
    <details className="documentation panel documentation-details"><summary>Documentation & supporting evidence <span>{data.readiness.length} review areas</span></summary>{data.readiness.map((item, index) => <details className="review-item" key={item.label}><summary><span className="review-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span><StatusBadge state={item.state}/></summary><p>{item.evidence}</p></details>)}<p className="support-note">Requirements depend on the confirmed commodity, origin, destination, and shipment circumstances. Review with qualified trade partners before commercial use.</p></details>
  </section></Localized>;
}
