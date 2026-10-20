// All commercial content is illustrative and unverified. Replace with Eduardo's verified information.
export const sampleData = {
  producer: { name: 'Producer profile pending', region: 'Jalisco, Mexico', description: 'A place to review producer information, product specifications, and potential supply before starting a broker conversation.' },
  product: { name: 'Fresh avocado', variety: 'Sample product · variety to confirm', note: 'Illustrative listing only. Product, origin, grade, and availability require confirmation.' },
  supply: [
    { label: 'Illustrative volume', value: '10 tonnes', note: 'Sample only · not confirmed available' },
    { label: 'Illustrative box count', value: '486 boxes', note: 'Sample only · not a verified pack-out' },
    { label: 'Packaging', value: 'To be confirmed', note: 'Box weight, dimensions, and pallet configuration pending' },
    { label: 'Harvest & availability', value: 'To be confirmed', note: 'No harvest window or stock commitment verified' },
  ],
  locations: [
    { name: 'Jalisco, Mexico', role: 'Illustrative origin region', coordinates: [20.66, -103.35] as [number, number] },
    { name: 'Texas, U.S.', role: 'Illustrative market region', coordinates: [31.0, -99.0] as [number, number] },
    { name: 'Illinois, U.S.', role: 'Illustrative market region', coordinates: [40.0, -89.0] as [number, number] },
  ],
  routeNotice: 'Conceptual & unverified. Lines connect representative regional points only; they are not roads, a shipping itinerary, or confirmed destinations. No buyer, carrier, border crossing, rate, or transit time is established.',
  brokerReadiness: [
    { label: 'Product & variety', status: 'To confirm' },
    { label: 'Packaging specifications', status: 'To confirm' },
    { label: 'FOB / delivered pricing', status: 'To confirm' },
    { label: 'Phytosanitary requirements', status: 'Depends on commodity' },
  ],
  readiness: [
    'Producer identity & origin documentation',
    'Product specifications & traceability',
    'Packaging & cold-chain requirements',
    'Applicable import & phytosanitary documentation',
    'Certifications, if applicable, with supporting evidence',
    'Commercial terms & logistics validation',
  ],
  contact: { name: 'Eduardo', status: 'Contact details pending verification', quote: 'Pricing, freight, delivery terms, and minimum order quantities will appear here after confirmation.' },
};
