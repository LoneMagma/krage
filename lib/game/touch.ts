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

/** Resolve saved positions against the current viewport, with real pixel hit areas. */
export function fitTouchLayout(raw:ControlLayout,width:number,height:number,insets={left:0,right:0,top:0,bottom:0}):ControlLayout{
 const result=cleanLayout(raw),placed:{x:number;y:number;size:number}[]=[];
 const top=Math.min(116,height*.34)+insets.top,bottom=height-insets.bottom-6;
 const left=insets.left+6,right=width-insets.right-6;
 for(const id of ['stick','fire','jump','ads','crouch','slide','reload','swap'] as ControlId[]){
  const control=result[id];control.size=Math.min(control.size,id==='stick'?Math.max(80,Math.min(120,height*.30)):Math.max(44,Math.min(72,height*.18)));
  const radius=control.size/2,minX=left+radius,maxX=right-radius,minY=top+radius,maxY=bottom-radius;
  const x=Math.max(minX,Math.min(maxX,width*control.x/100)),y=Math.max(minY,Math.min(maxY,height*control.y/100));
  const free=(a:number,b:number)=>placed.every(p=>Math.hypot(a-p.x,b-p.y)>=(control.size+p.size)/2+6);
  let best={x,y},distance=Infinity;
  if(!free(x,y)){
   for(let py=minY;py<=maxY;py+=4)for(let px=minX;px<=maxX;px+=4){const d=(px-x)**2+(py-y)**2;if(d<distance&&free(px,py)){distance=d;best={x:px,y:py};}}
  }
  control.x=best.x/width*100;control.y=best.y/height*100;placed.push({...best,size:control.size});
 }
 return result;
}
export function viewportLayout(width:number,height:number,leftHanded=false):ControlLayout{
 const layout=defaultLayout(leftHanded),spacing=58,right=width-44,bottom=height-40;
 const positions:Record<ControlId,[number,number]>={stick:[66,height-66],fire:[right,height-64],jump:[right-spacing,bottom],crouch:[right-spacing*2,bottom],ads:[right-spacing,bottom-spacing],slide:[right-spacing*2,bottom-spacing],reload:[right,bottom-spacing*1.8],swap:[right-spacing*3,bottom]};
 for(const id of CONTROL_IDS){const [x,y]=positions[id];layout[id].x=(leftHanded?width-x:x)/width*100;layout[id].y=y/height*100;}
 return fitTouchLayout(layout,width,height);
}
