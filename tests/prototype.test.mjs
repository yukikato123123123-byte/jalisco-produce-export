import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleData, supplyTotals } from '../src/sampleData.ts';
import { validateInquiry } from '../src/inquiry.ts';

const validInquiry = {
  company: 'Demo buyer', email: 'buyer@example.test', destination: sampleData.inquiry.destinations[0],
  product: sampleData.inquiry.products[0], quantityKg: '1000', packaging: '',
  terms: sampleData.inquiry.terms[0], questions: '',
};

test('carton net weight reconciles exactly and remains separate from the harvest example', () => {
  assert.equal(supplyTotals.impliedNetKg, 10011.6);
  assert.equal(supplyTotals.impliedNetTonnes, 10.0116);
  assert.equal(supplyTotals.differenceKg, 11.6);
  assert.equal(supplyTotals.palletCartons, sampleData.supply.cartonCount);
  assert.notEqual(supplyTotals.impliedNetKg, sampleData.supply.harvestTonnes * 1000);
});

test('pricing and logistics retain distinct units and no numeric road distances', () => {
  assert.deepEqual(sampleData.pricing.map(item => item.usdPerKg), [2.4, 3.15, 3.55]);
  assert.deepEqual(sampleData.logistics.map(item => item.usdPerLoad), [3800, 5900]);
  for (const item of sampleData.logistics) {
    assert.match(item.carrier, /fictional sample/);
    assert.match(item.crossing, /hypothetical/);
    assert.ok(item.transitDays[0] <= item.transitDays[1]);
    assert.equal('distanceKm' in item, false);
  }
  assert.equal(sampleData.readiness.length, 9);
  assert.ok(sampleData.readiness.every(item => ['Sample workflow', 'Pending review', 'Commodity-specific review required', 'Evidence required'].includes(item.status)));
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
