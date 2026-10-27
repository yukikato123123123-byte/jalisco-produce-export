import type {Database} from './authState.ts';
import {Failure} from './provider.ts';
export const ADMIN_PAGE_SIZE=10;
export function adminPage(params:URLSearchParams,key='page'){const raw=params.get(key)??'1';if(!/^[1-9][0-9]{0,5}$/.test(raw))throw new Failure(400,'Enter a valid page.');return Number(raw);}
// Filtering, total, clamping and page rows share one database snapshot. Only ten
// records cross the Worker boundary; no count is inferred from a returned slice.
export async function paginateAdmin(db:Database,query:string,values:unknown[],order:string,page:number){
 const result=await db.prepare(`WITH records AS MATERIALIZED (${query}), bounds AS (SELECT count(*) AS total,MAX(1,(count(*)+9)/10) AS pages,MIN(?,MAX(1,(count(*)+9)/10)) AS current FROM records) SELECT json_object('page',current,'pageSize',10,'total',total,'totalPages',pages,'hasMore',json(CASE WHEN current<pages THEN 'true' ELSE 'false' END),'items',json((SELECT json_group_array(json(row)) FROM (SELECT row FROM records ORDER BY ${order} LIMIT 10 OFFSET ((SELECT current FROM bounds)-1)*10)))) AS data FROM bounds`).bind(...values,page).first<{data:string}>();
 if(!result)throw new Failure(503,'List data is unavailable.');
 return JSON.parse(result.data) as {items:(Record<string,string|number|null>&{id:string})[];page:number;pageSize:number;total:number;totalPages:number;hasMore:boolean};
}
