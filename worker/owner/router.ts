import {OWNER_ORIGIN,OWNER_SCOPE,canonical} from './crypto.ts';
export interface OwnerNamespace {idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}
// Merely declaring the optional binding does not enable/provision any remote resource.
export async function ownerRoute(request:Request,namespace?:OwnerNamespace):Promise<Response>{
 if(!namespace||new URL(request.url).origin!==OWNER_ORIGIN)return Response.json({error:'Owner recovery is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return namespace.get(namespace.idFromName(canonical(OWNER_SCOPE))).fetch(request);
}
