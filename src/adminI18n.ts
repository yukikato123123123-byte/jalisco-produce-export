import {translate} from './i18n.ts';
import {adminTranslations} from './translations/admin.ts';
export const adminLanguages=[['en','English'],['es','Spanish'],['ko','Korean'],['my','Myanmar'],['ja','Japanese']] as const;
export type AdminLanguage=typeof adminLanguages[number][0];
export const adminLanguageKey='nopahua.admin.language';
export const adminLocale=(language:AdminLanguage)=>({en:'en-US',es:'es-MX',ko:'ko-KR',my:'my-MM',ja:'ja-JP'}[language]);
export const validAdminLanguage=(value:unknown):value is AdminLanguage=>adminLanguages.some(([code])=>code===value);
export const resolveAdminLanguage=(stored:unknown,fallback:'en'|'es'):AdminLanguage=>validAdminLanguage(stored)?stored:fallback;
export function translateAdmin(text:string,language:AdminLanguage):string{
 const source=text.replace(/[→←↑↓↗↘↟]/g,'').replace(/\s+/g,' ').trim();
 if(/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(source)&&Number.isFinite(Date.parse(source)))return new Intl.DateTimeFormat(adminLocale(language),{dateStyle:'medium',timeStyle:'short'}).format(new Date(source));
 if(language==='en')return text;
 const canonical:Record<string,string>={requested:'Requested',received:'New',reviewing:'Reviewing',resolved:'Resolved',archived:'Archived',allowed:'Allowed',revoked:'Revoked',draft:'Draft',public:'Public',private:'Private',approved:'Approved',rejected:'Rejected',pending:'Pending',deleted:'Deleted'};
 const phrase=canonical[source]??source;
 if(language==='es')return adminTranslations[phrase]?.es??({'Admin language':'Idioma de administración','The request could not be completed. Please try again.':'No se pudo completar la solicitud. Inténtalo de nuevo.','Draft':'Borrador','Public':'Público','Private':'Privado','Approved':'Aprobado','Rejected':'Rechazado','Pending':'Pendiente','Deleted':'Eliminado'}[phrase]??translate(phrase,'es'));
 return adminTranslations[phrase]?.[language]??text;
}
export function translateAdminError(text:string,language:AdminLanguage){return language==='en'||adminTranslations[text.trim()]?translateAdmin(text,language):translateAdmin('The request could not be completed. Please try again.',language);}
