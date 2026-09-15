import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Rotate3D } from 'lucide-react';
import { WeaponGlyph } from './identity';
export function WeaponInspector({weapon,finish}:{weapon:number;finish:number}) {
 const host=useRef<HTMLDivElement>(null),props=useRef({weapon,finish}),controller=useRef<{setModel:(w:number,f:number)=>void;rotate:(n:number)=>void;reset:()=>void}|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{props.current={weapon,finish};controller.current?.setModel(weapon,finish);},[weapon,finish]);
 useEffect(()=>{
  let stopped=false,cleanup=()=>{};
  void Promise.all([import('three'),import('@/lib/game/graphics')]).then(([T,G])=>{
   if(stopped||!host.current)return;
   const el=host.current,renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}),scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.01,20),pivot=new T.Group();
   let gun:import('three').Group|null=null,raf=0,drag=false,x=0,y=0;
   scene.add(pivot);camera.position.z=4;renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Rotate weapon with arrow keys or drag');el.appendChild(renderer.domElement);
   scene.add(new T.HemisphereLight('#f6f0e2','#293643',2.7));const key=new T.DirectionalLight('#fff1dc',3);key.position.set(-2,3,4);scene.add(key);const rim=new T.DirectionalLight('#8fcfda',2);rim.position.set(2,1,-3);scene.add(rim);
   const draw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!stopped)renderer.render(scene,camera);});};
   const fit=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h);const size=new T.Box3().setFromObject(pivot).getSize(new T.Vector3()),aspect=w/h;const height=Math.max(size.y,size.x/aspect,.15)*1.3;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();draw();};
   const reset=()=>{pivot.rotation.set(-.13,-Math.PI/2+.18,.05);fit();};
   const setModel=(w:number,f:number)=>{if(gun){pivot.remove(gun);G.disposeObject(gun);}gun=G.makeWeapon(w,false,f);gun.position.sub(new T.Box3().setFromObject(gun).getCenter(new T.Vector3()));pivot.add(gun);reset();};
   const rotate=(n:number)=>{pivot.rotation.y+=n;draw();};controller.current={setModel,rotate,reset};setModel(props.current.weapon,props.current.finish);
   const observer=new ResizeObserver(fit);observer.observe(el);
   const down=(e:PointerEvent)=>{drag=true;x=e.clientX;y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
   const move=(e:PointerEvent)=>{if(!drag)return;pivot.rotation.y+=(e.clientX-x)*.008;pivot.rotation.x=T.MathUtils.clamp(pivot.rotation.x+(e.clientY-y)*.008,-.7,.7);x=e.clientX;y=e.clientY;draw();};const up=()=>{drag=false;};
   const keyboard=(e:KeyboardEvent)=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rotate(e.key==='ArrowLeft'?-.15:.15);}if(e.key==='Home'){e.preventDefault();reset();}};
   const lost=(e:Event)=>{e.preventDefault();setFailed(true);};
   const canvas=renderer.domElement;canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',keyboard);canvas.addEventListener('webglcontextlost',lost);
   cleanup=()=>{controller.current=null;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);canvas.remove();if(gun)G.disposeObject(gun);renderer.dispose();renderer.forceContextLoss();};
  }).catch(()=>{if(!stopped)setFailed(true);});
  return()=>{stopped=true;cleanup();};
 },[]);
 return <div className="weapon-inspector"><div className="inspector-canvas" ref={host}/>{failed&&<WeaponGlyph id={weapon} finish={finish}/>}<div className="inspector-controls"><button aria-label="Rotate weapon left" onClick={()=>controller.current?.rotate(-.3)}><Rotate3D size={17}/></button><button aria-label="Reset weapon view" onClick={()=>controller.current?.reset()}><RotateCcw size={17}/></button><button aria-label="Rotate weapon right" onClick={()=>controller.current?.rotate(.3)}><Rotate3D size={17}/></button></div></div>;
}
