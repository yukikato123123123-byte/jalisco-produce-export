import {AdminLocalized as Localized,useAdminLanguage as useLanguage} from '../adminLocalization';
import {translateAdmin as translate} from '../adminI18n';
import './admin-pagination.css';
export type PageInfo={page?:number;pageSize?:number;total?:number;totalPages?:number};
export function AdminPagination({data,onPage,busy=false}:{data:PageInfo;onPage:(page:number)=>void;busy?:boolean}){
 const {language}=useLanguage();const {page=1,pageSize=10,total,totalPages=1}=data;
 if(total===undefined)return null;
 const numbers=[...new Set([1,page-1,page,page+1,totalPages])].filter(n=>n>=1&&n<=totalPages).sort((a,b)=>a-b);
 return <Localized><div className="admin-pagination"><p role="status"><span>Showing</span> {total?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,total)} <span>of</span> {total} · <span>Total</span> {total}</p>{totalPages>1&&<nav aria-label="Pagination"><button type="button" disabled={busy||page<=1} onClick={()=>onPage(page-1)}>Previous</button>{numbers.map((n,i)=><span key={n}>{i>0&&n>numbers[i-1]+1&&<span aria-hidden="true">…</span>}<button type="button" disabled={busy} aria-current={n===page?'page':undefined} aria-label={`${translate('Go to page',language)} ${n}`} onClick={()=>{if(n!==page)onPage(n);}}>{n}</button></span>)}<button type="button" disabled={busy||page>=totalPages} onClick={()=>onPage(page+1)}>Next</button></nav>}</div></Localized>;
}
