import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import L from 'leaflet';
import { Localized, useLanguage } from '../localization';
import { translate } from '../i18n';
import { gisNotice, layerDefinitions, pointCategories } from '../gisDemoData';
import { defaultLayers, displayedNetwork, layerCount, networkCoordinates } from '../gisNetwork';
import type { LayerVisibility } from '../gisNetwork';
import { createGisRenderer } from '../gisLeaflet';
import { focusMap, refreshMap } from '../mapBehavior';
import type { MapFocus } from '../mapBehavior';
import { MapLegend } from './MapLegend';
import { logisticsBasemap } from '../mapBasemap';

const quickViews: { id: MapFocus; label: string }[] = [
  { id: 'origin', label: 'Jalisco' }, { id: 'border', label: 'Border Corridor' },
  { id: 'us', label: 'US Markets' }, { id: 'regional', label: 'Full Network' },
];
export function MarketMap({ active }: { active: boolean }) {
  const { language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<ReturnType<typeof createGisRenderer> | null>(null);
  const [tileError, setTileError] = useState(false);
  const [visible, setVisible] = useState<LayerVisibility>({ ...defaultLayers });
  const visibilityRef = useRef<LayerVisibility>({ ...defaultLayers });
  const [focus, setFocus] = useState<MapFocus>('regional');
  const focusRef = useRef<MapFocus>('regional');
  const network = displayedNetwork(visible);
  const emptyView = networkCoordinates(visible, focus).length === 0;

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { center: [30, -98], zoom: 4, scrollWheelZoom: true, touchZoom: true, zoomSnap: 0.25, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Genuine light raster tiles; no CSS color conversion or added service.
    let tileFailures = 0;
    L.tileLayer(logisticsBasemap.url, { maxZoom: logisticsBasemap.maxZoom, attribution: logisticsBasemap.attribution })
      .on('loading', () => { tileFailures = 0; })
      .on('tileerror', () => { tileFailures += 1; setTileError(true); })
      .on('load', () => setTileError(tileFailures > 0)).addTo(map);
    rendererRef.current = createGisRenderer(map, 'en');
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (container.current?.clientWidth && container.current.clientHeight) refreshMap(map, focusRef.current, visibilityRef.current);
      });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      rendererRef.current?.destroy(); rendererRef.current = null;
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    visibilityRef.current = visible;
    rendererRef.current?.setVisibility(visible);
    if (mapRef.current && container.current?.clientWidth) focusMap(mapRef.current, focusRef.current, false, visible);
  }, [visible]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      if (mapRef.current && container.current?.clientWidth) refreshMap(mapRef.current, focusRef.current, visibilityRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    rendererRef.current?.setLanguage(language);
    for (const [selector, text] of [['.leaflet-control-zoom-in', 'Zoom in'], ['.leaflet-control-zoom-out', 'Zoom out']]) {
      const control = mapRef.current?.getContainer().querySelector(selector);
      control?.setAttribute('title', translate(text, language));
      control?.setAttribute('aria-label', translate(text, language));
    }
  }, [language]);

  function selectFocus(next: MapFocus) {
    focusRef.current = next;
    setFocus(next);
    if (mapRef.current) focusMap(mapRef.current, next, !window.matchMedia('(prefers-reduced-motion: reduce)').matches, visibilityRef.current);
  }
  return <Localized><section className="map-card panel gis-card" id="markets" aria-labelledby="map-heading">
    <div className="map-heading"><div><p className="eyebrow">ILLUSTRATIVE LOGISTICS</p><h2 id="map-heading">Logistics Overview</h2></div><div className="gis-summary" aria-live="polite"><span><strong>{network.locations.length}</strong> Displayed demo locations</span><span><strong>{network.routes.length}</strong> Displayed route segments</span></div></div>
    <p className="gis-notice">{gisNotice}</p>
    <div className="gis-layout">
      <aside className="gis-sidebar"><details open className="gis-layer-panel"><summary>GIS layers</summary><fieldset><legend>Layer visibility</legend>{layerDefinitions.map(layer => <label key={layer.id} data-active={visible[layer.id]} style={{ '--layer-color': layer.id === 'routes' ? '#42664e' : pointCategories[layer.id].color, '--layer-background': layer.id === 'routes' ? '#edf1e6' : pointCategories[layer.id].background } as CSSProperties}><input type="checkbox" checked={visible[layer.id]} onChange={() => setVisible(previous => ({ ...previous, [layer.id]: !previous[layer.id] }))}/><span>{layer.label}</span><strong>{layerCount(layer.id)}</strong></label>)}</fieldset><button className="gis-reset-layers" onClick={() => { setVisible({ ...defaultLayers }); selectFocus('regional'); }}>Restore all layers</button></details>
        <MapLegend visible={visible} language={language}/>
      </aside>
      <div className="gis-map-column"><div className="map-toolbar gis-toolbar"><div className="map-view-selector" role="group" aria-label="Map view">{quickViews.map(view => <button key={view.id} aria-pressed={focus === view.id} onClick={() => selectFocus(view.id)}>{view.label}</button>)}</div><button className="gis-overview-button" onClick={() => selectFocus('regional')}>Show Full Route</button></div>
        <div className="destination-shortcuts" role="group" aria-label="Destination shortcuts"><button aria-pressed={focus === 'texas'} onClick={() => selectFocus('texas')}>Focus on Texas</button><button aria-pressed={focus === 'illinois'} onClick={() => selectFocus('illinois')}>Focus on Illinois</button><span>Clusters expand on selection. Select a point or route for demo details.</span></div>
        <div className="map-stage"><div ref={container} className="map" role="region" aria-label="Interactive demo logistics network from Jalisco to Texas and Illinois"/><div className="north-indicator" aria-hidden="true">▲<span>N</span></div></div>
        {emptyView && <p role="status" className="gis-empty">No visible features in this view. Enable layers or choose Full Network.</p>}
        {tileError && <p role="status" className="tile-warning">Basemap unavailable. Check your connection and open localhost or 127.0.0.1. Hosted domains require provider authorization; rate limits may apply. GIS layers remain available.</p>}
        <p className="map-context">Generalized corridor geometry, not a road-routing result or navigation directions.</p>
      </div>
    </div><p className="gis-disclaimer">Fictional facilities and buyers. No verified carrier route, quote, customs clearance, or export approval.</p>
  </section></Localized>;
}
