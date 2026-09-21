import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ArenaMap } from '../core.js';
import { DUNE_AREAS } from './dune.js';
/** Static kit is merged by surface: art density does not imply one draw per prop. */
export function buildDuneEnvironment(map:ArenaMap,sky:T.Object3D){
 const group=new T.Group();group.name='dune-settlement';group.add(sky);
 const buckets=new Map<T.Material,T.BufferGeometry[]>(),materials:T.Material[]=[],textures:T.Texture[]=[];
 const surfaces=new Map<string,T.MeshLambertMaterial>();
 const texture=(kind:string)=>{
  const size=128,data=new Uint8Array(size*size*4),tau=Math.PI*2;
  const noise=(x:number,y:number)=>{let h=Math.imul(x+Math.imul(y,374761393)+17,1597334677);h=Math.imul(h^(h>>>16),2246822507);return((h^(h>>>13))>>>0)/4294967295;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const grain=noise(x,y),u=x/size,v=y/size;
   const broad=Math.sin(tau*u)*Math.cos(tau*v)+.5*Math.cos(tau*(2*u+v));
   let value=237+(grain-.5)*8;
   if(kind==='sand')value=232+broad*5+Math.sin(tau*(8*v+.23*Math.sin(tau*u)))*3+(grain-.5)*12;
   if(kind==='plaster')value=234+broad*7+(grain-.5)*10-(grain<.018?16:0);
   if(kind==='stone'){
    const row=Math.floor(y/32),px=(x+(row%2)*32)%64,py=y%32;
    const edge=Math.min(px,64-px,py,32-py),tile=noise(Math.floor((x+(row%2)*32)/64)%2,row);
    value=edge<1.5?177:edge<3?211:230+tile*12+broad*3+(grain-.5)*8;
    // Short mineral fissures stay inside individual pavers.
    if(px>12&&px<34&&Math.abs(py-(12+.22*(px-12)))<.6&&tile>.55)value-=24;
   }
   if(kind==='paving'){const px=x%64,py=y%64,edge=Math.min(px,64-px,py,64-py);const tile=noise(Math.floor(x/64),Math.floor(y/64));value=edge<2?189:edge<4?217:227+tile*17+broad*6+(grain-.5)*11;if(grain<.012&&edge<12)value-=18;}
   if(kind==='wood')value=222+Math.sin(tau*(12*u+.22*Math.sin(tau*2*v)))*9+(grain-.5)*8-(x%32<2?25:0);
   if(kind==='metal')value=230+(grain-.5)*5+Math.sin(tau*32*v)*2-(grain>.995?18:0);
   if(kind==='cloth')value=231+((x%4<2?1:-1)+(y%4<2?1:-1))*3+(grain-.5)*4;
   const c=Math.max(0,Math.min(255,Math.round(value)));data.set([c,c,c,255],(x+y*size)*4);
  }
  const t=new T.DataTexture(data,size,size);t.name='dune-'+kind;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;
 };
 const tiles=new Map(['sand','plaster','stone','wood','metal','cloth','paving'].map(k=>[k,texture(k)]));
 const mat=(color:string,surface='plaster')=>{const key=color+surface;let m=surfaces.get(key);if(!m){m=new T.MeshLambertMaterial({color,map:tiles.get(surface),vertexColors:true});surfaces.set(key,m);materials.push(m);}return m;};
 const add=(geometry:T.BufferGeometry,x:number,y:number,z:number,color:string,surface='plaster',rotation?:T.Euler)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry; if(g!==geometry)geometry.dispose();
  if(rotation)g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(rotation));g.translate(x,y,z);
  const position=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv'),colors=[];
  for(let i=0;i<position.count;i++){
   const ny=normal.getY(i),nx=Math.abs(normal.getX(i));
   if(uv)uv.setXY(i,(nx>.5?position.getZ(i):position.getX(i))*.5,(Math.abs(ny)>.5?position.getZ(i):position.getY(i))*.5);
   const shade=Math.min(1,.84+Math.max(0,position.getY(i))*.035+Math.max(0,ny)*.10);colors.push(shade,shade,shade);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));const m=mat(color,surface);if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(g);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,s='plaster',r?:T.Euler)=>add(new T.BoxGeometry(w,h,d),x,y,z,c,s,r);
 const paving=(x:number,y:number,z:number,w:number,d:number,c:string)=>add(new T.PlaneGeometry(w,d),x,y,z,c,'paving',new T.Euler(-Math.PI/2,0,0));
 const pipe=(x:number,y:number,z:number,r:number,len:number,c:string,axis:'x'|'y'|'z'='y')=>add(new T.CylinderGeometry(r,r,len,10),x,y,z,c,'metal',new T.Euler(axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0));
 const sign=(text:string,x:number,y:number,z:number,width:number,color='#ebe0bd')=>{
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#294643';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#afc5b3';ctx.lineWidth=5;ctx.strokeRect(8,8,496,112);ctx.fillStyle=color;ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68,470);
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;textures.push(t);const m=new T.MeshBasicMaterial({map:t});materials.push(m);const mesh=new T.Mesh(new T.PlaneGeometry(width,width/4),m);mesh.position.set(x,y,z);group.add(mesh);
 };
 box(0,-.55,0,200,1,200,'#c0a57d','sand');box(0,-.16,0,72,.32,60,'#c8b28e','sand');
 // Worn paving follows the actual settlement paths, with sand between the stones.
 for(const [x,z,w,d] of [[0,-10,23,18],[-26,0,7,10],[-6,16,15,6],[27,3,9,34]]){
  paving(x,.025,z,w,d,'#bdac8c');

 }
 for(const b of map.blocks){
  if(b.kind==='detail-collision')continue;
  const kind=b.kind??'plaster',surface=['step','stone','parapet'].includes(kind)?'stone':['crate','stall','timber'].includes(kind)?'wood':['pump','tank','machine','hopper','pipebridge'].includes(kind)?'metal':kind==='canopy'?'cloth':'plaster';
  const masonry=['building','plaster','boundary','lintel'].includes(kind);
  const tone=masonry?(b.z>10?'#b9b4a0':b.x<-12?'#c69676':b.x>10?'#c9b998':'#d3c1a0'):b.color;
  box(b.x,b.y,b.z,b.w,b.h,b.d,tone,surface);
  if(masonry&&b.h>3){
   // Painted damp-course, repaired plaster panels and mortar joints break up broad faces.
   const paint=b.z>10?'#537d78':b.x<-12?'#9c6650':'#a19479';
   box(b.x,b.y-b.h/2+.68,b.z,b.w+.028,.62,b.d+.028,paint,'plaster');
   if(b.w>6)for(let x=b.x-b.w/2+2;x<b.x+b.w/2-1;x+=4.5){
    box(x,b.y-.1,b.z,1.9,Math.min(2.2,b.h-1.5),b.d+.022,'#bba98c','plaster');
    box(x+.95,b.y-.1,b.z,.025,Math.min(2.2,b.h-1.5),b.d+.027,'#aa9676','stone');
   }
   if(b.d>6)for(let z=b.z-b.d/2+2;z<b.z+b.d/2-1;z+=4.5)box(b.x,b.y-.2,z,b.w+.022,1.8,1.7,'#bba98c','plaster');
  }
  if(['building','plaster','boundary','parapet','lintel'].includes(kind)){
   box(b.x,b.y+b.h/2-.06,b.z,b.w+.06,.12,b.d+.06,'#d9c7a2','stone');
   if(b.h>2.5)box(b.x,b.y-b.h/2+.24,b.z,b.w+.035,.45,b.d+.035,'#aa9676','stone');
  }
  if(kind==='building'){
   // Openings here are shuttered; playable doors belong to the room shells.
   for(let x=b.x-b.w/2+1.5;x<b.x+b.w/2-1;x+=2.6){
    box(x,b.y+.2,b.z+b.d/2+.035,1.2,1.6,.05,'#477d78','wood');
    for(let i=0;i<4;i++)box(x,b.y-.35+i*.34,b.z+b.d/2+.075,1.08,.04,.04,'#30564f','wood');
    box(x,b.y+1.08,b.z+b.d/2+.1,1.5,.13,.30,'#dbc7a1','stone');
   }
   box(b.x,b.y+b.h/2+.17,b.z,b.w+.25,.34,b.d+.25,'#ccb58d','stone');
   pipe(b.x-b.w/2+.7,b.y+b.h/2+.7,b.z,.18,1.2,'#826e52');
  }
  if(kind==='crate'){
   for(const side of [-1,1])box(b.x+side*b.w*.32,b.y,b.z,.13,b.h+.04,b.d+.04,'#4e645c','metal');
   for(let i=0;i<3;i++)box(b.x,b.y-b.h*.3+i*b.h*.3,b.z+b.d/2+.025,b.w-.15,.045,.025,'#5e4e3d','wood');
  }
  if(kind==='stall'){
   for(let i=0;i<4;i++)box(b.x-1+i*.65,b.y+b.h/2+.07,b.z,.48,.13,.65,i%2?'#8d9163':'#b28957','wood');
  }
  if(kind==='canopy'){
   for(let i=0;i<6;i++)box(b.x-b.w/2+(i+.5)*b.w/6,b.y+.061,b.z,b.w/12,.008,b.d,'#c9bd91','cloth');
   box(b.x,b.y-.15,b.z+b.d/2,b.w,.3,.04,'#477d78','cloth');
  }
  if(kind==='platform'){
   box(b.x,b.y+b.h/2+.018,b.z,b.w,.026,b.d,'#cab99a','stone');
   for(const side of [-1,1])box(b.x+side*(b.w/2-.4),b.y-.24,b.z,.16,.35,b.d,'#776449','wood');
  }
 }
 // Six reusable prop families: pumps, valves, lamps, conduits, market goods and machinery.
 pipe(-1,1.52,-10,.65,3.9,'#506f68','x');pipe(-2.5,1.5,-8.4,.17,1.3,'#ac8d58','z');
 add(new T.TorusGeometry(.36,.065,6,12),-2.5,1.5,-7.72,'#b07841','metal');
 for(const x of [-2.8,.8])box(x,.24,-10,.38,.48,3.4,'#786447','metal');
 pipe(1.1,4.6,-10,.6,.15,'#b2ab89');
 // Visible pump motor housings and vent slats give the courtyard its landmark.
 for(const x of [-1.2,.25]){pipe(x,1.15,-8.38,.43,.24,'#3e5b55','z');for(let j=0;j<4;j++)box(x, .91+j*.15,-8.245,.6,.055,.025,'#acaa89','metal');}
 // Broken elevated pipe: walkable deck is exactly the collision surface.
 pipe(18,2.25,-8.5,.48,7,'#95724d','z');
 for(const z of [-11,-9,-7]){pipe(18,2.25,z,.53,.12,'#525c50','z');box(18,2.81,z,2.3,.018,.16,'#e3c185','metal');}
 for(const x of [17.1,18.9])box(x,3.02,-5.2,.12,.42,.12,'#e3c185','metal');
 // Steps retain readable risers and a contrasting final edge.
 for(const b of map.blocks.filter(b=>b.kind==='step'))box(b.x,b.y+b.h/2+.008,b.z,b.w,.015,b.d,'#d1bea0','stone');
 // Excavator cab/windows and tracks remain within its collidable silhouette.
 box(25,2.25,16.27,2.15,1.1,.025,'#36564f','metal');box(23.67,2.25,15,.025,1.1,2.0,'#36564f','metal');
 for(const side of [-1,1])box(25,.4,14+side*1.6,4.8,.65,.34,'#4f5143','metal');
 for(let n=0;n<5;n++)for(const side of [-1,1])pipe(23.1+n*.94,.43,14+side*1.78,.22,.10,'#746547','z');
 // Door frames, distinct signs and warm interior fixtures support navigation.
 for(const [x,z,,d,h] of [[-4,-24,12,8,4.5],[-26,0,10,12,3.8]])for(const side of [-1,1]){
  for(const dx of [-1.88,1.88])box(x+dx,1.48,z+side*(d/2+.025),.16,2.96,.13,'#dcc7a1','stone');
  box(x,3.02,z+side*(d/2+.04),4,.2,.16,'#ddcbaa','stone');
  box(x+2.6,2.5,z+side*(d/2+.1),.35,.5,.12,'#334d45','metal');box(x+2.6,2.5,z+side*(d/2+.17),.22,.29,.035,'#f5d49b','metal');
  box(x,h-.3,z,1.8,.12,1.8,'#857957','wood');
 }
 sign('PUMP 07',-4,3.8,-19.57,4.7);sign('MARKET',-26,3.3,6.34,3.6);sign('SERVICE',-6,2.7,19.73,3.6);sign('YARD',9,2.4,25.53,3);
 // Exterior dunes, distant village silhouettes and mesas extend the horizon.
 for(let i=0;i<22;i++){
  const a=i*Math.PI*2/22,x=Math.sin(a)*(61+i%3*5),z=Math.cos(a)*(58+i%4*4);
  const geo=new T.SphereGeometry(1,10,5);geo.scale(9+i%4,5+i%3*2,8+i%3);add(geo,x,-.2,z,i%2?'#b69b72':'#c0a67b','sand');
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,x=Math.sin(a)*78,z=Math.cos(a)*78;
  const mesa=new T.CylinderGeometry(5+i%3,9+i%4,16+i%5,6);add(mesa,x,5,z,i%2?'#b4a084':'#baaa90','stone');
 }
 for(const side of [-1,1])for(let i=0;i<5;i++){
  const x=side*(42+i%2*5),z=-24+i*12,h=6+i%3*1.5;box(x,h/2,z,6,h,6,'#b39e7c');box(x,h+.12,z,6.2,.24,6.2,'#d1bb94','stone');
 }
 // Pumping-settlement silhouette; exterior-only art never becomes invisible cover.
 for(const x of [-13,-7])for(const z of [-40,-34])box(x,4.7,z,.45,9.4,.45,'#6a7666','metal');
 pipe(-10,10.8,-37,4,3.8,'#62817b');pipe(-10,8.9,-37,4.15,.22,'#c9b58f');pipe(-10,12.75,-37,4.1,.15,'#c9b58f');
 box(-10,10.7,-32.98,4.2,.6,.06,'#d1bb94','metal');
 for(let i=0;i<10;i++){box(-6.65,.6+i*.9,-36.8,.07,.07,.85,'#826d53','metal');}
 box(-6.65,4.8,-37.23,.07,9.6,.07,'#826d53','metal');box(-6.65,4.8,-36.37,.07,9.6,.07,'#826d53','metal');
 for(const [material,parts] of buckets){const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(geometry){const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}}
 group.userData.mapMaterials=materials;group.userData.mapTextures=textures;group.userData.areas=DUNE_AREAS;
 return group;
}
