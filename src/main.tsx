import { StrictMode, useEffect, useRef, useState } from 'react';
import type { MouseEvent, KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { sampleData as data } from './sampleData';
import { ProducerDossier, PackagingSection, PricingSection, LogisticsScenarios, DocumentationSection, formatNumber } from './components/BusinessSections';
import { StatusBadge } from './components/StatusBadge';
import { SupplyMarketOverview } from './components/SupplyMarketOverview';
import { BuyerInquiry } from './components/BuyerInquiry';

import { LanguageProvider, Localized, useLanguage } from './localization';
import { translate } from './i18n';
import { nextView, viewLabels, views } from './presentation';
import type { PresentationView } from './presentation';
import { focusMap, refreshMap } from './mapBehavior';
import type { MapFocus } from './mapBehavior';
function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 60 55" aria-hidden="true"><path fill="currentColor" d="M40 2c-8 0-14 6-14 14 0 10 14 31 14 31s14-21 14-31C54 8 48 2 40 2Zm0 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM3 14c18 4 24 16 26 31C11 40 5 31 3 14Z"/><path d="m10 23 19 22" stroke="#052332" strokeWidth="1.5"/></svg>;
}

// Quadratic Bezier sampled in Web Mercator. The control point is decorative,
// not a waypoint or road location. Endpoints come only from the existing data.
function schematicCurve(start: [number, number], end: [number, number]): L.LatLng[] {
  const a = L.CRS.EPSG3857.project(L.latLng(start));
  const b = L.CRS.EPSG3857.project(L.latLng(end));
  const control = L.point((a.x + b.x) / 2 - (b.y - a.y) * 0.24, (a.y + b.y) / 2 + (b.x - a.x) * 0.24);
  return Array.from({ length: 65 }, (_, index) => {
    const t = index / 64;
    const u = 1 - t;
    return L.CRS.EPSG3857.unproject(L.point(u * u * a.x + 2 * u * t * control.x + t * t * b.x, u * u * a.y + 2 * u * t * control.y + t * t * b.y));
  });
}

function MarketMap({ active }: { active: boolean }) {
  const { language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [tileError, setTileError] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [focus, setFocus] = useState<MapFocus>('regional');
  const focusRef = useRef<MapFocus>('regional');
  const view = focus === 'origin' ? 'origin' : 'regional';
  const markerLabels = useRef<{ marker: L.Marker; label: HTMLElement; popup: HTMLElement; index: number }[]>([]);
  const connections = useRef<L.LayerGroup | null>(null);
  const destinations = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { center: data.locations[0].coordinates, zoom: 4, scrollWheelZoom: true, touchZoom: true, zoomSnap: 0.25, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Verified provider URL and local-development policy: see README.
    // No API key or account is used. Non-local hosting requires provider setup.
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://stadiamaps.com/attribution/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).on('tileerror', () => setTileError(true)).addTo(map);
    connections.current = L.layerGroup();
    destinations.current = L.layerGroup();
    data.locations.slice(1).forEach(point => {
      const curve = schematicCurve(data.locations[0].coordinates, point.coordinates);
      L.polyline(curve, { color: '#002c35', opacity: 0.8, weight: 5, interactive: false }).addTo(connections.current!);
      L.polyline(curve, { color: '#20dfb1', opacity: 0.95, weight: 1.8, dashArray: '4 5', lineCap: 'round', interactive: false }).addTo(connections.current!);
    });
    data.locations.forEach((point, index) => {
      const pin = `<svg viewBox="0 0 32 42" aria-hidden="true"><path fill="currentColor" d="M16 1C8 1 2 7 2 15c0 10 14 25 14 25s14-15 14-25C30 7 24 1 16 1Z"/><circle cx="16" cy="14" r="5" fill="#062437"/></svg>`;
      const marker = L.marker(point.coordinates, {
        icon: L.divIcon({ className: `region-marker ${index === 0 ? 'origin-marker' : 'destination-marker'}`, html: pin, iconSize: [27, 37], iconAnchor: [13.5, 36] }),
        title: point.name, alt: `${point.name}, approximate region`,
      }).addTo(index === 0 ? map : destinations.current!);
      const label = document.createElement('span');
      label.textContent = index === 0 ? 'JALISCO ORIGIN' : point.name.split(',')[0].toUpperCase();
      marker.bindTooltip(label, { permanent: true, direction: index === 0 ? 'bottom' : 'right', offset: index === 0 ? [30, 0] : [12, -24] });
      const popup = document.createElement('div');
      popup.textContent = `${point.name} — ${point.role}. Representative point only; no verified facility or buyer.`;
      marker.bindPopup(popup);
      markerLabels.current.push({ marker, label, popup, index });
    });
    const observer = new ResizeObserver(() => {
      if (container.current?.clientWidth && container.current.clientHeight) refreshMap(map, focusRef.current);
    });
    observer.observe(container.current);
    if (container.current.clientWidth) refreshMap(map, focusRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      connections.current = null;
      destinations.current = null;
      markerLabels.current = [];
    };
  }, []);

  useEffect(() => {
    focusRef.current = focus;
    const map = mapRef.current;
    if (!map) return;
    map.closePopup();
    if (view === 'regional') destinations.current?.addTo(map);
    else destinations.current?.remove();
    if (container.current?.clientWidth) focusMap(map, focus, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [focus, view]);

  useEffect(() => {
    if (!mapRef.current || !connections.current) return;
    if (showConnections && view === 'regional') connections.current.addTo(mapRef.current);
    else connections.current.remove();
  }, [showConnections, view]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      if (mapRef.current && container.current?.clientWidth) refreshMap(mapRef.current, focusRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    const t = (text: string) => translate(text, language);
    markerLabels.current.forEach(({ marker, label, popup, index }) => {
      const point = data.locations[index];
      label.textContent = t(index === 0 ? 'JALISCO ORIGIN' : point.name.split(',')[0].toUpperCase());
      popup.textContent = `${t(point.name)} — ${t(point.role)}. ${t('Representative point only; no verified facility or buyer.')}`;
      marker.options.title = `${t(point.name)}, ${t('approximate region')}`;
      marker.options.alt = marker.options.title;
      marker.getElement()?.setAttribute('title', marker.options.title);
      marker.getElement()?.setAttribute('aria-label', marker.options.title);
    });
    for (const [selector, text] of [['.leaflet-control-zoom-in', 'Zoom in'], ['.leaflet-control-zoom-out', 'Zoom out']]) {
      const control = mapRef.current?.getContainer().querySelector(selector);
      control?.setAttribute('title', t(text));
      control?.setAttribute('aria-label', t(text));
    }
  }, [language]);

  function selectFocus(next: MapFocus) {
    focusRef.current = next;
    if (next === focus && mapRef.current) focusMap(mapRef.current, next, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setFocus(next);
  }

  return <Localized><section className="map-card panel" id="markets" aria-labelledby="map-heading">
    <div className="map-heading"><h2 id="map-heading">Logistics Overview</h2><StatusBadge state={data.routeState.state} label={data.routeState.label}/></div>
    <p className="map-subtitle">Jalisco → U.S. Target Markets</p>
    <div className="map-toolbar">
      <div className="map-view-selector" role="group" aria-label="Map view">
        <button aria-pressed={view === 'regional'} onClick={() => selectFocus('regional')}>Regional Overview</button>
        <button aria-pressed={view === 'origin'} onClick={() => selectFocus('origin')}>Jalisco Origin</button>
      </div>
      <div className="map-actions">
        {view === 'regional' && <button onClick={() => setShowConnections(value => !value)} aria-pressed={showConnections}>{showConnections ? 'Hide connections' : 'Show connections'}</button>}
        <button className="full-route-button" onClick={() => { setShowConnections(true); selectFocus('regional'); }}>Show Full Route</button>
      </div>
    </div>
    <div className="destination-shortcuts" role="group" aria-label="Destination shortcuts">
      <button aria-pressed={focus === 'texas'} onClick={() => selectFocus('texas')}>Focus on Texas</button>
      <button aria-pressed={focus === 'illinois'} onClick={() => selectFocus('illinois')}>Focus on Illinois</button>
    </div>
    <div className="map-stage">
      <div ref={container} className="map" role="region" aria-label={view === 'regional' ? 'Interactive regional map of Jalisco, Texas, and Illinois' : 'Interactive Jalisco regional origin map, not a verified farm location'}/>
      <div className="north-indicator" aria-hidden="true">▲<span>N</span></div>
    </div>
    {tileError && <p role="status" className="tile-warning">Map tiles could not load. Open this prototype on localhost or 127.0.0.1 with internet access. Provider rate limits may apply.</p>}
    <div className="map-legend" aria-label="Map legend"><span><i className="legend-pin origin-key" aria-hidden="true"/> Origin (Jalisco)</span>{view === 'regional' && <><span><i className="legend-pin destination-key" aria-hidden="true"/> Intended markets (Texas, Illinois)</span><span><i className="route-symbol" aria-hidden="true"/> Schematic connection</span></>}</div>
    <p className="route-disclosure">Illustrative connections — actual transport routes not verified.</p>
    <p className="map-context" aria-live="polite">{view === 'regional' ? data.routeNotice : 'Representative Jalisco point only · This marker does not locate El Grullo or a verified farm.'}</p>
  </section></Localized>;
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
        <div id="panel-logistics" role="tabpanel" aria-labelledby="tab-logistics" hidden={active !== 'logistics'} tabIndex={0}><div className="business-section map-presentation"><MarketMap active={active === 'logistics'}/></div><LogisticsScenarios/></div>
        <div id="panel-commercial" role="tabpanel" aria-labelledby="tab-commercial" hidden={active !== 'commercial'} tabIndex={0}><PricingSection/><PackagingSection/><button className="quote-button inquiry-opener" aria-expanded={inquiryOpen} aria-controls="inquiry-content" onClick={() => setInquiryOpen(value => !value)}>Request producer information</button><div id="inquiry-content" hidden={!inquiryOpen}><BuyerInquiry/></div></div>
        <div id="panel-readiness" role="tabpanel" aria-labelledby="tab-readiness" hidden={active !== 'readiness'} tabIndex={0}><DocumentationSection/></div>
      </div>
    </main>
    <footer><span>Jalisco Produce Export · Concept for Eduardo’s review</span><span>Sample data · No commercial offer or shipment booking</span><a href="#overview">Back to top ↑</a></footer>
  </div></Localized>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App/></LanguageProvider></StrictMode>);
