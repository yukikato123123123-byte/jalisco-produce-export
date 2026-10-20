# Jalisco Produce Export

Eduardo's agricultural export marketplace prototype for U.S. produce brokers exploring supply from Jalisco, Mexico.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For production output:

```sh
npm run lint
npm run build
npm run preview
```

## Stack and structure

React, TypeScript, Vite, and Leaflet. `src/main.tsx` contains the interface and map; `src/styles.css` provides responsive styling. All illustrative commercial data and representative map points live in `src/sampleData.ts` for replacement with information verified by Eduardo.

## Data and map limitations

All commercial content is unverified sample data, including the illustrative avocado listing, 10 tonnes, and 486 boxes. Volume and box count are independent placeholders, not verified packaging specifications. Readiness items are discussion prompts, not legal guidance, confirmed requirements, or certification claims.

The interactive map uses Stadia Maps **Alidade Smooth Dark** raster tiles with visible Stadia Maps, OpenMapTiles, and OpenStreetMap attribution. The provider's [style documentation](https://docs.stadiamaps.com/map-styles/alidade-smooth-dark/) specifies the tile URL and attribution. [Authentication documentation](https://docs.stadiamaps.com/authentication/) permits local browser development on `localhost` or `127.0.0.1` without an account or API key, subject to strict rate limits. The [provider FAQ](https://stadiamaps.com/faqs/) permits development/testing and demonstration use; commercial production has different licensing requirements. Open Vite using its localhost URL. Non-local hosts, including LAN addresses and forwarded preview domains, require provider authentication/setup; this prototype does not configure it. Do not deploy this configuration as an unrestricted production tile service. No subscription or account was created.

Internet access is required for tiles; an error message appears when tiles fail. Regional points are geographic context, not farm, warehouse, buyer, or delivery locations. Regional Overview fits all three existing points; Jalisco Origin centers on the existing approximate origin point at zoom 8, hiding destinations and connections. View switching and resize handling reuse the same Leaflet map with cleanup on unmount. Markers support focus and geographic-detail popups. Connections use 65 samples of quadratic Bezier curves in Web Mercator and existing endpoints, rendered as layered Leaflet polylines. Control points are decorative geometry, not logistics waypoints. No road routing, distance, border crossing, rate, transit time, buyer, carrier, or certification is established.

## Reference layout and imagery

The compact header, photographic hero, logistics map, and adjacent readiness panel follow the supplied dashboard design. On narrow screens they stack vertically, with map controls wrapping and readable status items. Product and documentation details remain available in expandable sections; quotation navigation leads to the pending-contact section and does not submit a request.

`src/assets/design-reference.png` is a local copy of the user-supplied reference. CSS crops its photographic hero region; it is not original producer photography or evidence of the sample product. This retains the exact supplied still life without adding a remote image service. A separate original-resolution crop photograph can replace it later. No farm boundary polygon is drawn because the project contains only a regional point, not verified boundary data.

Contact and quotation details are placeholders. There is no submission form, backend, authentication, payment system, database, analytics, paid API, or API key. Nothing is deployed.
