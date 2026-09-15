import { useEffect, useRef, useState } from 'react';
import { defaultRoomURL, type RoomClient, type ChatMessage } from '@/lib/game/room-client';
export function ArenaChat({name,room,visible,team}:{name:string;room:RoomClient|null;visible:boolean;team:boolean}){
 const [open,setOpen]=useState(false),[channel,setChannel]=useState<ChatMessage['channel']>('global'),[lines,setLines]=useState<ChatMessage[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState(''),[muted,setMuted]=useState(false);
 const socket=useRef<WebSocket|null>(null),feed=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;let ws:WebSocket;try{ws=new WebSocket(defaultRoomURL());}catch{return;}socket.current=ws;
 ws.onopen=()=>{ws.send(JSON.stringify({type:'chat-hello',name}));setStatus('');};
 ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='chat')setLines(p=>[...p.slice(-39),m]);else if(m.type==='chat-error')setStatus(String(m.message));}catch{}};
 ws.onerror=()=>setStatus('Chat unavailable');ws.onclose=()=>setStatus('Chat disconnected');return()=>{ws.onclose=null;ws.close();socket.current=null;};},[open,name]);
 useEffect(()=>{if(!room)return;const receive=(m:ChatMessage)=>setLines(p=>[...p.slice(-39),m]);return room.subscribeChat(receive);},[room]);
 useEffect(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;},[lines,channel]);
 if(!visible)return null;
 const selected=channel!=='global'&&!room?'global':channel==='team'&&!team?'match':channel;
 return <aside className="arena-chat" aria-label="Chat">{open&&<div className="chat-box"><nav>{(['global',...(room?['match']:[]),...(room&&team?['team']:[])] as ChatMessage['channel'][]).map(c=><button key={c} aria-pressed={selected===c} onClick={()=>setChannel(c)}>{c.toUpperCase()}</button>)}<button aria-pressed={muted} onClick={()=>setMuted(!muted)}>{muted?'UNMUTE':'MUTE'}</button></nav><div className="chat-messages" ref={feed} role="log">{!muted&&lines.filter(m=>m.channel===selected).map((m,i)=><p key={i}><b>{m.name}</b> {m.text}</p>)}</div><form onSubmit={e=>{e.preventDefault();const text=draft.trim();if(!text)return;if(selected==='global'){if(socket.current?.readyState!==1){setStatus('Chat unavailable');return;}socket.current.send(JSON.stringify({type:'chat',channel:selected,text}));}else room?.chat(selected,text);setDraft('');setStatus('');}}><input aria-label="Chat message" maxLength={160} value={draft} placeholder="Message…" onChange={e=>setDraft(e.target.value)}/><button type="submit">SEND</button></form>{status&&<small>{status}</small>}</div>}<button className="chat-toggle" onClick={()=>setOpen(!open)}>{open?'CLOSE CHAT':'CHAT'}</button></aside>;
}
