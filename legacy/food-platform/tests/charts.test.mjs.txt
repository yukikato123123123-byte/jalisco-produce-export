import { initialView } from '../src/presentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { URL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { demoData } from '../src/demoData.ts';
import { sampleData } from '../src/sampleData.ts';
import { translate } from '../src/i18n.ts';

test('chart models share reported harvest data and leave market metrics unknown', () => {
  assert.equal(sampleData.overview.harvest, sampleData.supply);
  assert.deepEqual(sampleData.overview.markets.map(item => item.name), ['Texas', 'Illinois']);
  for (const market of sampleData.overview.markets) {
    for (const field of ['buyerCount', 'demandKg', 'usdPerKg', 'freightUsd', 'distanceKm', 'transitDays']) assert.equal(market[field], null);
  }
  assert.equal(sampleData.overview.readiness.length, 5);
  assert.ok(sampleData.overview.readiness.every(stage => stage.completed === false && stage.state === 'pending'));
  assert.ok(sampleData.overview.readiness.every(stage => ['Pending confirmation', 'Evidence required'].includes(stage.status)));
  assert.equal('readinessPercentage' in sampleData.overview, false);
});

test('all chart headings, statuses, and descriptions have Spanish translations', () => {
  const labels = ['Supply & Market Overview', 'Harvest & cartons', 'Texas vs Illinois', 'Export-readiness review', 'Slightly more than', 'Pending confirmation', 'Evidence required'];
  for (const label of labels) assert.notEqual(translate(label, 'es'), label);
  for (const stage of sampleData.overview.readiness) assert.notEqual(translate(stage.label, 'es'), stage.label);
  assert.equal(translate('Supply & Market Overview', 'es'), 'Panorama de Oferta y Mercados');
});

test('rendered bilingual charts preserve reported facts and disclose fictional metrics in each demo figure', async () => {
  // Use Vite's existing TSX transform and React server rendering, not a browser.
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { SupplyMarketOverview } = await server.ssrLoadModule('/src/components/SupplyMarketOverview.tsx');
    for (const language of ['en', 'es']) {
      const output = renderToStaticMarkup(createElement(SupplyMarketOverview, { language }));
      assert.equal((output.match(/<figure /g) ?? []).length, 4);
      assert.equal((output.match(/<svg /g) ?? []).length, 3);
      assert.equal((output.match(/class="unconfirmed-stage"/g) ?? []).length, 5);
      assert.match(output, /486/);
      assert.match(output, /&gt; 10/);
      assert.ok(output.includes(translate('Supply & Market Overview', language).replace(/&/g, '&amp;')));
      assert.match(output, new RegExp(translate('Pending confirmation', language)));
      for (const label of ['Reported', 'Pending Verification', 'Demo Only', demoData.disclaimer, demoData.warning, demoData.priceAssumptions, demoData.logisticsAssumptions]) assert.ok(output.includes(translate(label, language)), label);
      const figures = [...output.matchAll(/<figure [\s\S]*?<\/figure>/g)].map(match => match[0]);
      assert.ok(!figures[0].includes('1.20') && !figures[0].includes('3,200'));
      assert.ok(figures[0].includes(translate('486 cartons and slightly more than 10 metric tonnes, reported by Eduardo.', language)));
      for (const figure of figures.slice(2)) assert.ok(figure.includes(translate(demoData.disclaimer, language)));
      for (const unit of ['USD / kg', 'Days / scenario', 'USD / vehicle']) assert.ok(output.includes(translate(unit, language)));
      for (const market of demoData.markets) {
        assert.ok(output.includes(market.priceUsdPerKg.toFixed(2)));
        assert.ok(output.includes(new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US').format(market.freightUsdPerVehicle)));
      }
      if (language === 'es') {
        assert.doesNotMatch(output, /DEMO DATA|Demo Only|Pending Verification|Days \/ scenario|USD \/ vehicle/);
        assert.match(output, /<title>Texas: 3 Días \/ escenario<\/title>/);
      }
      assert.doesNotMatch(output, /(?:\s|<)hidden(?:=|\s|>)|display:\s*none|\b\d+%|NaN|US\$/);
    }
    const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
    assert.equal(initialView(''), 'producer');
    assert.match(main, /<SupplyMarketOverview language=\{language\}\/>/);
  } finally { await server.close(); }
});


test('fictional data is isolated from producer facts, fully disclosed, and fits zero-based chart scales', () => {
  assert.equal(demoData.disclaimer, 'DEMO DATA — NOT A REAL OFFER OR QUOTE');
  assert.match(demoData.warning, /Fictional.*not verified carrier quotes, confirmed routes/);
  assert.match(demoData.priceAssumptions, /USD per kg.*Invented.*excluded/);
  assert.match(demoData.logisticsAssumptions, /hypothetical refrigerated vehicle.*No border crossing or route is selected/);
  for (const market of demoData.markets) {
    for (const field of Object.keys(demoData.axes)) assert.ok(market[field] > 0 && market[field] <= demoData.axes[field]);
    assert.ok(!sampleData.pricing.some(value => value.usdPerKg === market.priceUsdPerKg));
  }
  for (const [key, text] of Object.entries(demoData)) if (typeof text === 'string') assert.notEqual(translate(text, 'es'), text, key);
  assert.equal(sampleData.supply.cartonCount, 486);
  assert.equal(sampleData.supply.harvestWeightDescription, 'Slightly more than 10 metric tonnes');
  assert.equal(sampleData.supply.harvestTonnes, null);
  assert.equal(sampleData.supply.cartonNetKg, null);
  assert.ok(sampleData.pricing.every(value => value.usdPerKg === null));
  assert.ok(sampleData.logistics.every(value => value.usdPerLoad === null && value.transitDays === null));
});
