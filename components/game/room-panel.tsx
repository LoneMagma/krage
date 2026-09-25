import { GameChoice } from '@/components/game/game-choice';
import { useState } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, SlidersHorizontal, Users, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { defaultRoomURL, type ConnectionInfo, type RoomOptions } from '@/lib/game/room-client';
import { OPERATORS } from '@/lib/game/progression';
import { LobbyBrowser } from './lobby-browser';
import { PartyPreview } from './party-preview';
import { MapDiagram } from './map-diagram';
const MODES=['FFA','1 v 1','2 v 2','3 v 3'],MAPS=['DUNE','SNOW','CELL I','CELL II'];
export function RoomPanel({mode,map,primary,operator=0,weaponFinishes=[],name,onName,ready,info,onConnect,onChange,onStart,onLeave,onKick}:{
 mode:number;map:number;primary:number;operator?:number;weaponFinishes?:number[];name:string;onName:(name:string)=>void;ready:boolean;info:ConnectionInfo|null;
 onKick:(id:number)=>void;onConnect:(o:RoomOptions)=>void;onChange:(o:{primary?:number;operator?:number;ready?:boolean})=>void;onStart:()=>void;onLeave:()=>void;
}){
 const [room,setRoom]=useState(()=>typeof window==='undefined'?'':new URLSearchParams(location.search).get('room')?.toUpperCase()??'');
 const [screen,setScreen]=useState<'create'|'join'|'browse'>(()=>typeof window!=='undefined'&&new URLSearchParams(location.search).has('room')?'join':'browse');
 const [chosenMode,setMode]=useState(mode),[chosenMap,setMap]=useState(map),[chosenPrimary,setPrimary]=useState(primary),[character,setCharacter]=useState(operator);
 const [duration,setDuration]=useState(300),[capacity,setCapacity]=useState(6),[fragLimit,setFragLimit]=useState(20),[botFill,setBots]=useState(true),[difficulty,setDifficulty]=useState('casual');
 const [settings,setSettings]=useState(false),[section,setSection]=useState('RULES'),[copied,setCopied]=useState(false),[copyFailed,setCopyFailed]=useState(false);
 const [inviteRequested,setInviteRequested]=useState(false);
 const [password,setPassword]=useState(''),[listed,setListed]=useState(true);
 const lobby=info?.lobby,own=lobby?.actors.find(a=>a.id===lobby.you),busy=info?.status==='connecting'||info?.status==='reconnecting'||!!lobby?.countdown;
 const slots=chosenMode===0?capacity:[6,2,4,6][chosenMode];
 const connect=(join:boolean)=>onConnect({url:defaultRoomURL(),name,mode:chosenMode,map:chosenMap,primary:chosenPrimary,operator:character,weaponFinishes,duration,capacity:slots,fragLimit,botFill,difficulty,password,listed,...(join?{room:room.trim().toUpperCase()}:{})});
 const invite=()=>{if(!lobby)return;const url=new URL(location.href);url.searchParams.set('room',lobby.room);void navigator.clipboard?.writeText(url.href).then(()=>{setCopied(true);setCopyFailed(false);}).catch(()=>setCopyFailed(true));if(!navigator.clipboard)setCopyFailed(true);};
 const select=(label:string,value:number,change:(n:number)=>void,values:(string|number)[],disabled=false)=><label>{label}<GameChoice aria-label={label} value={value} disabled={disabled||busy} onChange={v=>change(+v)}>{values.map((v,i)=><option key={v} value={typeof v==='number'?v:i}>{label==='TIME'?`${Number(v)/60} MIN`:v}</option>)}</GameChoice></label>;
 const loadout=<div className="room-options">{select('WEAPON',own?.primary??chosenPrimary,n=>{setPrimary(n);if(lobby)onChange({primary:n});},['ECHO','KILO','MICA'])}{select('CHARACTER',own?.operator??character,n=>{setCharacter(n);if(lobby)onChange({operator:n});},OPERATORS.map(o=>o.name.toUpperCase()),(lobby?.mode??chosenMode)>=2)}</div>;
 const allReady=!!lobby&&!lobby.actors.some(a=>a.connected&&!a.ready),enoughPlayers=!!lobby&&(lobby.botFill||lobby.actors.filter(a=>a.connected).length>=2);
 return <div className="room-panel party-first">
  {!lobby&&<div className="party-topline"><div className="section-tabs"><button aria-pressed={screen==='browse'} onClick={()=>setScreen('browse')}>BROWSE</button><button aria-pressed={screen==='create'} onClick={()=>setScreen('create')}>CREATE</button><button aria-pressed={screen==='join'} onClick={()=>setScreen('join')}>JOIN</button></div><label className="party-name">YOUR NAME<input aria-label="Player name" value={name} maxLength={16} onChange={e=>onName(e.target.value)}/></label></div>}
  {lobby?<>
   {!!lobby.countdown&&<output className="lobby-countdown"><span>MATCH STARTS IN</span><strong key={lobby.countdown}>{lobby.countdown}</strong><small>{MAPS[lobby.map]} · {MODES[lobby.mode]}</small></output>}
   <div className="party-topline"><span className="party-room-code"><Users size={17}/> {lobby.room}</span><button className="party-invite" onClick={invite}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'COPIED':'INVITE'}</button></div>
   {(copyFailed||inviteRequested)&&<input aria-label="Invite link" readOnly value={`${location.origin}/?room=${lobby.room}`} onFocus={e=>e.target.select()}/>}
   <PartyPreview players={lobby.actors.filter(a=>!a.bot)} capacity={lobby.capacity} you={lobby.you} hostId={lobby.host} onKick={onKick} onInvite={invite}/>
   <div className="party-match-summary"><MapDiagram id={lobby.map}/><strong>{MAPS[lobby.map]}</strong><span>{MODES[lobby.mode]}</span><span>{(lobby.duration??300)/60} MIN</span><span>{lobby.fragLimit} FRAGS</span></div>
   <details className="party-loadout"><summary>YOUR LOADOUT</summary>{loadout}</details>
   <div className="party-actions"><button className="party-leave" aria-label="Leave lobby" onClick={onLeave}><LogOut size={19}/></button><Button className={own?.ready?'secondary-button':'deploy-button'} disabled={busy} onClick={()=>onChange({ready:!own?.ready})}>{own?.ready?'✓ READY':'READY UP'}</Button>{lobby.host===lobby.you&&<Button className="deploy-button" title={!enoughPlayers?'Invite a friend or enable bots':!allReady?'Waiting for everyone to ready up':'Start match'} disabled={busy||!allReady||!enoughPlayers} onClick={onStart}>START MATCH</Button>}</div>
  </>:screen==='browse'?<LobbyBrowser onQuick={()=>onConnect({url:defaultRoomURL(),name,mode:0,map:0,primary:chosenPrimary,operator:character,weaponFinishes,quickPlay:true})} busy={!ready||busy} onJoin={(code,secret)=>onConnect({url:defaultRoomURL(),name,mode:chosenMode,map:chosenMap,primary:chosenPrimary,operator:character,weaponFinishes,room:code,password:secret})}/>:screen==='join'?<form className="room-join" onSubmit={e=>{e.preventDefault();connect(true);}}><label>INVITE CODE<input aria-label="Invite code" maxLength={6} autoComplete="off" value={room} placeholder="ABC123" onChange={e=>setRoom(e.target.value.toUpperCase())}/></label><label>PASSWORD<input type="password" aria-label="Lobby password" placeholder="IF REQUIRED" maxLength={64} value={password} onChange={e=>setPassword(e.target.value)}/></label><Button className="deploy-button" type="submit" disabled={!ready||busy||!/^[A-F0-9]{6}$/.test(room)}>JOIN LOBBY</Button></form>:<>
   {!settings&&<PartyPreview players={[{id:0,name:name||'PLAYER',team:0,operator:chosenMode>=2?0:character,primary:chosenPrimary,weaponFinishes,bot:false,connected:true,ready:false}]} capacity={Math.min(4,slots)} you={0} inviteLabel="CREATE & INVITE" onInvite={!ready||busy?undefined:()=>{setInviteRequested(true);connect(false);}}/>}
   <div className="party-quick-settings"><div className="party-map-picker"><button aria-label="Previous map" disabled={busy} onClick={()=>setMap((chosenMap+3)%4)}><ChevronLeft/></button><MapDiagram id={chosenMap}/><strong>{MAPS[chosenMap]}</strong><button aria-label="Next map" disabled={busy} onClick={()=>setMap((chosenMap+1)%4)}><ChevronRight/></button></div>{select('MODE',chosenMode,setMode,MODES)}</div>
   <button className="party-settings-toggle" aria-expanded={settings} onClick={()=>setSettings(!settings)}><SlidersHorizontal size={16}/> MATCH SETTINGS <span>{duration/60} MIN · {fragLimit} FRAGS</span></button>
   {settings&&<div className="party-settings"><div className="section-tabs">{['RULES','BOTS','LOADOUT','ACCESS'].map(s=><button key={s} aria-pressed={section===s} onClick={()=>setSection(s)}>{s}</button>)}</div>
    {section==='RULES'&&<div className="room-options">{select('TIME',duration,setDuration,[60,180,300,600])}{select('SCORE TO WIN',fragLimit,setFragLimit,[10,20,30,50])}{select('PLAYER SLOTS',slots,setCapacity,[2,4,6,8],chosenMode!==0)}</div>}
    {section==='BOTS'&&<div className="room-options"><button aria-pressed={botFill} disabled={busy} onClick={()=>setBots(!botFill)}>BOTS {botFill?'ON':'OFF'}</button><label>DIFFICULTY<GameChoice aria-label="Bot difficulty" value={difficulty} disabled={busy||!botFill} onChange={setDifficulty}>{[['dummy','DUMMY'],['casual','CASUAL'],['normal','REGULAR'],['hard','VETERAN']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</GameChoice></label></div>}
    {section==='LOADOUT'&&loadout}
    {section==='ACCESS'&&<div className="room-options"><button aria-pressed={listed} onClick={()=>setListed(!listed)}>VISIBILITY: {listed?'PUBLIC':'INVITE ONLY'}</button><label>PASSWORD<input type="password" aria-label="Create lobby password" placeholder="OPTIONAL" maxLength={64} value={password} onChange={e=>setPassword(e.target.value)}/></label></div>}
   </div>}
   <Button className="deploy-button" disabled={!ready||busy} onClick={()=>connect(false)}>CREATE LOBBY</Button>
  </>}
  {info?.message&&<output>{info.message}</output>}{busy&&!lobby?.countdown&&<output>{info?.status==='reconnecting'?'RECONNECTING':'CONNECTING'}</output>}
 </div>;
}
