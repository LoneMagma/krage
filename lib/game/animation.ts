import { EDGE_ATTACKS, GUNS, EQUIP_SECONDS, clamp, type Actor } from './core.js';
export type MotionState = 'dead' | 'slide' | 'air' | 'crouch' | 'run' | 'idle';
export function motionState(a: Actor): MotionState {
  if (!a.alive) return 'dead';
  if (a.slide > 0) return 'slide';
  if (!a.grounded) return 'air';
  if (a.crouched) return 'crouch';
  return Math.hypot(a.vel.x, a.vel.z) > 0.15 ? 'run' : 'idle';
}
const ramp = (p: number, start: number, end: number) => {
  const t = clamp((p - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Reload phases follow the same timer that controls ammunition and firing. */
export function weaponPose(a: Pick<Actor, 'weapon' | 'reload' | 'fired'>) {
  const progress = a.reload > 0 ? 1 - a.reload / GUNS[a.weapon].reload : 0;
  return {
    phase:
      a.reload <= 0
        ? a.fired > 0
          ? 'fire'
          : 'ready'
        : progress < 0.25
          ? 'open'
          : progress < 0.75
            ? 'feed'
            : 'close',
    lower: ramp(progress, 0, 0.18) * (1 - ramp(progress, 0.8, 1)),
    magazine: ramp(progress, 0.18, 0.42) * (1 - ramp(progress, 0.57, 0.78)),
    hinge: ramp(progress, 0.08, 0.25) * (1 - ramp(progress, 0.78, 0.95)),
    bolt: ramp(progress, 0.81, 0.87) * (1 - ramp(progress, 0.9, 0.96)),
  };
}

/** The weapon swaps only while lowered, using the same timer that blocks firing. */
export function equipPose(
  a: Pick<Actor, 'weapon' | 'previousWeapon' | 'equip'>,
) {
  const progress = clamp(1 - a.equip / EQUIP_SECONDS, 0, 1);
  const t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
  return {
    weapon: progress < 0.5 ? a.previousWeapon : a.weapon,
    lower: t * t * (3 - 2 * t),
  };
}

export function edgePose(a: Pick<Actor,'weapon'|'fired'|'edgeAttack'|'edgeSide'>) {
 const zero={x:0,y:0,z:0,roll:0,yaw:0,pitch:0};
 if(a.weapon!==3||a.fired<=0)return zero;
 const attack=a.edgeAttack??'slash',spec=EDGE_ATTACKS[attack],t=clamp(1-a.fired/spec.duration,0,1);
 if(attack==='stab'){
  const contact=spec.contact/spec.duration;
  const thrust=ramp(t,0,contact)*(1-ramp(t,contact,.78));
  if(thrust===0)return zero;
  return {...zero,x:-thrust*.06,z:-thrust*.43,pitch:thrust*.22};
 }
 const side=a.edgeSide||1,cut=ramp(t,.16,.60),weight=ramp(t,0,.16)*(1-ramp(t,.60,1));
 return {x:side*(.27-.54*cut)*weight,y:(.13-.29*cut)*weight,z:0,
  roll:side*(.65-1.3*cut)*weight,yaw:side*(.16-.32*cut)*weight,pitch:.08*weight};
}
