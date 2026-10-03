/** Device-local touch preferences and bounded analogue movement. */
export const TOUCH_DEFAULTS={sensitivity:1,size:1,inset:16};
export function touchPreferences(value:unknown){
 const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
 const number=(key:keyof typeof TOUCH_DEFAULTS,min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key] as number)):TOUCH_DEFAULTS[key];
 return {sensitivity:number('sensitivity',.4,2.4),size:number('size',.8,1.3),inset:number('inset',8,64)};
}
export function touchStick(dx:number,dy:number,radius:number){
 const distance=Math.hypot(dx,dy);if(distance<radius*.12)return {right:0,forward:0};
 const strength=Math.min(1,(distance/radius-.12)/.88);
 return {right:dx/distance*strength,forward:-dy/distance*strength};
}
export class MobileResolution {
 ratio=.85;private seconds=0;private frames=0;
 sample(dt:number){
  if(dt<=0||dt>.5)return false;
  this.seconds+=dt;this.frames++;if(this.seconds<3)return false;
  const fps=this.frames/this.seconds,old=this.ratio;
  this.ratio=Math.max(.55,Math.min(1,this.ratio+(fps<45?-.1:fps>57?.05:0)));
  this.frames=this.seconds=0;return Math.abs(old-this.ratio)>.001;
 }
}
export const CONTROL_IDS=['stick','ads','jump','crouch','slide','fire','reload','swap'] as const;
export type ControlId=typeof CONTROL_IDS[number];
export type ControlLayout=Record<ControlId,{x:number;y:number;size:number;opacity:number}>;
export function defaultLayout(leftHanded=false):ControlLayout{
 const positions=[[12,77],[64,68],[75,68],[85,62],[64,87],[95,78],[75,87],[85,87]];
 return Object.fromEntries(CONTROL_IDS.map((id,i)=>[id,{x:leftHanded?100-positions[i][0]:positions[i][0],y:positions[i][1],size:id==='stick'?104:id==='fire'?62:48,opacity:.85}])) as ControlLayout;
}
export function cleanLayout(raw:unknown):ControlLayout{
 const base=defaultLayout(),data=(raw&&typeof raw==='object'?raw:{}) as Record<string,Record<string,unknown>>;
 for(const id of CONTROL_IDS)for(const key of ['x','y','size','opacity'] as const){const value=data[id]?.[key];if(typeof value==='number'&&Number.isFinite(value)){const [lo,hi]=key==='size'?[44,id==='stick'?160:100]:key==='opacity'?[.2,1]:[4,96];base[id][key]=Math.max(lo,Math.min(hi,value));}}
 return base;
}
