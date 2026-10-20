// Invented demonstration content. None of these commercial values is verified
// with Eduardo, a producer, buyer, authority, or carrier.
export interface ProductProfile {
  name: string;
  variety: string;
  grade: string;
  origin: string;
  note: string;
}
export interface SupplySpecification {
  harvestTonnes: number;
  cartonCount: number;
  cartonNetKg: number;
  cartonDimensionsCm: readonly [number, number, number];
  cartonsPerPallet: number;
  palletCount: number;
  harvestWindow: string;
  continuity: string;
}
export interface PricingExample {
  id: string;
  label: string;
  usdPerKg: number;
  namedPlace: string;
  scope: string;
}
export interface LogisticsScenario {
  id: string;
  market: string;
  mode: string;
  routeConcept: string;
  crossing: string;
  carrier: string;
  usdPerLoad: number;
  transitDays: readonly [number, number];
  scope: string;
}
export type WorkflowStatus = 'Sample workflow' | 'Pending review' | 'Commodity-specific review required' | 'Evidence required';
export interface ReadinessItem {
  label: string;
  status: WorkflowStatus;
  evidence: string;
}

const supply: SupplySpecification = {
  harvestTonnes: 10,
  cartonCount: 486,
  cartonNetKg: 20.6,
  cartonDimensionsCm: [60, 40, 25],
  cartonsPerPallet: 27,
  palletCount: 18,
  harvestWindow: 'October–December · illustrative seasonal window',
  continuity: 'One example harvest allocation; recurring weekly supply has not been established.',
};

const product: ProductProfile = {
  name: 'Fresh avocado',
  variety: 'Hass · sample variety',
  grade: 'Export grade · illustrative example',
  origin: 'Jalisco, Mexico · regional example',
  note: 'Commodity, variety, grade, producer identity, and origin documentation have not been verified. “Export grade” is an illustrative description, not evidence of a grading standard or export eligibility.',
};

const pricing: PricingExample[] = [
  { id: 'fob', label: 'FOB Manzanillo', usdPerKg: 2.4, namedPlace: 'Named port: Manzanillo, Mexico', scope: 'Illustrative port-based sale. Applicable Incoterms version, shipment mode, loading obligations, and cost allocation must be agreed. This is separate from the truck scenarios below.' },
  { id: 'texas', label: 'Delivered · Texas', usdPerKg: 3.15, namedPlace: 'Example Texas destination · final address not selected', scope: 'Destination, transport scope, customs-related costs, inspection charges, duties, taxes, unloading, and other inclusions require confirmation. No delivery Incoterm is established.' },
  { id: 'illinois', label: 'Delivered · Illinois', usdPerKg: 3.55, namedPlace: 'Example Illinois destination · final address not selected', scope: 'Destination, transport scope, customs-related costs, inspection charges, duties, taxes, unloading, and other inclusions require confirmation. No delivery Incoterm is established.' },
];

const logistics: LogisticsScenario[] = [
  { id: 'texas', market: 'Texas scenario', mode: 'Refrigerated truck · illustrative', routeConcept: 'Jalisco → Laredo, Texas → a Texas destination', crossing: 'Laredo · hypothetical border-crossing example', carrier: 'Example Carrier (fictional sample)', usdPerLoad: 3800, transitDays: [3, 5], scope: 'Invented per-load transport budget and elapsed-time range. Load capacity, collection point, destination, cold-chain settings, border process, and cost inclusions are not established.' },
  { id: 'illinois', market: 'Illinois scenario', mode: 'Refrigerated truck · illustrative', routeConcept: 'Jalisco → Laredo, Texas → a Chicago-area destination', crossing: 'Laredo · hypothetical border-crossing example', carrier: 'Example Carrier (fictional sample)', usdPerLoad: 5900, transitDays: [5, 7], scope: 'Invented per-load transport budget and elapsed-time range. Load capacity, collection point, destination, cold-chain settings, border process, and cost inclusions are not established.' },
];

const readiness: ReadinessItem[] = [
  { label: 'Producer identity & origin documentation', status: 'Evidence required', evidence: 'Obtain producer identity, origin records, and authority to offer the product. The demonstration profile is not a real company.' },
  { label: 'Product grade & lot traceability', status: 'Sample workflow', evidence: 'Replace the sample Hass variety and illustrative grade with verified specifications, lot identifiers, and traceability records.' },
  { label: 'Packaging & net weight', status: 'Pending review', evidence: 'Confirm carton net and gross weights, dimensions, pallet pattern, labels, and the total offered quantity.' },
  { label: 'Harvest calendar & supply consistency', status: 'Pending review', evidence: 'Validate the seasonal window, harvest allocation, and repeat-supply capacity. No producer commitment is recorded.' },
  { label: 'Export & import documentation', status: 'Evidence required', evidence: 'Identify and review the applicable shipment documents with qualified trade partners; no permits or records are provided here.' },
  { label: 'Applicable phytosanitary requirements', status: 'Commodity-specific review required', evidence: 'Check current requirements for the confirmed commodity, origin, destination, and shipment circumstances. No eligibility is claimed.' },
  { label: 'Certifications, if applicable', status: 'Evidence required', evidence: 'Identify any applicable certification and validate supporting evidence. No certification is claimed or attached.' },
  { label: 'Commercial terms & pricing', status: 'Sample workflow', evidence: 'Agree a dated quotation, named places, applicable Incoterms, payment terms, and included costs. All displayed prices are invented.' },
  { label: 'Transport quotation & cold-chain plan', status: 'Pending review', evidence: 'Obtain a real carrier quote, validate the route and border process, and agree commodity-specific handling and temperature requirements.' },
];

export const sampleData = {
  notice: 'Concept prototype for review with Eduardo. All commercial information is sample, illustrative, or simulated and has not been verified with a producer. No supplier offer, certification, transport booking, or export eligibility is established.',
  producer: { name: 'Jalisco demonstration producer profile', region: product.origin, description: 'A fictional profile demonstrating the information a prospective supplier could share with U.S. produce brokers. It does not identify a real company, farm, or approved supplier.' },
  product,
  supply,
  pricing,
  logistics,
  readiness,
  brokerReadiness: [readiness[1], readiness[2], readiness[7], readiness[5]].map(({ label, status }) => ({ label, status })),
  locations: [
    { name: 'Jalisco, Mexico', role: 'Illustrative origin region', coordinates: [20.66, -103.35] as [number, number] },
    { name: 'Texas, U.S.', role: 'Illustrative market region', coordinates: [31.0, -99.0] as [number, number] },
    { name: 'Illinois, U.S.', role: 'Illustrative market region', coordinates: [40.0, -89.0] as [number, number] },
  ],
  routeNotice: 'Curves connect approximate regional points, not roads or shipping lanes. The hypothetical Laredo scenarios are separate narrative examples; no border waypoint or road-routing data is drawn on the map.',
  pricingNotice: 'Invented demonstration values, not researched market prices or supplier offers. Actual prices depend on commodity, grade, volume, date, agreed Incoterms, shipment details, destination, and included costs. These price examples are independent of the simulated per-load logistics budgets, not a calculated landed-cost model.',
  logisticsNotice: 'SIMULATED LOGISTICS — NO CARRIER QUOTE OR SHIPMENT HAS BEEN VERIFIED.',
  logisticsExplanation: 'All costs, carrier references, border-crossing concepts, and transit ranges are invented for interface demonstration. They are not actual carrier quotes, verified transit estimates, road-routing results, or confirmed plans. No shipment has occurred or been booked through this prototype.',
  inquiry: {
    destinations: ['Texas', 'Illinois'],
    products: ['Fresh avocado · Hass (sample)'],
    terms: ['Delivered · scope to agree', 'FOB Manzanillo · terms to agree', 'Discuss commercial terms'],
    packagingPlaceholder: 'For example: the sample carton specification, or a preferred pack size',
  },
  contact: { name: 'Eduardo · prototype review context only', status: 'Business role, authority, and contact details have not been verified.', quote: 'Explore a buyer inquiry locally. No message will be sent to Eduardo, a producer, or a carrier.' },
};

// Integer grams avoid floating-point drift when reconciling the example net weights.
const cartonTotalGrams = supply.cartonCount * Math.round(supply.cartonNetKg * 1000);
export const supplyTotals = {
  impliedNetKg: cartonTotalGrams / 1000,
  impliedNetTonnes: cartonTotalGrams / 1_000_000,
  differenceKg: (cartonTotalGrams - supply.harvestTonnes * 1_000_000) / 1000,
  palletCartons: supply.cartonsPerPallet * supply.palletCount,
};
