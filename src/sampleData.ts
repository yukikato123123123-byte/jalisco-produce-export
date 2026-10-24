// Current brief: producer-reported facts are distinct from supporting evidence.
// Unknown commercial specifications stay null; no synthetic values are inferred.
export type VerificationState = 'sample' | 'pending' | 'verified' | 'quoted';
export const verificationStates: Record<VerificationState, { label: string; description: string }> = {
  sample: { label: 'SAMPLE', description: 'Illustrative prototype information; not confirmed producer data.' },
  pending: { label: 'PENDING', description: 'Reported information or a review item awaiting supporting evidence and confirmation.' },
  verified: { label: 'VERIFIED', description: 'Supported by reviewed evidence.' },
  quoted: { label: 'QUOTED', description: 'Supported by an actual dated quotation.' },
};
export interface DossierField { label: string; value: string; state: VerificationState; note?: string; badgeLabel?: string; }
export interface ProductProfile { name: string; variety: string | null; grade: string | null; origin: string; note: string; }
export interface SupplySpecification {
  cartonCount: number;
  harvestTonnes: number | null;
  harvestTonnesLowerBound: number;
  harvestWeightDescription: string;
  source: string;
  cartonNetKg: number | null;
  cartonDimensionsCm: readonly [number, number, number] | null;
  cartonsPerPallet: number | null;
  palletCount: number | null;
  harvestWindow: string | null;
  continuity: string;
}
export interface PricingExample { state: VerificationState; id: string; label: string; usdPerKg: number | null; namedPlace: string; scope: string; }
export interface LogisticsScenario {
  state: VerificationState; id: string; market: string; mode: string; routeConcept: string;
  crossing: string | null; carrier: string | null; usdPerLoad: number | null;
  transitDays: readonly [number, number] | null; scope: string;
}
export type WorkflowStatus = 'Pending review' | 'Commodity-specific review required' | 'Evidence required';
export interface ReadinessItem { label: string; status: WorkflowStatus; evidence: string; state: VerificationState; }
export interface MarketComparison {
  id: string; name: string; buyerCount: number | null; demandKg: number | null;
  usdPerKg: number | null; freightUsd: number | null; distanceKm: number | null;
  transitDays: number | null; buyerStatus: string; termsStatus: string;
}
export interface ReadinessStage { id: string; label: string; status: string; state: VerificationState; completed: boolean; }

const pending = 'Pending confirmation';
const supply: SupplySpecification = {
  cartonCount: 486,
  harvestTonnes: null,
  harvestTonnesLowerBound: 10,
  harvestWeightDescription: 'Slightly more than 10 metric tonnes',
  source: 'Producer-reported',
  cartonNetKg: null, cartonDimensionsCm: null, cartonsPerPallet: null, palletCount: null,
  harvestWindow: null, continuity: pending,
};
const product: ProductProfile = {
  name: 'Fresh nopal', variety: null, grade: null, origin: 'El Grullo, Jalisco, Mexico',
  note: 'Fresh nopal and El Grullo are producer-reported. Variety, grade, packaging standards, exact farm location, origin records, and recurring supply commitments remain pending confirmation.',
};
const pricing: PricingExample[] = [
  { state: 'pending', id: 'producer', label: 'Producer quotation', usdPerKg: null, namedPlace: 'Named sale place: Pending confirmation', scope: 'A dated producer quotation, quantity, product specifications, payment terms, agreed Incoterms, and cost inclusions are required. No price or named port has been established.' },
  { state: 'pending', id: 'texas', label: 'Texas commercial terms', usdPerKg: null, namedPlace: 'Texas · intended market', scope: 'Buyer discovery, destination address, price, transport scope, customs-related costs, inspections, and other inclusions remain pending confirmation.' },
  { state: 'pending', id: 'illinois', label: 'Illinois commercial terms', usdPerKg: null, namedPlace: 'Illinois · intended market', scope: 'Buyer discovery, destination address, price, transport scope, customs-related costs, inspections, and other inclusions remain pending confirmation.' },
];
const logistics: LogisticsScenario[] = [
  { state: 'pending', id: 'texas', market: 'Texas', mode: 'Refrigerated transport contacts reported', routeConcept: 'Jalisco  Texas · schematic connection', crossing: null, carrier: null, usdPerLoad: null, transitDays: null, scope: 'Eduardo reports contacts for refrigerated transport and prospective customs brokers. No carrier appointment, border-crossing plan, transport quotation, delivery time, or shipment has been confirmed.' },
  { state: 'pending', id: 'illinois', market: 'Illinois', mode: 'Refrigerated transport contacts reported', routeConcept: 'Jalisco  Illinois · schematic connection', crossing: null, carrier: null, usdPerLoad: null, transitDays: null, scope: 'Eduardo reports contacts for refrigerated transport and prospective customs brokers. No carrier appointment, border-crossing plan, transport quotation, delivery time, or shipment has been confirmed.' },
];
const readiness: ReadinessItem[] = [
  { label: 'Producer identity & origin documentation', status: 'Evidence required', state: 'pending', evidence: 'Eduardo reports producing fresh nopal in El Grullo, Jalisco. Supporting identity, origin records, and authority to offer the product still need review; no exact farm location is shown.' },
  { label: 'Product grade & lot traceability', status: 'Evidence required', state: 'pending', evidence: 'Confirm variety, grade, lot identifiers, and traceability records for the actual nopal offered. No packaging standard or certification is assumed.' },
  { label: 'Packaging & net weight', status: 'Pending review', state: 'pending', evidence: 'Confirm net and gross carton weights, dimensions, pallet arrangement, labels, and the exact latest harvest weight. Do not derive a carton weight from the approximate total.' },
  { label: 'Harvest calendar & supply consistency', status: 'Pending review', state: 'pending', evidence: 'The latest reported harvest is not a recurring capacity commitment. Confirm harvest dates, seasonal availability, and repeat-supply capability.' },
  { label: 'Export & import documentation', status: 'Evidence required', state: 'pending', evidence: 'Identify applicable documents for the confirmed fresh nopal shipment with qualified trade partners. No permits or official records have been supplied.' },
  { label: 'Applicable phytosanitary requirements', status: 'Commodity-specific review required', state: 'pending', evidence: 'Review applicable requirements for fresh nopal, its confirmed origin, destination, and shipment circumstances. No export/import eligibility or phytosanitary clearance is claimed.' },
  { label: 'Certifications, if applicable', status: 'Evidence required', state: 'pending', evidence: 'Identify any applicable certification and review supporting evidence. No certification has been supplied or claimed.' },
  { label: 'Commercial terms & pricing', status: 'Evidence required', state: 'pending', evidence: 'Discover buyers and obtain a real dated quotation, named places, payment terms, and cost inclusions. No commercial price or buyer commitment is established.' },
  { label: 'Transport quotation & cold-chain plan', status: 'Pending review', state: 'pending', evidence: 'Validate the reported transport and customs-broker contacts, obtain a quotation, and confirm route, handling, and cold-chain arrangements. Contacts are not bookings or approved transport plans.' },
];
const marketComparison: MarketComparison[] = ['Texas', 'Illinois'].map(name => ({
  id: name.toLowerCase(), name, buyerCount: null, demandKg: null, usdPerKg: null,
  freightUsd: null, distanceKm: null, transitDays: null,
  buyerStatus: 'Evidence required', termsStatus: pending,
}));
const exportStages: ReadinessStage[] = [
  { id: 'buyers', label: 'Buyer discovery', status: 'Evidence required', state: 'pending', completed: false },
  { id: 'specifications', label: 'Product & packaging specifications', status: pending, state: 'pending', completed: false },
  { id: 'quotation', label: 'Commercial quotation', status: 'Evidence required', state: 'pending', completed: false },
  { id: 'transport', label: 'Transport arrangements', status: pending, state: 'pending', completed: false },
  { id: 'compliance', label: 'Phytosanitary / export-import review', status: 'Evidence required', state: 'pending', completed: false },
];
export const sampleData = {
  notice: 'Fresh nopal from El Grullo, Jalisco. Eduardo reports a latest harvest of 486 cartons and slightly more than 10 metric tonnes. Exact weights, specifications, quotations, and export requirements remain pending confirmation.',
  producer: { name: 'Eduardo · nopal producer', region: product.origin, description: 'Producer-reported information for a buyer presentation, not a verified company dossier. Exact farm location and supporting identity and origin records are pending review.' },
  producerFields: [
    { label: 'Origin', value: product.origin, state: 'pending', badgeLabel: 'PRODUCER-REPORTED', note: 'Municipality reported by Eduardo; no exact farm location is provided.' },
    { label: 'Product', value: product.name, state: 'pending', badgeLabel: 'PRODUCER-REPORTED' },
    { label: 'Variety / grade', value: pending, state: 'pending' },
    { label: 'Latest reported harvest', value: supply.harvestWeightDescription, state: 'pending', badgeLabel: 'PRODUCER-REPORTED', note: 'Approximate total only; exact harvest weight has not been supplied.' },
    { label: 'Packing', value: '486 cartons · latest reported harvest', state: 'pending', badgeLabel: 'PRODUCER-REPORTED', note: 'Carton weights, dimensions, packing standard, and pallet configuration remain unknown.' },
    { label: 'Recurring supply', value: pending, state: 'pending' },
  ] satisfies DossierField[],
  commercialReadiness: [
    { label: 'Product specification', value: pending, state: 'pending' },
    { label: 'Packaging', value: pending, state: 'pending' },
    { label: 'Pricing', value: 'Evidence required', state: 'pending' },
    { label: 'Supply capacity', value: 'Latest harvest reported; recurring capacity pending', state: 'pending' },
    { label: 'Phytosanitary', value: 'Review required', state: 'pending' },
    { label: 'Logistics', value: 'Contacts reported; arrangements pending', state: 'pending' },
  ] satisfies DossierField[],
  readinessOverview: [
    { label: 'Product specification', value: pending, state: 'pending' },
    { label: 'Packaging specification', value: pending, state: 'pending' },
    { label: 'Supply consistency', value: pending, state: 'pending' },
    { label: 'Traceability', value: 'Evidence required', state: 'pending' },
    { label: 'Export documentation', value: 'Evidence required', state: 'pending' },
    { label: 'Phytosanitary requirements', value: 'Review required', state: 'pending' },
    { label: 'Cold-chain planning', value: pending, state: 'pending' },
    { label: 'Commercial quotation', value: 'Evidence required', state: 'pending' },
  ] satisfies DossierField[],
  routeState: { state: 'sample' as VerificationState, label: 'ILLUSTRATIVE LOGISTICS' },
  product, supply, pricing, logistics, readiness,
  overview: { harvest: supply, markets: marketComparison, readiness: exportStages },
  locations: [
    { name: 'Jalisco, Mexico', role: 'Representative Jalisco origin point', coordinates: [20.66, -103.35] as [number, number] },
    { name: 'Texas, U.S.', role: 'Illustrative market region', coordinates: [31.0, -99.0] as [number, number] },
    { name: 'Illinois, U.S.', role: 'Illustrative market region', coordinates: [40.0, -89.0] as [number, number] },
  ],
  routeNotice: 'Eduardo reports El Grullo, Jalisco. This map retains a representative Jalisco point; it does not locate El Grullo or a farm. Curves connect approximate regions, not roads or shipping lanes. No border crossing or transport route is confirmed.',
  pricingNotice: 'No nopal price or quotation has been supplied. Actual terms require confirmation of quantity, specifications, season, destination, transport costs, applicable Incoterms, payment terms, and included costs.',
  inquiry: {
    destinations: ['Texas', 'Illinois'], products: ['Fresh nopal'],
    terms: ['Discuss commercial terms', 'Delivery terms pending confirmation'],
    packagingPlaceholder: 'Describe your preferred packaging; the producer specification is pending confirmation',
  },
  contact: { name: 'Eduardo · nopal producer', status: 'Producer-reported location: El Grullo, Jalisco. Contact details pending confirmation.', quote: 'This demo creates a local preview only. No message is sent to Eduardo, a producer, or a transport contact.' },
};
