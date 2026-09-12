import { useEffect, useRef, useState } from 'react';
import { WeaponGlyph } from './identity';
export function WeaponInspector({weapon,finish}: {weapon:number;finish:number}) {
 const host=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let stopped=false,cleanup=()=>{};
  void Promise.all([import('three'),import('@/lib/game/graphics')]).then(([T,G])=>{
   if(stopped||!host.current)return;
   let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
   const el=host.current,scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,0.01,20),pivot=new T.Group(),gun=G.makeWeapon(weapon,false,finish);
   const bounds=new T.Box3().setFromObject(gun),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
   gun.position.sub(center);pivot.add(gun);scene.add(pivot);pivot.rotation.set(-0.12,-1.05,0.1);
   scene.add(new T.HemisphereLight('#edf6ff','#39424e',2.5));const key=new T.DirectionalLight('#ffe2bc',3.2);key.position.set(-2,3,4);scene.add(key);const rim=new T.DirectionalLight('#8bd7ee',2);rim.position.set(2,1,-3);scene.add(rim);
   camera.position.z=Math.max(size.x,size.y,size.z)*1.75;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));el.appendChild(renderer.domElement);
   let dirty=true,drag=false,x=0,y=0,raf=0;
   const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();dirty=true;};const observer=new ResizeObserver(resize);observer.observe(el);resize();
   const down=(e:PointerEvent)=>{drag=true;x=e.clientX;y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
   const move=(e:PointerEvent)=>{if(!drag)return;pivot.rotation.y+=(e.clientX-x)*0.008;pivot.rotation.x=T.MathUtils.clamp(pivot.rotation.x+(e.clientY-y)*0.008,-0.8,0.8);x=e.clientX;y=e.clientY;dirty=true;};const up=()=>{drag=false;};
   renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
   const frame=()=>{if(dirty){renderer.render(scene,camera);dirty=false;}raf=requestAnimationFrame(frame);};frame();
   cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.remove();G.disposeObject(pivot);renderer.dispose();};
  }).catch(()=>{if(!stopped)setFailed(true);});
  return()=>{stopped=true;cleanup();};
 },[weapon,finish]);
 return <div className="weapon-inspector" ref={host} aria-label="Weapon preview, drag to rotate">{failed&&<WeaponGlyph id={weapon} finish={finish}/>}<span>DRAG TO INSPECT</span></div>;
}
