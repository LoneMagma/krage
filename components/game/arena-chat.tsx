import { useEffect, useRef, useState } from 'react';
import { defaultRoomURL, type RoomClient, type ChatMessage } from '@/lib/game/room-client';
export function ArenaChat({name,room,visible,team,forceOpen,onForceClose,defaultChannel}:{name:string;room:RoomClient|null;visible:boolean;team:boolean;forceOpen?:boolean;onForceClose?:()=>void;defaultChannel?:ChatMessage['channel']}){
 const [openState,setOpenState]=useState(false),[channel,setChannel]=useState<ChatMessage['channel']>(defaultChannel??'global'),[lines,setLines]=useState<ChatMessage[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState<{text:string;error:boolean}|null>(null),[muted,setMuted]=useState(false);
 const open=openState||!!forceOpen;
 const socket=useRef<WebSocket|null>(null),feed=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),statusTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const flash=(text:string,error:boolean)=>{if(statusTimer.current)clearTimeout(statusTimer.current);setStatus({text,error});if(!error)statusTimer.current=setTimeout(()=>setStatus(null),2000);};
 useEffect(()=>{if(!open)return;let ws:WebSocket;try{ws=new WebSocket(defaultRoomURL());}catch{flash('Chat unavailable',true);return;}socket.current=ws;
 ws.onopen=()=>{ws.send(JSON.stringify({type:'chat-hello',name}));setStatus(null);};
 ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='chat')setLines(p=>[...p.slice(-39),m]);else if(m.type==='chat-error')flash(String(m.message),true);}catch{}};
 ws.onerror=()=>flash('Chat unavailable',true);ws.onclose=()=>flash('Chat disconnected — reopen chat to retry',true);return()=>{ws.onclose=null;ws.close();socket.current=null;};},[open,name]);
 useEffect(()=>{if(!room)return;const receive=(m:ChatMessage)=>setLines(p=>[...p.slice(-39),m]);return room.subscribeChat(receive);},[room]);
 useEffect(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;},[lines,channel]);
 // Focus lands on the input via script even while pointer lock is held on
 // the game canvas elsewhere in the document -- moving focus between
 // elements doesn't release pointer lock, so play continues underneath.
 useEffect(()=>{if(forceOpen)input.current?.focus();},[forceOpen]);
 useEffect(()=>{if(defaultChannel)setChannel(defaultChannel);},[defaultChannel]);
 useEffect(()=>()=>{if(statusTimer.current)clearTimeout(statusTimer.current);},[]);
 if(!visible)return null;
 const selected=channel!=='global'&&!room?'global':channel==='team'&&!team?'match':channel;
 const close=()=>{if(forceOpen)onForceClose?.();else setOpenState(false);};
 const send=()=>{
  const text=draft.trim();
  if(!text){close();return;}
  if(selected==='global'){
   if(socket.current?.readyState!==1){flash('Not connected — message not sent',true);return;}
   try{socket.current.send(JSON.stringify({type:'chat',channel:selected,text}));}
   catch{flash('Send failed — try again',true);return;}
  }else{
   // room.chat() sends silently and reports no result, so the readiness
   // check has to happen out here to tell a real failure from a send.
   if(room?.socket?.readyState!==1){flash('Not connected — message not sent',true);return;}
   room.chat(selected,text);
  }
  setDraft('');
  if(forceOpen)close();else setStatus(null);
 };
 return <aside className="arena-chat" aria-label="Chat">{open&&<div className="chat-box"><nav>{(['global',...(room?['match']:[]),...(room&&team?['team']:[])] as ChatMessage['channel'][]).map(c=><button key={c} aria-pressed={selected===c} onClick={()=>setChannel(c)}>{c.toUpperCase()}</button>)}<button aria-pressed={muted} onClick={()=>setMuted(!muted)}>{muted?'UNMUTE':'MUTE'}</button></nav><div className="chat-messages" ref={feed} role="log">{!muted&&lines.filter(m=>m.channel===selected).map((m,i)=><p key={i}><b>{m.name}</b> {m.text}</p>)}</div><form onSubmit={e=>{e.preventDefault();send();}}><input ref={input} aria-label="Chat message" maxLength={160} value={draft} placeholder="Message…" onChange={e=>setDraft(e.target.value)}/><button type="submit">SEND</button></form>{status&&<small role={status.error?'alert':undefined} className={status.error?'chat-status-error':'chat-status-ok'}>{status.text}{status.error&&draft.trim()&&<button type="button" onClick={send}>RETRY</button>}</small>}</div>}{!forceOpen&&<button className="chat-toggle" onClick={()=>setOpenState(!openState)}>{open?'CLOSE CHAT':'CHAT'}</button>}</aside>;
}
