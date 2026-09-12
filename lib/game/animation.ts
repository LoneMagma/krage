import { GUNS, EQUIP_SECONDS, clamp, type Actor } from './core.js';
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
