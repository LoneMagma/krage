import type { Actor, Vec } from './core.js';
type Pose = { time: number; pos: Vec; yaw: number; pitch: number; viewHeight: number; stride: number; stanceBlend: number; slideBlend: number; landingCompression: number; life: number; alive: boolean; bot: boolean; name: string };
/** 75ms of server-time interpolation; holds the last pose instead of extrapolating through walls. */
export class RemoteBuffer {
  poses = new Map<number, Pose[]>();
  time = 0;
  latest = 0;
  delay = 0.075;
  accept(id: number, actor: Actor & { life?: number }, time: number) {
    let history = this.poses.get(id) ?? [];
    const last = history.at(-1);
    if (last && (last.life !== (actor.life ?? 0) || last.alive !== actor.alive || last.bot !== actor.bot || last.name !== actor.name || Math.hypot(actor.pos.x-last.pos.x,actor.pos.y-last.pos.y,actor.pos.z-last.pos.z)>4)) history=[];
    const pose = { time, pos: {...actor.pos}, yaw: actor.yaw, pitch: actor.pitch, viewHeight: actor.viewHeight, stride: actor.stride, stanceBlend: actor.stanceBlend ?? (actor.crouched ? 1 : 0), slideBlend: actor.slideBlend ?? 0, landingCompression: actor.landingCompression ?? 0, life: actor.life ?? 0, alive: actor.alive, bot: actor.bot, name: actor.name };
    if (history.at(-1)?.time === time) history[history.length-1]=pose; else history.push(pose);
    if (history.length>12) history.shift();
    this.poses.set(id,history);
    if (this.latest === 0 || time-this.time>0.3) this.time=time-this.delay;
    this.latest=Math.max(this.latest,time);
  }
  advance(dt: number) { this.time=Math.min(this.latest,this.time+Math.min(Math.max(dt,0),0.1)); }
  apply(id: number, actor: Actor) {
    const list=this.poses.get(id); if (!list?.length || !actor.alive) return;
    let a=list[0],b=a;
    for (const pose of list) { b=pose; if (pose.time>=this.time) break; a=pose; }
    const t=b.time===a.time ? 0 : Math.max(0,Math.min(1,(this.time-a.time)/(b.time-a.time)));
    for (const axis of ['x','y','z'] as const) actor.pos[axis]=a.pos[axis]+(b.pos[axis]-a.pos[axis])*t;
    actor.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*t;
    actor.pitch=a.pitch+(b.pitch-a.pitch)*t;
    actor.viewHeight=a.viewHeight+(b.viewHeight-a.viewHeight)*t;
    actor.stride=a.stride+(b.stride-a.stride)*t;
    actor.stanceBlend=a.stanceBlend+(b.stanceBlend-a.stanceBlend)*t;
    actor.slideBlend=a.slideBlend+(b.slideBlend-a.slideBlend)*t;
    actor.landingCompression=a.landingCompression+(b.landingCompression-a.landingCompression)*t;
  }
}
