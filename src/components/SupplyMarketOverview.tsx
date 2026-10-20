import { sampleData } from '../sampleData';
import type { Language } from '../presentation';
import { localizeNode } from '../localizeNode';

// Visible qualitative/metric graphics. No fabricated denominator, comparison
// score, exact weight, or completion percentage is used to size these marks.
export function SupplyMarketOverview({ language }: { language: Language }) {
  const { harvest, markets, readiness } = sampleData.overview;
  return localizeNode(<section className="business-section supply-market-overview" aria-labelledby="supply-market-heading">
    <div className="business-heading"><div><p className="eyebrow">PRODUCER-REPORTED · OPEN QUESTIONS</p><h2 id="supply-market-heading">Supply & Market Overview</h2></div><p>Reported harvest, intended markets, and evidence still needed. No commercial forecast or readiness percentage.</p></div>
    <div className="overview-charts">
      <figure className="overview-chart panel harvest-chart"><figcaption><span className="chart-index">01</span><h3>Harvest & cartons</h3><span className="chart-source">Producer-reported</span></figcaption>
        <svg viewBox="0 0 400 170" role="img" aria-labelledby="harvest-graphic-title harvest-graphic-description"><title id="harvest-graphic-title">Latest reported harvest</title><desc id="harvest-graphic-description">486 cartons and slightly more than 10 metric tonnes, reported by Eduardo. Exact total weight and carton net weights are unknown.</desc><rect x="15" y="15" width="165" height="130" rx="4" className="harvest-node"/><rect x="220" y="15" width="165" height="130" rx="4" className="harvest-node"/><path d="M180 80h40" className="harvest-link"/><text x="97" y="74" textAnchor="middle" className="chart-large">{harvest.cartonCount}</text><text x="97" y="109" textAnchor="middle" className="chart-small">Reported cartons</text><text x="302" y="74" textAnchor="middle" className="chart-large">&gt; {harvest.harvestTonnesLowerBound}</text><text x="302" y="100" textAnchor="middle" className="chart-small">Metric tonnes</text><text x="302" y="122" textAnchor="middle" className="chart-tiny">Slightly more than</text></svg>
        <p className="chart-note">Same reported harvest · carton-to-weight relationship unconfirmed.</p><div className="chart-evidence"><span>Exact weight / net carton weight</span><strong>Pending confirmation</strong></div>
      </figure>
      <figure className="overview-chart panel market-chart"><figcaption><span className="chart-index">02</span><h3>Texas vs Illinois</h3><span className="chart-source">Intended markets</span></figcaption>
        <svg viewBox="0 0 400 120" role="img" aria-labelledby="markets-graphic-title markets-graphic-description"><title id="markets-graphic-title">Target-market comparison</title><desc id="markets-graphic-description">Texas and Illinois are intended markets. No buyer counts, demand figures, prices, freight costs, distances, or transit times are available for comparison.</desc><path d="M200 32v20H85v26m115-26h115v26" className="market-branches"/><circle cx="200" cy="25" r="5" className="market-node"/><text x="200" y="15" textAnchor="middle" className="chart-small">El Grullo, Jalisco</text><circle cx="85" cy="81" r="5" className="market-node"/><circle cx="315" cy="81" r="5" className="market-node"/><text x="85" y="108" textAnchor="middle" className="chart-market-label">Texas</text><text x="315" y="108" textAnchor="middle" className="chart-market-label">Illinois</text></svg>
        <div className="market-evidence-matrix">{markets.map(market => <div key={market.id}><strong>{market.name}</strong><span>Buyer discovery</span><small>{market.buyerStatus}</small><span>Commercial / transport terms</span><small>{market.termsStatus}</small></div>)}</div><p className="chart-note">Qualitative comparison only · no demand or sales values inferred.</p>
      </figure>
      <figure className="overview-chart panel readiness-chart"><figcaption><span className="chart-index">03</span><h3>Export-readiness review</h3><span className="chart-source">Evidence-led</span></figcaption><ol className="readiness-stages">{readiness.map(stage => <li key={stage.id}><i className="unconfirmed-stage" aria-hidden="true"/><span>{stage.label}</span><strong>{stage.status}</strong></li>)}</ol><p className="chart-note">No category is marked complete. Statuses describe review needs, not export approval.</p></figure>
    </div>
  </section>, language);
}
