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

Variety, grade, carton weights/dimensions, packaging standard, pallet pattern, season, recurring capacity, prices, buyers, freight quotes, delivery times, routes, border crossings, documentation, certification, phytosanitary clearance, and legal export/import eligibility remain **Pending confirmation** or **Evidence required**. Unknown numeric values use `null`, never zero or synthetic estimates. Earlier fictional product/pricing/transport examples have been removed from current commercial data rather than reused for nopal. No simulated monetary or transit estimates remain.

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

`src/components/SupplyMarketOverview.tsx` is mounted directly in the default Producer panel, above the dossier; it is not inside a disclosure or a hidden chart-only page. Three responsive figures are rendered:

1. **Harvest & cartons:** two associated metric nodes show the 486 reported cartons and the approximate weight (`>10`, explicitly qualified as slightly more than 10 metric tonnes). Their sizes are decorative, not proportional quantities, and their connection is not a packing conversion. Exact total and carton net weights are labeled unknown.
2. **Texas vs Illinois:** a destination-relationship graphic and qualitative comparison matrix show the intended markets plus the buyer and commercial/transport evidence still needed. There are no fabricated buyer counts, demand, sales, rates, freight costs, distances, or transit times.
3. **Export-readiness review:** an open-marker status diagram for buyer discovery, product/packaging specifications, quotation, transport arrangements, and phytosanitary/export-import review. No category is marked complete and no numerical completion percentage is computed.

Figures have captions, SVG titles/descriptions where appropriate, and visible textual status equivalents. CSS stacks them at smaller widths. Their data references the same centralized report and unknown-value model as the rest of the presentation.

## Data and localization architecture

- `src/sampleData.ts`: typed producer/product, approximate harvest, unknown specifications, commercial/logistics review, chart models, readiness states, and existing map coordinates. `sampleData.overview.harvest` references the shared supply object.
- `src/components/`: dossier, packaging, commercial planning, inquiry, reusable status badge, and visible overview graphics.
- `src/i18n.ts`: centralized English/Spanish text, including chart labels/descriptions, facts, pending states, map disclosures, form options, errors, and accessibility text.
- `src/localization.tsx` and `src/localizeNode.ts`: React language state and presentation translation, without translating user entries or changing canonical form values.
- `src/presentation.ts`: tab keyboard behavior and safe preference persistence.
- `src/mapBehavior.ts`: existing responsive map focus/refresh controller.

English is the first-use default. EN/ES switches instantly and updates document language/title. Only the language preference is stored under `jalisco-produce-export.language`; blocked storage is handled gracefully. Inquiry values remain in memory only. Tests check coverage of static interface phrases and centralized descriptions in both languages.

The verification-state model retains `sample`, `pending`, `verified`, and `quoted`. Producer-reported fields carry explicit report labels while supporting evidence remains pending. The map's route is illustrative. No field claims verified evidence or an actual quotation.

## Map behavior and geographic limitations

The original representative points are retained: Jalisco `[20.66, -103.35]`, Texas `[31, -99]`, and Illinois `[40, -89]`. **The Jalisco point does not locate El Grullo or a farm.** El Grullo is the reported municipality in the dossier, not a newly fabricated map coordinate. The map explicitly discloses this distinction.

The same Leaflet instance persists through tab and language switches. Initial visible layout fits all three regional points with padding. Texas/Illinois shortcuts smoothly focus the existing points at zoom 6, with reduced-motion support. Jalisco Origin uses zoom 8 on the representative regional point. Show Full Route restores all points and schematic connections. The +/− controls, wheel zoom, pinch zoom, marker popups, connection toggle, and attribution are preserved. Visibility/ResizeObserver handling invalidates stale dimensions before reframing after tab reveal or viewport changes.

Curves are sampled decorative Bezier polylines, not verified driving routes, border plans, or shipping lanes. No distances or route-derived timing are calculated. Existing destination/marker positions have not been converted into exact buyer or delivery locations.

Tiles remain **Stadia Maps Alidade Smooth Dark**, with visible Stadia Maps, OpenMapTiles, and OpenStreetMap credits. The [style documentation](https://docs.stadiamaps.com/map-styles/alidade-smooth-dark/) gives the tile URL and attribution. [Authentication documentation](https://docs.stadiamaps.com/authentication/) permits key-free local browser development on localhost/127.0.0.1, subject to rate limits. The [provider FAQ](https://stadiamaps.com/faqs/) describes development/demo use and commercial restrictions. Non-local hosting needs provider authentication/licensing review; no key, account, subscription, or public hosting configuration was added. Internet access is required for tiles.

## Imagery

`src/assets/nopal-illustration.svg` is local illustrative artwork, not a photograph of Eduardo's produce or farm. Packaging uses a dimension-free neutral carton schematic. The earlier user-supplied design-reference asset is retained unused; it is no longer referenced by application styles or emitted as a displayed asset. No external image service was added.

## Inquiry limitations

The form collects company, email, intended destination, fresh nopal, desired quantity, packaging requirements, delivery terms, and a message. Existing client-side validation and the explicit local demo preview remain. Changing tabs/languages preserves in-session entries; editing clears the preview and reset clears the form. **No message is sent, no inquiry is saved, and no quotation or booking is created.** There is no backend, email service, API submission, local-storage inquiry persistence, database, or invented contact address.

## Verification and remaining review

Tests cover reported/unknown data, honest chart states, English/Spanish labels, actual React chart markup in both languages, preserved navigation/language/map controllers, and inquiry validation. Server-rendered markup checks are not browser visual tests.

No browser-testing tool is available in this workspace. Manually inspect desktop/mobile chart readability, all four tabs and both languages, map initial extent, origin/destination/full-route interactions, wheel/pinch zoom, tab/resize sizing, label placement, attribution, form errors, preview, reset, and language persistence.

Before real commercial use, Eduardo must confirm specifications, exact weights, availability, identity/origin records, buyers, commercial terms, transport/customs arrangements, and applicable shipment-specific export/import/phytosanitary requirements with appropriate evidence and qualified trade partners. Public deployment is outside this source update and requires separate review and authorization.
