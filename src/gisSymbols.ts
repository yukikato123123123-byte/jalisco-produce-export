import type { Coordinate, DemoRoute, PointCategory, RouteCategory } from './gisDemoData.ts';

// Shared presentation tokens only. The spatial demo records remain unchanged.
export const pointCategories: Record<PointCategory, { label: string; color: string; background: string; paths: string[] }> = {
  production: { label: 'Production Sites', color: '#28754e', background: '#e2f1e4', paths: ['M12 21V10', 'M12 15C6 15 3 11 4 5c6 0 9 4 8 10Z', 'M12 11c0-5 3-8 8-8 1 5-2 9-8 10', 'm7 9 5 6m5-8-5 5'] },
  packing: { label: 'Collection & Packing', color: '#956117', background: '#fff0d3', paths: ['m3 9 9-5 9 5v12H3Z', 'M7 21V11h10v10', 'M7 15h10M7 18h10', 'M10 7h4'] },
  logistics: { label: 'Logistics & Cold Chain', color: '#087d80', background: '#ddf1ee', paths: ['M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', 'm9 5 3 3 3-3m-6 14 3-3 3 3', 'm4 11 4-1-1-4m10 12-1-4 4-1', 'm7 18 1-4-4-1m16-2-4-1 1-4'] },
  market: { label: 'US Markets & Distribution', color: '#7553a5', background: '#eee7f8', paths: ['M4 11v10h16V11', 'm3 7 2-4h14l2 4v2c0 3-4 3-4 0 0 3-5 3-5 0 0 3-5 3-5 0 0 3-4 3-4 0Z', 'M3 7h18M8 21v-6h4v6m4-6h1v2h-1Z'] },
};
export const routeCategories: Record<RouteCategory, { label: string; color: string; dashArray?: string; decoration?: 'border' | 'arrow' }> = {
  collection: { label: 'Local collection', color: '#28754e', dashArray: '2 7' },
  refrigerated: { label: 'Refrigerated corridor', color: '#087d80' },
  border: { label: 'Border scenario', color: '#956117', dashArray: '9 5', decoration: 'border' },
  distribution: { label: 'Market distribution', color: '#7553a5', dashArray: '14 5 2 5', decoration: 'arrow' },
};
export const routeAccentPaths = {
  border: ['M11 3v18m3-18v18', 'M3 12h5m-3-3 3 3-3 3m12-3h5m-3-3 3 3-3 3'],
  arrow: ['m7 6 7 6-7 6m7-6h-4'],
};
const svg = (paths: string[], viewBox: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map(path => `<path d="${path}"/>`).join('')}</svg>`;
export const pointSymbolSvg = (category: PointCategory) => svg(pointCategories[category].paths, '0 0 24 24');
export const routeAccentSvg = (decoration: 'border' | 'arrow') => svg(routeAccentPaths[decoration], '0 0 24 24');
// Place presentation accents on an existing segment in Mercator space. This
// never changes route vertices, connectivity, or any distance/transit field.
export function routeDecoration(route: DemoRoute): { coordinates: Coordinate; angle: number } {
  const index = Math.max(1, Math.floor(route.coordinates.length / 2));
  const [a, b] = [route.coordinates[index - 1], route.coordinates[index]];
  const projectY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;
  const ay = projectY(a[0]); const by = projectY(b[0]);
  return { coordinates: [Math.atan(Math.exp((ay + by) / 2 * Math.PI / 180)) * 360 / Math.PI - 90, (a[1] + b[1]) / 2], angle: Math.atan2(ay - by, b[1] - a[1]) * 180 / Math.PI };
}
