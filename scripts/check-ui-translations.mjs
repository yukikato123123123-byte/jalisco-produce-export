import {adminUiFiles} from './check-admin-translations.mjs';
import {translateLegacy} from '../src/legacyI18n.ts';
import {translateAdmin} from '../src/adminI18n.ts';
// Static UI coverage only. No user records, credentials or network access.
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {translate} from '../src/i18n.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const candidates=new Map();
const proper=new Set(["NopaHua.", "NopaHua", "EN", "ES", "Espa\u00f1ol", "English", "Language / Idioma", "N", "ID", "T00:00:00Z", "UTC", "Total", "POST", "End", "Escape", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "TimeoutError", "Retry-After", "Content-Type", "application/json", "image/jpeg", "image/png", "image/webp", "en-US", "es-MX", "nopal.ops.effects", "Ritual", "nopal.voice.client", "privacyConsent", "replyConsent", "No", "meta[name=\"description\"]", "meta[name=\"theme-color\"]"]);
function nativeOrProtected(n){let child=n;for(let p=n.parent;p;child=p,p=p.parent){if(ts.isConditionalExpression(p)&&p.condition.getText()==='es'&&child===p.whenTrue)return true;if(ts.isJsxElement(p)&&p.openingElement.attributes.properties.some(a=>a.name?.text==='data-no-translate'&&!a.initializer))return true;}return false;}
function add(value,path){const v=value.replace(/[→←↑↓↗↘↟]/g,'').replace(/\s+/g,' ').trim();if(/[A-Za-z]/.test(v)&&!proper.has(v)&&!candidates.has(v))candidates.set(v,path);}
const paths=['src/main.tsx',...readdirSync(resolve(root,'src/components')).filter(x=>x.endsWith('.tsx')).map(x=>'src/components/'+x)];
for(const path of paths){const source=readFileSync(resolve(root,path),'utf8'),f=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function walk(n){if(!nativeOrProtected(n)){if(ts.isJsxText(n))add(n.text,path);if(ts.isStringLiteral(n)){const p=n.parent;if(ts.isJsxAttribute(p)){if(['title','aria-label','placeholder','alt','label','description'].includes(p.name.text))add(n.text,path);}else if(!(ts.isPropertyAssignment(p)&&p.name===n)&&!ts.isImportDeclaration(p)&&!ts.isExportDeclaration(p)&&!ts.isLiteralTypeNode(p)&&!/^[/#.?]|^https?:|^reviews\/|^M\d|^\(max-width:|^\(prefers-|^[a-z0-9_]+$|^[a-z0-9-]+(?: [a-z0-9-]+)*$/.test(n.text)&&!/[{}]|\.png|\.jpeg|\.jpg|\[href/.test(n.text))add(n.text,path);}}ts.forEachChild(n,walk);}walk(f);}
for(const path of ['worker/legacyAdmin.ts','worker/adminExtras.ts','worker/overview.ts','worker/reviews.ts','worker/inquiries.ts','worker/productImages.ts','worker/adminPreview.ts','worker/index.ts','worker/provider.ts','worker/admin.ts','worker/fields.ts','worker/retiredRoutes.ts','worker/nopalFeedback.ts','worker/nopalOperations.ts','worker/research.ts']){const f=ts.createSourceFile(path,readFileSync(resolve(root,path),'utf8'),ts.ScriptTarget.Latest,true);function walk(n){if(ts.isNewExpression(n)&&['Failure','ProviderFailure','Error'].includes(n.expression.getText(f))){const a=n.arguments?.[n.expression.getText(f)==='Error'?0:1];if(a&&ts.isStringLiteral(a))add(a.text,path);}ts.forEachChild(n,walk);}walk(f);}
const legacyFiles=new Set(['LegacyAdminPage','AdminDashboard','AdminNotifications','ProductImages','RegistrationReview','RecordDetailPanel','WorkspaceIcon','InquiriesPage','BuyerInquiry'].map(n=>'src/components/'+n+'.tsx').concat(['worker/legacyAdmin.ts','worker/adminExtras.ts','worker/overview.ts','worker/reviews.ts','worker/inquiries.ts','worker/productImages.ts','worker/adminPreview.ts']));
const missing=[...candidates].filter(([v,path])=>(legacyFiles.has(path)?translateLegacy(v,'es'):adminUiFiles.includes(path)?translateAdmin(v,'es'):translate(v,'es'))===v).map(([phrase,path])=>({phrase,path}));
console.log(JSON.stringify({languages:['en','es'],static_phrases_checked:candidates.size,missing,scope:'React application UI, admin metadata labels and static API error messages; user data, proper names and internal identifiers excluded'},null,2));
if(missing.length)process.exitCode=1;
