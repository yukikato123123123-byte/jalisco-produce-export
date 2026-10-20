import { sampleData as data, supplyTotals } from '../sampleData';

export const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const usd = (value: number, digits = 2) => `US$${new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;

function SectionHeading({ step, title, description, id }: { step: string; title: string; description: string; id: string }) {
  return <div className="business-heading"><div><p className="eyebrow">{step}</p><h2 id={id}>{title}</h2></div><p>{description}</p></div>;
}

export function ProductSupply() {
  const { product, supply } = data;
  const specs = [
    ['Sample harvest volume', `${formatNumber(supply.harvestTonnes)} metric tonnes`, 'Independent illustrative allocation; no supply commitment.'],
    ['Sample carton count', `${formatNumber(supply.cartonCount)} cartons`, 'Illustrative pack-out count; not confirmed inventory.'],
    ['Sample net carton weight', `${formatNumber(supply.cartonNetKg)} kg`, 'Net product only; gross shipping weight not established.'],
    ['Example carton dimensions', `${supply.cartonDimensionsCm.join(' × ')} cm`, 'Length × width × height; illustrative pack specification.'],
    ['Illustrative pallet configuration', `${supply.cartonsPerPallet} cartons × ${supply.palletCount} pallets`, `${formatNumber(supplyTotals.palletCartons)} cartons total; pallet suitability and gross load to review.`],
    ['Example seasonal availability', supply.harvestWindow, supply.continuity],
  ];
  return <section id="supply" className="business-section" aria-labelledby="product-heading">
    <SectionHeading id="product-heading" step="01 / PRODUCT & SUPPLY" title="A complete listing. An illustrative starting point." description="NOT VERIFIED WITH PRODUCER · Specifications demonstrate the listing workflow; they are not an offer of available stock."/>
    <div className="product-supply-grid">
      <article className="product-profile panel"><div className="product-image" role="img" aria-label="Illustrative avocado photograph cropped from the supplied reference; not the producer's produce"><span>ILLUSTRATIVE IMAGERY ONLY</span></div><div className="product-profile-content"><span className="badge">SAMPLE DATA</span><h3>{product.name}</h3><dl><div><dt>Variety</dt><dd>{product.variety}</dd></div><div><dt>Grade</dt><dd>{product.grade}</dd></div><div><dt>Origin</dt><dd>{product.origin}</dd></div></dl><p>{product.note}</p><div className="producer-description"><strong>{data.producer.name}</strong><p>{data.producer.description}</p></div></div></article>
      <article className="supply-specs panel"><div className="spec-heading"><h3>Supply & packaging example</h3><span className="badge">ILLUSTRATIVE EXAMPLE</span></div><dl className="spec-grid">{specs.map(([label, value, note]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><p>{note}</p></div>)}</dl><div className="calculation-note"><strong>Weight reconciliation · sample quantities</strong><p>{formatNumber(supply.cartonCount)} cartons × {formatNumber(supply.cartonNetKg)} kg = <b>{formatNumber(supplyTotals.impliedNetKg)} kg</b> ({formatNumber(supplyTotals.impliedNetTonnes, 4)} metric tonnes).</p><p>This is {formatNumber(supplyTotals.differenceKg)} kg above the separate {formatNumber(supply.harvestTonnes)}-tonne harvest example. These remain independent illustrative values; no producer has committed either quantity.</p></div></article>
    </div>
  </section>;
}

export function PricingSection() {
  return <section id="pricing" className="business-section" aria-labelledby="pricing-heading"><SectionHeading id="pricing-heading" step="03 / INDICATIVE PRICING" title="Compare commercial possibilities." description="Independent simulated examples, not researched market rates. No live quotation or landed-cost calculation."/><div className="pricing-grid">{data.pricing.map(price => <article key={price.id} className="price-card panel"><p className="example-label">SIMULATED PRICE — NOT A QUOTATION</p><h3>{price.label}</h3><p className="price-value">{usd(price.usdPerKg)}<span>/ kg</span></p><p className="named-place">{price.namedPlace}</p><p>{price.scope}</p><a href="#contact">Explore a demo inquiry <span aria-hidden="true">↗</span></a></article>)}</div><p className="section-disclosure">{data.pricingNotice}</p></section>;
}

export function LogisticsScenarios() {
  return <section id="scenarios" className="business-section" aria-labelledby="scenarios-heading"><SectionHeading id="scenarios-heading" step="04 / LOGISTICS PLANNING" title="Two markets. Two simulated scenarios." description="Narrative planning examples only. The interactive map remains schematic and does not show road geometry or a Laredo waypoint."/><p className="scenario-warning">{data.logisticsNotice}</p><div className="scenario-grid">{data.logistics.map(scenario => <article key={scenario.id} className="scenario-card panel"><div className="scenario-title"><h3>{scenario.market}</h3><span className="badge">NOT A BOOKING</span></div><p className="scenario-route">{scenario.routeConcept}</p><dl className="scenario-metrics"><div><dt>Simulated transport budget</dt><dd>{usd(scenario.usdPerLoad, 0)}<small>/ load</small></dd></div><div><dt>Simulated transit range</dt><dd>{scenario.transitDays.join('–')}<small>days</small></dd></div></dl><dl className="scenario-details"><div><dt>Example mode</dt><dd>{scenario.mode}</dd></div><div><dt>Hypothetical crossing</dt><dd>{scenario.crossing}</dd></div><div><dt>Fictional carrier placeholder</dt><dd>{scenario.carrier}</dd></div></dl><p>{scenario.scope}</p></article>)}</div><p className="section-disclosure">{data.logisticsExplanation}</p></section>;
}

export function DocumentationSection() {
  return <section id="documents" className="business-section" aria-labelledby="documents-heading"><SectionHeading id="documents-heading" step="05 / DOCUMENTATION & READINESS" title="Make the review process visible." description="Sample workflow states only. No item has verified evidence, and no legal export or import eligibility is claimed."/><div className="documentation panel"><h3>Review checklist <span>{data.readiness.length} review areas · no verified evidence</span></h3>{data.readiness.map((item, index) => <details className="review-item" key={item.label}><summary><span className="review-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span><span className="workflow-status">{item.status}</span></summary><p>{item.evidence}</p></details>)}<p className="support-note">Actual requirements must be checked for the confirmed commodity, origin, destination, date, and shipment circumstances with qualified trade partners. No permits, certificates, inspection records, or compliance approvals are provided by this prototype.</p></div></section>;
}
