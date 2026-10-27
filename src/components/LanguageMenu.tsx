import {useLanguage} from '../localization';
export function LanguageMenu({buttons=false}:{buttons?:boolean}){
 const {language,setLanguage}=useLanguage();
 if(buttons)return <div className="global-language-menu home-language-menu" role="group" aria-label="Language / Idioma" data-no-translate>
  <button type="button" lang="en" aria-label="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
  <span aria-hidden="true">|</span>
  <button type="button" lang="es" aria-label="Español" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>ES</button>
 </div>;
 return <label className="global-language-menu" data-no-translate><span>Language / Idioma</span><select aria-label="Language / Idioma" value={language} onChange={e=>setLanguage(e.target.value==='es'?'es':'en')}><option value="en" lang="en">English</option><option value="es" lang="es">Español</option></select></label>;
}
