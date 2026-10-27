import { defaultLayers, networkCoordinates } from './gisNetwork.ts';
import type { LayerVisibility, NetworkView } from './gisNetwork.ts';
export type MapFocus = NetworkView;
type Coordinates = [number, number];
interface MapPort {
  getSize(): { x: number; y: number };
  stop(): unknown;
  invalidateSize(options: { pan: boolean }): unknown;
  fitBounds(bounds: Coordinates[], options: { paddingTopLeft: Coordinates; paddingBottomRight: Coordinates; animate: boolean; maxZoom: number }): unknown;
}
export function mapPadding(width: number, height: number): { paddingTopLeft: Coordinates; paddingBottomRight: Coordinates } {
  return {
    paddingTopLeft: [Math.min(64, width * 0.16), Math.min(56, height * 0.15)],
    paddingBottomRight: [Math.min(128, width * 0.3), Math.min(90, height * 0.24)],
  };
}
export function focusMap(map: MapPort, focus: MapFocus, animate = false, visible: LayerVisibility = defaultLayers): boolean {
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return false;
  const coordinates = networkCoordinates(visible, focus);
  if (!coordinates.length) return false;
  map.stop();
  map.fitBounds(coordinates, { ...mapPadding(size.x, size.y), animate, maxZoom: focus === 'regional' ? 7 : 10 });
  return true;
}
export function refreshMap(map: MapPort, focus: MapFocus, visible: LayerVisibility = defaultLayers): boolean {
  // Invalidate hidden-tab cached dimensions before calculating bounds.
  map.invalidateSize({ pan: false });
  return focusMap(map, focus, false, visible);
}
