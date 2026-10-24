import { createContext, useContext, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {translate} from './i18n';
import { localizeNode } from './localizeNode';
import { loadLanguage, saveLanguage } from './presentation';
import type { Language } from './presentation';

const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'en', setLanguage: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => { try { return loadLanguage(window.localStorage); } catch { return 'en'; } });
  useLayoutEffect(() => {
    document.documentElement.lang = language === 'es' ? 'es-MX' : 'en';
    document.title = language === 'es' ? 'Jalisco Produce Export · Origen y conexión' : 'Jalisco Produce Export · Origin and connection';
    const fields=()=>document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea');
    fields().forEach(field=>field.setCustomValidity(''));
    const clear=(event:Event)=>{const field=event.target;if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement)field.setCustomValidity('');};
    const invalid=(event:Event)=>{const field=event.target;if(!(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement))return;const v=field.validity;const message=v.valueMissing?'Please complete this field.':v.typeMismatch?'Enter a valid email address.':v.tooShort?'The value is too short.':v.rangeUnderflow||v.rangeOverflow?'Enter a value within the allowed range.':v.stepMismatch?'Use the required numeric precision.':'Check the field format.';field.setCustomValidity(translate(message,language));};
    document.addEventListener('invalid',invalid,true);document.addEventListener('input',clear,true);document.addEventListener('change',clear,true);
    try { saveLanguage(language, window.localStorage); } catch { /* Storage access itself can be blocked. */ }
    return()=>{document.removeEventListener('invalid',invalid,true);document.removeEventListener('input',clear,true);document.removeEventListener('change',clear,true);};
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }

export function Localized({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return localizeNode(children, language);
}
