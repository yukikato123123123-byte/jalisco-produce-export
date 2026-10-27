import {legacySpanish as spanish} from './translations/legacy-admin-es.ts';
import type {Language} from './presentation.ts';
const cleanPhrase=(s:string)=>s.replace(/[→←↑↓↗↘↟]/g,'').replace(/\s+/g,' ').trim();
const translations:Record<string,string>={...Object.fromEntries(Object.entries(spanish).map(([k,v])=>[cleanPhrase(k),cleanPhrase(v)])),...spanish};
export function translateLegacy(text: string, language: Language): string {
  const rawDate=text.trim();
  if(/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(rawDate)&&Number.isFinite(Date.parse(rawDate)))return new Intl.DateTimeFormat(language==='es'?'es-MX':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(rawDate));
  if (language === 'en') return text;
  const source = cleanPhrase(text);
  let result = translations[source];
  if(!result){
    const limited=/^Enter a valid ([a-z_]+) \(maximum (\d+) characters\)\.$/.exec(source);
    const invalid=/^Enter a valid ([a-z_]+)\.$/.exec(source);
    const nonnegative=/^Enter a non-negative ([a-z_]+) up to 1 trillion\.$/.exec(source);
    const field=(key:string)=>translations[key.replaceAll('_',' ')]||key;
    if(limited)result=`Introduce un valor válido de ${field(limited[1])} (máximo ${limited[2]} caracteres).`;
    else if(invalid)result=`Introduce un valor válido de ${field(invalid[1])}.`;
    else if(nonnegative)result=`Introduce un valor de ${field(nonnegative[1])} no negativo de hasta un billón (10¹²).`;
    const consumed=' This recovery session was consumed; request a new code.';
    if(source.endsWith(consumed))result=translateLegacy(source.slice(0,-consumed.length),'es')+' Esta sesión de recuperación se consumió; solicita otro código.';
    const patterns:[RegExp,string][]=[[/^Welcome, (.*)\.$/,'Bienvenido, $1.'],[/^(\d+) public items on this page$/,'$1 productos públicos en esta página'],[/^(\d+) public (buyers?|producers?) on this page$/,'$1 perfiles públicos en esta página'],[/^Loading (buyers|producers)…$/,'Cargando perfiles…'],[/^Page (\d+)$/,'Página $1'],[/^· Page (\d+)$/,'· Página $1'],[/^Try again in (\d+)s$/,'Inténtalo en $1 s'],[/^Saved (.*)\.$/,'Guardado: $1.']];
    for(const [pattern,replacement] of patterns)if(pattern.test(source)){result=source.replace(pattern,replacement);break;}
  }
  if (!result) {
    result = source.replace(/^(\d+(?:[,.]\d+)?) MT \/ harvest$/, '$1 MT / cosecha')
      .replace(/^(\d+) cartons \/ harvest$/, '$1 cajas / cosecha')
      .replace(/^([\d,.]+) kg \/ carton$/, '$1 kg / caja')
      .replace(/^(\d+) cartons × (\d+) pallets$/, '$1 cajas × $2 tarimas');
    const colon = source.indexOf(': ');
    if (colon > 0 && translations[source.slice(0, colon)] && translations[source.slice(colon + 2)]) {
      result = `${translations[source.slice(0, colon)]}: ${translations[source.slice(colon + 2)]}`;
    }
  }
  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  return `${leading}${result}${trailing}`;
}
