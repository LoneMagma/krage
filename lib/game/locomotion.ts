/** Shared distance cadence for animated feet and audible footfalls. */
export const FOOTSTEP_DISTANCE = 1.35;
export const GAIT_FREQUENCY = Math.PI / FOOTSTEP_DISTANCE;
/** Distance-driven cycle. Torso aim is independent of travel direction. */
export function locomotionSample(stride: number, speed: number, lateral: number, forward: number, side: number, crouch = 0) {
  const cycle = ((stride / (FOOTSTEP_DISTANCE * 2) + side * .5) % 1 + 1) % 1;
  const contact = .42;
  const stance = cycle < contact;
  const swing = (cycle - contact) / (1 - contact);
  const reach = Math.min(.38, speed * .14) * (1 - crouch * .28);
  const travel = stance ? 1 - 2 * ((cycle/contact)**2 * (3-2*cycle/contact)) : -Math.cos(Math.PI * swing);
  // Continuous through forward/backward diagonals; no hip flip at pure strafe.
  const facing = Math.atan2(lateral, Math.abs(forward) + .35);
  return {
    x: travel * reach * lateral,
    z: travel * reach * forward,
    lift: stance ? 0 : Math.sin(Math.PI * swing) ** 2 * Math.min(.075, speed * .016) * (1-crouch*.35),
    planted: stance,
    hips: Math.max(-.35, Math.min(.35, -facing*.3)),
  };
}
