// Public staging demo only. This module has no database, auth or owner authority dependency.
import {stagingOrigin} from './environment.ts';
type PreviewEnvironment={AUTH_ENVIRONMENT?:string;AUTH_ORIGIN:string;SUPABASE_URL:string;ASSETS:{fetch(request:Request):Promise<Response>}};
type Row=Record<string,string|number|null>;
const rows:Record<string,Row[]>={
 accounts:[{id:'sample-producer',full_name:'Sample Producer',company:'Sample Produce Farm',country:'Mexico',role:'producer',state:'onboarded'},{id:'sample-buyer',full_name:'Sample Buyer',company:'Sample Buyer Company',country:'United States',role:'buyer',state:'onboarded'}],
 producers:[{id:'sample-producer',company:'Sample Produce Farm',country:'Mexico',region:'Jalisco',bio:'Synthetic farm profile for this preview.',profile_saved:1,public_products:1,total_products:2,state:'listed'}],
 buyers:[{id:'sample-buyer',company:'Sample Buyer Company',country:'United States',public_id:'sample-buyer-listing',state:'listed',interests:'Sample avocado and nopal'}],
 products:[{id:'sample-avocado',name:'Sample Avocado',producer:'Sample Produce Farm',category:'Fruit',quantity:25,unit:'kg',state:'public'},{id:'sample-nopal',name:'Sample Nopal',producer:'Sample Produce Farm',category:'Vegetable',quantity:10,unit:'kg',state:'draft'}],
 readiness:[{id:'sample-producer',company:'Sample Produce Farm',profile:'Sample profile',packaging:'Not assessed',quality_documents:'Not assessed',export_documents:'Not assessed',logistics:'Not assessed',state:'unverified'}],
 inquiries:[],security:[],grants:[],
};
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function adminPreview(request:Request,env:PreviewEnvironment):Promise<Response>{
 const url=new URL(request.url);
 if(env.AUTH_ENVIRONMENT!=='staging'||env.AUTH_ORIGIN!==stagingOrigin||url.origin!==stagingOrigin||env.SUPABASE_URL!=='https://heaswpawzuuijxurlfoz.supabase.co')return Response.json({error:'Not found.'},{status:404,headers});
 if(request.method!=='GET')return Response.json({error:'This preview is read-only.'},{status:405,headers:{...headers,Allow:'GET'}});
 if(url.pathname==='/admin/preview'){
  const response=await env.ASSETS.fetch(request),h=new Headers(response.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));
  return new Response(response.body,{status:response.status,headers:h});
 }
 const section=url.pathname.slice('/api/staging/admin-preview/'.length);
 const metadata={preview:true,read_only:true,data_source:'synthetic'};
 if(section==='overview')return Response.json({...metadata,counts:{account_profiles:2,producers:1,buyers:1,products:2,audit_events:0,grant_events:0},health:{data:'Synthetic sample records only',authentication:'No administrator session is granted by this preview',changes:'Read-only; no application records are modified'},recent:[]},{headers});
 if(!Object.hasOwn(rows,section))return Response.json({error:'Not found.'},{status:404,headers});
 const rawPage=url.searchParams.get('page')??'1';if(!/^[1-9][0-9]{0,5}$/.test(rawPage))return Response.json({error:'Enter a valid page.'},{status:400,headers});
 const page=Number(rawPage),q=(url.searchParams.get('q')??'').slice(0,120).toLowerCase(),status=(url.searchParams.get('status')??'').slice(0,30);
 const filtered=rows[section].filter(row=>(!q||Object.values(row).join(' ').toLowerCase().includes(q))&&(!status||row.state===status));
 return Response.json({...metadata,items:filtered.slice((page-1)*50,page*50),page,hasMore:filtered.length>page*50,message:['security','grants'].includes(section)?'Real approval and audit records are not exposed in this preview.':'Synthetic sample records — read-only preview.'},{headers});
}
