import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { WeaponInspector } from './weapon-inspector';
import { CATALOG, OPERATORS, equipCosmetic, equipWeaponFinish, purchase, weaponFinish, type Profile } from '@/lib/game/progression';
import { WeaponGlyph, KrCredit } from './identity';
import { PartyPreview } from './party-preview';
function WeaponLocker({profile,onChange,onAction,busy=false}:{profile:Profile;onChange:(profile:Profile)=>void;onAction?:(a:{type:string;id:string;weapon?:number})=>void;busy?:boolean}) {
 const [weapon,setWeapon]=useState(0),[selection,setSelection]=useState(()=>profile.weaponFinishes?.[0]??'finish-factory');
 const skins=CATALOG.filter(item=>'weapon' in item&&item.weapon===weapon).sort((a,b)=>a.cost-b.cost);
 const factory={id:'finish-factory',name:'Factory',variant:0,color:'#a7a8a1',cost:0};
 const finishes=[factory,...skins];const item=finishes.find(i=>i.id===selection)??factory;
 const cycle=(direction:number)=>setSelection(finishes[(finishes.findIndex(f=>f.id===item.id)+direction+finishes.length)%finishes.length].id);
 const equipped=weaponFinish(profile,weapon)===item.variant,owned=item.id===factory.id||profile.owned.includes(item.id);
 const chooseWeapon=(id:number)=>{setWeapon(id);setSelection(profile.weaponFinishes?.[id]??'finish-factory');};
 return <div className="arsenal">
  <div className="arsenal-weapons" aria-label="Choose weapon">{['ECHO','KILO','MICA','EDGE'].map((name,id)=><button key={name} aria-pressed={weapon===id} onClick={()=>chooseWeapon(id)}><WeaponGlyph id={id} finish={weaponFinish(profile,id)}/><strong>{name}</strong></button>)}</div>
  <div className="arsenal-inspection"><button className="skin-arrow previous" aria-label="Previous skin" onClick={()=>cycle(-1)}>‹</button><button className="skin-arrow next" aria-label="Next skin" onClick={()=>cycle(1)}>›</button><WeaponInspector weapon={weapon} finish={item.variant}/><div className="arsenal-weapon-name"><small>{['SUBMACHINE GUN','ASSAULT RIFLE','DOUBLE BARREL','BLADE'][weapon]}</small><strong>{['ECHO','KILO','MICA','EDGE'][weapon]}</strong></div></div>
  <div className="arsenal-finish"><div><h3>{item.name.split(' / ').at(-1)}</h3>{!owned&&<span className="skin-progress">{Math.min(profile.balance,item.cost).toLocaleString()} / {item.cost.toLocaleString()} KR</span>}</div><div className="finish-selector"><small className="finish-hint">FINISH</small><div className="finish-swatches" aria-label="Choose finish">{finishes.map(f=><button key={f.id} title={f.name.split(' / ').at(-1)} aria-label={f.name.split(' / ').at(-1)} aria-pressed={item.id===f.id} onClick={()=>setSelection(f.id)} style={{'--swatch':f.color} as React.CSSProperties}>{f.id!=='finish-factory'&&!profile.owned.includes(f.id)?<Lock size={12}/>:weaponFinish(profile,weapon)===f.variant?<Check size={14}/>:null}</button>)}</div><span className="finish-status">{owned?'':item.cost+' KR'}</span></div>
   <button className="arsenal-equip" disabled={busy||equipped||(!owned&&profile.balance<item.cost)} onClick={()=>onAction?onAction(owned?{type:'equip',id:item.id,weapon}:{type:'buy',id:item.id}):onChange(owned?equipWeaponFinish(profile,weapon,item.id):purchase(profile,item.id))}>{equipped?<><Check size={15}/> EQUIPPED</>:owned?'EQUIP':item.cost===0?'UNLOCK FREE':profile.balance<item.cost?`${item.cost-profile.balance} KR NEEDED`:`BUY · ${item.cost} KR`}</button>
  </div>
 </div>;
}

type LockerProps={profile:Profile;onChange:(p:Profile)=>void;onAction?:(a:{type:string;id:string;weapon?:number})=>void;busy?:boolean;initialCharacter?:string|null;onPreviewCharacter?:(id:string|null)=>void};
export function Locker({initialCharacter,onPreviewCharacter,...props}:LockerProps){
 const [tab,setTab]=useState(initialCharacter?'characters':'weapons');
 return <div className="locker-suite"><div className="locker-toolbar"><nav aria-label="Locker category"><button aria-pressed={tab==='weapons'} onClick={()=>{setTab('weapons');onPreviewCharacter?.(null);}}>WEAPONS</button><button aria-pressed={tab==='characters'} onClick={()=>setTab('characters')}>CHARACTERS</button></nav><span className="locker-balance"><KrCredit/>{props.profile.balance.toLocaleString()} KR</span></div>{tab==='weapons'?<WeaponLocker {...props}/>:<CharacterLocker {...props} initialCharacter={initialCharacter} onPreviewCharacter={onPreviewCharacter}/>}</div>;
}
function CharacterLocker({profile,onChange,onAction,busy,initialCharacter,onPreviewCharacter}:LockerProps){
 const [selected,setSelected]=useState(initialCharacter??profile.operator);
 const character=OPERATORS.find(o=>o.id===selected)??OPERATORS[0],owned=profile.owned.includes(character.id),equipped=profile.operator===character.id;
 const choose=(id:string)=>{setSelected(id);onPreviewCharacter?.(id);};
 const act=()=>{if(busy)return;if(onAction)onAction({type:owned?'equip':'buy',id:character.id});else onChange(owned?equipCosmetic(profile,character.id):purchase(profile,character.id));};
 return <section className="character-locker" aria-label="Character locker"><div className="character-choices">{[...OPERATORS].sort((a,b)=>a.cost-b.cost).map(o=><button key={o.id} aria-pressed={o.id===character.id} onClick={()=>choose(o.id)} style={{'--character-color':o.color} as React.CSSProperties}><i aria-hidden="true"/><strong>{o.name}</strong>{profile.owned.includes(o.id)?<Check size={14}/>:<Lock size={14}/>}</button>)}</div><div className="character-showcase"><PartyPreview portrait players={[{id:0,name:character.name,team:0,operator:character.variant,primary:1,weaponFinishes:[0,1,2,3].map(w=>weaponFinish(profile,w)),bot:false,connected:true,ready:false}]} capacity={1}/><div className="character-description"><h3>{character.name}</h3><strong className="character-status">{owned?equipped?'EQUIPPED':'OWNED':<><Lock size={15}/> LOCKED · {character.cost} KR</>}</strong><button className="arsenal-equip" disabled={busy||equipped||(!owned&&profile.balance<character.cost)} onClick={act}>{busy?'SAVING':equipped?'EQUIPPED':owned?'EQUIP':'BUY · '+character.cost+' KR'}</button>{!owned&&profile.balance<character.cost&&<small>{character.cost-profile.balance} KR NEEDED</small>}</div></div></section>;
}
