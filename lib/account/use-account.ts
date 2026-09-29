'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';
import type {Profile} from '../game/progression';
import type {Settings} from '../game/core';
import {setAccountTokenProvider} from '../game/account-token';
import {defaultRoomURL} from '../game/room-client';
import {accountsConfigured,authClient,accountRequest} from './client';
export type CloudSave={name:string;preferences:Partial<Settings>;profile:Profile};
type Save={data:CloudSave;revision:number;decisionRequired?:boolean};
type GuestSession={id:string;access_token:string;refresh_token:string;expires_at:number};
export function useAccount(enabled:boolean,onLoad:(data:CloudSave)=>void,onIdentity:()=>void,onGuest:()=>void){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(accountsConfigured),[error,setError]=useState(''),[decision,setDecision]=useState<Save|null>(null),[saving,setSaving]=useState(false),[connected,setConnected]=useState(false);
 const [localGuest,setLocalGuest]=useState(false);
 const guestFallback=useRef(false);
 const current=useRef<Session|null>(null),callbacks=useRef({onLoad,onIdentity,onGuest}),generation=useRef(0),revision=useRef(-1),ready=useRef(false),queue=useRef<Promise<unknown>>(Promise.resolve());
 const pending=useRef<{name?:string;preferences?:Partial<Settings>}>({}),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),initialize=useRef<(s:Session|null,force?:boolean)=>Promise<void>>(async()=>{});
 useEffect(()=>{callbacks.current={onLoad,onIdentity,onGuest};});
 const apply=(result:Save,stamp:number)=>{if(stamp!==generation.current||result.revision<revision.current)return;revision.current=result.revision;callbacks.current.onLoad({...result.data,...(pending.current.name===undefined?{}:{name:pending.current.name}),preferences:{...result.data.preferences,...pending.current.preferences}});};
 const act=(action?:Record<string,unknown>)=>{
  const stamp=generation.current,id=current.current?.user.id;
  const work=async()=>{
   if(!id||stamp!==generation.current||!ready.current)throw Error('Account is still connecting');
   const {data,error}=await authClient()!.auth.getSession();if(error||!data.session||data.session.user.id!==id)throw Error('Sign in again');
   const result=await accountRequest<Save>(data.session.access_token,action);if(stamp!==generation.current)throw Error('Account changed');apply(result,stamp);if(stamp===generation.current)setError('');return result;
  };
  const task=queue.current.catch(()=>{}).then(work);queue.current=task;void task.catch(e=>{if(stamp===generation.current)setError(e.message)});return task;
 };
 async function flush(){
  clearTimeout(timer.current);if(!Object.keys(pending.current).length){await queue.current.catch(()=>{});return;}
  const patch=pending.current,stamp=generation.current;pending.current={};setSaving(true);
  try{await act({type:'preferences',...patch});}catch(e){if(stamp===generation.current)pending.current={...patch,...pending.current,preferences:{...patch.preferences,...pending.current.preferences}};throw e;}
  finally{if(stamp===generation.current)setSaving(false);}
 }
 function preferences(patch:{name?:string;preferences?:Partial<Settings>}){
  if(!ready.current)return;
  pending.current={...pending.current,...patch,preferences:{...pending.current.preferences,...patch.preferences}};
  clearTimeout(timer.current);timer.current=setTimeout(()=>void flush().catch(()=>{}),450);
 }
 const operations=useRef({act,flush});useEffect(()=>{operations.current={act,flush};});
 useEffect(()=>{
  if(!enabled||!accountsConfigured)return;
  const client=authClient()!;let disposed=false,lastId='',creating:Promise<Session|null>|null=null;
  async function accept(next:Session|null,force=false){
   if(disposed)return;
   if(!next){
    if(current.current)callbacks.current.onIdentity();
    current.current=null;ready.current=false;setConnected(false);generation.current++;lastId='';setSession(null);setLoading(true);setDecision(null);clearTimeout(timer.current);pending.current={};const guestGeneration=generation.current;
    try{creating??=client.auth.signInAnonymously().then(({data,error})=>{if(error)throw error;return data.session}).finally(()=>{creating=null});const guest=await creating;if(guest&&guestGeneration===generation.current)await accept(guest);}catch{if(!disposed&&guestGeneration===generation.current&&!current.current){callbacks.current.onGuest();guestFallback.current=true;setLocalGuest(true);setError('Cloud guest saves unavailable. You can still play.');setLoading(false);}}return;
   }
   guestFallback.current=false;setLocalGuest(false);current.current=next;setSession(next);if(next.user.id===lastId&&!force)return;
   lastId=next.user.id;const stamp=++generation.current;ready.current=false;setConnected(false);revision.current=-1;setLoading(true);setDecision(null);clearTimeout(timer.current);pending.current={};callbacks.current.onIdentity();
   try{
    const savedText=localStorage.getItem('krage-pending-guest');
    if(!next.user.is_anonymous&&savedText){
     const saved:GuestSession=JSON.parse(savedText);
     if(saved.id!==next.user.id){
      if(saved.expires_at*1000<Date.now()+30000){
       const isolated=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
       const {data,error}=await isolated.auth.refreshSession({refresh_token:saved.refresh_token});if(error||!data.session)throw Error('Guest transfer needs a retry. Your save is retained.');
       Object.assign(saved,{access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});localStorage.setItem('krage-pending-guest',JSON.stringify(saved));
      }
      const result=await accountRequest<Save>(next.access_token,{type:'migrate',guestToken:saved.access_token});
      if(disposed||stamp!==generation.current)return;
      if(result.decisionRequired){setDecision(result);return;}
     }
     if(stamp===generation.current)localStorage.removeItem('krage-pending-guest');
    }
    const result=await accountRequest<Save>(next.access_token);if(disposed||stamp!==generation.current)return;apply(result,stamp);ready.current=true;setConnected(true);setError('');
   }catch(e){if(!disposed&&stamp===generation.current)setError(e instanceof Error?e.message:'Account unavailable');}
   finally{if(!disposed&&stamp===generation.current)setLoading(false);}
  }
  initialize.current=accept;
  void client.auth.getSession().then(({data,error})=>{if(disposed)return;if(error){setError(error.message);setLoading(false);}else void accept(data.session)});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>void accept(next),0)});
  setAccountTokenProvider(async url=>{
   if(new URL(url).origin!==new URL(defaultRoomURL()).origin)return;
   if(guestFallback.current&&!current.current)return;
   if(!ready.current)throw Error('Finish connecting your account first');await operations.current.flush();
   const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('Sign in again');return data.session.access_token;
  });
  const refresh=()=>{if(document.visibilityState==='visible'&&ready.current)void operations.current.flush().then(()=>operations.current.act()).catch(()=>{});};
  const interval=setInterval(refresh,20000);window.addEventListener('focus',refresh);
  const cancelTimer=()=>{clearTimeout(timer.current);generation.current++;ready.current=false;};
  return()=>{disposed=true;subscription.unsubscribe();clearInterval(interval);cancelTimer();window.removeEventListener('focus',refresh);setAccountTokenProvider(null);};
 },[enabled]);
 const preserveGuest=async()=>{await flush();const {data,error}=await authClient()!.auth.getSession();if(error)throw error;const s=data.session;if(s?.user.is_anonymous)localStorage.setItem('krage-pending-guest',JSON.stringify({id:s.user.id,access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at}));};
 const resolveExisting=async(useExisting:boolean)=>{
  if(!decision)return;
  if(useExisting){localStorage.removeItem('krage-pending-guest');await initialize.current(current.current,true);}
  else{const saved:GuestSession=JSON.parse(localStorage.getItem('krage-pending-guest')||'null');if(!saved)throw Error('Guest session unavailable');const {data,error}=await authClient()!.auth.setSession(saved);if(error)throw error;localStorage.removeItem('krage-pending-guest');await initialize.current(data.session,true);}
 };
 return {session,loading,error,decision,saving,configured:accountsConfigured,active:accountsConfigured&&!localGuest,connected,act,preferences,flush,refresh:()=>ready.current?flush().then(()=>act()):initialize.current(current.current,true),preserveGuest,resolveExisting};
}
