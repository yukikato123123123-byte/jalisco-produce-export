import L from 'leaflet';
import { demoLocations, demoRoutes, layerDefinitions, pointCategories, routeCategories } from './gisDemoData';
import type { LayerId, PointCategory } from './gisDemoData';
import { applyLayerVisibility, clusterLocations, defaultLayers } from './gisNetwork';
import type { LayerVisibility } from './gisNetwork';
import { detailElement, locationDetails, routeDetails } from './gisDetails';
import { translate } from './i18n';
import type { Language } from './presentation';
import { pointSymbolSvg, routeAccentSvg, routeDecoration } from './gisSymbols';
import { markerHierarchy, routePaint } from './gisDepth';

// The map, tile layer, route geometry and layer groups survive tab/language
// changes. Only point clustering is recomputed at zoom changes or filtering.
export function createGisRenderer(map: L.Map, initialLanguage: Language) {
  let language = initialLanguage;
  let visibility = { ...defaultLayers };
  const groups = Object.fromEntries(layerDefinitions.map(({ id }) => [id, L.layerGroup()])) as Record<LayerId, L.LayerGroup>;
  let pointLabels: { marker: L.Marker; title: () => string }[] = [];
  const routePaths: { path: L.Polyline; hit: L.Polyline; title: () => string }[] = [];
  let pointSignature: string | undefined;
  const t = (value: string) => translate(value, language);
  const depthPane = map.createPane('gis-route-depth');
  depthPane.style.zIndex = '340';
  depthPane.style.pointerEvents = 'none';
  depthPane.style.transform = 'translate(0, 2px)';
  map.createPane('gis-routes').style.zIndex = '350';
  for (const route of demoRoutes) {
    const style = routeCategories[route.category];
    const paint = routePaint(route.category);
    const shadow = L.polyline(route.coordinates, paint.shadow).addTo(groups.routes);
    const path = L.polyline(route.coordinates, paint.primary).addTo(groups.routes);
    L.polyline(route.coordinates, paint.highlight).addTo(groups.routes);
    const hit = L.polyline(route.coordinates, paint.hit).addTo(groups.routes);
    if (style.decoration) {
      const accent = routeDecoration(route);
      L.marker(accent.coordinates, { pane: 'gis-routes', interactive: false, keyboard: false, icon: L.divIcon({
        className: `gis-route-accent gis-route-accent-${style.decoration}`,
        html: `<span aria-hidden="true" style="color:${style.color};transform:rotate(${style.decoration === 'arrow' ? accent.angle : 0}deg)">${routeAccentSvg(style.decoration)}</span>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      }) }).addTo(groups.routes);
    }
    const title = () => `${route.id} · ${route.name[language]} · ${t('DEMO / SIMULATED')}`;
    hit.bindPopup(() => detailElement(routeDetails(route, language)), { maxWidth: 360, maxHeight: 330, autoPanPadding: [24, 48] });
    hit.bindTooltip(title());
    hit.on('popupopen', () => { path.setStyle({ weight: 5 }); shadow.setStyle({ weight: 8 }); });
    hit.on('popupclose', () => { path.setStyle({ weight: paint.primary.weight }); shadow.setStyle({ weight: paint.shadow.weight }); });
    path.on('add', () => {
      const element = path.getElement();
      element?.setAttribute('tabindex', '0');
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', title());
      element?.addEventListener('keydown', event => {
        if (event instanceof KeyboardEvent && ['Enter', ' '].includes(event.key)) { event.preventDefault(); hit.openPopup(); }
      });
    });
    routePaths.push({ path, hit, title });
  }

  function pointTitle(marker: L.Marker, title: string) {
    marker.options.title = title;
    marker.options.alt = title;
    marker.getElement()?.setAttribute('title', title);
    marker.getElement()?.setAttribute('aria-label', title);
    marker.setTooltipContent(title);
  }
  function drawPoints() {
    const points = demoLocations.filter(point => visibility[point.category]);
    const clusters = clusterLocations(points, map.getZoom());
    const signature = clusters.map(cluster => `${cluster.id}:${cluster.points.map(point => point.id).join(',')}`).join('|');
    if (signature === pointSignature) return;
    pointSignature = signature;
    for (const category of Object.keys(pointCategories) as PointCategory[]) groups[category].clearLayers();
    pointLabels = [];
    for (const cluster of clusters) {
      const point = cluster.points[0];
      const category = pointCategories[point.category];
      const multiple = cluster.points.length > 1;
      const mixed = cluster.points.some(member => member.category !== point.category);
      const hierarchy = markerHierarchy(cluster.points);
      const clusterLabel = mixed ? 'Demo locations' : category.label;
      const title = () => `${multiple ? `${cluster.points.length} · ${t(clusterLabel)} · ${t('Select cluster to expand')}` : `${point.name[language]} · ${point.id}`} · ${hierarchy.origin ? `${t('Demo origin reference')} · ` : ''}${t('DEMO / SIMULATED')}`;
      // Icon markup uses the same internal SVG paths and palette as the legend.
      const marker = L.marker(cluster.coordinates, { keyboard: true, zIndexOffset: hierarchy.origin ? 160 : hierarchy.border ? 80 : 0, title: title(), alt: title(), icon: L.divIcon({
        className: `gis-marker gis-${point.category}${multiple ? ' gis-cluster' : ''}${mixed ? ' gis-mixed' : ''}${hierarchy.origin ? ' gis-demo-origin' : ''}${hierarchy.border ? ' gis-border-point' : ''}`,
        html: `<span style="--marker-color:${category.color};--marker-background:${category.background}" aria-hidden="true">${multiple ? cluster.points.length : pointSymbolSvg(point.category)}</span>`,
        iconSize: [44, 44], iconAnchor: [22, 34], popupAnchor: [0, -30],
      }) }).addTo(groups[point.category]);
      marker.bindTooltip(title(), { direction: 'top', offset: [0, -30] });
      if (multiple) {
        marker.on('click', () => map.fitBounds(cluster.points.map(member => member.coordinates), { padding: [50, 50], maxZoom: Math.min(map.getZoom() + 2, 16), animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
      } else {
        marker.bindPopup(() => detailElement(locationDetails(point, language)), { maxWidth: 360, maxHeight: 330, autoPanPadding: [24, 48] });
        marker.on('popupopen', () => marker.getElement()?.classList.add('gis-selected'));
        marker.on('popupclose', () => marker.getElement()?.classList.remove('gis-selected'));
      }
      pointLabels.push({ marker, title });
    }
  }
  function setVisibility(next: LayerVisibility) {
    visibility = { ...next };
    drawPoints();
    applyLayerVisibility(map, groups, visibility);
  }
  function setLanguage(next: Language) {
    language = next;
    pointLabels.forEach(({ marker, title }) => {
      pointTitle(marker, title());
      if (marker.isPopupOpen()) marker.getPopup()?.update();
    });
    routePaths.forEach(({ path, hit, title }) => {
      hit.setTooltipContent(title());
      path.getElement()?.setAttribute('aria-label', title());
      if (hit.isPopupOpen()) hit.getPopup()?.update();
    });
  }
  map.on('zoomend', drawPoints);
  setVisibility(visibility);
  return { setVisibility, setLanguage, destroy() { map.off('zoomend', drawPoints); Object.values(groups).forEach(group => group.remove()); } };
}
