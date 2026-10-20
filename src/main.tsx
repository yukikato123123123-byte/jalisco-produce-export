import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { sampleData as data } from './sampleData';

type MapView = 'regional' | 'origin';
type IconName = 'leaf' | 'box' | 'document' | 'shield' | 'dollar' | 'info';

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    leaf: <><path d="M5 18C0 9 10 8 12 11c1-5 5-7 10-8 0 10-2 17-10 15M12 22v-9m0 4 6-7M12 18l-6-5"/></>,
    box: <><path d="m3 7 9-5 9 5v11l-9 5-9-5Zm0 0 9 5 9-5M12 12v11M7 4l10 6v5"/></>,
    document: <><path d="M6 2h9l5 5v15H6Zm9 0v6h5M9 12h8M9 16h8"/></>,
    shield: <path d="M12 2c3 3 6 3 9 4v6c0 6-6 9-9 11-3-2-9-5-9-11V6c3-1 6-1 9-4Z"/>,
    dollar: <><path d="M18 6c-5-5-13-1-11 3 1 3 11 2 11 7 0 5-8 6-12 2M12 1v23"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/></>,
  };
  return <svg className={className} viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 60 55" aria-hidden="true"><path fill="currentColor" d="M40 2c-8 0-14 6-14 14 0 10 14 31 14 31s14-21 14-31C54 8 48 2 40 2Zm0 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM3 14c18 4 24 16 26 31C11 40 5 31 3 14Z"/><path d="m10 23 19 22" stroke="#052332" strokeWidth="1.5"/></svg>;
}

function frameMap(map: L.Map, view: MapView) {
  map.stop();
  if (view === 'origin') {
    map.setView(data.locations[0].coordinates, 8, { animate: false });
  } else {
    map.fitBounds(L.latLngBounds(data.locations.map(point => point.coordinates)), {
      paddingTopLeft: [65, 52], paddingBottomRight: [95, 55], animate: false,
    });
  }
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

function MarketMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [tileError, setTileError] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [view, setView] = useState<MapView>('regional');
  const viewRef = useRef<MapView>('regional');
  const connections = useRef<L.LayerGroup | null>(null);
  const destinations = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false, zoomSnap: 0.25, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Verified provider URL and local-development policy: see README.
    // No API key or account is used. Non-local hosting requires provider setup.
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://stadiamaps.com/attribution/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      label.textContent = point.name.split(',')[0].toUpperCase();
      marker.bindTooltip(label, { permanent: true, direction: index === 0 ? 'bottom' : 'right', offset: index === 0 ? [30, 0] : [12, -24] });
      const popup = document.createElement('div');
      popup.textContent = `${point.name} — ${point.role}. Representative point only; no verified facility or buyer.`;
      marker.bindPopup(popup);
    });
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      frameMap(map, viewRef.current);
    });
    observer.observe(container.current);
    frameMap(map, viewRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      connections.current = null;
      destinations.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
    const map = mapRef.current;
    if (!map) return;
    map.closePopup();
    if (view === 'regional') destinations.current?.addTo(map);
    else destinations.current?.remove();
    frameMap(map, view);
  }, [view]);

  useEffect(() => {
    if (!mapRef.current || !connections.current) return;
    if (showConnections && view === 'regional') connections.current.addTo(mapRef.current);
    else connections.current.remove();
  }, [showConnections, view]);

  return <section className="map-card panel" id="markets" aria-labelledby="map-heading">
    <div className="map-heading"><h2 id="map-heading">Logistics Overview</h2><span className="badge">SCHEMATIC · NOT VERIFIED</span></div>
    <div className="map-toolbar">
      <div className="map-view-selector" role="group" aria-label="Map view">
        <button aria-pressed={view === 'regional'} onClick={() => setView('regional')}>Regional Overview</button>
        <button aria-pressed={view === 'origin'} onClick={() => setView('origin')}>Jalisco Origin</button>
      </div>
      <div className="map-actions">
        {view === 'regional' && <button onClick={() => setShowConnections(value => !value)} aria-pressed={showConnections}>{showConnections ? 'Hide' : 'Show'} connections</button>}
        <button onClick={() => mapRef.current && frameMap(mapRef.current, view)}>Reset view ↗</button>
      </div>
    </div>
    <div className="map-stage">
      <div ref={container} className="map" role="region" aria-label={view === 'regional' ? 'Interactive regional map of Jalisco, Texas, and Illinois' : 'Interactive Jalisco regional origin map, not a verified farm location'}/>
      <div className="north-indicator" aria-hidden="true">▲<span>N</span></div>
    </div>
    {tileError && <p role="status" className="tile-warning">Map tiles could not load. Open this prototype on localhost or 127.0.0.1 with internet access. Provider rate limits may apply.</p>}
    <div className="map-legend" aria-label="Map legend"><span><i className="legend-pin origin-key" aria-hidden="true"/> Origin (Jalisco)</span>{view === 'regional' && <><span><i className="legend-pin destination-key" aria-hidden="true"/> Intended markets (Texas, Illinois)</span><span><i className="route-symbol" aria-hidden="true"/> Schematic connection</span></>}</div>
    <p className="route-disclosure">Illustrative connections — actual transport routes not verified.</p>
    <p className="map-context" aria-live="polite">{view === 'regional' ? 'Approximate regional points only · No confirmed buyers, roads, border crossings, rates, or transit times.' : 'Jalisco regional origin view · Existing approximate point only; farm coordinates and producer addresses are not verified.'}</p>
  </section>;
}

function ReadinessPanel() {
  const icons: IconName[] = ['leaf', 'box', 'dollar', 'shield'];
  return <aside className="readiness panel" id="readiness" aria-labelledby="readiness-heading"><h2 id="readiness-heading">Export Readiness</h2><ul>{data.brokerReadiness.map((item, index) => <li key={item.label}><span className="icon-ring"><Icon name={icons[index]}/></span><div><strong>{item.label}</strong><p><i className={`status-dot ${index === 3 ? 'conditional' : ''}`} aria-hidden="true"/>{item.status}</p></div></li>)}</ul><p className="readiness-note"><Icon name="info"/><span>Regional origin only · Farm coordinates and shipping routes not verified.</span></p></aside>;
}

function App() {
  return <>
    <header className="header"><a href="#overview" className="brand" aria-label="Jalisco Produce Export home"><BrandMark/><span><strong>Jalisco Produce Export</strong><small>SUPPLY · ORIGIN · LOGISTICS</small></span></a><nav aria-label="Main navigation"><a href="#overview" className="overview-link">Overview</a><a href="#supply">Products</a><a href="#markets">Logistics</a><a href="#documents">Documents</a></nav><div className="header-actions"><span className="buyer-preview"><i/>Buyer preview</span><a className="quote-button" href="#contact">Request a Quote</a></div></header>
    <main>
      <section id="overview" className="hero"><div className="hero-image" role="img" aria-label="Illustrative avocado and lime still life from the supplied design reference; not verified producer photography"/><div className="hero-content"><p className="eyebrow">MEXICO <span aria-hidden="true">⟶</span> UNITED STATES</p><h1>From Jalisco’s fields<br/>to <span>your market.</span></h1><p className="hero-copy">A clearer view of origin, supply readiness, and export planning.</p><div className="hero-stats"><div className="hero-stat"><span className="icon-ring"><Icon name="leaf"/></span><div><p>Reported harvest volume</p><span className="badge">REPORTED · UNVERIFIED</span><strong>{data.supply[0].value} <small>/ harvest</small></strong></div></div><div className="hero-stat export-stat"><span className="icon-ring"><Icon name="document"/></span><div><p>Export status</p><span className="export-status">Details pending verification</span></div></div></div></div></section>
      <div className="dashboard"><div className="logistics-layout"><MarketMap/><ReadinessPanel/></div>
        <p className="sample-note"><Icon name="info"/>Prototype · All commercial details are unverified. Reported volume is not confirmed inventory. Imagery is illustrative.</p>
        <details id="supply" className="support-panel panel"><summary>Producer, product & packaging information <span>Unverified sample data</span></summary><div className="supply-content"><div><h3>{data.product.name}</h3><p>{data.product.variety}</p><p>{data.product.note}</p><strong>{data.producer.name}</strong><p>{data.producer.region}</p><p>{data.producer.description}</p></div><div className="supply-details">{data.supply.map(item => <article key={item.label}><p>{item.label}</p><h3>{item.value}</h3><small>{item.note}</small></article>)}</div></div><p className="support-note">Volume and box count are independent placeholders. Net box weight and their relationship have not been verified.</p></details>
        <details id="documents" className="support-panel panel"><summary>Documentation & verification checklist <span>No items verified</span></summary><ul className="document-list">{data.readiness.map(item => <li key={item}><span>{item}</span><small>Pending</small></li>)}</ul><p className="support-note">Review applicable requirements with qualified trade partners once the commodity is confirmed. This checklist does not establish export eligibility.</p></details>
        <section id="contact" className="contact panel"><div><p className="eyebrow">NEXT CONVERSATION</p><h2>Contact & quotations</h2><p>{data.contact.quote}</p></div><div><strong>{data.contact.name}</strong><p>{data.contact.status}</p><span className="badge muted-badge">Quotation requests are not yet available</span></div></section>
      </div>
    </main><footer><span>Jalisco Produce Export · Buyer preview</span><span>Sample data · No commercial offer</span><a href="#overview">Back to top ↑</a></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
