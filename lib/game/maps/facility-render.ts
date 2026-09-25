import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ArenaMap} from '../core.js';
/** Batched facility kit; all playable solid silhouettes originate in map.blocks. */
export function buildFacility(map:ArenaMap,sky?:T.Object3D){
 const group=new T.Group();group.name=map.id===1?'alpine-relay':'open-cell';if(sky)group.add(sky);
 const indoor=map.id>=2,small=map.id===3;
 const textures:T.Texture[]=[],materials:T.Material[]=[],cache=new Map<string,T.Material>(),buckets=new Map<T.Material,T.BufferGeometry[]>();
 const tex=(surface:string)=>{const data=new Uint8Array(128*128*4);for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  let hash=Math.imul(x+y*128+13,1597334677);hash=Math.imul(hash^(hash>>>16),2246822507);const noise=((hash^(hash>>>13))>>>0)%11;let c=235+noise;
  if(surface==='snow')c=231+noise+Math.sin(x*Math.PI/64)*Math.cos(y*Math.PI/64)*5;
  if(surface==='metal')c=(x%64<2||y%64<2)?158:229+noise;
  if(surface==='concrete'){const seam=x%64<1||y%64<1;c=seam?204:227+noise+Math.sin(x*Math.PI/32)*Math.cos(y*Math.PI/32)*3;}
  if(surface==='wood')c=222+noise+Math.sin(x*Math.PI/4+Math.sin(y*Math.PI/64)) *5-(x%32<2?19:0);
  if(surface==='brick')c=(y%32<2||(x+(Math.floor(y/32)%2)*32)%64<2)?179:225+noise;
  if(surface==='frost')c=228+noise*.45+7*Math.sin(x*Math.PI/64+Math.sin(y*Math.PI/64)*2)+4*Math.cos((x-y)*Math.PI/32);
  if(surface==='cladding')c=y%64<1?192:231+noise*.4-(y%64<4?5:0);
  if(surface==='ice'){const vein=Math.abs(Math.sin(x*Math.PI/64+Math.sin(y*Math.PI/64)*1.5));c=219+noise*.35+Math.sin((x+y)*Math.PI/64)*8+(vein<.035?15:0);}
  if(surface==='rubber')c=((x+y)%12<2)?199:228+noise;
  data.set([c,c,c,255],(x+y*128)*4);
 }const t=new T.DataTexture(data,128,128);t.name=surface;t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;textures.push(t);return t;};
 const tiles={snow:tex('snow'),metal:tex('metal'),rubber:tex('rubber'),concrete:tex('concrete'),brick:tex('brick'),frost:tex('frost'),wood:tex('wood'),cladding:tex('cladding'),ice:tex('ice')};
 const material=(color:string,surface:keyof typeof tiles,glow=false)=>{const key=color+surface+glow;let m=cache.get(key);if(!m){m=glow?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color,map:tiles[surface]});cache.set(key,m);materials.push(m);}return m;};
 let distant=false;
 const add=(g:T.BufferGeometry,x:number,y:number,z:number,c:string,s:keyof typeof tiles='metal',r?:T.Euler,glow=false)=>{
  if(distant){x*=1.2;z*=1.2;y-=1;}
  const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();if(r)geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(r));geo.translate(x,y,z);
  const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');for(let i=0;i<p.count;i++)uv?.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))*.4,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))*.4);
  const m=material(c,s,glow);if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(geo);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,s:keyof typeof tiles='metal',glow=false)=>add(new T.BoxGeometry(w,h,d),x,y,z,c,s,undefined,glow);
 const floor=(x:number,z:number,w:number,d:number,c:string,s:keyof typeof tiles='rubber',height=.012)=>add(new T.PlaneGeometry(w,d),x,height,z,c,s,new T.Euler(-Math.PI/2,0,0));
 box(0,-.2,0,indoor?map.width:190,.4,indoor?map.depth:190,indoor?(small?'#bdc7d1':'#c8c4ae'):'#deebf1',indoor?'concrete':'snow');
 if(!indoor){floor(-6,-6,23.3,23.3,'#a6b0ae','concrete');floor(-8,23,19,7,'#596d79');floor(19,5,11,42,'#abc9ce','ice');}
 for(const b of map.blocks){
  const wall=['panel','boundary','building','wall'].includes(b.kind??'');
  box(b.x,b.y,b.z,b.w,b.h,b.d,!indoor&&wall?(b.kind==='boundary'?'#b0bec2':'#b9c8c9'):b.color,b.kind==='rock'?'frost':b.kind==='crate'?'wood':wall?(indoor?(small?'concrete':'brick'):b.kind==='boundary'?'concrete':'cladding'):'metal',b.kind==='ceiling');
  if(['panel','boundary','building','wall'].includes(b.kind??'')){
   // Painted lower band and flush panel joints, no false walkable ledges.
   const band=indoor?(small?'#547f9c':'#5b9989'):'#cd8052';
   if(!indoor&&b.h>3)box(b.x,b.y+b.h*.24,b.z,b.w+.01,b.h*.36,b.d+.01,'#d0dbd9','cladding');
   if(!indoor&&b.h>3)box(b.x,b.y+b.h/2-.045,b.z,b.w+.025,.09,b.d+.025,'#eef3ed','snow');
   if(indoor&&b.h>3)box(b.x,b.y+b.h/2-.18,b.z,b.w+.015,.12,b.d+.015,small?'#bdd6e4':'#dbd4b9');
   if(b.h>2)box(b.x,b.y-b.h/2+.8,b.z,b.w+.016,.5,b.d+.016,band);
   if(indoor&&b.w>4)for(let x=b.x-b.w/2+2;x<b.x+b.w/2;x+=4)box(x,b.y,b.z,.025,b.h,b.d+.02,'#344c5d');
   if(indoor&&b.d>4)for(let z=b.z-b.d/2+2;z<b.z+b.d/2;z+=4)box(b.x,b.y,z,b.w+.02,b.h,.025,'#344c5d');
  }
  const hallWall=!indoor&&b.kind==='panel'&&b.x>=-18&&b.x<=6&&b.z>=-18&&b.z<=6;
  if(hallWall){
   const alongX=b.w>b.d,sign=Math.sign(-6-(alongX?b.z:b.x));
   const x=alongX?b.x:b.x+sign*(b.w/2+.014),z=alongX?b.z+sign*(b.d/2+.014):b.z;
   box(x,2.2,z,alongX?b.w:.022,4.4,alongX?.022:b.d,'#bbc6c1','cladding');
   box(x+(alongX?0:sign*.014),.4,z+(alongX?sign*.014:0),alongX?b.w:.025,.8,alongX?.025:b.d,'#667c80');
   box(x+(alongX?0:sign*.014),1.15,z+(alongX?sign*.014:0),alongX?b.w:.025,.12,alongX?.025:b.d,'#cd8052');
  }
  if(hallWall){const alongX=b.w>b.d;box(b.x,3.8,b.z,alongX?.14:b.w+.035,7.5,alongX?b.d+.035:.14,'#758c91','metal');}
  if(b.kind==='cargo'||b.kind==='crate'){
   for(let x=b.x-b.w/2+.3;x<b.x+b.w/2;x+=.65)box(x,b.y,b.z,.055,b.h,b.d+.025,'#455966');
   box(b.x,b.y+.5,b.z+b.d/2+.014,Math.min(2,b.w-.3),.18,.018,'#e9c38a');
  }
  if(b.kind==='roof'&&!indoor)box(b.x,b.y+b.h/2+.025,b.z,b.w,.05,b.d,'#e0eaf0','snow');
  if(b.kind==='step')box(b.x,b.y+b.h/2+.009,b.z,b.w,.018,b.d,'#adb9b9','rubber');
  if(b.kind==='generator'){for(let y=.55;y<1.8;y+=.22)box(b.x,y,b.z+b.d/2+.014,b.w*.7,.09,.022,'#263d4c');box(b.x,b.y+.5,b.z+b.d/2+.027,.18,.12,.01,'#bde6c6','metal',true);}
  if(b.kind==='turbine'){for(let x=b.x-2;x<=b.x+2;x+=2)box(x,1.5,b.z+3.015,1.4,2,.025,'#193344');for(let y=.8;y<2.6;y+=.35)box(b.x,y,b.z+3.033,5,.045,.016,'#74a5aa');}
 }
 if(indoor){
  for(const side of [-1,1])for(let z=-map.depth/2+5;z<map.depth/2;z+=10)box(side*(map.width/2-.51),3.9,z,.025,.2,2,small?'#c7e4fa':'#bce8e1','metal',true);
  for(const x of [-map.width/2+3,map.width/2-3])floor(x,0,.1,map.depth-3,small?'#85b0cb':'#58b5af');
 }else{
  // Flush threshold mats and painted approach marks never change collision height.
  for(const z of [-17.1,5.1]){floor(-6,z,4.8,1.4,'#526774','rubber',.018);floor(-6,z,4.6,.08,'#d7ba7c','metal',.022);}
  for(const x of [-17.1,5.1]){floor(x,-6,1.4,4.8,'#526774','rubber',.018);floor(x,-6,.08,4.6,'#d7ba7c','metal',.022);}
  for(const x of [-10.1,-1.9])floor(x,1.9,.075,4.5,'#d7ba7c','metal',.018);
  // Warm readable hangar and tunnel fixtures; inexpensive emissive strips.
  for(const x of [-13,1])box(x,7.58,-6,.35,.035,18,'#d6f0ef','metal',true);
  box(-8,3.57,23,16,.035,.3,'#f2cca0','metal',true);
  distant=true;
  // Mountain amphitheatre and glacier shelves stay outside the playable boundary.
  for(let i=0;i<18;i++){
   const a=i*Math.PI*2/18,r=67+i%3*8,h=19+i%5*5,x=Math.sin(a)*r,z=Math.cos(a)*r,width=18+i%4*4;
   const rock:number[]=[],snow:number[]=[],bottom:T.Vector3[]=[],line:T.Vector3[]=[];
   const peak=new T.Vector3(Math.sin(i*3.7)*5,h,Math.cos(i*2.3)*4);
   for(let j=0;j<9;j++){const angle=j*Math.PI*2/8,shape=.82+.18*Math.sin(j*2.4+i);bottom.push(new T.Vector3(Math.cos(angle)*width*shape,0,Math.sin(angle)*width*.7*shape));const t=.45+.13*Math.sin(j*1.7+i);line.push(bottom[j].clone().lerp(peak,t));}
   const tri=(out:number[],a:T.Vector3,b:T.Vector3,c:T.Vector3)=>out.push(...a.toArray(),...b.toArray(),...c.toArray());
   for(let j=0;j<8;j++){tri(rock,bottom[j],line[j],bottom[j+1]);tri(rock,bottom[j+1],line[j],line[j+1]);tri(snow,line[j],peak,line[j+1]);}
   for(const [vertices,color] of [[rock,i%2?'#8ca2b5':'#a1b5c4'],[snow,'#e1eaf1']] as [number[],string][]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geo.computeVertexNormals();add(geo,x,-3,z,color,'snow');}
  }
  for(let i=0;i<24;i++){const a=i*Math.PI*2/24,x=Math.sin(a)*43,z=Math.cos(a)*49;
   if(Math.abs(x)<34&&Math.abs(z)<38)continue;
   add(new T.CylinderGeometry(.17,.25,4,5),x,2,z,'#4a555d');
   for(let j=0;j<3;j++)add(new T.ConeGeometry(2-j*.4,3,6),x,3+j*1.1,z,j%2?'#809b9d':'#466b72','snow');}
  // Distant relay mast and dish: Snow's orientation landmark, unlike Dune's water tower.
  box(37,8,-24,.7,16,.7,'#668392');box(37,13,-24,8,.3,.3,'#bdcfd4');
  add(new T.SphereGeometry(4,12,6,0,Math.PI*2,0,Math.PI/2),37,14,-24,'#d9e5eb','metal',new T.Euler(.7,0,0));
  box(37,17,-24,.16,2,.16,'#dd946b');
 }
 for(const [m,parts] of buckets){const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(geo){const mesh=new T.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}}
 group.userData.mapMaterials=materials;group.userData.mapTextures=textures;return group;
}
