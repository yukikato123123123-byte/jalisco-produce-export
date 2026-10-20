import { sampleData } from './sampleData.ts';
export type MapFocus = 'regional' | 'origin' | 'texas' | 'illinois';
type Coordinates = [number, number];
interface MapPort {
  getSize(): { x: number; y: number };
  stop(): unknown;
  invalidateSize(options: { pan: boolean }): unknown;
  fitBounds(bounds: Coordinates[], options: { paddingTopLeft: Coordinates; paddingBottomRight: Coordinates; animate: boolean }): unknown;
  flyTo(center: Coordinates, zoom: number, options: { animate: boolean; duration: number }): unknown;
}
export function mapPadding(width: number, height: number): { paddingTopLeft: Coordinates; paddingBottomRight: Coordinates } {
  return {
    paddingTopLeft: [Math.min(64, width * 0.16), Math.min(56, height * 0.15)],
    paddingBottomRight: [Math.min(128, width * 0.3), Math.min(90, height * 0.24)],
  };
}
export function focusMap(map: MapPort, focus: MapFocus, animate = false): boolean {
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return false;
  map.stop();
  if (focus === 'regional') {
    map.fitBounds(sampleData.locations.map(point => point.coordinates), { ...mapPadding(size.x, size.y), animate });
  } else {
    const index = focus === 'origin' ? 0 : focus === 'texas' ? 1 : 2;
    map.flyTo(sampleData.locations[index].coordinates, focus === 'origin' ? 8 : 6, { animate, duration: 0.8 });
  }
  return true;
}
export function refreshMap(map: MapPort, focus: MapFocus): boolean {
  // The caller checks DOM visibility. Invalidate before reading Leaflet's cached
  // size: a map first mounted in a hidden tab may still report a zero size.
  map.invalidateSize({ pan: false });
  return focusMap(map, focus);
}
