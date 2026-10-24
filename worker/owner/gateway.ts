import {OWNER_ORIGIN,OWNER_SCOPE,canonical} from './crypto.ts';
import {GRANT_PROTOCOL} from './grants.ts';
import type {OwnerNamespace} from './router.ts';
import {Failure} from '../provider.ts';
export type GatewayEnvironment={OWNER_ADMIN_MODE?:string;OWNER_ROOT_PUBLIC_KEY?:string;OWNER_GRANT_ACTIVATION?:string;OWNER_AUTHORITY?:OwnerNamespace;AUTH_ENVIRONMENT?:string;AUTH_ORIGIN:string;SUPABASE_URL:string};
// Presence of any owner enrollment configuration disables the legacy D1-only path.
export function usesOwnerGateway(env:GatewayEnvironment){return env.OWNER_ADMIN_MODE!==undefined||env.OWNER_ROOT_PUBLIC_KEY!==undefined||env.OWNER_GRANT_ACTIVATION!==undefined||env.OWNER_AUTHORITY!==undefined;}
export async function ownerAdmin(env:GatewayEnvironment,body:Record<string,unknown>):Promise<Response>{
 if(env.OWNER_ADMIN_MODE!==GRANT_PROTOCOL||!env.OWNER_ROOT_PUBLIC_KEY||!env.OWNER_GRANT_ACTIVATION||!env.OWNER_AUTHORITY||env.AUTH_ENVIRONMENT!=='staging'||env.AUTH_ORIGIN!==OWNER_ORIGIN||env.SUPABASE_URL!==`https://${OWNER_SCOPE.project_ref}.supabase.co`)throw new Failure(503,'Owner administrator gateway is not configured.');
 return env.OWNER_AUTHORITY.get(env.OWNER_AUTHORITY.idFromName(canonical(OWNER_SCOPE))).fetch(new Request(OWNER_ORIGIN+'/internal/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
}
export async function ownerAdminHint(env:GatewayEnvironment,user:string){const r=await ownerAdmin(env,{kind:'check',user});if(!r.ok)throw new Failure(r.status,'Owner administrator verification is unavailable.');return (await r.json() as {is_admin:boolean}).is_admin===true;}
