import type { ArenaMap, Block, Vec } from '../core.js';
/** Dune: two overlapping ground loops, two limited terraces and a broken pipe route. */
export const DUNE_AREAS = [
  {name:'PUMP',x:0,z:-10}, {name:'MARKET',x:-24,z:1},
  {name:'SERVICE',x:-6,z:16}, {name:'TERRACE',x:18,z:-16}, {name:'YARD',x:21,z:17},
] as const;
export function makeDune():ArenaMap {
 const blocks:Block[]=[];
 const add=(x:number,y:number,z:number,w:number,h:number,d:number,kind='plaster',color='#c6ae86')=>blocks.push({x,y,z,w,h,d,kind,color});
 // Perimeter buildings disguise the bounds; offsets break the rectangular silhouette.
 add(0,3.4,-30,73,6.8,1,'boundary');add(0,3.1,30,73,6.2,1,'boundary');
 add(-36,3.3,0,1,6.6,60,'boundary');add(36,3.1,0,1,6.2,60,'boundary');
 const room=(x:number,z:number,w:number,d:number,h:number,color:string)=>{
  for(const side of [-1,1]){
   add(x+side*(w/2-.3),h/2,z,.6,h,d,'plaster',color);
   const wing=(w-3.6)/2;
   add(x-side*(1.8+wing/2),h/2,z+side*(d/2-.3),wing,h,.6,'plaster',color);
   add(x+side*(1.8+wing/2),h/2,z+side*(d/2-.3),wing,h,.6,'plaster',color);
   add(x,(h+2.9)/2,z+side*(d/2-.3),3.6,h-2.9,.6,'lintel',color);
  }
  add(x,h+.12,z,w+.2,.24,d+.2,'roof',color);
 };
 room(-4,-24,12,8,4.5,'#c4ac82'); // Pump house, north loop passes through both entrances.
 room(-26,0,10,12,3.8,'#bfa47b'); // Market workshop with a true north/south interior.
 add(-6,2.65,3,10,5.3,9,'building','#b49068'); // Mid divider prevents an all-map angle.
 // Covered service route has two large exits and a distinct cool interior.
 add(-6,1.8,12.6,16,3.6,.6,'plaster','#aa9577');add(-6,1.8,19.4,16,3.6,.6,'plaster','#aa9577');
 add(-6,3.72,16,16,.24,7.4,'roof','#bda985');
 // Terrace roofs have usable ground-level underpasses and no central sniper perch.
 for(const [x,z,w,d] of [[18,-16,12,8],[17,0,10,6]]){
  add(x,2.66,z,w,.28,d,'platform','#c5b391');
  for(const side of [-1,1])add(x+side*(w/2-.3),1.26,z,.6,2.52,d,'plaster','#c1a982');
  if(z===0){ // Clear landing for the pipe jump; cover remains on either side.
   add(14.25,3.4,-2.8,4.5,1.2,.4,'parapet','#d4c49f');
   add(20.75,3.4,-2.8,2.5,1.2,.4,'parapet','#d4c49f');
  }else add(x,3.4,z-d/2+.2,w,1.2,.4,'parapet','#d4c49f');
  if(z===0)add(x+w/2-.2,3.32,z+1,.4,1.04,d-2,'parapet','#d4c49f');
  else for(const end of [-19,-13])add(23.8,3.32,end,.4,1.04,1.7,'parapet','#d4c49f');
 }
 // Ten 28cm rises, ordinary ground routes remain usable without jumping.
 for(let i=0;i<10;i++){
  add(31-(i+.5)*.7,(i+1)*.14,-16,.7,(i+1)*.28,3.4,'step','#b7a58c');
  add(18,(i+1)*.14,10-(i+.5)*.7,3.4,(i+1)*.28,.7,'step','#b7a58c');
 }
 add(18,2.68,-8.5,2.4,.24,7,'pipebridge','#936b48'); // -12 to -5; 2m jump to south roof at -3.
 // Deflect the long perimeter approaches into entrances instead of square-ring combat.
 add(-29,2.7,-22,10,5.4,9,'building','#aa8f6d');add(29,2.8,-25,11,5.6,8,'building','#bc9e70');
 add(-29,2.7,23,11,5.4,10,'building','#a58765');add(29,2.4,26,10,4.8,6,'building','#b39d77');
 // Pump machinery is short enough to rotate around; its full-height riser breaks mid sight.
 add(-1,1.1,-10,5.5,2.2,3.2,'pump','#62817b');add(1.1,2.3,-10,1.2,4.6,1.5,'tank','#5e7770');
 add(6,1.05,-19,3.2,2.1,2.8,'crate','#917453');add(-14,.65,-17,3,1.3,2,'stone','#bbad8e');
 add(-15,1.75,-7,5,3.5,.7,'plaster','#c3a87c'); // Offset market entrance.
 add(8,1.7,-5,.7,3.4,6,'plaster','#bba17c');
 // Market counters and fabric shade, separated to keep the interior loop open.
 for(const [x,z] of [[-18,1],[-19,9],[-31,-9]]){
  add(x,.55,z,3,1.1,1.5,'stall','#84674b');add(x,3.3,z,3.8,.10,2.8,'canopy','#487d78');
  for(const side of [-1,1])add(x+side*1.7,1.6,z+1.1,.12,3.2,.12,'timber','#695441');
 }
 add(-18,.55,24,4.5,1.1,2,'stone','#b9a888');
 add(1,1.2,23,4,2.4,2.5,'crate','#8b7154');add(5,.55,11,2,1.1,3,'stone','#bfa984');
 // Excavation machinery and retaining edges frame a ground-level excavation crossing.
 add(25,.65,14,5,1.3,3.6,'machine','#ad793e');add(25,1.8,15,2.6,2.4,2.5,'machine','#b5834b');
 add(9,1.6,24,5.5,3.2,3,'hopper','#826d53');
 add(11,.4,15,.6,.8,9,'stone','#b5a286');add(16,.4,20,9,.8,.6,'stone','#b5a286');
 add(30,1.1,5,3,2.2,2,'crate','#8c765c');add(8,.6,3,2.5,1.2,2,'stone','#bfad8d');
 // Collision for substantial rendered protrusions. Small flush trims stay cosmetic.
 const fixtures:Block[]=[];
 const fixture=(x:number,y:number,z:number,w:number,h:number,d:number)=>fixtures.push({x,y,z,w,h,d,kind:'detail-collision',color:'#936b48'});
 // Cylinder slices approximate the round silhouette rather than filling its entire box.
 const cylinderZ=(x:number,y:number,z:number,r:number,length:number)=>{
  for(let i=0;i<8;i++){const lo=-r+i*r/4,hi=lo+r/4,near=Math.min(Math.abs(lo),Math.abs(hi));
   const width=2*Math.sqrt(Math.max(0,r*r-near*near));fixture(x,y+(lo+hi)/2,z,width,hi-lo,length);}
 };
 cylinderZ(-2.5,1.5,-8.4,.17,1.3);
 // Preserve the open centre of the wheel so bullets can pass through it.
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,b=(i+1)*Math.PI/6,x1=Math.cos(a)*.36,x2=Math.cos(b)*.36,y1=Math.sin(a)*.36,y2=Math.sin(b)*.36;
  fixture(-2.5+(x1+x2)/2,1.5+(y1+y2)/2,-7.72,Math.abs(x2-x1)+.13,Math.abs(y2-y1)+.13,.13);
 }
 cylinderZ(18,2.25,-8.5,.48,7);
 for(const z of [-11,-9,-7])cylinderZ(18,2.25,z,.53,.12);
 for(const x of [17.1,18.9])fixture(x,3.02,-5.2,.12,.42,.12);
 for(const x of [-2.8,.8])fixture(x,.24,-10,.38,.48,3.4);
 for(const x of [-1.2,.25])cylinderZ(x,1.15,-8.38,.43,.24);
 for(const b of blocks){
  if(b.kind==='building'){
   fixture(b.x,b.y+b.h/2+.17,b.z,b.w+.25,.34,b.d+.25);
   for(let x=b.x-b.w/2+1.5;x<b.x+b.w/2-1;x+=2.6)fixture(x,b.y+1.08,b.z+b.d/2+.1,1.5,.13,.30);
  }
  if(b.kind==='platform')for(const side of [-1,1])fixture(b.x+side*(b.w/2-.4),b.y-.24,b.z,.16,.35,b.d);
  if(b.kind==='canopy')fixture(b.x,b.y-.15,b.z+b.d/2,b.w,.3,.04);
  if(b.kind==='stall')for(let i=0;i<4;i++)fixture(b.x-1+i*.65,b.y+b.h/2+.07,b.z,.48,.13,.65);
 }
 for(const [x,z,d,h] of [[-4,-24,8,4.5],[-26,0,12,3.8]]){
  for(const side of [-1,1]){
   for(const dx of [-1.88,1.88])fixture(x+dx,1.48,z+side*(d/2+.025),.16,2.96,.13);
   fixture(x,3.02,z+side*(d/2+.04),4,.2,.16);
   fixture(x+2.6,2.5,z+side*(d/2+.1),.35,.5,.22);
  }
  fixture(x,h-.3,z,1.8,.12,1.8);
 }
 blocks.push(...fixtures);
 // Twelve validated spawn pockets; none are inside architecture or on a roof.
 const points:Vec[]=[[-18,-25],[8,-25],[31,-20],[-32,14],[31,-6],[-32,-15],[-19,27],[3,27],[31,21],[-8,16],[20,23],[-26,1]].map(([x,z])=>({x,y:0,z}));
 return {id:0,name:'DUNE',width:72,depth:60,blocks,spawns:points,
  patrol:[...points,{x:0,y:0,z:-3},{x:-18,y:0,z:5},{x:-6,y:0,z:16},{x:24,y:0,z:5},{x:18,y:2.8,z:-15},{x:17,y:2.8,z:0},{x:29,y:0,z:16}]};
}
