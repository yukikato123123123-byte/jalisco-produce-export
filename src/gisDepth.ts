import { demoRoutes } from './gisDemoData.ts';
import type { DemoLocation, RouteCategory } from './gisDemoData.ts';
import { routeCategories } from './gisSymbols.ts';

// A reference within the fictional network, never a coordinate for Eduardo's
// farm. All production sites remain fictional; this is the first collection leg.
export const demoOriginId = demoRoutes.find(route => route.category === 'collection')?.originId;
export function markerHierarchy(points: DemoLocation[]) {
  return { origin: points.some(point => point.id === demoOriginId), border: points.some(point => point.id === 'H06' || point.id === 'H07') };
}
// Pixel styling only: all four strokes receive the exact same source geometry.
// The transparent hit stroke is the sole pointer/popup surface. Primary paths
// remain keyboard-focusable through the renderer's existing Enter/Space binding.
export function routePaint(category: RouteCategory) {
  const style = routeCategories[category];
  const shared = { dashArray: style.dashArray, lineCap: 'round' as const, lineJoin: 'round' as const };
  return {
    shadow: { ...shared, pane: 'gis-route-depth', color: '#294536', weight: 7, opacity: 0.16, interactive: false },
    primary: { ...shared, pane: 'gis-routes', color: style.color, weight: 3.5, opacity: 1, interactive: false },
    highlight: { ...shared, pane: 'gis-routes', color: '#ffffff', weight: 0.8, opacity: 0.28, interactive: false },
    hit: { pane: 'gis-routes', color: style.color, weight: 14, opacity: 0, interactive: true },
  };
}
