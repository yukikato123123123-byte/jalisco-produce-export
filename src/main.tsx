import { StrictMode, useState } from 'react';
import type { MouseEvent, KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { sampleData as data } from './sampleData';
import { ProducerDossier, PackagingSection, PricingSection, DocumentationSection, formatNumber } from './components/BusinessSections';
import { StatusBadge } from './components/StatusBadge';
import { SupplyMarketOverview } from './components/SupplyMarketOverview';
import { BuyerInquiry } from './components/BuyerInquiry';

import { LanguageProvider, Localized, useLanguage } from './localization';
import { nextView, viewLabels, views } from './presentation';
import type { PresentationView } from './presentation';
import { MarketMap } from './components/MarketMap';
function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 60 55" aria-hidden="true"><path fill="currentColor" d="M40 2c-8 0-14 6-14 14 0 10 14 31 14 31s14-21 14-31C54 8 48 2 40 2Zm0 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM3 14c18 4 24 16 26 31C11 40 5 31 3 14Z"/><path d="m10 23 19 22" stroke="#052332" strokeWidth="1.5"/></svg>;
}

function App() {
  const [active, setActive] = useState<PresentationView>('producer');
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  function activate(view: PresentationView) {
    setActive(view);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
  function openInquiry() {
    setActive('commercial');
    setInquiryOpen(true);
    requestAnimationFrame(() => document.getElementById('contact')?.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
  function handleSectionLink(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a[href^="#"]');
    const target = anchor?.getAttribute('href');
    if (!target) return;
    const destinations: Record<string, PresentationView> = { '#overview': 'producer', '#supply': 'producer', '#packaging': 'commercial', '#pricing': 'commercial', '#markets': 'logistics', '#documents': 'readiness' };
    if (target === '#contact') { event.preventDefault(); openInquiry(); }
    else if (destinations[target]) { event.preventDefault(); activate(destinations[target]); }
  }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, view: PresentationView) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = nextView(view, event.key);
    activate(next);
    document.getElementById(`tab-${next}`)?.focus();
  }
  return <Localized><div onClick={handleSectionLink}>
    <header className="header presentation-header">
      <a href="#overview" className="brand" aria-label="Jalisco Produce Export home"><BrandMark/><span><strong>Jalisco Produce Export</strong><small>SUPPLY · ORIGIN · LOGISTICS</small></span></a>
      <div className="header-actions"><div className="language-selector" role="group" aria-label="Language"><button lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button lang="es" aria-label="Español" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button></div><button className="quote-button" onClick={openInquiry}>Request producer information</button></div>
      <nav className="presentation-tabs" role="tablist" aria-label="Presentation views">{views.map(view => <button key={view} id={`tab-${view}`} role="tab" aria-selected={active === view} aria-controls={`panel-${view}`} tabIndex={active === view ? 0 : -1} onClick={() => activate(view)} onKeyDown={event => handleTabKey(event, view)}>{viewLabels[view]}</button>)}</nav>
    </header>
    <main>
      <div className="dashboard view-notice"><span className="prototype-flag">PROTOTYPE · ILLUSTRATIVE DATA</span><p className="dossier-context">{data.notice}</p></div>
      <div id="panel-producer" role="tabpanel" aria-labelledby="tab-producer" hidden={active !== 'producer'} tabIndex={0}>
        <section id="overview" className="hero">
          <div className="hero-image" role="img" aria-label="Illustrative nopal artwork; not a photograph of Eduardo’s product or farm"><span className="illustration-caption">Illustrative nopal artwork</span></div>
          <div className="hero-content">
            <div className="hero-eyebrow"><p className="eyebrow">JALISCO → U.S. PRODUCE SUPPLY</p></div>
            <h1>Fresh nopal<span className="hero-country"> · El Grullo</span></h1>
            <p className="hero-copy">Producer dossier & logistics outlook for U.S. produce brokers.</p>
            <dl className="hero-metrics">
              <div><dd>&gt;{formatNumber(data.supply.harvestTonnesLowerBound)} MT <small>REPORTED</small></dd><dt>Latest reported harvest</dt></div>
              <div><dd>{formatNumber(data.supply.cartonCount)} <small>CARTONS</small></dd><dt>Latest reported cartons</dt></div>
              <div><dd>EL GRULLO<span>, JALISCO</span></dd><dt>Producer-reported location</dt></div>
              <div><dd>TEXAS <span>/ ILLINOIS</span></dd><dt>U.S. target markets</dt></div>
            </dl>
            <p className="hero-source-note">Latest harvest: 486 cartons, slightly more than 10 metric tonnes, as reported by Eduardo. Exact weights and recurring capacity remain pending confirmation.</p>
          </div>
        </section>
        <div className="dashboard"><SupplyMarketOverview language={language}/><ProducerDossier/><div className="producer-packaging-summary panel"><span>Packaging summary</span><strong>Pending confirmation</strong><StatusBadge state="pending"/><a href="#packaging">View packaging details</a></div></div>
      </div>
      <div className="dashboard">
        <div id="panel-logistics" role="tabpanel" aria-labelledby="tab-logistics" hidden={active !== 'logistics'} tabIndex={0}><div className="business-section map-presentation"><MarketMap active={active === 'logistics'}/></div></div>
        <div id="panel-commercial" role="tabpanel" aria-labelledby="tab-commercial" hidden={active !== 'commercial'} tabIndex={0}><PricingSection/><PackagingSection/><button className="quote-button inquiry-opener" aria-expanded={inquiryOpen} aria-controls="inquiry-content" onClick={() => setInquiryOpen(value => !value)}>Request producer information</button><div id="inquiry-content" hidden={!inquiryOpen}><BuyerInquiry/></div></div>
        <div id="panel-readiness" role="tabpanel" aria-labelledby="tab-readiness" hidden={active !== 'readiness'} tabIndex={0}><DocumentationSection/></div>
      </div>
    </main>
    <footer><span>Jalisco Produce Export · Concept for Eduardo’s review</span><span>Sample data · No commercial offer or shipment booking</span><a href="#overview">Back to top ↑</a></footer>
  </div></Localized>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App/></LanguageProvider></StrictMode>);
