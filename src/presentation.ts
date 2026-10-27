export type Language='en'|'es';
export const languageStorageKey='jalisco-produce-export.language';
export function loadLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try { return storage?.getItem(languageStorageKey) === 'es' ? 'es' : 'en'; } catch { return 'en'; }
}
export function saveLanguage(language: Language, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(languageStorageKey, language); } catch { /* Storage can be unavailable; React state still works. */ }
}
