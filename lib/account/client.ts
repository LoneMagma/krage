import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {defaultRoomURL} from '../game/room-client';
export const accountsConfigured=!!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let client:SupabaseClient|null=null;
export function authClient(){
 if(!accountsConfigured)return null;
 return client??=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
}
export async function accountRequest<T=unknown>(token:string,action?:Record<string,unknown>):Promise<T>{
 const url=new URL(defaultRoomURL());url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/account';url.search='';
 const response=await fetch(url,{method:action?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:action?JSON.stringify(action):undefined,signal:AbortSignal.timeout(12000)});
 const result:unknown=await response.json();
 if(!response.ok){const message=result&&typeof result==='object'&&'error'in result&&typeof (result as {error:unknown}).error==='string'?(result as {error:string}).error:'Account unavailable';throw Error(message);}
 return result as T;
}
