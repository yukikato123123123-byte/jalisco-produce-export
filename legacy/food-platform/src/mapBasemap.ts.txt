// Public, on-demand raster tiles. No API key or account is required.
// Official usage policy: https://operations.osmfoundation.org/policies/tiles/
// Keep visible attribution, browser caching and an identifying origin Referer.
// No prefetch, offline download or proxy is enabled.
export const logisticsBasemap = {
  provider: 'OpenStreetMap',
  style: 'Standard',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  // Applies only to tile images; the site's no-referrer policy stays unchanged.
  referrerPolicy: 'origin',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
} as const;
