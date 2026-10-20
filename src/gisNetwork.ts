import { demoLocations, demoRoutes, layerDefinitions } from './gisDemoData.ts';
import type { Coordinate, DemoLocation, DemoRoute, LayerId } from './gisDemoData.ts';
export type LayerVisibility = Record<LayerId, boolean>;
export const defaultLayers: LayerVisibility = { production: true, packing: true, logistics: true, market: true, routes: true };
export type NetworkView = 'regional' | 'origin' | 'border' | 'us' | 'texas' | 'illinois';
export function displayedNetwork(visible: LayerVisibility): { locations: DemoLocation[]; routes: DemoRoute[] } {
  return { locations: demoLocations.filter(point => visible[point.category]), routes: visible.routes ? demoRoutes : [] };
}
export function layerCount(id: LayerId): number {
  return id === 'routes' ? demoRoutes.length : demoLocations.filter(point => point.category === id).length;
}
export function networkCoordinates(visible: LayerVisibility = defaultLayers, view: NetworkView = 'regional'): Coordinate[] {
  const network = displayedNetwork(visible);
  const all = [...network.locations.map(point => point.coordinates), ...network.routes.flatMap(route => route.coordinates)];
  return all.filter(([lat, lon]) => {
    if (view === 'origin') return lat < 22 && lon < -101.5;
    if (view === 'border') return lat >= 25 && lat <= 28.5 && lon >= -102 && lon <= -98;
    if (view === 'us') return lat >= 27.5;
    if (view === 'texas') return lat >= 27.5 && lat <= 33.5 && lon >= -100 && lon <= -94;
    if (view === 'illinois') return lat >= 39.5 && lon >= -90.5 && lon <= -87;
    return true;
  });
}
// Web Mercator grid clustering across all currently enabled point layers. Stable cells prevent marker
// piles at overview zoom; zooming to 13+ exposes individual features. No package.
export function clusterLocations(points: DemoLocation[], zoom: number): { id: string; coordinates: Coordinate; points: DemoLocation[] }[] {
  const cells = new Map<string, DemoLocation[]>();
  const scale = 256 * 2 ** zoom;
  for (const point of points) {
    const [lat, lon] = point.coordinates;
    const sin = Math.sin(lat * Math.PI / 180);
    const x = (lon + 180) / 360 * scale;
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const key = zoom >= 13 ? point.id : `${Math.floor(x / 64)}:${Math.floor(y / 64)}`;
    const group = cells.get(key) ?? [];
    group.push(point);
    cells.set(key, group);
  }
  return [...cells].map(([id, members]) => ({ id, points: members, coordinates: [members.reduce((sum, point) => sum + point.coordinates[0], 0) / members.length, members.reduce((sum, point) => sum + point.coordinates[1], 0) / members.length] }));
}
interface LayerPort { addTo(map: unknown): unknown; remove(): unknown; }
// Used by the actual Leaflet controls and by controller tests.
export function applyLayerVisibility(map: unknown, groups: Record<LayerId, LayerPort>, visibility: LayerVisibility) {
  for (const { id } of layerDefinitions) {
    if (visibility[id]) groups[id].addTo(map);
    else groups[id].remove();
  }
}
