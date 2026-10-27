import {useAdminLanguage} from '../adminLocalization';
import {adminLanguages,translateAdmin,validAdminLanguage} from '../adminI18n';
import './admin-language.css';
export function AdminLanguageMenu({label='Admin language'}:{label?:string}){const {language,setLanguage}=useAdminLanguage();return <label className="admin-language-menu"><span>{translateAdmin(label,language)}</span><select aria-label={translateAdmin(label,language)} value={language} onChange={e=>{if(validAdminLanguage(e.target.value))setLanguage(e.target.value);}} data-no-translate>{adminLanguages.map(([value,name])=><option key={value} value={value} lang="en">{name}</option>)}</select></label>;}
