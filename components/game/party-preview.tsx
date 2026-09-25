import { Plus, ChevronLeft, ChevronRight, Crown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WireActor } from '@/lib/game/network-state';
export type PartyMember = Pick<WireActor,'id'|'name'|'team'|'operator'|'primary'|'weaponFinishes'|'bot'|'connected'|'ready'>;
/** Independent portrait cameras, one shared renderer. Live outfits and weapons, never thumbnails. */
export function PartyPreview({players,capacity=players.length,you,hostId,onInvite,onKick,inviteLabel='INVITE'}:{players:PartyMember[];capacity?:number;you?:number;hostId?:number|null;onInvite?:()=>void;inviteLabel?:string;onKick?:(id:number)=>void}) {
 const host=useRef<HTMLDivElement>(null),cards=useRef(new Map<number,HTMLButtonElement>()),angles=useRef(new Map<number,number>());
 const current=useRef(players),drag=useRef<{id:number;x:number}|null>(null);
 const [failed,setFailed]=useState(false),[page,setPage]=useState(0),[confirm,setConfirm]=useState<number|null>(null);
 useEffect(()=>{current.current=players;},[players]);
 useEffect(()=>{
  let disposed=false,stop=()=>{};
  void Promise.all([import('three'),import('@/lib/game/graphics'),import('@/lib/game/core')]).then(([T,G,C])=>{
   if(disposed||!host.current)return;
   const el=host.current,renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.autoClear=false;renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,20);
   camera.position.set(0,1.2,3.6);camera.lookAt(0,.85,0);
   scene.add(new T.HemisphereLight('#eef3ff','#596052',2.8));
   const light=new T.DirectionalLight('#ffe4c5',2);light.position.set(2,4,3);scene.add(light);
   const rim=new T.DirectionalLight('#80d8e0',1.4);rim.position.set(-3,2,-2);scene.add(rim);
   const base=new C.Match(0,0,0).player,models=new Map<number,ReturnType<typeof G.avatar>>();
   let frame=0,last=0;
   const tick=(time:number)=>{
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(document.hidden||time-last<33)return;last=time;
    const bounds=el.getBoundingClientRect(),width=Math.max(1,Math.round(bounds.width)),height=Math.max(1,Math.round(bounds.height));
    if(renderer.domElement.width!==width||renderer.domElement.height!==height)renderer.setSize(width,height,false);
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setScissorTest(true);
    for(const [id,model] of models){model.group.visible=false;if(!current.current.some(p=>p.id===id)){scene.remove(model.group);G.disposeObject(model.group);models.delete(id);}}
    for(const p of current.current){
     const card=cards.current.get(p.id);if(!card)continue;
     const rect=card.getBoundingClientRect();if(rect.width<1||rect.height<1)continue;
     let model=models.get(p.id);
     if(model&&model.group.userData.operator!==(p.operator??0)){scene.remove(model.group);G.disposeObject(model.group);models.delete(p.id);model=undefined;}
     if(!model){model=G.avatar(p.team===0?'#53d9ef':'#ffae64',p.operator??0);models.set(p.id,model);scene.add(model.group);}
     G.animateAvatar(model,{...base,...p,pos:C.v(),vel:C.v(),alive:true,grounded:true,weapon:p.primary,yaw:Math.PI+(angles.current.get(p.id)??.38),pitch:0},time/1000,1/30);
     G.poseLobbyAvatar(model,time/1000+p.id);model.ring.visible=false;model.shadow.visible=true;
     camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
     const x=rect.left-bounds.left,y=bounds.bottom-rect.bottom;
     renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(x,y,rect.width,rect.height);renderer.render(scene,camera);model.group.visible=false;
    }
   };
   const lost=(event:Event)=>{event.preventDefault();setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',lost);
   frame=requestAnimationFrame(tick);
   stop=()=>{cancelAnimationFrame(frame);models.forEach(m=>G.disposeObject(m.group));renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  }).catch(()=>{if(!disposed)setFailed(true);});
  return()=>{disposed=true;stop();};
 },[]);
 const slots=Math.min(8,Math.max(1,capacity,players.length)),pages=Math.ceil(slots/4),active=Math.min(page,pages-1);
 return <div className="party-portraits">
  <div className="party-card-grid" style={{'--slots':Math.min(4,slots)} as React.CSSProperties}>
   <div ref={host} className="party-card-canvas"/>
   {Array.from({length:Math.min(4,slots-active*4)},(_,i)=>{
    const p=players[active*4+i];return p?<div className={'party-player-card '+(p.ready?'is-ready':'')} key={p.id}>
     <button className="party-rotate" ref={el=>{if(el)cards.current.set(p.id,el);else cards.current.delete(p.id);}} aria-label={`Rotate ${p.name}, drag or use arrow keys`}
      onPointerDown={e=>{drag.current={id:p.id,x:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(drag.current?.id===p.id){angles.current.set(p.id,(angles.current.get(p.id)??.38)+(e.clientX-drag.current.x)*.014);drag.current.x=e.clientX;}}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();angles.current.set(p.id,(angles.current.get(p.id)??.38)+(e.key==='ArrowLeft'?-.25:.25));}}}>
       {failed&&p.name.slice(0,1)}
     </button>
     <div className="party-card-caption"><strong>{hostId===p.id&&<Crown size={12}/>} {p.name}{p.id===you&&<small> YOU</small>}</strong><span>{!p.connected?'RECONNECTING':p.ready?'READY':'CHOOSING'}</span></div>
     {hostId===you&&p.id!==you&&onKick&&<button className="party-kick" title={confirm===p.id?'Confirm removal':'Remove player'} aria-label={`${confirm===p.id?'Confirm remove':'Remove'} ${p.name}`} onClick={()=>{if(confirm===p.id){onKick(p.id);setConfirm(null);}else setConfirm(p.id);}} onBlur={()=>setConfirm(null)}>{confirm===p.id?'REMOVE?':<X size={14}/>}</button>}
    </div>:<button key={'empty'+i} className="party-slot-empty" onClick={onInvite} disabled={!onInvite}><Plus size={24}/><span>{inviteLabel}</span></button>;
   })}
  </div>
  {pages>1&&<div className="party-pages"><button aria-label="Previous players" disabled={!active} onClick={()=>setPage(active-1)}><ChevronLeft size={16}/></button><span>{active*4+1}–{Math.min(slots,active*4+4)} / {slots}</span><button aria-label="Next players" disabled={active===pages-1} onClick={()=>setPage(active+1)}><ChevronRight size={16}/></button></div>}
 </div>;
}
