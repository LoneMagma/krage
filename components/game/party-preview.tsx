import { useEffect, useRef } from 'react';
import type { WireActor } from '@/lib/game/network-state';
/** One small renderer shared by the entire party; uses the actual playable rig. */
export function PartyPreview({ players }: { players: WireActor[] }) {
  const host=useRef<HTMLDivElement>(null), current=useRef(players);
  useEffect(()=>{current.current=players;},[players]);
  useEffect(()=>{
    let disposed=false, stop=()=>{};
    void Promise.all([import('three'),import('@/lib/game/graphics'),import('@/lib/game/core')]).then(([T,G,C])=>{
      if(disposed || !host.current)return;
      const renderer=new T.WebGLRenderer({alpha:true,antialias:false});
      renderer.setPixelRatio(1);host.current.appendChild(renderer.domElement);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,15);
      camera.position.set(1.8,1.6,3.6);camera.lookAt(0,.9,0);
      scene.add(new T.HemisphereLight('#eef3ff','#596052',2.8));
      const light=new T.DirectionalLight('#ffe4c5',2);light.position.set(2,4,3);scene.add(light);
      const plate=G.cylinder(scene,0,-.04,0,.64,.09,'#405265',16);
      const base=new C.Match(0,0,0).player;
      const models=new Map<number,ReturnType<typeof G.avatar>>();
      let frame=0,last=0;
      const tick=(time:number)=>{
        if(disposed)return;frame=requestAnimationFrame(tick);
        if(time-last<33)return;const dt=Math.min(.05,(time-last)/1000);last=time;
        const list=current.current,el=host.current;if(!el)return;
        const cols=Math.min(4,Math.max(1,list.length)),rows=Math.ceil(list.length/cols)||1;
        const width=el.clientWidth,height=rows*185;
        if(renderer.domElement.width!==width || renderer.domElement.height!==height)renderer.setSize(width,height,false);
        renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
        for(const [id,model] of models)if(!list.some(p=>p.id===id)){G.disposeObject(model.group);models.delete(id);}
        for(const model of models.values())model.group.visible=false;
        list.forEach((p,index)=>{
          let model=models.get(p.id);
          if(model && model.group.userData.operator!==(p.operator??0)){G.disposeObject(model.group);models.delete(p.id);model=undefined;}
          if(!model){model=G.avatar(p.team===0?'#53d9ef':'#ffae64',p.operator??0);models.set(p.id,model);scene.add(model.group);}
          G.animateAvatar(model,{...base,...p,pos:C.v(),vel:C.v(),alive:true,grounded:true,crouched:false,stanceBlend:0,slide:0,slideBlend:0,landingCompression:0,reload:0,equip:0,weapon:p.primary,yaw:Math.PI+Math.sin(time*.0003)*.2,pitch:0},time/1000,dt);
          model.ring.visible=model.shadow.visible=false;
          const w=Math.floor(width/cols),x=(index%cols)*w,y=(rows-1-Math.floor(index/cols))*185;
          renderer.setViewport(x,y,w,185);renderer.setScissor(x,y,w,185);camera.aspect=w/185;camera.updateProjectionMatrix();renderer.render(scene,camera);model.group.visible=false;
        });
      };
      frame=requestAnimationFrame(tick);
      stop=()=>{cancelAnimationFrame(frame);models.forEach(m=>G.disposeObject(m.group));G.disposeObject(plate);renderer.dispose();renderer.domElement.remove();};
    }).catch(()=>{});
    return()=>{disposed=true;stop();};
  },[]);
  return <div className="party-preview" ref={host} style={{height:Math.max(1,Math.ceil(players.length/4))*185}}><div className="party-names" style={{gridTemplateColumns:`repeat(${Math.min(4,Math.max(1,players.length))},1fr)`}}>{players.map(p=><div key={p.id}><strong>{p.name}</strong><span>{p.bot?'BOT':!p.connected?'RECONNECTING':p.ready?'READY':'CHOOSING'}</span></div>)}</div></div>;
}
