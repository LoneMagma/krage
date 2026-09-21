import { useEffect, useState } from 'react';
import { KrCredit } from './identity';
import { Check, Crosshair, Trophy, Swords, Flag } from 'lucide-react';
import { challenges, claimChallenge, type Profile } from '@/lib/game/progression';
export function Challenges({profile,onChange}:{profile:Profile;onChange:(profile:Profile)=>void}) {
 const [period,setPeriod]=useState<'daily'|'weekly'>('daily');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const list=challenges(profile).filter(c=>c.period===period);
 const remaining=Math.max(0,list[0].expires-now),hours=Math.ceil(remaining/3600000);
 return <div className="missions"><div className="missions-tabs"><div className="section-tabs">{(['daily','weekly'] as const).map(p=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p.toUpperCase()}</button>)}</div><span>REFRESH IN {hours>24?`${Math.floor(hours/24)}D ${hours%24}H`:`${hours}H`}</span></div>
 <div className="mission-list">{list.map(c=>{
 const progress=Math.min(c.target,profile[c.period][c.metric]),claimed=profile.claimed.includes(c.id),complete=progress>=c.target;
 const Icon=c.metric==='wins'?Trophy:c.metric==='meleeKills'?Swords:c.metric==='matches'?Flag:Crosshair;
 return <article key={c.id} className={claimed?'claimed':complete?'claimable':''}><div className="mission-icon">{claimed?<Check/>:<Icon/>}</div><div className="mission-details"><h3>{c.title}</h3><div className="mission-progress"><progress max={c.target} value={progress} aria-label={c.title}/><span>{progress}/{c.target}</span></div><small>{c.metric==='meleeKills'?'EDGE eliminations':c.metric==='kills'?'Eliminations':c.metric.toUpperCase()}</small></div><div className="mission-reward"><strong><KrCredit/> +{c.reward}</strong><button disabled={claimed||!complete} onClick={()=>onChange(claimChallenge(profile,c.id))}>{claimed?'CLAIMED':complete?'CLAIM':'IN PROGRESS'}</button></div></article>;
 })}</div><p className="missions-footnote">Complete the {period} set for +{period==='daily'?50:150} KR. Progress comes from completed matches.</p></div>;
}
