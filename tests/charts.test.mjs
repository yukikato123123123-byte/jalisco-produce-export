import test from 'node:test';
import assert from 'node:assert/strict';
import { URL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
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

test('the real chart component renders all three figures in English and Spanish', async () => {
  // Use Vite's existing TSX transform and React server rendering, not a browser.
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { SupplyMarketOverview } = await server.ssrLoadModule('/src/components/SupplyMarketOverview.tsx');
    for (const language of ['en', 'es']) {
      const output = renderToStaticMarkup(createElement(SupplyMarketOverview, { language }));
      assert.equal((output.match(/<figure /g) ?? []).length, 3);
      assert.equal((output.match(/<svg /g) ?? []).length, 2);
      assert.equal((output.match(/class="unconfirmed-stage"/g) ?? []).length, 5);
      assert.match(output, /486/);
      assert.match(output, /&gt; 10/);
      assert.ok(output.includes(translate('Supply & Market Overview', language).replace(/&/g, '&amp;')));
      assert.match(output, new RegExp(translate('Pending confirmation', language)));
      assert.match(output, new RegExp(translate('Evidence required', language)));
      assert.doesNotMatch(output, /(?:\s|<)hidden(?:=|\s|>)|display:\s*none|\b\d+%|NaN|US\$/);
    }
    const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
    assert.match(main, /useState<PresentationView>\('producer'\)/);
    assert.match(main, /<SupplyMarketOverview language=\{language\}\/>/);
  } finally { await server.close(); }
});
