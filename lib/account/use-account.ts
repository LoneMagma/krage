'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';
import type {Profile} from '../game/progression';
import type {Settings} from '../game/core';
import {setAccountTokenProvider} from '../game/account-token';
import {defaultRoomURL} from '../game/room-client';
import {accountsConfigured,authClient,accountRequest} from './client';
export type CloudSave={name:string;preferences:Partial<Settings>;profile:Profile};
export function useAccount(enabled:boolean,onLoad:(data:CloudSave)=>void,onIdentity:()=>void){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(accountsConfigured),[error,setError]=useState('');
 const current=useRef<Session|null>(null),callbacks=useRef({onLoad,onIdentity}),generation=useRef(0),queue=useRef<Promise<unknown>>(Promise.resolve()),revision=useRef(-1);
 callbacks.current={onLoad,onIdentity};
 const apply=(result:{data:CloudSave;revision:number},stamp:number)=>{if(stamp!==generation.current||result.revision<revision.current)return;revision.current=result.revision;callbacks.current.onLoad(result.data);};
 const act=(action?:Record<string,unknown>)=>{
  const stamp=generation.current,id=current.current?.user.id;
  const work=async()=>{if(!id||stamp!==generation.current)return;const {data,error}=await authClient()!.auth.getSession();if(error||!data.session||data.session.user.id!==id)throw Error('Sign in again');const result=await accountRequest<{data:CloudSave;revision:number}>(data.session.access_token,action);apply(result,stamp);setError('');return result;};
  const task=queue.current.catch(()=>{}).then(work);queue.current=task;void task.catch(e=>{if(stamp===generation.current)setError(e.message)});return task;
 };
 const operations=useRef(act);operations.current=act;
 useEffect(()=>{
  if(!enabled||!accountsConfigured)return;
  const client=authClient()!;let disposed=false,lastId='';
  async function accept(next:Session|null){
   if(disposed)return;
   if(!next){try{const {data,error}=await client.auth.signInAnonymously();if(error)throw error;if(data.session)void accept(data.session);}catch(e){if(!disposed){setError(e instanceof Error?e.message:'Guest account unavailable');setLoading(false);}}return;}
   current.current=next;setSession(next);
   if(next.user.id===lastId)return;
   lastId=next.user.id;const stamp=++generation.current;revision.current=-1;setLoading(true);callbacks.current.onIdentity();
   try{
    const pending=localStorage.getItem('krage-pending-guest');
    if(!next.user.is_anonymous&&pending){
     const saved=JSON.parse(pending);
     if(saved.id!==next.user.id){
      let token=saved.access_token;
      if(saved.expires_at*1000<Date.now()){
       const isolated=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
       const {data,error}=await isolated.auth.refreshSession({refresh_token:saved.refresh_token});if(error||!data.session)throw Error('Guest transfer expired. Your guest save has been kept.');token=data.session.access_token;
      }
      await accountRequest(next.access_token,{type:'migrate',guestToken:token});
     }localStorage.removeItem('krage-pending-guest');
    }
    const result=await accountRequest<{data:CloudSave;revision:number}>(next.access_token);if(!disposed)apply(result,stamp);
    setError('');
   }catch(e){if(!disposed)setError(e instanceof Error?e.message:'Account unavailable');}
   finally{if(!disposed&&stamp===generation.current)setLoading(false);}
  }
  void client.auth.getSession().then(({data,error})=>{if(error){setError(error.message);setLoading(false);}else void accept(data.session)});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>void accept(next),0)});
  setAccountTokenProvider(async url=>{
   if(new URL(url).origin!==new URL(defaultRoomURL()).origin)return;
   const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.access_token;
  });
  const refresh=()=>{if(document.visibilityState==='visible'&&current.current)void operations.current().catch(()=>{});};
  const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh);
  return()=>{disposed=true;generation.current++;subscription.unsubscribe();clearInterval(timer);window.removeEventListener('focus',refresh);setAccountTokenProvider(null);};
 },[enabled]);
 const preserveGuest=async()=>{const {data}=await authClient()!.auth.getSession();const s=data.session;if(s?.user.is_anonymous)localStorage.setItem('krage-pending-guest',JSON.stringify({id:s.user.id,access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at}));};
 return {session,loading,error,configured:accountsConfigured,active:accountsConfigured,act,refresh:()=>act(),preserveGuest};
}
