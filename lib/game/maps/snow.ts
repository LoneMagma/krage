import type {ArenaMap,Block,Vec} from '../core.js';
/** Alpine relay: covered turbine hall and gallery, freight apron and service loop. */
export function makeSnow():ArenaMap{
 const blocks:Block[]=[];
 const add=(x:number,y:number,z:number,w:number,h:number,d:number,kind='panel',color='#597080')=>blocks.push({x,y,z,w,h,d,kind,color});
 const wall=(x:number,z:number,w:number,d:number,h=6)=>add(x,h/2,z,w,h,d,'boundary','#7b94a3');
 wall(0,-36,65,1);wall(0,36,65,1);wall(-32,0,1,72);wall(32,0,1,72);
 // Four generous entrances into the main enclosed hall. No stacked blind corners.
 for(const side of [-1,1]){
  for(const offset of [-7.25,7.25])add(-6+offset,3.8,-6+side*12,9.5,7.6,.7);
  add(-6,5.6,-6+side*12,5,4,.7,'lintel');
  for(const offset of [-7.25,7.25])add(-6+side*12,3.8,-6+offset,.7,7.6,9.5);
  add(-6+side*12,5.6,-6,.7,4,5,'lintel');
 }
 add(-6,7.85,-6,25,.5,25,'roof','#b1c4cf');
 add(-6,1.5,-6,6,3,6,'turbine','#3d596a');
 // Two corner storage cases, clear of all four doorways and the gallery stairs.
 add(-15,.65,3,2.4,1.3,2,'crate','#a78a62');
 add(3.5,.5,3.5,1.8,1,1.8,'crate','#a78a62');
 for(const z of [-12,0])add(-6,7.46,z,23.3,.28,.3,'beam','#526774');
 // Gallery along the back wall: two stair access points and an open lower route.
 add(-6,2.86,-13,19,.28,5,'platform','#6f8793');
 for(const x of [-14,2])for(let i=0;i<10;i++)add(x,(i+1)*.15,-2-(i+.5)*.85,3,(i+1)*.3,.85,'step','#82969f');
 for(const x of [-11,0])add(x,3.5,-10.6,5,1,.3,'cover','#9dafb4');
 // Eastern freight apron: staggered containers, with a wide switchback around them.
 add(19,1.5,-22,13,3,5,'cargo','#cb794c');add(23,1.5,1,5,3,12,'cargo','#476a80');
 add(14,1.1,17,8,2.2,4,'cargo','#be7954');add(25,.7,25,3,1.4,3,'crate','#607f90');
 add(16,1.7,-6,3,3.4,3,'generator','#374d5d');
 // Covered southern service passage, perpendicular to the hall rather than a desert alley.
 add(-8,1.8,19,20,3.6,.7);add(-8,1.8,27,20,3.6,.7);
 add(-8,3.8,23,20,.4,8.7,'roof','#6b8494');
 add(-6,1,14,5,2,3,'generator','#536c7c');
 // Rock retaining buttresses shape the western route without hidden colliders.
 for(const [x,z,w,d] of [[-26,-25,8,7],[-26,4,7,8],[-25,30,8,6],[5,31,7,5]])add(x,2,z,w,4,d,'rock','#8a9ba4');
 add(-25,.7,-9,3,1.4,3,'crate','#bc815b');add(3,.8,-27,4,1.6,3,'crate','#ba815d');
 add(27,1.05,-30,3,2.1,2,'generator','#7797a8');
 add(-22,.55,14,2.5,1.1,2,'crate','#c28859');
 const spawns:Vec[]=[[-16,-30],[12,-30],[28,-13],[28,12],[18,30],[-15,32],[-28,16],[-28,-16],[-11,23],[-12,-4],[1,1],[9,8]].map(([x,z])=>({x,y:0,z}));
 return{id:1,name:'SNOW',width:64,depth:72,blocks,spawns,patrol:[...spawns,{x:-6,y:3,z:-13},{x:19,y:0,z:9},{x:-24,y:0,z:18}]};
}
/** Small indoor Snow successor: retains the raised central fight and crouch route. */
export function makeCellII():ArenaMap{
 const blocks:Block[]=[];const add=(x:number,y:number,z:number,w:number,h:number,d:number,kind='panel',color='#8da6bb')=>blocks.push({x,y,z,w,h,d,kind,color});
 for(const z of [-13,13])add(0,2.75,z,33,5.5,1,'boundary');for(const x of [-16,16])add(x,2.75,0,1,5.5,26,'boundary');

 add(0,1.05,0,6,2.1,5,'platform','#536a83');
 for(let i=0;i<7;i++)add(-8+(i+.5)*.7,(i+1)*.15,0,.7,(i+1)*.3,3,'step','#80929e');
 add(6.5,1.05,0,3,2.1,4,'platform','#586a83');
 for(const [x,z] of [[-10,-7],[10,7]])add(x,1.7,z,5,3.4,3,'cargo','#586eac');
 for(const [x,z] of [[8,-6],[-8,7]])add(x,.7,z,3,1.4,2,'crate','#70858c');
 add(0,2.1,8,3,1.5,2,'bridge','#ba9170');for(const x of [-2.5,2.5])add(x,1.4,8,2,2.8,2);
 const spawns=[[-13,-10],[13,10],[13,-10],[-13,10],[0,-10],[-13,2],[13,-2],[0,11]].map(([x,z])=>({x,y:0,z}));
 return{id:3,name:'CELL II',width:32,depth:26,blocks,spawns,patrol:[...spawns,{x:0,y:2.1,z:0},{x:9,y:0,z:0}]};
}
export function encloseCellI(map:ArenaMap):ArenaMap{
 return{...map,id:2,name:'CELL I',blocks:map.blocks.map(b=>({...b,color:b.kind==='crate'?'#b88b58':b.kind==='step'?'#88999d':b.kind==='platform'?'#518d80':'#98afa5',...(b.kind==='wall'&&(Math.abs(b.x)>29||Math.abs(b.z)>24)?{y:2.75,h:5.5}:{} )}))};
}
