import { type Vec, type Block } from './core.js';
const mass = [
  0.7, 0.45, 0.35, 0.7, 1, 1.2, 0.7, 1, 1.2, 0.65, 1, 1.2, 0.65, 1, 1.2,
];
const radius = (i: number) =>
  i === 0 ? 0.17 : i === 1 || i === 2 ? 0.19 : 0.095;
/** Resolve all six faces, removing normal velocity rather than reflecting it back into a joint. */
export function contactPoint(p: Vec, old: Vec, r: number, blocks: Block[]) {
  let contact = false;
  if (p.y < r) {
    p.y = r;
    old.y = r;
    contact = true;
  }
  for (const b of blocks) {
    const dx = b.w / 2 + r - Math.abs(p.x - b.x),
      dy = b.h / 2 + r - Math.abs(p.y - b.y),
      dz = b.d / 2 + r - Math.abs(p.z - b.z);
    if (dx <= 0 || dy <= 0 || dz <= 0) continue;
    const axis = dx < dy && dx < dz ? 'x' : dy < dz ? 'y' : 'z';
    const half = (axis === 'x' ? b.w : axis === 'y' ? b.h : b.d) / 2 + r;
    const side =
      Math.sign(p[axis] - b[axis]) || Math.sign(old[axis] - b[axis]) || 1;
    p[axis] = b[axis] + side * half;
    old[axis] = p[axis];
    contact = true;
  }
  if (contact) {
    old.x += (p.x - old.x) * 0.3;
    old.z += (p.z - old.z) * 0.3;
  }
}
/** One bounded 60 Hz Verlet step. Constraints carry optional stiffness. */
export function stepRagdoll(
  points: Vec[],
  old: Vec[],
  constraints: number[][],
  blocks: Block[],
) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      o = old[i];
    const dx = (p.x - o.x) * 0.99,
      dy = (p.y - o.y) * 0.99,
      dz = (p.z - o.z) * 0.99;
    o.x = p.x;
    o.y = p.y;
    o.z = p.z;
    p.x += dx;
    p.y += dy - 22 / 3600;
    p.z += dz;
  }
  for (let iteration = 0; iteration < 6; iteration++) {
    for (const [a, b, length, stiffness = 1] of constraints) {
      const pa = points[a],
        pb = points[b],
        dx = pb.x - pa.x,
        dy = pb.y - pa.y,
        dz = pb.z - pa.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.00001) continue;
      const correction = ((d - length) / d) * stiffness;
      const wa = (mass[a] ?? 1) / ((mass[a] ?? 1) + (mass[b] ?? 1));
      pa.x += dx * correction * wa;
      pa.y += dy * correction * wa;
      pa.z += dz * correction * wa;
      pb.x -= dx * correction * (1 - wa);
      pb.y -= dy * correction * (1 - wa);
      pb.z -= dz * correction * (1 - wa);
    }
    for (let i = 0; i < points.length; i++)
      contactPoint(points[i], old[i], radius(i), blocks);
  }
  return (
    points.reduce(
      (sum, p, i) =>
        sum +
        (p.x - old[i].x) ** 2 +
        (p.y - old[i].y) ** 2 +
        (p.z - old[i].z) ** 2,
      0,
    ) / points.length
  );
}
