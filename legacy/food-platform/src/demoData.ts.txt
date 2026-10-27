// Fictional UI examples only. Never merge into sampleData or a buyer quotation.
export const demoData = {
  disclaimer: 'DEMO DATA — NOT A REAL OFFER OR QUOTE',
  warning: 'Fictional examples, not verified carrier quotes, confirmed routes, market research, or delivery commitments.',
  priceAssumptions: 'USD per kg of fresh nopal. Invented destination-price examples for the same unspecified grade and packaging. Freight, duties, taxes, and fees excluded; not a landed-cost calculation.',
  logisticsAssumptions: 'One hypothetical refrigerated vehicle per scenario, with unspecified load capacity, temperature, collection point, and destination address. Fictional elapsed days and transport-only USD budgets; customs, inspections, duties, taxes, and delays excluded. No border crossing or route is selected.',
  markets: [
    { id: 'texas', name: 'Texas', priceUsdPerKg: 1.20, transitDays: 3, freightUsdPerVehicle: 3200 },
    { id: 'illinois', name: 'Illinois', priceUsdPerKg: 1.55, transitDays: 5, freightUsdPerVehicle: 5100 },
  ],
  axes: { priceUsdPerKg: 2, transitDays: 6, freightUsdPerVehicle: 6000 },
} as const;
