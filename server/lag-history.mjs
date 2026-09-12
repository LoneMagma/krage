import { bodyHeight } from '../.server-build/core.js';
/** 200ms maximum look-back. History never crosses a spawn or moves live actors. */
export class LagHistory {
  frames = [];
  record(tick, actors) {
    const frame = { tick, actors: new Map(actors.filter(a=>a.alive).map(a=>[a.id, { pos:{...a.pos}, height:bodyHeight(a), spawnId:a.spawnId }])) };
    if (this.frames.at(-1)?.tick===tick) this.frames[this.frames.length-1]=frame; else this.frames.push(frame);
    while(this.frames.length>26)this.frames.shift();
  }
  pose(actor, requestedTick, currentTick) {
    if (!Number.isSafeInteger(requestedTick) || requestedTick<0 || !actor.alive) return undefined;
    const tick=Math.max(currentTick-24,Math.min(currentTick,requestedTick));
    const frame=this.frames.findLast(f=>f.tick<=tick);
    const pose=frame?.actors.get(actor.id);
    if (!pose || pose.spawnId!==actor.spawnId || currentTick-frame.tick>24) return undefined;
    return pose;
  }
}
