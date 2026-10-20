import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { localizeNode } from './localizeNode';
import { loadLanguage, saveLanguage } from './presentation';
import type { Language } from './presentation';

const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'en', setLanguage: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => { try { return loadLanguage(window.localStorage); } catch { return 'en'; } });
  useEffect(() => {
    document.documentElement.lang = language === 'es' ? 'es-MX' : 'en';
    document.title = language === 'es' ? 'Jalisco Produce Export · Nopal fresco de El Grullo' : 'Jalisco Produce Export · Fresh nopal from El Grullo';
    try { saveLanguage(language, window.localStorage); } catch { /* Storage access itself can be blocked. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }

export function Localized({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return localizeNode(children, language);
}
