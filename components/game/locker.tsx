import { useState } from 'react';
import { Check, Lock, Paintbrush } from 'lucide-react';
import { WeaponInspector } from './weapon-inspector';
import { CATALOG, equipWeaponFinish, purchase, weaponFinish, type Profile } from '@/lib/game/progression';
import { WeaponGlyph } from './identity';
export function Locker({profile,onChange}:{profile:Profile;onChange:(profile:Profile)=>void}) {
 const [weapon,setWeapon]=useState(0),[selection,setSelection]=useState(()=>profile.weaponFinishes?.[0]??'finish-factory');
 const skins=CATALOG.filter(item=>'weapon' in item&&item.weapon===weapon).sort((a,b)=>a.cost-b.cost);
 const factory={id:'finish-factory',name:'Factory',variant:0,color:'#a7a8a1',cost:0};
 const finishes=[factory,...skins];const item=finishes.find(i=>i.id===selection)??factory;
 const equipped=weaponFinish(profile,weapon)===item.variant,owned=item.id===factory.id||profile.owned.includes(item.id);
 const chooseWeapon=(id:number)=>{setWeapon(id);setSelection(profile.weaponFinishes?.[id]??'finish-factory');};
 return <div className="arsenal">
  <div className="arsenal-weapons" aria-label="Choose weapon">{['ECHO','KILO','MICA'].map((name,id)=><button key={name} aria-pressed={weapon===id} onClick={()=>chooseWeapon(id)}><WeaponGlyph id={id} finish={weaponFinish(profile,id)}/><strong>{name}</strong></button>)}</div>
  <div className="arsenal-inspection"><WeaponInspector weapon={weapon} finish={item.variant}/><div className="arsenal-weapon-name"><small>{['SUBMACHINE GUN','ASSAULT RIFLE','DOUBLE BARREL'][weapon]}</small><strong>{['ECHO','KILO','MICA'][weapon]}</strong></div></div>
  <div className="arsenal-finish"><div><small><Paintbrush size={13}/> {item.variant===5?'PRESTIGE':item.variant===4?'ELITE':'FIELD'}</small><h3>{item.name.split(' / ').at(-1)}</h3>{!owned&&<span className="skin-progress">{Math.min(profile.balance,item.cost).toLocaleString()} / {item.cost.toLocaleString()} KR</span>}</div><div className="finish-swatches" aria-label="Choose finish">{finishes.map(f=><button key={f.id} title={f.name.split(' / ').at(-1)} aria-label={f.name.split(' / ').at(-1)} aria-pressed={item.id===f.id} onClick={()=>setSelection(f.id)} style={{'--swatch':f.color} as React.CSSProperties}>{f.id!=='finish-factory'&&!profile.owned.includes(f.id)?<Lock size={12}/>:weaponFinish(profile,weapon)===f.variant?<Check size={14}/>:null}</button>)}</div>
   <button className="arsenal-equip" disabled={equipped||(!owned&&profile.balance<item.cost)} onClick={()=>onChange(owned?equipWeaponFinish(profile,weapon,item.id):purchase(profile,item.id))}>{equipped?<><Check size={15}/> EQUIPPED</>:owned?'EQUIP':item.cost===0?'UNLOCK FREE':profile.balance<item.cost?`${item.cost-profile.balance} KR NEEDED`:`BUY · ${item.cost} KR`}</button>
  </div>
 </div>;
}
