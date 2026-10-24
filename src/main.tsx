import {InquiriesPage} from './components/InquiriesPage';
import { TradePage } from './components/TradePages';
import { HomePage } from './components/HomePage';
import { SiteHeader, SiteFooter } from './components/SiteChrome';
import { DirectoryPage } from './components/DirectoryPage';
import { AdminPage } from './components/AdminPage';
import { FarmStory } from './components/FarmStory';
import { ExploreProduce } from './components/ExploreProduce';
import { StrictMode, useEffect, useState } from 'react';
import type { MouseEvent, KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './layout.css';
import './platform.css';
import './redesign.css';
import './ui.css';
import { sampleData as data } from './sampleData';
import { ProducerDossier, PackagingSection, PricingSection, DocumentationSection, formatNumber } from './components/BusinessSections';
import { StatusBadge } from './components/StatusBadge';
import { SupplyMarketOverview } from './components/SupplyMarketOverview';
import { BuyerInquiry } from './components/BuyerInquiry';

import { LanguageProvider, Localized, useLanguage } from './localization';
import { initialView, nextView, viewLabels, views } from './presentation';
import type { PresentationView } from './presentation';
import { AccountPages, isAccountPage } from './components/AccountPages';
import { MarketMap } from './components/MarketMap';
function App() {
  const {language}=useLanguage();
  const [active, setActive] = useState<PresentationView>(()=>initialView(window.location.hash || ({'/logistics':'#markets','/commercial':'#pricing','/readiness':'#documents'}[window.location.pathname] || '')));
  const [inquiryOpen, setInquiryOpen] = useState(window.location.hash==='#contact');
  useEffect(()=>{
    let frame=0;
    const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const id=window.location.hash.slice(1);if(id)document.getElementById(id)?.scrollIntoView({block:'start'});});};
    const onHash=()=>{setActive(initialView(window.location.hash || ({'/logistics':'#markets','/commercial':'#pricing','/readiness':'#documents'}[window.location.pathname] || '')));if(window.location.hash==='#contact')setInquiryOpen(true);scroll();};
    window.addEventListener('hashchange',onHash);scroll();
    return()=>{window.removeEventListener('hashchange',onHash);cancelAnimationFrame(frame);};
  },[]);

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
    <SiteHeader presentation tools={<><button className="quote-button" onClick={openInquiry}>Request producer information</button></>}>
      <nav className="presentation-tabs" role="tablist" aria-label="Presentation views">{views.map(view => <button key={view} id={`tab-${view}`} role="tab" aria-selected={active === view} aria-controls={`panel-${view}`} tabIndex={active === view ? 0 : -1} onClick={() => activate(view)} onKeyDown={event => handleTabKey(event, view)}>{viewLabels[view]}</button>)}</nav>
    </SiteHeader>
    <main>
      {active!=='producer'&&<div className="dashboard view-notice"><span className="prototype-flag">PROTOTYPE · ILLUSTRATIVE DATA</span><p className="dossier-context">{data.notice}</p></div>}
      <div id="panel-producer" role="tabpanel" aria-labelledby="tab-producer" hidden={active !== 'producer'} tabIndex={0}>
        <section id="overview" className="hero">
          <div className="hero-image farm-hero-image"><img src="/images/el-grullo-farm.jpeg" alt="Rows of nopal in the farm photographs supplied by Edgar" fetchPriority="high"/><span className="illustration-caption">From the farm · Photographs supplied by Edgar</span></div>
          <div className="hero-content">
            <div className="hero-eyebrow"><p className="eyebrow">JALISCO · U.S. PRODUCE SUPPLY</p></div>
            <h1>Rooted in Jalisco.<br/><em>Connected by trust.</em></h1><h2 className="hero-product">Fresh nopal · El Grullo</h2>
            <div className="hero-cta"><a className="platform-button" href="/explore">Explore Produce </a><a className="text-link" href="/producers">Meet the producers </a></div><p className="hero-copy">Discover the people, produce and possibilities behind the harvest. Start with the origin. Build the next connection.</p>
            <dl className="hero-metrics">
              <div><dd>&gt;{formatNumber(data.supply.harvestTonnesLowerBound)} MT <small>REPORTED</small></dd><dt>Latest reported harvest</dt></div>
              <div><dd>{formatNumber(data.supply.cartonCount)} <small>CARTONS</small></dd><dt>Latest reported cartons</dt></div>
              <div><dd>EL GRULLO<span>, JALISCO</span></dd><dt>Producer-reported location</dt></div>
              <div><dd>TEXAS <span>/ ILLINOIS</span></dd><dt>U.S. target markets</dt></div>
            </dl>
            <p className="hero-source-note">Latest harvest: 486 cartons, slightly more than 10 metric tonnes, as reported by Eduardo. Exact weights and recurring capacity remain pending confirmation.</p>
          </div>
        </section>
        <div className="dashboard view-notice"><span className="prototype-flag">PROTOTYPE · ILLUSTRATIVE DATA</span><p className="dossier-context">{data.notice}</p></div>
        <div className="dashboard"><FarmStory/><SupplyMarketOverview language={language}/><ProducerDossier/><div className="producer-packaging-summary panel"><span>Packaging summary</span><strong>Pending confirmation</strong><StatusBadge state="pending"/><a href="#packaging">View packaging details</a></div></div>
      </div>
      <div className="dashboard">
        <div id="panel-logistics" role="tabpanel" aria-labelledby="tab-logistics" hidden={active !== 'logistics'} tabIndex={0}><div className="logistics-intro"><p className="eyebrow">ORIGIN · CORRIDOR · DESTINATION</p><h2>From Jalisco, toward new markets.</h2><p>Explore the illustrative network separately from shipment planning. Texas and Illinois are intended markets; carriers, transit times, costs and cold-chain arrangements require confirmation.</p></div><div className="business-section map-presentation"><MarketMap active={active === 'logistics'}/></div></div>
        <div id="panel-commercial" role="tabpanel" aria-labelledby="tab-commercial" hidden={active !== 'commercial'} tabIndex={0}><PricingSection/><PackagingSection/><button className="quote-button inquiry-opener" aria-expanded={inquiryOpen} aria-controls="inquiry-content" onClick={() => setInquiryOpen(value => !value)}>Request producer information</button><div id="inquiry-content" hidden={!inquiryOpen}><BuyerInquiry/></div></div>
        <div id="panel-readiness" role="tabpanel" aria-labelledby="tab-readiness" hidden={active !== 'readiness'} tabIndex={0}><DocumentationSection/></div>
      </div>
    </main>
    <SiteFooter presentation/>
  </div></Localized>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider>{window.location.pathname==='/inquiries'?<InquiriesPage/>:['/logistics','/commercial','/readiness'].includes(window.location.pathname) ? <TradePage/> : window.location.pathname === '/admin/preview' ? (window.location.origin === 'https://jalisco-auth-staging.yukikato123123123.workers.dev' ? <AdminPage preview/> : <main><h1>Page not available</h1></main>) : window.location.pathname === '/admin' ? <AdminPage/> : /^\/(producers|buyers)(\/|$)/.test(window.location.pathname) ? <DirectoryPage/> : window.location.pathname === '/explore' ? <ExploreProduce/> : isAccountPage() ? <AccountPages/> : window.location.pathname === '/' && !window.location.hash ? <HomePage/> : <App/>}</LanguageProvider></StrictMode>);
