import { gisDisclaimer, locationById, pointCategories, routeCategories } from './gisDemoData.ts';
import type { DemoLocation, DemoRoute } from './gisDemoData.ts';
import type { Language } from './presentation.ts';
import { translate } from './i18n.ts';
export interface DetailModel { title: string; status: string; description: string; rows: { label: string; value: string }[]; warning: string; }
export function locationDetails(point: DemoLocation, language: Language): DetailModel {
  const t = (value: string) => translate(value, language);
  return { title: point.name[language], status: t(point.provenance), description: point.description[language], warning: t(gisDisclaimer), rows: [
    { label: t('Feature ID'), value: point.id }, { label: t('Category'), value: t(pointCategories[point.category].label) },
    { label: t('Region'), value: point.region[language] },
    ...point.attributes.map(attribute => ({ label: t(attribute.label), value: attribute.value[language] })),
  ] };
}
export function routeDetails(route: DemoRoute, language: Language): DetailModel {
  const t = (value: string) => translate(value, language);
  return { title: route.name[language], status: t(route.provenance), description: t('Generalized corridor geometry, not a road-routing result or navigation directions.'), warning: t(gisDisclaimer), rows: [
    { label: t('Feature ID'), value: route.id }, { label: t('Category'), value: t(routeCategories[route.category].label) },
    { label: t('Origin'), value: locationById.get(route.originId)!.name[language] },
    { label: t('Destination'), value: locationById.get(route.destinationId)!.name[language] },
    { label: t('Scenario stops'), value: route.stopIds.map(id => `${id} · ${locationById.get(id)!.name[language]}`).join(' → ') },
    { label: t('Simulated distance (km)'), value: route.simulatedDistanceKm === null ? t('Not supplied') : String(route.simulatedDistanceKm) },
    { label: t('Simulated transit (hours)'), value: route.simulatedTransitHours === null ? t('Not supplied') : String(route.simulatedTransitHours) },
  ] };
}
// User-readable data uses textContent, never interpolated HTML. Leaflet accepts
// the returned element; language changes update open popups on the same layers.
export function detailElement(model: DetailModel): HTMLElement {
  const element = document.createElement('article');
  element.className = 'gis-popup';
  const heading = document.createElement('h3'); heading.textContent = model.title;
  const status = document.createElement('p'); status.className = 'gis-popup-status'; status.textContent = model.status;
  const description = document.createElement('p'); description.textContent = model.description;
  const list = document.createElement('dl');
  for (const row of model.rows) {
    const term = document.createElement('dt'); term.textContent = row.label;
    const value = document.createElement('dd'); value.textContent = row.value;
    list.append(term, value);
  }
  const warning = document.createElement('p'); warning.className = 'gis-popup-warning'; warning.textContent = model.warning;
  element.append(heading, status, description, list, warning);
  return element;
}
