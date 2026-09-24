/** Distance-driven foot cycle. Upper-body aim stays independent of travel. */
export function locomotionSample(stride: number, speed: number, lateral: number, forward: number, side: number, crouch = 0) {
  const cycle = ((stride * 6.9 / (Math.PI * 2) + side * .5) % 1 + 1) % 1;
  const stance = cycle < .55;
  const swing = (cycle - .55) / .45;
  const reach = Math.min(.25, speed * .09) * (1 - crouch * .28);
  // Constant ground stroke, eased return; lift peaks in mid-swing.
  const travel = stance ? 1 - 2 * cycle / .55 : -Math.cos(Math.PI * swing);
  const heading = Math.atan2(lateral, -forward);
  const facing = Math.abs(heading) > Math.PI / 2 ? heading - Math.sign(heading) * Math.PI : heading;
  return {
    x: travel * reach * lateral,
    z: travel * reach * forward,
    lift: stance ? 0 : Math.sin(Math.PI * swing) ** 2 * Math.min(.10, speed * .022),
    planted: stance,
    hips: Math.max(-.6, Math.min(.6, -facing)),
  };
}
