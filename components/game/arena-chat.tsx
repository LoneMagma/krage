import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X, Volume2, VolumeX } from 'lucide-react';
import { defaultRoomURL, type RoomClient, type ChatMessage } from '@/lib/game/room-client';
type Line=ChatMessage&{id:number;at:number};
export function ArenaChat({name,room,visible,boxVisible,team,forceOpen,onForceClose,defaultChannel}:{name:string;room:RoomClient|null;visible:boolean;boxVisible?:boolean;team:boolean;forceOpen?:boolean;onForceClose?:()=>void;defaultChannel?:ChatMessage['channel']}){
 const canShowBox=boxVisible??visible;
 const [openState,setOpenState]=useState(false),[channel,setChannel]=useState<ChatMessage['channel']|null>(null),[lines,setLines]=useState<Line[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState(''),[muted,setMuted]=useState(false),[now,setNow]=useState(()=>Date.now());
 const open=canShowBox&&(openState||!!forceOpen),socket=useRef<WebSocket|null>(null),input=useRef<HTMLInputElement>(null),feed=useRef<HTMLDivElement>(null),sequence=useRef(0);
 const close=()=>{setOpenState(false);onForceClose?.();input.current?.blur();};
 const receive=(message:ChatMessage)=>{const at=Date.now();setNow(at);setLines(p=>[...p.slice(-39),{...message,id:++sequence.current,at}]);};
 useEffect(()=>{
  if(!visible)return;let stopped=false,retry:ReturnType<typeof setTimeout>,attempt=0;
  const connect=()=>{if(stopped)return;let ws:WebSocket;try{ws=new WebSocket(defaultRoomURL());}catch{setStatus('Chat unavailable');return;}socket.current=ws;
   ws.onopen=()=>{attempt=0;ws.send(JSON.stringify({type:'chat-hello',name}));setStatus('');};
   ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='chat')receive(m);else if(m.type==='chat-error')setStatus(String(m.message));}catch{}};
   ws.onerror=()=>setStatus('Connecting…');ws.onclose=()=>{if(stopped)return;setStatus('Reconnecting…');retry=setTimeout(connect,Math.min(15000,1000*2**Math.min(attempt++,4)));};
  };connect();return()=>{stopped=true;clearTimeout(retry);socket.current?.close();socket.current=null;};
 },[visible,name]);
 useEffect(()=>room?.subscribeChat(receive),[room]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 useEffect(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;},[lines,channel,open]);

 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(!visible||!canShowBox||e.defaultPrevented||e.repeat)return;const target=e.target instanceof HTMLElement?e.target:null;
   if(e.code==='Escape'&&open){e.preventDefault();setOpenState(false);onForceClose?.();input.current?.blur();return;}
   if(e.code==='Enter'&&!open&&!target?.closest('input,textarea,button,a,[contenteditable=true],[role=dialog]')){e.preventDefault();setOpenState(true);}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[visible,canShowBox,open,onForceClose]);
 if(!visible)return null;
 const requested=channel??defaultChannel??'global';
 const selected=requested!=='global'&&!room?'global':requested==='team'&&!team?'match':requested;
 const send=()=>{
  const text=draft.trim();if(!text){close();return;}
  if(selected==='global'){
   if(socket.current?.readyState!==WebSocket.OPEN){setStatus('Not connected. Your message is saved.');return;}
   socket.current.send(JSON.stringify({type:'chat',channel:selected,text}));
  }else{if(room?.socket?.readyState!==WebSocket.OPEN){setStatus('Reconnecting. Your message is saved.');return;}room.chat(selected,text);}
  setDraft('');setStatus('');close();
 };
 const recent=muted?[]:lines.filter(m=>now-m.at<6500).slice(-4);
 return <aside className={'arena-chat chat-v2 '+(open?'is-open':'')} aria-label="Chat">
  {!open&&recent.length>0&&<div className="chat-toasts" aria-live="polite">{recent.map(m=><p key={m.id} className="chat-toast"><span className="chat-channel">{m.channel==='team'?'TEAM':m.channel==='match'?'MATCH':'ALL'}</span><b>{m.name}</b><span>{m.text}</span></p>)}</div>}
  {open&&<div className="chat-box"><nav aria-label="Chat channel">{(['global',...(room?['match']:[]),...(room&&team?['team']:[])] as ChatMessage['channel'][]).map(c=><button key={c} aria-pressed={selected===c} onClick={()=>setChannel(c)}>{c==='global'?'ALL':c.toUpperCase()}</button>)}<button className="chat-icon" aria-label={muted?'Unmute chat':'Mute chat'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button><button className="chat-icon" aria-label="Close chat" onClick={close}><X size={16}/></button></nav>
   <div className="chat-messages" ref={feed} role="log">{!muted&&lines.filter(m=>m.channel===selected).map(m=><p key={m.id}><b>{m.name}</b><span>{m.text}</span></p>)}</div>
   <form onSubmit={e=>{e.preventDefault();send();}}><input ref={input} aria-label="Chat message" maxLength={160} value={draft} autoComplete="off" placeholder={`${selected==='global'?'Everyone':selected==='team'?'Your team':'This match'}…`} onChange={e=>setDraft(e.target.value)}/><button type="submit" aria-label="Send message"><Send size={17}/></button></form>
   {status&&<output>{status}</output>}<div className="chat-hints"><span><kbd>ENTER</kbd> SEND</span><span><kbd>ESC</kbd> CLOSE</span></div>
  </div>}
  {!open&&canShowBox&&<button className="chat-toggle" onClick={()=>setOpenState(true)}><MessageSquare size={16}/> CHAT <kbd>ENTER</kbd></button>}
 </aside>;
}
