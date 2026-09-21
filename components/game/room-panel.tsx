import { GameChoice } from '@/components/game/game-choice';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { defaultRoomURL, type ConnectionInfo, type RoomOptions } from '@/lib/game/room-client';
import { PartyPreview } from './party-preview';
export function RoomPanel({mode,map,primary,operator=0,name,onName,ready,info,onConnect,onChange,onStart,onLeave}: {
  mode:number;map:number;primary:number;operator?:number;name:string;onName:(name:string)=>void;ready:boolean;info:ConnectionInfo|null;
  onConnect:(o:RoomOptions)=>void;onChange:(o:{primary?:number;operator?:number;ready?:boolean})=>void;onStart:()=>void;onLeave:()=>void;
}) {
  const [room,setRoom]=useState(()=>typeof window==='undefined'?'':new URLSearchParams(location.search).get('room')?.toUpperCase()??'');
  const [screen,setScreen]=useState<'create'|'join'>(()=>typeof window!=='undefined'&&new URLSearchParams(location.search).has('room')?'join':'create');
  const [section,setSection]=useState('MATCH');
  const [chosenMode,setMode]=useState(mode),[chosenMap,setMap]=useState(map),[chosenPrimary,setPrimary]=useState(primary),[character,setCharacter]=useState(operator);
  const [duration,setDuration]=useState(300),[capacity,setCapacity]=useState(8),[fragLimit,setFragLimit]=useState(20),[botFill,setBots]=useState(true),[difficulty,setDifficulty]=useState('casual');
  const [copied,setCopied]=useState(false);
  const lobby=info?.lobby,own=lobby?.actors.find(a=>a.id===lobby.you);
  const busy=info?.status==='connecting'||info?.status==='reconnecting';
  const connect=(join:boolean)=>onConnect({url:defaultRoomURL(),name,mode:chosenMode,map:chosenMap,primary:chosenPrimary,operator:character,duration,capacity,fragLimit,botFill,difficulty,...(join?{room:room.trim().toUpperCase()}: {})});
  const select=(label:string,value:number,change:(n:number)=>void,values:(string|number)[],disabled=false)=><label>{label}<GameChoice aria-label={label} value={value} disabled={disabled||busy} onChange={(value)=>change(+value)}>{values.map((v,i)=><option key={v} value={typeof v==='number'?v:i}>{label==='TIME'?`${Number(v)/60} MIN`:v}</option>)}</GameChoice></label>;
  const loadout=<div className="room-options">
    {select('WEAPON',own?.primary??chosenPrimary,n=>{setPrimary(n);if(lobby)onChange({primary:n});},['ECHO','KILO','MICA'])}
    {select('CHARACTER',own?.operator??character,n=>{setCharacter(n);if(lobby)onChange({operator:n});},['ROOK','VERA','BLAKE'],(lobby?.mode??chosenMode)>=2)}
  </div>;
  return <div className={'room-panel '+(lobby?'party-room':'room-builder')}>
    {lobby ? <>
      <div className="party-code"><strong>{lobby.room}</strong><button onClick={()=>{const url=new URL(location.href);url.searchParams.set('room',lobby.room);void navigator.clipboard.writeText(url.href).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'COPIED':'COPY INVITE'}</button></div>
      <div className="party-layout"><div className="party-lineup"><PartyPreview players={lobby.actors}/></div><aside className="party-rules"><h3>MATCH</h3><div className="rule-summary"><span>{['FFA','1 v 1','2 v 2','3 v 3'][lobby.mode]}</span><span>{['DUNE','SNOW','CELL I','CELL II'][lobby.map]}</span><span>{(lobby.duration??300)/60} MIN</span><span>{lobby.fragLimit} FRAGS</span><span>{lobby.capacity} SLOTS</span><span>{lobby.botFill?`${lobby.difficulty?.toUpperCase()} BOTS`:'NO BOTS'}</span></div><h3>YOUR LOADOUT</h3>{loadout}</aside></div>
      <div className="party-actions"><Button className="deploy-button" disabled={busy} onClick={()=>onChange({ready:!own?.ready})}>{own?.ready?'UNREADY':'READY UP'}</Button>{lobby.host===lobby.you&&<Button className="secondary-button" disabled={busy||lobby.actors.some(a=>a.connected&&!a.ready)||(!lobby.botFill&&lobby.actors.filter(a=>a.connected).length<2)} onClick={onStart}>START MATCH</Button>}<Button className="secondary-button" onClick={onLeave}>LEAVE</Button></div>
    </> : <>
      <div className="section-tabs"><button aria-pressed={screen==='create'} onClick={()=>setScreen('create')}>HOST</button><button aria-pressed={screen==='join'} onClick={()=>setScreen('join')}>JOIN</button></div>
      <label>YOUR NAME<input aria-label="Player name" value={name} maxLength={16} onChange={e=>onName(e.target.value)}/></label>
      {screen==='join'?<form className="room-join" onSubmit={e=>{e.preventDefault();connect(true);}}><label>INVITE CODE<input aria-label="Invite code" maxLength={6} value={room} placeholder="ABC123" onChange={e=>setRoom(e.target.value.toUpperCase())}/></label><Button type="submit" disabled={!ready||busy||!/^[A-F0-9]{6}$/.test(room)}>JOIN</Button></form>:<>
        <div className="room-config"><nav aria-label="Custom game sections">{['MATCH','RULES','BOTS','LOADOUT'].map(label=><button key={label} aria-pressed={section===label} onClick={()=>setSection(label)}>{label}</button>)}</nav><div className="room-config-fields">
          
          {section==='MATCH'&&<div className="room-options">{select('MODE',chosenMode,setMode,['FFA','1 v 1','2 v 2','3 v 3'])}{select('MAP',chosenMap,setMap,['DUNE','SNOW','CELL I','CELL II'])}</div>}
          {section==='RULES'&&<div className="room-options">{select('TIME',duration,setDuration,[60,180,300,600])}{select('SCORE TO WIN',fragLimit,setFragLimit,[10,20,30,50,100])}{select('PLAYER SLOTS',chosenMode===0?capacity:[8,2,4,6][chosenMode],setCapacity,[2,4,6,8],chosenMode!==0)}</div>}
          {section==='BOTS'&&<div className="room-options"><button aria-pressed={botFill} onClick={()=>setBots(!botFill)} disabled={busy}>FILL EMPTY SLOTS · {botFill?'ON':'OFF'}</button><label>BOT SKILL<GameChoice value={difficulty} disabled={busy||!botFill} onChange={(value)=>setDifficulty(value)}>{['dummy','casual','normal','hard'].map(d=><option key={d}>{d}</option>)}</GameChoice></label></div>}
          {section==='LOADOUT'&&loadout}
        </div></div>
        <div className="room-recap"><span>{['DUNE','SNOW','CELL I','CELL II'][chosenMap]} · {['FFA','1 v 1','2 v 2','3 v 3'][chosenMode]}</span><span>{duration/60} MIN · {fragLimit} FRAGS</span></div>
        <Button className="deploy-button" disabled={!ready||busy} onClick={()=>connect(false)}>CREATE LOBBY</Button>
      </>}
    </>}
    {info?.message&&<output>{info.message}</output>}{busy&&<output>{info?.status==='reconnecting'?'RECONNECTING':'CONNECTING'}</output>}
  </div>;
}
