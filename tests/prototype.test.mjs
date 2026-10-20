import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleData, verificationStates } from '../src/sampleData.ts';
import { validateInquiry } from '../src/inquiry.ts';

const validInquiry = {
  company: 'Demo buyer', email: 'buyer@example.test', destination: sampleData.inquiry.destinations[0],
  product: sampleData.inquiry.products[0], quantityKg: '1000', packaging: '',
  terms: sampleData.inquiry.terms[0], questions: '',
};

test('latest harvest retains reported precision and never infers carton weights', () => {
  const { supply } = sampleData;
  assert.equal(sampleData.product.name, 'Fresh nopal');
  assert.equal(sampleData.product.origin, 'El Grullo, Jalisco, Mexico');
  assert.equal(supply.cartonCount, 486);
  assert.equal(supply.harvestTonnes, null);
  assert.equal(supply.harvestTonnesLowerBound, 10);
  assert.equal(supply.harvestWeightDescription, 'Slightly more than 10 metric tonnes');
  for (const field of ['cartonNetKg', 'cartonDimensionsCm', 'cartonsPerPallet', 'palletCount', 'harvestWindow']) assert.equal(supply[field], null);
  assert.equal(sampleData.product.variety, null);
  assert.equal(sampleData.product.grade, null);
});

test('nopal prices and logistics remain unknown rather than inheriting fictional estimates', () => {
  assert.ok(sampleData.pricing.every(item => item.usdPerKg === null && item.state === 'pending'));
  for (const item of sampleData.logistics) {
    for (const field of ['carrier', 'crossing', 'usdPerLoad', 'transitDays']) assert.equal(item[field], null);
    assert.equal('distanceKm' in item, false);
    assert.equal(item.state, 'pending');
    assert.match(item.scope, /contacts/);
  }
  assert.equal(sampleData.readiness.length, 9);
  assert.ok(sampleData.readiness.every(item => item.state === 'pending'));
});

test('a valid inquiry can produce a local preview without mutating the inputs', () => {
  const before = { ...validInquiry };
  assert.deepEqual(validateInquiry(validInquiry), {});
  assert.deepEqual(validInquiry, before);
});

test('required fields reject blank, malformed, and unsupported choices', () => {
  const errors = validateInquiry({ ...validInquiry, company: '  ', email: 'not-an-email', destination: 'unsupported', product: '', terms: '' });
  assert.deepEqual(Object.keys(errors).sort(), ['company', 'destination', 'email', 'product', 'terms']);
});

test('order quantity rejects zero, negative, nonnumeric, empty, and nonfinite values', () => {
  for (const quantityKg of ['0', '-1', 'NaN', 'Infinity', '', '  ', '1e999', '0.00001', '1000.5555']) {
    assert.ok(validateInquiry({ ...validInquiry, quantityKg }).quantityKg);
  }
  assert.deepEqual(validateInquiry({ ...validInquiry, quantityKg: '1000.5' }), {});
  assert.deepEqual(validateInquiry({ ...validInquiry, quantityKg: '0.001' }), {});
});

test('text limits prevent oversized inquiry fields', () => {
  const errors = validateInquiry({ ...validInquiry, company: 'x'.repeat(121), packaging: 'x'.repeat(1001), questions: 'x'.repeat(2001) });
  assert.deepEqual(Object.keys(errors).sort(), ['company', 'packaging', 'questions']);
});


test('verification model supports four states without claiming current verification or quotations', () => {
  assert.deepEqual(Object.keys(verificationStates).sort(), ['pending', 'quoted', 'sample', 'verified']);
  const fields = [...sampleData.producerFields, ...sampleData.commercialReadiness, ...sampleData.readinessOverview, ...sampleData.readiness, ...sampleData.pricing, ...sampleData.logistics, sampleData.routeState];
  for (const field of fields) {
    assert.ok(field.state in verificationStates);
    assert.ok(['pending', 'sample'].includes(field.state));
  }
  assert.equal(sampleData.producerFields.find(field => field.label === 'Latest reported harvest').state, 'pending');
  assert.equal(sampleData.producerFields.find(field => field.label === 'Packing').state, 'pending');
  assert.equal(sampleData.readinessOverview.length, 8);
});

// Controller-level checks use a small map port, not a browser or a replacement
// map renderer. Real Leaflet rendering, gestures, and visual bounds remain manual QA.
import './presentation.test.mjs';

import './charts.test.mjs';
