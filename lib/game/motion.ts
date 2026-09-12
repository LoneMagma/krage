import { clamp, type Actor, type Vec } from './core.js';
/** Analytical two-bone solve. The target is clamped to reachable limb length. */
export function solveLimb(root: Vec, target: Vec, upper: number, lower: number, bend: Vec) {
  let x=target.x-root.x,y=target.y-root.y,z=target.z-root.z;
  const raw=Math.hypot(x,y,z);
  if(raw<1e-7){x=0;y=-1;z=0;}else{x/=raw;y/=raw;z/=raw;}
  const distance=clamp(raw,Math.abs(upper-lower)+0.001,upper+lower-0.001);
  const dot=bend.x*x+bend.y*y+bend.z*z;
  let bx=bend.x-dot*x,by=bend.y-dot*y,bz=bend.z-dot*z;
  let length=Math.hypot(bx,by,bz);
  if(length<1e-6){bx=1-x*x;by=-x*y;bz=-x*z;length=Math.hypot(bx,by,bz);}
  if(length<1e-6){bx=-y*x;by=1-y*y;bz=-y*z;length=Math.hypot(bx,by,bz);}
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const across=Math.sqrt(Math.max(0,upper*upper-along*along));
  return { joint:{x:root.x+x*along+bx/length*across,y:root.y+y*along+by/length*across,z:root.z+z*along+bz/length*across},
    end:{x:root.x+x*distance,y:root.y+y*distance,z:root.z+z*distance} };
}
/** Roll is around the viewing axis: the center ray stays on authoritative aim. */
export function cameraMotion(a: Actor, ads: number, amount: number, _time: number) {
  const gain=clamp(amount,0,1)*(1-clamp(ads,0,1));
  const lateral=Math.cos(a.yaw)*a.vel.x-Math.sin(a.yaw)*a.vel.z;
  return {roll:gain*clamp(-lateral*0.0016*(1+(a.slideBlend??0)*0.4),-0.012,0.012),
    fov:gain*clamp((Math.hypot(a.vel.x,a.vel.z)-3)*0.18,0,1)};
}
