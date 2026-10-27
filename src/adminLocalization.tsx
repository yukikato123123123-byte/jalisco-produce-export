import {Children,cloneElement,createContext,isValidElement,useContext,useLayoutEffect,useState} from 'react';
import type {ReactElement,ReactNode} from 'react';
import {useLanguage} from './localization';
import {adminLanguageKey,adminLocale,translateAdmin,translateAdminError,resolveAdminLanguage} from './adminI18n';
import type {AdminLanguage} from './adminI18n';
const Context=createContext<{language:AdminLanguage;setLanguage:(value:AdminLanguage)=>void}|null>(null);
export function AdminLanguageProvider({children}:{children:ReactNode}){
 const global=useLanguage();const [language,setLanguage]=useState<AdminLanguage>(()=>{try{return resolveAdminLanguage(localStorage.getItem(adminLanguageKey),global.language);}catch{return global.language;}});
 useLayoutEffect(()=>{const previous=document.documentElement.lang;document.documentElement.lang=adminLocale(language);try{localStorage.setItem(adminLanguageKey,language);}catch{/* The current choice still works without storage. */}
 const clear=(event:Event)=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)event.target.setCustomValidity('');};
 const invalid=(event:Event)=>{const field=event.target;if(!(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement))return;const v=field.validity;field.setCustomValidity(translateAdmin(v.valueMissing?'Please complete this field.':v.typeMismatch?'Enter a valid email address.':v.tooShort?'The value is too short.':v.rangeUnderflow||v.rangeOverflow?'Enter a value within the allowed range.':v.stepMismatch?'Use the required numeric precision.':'Check the field format.',language));};
 document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea').forEach(field=>field.setCustomValidity(''));document.addEventListener('invalid',invalid,true);document.addEventListener('input',clear,true);document.addEventListener('change',clear,true);
 return()=>{document.documentElement.lang=previous;document.removeEventListener('invalid',invalid,true);document.removeEventListener('input',clear,true);document.removeEventListener('change',clear,true);};},[language]);
 return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export function useAdminLanguage(){const context=useContext(Context);if(!context)throw new Error('Administrator language context is required.');return context;}
function localize(node:ReactNode,language:AdminLanguage):ReactNode{
 if(typeof node==='number')return new Intl.NumberFormat(adminLocale(language),{maximumFractionDigits:20}).format(node);
 if(typeof node==='string')return translateAdmin(node,language);
 if(!isValidElement(node))return Array.isArray(node)?node.map(child=>localize(child,language)):node;
 const element=node as ReactElement<Record<string,unknown>>;if(element.props['data-no-translate'])return element;
 const props:Record<string,unknown>={};if(element.type==='option'&&element.props.value===undefined&&typeof element.props.children==='string')props.value=element.props.children;
 for(const key of ['title','aria-label','alt','placeholder','label','description'])if(typeof element.props[key]==='string')props[key]=translateAdmin(element.props[key],language);
 if(element.props.children!==undefined)props.children=Children.map(element.props.children as ReactNode,child=>localize(child,language));return cloneElement(element,props);
}
export function AdminLocalized({children}:{children:ReactNode}){const {language}=useAdminLanguage();return localize(children,language);}
export function AdminErrorText({message}:{message:string}){const {language}=useAdminLanguage();return translateAdminError(message,language);}
