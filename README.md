# Jalisco Produce Export

A B2B agricultural export concept for Eduardo to review. It demonstrates how potential supply from Jalisco, Mexico, could be presented to produce buyers and brokers in Texas and Illinois. It is a concept prototype, not an operational marketplace, supplier offer, or verified export business.

## Stack and local setup

React, TypeScript, Vite, Leaflet, and CSS. No backend, database, authentication, payments, email service, or new dependencies were added for the business workflow.

Use Node.js **22.12+** and npm:

```sh
npm ci
npm run dev
```

Open Vite's printed `http://localhost:5173/` URL (the port may vary). For local checks and a preview of the production build:

```sh
npm run lint
npm test
npm run build
npm run preview
```

`npm test` uses Node's built-in test API and TypeScript stripping; no test framework is installed. Tests cover carton/pallet reconciliation, separate pricing and freight units, sample workflow states, and inquiry validation (including required fields, supported choices, quantity precision, and text limits). They do not verify browser rendering or map interactions.

## Main sections and interactions

- **Hero and concept notice:** illustrative local imagery, sample harvest volume, and a prominent unverified-data notice.
- **Product and supply:** demonstration producer profile, fresh avocado, sample Hass variety and grade, packaging specifications, seasonal window, and explicit net-weight reconciliation.
- **Interactive logistics map:** Regional Overview fits the existing approximate Jalisco, Texas, and Illinois points. Jalisco Origin zooms to the existing approximate origin point, hiding destinations and curves. Controls switch views, toggle curves, zoom, and reset. Markers expose geographic-detail popups. Resize handling and unmount cleanup preserve a single map instance.
- **Readiness overview:** four sample review states link to the full documentation checklist. No verified compliance or eligibility is claimed.
- **Pricing comparison:** three simulated price examples, with named places and qualifications about terms and cost inclusions.
- **Logistics scenarios:** two fictional truck-planning examples, explicitly separate from actual map routing or carrier quotes.
- **Documentation:** nine expandable review areas explain the evidence and follow-up needed.
- **Buyer inquiry:** client-side validation, a local on-screen preview, and a clear-form action. Navigation and price cards link here.

On narrow screens, content stacks, controls wrap, specification grids simplify, and the inquiry form becomes one column. Labels, keyboard focus, status text, and validation messages accompany visual cues.

## Sample-data policy

All invented commercial information lives in `src/sampleData.ts` wherever practical. It includes typed product, supply, pricing, logistics, and readiness data. `src/inquiry.ts` holds pure client-side validation; `src/components/` contains the business sections and inquiry form. These sources can be replaced with information Eduardo actually verifies.

Every product, quantity, price, transport budget, transit range, carrier placeholder, and workflow state is **sample, illustrative, or simulated**. None is implied to have been supplied or approved by Eduardo. The producer profile is fictional; Eduardo's role, authority, and contact details are unverified. There are no real company identities, buyer commitments, certification claims, carrier partnerships, permits, or inspection records.

The fresh avocado / Hass / “export grade” descriptions are illustrative only. “Export grade” does not establish a grading standard or legal export/import eligibility. Imagery is not evidence of the producer's product.

### Supply and packaging examples

| Field | Illustrative value |
| --- | --- |
| Harvest allocation | 10 metric tonnes; no supply commitment |
| Carton count | 486 cartons |
| Net carton weight | 20.6 kg |
| Carton dimensions | 60 × 40 × 25 cm (length × width × height) |
| Pallet pattern | 27 cartons × 18 pallets = 486 cartons |
| Example seasonal window | October–December; not a commitment |
| Continuity | One planning allocation; no verified recurring capacity |

**486 × 20.6 kg = 10,011.6 kg = 10.0116 metric tonnes**, which is **11.6 kg more** than the independent 10-tonne harvest example. The UI shows this discrepancy explicitly. Neither quantity is confirmed available. Totals use integer grams; gross shipping weights and actual load capacity are not established.

### Simulated prices and logistics

| Price example | Invented price |
| --- | --- |
| FOB Manzanillo, Mexico | US$2.40/kg |
| Delivered to an unspecified Texas destination | US$3.15/kg |
| Delivered to an unspecified Illinois destination | US$3.55/kg |

Each price card says **SIMULATED PRICE — NOT A QUOTATION**. These are not researched market rates or Eduardo's prices. Actual terms require agreement on commodity, grade, volume, date, named place, applicable Incoterms/version, shipment details, and included costs. Delivered examples do not establish a delivery Incoterm or inclusions for customs-related costs, inspection, duties, taxes, unloading, or other charges. The FOB port example is independent of the truck scenarios. No landed-cost model links these invented prices to the freight budgets.

| Fictional logistics example | Simulated budget | Invented transit range |
| --- | --- | --- |
| Jalisco → hypothetical Laredo crossing → a Texas destination | US$3,800/load | 3–5 days |
| Jalisco → hypothetical Laredo crossing → a Chicago-area destination | US$5,900/load | 5–7 days |

Both use the explicit placeholder **Example Carrier (fictional sample)** and an illustrative refrigerated truck mode. These are **SIMULATED LOGISTICS — NO CARRIER QUOTE OR SHIPMENT HAS BEEN VERIFIED**. They are not bookings, road-routing results, real carrier quotes, or verified transit estimates. No distance, load capacity, destination address, temperature setting, real border plan, or actual transport scope is established. No shipment has been arranged through the prototype.

## Map provider, geography, and hosting limitations

The Leaflet map uses **Stadia Maps Alidade Smooth Dark** raster tiles with visible Stadia Maps, OpenMapTiles, and OpenStreetMap attribution. No CSS filtering is applied to tiles. The [style documentation](https://docs.stadiamaps.com/map-styles/alidade-smooth-dark/) specifies the URL and attribution. The provider's [authentication documentation](https://docs.stadiamaps.com/authentication/) allows local browser development on `localhost` or `127.0.0.1` without an API key or account, subject to strict rate limits. Its [FAQ](https://stadiamaps.com/faqs/) addresses development/testing and demonstration use; commercial production has different requirements.

Internet access is required. Tile errors show a notice. LAN addresses, forwarded preview domains, and public hosting require provider authentication/setup; this prototype does not configure it. No API key, paid plan, subscription, or account was created. Do not assume unrestricted production tile-service access.

Only existing approximate regional points are used, not farm or warehouse locations. Jalisco Origin uses zoom 8, not a verified production-area extent. Connections are 65-point quadratic Bezier curves in Web Mercator, rendered as layered Leaflet polylines. Decorative control points are not waypoints. The map does **not** depict actual roads, the hypothetical Laredo crossing, or a verified shipping lane. No Jalisco boundary, road distance, farm address, or exact field coordinate is fabricated.

`src/assets/design-reference.png` is the retained user-supplied reference. CSS crops its still-life photograph for the hero and product card. It is illustrative, not producer photography. A separate high-resolution photo can replace it later. No external image service is used.

## Inquiry and backend limitations

The form collects buyer/company, email, destination, sample product, quantity in kilograms (up to three decimals), packaging requirements, delivery terms, and questions. It validates inputs locally, focuses invalid fields, and shows a clearly labeled demo preview after validation. Editing clears the preview; reset clears the form and validation state.

**Nothing is sent or stored.** There is no submission endpoint, network request for inquiries, email delivery, inquiry ID, quotation, booking, local-storage persistence, or database. The browser holds the form values only for the current page session; reloading clears them. No invented email address or contact detail for Eduardo is shown.

## What Eduardo must confirm for real business use

- Commodity, variety, actual grade/specifications, producer identity, authority to sell, and origin documentation.
- Harvest volume, availability calendar, recurring supply, offered carton count, net/gross weights, dimensions, pallet configuration, labeling, and load suitability.
- Lot traceability, applicable certifications and supporting evidence, export/import documents, and current commodity-specific phytosanitary requirements for the shipment circumstances.
- Dated prices, named places, applicable commercial terms, payment terms, and all inclusions/exclusions.
- Actual buyers, final destination addresses, carrier quotations, border process, road route, cold-chain plan, handling, and realistic transit expectations.
- Approved business contact information and an authorized inquiry-delivery workflow with appropriate data handling.
- Hosting and tile-provider licensing/authentication before sharing beyond local development.

## Verification limits

Build, lint, and focused unit checks can run locally. No browser tool is installed/configured in the current workspace, so no visual or end-to-end browser verification is claimed. Manually check both map views, zoom/reset/connection controls, tile attribution, desktop/mobile layout, documentation expansion, inquiry errors, successful demo preview, editing, and clearing the form. No public deployment is part of this task.
