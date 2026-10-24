import {Localized} from '../localization';
import { sampleData } from '../sampleData';
import { demoData } from '../demoData';
import { translate } from '../i18n';
import type { Language } from '../presentation';
import { localizeNode } from '../localizeNode';

// Zero-based scales; each metric has its own labeled unit and axis.
function comparison(id: string, title: string, unit: string, field: 'priceUsdPerKg' | 'transitDays' | 'freightUsdPerVehicle', language: Language) {
  const maximum = demoData.axes[field];
  const format = (value: number) => new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: field === 'priceUsdPerKg' ? 2 : 0, maximumFractionDigits: 2 }).format(value);
  return <Localized><div className="comparison-metric"><h4>{title}</h4><p className="axis-unit">{unit}</p>
    <svg viewBox="0 0 500 160" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{demoData.disclaimer}</desc>
      {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={90 + tick * 78} y1="12" x2={90 + tick * 78} y2="116" className="plot-grid"/><text x={90 + tick * 78} y="143" textAnchor="middle" className="plot-tick">{format(maximum * tick / 4)}</text></g>)}
      {demoData.markets.map((market, index) => <g key={market.id}><text x="0" y={43 + index * 58} className="plot-label">{market.name}</text><rect x="90" y={21 + index * 58} width={market[field] / maximum * 312} height="32" rx="2" className={`plot-bar ${market.id}`}><title>{`${market.name}: ${format(market[field])} ${translate(unit, language)}`}</title></rect><text x={100 + market[field] / maximum * 312} y={43 + index * 58} className="plot-value">{format(market[field])}</text></g>)}
    </svg>
    <ul className="metric-text-values">{demoData.markets.map(market => <li key={market.id}><span>{market.name}</span><strong>{format(market[field])} <span>{unit}</span></strong></li>)}</ul>
  </div></Localized>;
}

export function SupplyMarketOverview({ language }: { language: Language }) {
  const harvest = sampleData.supply;
  const review = [
    { label: 'Packaging', status: 'Pending Verification', note: 'Carton weight, dimensions, and packing standard are unknown.' },
    { label: 'Pricing', status: 'Demo Only', note: 'Fictional comparison only; producer quotation pending verification.' },
    { label: 'Refrigerated transport', status: 'Reported', note: 'Contacts reported; appointment, quote, and cold-chain plan pending verification.' },
    { label: 'Export documentation', status: 'Pending Verification', note: 'Documents and shipment-specific eligibility require review.' },
    { label: 'Customs arrangements', status: 'Reported', note: 'Prospective broker contacts reported; no appointment or clearance confirmed.' },
  ];
  return localizeNode(<section className="business-section supply-market-overview" aria-labelledby="supply-market-heading">
    <div className="business-heading"><div><p className="eyebrow">ORIGIN · EVIDENCE · POSSIBILITIES</p><h2 id="supply-market-heading">Supply & Market Overview</h2></div><p>Reported harvest and open verification needs, followed by clearly separated fictional comparisons.</p></div>
    <div className="overview-charts evidence-charts">
      <figure className="overview-chart panel harvest-chart"><figcaption><span className="chart-index">01 /</span><h3>Harvest & cartons</h3><span className="chart-source">Producer-reported</span></figcaption>
        <div className="harvest-display"><div><strong>{harvest.cartonCount}</strong><span>Reported cartons</span></div><span className="harvest-divider" aria-hidden="true">/</span><div><strong>&gt; {harvest.harvestTonnesLowerBound}</strong><span>Metric tonnes</span></div></div>
        <blockquote>486 cartons and slightly more than 10 metric tonnes, reported by Eduardo.</blockquote>
        <p className="chart-note">Same reported harvest · carton-to-weight relationship unconfirmed.</p><div className="chart-evidence"><span>Exact weight / net carton weight</span><strong>Pending confirmation</strong></div>
      </figure>
      <figure className="overview-chart panel readiness-chart"><figcaption><span className="chart-index">02 /</span><h3>Export-readiness review</h3><span className="chart-source">Evidence-led</span></figcaption>
        <ul className="verification-legend"><li>Reported</li><li>Pending Verification</li><li>Demo Only</li></ul>
        <ol className="readiness-stages">{review.map(item => <li key={item.label}><i className="unconfirmed-stage" aria-hidden="true"/><span>{item.label}</span><strong className={`review-state ${item.status === 'Reported' ? 'reported' : item.status === 'Demo Only' ? 'demo' : 'pending'}`}>{item.status}</strong><p>{item.note}</p></li>)}</ol>
        <p className="chart-note">Reported means a producer statement, not verified evidence. Demo Only identifies fictional presentation data. No export approval, legal compliance, or readiness percentage is claimed.</p>
      </figure>
    </div>
    <section className="demo-comparisons" aria-labelledby="demo-heading"><div className="demo-heading"><div><p className="eyebrow">ILLUSTRATIVE PLANNING LAB</p><h3 id="demo-heading">Two markets. Fictional scenarios.</h3></div><p className="demo-warning">{demoData.disclaimer}</p></div><p className="demo-introduction">{demoData.warning}</p>
      <div className="overview-charts demo-chart-grid">
        <figure className="overview-chart panel price-comparison"><figcaption><span className="chart-index">03 /</span><h3>Illustrative price comparison</h3><span className="chart-source">Demo Only</span></figcaption><p className="demo-warning">{demoData.disclaimer}</p>
          {comparison('demo-price', 'Illustrative nopal price', 'USD / kg', 'priceUsdPerKg', language)}
          <div className="chart-assumptions"><h4>Assumptions</h4><p>{demoData.priceAssumptions}</p></div>
        </figure>
        <figure className="overview-chart panel logistics-comparison"><figcaption><span className="chart-index">04 /</span><h3>Illustrative logistics comparison</h3><span className="chart-source">Demo Only</span></figcaption><p className="demo-warning">{demoData.disclaimer}</p>
          {comparison('demo-transit', 'Fictional estimated transit', 'Days / scenario', 'transitDays', language)}
          {comparison('demo-freight', 'Simulated refrigerated shipping cost', 'USD / vehicle', 'freightUsdPerVehicle', language)}
          <div className="chart-assumptions"><h4>Assumptions</h4><p>{demoData.logisticsAssumptions}</p></div><p className="chart-note">{demoData.warning}</p>
        </figure>
      </div>
    </section>
  </section>, language);
}
