// Official Leaflet raster style, verified against provider docs on 2026-10-20:
// https://docs.stadiamaps.com/map-styles/alidade-smooth/
// https://docs.stadiamaps.com/authentication/
// No authentication for localhost/127.0.0.1 development, subject to rate limits.
// Hosted domains require provider authorization. No keys are included here.
export const logisticsBasemap = {
  provider: 'Stadia Maps',
  style: 'Alidade Smooth',
  url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
  maxZoom: 20,
  attribution: '&copy; <a href="https://stadiamaps.com/attribution/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
} as const;
