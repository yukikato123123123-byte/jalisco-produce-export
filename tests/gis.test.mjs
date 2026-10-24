import { initialView } from '../src/presentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { pointSymbolSvg, routeDecoration } from '../src/gisSymbols.ts';
import { logisticsBasemap } from '../src/mapBasemap.ts';
import { demoOriginId, markerHierarchy, routePaint } from '../src/gisDepth.ts';
import { demoLocations, demoRoutes, gisNotice, gisDisclaimer, layerDefinitions, locationById, pointCategories, routeCategories } from '../src/gisDemoData.ts';
import { applyLayerVisibility, clusterLocations, defaultLayers, displayedNetwork, layerCount, networkCoordinates } from '../src/gisNetwork.ts';
import { locationDetails, routeDetails } from '../src/gisDetails.ts';
import { focusMap } from '../src/mapBehavior.ts';
import { translate } from '../src/i18n.ts';
import { sampleData } from '../src/sampleData.ts';
import { views } from '../src/presentation.ts';

function validCoordinates([latitude, longitude]) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180;
}
test('GIS dataset has exactly 42 distinct fictional points and 20 routes, with valid geographic coordinates', () => {
  assert.equal(demoLocations.length, 42);
  assert.equal(demoRoutes.length, 20);
  assert.equal(new Set([...demoLocations, ...demoRoutes].map(item => item.id)).size, 62);
  assert.equal(new Set(demoLocations.map(point => point.coordinates.join(','))).size, 42);
  assert.deepEqual(Object.fromEntries(layerDefinitions.map(layer => [layer.id, layerCount(layer.id)])), { production: 12, packing: 6, logistics: 12, market: 12, routes: 20 });
  for (const point of demoLocations) {
    assert.ok(validCoordinates(point.coordinates), point.id);
    assert.equal(point.provenance, 'DEMO / SIMULATED');
    assert.ok(point.attributes.length >= 2);
    if (point.category === 'production') {
      assert.equal(point.region.en, 'Jalisco, Mexico');
      assert.ok(point.coordinates[0] > 19 && point.coordinates[0] < 23 && point.coordinates[1] > -106 && point.coordinates[1] < -101);
    }
  }
  const markets = demoLocations.filter(point => point.category === 'market');
  assert.equal(markets.filter(point => point.region.en === 'Texas, U.S.').length, 6);
  assert.equal(markets.filter(point => point.region.en === 'Illinois, U.S.').length, 6);
});

test('every route has valid endpoints and stop geometry; all 42 locations form one connected network', () => {
  const neighbors = new Map(demoLocations.map(point => [point.id, new Set()]));
  for (const route of demoRoutes) {
    assert.equal(route.provenance, 'DEMO / SIMULATED');
    assert.equal(route.originId, route.stopIds[0]);
    assert.equal(route.destinationId, route.stopIds.at(-1));
    assert.deepEqual(route.coordinates[0], locationById.get(route.originId).coordinates);
    assert.deepEqual(route.coordinates.at(-1), locationById.get(route.destinationId).coordinates);
    assert.ok(route.coordinates.every(validCoordinates));
    for (const [index, id] of route.stopIds.entries()) {
      assert.ok(locationById.has(id), id);
      assert.ok(route.coordinates.some(coordinate => coordinate.every((value, axis) => value === locationById.get(id).coordinates[axis])));
      if (index) { neighbors.get(id).add(route.stopIds[index - 1]); neighbors.get(route.stopIds[index - 1]).add(id); }
    }
    // Distances and durations are deliberately absent, never inferred from lines.
    assert.equal(route.simulatedDistanceKm, null);
    assert.equal(route.simulatedTransitHours, null);
  }
  const reached = new Set();
  const queue = ['P01'];
  while (queue.length) {
    const id = queue.pop();
    if (reached.has(id)) continue;
    reached.add(id); queue.push(...neighbors.get(id));
  }
  assert.equal(reached.size, 42);
  assert.deepEqual(new Set(demoRoutes.map(route => route.category)), new Set(['collection', 'refrigerated', 'border', 'distribution']));
});

test('all five layers filter independently and drive actual add/remove operations', () => {
  assert.equal(displayedNetwork(defaultLayers).locations.length, 42);
  for (const { id } of layerDefinitions) {
    const visibility = { ...defaultLayers, [id]: false };
    const result = displayedNetwork(visibility);
    assert.equal(result.routes.length, id === 'routes' ? 0 : 20);
    assert.equal(result.locations.length, id === 'routes' ? 42 : 42 - layerCount(id));
    assert.ok(result.locations.every(point => visibility[point.category]));
    const actions = [];
    const map = {};
    const groups = Object.fromEntries(layerDefinitions.map(layer => [layer.id, { addTo: target => { assert.equal(target, map); actions.push([layer.id, 'add']); }, remove: () => actions.push([layer.id, 'remove']) }]));
    applyLayerVisibility(map, groups, visibility);
    assert.equal(actions.length, 5);
    assert.deepEqual(actions.filter(([, action]) => action === 'remove'), [[id, 'remove']]);
    applyLayerVisibility(map, groups, defaultLayers);
    assert.ok(actions.slice(5).every(([, action]) => action === 'add'));
  }
  const off = Object.fromEntries(layerDefinitions.map(layer => [layer.id, false]));
  assert.deepEqual(displayedNetwork(off), { locations: [], routes: [] });
  assert.deepEqual(networkCoordinates(off), []);
  assert.equal(focusMap({ getSize: () => ({ x: 800, y: 600 }), stop: () => assert.fail('empty network must not move map') }, 'regional', false, off), false);
});

test('overview includes route vertices and all regions; focused extents respect filters', () => {
  const full = networkCoordinates();
  for (const point of demoLocations) assert.ok(full.some(coordinate => coordinate === point.coordinates));
  assert.ok(full.length > 42);
  for (const [view, ids] of Object.entries({ origin: ['P01', 'C06'], border: ['H05', 'H06', 'H07'], us: ['H07', 'U03', 'U12'], texas: ['U01', 'U03', 'U06'], illinois: ['U07', 'U11', 'U12'] })) {
    const extent = networkCoordinates(defaultLayers, view);
    assert.ok(extent.length > 0, view);
    for (const id of ids) assert.ok(extent.includes(locationById.get(id).coordinates), `${view}: ${id}`);
    if (view !== 'origin') assert.ok(!extent.includes(locationById.get('P01').coordinates));
  }
  const onlyProduction = { production: true, packing: false, logistics: false, market: false, routes: false };
  assert.equal(networkCoordinates(onlyProduction).length, 12);
  assert.equal(networkCoordinates(onlyProduction, 'illinois').length, 0);
});

test('overview clustering preserves every enabled feature and exposes individual points at local zoom', () => {
  const clustered = clusterLocations(demoLocations, 4);
  assert.ok(clustered.length < 42 && clustered.length > 5);
  assert.ok(clustered.some(cluster => cluster.points.length > 1));
  assert.equal(new Set(clustered.flatMap(cluster => cluster.points.map(point => point.id))).size, 42);
  assert.ok(clustered.every(cluster => validCoordinates(cluster.coordinates)));
  const expanded = clusterLocations(demoLocations, 13);
  assert.equal(expanded.length, 42);
  assert.ok(expanded.every(cluster => cluster.points.length === 1));
  const filtered = displayedNetwork({ ...defaultLayers, production: false }).locations;
  assert.ok(clusterLocations(filtered, 4).flatMap(cluster => cluster.points).every(point => point.category !== 'production'));
  assert.deepEqual(clusterLocations([], 4), []);
});

test('all feature/route details, layers, quick views and mandatory notices are bilingual', () => {
  assert.equal(gisNotice, 'DEMO DATA — SIMULATED LOCATIONS & ROUTES');
  assert.equal(translate(gisNotice, 'es'), 'DATOS DE DEMOSTRACIÓN — UBICACIONES Y RUTAS SIMULADAS');
  const labels = [gisNotice, gisDisclaimer, 'DEMO / SIMULATED', 'Border Corridor', 'US Markets', 'Full Network', 'GIS layers', 'Layer visibility', 'Restore all layers', 'Displayed demo locations', 'Displayed route segments', 'Select cluster to expand', 'Demo locations', ...Object.values(pointCategories).map(value => value.label), ...Object.values(routeCategories).map(value => value.label)];
  for (const label of labels) assert.notEqual(translate(label, 'es'), label, label);
  for (const [items, details] of [[demoLocations, locationDetails], [demoRoutes, routeDetails]]) {
    for (const item of items) {
      const english = details(item, 'en'); const spanish = details(item, 'es');
      assert.equal(english.status, 'DEMO / SIMULATED');
      assert.equal(spanish.status, 'DEMOSTRACIÓN / SIMULADO');
      assert.notEqual(english.title, spanish.title);
      assert.notEqual(english.description, spanish.description);
      assert.notEqual(english.warning, spanish.warning);
      assert.ok(english.rows.some(row => row.value === item.id));
      for (const [index, row] of english.rows.entries()) assert.notEqual(row.label, spanish.rows[index].label, row.label);
      if ('attributes' in item) for (const attribute of item.attributes) assert.notEqual(translate(attribute.label, 'es'), attribute.label);
      else assert.equal(english.rows.at(-1).value, 'Not supplied');
    }
  }
});

test('expanded map stays exclusively in the existing Logistics tab and does not alter producer facts', () => {
  const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.deepEqual(views, ['producer', 'logistics', 'commercial', 'readiness']);
  assert.equal((source.match(/<MarketMap /g) ?? []).length, 1);
  assert.doesNotMatch(source, /LogisticsScenarios/);
  assert.match(source, /id="panel-logistics"[^>]*hidden=\{active !== 'logistics'\}[\s\S]*?<MarketMap active=\{active === 'logistics'\}/);
  assert.equal(initialView(''), 'producer');
  assert.equal(sampleData.supply.cartonCount, 486);
  assert.equal(sampleData.supply.harvestWeightDescription, 'Slightly more than 10 metric tonnes');
  assert.equal(sampleData.supply.cartonNetKg, null);
  assert.ok(sampleData.pricing.every(item => item.usdPerKg === null));
});


test('legend and map share exact ordered category labels, distinct vector symbols and route patterns', () => {
  assert.deepEqual(Object.values(pointCategories).map(item => item.label), ['Production Sites', 'Collection & Packing', 'Logistics & Cold Chain', 'US Markets & Distribution']);
  assert.deepEqual(Object.values(routeCategories).map(item => item.label), ['Local collection', 'Refrigerated corridor', 'Border scenario', 'Market distribution']);
  const icons = Object.keys(pointCategories).map(pointSymbolSvg);
  assert.equal(new Set(icons).size, 4);
  for (const icon of icons) { assert.match(icon, /<svg.*viewBox="0 0 24 24"/); assert.doesNotMatch(icon, /<script|<image|https?:\/\/(?!www.w3.org)/); }
  assert.equal(new Set(Object.values(routeCategories).map(item => item.dashArray ?? 'solid')).size, 4);
  assert.equal(routeCategories.border.decoration, 'border');
  assert.equal(routeCategories.distribution.decoration, 'arrow');
  for (const route of demoRoutes) {
    const snapshot = JSON.stringify(route);
    const accent = routeDecoration(route);
    assert.ok(validCoordinates(accent.coordinates)); assert.ok(Number.isFinite(accent.angle));
    assert.equal(JSON.stringify(route), snapshot);
  }
});

test('legend renders bilingual labels in order and reflects the existing layer selection', async () => {
  // Render actual React markup using the existing Vite transform; no browser.
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { MapLegend } = await server.ssrLoadModule('/src/components/MapLegend.tsx');
    for (const language of ['en', 'es']) {
      const visible = { ...defaultLayers, production: false, market: false, routes: false };
      const output = renderToStaticMarkup(createElement(MapLegend, { visible, language }));
      const labels = [...Object.values(pointCategories), ...Object.values(routeCategories)].map(item => translate(item.label, language).replaceAll('&', '&amp;'));
      let position = -1;
      for (const label of labels) { const next = output.indexOf(label); assert.ok(next > position, label); position = next; }
      assert.equal((output.match(/<svg /g) ?? []).length, 8);
      assert.equal((output.match(/data-active="false"/g) ?? []).length, 6);
      assert.equal((output.match(/data-active="true"/g) ?? []).length, 2);
      assert.equal((output.match(new RegExp(`>${translate('Hidden', language)}<`, 'g')) ?? []).length, 6);
      for (const label of ['Locations', 'Routes', 'Map legend', 'Layer visibility']) assert.ok(output.includes(translate(label, language)));
      const restored = renderToStaticMarkup(createElement(MapLegend, { visible: defaultLayers, language }));
      assert.equal((restored.match(/data-active="true"/g) ?? []).length, 8);
      assert.doesNotMatch(restored, /data-active="false"/);
    }
  } finally { await server.close(); }
});


test('public basemap uses official OSM tiles, visible attribution and tile-only origin referrer without credentials', () => {
  assert.equal(logisticsBasemap.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(logisticsBasemap.provider, 'OpenStreetMap');
  assert.equal(logisticsBasemap.style, 'Standard');
  assert.equal(logisticsBasemap.maxZoom, 19);
  assert.equal(logisticsBasemap.referrerPolicy, 'origin');
  assert.ok(logisticsBasemap.attribution.includes('OpenStreetMap'));
  assert.ok(logisticsBasemap.attribution.includes('https://www.openstreetmap.org/copyright'));
  assert.doesNotMatch(logisticsBasemap.url, /api_key|token|\?|stadiamaps/i);
});

test('botanical colors remain legible on ivory and popup accents match their categories', () => {
  function luminance(hex) {
    const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  for (const item of [...Object.values(pointCategories), ...Object.values(routeCategories)]) {
    const contrast = (luminance('#fffcf5') + .05) / (luminance(item.color) + .05);
    assert.ok(contrast >= 4.5, `${item.label}: ${contrast}`);
  }
  for (const point of demoLocations) assert.equal(locationDetails(point, 'en').color, pointCategories[point.category].color);
  for (const route of demoRoutes) assert.equal(routeDetails(route, 'es').color, routeCategories[route.category].color);
});


test('decorative route depth retains category patterns with one interactive stroke and no spatial measurements', () => {
  const snapshot = JSON.stringify(demoRoutes);
  for (const route of demoRoutes) {
    const paint = routePaint(route.category);
    const category = routeCategories[route.category];
    assert.deepEqual(Object.values(paint).filter(stroke => stroke.interactive), [paint.hit]);
    assert.equal(paint.hit.opacity, 0);
    assert.ok(paint.hit.weight > paint.shadow.weight);
    assert.ok(paint.shadow.weight > paint.primary.weight && paint.primary.weight > paint.highlight.weight);
    assert.equal(paint.primary.color, category.color);
    for (const stroke of [paint.shadow, paint.primary, paint.highlight]) {
      assert.equal(stroke.dashArray, category.dashArray);
      assert.equal(stroke.interactive, false);
      assert.ok(stroke.opacity > 0 && stroke.opacity <= 1);
      assert.equal('coordinates' in stroke, false);
      assert.equal('elevation' in stroke, false);
    }
  }
  assert.equal(JSON.stringify(demoRoutes), snapshot);
});

test('origin emphasis references an existing fictional collection origin and labels depth in both languages', () => {
  const origin = locationById.get(demoOriginId);
  assert.equal(demoOriginId, demoRoutes.find(route => route.category === 'collection').originId);
  assert.equal(origin.provenance, 'DEMO / SIMULATED');
  assert.equal(origin.category, 'production');
  assert.deepEqual(markerHierarchy([origin]), { origin: true, border: false });
  assert.equal(markerHierarchy(demoLocations).origin, true);
  assert.equal(markerHierarchy([locationById.get('H07')]).border, true);
  assert.deepEqual(markerHierarchy([locationById.get('U03')]), { origin: false, border: false });
  for (const label of ['Demo origin reference', '2.5D · Illustrative depth', 'Visual depth only · No elevation data or verified farm location.']) assert.notEqual(translate(label, 'es'), label);
  assert.equal(sampleData.supply.cartonCount, 486);
  assert.equal(sampleData.supply.harvestTonnes, null);
  assert.equal(demoLocations.length, 42);
});
