import { useEffect, useState } from 'react';
import { LockKeyhole, RefreshCw, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { defaultRoomURL } from '@/lib/game/room-client';
import { ROOM_PROTOCOL } from '@/lib/game/network-state';
import { MapDiagram } from './map-diagram';
type Listing={room:string;name:string;map:number;mode:number;humans:number;capacity:number;available:number;locked:boolean;state:string;duration:number;fragLimit:number};
export function LobbyBrowser({onJoin,onQuick,busy}:{onQuick:()=>void;onJoin:(room:string,password:string)=>void;busy:boolean}){
 const [rooms,setRooms]=useState<Listing[]>([]),[status,setStatus]=useState('FINDING LOBBIES'),[refresh,setRefresh]=useState(0),[page,setPage]=useState(0),[selected,setSelected]=useState(''),[password,setPassword]=useState('');
 useEffect(()=>{
  let ws:WebSocket,timer:ReturnType<typeof setInterval>;
  try{ws=new WebSocket(defaultRoomURL());}catch{queueMicrotask(()=>setStatus('ROOM SERVER UNAVAILABLE'));return;}
  const request=()=>{if(ws.readyState===WebSocket.OPEN&&!document.hidden)ws.send(JSON.stringify({type:'rooms'}));};
  ws.onopen=()=>{request();timer=setInterval(request,5000);};
  ws.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type!=='rooms')return;if(data.protocol!==ROOM_PROTOCOL){setStatus('REFRESH GAME AND ROOM SERVER');return;}clearTimeout(timeout);setRooms(data.rooms);setStatus('');}catch{setStatus('ROOM SERVER UNAVAILABLE');}};
  ws.onerror=()=>setStatus('ROOM SERVER UNAVAILABLE');ws.onclose=()=>setStatus('CONNECTION CLOSED · REFRESH');
  const timeout=setTimeout(()=>setStatus('ROOM SERVER UNAVAILABLE'),10000);
  return()=>{clearTimeout(timeout);clearInterval(timer);ws.onclose=null;ws.close();};
 },[refresh]);
 const pages=Math.max(1,Math.ceil(rooms.length/2)),active=Math.min(page,pages-1);
 return <div className="lobby-browser"><div className="lobby-browser-title"><strong>ACTIVE LOBBIES</strong><button className="find-match" disabled={busy} onClick={onQuick}>FIND MATCH</button><button aria-label="Refresh lobbies" onClick={()=>{setStatus('FINDING LOBBIES');setRefresh(n=>n+1);}}><RefreshCw size={17}/></button></div>
  {status&&<output>{status}</output>}
  <div className="lobby-list">{rooms.slice(active*2,active*2+2).map(r=><div className="lobby-list-row" key={r.room}>
   <MapDiagram id={r.map}/><div><strong>{r.name}{r.locked&&<LockKeyhole size={13}/>}</strong><small>{['DUNE','SNOW','CELL I','CELL II'][r.map]} · {['FFA','1 v 1','2 v 2','3 v 3'][r.mode]} · {r.duration/60} MIN · {r.fragLimit} FRAGS</small></div>
   <span className="lobby-occupancy"><Users size={14}/>{r.humans}/{r.capacity}</span>
   {selected===r.room&&r.locked?<form onSubmit={e=>{e.preventDefault();onJoin(r.room,password);}}><input type="password" aria-label="Lobby password" placeholder="PASSWORD" maxLength={64} value={password} onChange={e=>setPassword(e.target.value)}/><button type="submit" disabled={busy||!password}>JOIN</button></form>:<button disabled={busy||r.available===0||r.state==='ended'} onClick={()=>{if(r.locked){setSelected(r.room);setPassword('');}else onJoin(r.room,'');}}>{r.state==='ended'?'ENDED':r.available===0?'FULL':r.state==='playing'?'JOIN MATCH':'JOIN'}</button>}
  </div>)}</div>
  {!status&&!rooms.length&&<p className="empty-lobbies">No active rooms</p>}
  {pages>1&&<div className="party-pages"><button disabled={!active} aria-label="Previous lobbies" onClick={()=>setPage(active-1)}><ChevronLeft size={16}/></button><span>{active+1} / {pages}</span><button disabled={active===pages-1} aria-label="Next lobbies" onClick={()=>setPage(active+1)}><ChevronRight size={16}/></button></div>}
 </div>;
}
