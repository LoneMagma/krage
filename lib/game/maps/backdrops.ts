import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ArenaMap } from '../core.js';
/** Static skyline kits. Geometry is beyond the playable boundary, merged by material. */
export function buildBackdrop(map:ArenaMap){
 const group=new T.Group();group.name=['dune-aqueduct','snow-observatory','cell-freight-district','cell-coastal-yard'][map.id];
 group.scale.set(1.3,1,1.3);group.position.y=-1.2;
 const haze=new T.Color(['#c4b5a1','#9eafc1','#b3c1bf','#9bb3c9'][map.id]);
 const buckets=new Map<string,T.BufferGeometry[]>(),materials:T.Material[]=[];
 const add=(g:T.BufferGeometry,x:number,y:number,z:number,color:string,rotation=0)=>{const part=g.index?g.toNonIndexed():g;if(part!==g)g.dispose();part.rotateY(rotation);part.translate(x,y,z);const list=buckets.get(color)??[];list.push(part);buckets.set(color,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>add(new T.BoxGeometry(w,h,d),x,y,z,c);
 const pole=(x:number,y:number,z:number,r:number,h:number,c:string)=>add(new T.CylinderGeometry(r,r,h,6),x,y,z,c);
 const beam=(a:T.Vector3,b:T.Vector3,r:number,c:string)=>{const g=new T.CylinderGeometry(r,r,a.distanceTo(b),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));const p=a.clone().add(b).multiplyScalar(.5);add(g,p.x,p.y,p.z,c);};
 const wx=map.width/2,dz=map.depth/2;
 if(map.id===0){
  // Weathered water channel crossing a distant ravine, with visible gaps between piers.
  const z=-dz-26;
  for(let i=0;i<9;i++){const x=-40+i*10;box(x,6,z,2.2,12,4,'#ac9475');box(x,11,z,4,1,5,'#c8b190');}
  box(0,12.4,z,86,1.8,5,'#c8b190');box(0,13.8,z+2.2,86,1,.5,'#ac9475');
  for(let i=0;i<7;i++){const x=wx+17+(i%2)*7,z=-25+i*9,h=4+i%3*2;box(x,h/2,z,6,h,5,'#bca783');box(x,h+.25,z,6.6,.5,5.6,'#dac3a1');box(x-3.02,h*.58,z,.05,1.3,1,'#4d7167');}
  for(const [x,z] of [[-wx-18,-8],[-wx-22,15],[wx+20,29]]){
   pole(x,4,z,.28,8,'#806951');
   for(let i=0;i<6;i++){const a=i*Math.PI/3;const g=new T.ConeGeometry(.8,5,3);g.rotateZ(1.2);g.rotateY(a);add(g,x+Math.cos(a)*1.5,8,z+Math.sin(a)*1.5,'#637360');}
  }
 }else if(map.id===1){
  // Glacial shelves, a research station and its cable supports beyond the ridge.
  for(let i=0;i<7;i++){const x=-wx-13-i%2*4,z=-25+i*9;box(x,2+i%3,z,7,5+i%3*2,8,i%2?'#86b9c9':'#b4d9df');box(x,5+i%3*2,z,7.3,.6,8.3,'#e2edf0');}
  const z=-dz-19;box(10,4,z,14,8,9,'#597586');box(10,8.3,z,15,.6,10,'#d4e4e9');box(10,5.4,z+4.55,11,1.5,.06,'#a8dedb');
  add(new T.SphereGeometry(5.4,12,6,0,Math.PI*2,0,Math.PI/2),10,8.6,z,'#d4e4e9');
  for(const x of [-30,-9,30]){pole(x,8,z+8,.35,16,'#597586');box(x,15,z+8,5,.35,.4,'#a8bdc9');}
  beam(new T.Vector3(-30,15,z+8),new T.Vector3(30,15,z+8),.06,'#597586');
  box(-19,11.6,z+8,2.8,2.5,2.2,'#ba8b5f');box(-19,12.1,z+9.12,2.2,.75,.04,'#a8dedb');pole(-19,14,z+8,.06,2.5,'#597586');
 }else if(map.id===2){
  // Sunlit freight district, brick warehouses and a gantry silhouette.
  for(const side of [-1,1])for(let i=0;i<5;i++){
   const x=side*(wx+15+i%2*9),z=-32+i*16,h=10+i%3*4;
   box(x,h/2,z,11,h,12,'#8f8374');box(x,h+.25,z,11.8,.5,12.8,'#d6c9ad');
   for(let j=0;j<3;j++)box(x-side*5.53,h*.65,z-3+j*3,.05,2,1.7,'#638b91');
   box(x,h+1,z,4,1.5,3,'#627978');
  }
  const z=-dz-21;
  for(const x of [-18,18]){box(x,10,z,1.2,20,1.2,'#b6975a');box(x,1,z,5,2,4,'#687a76');}
  box(0,20,z,41,1.5,1.2,'#b6975a');box(5,18.6,z,3,2,2.8,'#687a76');pole(5,14,z,.08,8,'#687a76');
  box(5,9.7,z,.3,.6,.3,'#b6975a');
  for(let i=0;i<7;i++)box(-25+i*8,3,dz+20,7,6,5,i%2?'#687a76':'#b6975a');
 }else{
  // Coastal training yard: low water, breakwaters, lighthouse and distant dock crane.
  box(0,-1.4,dz+66,210,.3,110,'#4c8295');
  for(let i=0;i<16;i++)box(-70+i*9,-1.22,dz+18+i%4*14,5+i%3,.025,.16,'#d5d9cc');
  box(-wx-16,.3,0,9,2.6,100,'#8d9ca6');box(0,.3,dz+17,100,2.6,7,'#8d9ca6');
  const x=wx+24,z=dz+32;
  add(new T.CylinderGeometry(1.8,3.5,20,10),x,10,z,'#d5d9cc');pole(x,13,z,2.3,3,'#5c8295');pole(x,21,z,2.8,2,'#334e66');pole(x,21,z,2.65,1.2,'#e9d6a4');
  add(new T.ConeGeometry(3.1,2,10),x,23,z,'#334e66');
  const back=-dz-24;
  for(let i=0;i<6;i++){box(-28+i*11,3,back,9,6,5,i%2?'#819aab':'#5c8295');box(-28+i*11,6.2,back,9.2,.4,5.2,'#d5d9cc');}
  box(-wx-16,13,-25,1.2,26,1.2,'#d5b379');box(-wx-16,26,-25,1.2,1.2,30,'#d5b379');pole(-wx-16,18,-12,.08,16,'#334e66');
 }
 for(const [color,parts] of buckets){const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geo)continue;const material=new T.MeshLambertMaterial({color:new T.Color(color).lerp(haze,.26)});materials.push(material);const mesh=new T.Mesh(geo,material);mesh.receiveShadow=false;mesh.castShadow=false;group.add(mesh);}
 group.userData.mapMaterials=materials;return group;
}
