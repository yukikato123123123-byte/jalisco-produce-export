import test from 'node:test';
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { localizeNode } from '../src/localizeNode.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { sampleData, verificationStates } from '../src/sampleData.ts';
import { views, viewLabels, nextView, loadLanguage, saveLanguage, languageStorageKey } from '../src/presentation.ts';
import { translate } from '../src/i18n.ts';
import { networkCoordinates } from '../src/gisNetwork.ts';
import { focusMap, refreshMap, mapPadding } from '../src/mapBehavior.ts';
import { validateInquiry } from '../src/inquiry.ts';

function mapPort(initialSize = { x: 1000, y: 500 }) {
  const calls = [];
  let size = initialSize;
  return {
    calls,
    getSize: () => size,
    stop: () => calls.push(['stop']),
    invalidateSize: options => { calls.push(['invalidate', options]); size = { x: 1000, y: 500 }; },
    fitBounds: (bounds, options) => calls.push(['bounds', bounds, options]),
    flyTo: (center, zoom, options) => calls.push(['fly', center, zoom, options]),
  };
}

test('four-view keyboard navigation wraps and supports Home and End', () => {
  assert.equal(views[0], 'producer');
  assert.equal(nextView('producer', 'ArrowRight'), 'logistics');
  assert.equal(nextView('producer', 'ArrowLeft'), 'readiness');
  assert.equal(nextView('readiness', 'ArrowRight'), 'producer');
  assert.equal(nextView('commercial', 'Home'), 'producer');
  assert.equal(nextView('logistics', 'End'), 'readiness');
  assert.equal(nextView('logistics', 'Enter'), 'logistics');
  assert.deepEqual(views.map(view => translate(viewLabels[view], 'es')), ['PRODUCTOR', 'LOGÍSTICA', 'COMERCIAL', 'PREPARACIÓN']);
});

test('language preference defaults to English, persists Spanish, and tolerates blocked storage', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(loadLanguage(storage), 'en');
  saveLanguage('es', storage);
  assert.equal(values.get(languageStorageKey), 'es');
  assert.equal(loadLanguage(storage), 'es');
  saveLanguage('en', storage);
  assert.equal(loadLanguage(storage), 'en');
  storage.setItem(languageStorageKey, 'invalid');
  assert.equal(loadLanguage(storage), 'en');
  assert.equal(loadLanguage(), 'en');
  assert.equal(loadLanguage({ getItem: () => { throw new Error('blocked'); } }), 'en');
  assert.doesNotThrow(() => saveLanguage('es', { setItem: () => { throw new Error('blocked'); } }));
});

test('overview frames the displayed GIS network with responsive marker/control padding', () => {
  const map = mapPort();
  assert.equal(focusMap(map, 'regional'), true);
  const [, bounds, options] = map.calls.find(call => call[0] === 'bounds');
  assert.deepEqual(bounds, networkCoordinates());
  assert.ok(options.paddingBottomRight[0] >= 100);
  const mobile = mapPadding(280, 390);
  assert.ok(mobile.paddingTopLeft[0] + mobile.paddingBottomRight[0] < 280);
  assert.ok(mobile.paddingTopLeft[1] + mobile.paddingBottomRight[1] < 390);
});

test('destination shortcuts fit the appropriate GIS extent using the same map', () => {
  const map = mapPort();
  for (const focus of ['texas', 'illinois', 'origin', 'regional']) focusMap(map, focus, true);
  const bounds = map.calls.filter(call => call[0] === 'bounds');
  assert.equal(bounds.length, 4);
  for (const [index, focus] of ['texas', 'illinois', 'origin', 'regional'].entries()) {
    assert.deepEqual(bounds[index][1], networkCoordinates(undefined, focus));
    assert.equal(bounds[index][2].animate, true);
  }
});

test('revealing a hidden Logistics tab invalidates cached zero dimensions before framing', () => {
  const map = mapPort({ x: 0, y: 0 });
  assert.equal(focusMap(map, 'regional'), false);
  assert.equal(map.calls.length, 0);
  assert.equal(refreshMap(map, 'regional'), true);
  assert.equal(map.calls[0][0], 'invalidate');
  assert.ok(map.calls.some(call => call[0] === 'bounds'));
  refreshMap(map, 'texas');
  assert.equal(map.calls.at(-1)[0], 'bounds');
  assert.deepEqual(map.calls.at(-1)[1], networkCoordinates(undefined, 'texas'));
});

test('critical status, logistics, price, and validation messages translate without changing data', () => {
  assert.equal(translate('INDICATIVE · NOT A QUOTATION', 'es'), 'PRECIO ORIENTATIVO · NO ES UNA COTIZACIÓN');
  assert.equal(translate('ILLUSTRATIVE LOGISTICS', 'es'), 'LOGÍSTICA ILUSTRATIVA');
  assert.equal(translate('Show Full Route', 'es'), 'Mostrar Ruta Completa');
  for (const item of Object.values(verificationStates)) {
    assert.notEqual(translate(item.label, 'es'), item.label);
    assert.notEqual(translate(`${item.label}: ${item.description}`, 'es'), `${item.label}: ${item.description}`);
  }
  const values = { company: '', email: '', destination: '', product: '', quantityKg: '', packaging: '', terms: '', questions: '' };
  for (const message of Object.values(validateInquiry(values))) assert.notEqual(translate(message, 'es'), message);
  assert.equal(translate('486 cartons / harvest', 'es'), '486 cajas / cosecha');
  assert.equal(translate('Fresh nopal', 'es'), 'Nopal fresco');
  assert.equal(translate('Pending confirmation', 'es'), 'Pendiente de confirmación');
  assert.equal(translate('Show Full Route', 'en'), 'Show Full Route');
  assert.equal(sampleData.supply.harvestTonnesLowerBound, 10);
});

test('all static rendered UI phrases and centralized descriptions have Spanish coverage', () => {
  const missing = new Set();
  const proper = new Set(['Jalisco Produce Export', 'Jalisco', 'JALISCO', 'TEXAS', 'Texas', 'ILLINOIS', 'Illinois', 'EL GRULLO', ', JALISCO', 'El Grullo, Jalisco', '· El Grullo', '&gt;', 'EN', 'ES', 'Español', 'MT', 'MT),', 'kg', 'kg =', 'N', '/ kg', '/ ILLINOIS']);
  const check = value => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (/[a-zA-Z]/.test(text) && !proper.has(text) && translate(text, 'es') === text) missing.add(text);
  };
  for (const path of ['../src/main.tsx', '../src/components/MarketMap.tsx', '../src/components/BusinessSections.tsx', '../src/components/BuyerInquiry.tsx', '../src/components/StatusBadge.tsx', '../src/components/SupplyMarketOverview.tsx']) {
    const file = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isJsxText(node)) check(node.text);
      if (ts.isJsxAttribute(node) && ['title', 'aria-label', 'placeholder', 'description', 'step', 'label'].includes(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  function walk(value, key = '') {
    if (typeof value === 'string' && !['id', 'state', 'status', 'carrier', 'market'].includes(key)) check(value);
    else if (Array.isArray(value)) value.forEach(item => walk(item));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => walk(entry, name));
  }
  walk(sampleData);
  walk(verificationStates);
  assert.deepEqual([...missing], []);
});


test('React presentation localization preserves option values, user text, and event handlers', () => {
  const onClick = () => {};
  const tree = createElement('section', {},
    createElement('button', { onClick, 'aria-label': 'Show Full Route' }, 'Show Full Route'),
    createElement('select', { defaultValue: sampleData.inquiry.products[0] },
      createElement('option', { value: sampleData.inquiry.products[0] }, sampleData.inquiry.products[0])),
    createElement('dd', { 'data-no-translate': true }, 'Product'),
    createElement('input', { placeholder: sampleData.inquiry.packagingPlaceholder }));
  const localized = localizeNode(tree, 'es');
  const output = renderToStaticMarkup(localized);
  assert.match(output, /Mostrar Ruta Completa/);
  assert.match(output, /aria-label="Mostrar Ruta Completa"/);
  assert.match(output, /value="Fresh nopal"/);
  assert.match(output, /Nopal fresco/);
  assert.match(output, /data-no-translate="true">Product/);
  assert.match(output, /Describa el empaque/);
  assert.equal(localized.props.children[0].props.onClick, onClick);
  assert.match(renderToStaticMarkup(localizeNode(tree, 'en')), /Show Full Route/);
});
