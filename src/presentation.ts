export const views = ['producer', 'logistics', 'commercial', 'readiness'] as const;
export type PresentationView = typeof views[number];
export type Language = 'en' | 'es';
export const languageStorageKey = 'jalisco-produce-export.language';
export const viewLabels: Record<PresentationView, string> = { producer: 'PRODUCER', logistics: 'LOGISTICS', commercial: 'COMMERCIAL', readiness: 'READINESS' };

export function nextView(current: PresentationView, key: string): PresentationView {
  const index = views.indexOf(current);
  if (key === 'Home') return views[0];
  if (key === 'End') return views[views.length - 1];
  if (key === 'ArrowRight' || key === 'ArrowDown') return views[(index + 1) % views.length];
  if (key === 'ArrowLeft' || key === 'ArrowUp') return views[(index + views.length - 1) % views.length];
  return current;
}
export function loadLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try { return storage?.getItem(languageStorageKey) === 'es' ? 'es' : 'en'; } catch { return 'en'; }
}
export function saveLanguage(language: Language, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(languageStorageKey, language); } catch { /* Storage can be unavailable; React state still works. */ }
}
