# Jalisco Produce Export · Fresh nopal

A bilingual B2B producer-dossier and logistics-map prototype for Eduardo, a fresh nopal producer in El Grullo, Jalisco, Mexico, exploring Texas and Illinois markets. This is a presentation and inquiry demonstration, not an operational export marketplace or a verified supplier/shipping offer.

## Workspace and GitHub reconciliation

At the start of the nopal migration review, the GitHub default branch was `main`, and both local HEAD and `origin/main` were at `ea3649d` (the earlier B2B sample-workflow commit). The later dossier, four-tab UI, bilingual localization, map shortcuts, and focused tests were present in this workspace as modified/untracked files, rather than in another branch or on GitHub `main`. That working implementation has been preserved and extended in this source version. Use the repository history and `git status` for current commit and delivery state. No public deployment is part of this update.

## Reported facts and evidence boundaries

According to the current producer information supplied in the brief:

- Product: **fresh nopal**.
- Producer location: **El Grullo, Jalisco, Mexico**. No exact farm location is provided.
- Latest reported harvest: **486 cartons and slightly more than 10 metric tonnes**.
- Intended U.S. markets: **Texas and Illinois**.
- Eduardo reports contacts for refrigerated transport and prospective customs brokers.

These are producer-reported facts, not independently audited commercial evidence. The latest harvest is not a recurring-capacity or stock-availability commitment. There is no exact total weight or net carton weight, so the application does not compute a per-carton average, an exact harvest total, or a packing reconciliation. The numeric 10 in the model is strictly a lower bound, not an exact weight.

Variety, grade, carton weights/dimensions, packaging standard, pallet pattern, season, recurring capacity, prices, buyers, freight quotes, delivery times, routes, border crossings, documentation, certification, phytosanitary clearance, and legal export/import eligibility remain **Pending confirmation** or **Evidence required**. Unknown numeric values use `null`, never zero or synthetic estimates. Earlier fictional product/pricing/transport examples have been removed from current commercial data rather than reused for nopal. The actual producer/commercial model contains no simulated monetary or transit estimates. Separately, `src/demoData.ts` now supplies explicitly fictional chart examples; these never populate producer pricing, logistics records, or inquiry previews.

## Local setup and checks

Stack: React, TypeScript, Vite, Leaflet, CSS, and responsive SVG/CSS graphics. No additional packages were installed.

Requires Node.js **22.12+** and npm:

```sh
npm ci
npm run dev
```

Open Vite's printed localhost URL. Available checks:

```sh
npm run lint
npm test
npm run build
npm run preview
```

`build` runs TypeScript checking (`tsc --noEmit`) and the Vite production build. `test` uses Node's built-in test API and TypeScript stripping with the already-installed dependencies. Chart render tests use Vite's TSX transform and React server rendering with HTTP/WebSocket listening disabled; they do not open or simulate a browser.

## Four-view presentation

Producer is the default. Persistent semantic tab buttons support click, Arrow keys, Home, and End, with selected state, roving focus, and linked tab panels. Panels stay mounted while hidden so the map and form retain their state. No router or separate HTML pages were added.

- **Producer / Productor:** reported harvest and location, visible **Supply & Market Overview** graphics, producer dossier, commercial review states, and packaging summary.
- **Logistics / Logística:** existing interactive regional map, origin view, destination shortcuts, full-route reset, and target-market planning cards. Reported transport/customs contacts are distinguished from actual appointments, quotes, and bookings.
- **Commercial / Comercial:** quotation information still needed, unknown price fields, packaging/specification review, and the local demo inquiry.
- **Readiness / Preparación:** compact review statuses and expandable supporting-evidence requirements, without claims of completion or eligibility.

### Visible Supply & Market Overview

`src/components/SupplyMarketOverview.tsx` is mounted directly in the default Producer panel, above the dossier; it is not inside a disclosure or a hidden chart-only page. Four responsive figures are rendered, with evidence and fictional scenarios visually separated:

1. **Harvest & cartons:** 486 cartons and `>10` metric tonnes, with the original “slightly more than 10 metric tonnes” wording and producer-reported attribution. Exact total and carton net weights remain unknown; no conversion is calculated.
2. **Export-readiness review:** packaging, pricing, refrigerated transport, export documentation, and customs arrangements use explicit Reported, Pending Verification, or Demo Only states. Reported contacts do not imply verified appointments, documentation, or clearance. No percentage or legal/export approval is shown.
3. **Illustrative price comparison:** zero-based horizontal bars compare Texas **1.20 USD/kg** and Illinois **1.55 USD/kg**, entirely invented. Assumptions specify the same unspecified grade/packaging, exclude freight/duties/taxes/fees, and disclaim a landed-cost calculation.
4. **Illustrative logistics comparison:** independent zero-based plots show fictional estimated elapsed transit (**3 vs 5 days**) and simulated refrigerated transport budgets (**3,200 vs 5,100 USD per vehicle**). These represent one hypothetical vehicle with unspecified capacity, temperature, collection point, and address. Customs, inspections, duties, taxes, and delays are excluded. No carrier, border crossing, or route is selected.

The demo section and each fictional figure display **DEMO DATA — NOT A REAL OFFER OR QUOTE**. These values are arbitrary UI examples, not researched market rates or carrier estimates. Price and logistics examples are independent and cannot be combined into a quotation. All chart headings, units, tooltips, review notes, assumptions, and disclaimers have English/Spanish presentation text.

Charts use visible numeric axes, direct destination labels, contrasting green/terracotta bars, SVG titles/descriptions, and full textual value equivalents. Layouts stack on smaller screens. The visual system uses deep cactus green, warm cream, sand, serif editorial headings, and original local botanical nopal artwork. No chart, font, or image dependencies were added.

## Data and localization architecture

- `src/demoData.ts`: isolated fictional price/logistics values, axes, assumptions, and mandatory disclaimers; never merged into producer data.
- `src/sampleData.ts`: typed producer/product, approximate harvest, unknown specifications, commercial/logistics review, chart models, readiness states, and existing map coordinates. `sampleData.overview.harvest` references the shared supply object.
- `src/components/`: dossier, packaging, commercial planning, inquiry, reusable status badge, and visible overview graphics.
- `src/i18n.ts`: centralized English/Spanish text, including chart labels/descriptions, facts, pending states, map disclosures, form options, errors, and accessibility text.
- `src/localization.tsx` and `src/localizeNode.ts`: React language state and presentation translation, without translating user entries or changing canonical form values.
- `src/presentation.ts`: tab keyboard behavior and safe preference persistence.
- `src/components/MarketMap.tsx`: Logistics-only Leaflet lifecycle and map controls.
- `src/gisDemoData.ts`: typed, isolated fictional spatial network.
- `src/gisNetwork.ts`: filtering, counts, bounds, clustering, and layer visibility controller.
- `src/gisDetails.ts`: bilingual popup models and safe DOM presentation.
- `src/gisLeaflet.ts`: retained Leaflet layer/marker/route rendering and interaction bindings.
- `src/mapBehavior.ts`: responsive, filtered network focus/refresh controller.

English is the first-use default. EN/ES switches instantly and updates document language/title. Only the language preference is stored under `jalisco-produce-export.language`; blocked storage is handled gracefully. Inquiry values remain in memory only. Tests check coverage of static interface phrases and centralized descriptions in both languages.

The verification-state model retains `sample`, `pending`, `verified`, and `quoted`. Producer-reported fields carry explicit report labels while supporting evidence remains pending. The map's route is illustrative. No field claims verified evidence or an actual quotation.

## Expanded demo GIS — Logistics tab only

Selecting **Logistics / Logística** opens the expanded Leaflet map inside the existing Logistics panel. The Producer, Logistics, Commercial, and Readiness tabs retain their names and order. Producer remains the initial view. The header, language selector, supply overview, charts, commercial/readiness content, and client-side inquiry are preserved. The App component's navigation/layout code is unchanged; the previous inline map implementation has been extracted into `src/components/MarketMap.tsx` and extended.

### Isolated spatial dataset

`src/gisDemoData.ts` contains **42 fictional point features**:

- 12 production zones in Jalisco.
- 6 collection/packing/consolidation nodes in Jalisco.
- 12 cold-chain/logistics observation points across Mexico and the U.S.
- 12 market/distribution examples: 6 in Texas and 6 in Illinois.

Every feature has a stable ID, category, latitude/longitude, region, bilingual name/description, simulated attributes, and `DEMO / SIMULATED` provenance. These locations do **not** locate Eduardo's farm, real project facilities, actual buyers, or operational cold-chain coverage. Cultivated areas, seasonal quantities, handling capacities, demand bands, harvest windows, packaging states, and temperature observations are fictional. Temperatures are neither dated sensor observations nor commodity-handling recommendations. This dataset never populates `sampleData.ts`, producer harvest figures, inquiry previews, or the separate demo comparison charts.

There are **20 named, connected multi-stop route segments**. Six collection scenarios pair the twelve production zones with the six packing nodes. Consolidation links lead through Guadalajara, the Jalisco highlands, San Luis Potosí, Saltillo/Monterrey, a fictional Nuevo Laredo–Laredo border-region scenario, Texas branches, and a Midwest/Chicago-region distribution chain. Intermediate stop IDs and corridor coordinates connect **all 42 points into one network**. Geographic place names indicate approximate scenario regions, not verified facilities or an approved border-crossing plan.

Routes are generalized polylines, **not road-matched navigation or carrier routes**. No routing service or road-distance calculation is used. Route distance and transit duration remain `null` and display “Not supplied”; they are never inferred from line length or borrowed from chart examples. The previous three representative `sampleData.locations` records remain legacy data and no longer drive the map.

### Layers, controls, and interactions

The desktop Logistics map occupies about 80% of its map/layer workspace, with a compact left sidebar and a taller geographic viewport. Mobile layouts stack the sidebar and map; the layer panel can be collapsed with its native summary control. The layout changes are scoped to Logistics.

Five independently controlled layers show Production Sites, Collection & Packing, Logistics & Cold Chain, US Markets & Distribution, and Transport Routes. Counts indicate total records per layer; the summary reports displayed locations and named route segments, not the number of rendered cluster icons or individual line strokes. Hiding a point layer hides its markers; visible routes can still pass through those coordinates. The legend distinguishes point symbols and local collection, refrigerated, border-scenario, and distribution routes.

Jalisco, Border Corridor, US Markets, and Full Network fit bounds derived from the enabled network's points **and route vertices**. Texas/Illinois shortcuts and Show Full Route remain available. Full Network/Show Full Route respect the current layer selection; Restore all layers reenables every layer and restores the overview. Views without enabled features show an explicit empty-state notice instead of fitting invalid bounds.

The same Leaflet instance, basemap, route geometry, and layer groups survive tab/language changes. Hidden-tab reveal and ResizeObserver handling invalidate cached dimensions before reframing; zoom and pan are preserved as ordinary Leaflet interactions between refreshes. Wheel zoom, touch pinch, +/− controls, attribution, and reduced-motion-aware view changes remain. Grid clustering aggregates nearby enabled points at overview zoom; selecting a cluster zooms into its members. Individual records are exposed at zoom 13 or higher. This avoids a new clustering dependency.

Selecting an individual marker opens its ID, category, region, simulated attributes, and demo status. Selecting a route opens endpoints, intermediate stops, category, unsupplied distance/time fields, and warnings. Routes have a wider touch hit area and keyboard Enter/Space activation. Popup data uses DOM `textContent`, not data-interpolated HTML. Open popup content, tooltips, marker accessibility names, controls, legends, warnings, and labels update in English/Spanish without recreating the map.

A persistent notice reads **DEMO DATA — SIMULATED LOCATIONS & ROUTES**, or **DATOS DE DEMOSTRACIÓN — UBICACIONES Y RUTAS SIMULADAS**. Neither the routes nor the observations imply export clearance, legal compliance, appointments, real prices, or confirmed buyers.

Tiles remain **Stadia Maps Alidade Smooth Dark**, with visible Stadia Maps, OpenMapTiles, and OpenStreetMap credits. The [style documentation](https://docs.stadiamaps.com/map-styles/alidade-smooth-dark/) gives the tile URL and attribution. [Authentication documentation](https://docs.stadiamaps.com/authentication/) permits key-free local browser development on localhost/127.0.0.1, subject to rate limits. The [provider FAQ](https://stadiamaps.com/faqs/) describes development/demo use and commercial restrictions. Non-local hosting needs provider authentication/licensing review; no key, account, subscription, or public hosting configuration was added. Internet access is required for tiles.

## Imagery

`src/assets/nopal-illustration.svg` is local illustrative artwork, not a photograph of Eduardo's produce or farm. Packaging uses a dimension-free neutral carton schematic. The earlier user-supplied design-reference asset is retained unused; it is no longer referenced by application styles or emitted as a displayed asset. No external image service was added.

## Inquiry limitations

The form collects company, email, intended destination, fresh nopal, desired quantity, packaging requirements, delivery terms, and a message. Existing client-side validation and the explicit local demo preview remain. Changing tabs/languages preserves in-session entries; editing clears the preview and reset clears the form. **No message is sent, no inquiry is saved, and no quotation or booking is created.** There is no backend, email service, API submission, local-storage inquiry persistence, database, or invented contact address.

## Verification and remaining review

Tests cover reported/unknown data, honest chart states, English/Spanish labels and tooltips, actual React chart markup and demo warnings in both languages, fictional/producer-data separation, preserved navigation/language/map controllers, and inquiry validation. GIS tests additionally verify exact counts, unique IDs/coordinates, valid route references/endpoints/stop geometry, whole-network connectivity, independent layer filtering and add/remove controller calls, regional extents, clustering/expansion, translated feature/route detail models and disclaimers, and the Logistics-only navigation boundary. Controller/model and server-rendered markup checks are not browser interaction or visual tests.

No browser-testing tool is available in this workspace. Manually inspect desktop/mobile chart readability, all four tabs and both languages, full-network initial extent, all five layer toggles, cluster expansion, marker/route popup selection and keyboard activation, language switching with an open popup, region/destination/full-route shortcuts, repeated tab switching, wheel/pinch zoom, resize sizing, label placement, attribution and actual tile loading, form errors, preview, reset, and language persistence. No actual browser clicks, tile requests, screenshots, or desktop/mobile visual verification were performed for the GIS update.

Before real commercial use, Eduardo must confirm specifications, exact weights, availability, identity/origin records, buyers, commercial terms, transport/customs arrangements, and applicable shipment-specific export/import/phytosanitary requirements with appropriate evidence and qualified trade partners. Public deployment is outside this source update and requires separate review and authorization.
