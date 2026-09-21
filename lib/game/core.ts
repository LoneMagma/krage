import {makeSnow,makeCellII,encloseCellI} from './maps/snow.js';
import { makeDune } from './maps/dune.js';
/** Fixed-step gameplay, deliberately independent of the renderer and browser. */
export type Vec = { x: number; y: number; z: number };
export type Block = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  kind?: string;
};
export type Mode = 0 | 1 | 2 | 3;
export type Settings = {
  cameraMotion?: number;
  sensitivity: number;
  fov: number;
  volume: number;
  musicEnabled?: boolean;
  effectsEnabled?: boolean;
  bindings?: Record<string, string>;
  quality: 'potato' | 'balanced' | 'high';
  difficulty: 'dummy' | 'casual' | 'normal' | 'hard';
  crosshair: string;
  invertY: boolean;
  crouchKey: string;
  slideKey: string;
};
export const DEFAULT_SETTINGS: Settings = {
  cameraMotion: 0.65,
  sensitivity: 1,
  fov: 90,
  volume: 0.5,
  musicEnabled: true,
  effectsEnabled: true,
  bindings: {},
  quality: 'balanced',
  difficulty: 'casual',
  crosshair: '#eaffdf',
  invertY: false,
  crouchKey: 'ShiftLeft',
  slideKey: 'KeyC',
};
export const EQUIP_SECONDS = 0.3;
export const GUNS = [
  {
    name: 'ECHO / SMG',
    short: 'ECHO',
    mag: 35,
    damage: 19,
    head: 1.65,
    interval: 0.078,
    reload: 1.65,
    spread: 0.012,
    recoil: 0.014,
    range: 65,
    pellets: 1,
    speed: 1.02,
  },
  {
    name: 'KILO / ASSAULT',
    short: 'KILO',
    mag: 25,
    damage: 32,
    head: 1.9,
    interval: 0.12,
    reload: 2.1,
    spread: 0.004,
    recoil: 0.024,
    range: 95,
    pellets: 1,
    speed: 1,
  },
  {
    name: 'MICA / DOUBLE BARREL',
    short: 'MICA',
    mag: 2,
    damage: 16,
    head: 1.2,
    interval: 0.34,
    reload: 2.25,
    spread: 0.068,
    recoil: 0.062,
    range: 38,
    pellets: 10,
    speed: 0.97,
  },
  {
    name: 'EDGE / BLADE',
    short: 'EDGE',
    mag: 1,
    damage: 1000,
    head: 1,
    interval: 0.48,
    reload: 0,
    spread: 0,
    recoil: 0.03,
    range: 2.65,
    pellets: 1,
    speed: 1.03,
  },
] as const;
export const v = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const dist = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const direction = (yaw: number, pitch: number): Vec =>
  v(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type ArenaMap = {
  id: number;
  name: string;
  width: number;
  depth: number;
  blocks: Block[];
  spawns: Vec[];
  patrol: Vec[];
};
export const MAP_NAMES=['DUNE','SNOW','CELL I','CELL II'] as const;
export function makeMap(id:number):ArenaMap {
 if(id===0)return makeDune();
 if(id===1)return makeSnow();
 if(id===2)return encloseCellI(makeLegacyMap(0));
 if(id===3)return makeCellII();
 throw new Error('Unknown arena');
}
export function makeLegacyMap(id: number): ArenaMap {
  const blocks: Block[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    kind = 'building',
  ) => blocks.push({ x, y, z, w, h, d, color, kind });
  const width = id === 0 ? 60 : 48,
    depth = id === 0 ? 50 : 42;
  const wall = id === 0 ? '#465362' : '#536f83';
  add(0, 2, -depth / 2, width + 1, 4, 1, wall, 'wall');
  add(0, 2, depth / 2, width + 1, 4, 1, wall, 'wall');
  add(-width / 2, 2, 0, 1, 4, depth, wall, 'wall');
  add(width / 2, 2, 0, 1, 4, depth, wall, 'wall');
  if (id === 0) {
    add(-17, 3.5, -12, 10, 7, 8, '#a44f39');
    add(17, 3, -12, 10, 6, 7, '#657887');
    add(-18, 2.6, 12, 9, 5.2, 8, '#3e5367');
    add(18, 3, 13, 9, 6, 8, '#bb6841');
    // Suspended gantry: walking below and fighting above are both valid routes.
    add(0, 3.4, 0, 12, 0.4, 4, '#42586d', 'platform');
    for (const x of [-5.6, 5.6])
      for (const z of [-1.7, 1.7])
        add(x, 1.6, z, 0.5, 3.2, 0.5, '#354557', 'pillar');
    for (let i = 0; i < 10; i++)
      add(
        -11.7 + i * 0.6,
        (i + 1) * 0.18,
        0,
        0.6,
        (i + 1) * 0.36,
        3,
        '#8995a1',
        'step',
      );
    // Short hop from the gantry onto the loading balcony, separated by a 2.2 m gap.
    add(10.5, 1.6, 0, 4.6, 3.2, 4, '#a96a3d', 'platform');
    add(15, 0.4, 0, 2, 0.8, 2, '#675946', 'crate');
    add(13.3, 0.8, 0, 1.2, 1.6, 2, '#776349', 'crate');
    for (const z of [-9, 10]) {
      add(-5, 1, z, 6, 2, 2, '#816041', 'crate');
      add(5, 1, z, 6, 2, 2, '#816041', 'crate');
    }
    // Shot window: a real opening between sill and lintel, not a painted window.
    add(0, 0.55, 10, 4, 1.1, 1, '#647383', 'cover');
    add(0, 2.05, 10, 4, 0.8, 1, '#647383', 'cover');
    add(0, 2, -17, 8, 4, 3, '#96583c', 'furnace');
    add(-25, 1.35, 0, 3, 2.7, 5, '#506c7b', 'tank');
    add(25, 1.35, -2, 3, 2.7, 5, '#506c7b', 'tank');
    add(-12, 0.4, 6, 2, 0.8, 2, '#8a704b', 'crate');
    add(-10, 0.8, 6, 2, 1.6, 2, '#8a704b', 'crate');
  } else {
    add(-13, 3, -11, 8, 6, 6, '#d7e2e2');
    add(13, 3, 11, 8, 6, 6, '#8fa9be');
    add(13, 2.5, -12, 6, 5, 6, '#436c91');
    add(-13, 2.5, 12, 6, 5, 6, '#506884');
    add(0, 1.2, 0, 7, 2.4, 7, '#667cb7', 'platform');
    for (let i = 0; i < 8; i++)
      add(
        -7.7 + i * 0.55,
        (i + 1) * 0.15,
        0,
        0.55,
        (i + 1) * 0.3,
        2.8,
        '#becdd1',
        'step',
      );
    // A side balcony and separated landing reward a controlled air-strafe.
    add(8, 1.2, 0, 4.6, 2.4, 4, '#c0d3da', 'platform');
    add(13.5, 2.45, 0, 6.4, 0.3, 3, '#8eafbf', 'bridge');
    add(16.4, 1.1, 0, 0.5, 2.2, 2.8, '#416888', 'pillar');
    add(18, 0.4, 0, 2, 0.8, 2, '#6484a0', 'crate');
    add(16, 0.8, -3, 2, 1.6, 2, '#6484a0', 'crate');
    for (const z of [-8, 9]) {
      add(-4, 1, z, 3.5, 2, 1.5, '#bed0d7', 'cover');
      add(4, 1, z, 3.5, 2, 1.5, '#bed0d7', 'cover');
    }
    // Offset service gates create peek angles and a low slide-only passage.
    add(0, 1.95, 12, 3, 1.3, 2, '#5f6ca0', 'bridge');
    add(-2.5, 1.4, 12, 2, 2.8, 2, '#5f6ca0', 'cover');
    add(2.5, 1.4, 12, 2, 2.8, 2, '#5f6ca0', 'cover');
    add(-19, 1.25, -2, 2.8, 2.5, 4, '#9bb7c4', 'server');
    add(19, 1.25, 7, 2.8, 2.5, 4, '#9bb7c4', 'server');
  }
  const sx = width / 2 - 3,
    sz = depth / 2 - 3;
  const spawns = [
    v(-sx, 0, -sz),
    v(sx, 0, sz),
    v(sx, 0, -sz),
    v(-sx, 0, sz),
    v(0, 0, -sz),
    v(0, 0, sz),
    v(-sx, 0, 0),
    v(sx, 0, 0),
  ];
  return {
    id,
    name: id === 0 ? 'DUNE' : 'SNOW',
    width,
    depth,
    blocks,
    spawns,
    patrol: [...spawns, v(-9, 0, -5), v(9, 0, 6), v(-9, 0, 6), v(9, 0, -6)],
  };
}
export type Input = {
  forward: number;
  right: number;
  jump: boolean;
  slide: boolean;
  crouch: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  weapon: number;
};
export const emptyInput = (): Input => ({
  forward: 0,
  right: 0,
  jump: false,
  slide: false,
  crouch: false,
  fire: false,
  ads: false,
  reload: false,
  weapon: -1,
});
export const EDGE_ATTACKS = {
  slash: { duration: 0.30, contact: 0.09, range: 1.95, alignment: 0.58 },
  stab: { duration: 0.48, contact: 0.15, range: 2.65, alignment: 0.82 },
} as const;
export type EdgeAttack = keyof typeof EDGE_ATTACKS;
export function beginEdge(a: Actor, attack: EdgeAttack) {
  a.edgeAttack=attack; a.edgeSide=-(a.edgeSide || 1);
  a.edgeWindup=EDGE_ATTACKS[attack].contact;
  a.cooldown=a.fired=EDGE_ATTACKS[attack].duration;
}
export type Actor = {
  edgeAttack?: EdgeAttack;
  edgeSide?: number;
  edgeWindup?: number;
  operator?: number;
  spawnId?: number;
  stanceBlend?: number;
  slideBlend?: number;
  landingCompression?: number;
  id: number;
  name: string;
  team: number;
  pos: Vec;
  vel: Vec;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  score: number;
  weapon: number;
  primary: number;
  previousWeapon: number;
  equip: number;
  viewHeight: number;
  jumpHeld: boolean;
  slideHeld: boolean;
  jumpBuffer: number;
  coyote: number;
  stride: number;
  ammo: number[];
  cooldown: number;
  reload: number;
  grounded: boolean;
  crouched: boolean;
  slide: number;
  slideCooldown: number;
  shield: number;
  respawn: number;
  lastDamage: number;
  fired: number;
  streak: number;
  headshots: number;
  meleeKills: number;
  shots: number;
  recoilPitch: number;
  recoilYaw: number;
  burst: number;
  hits: number;
  bot: boolean;
  ai: {
    seenUntil?:number;
    seenPos?:Vec;
    think: number;
    target: number;
    path: Vec[];
    waypoint: Vec;
    reaction: number;
    strafe: number;
    repath: number;
    stuck: number;
    lastPos: Vec;
  };
};
export type GameEvent = {
  type:
    | 'melee-contact'
    | 'shot'
    | 'hit'
    | 'kill'
    | 'respawn'
    | 'reload'
    | 'equip'
    | 'land'
    | 'jump'
    | 'slide'
    | 'end';
  actor: number;
  attack?: EdgeAttack;
  inputSeq?: number;
  life?: number;
  target?: number;
  weapon?: number;
  pos?: Vec;
  end?: Vec;
  head?: boolean;
  damage?: number;
  surface?: 'actor' | 'world' | 'miss';
  normal?: Vec;
};
/** Robust slab intersection. Returns distance along a unit ray, or Infinity. */
export function rayBox(o: Vec, d: Vec, min: Vec, max: Vec) {
  let near = 0,
    far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min[axis] || o[axis] > max[axis]) return Infinity;
      continue;
    }
    let a = (min[axis] - o[axis]) / d[axis],
      b = (max[axis] - o[axis]) / d[axis];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return Infinity;
  }
  return near;
}
export function wallDistance(o: Vec, d: Vec, blocks: Block[]) {
  let best = d.y < 0 ? Math.max(0, -o.y / d.y) : Infinity;
  for (const b of blocks)
    best = Math.min(
      best,
      rayBox(
        o,
        d,
        v(b.x - b.w / 2, b.y - b.h / 2, b.z - b.d / 2),
        v(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2),
      ),
    );
  return best;
}
export function impactNormal(point: Vec, blocks: Block[]): Vec {
  let distance = Math.abs(point.y),
    normal = v(0, 1, 0);
  for (const b of blocks) {
    if (
      Math.abs(point.x - b.x) > b.w / 2 + 0.002 ||
      Math.abs(point.y - b.y) > b.h / 2 + 0.002 ||
      Math.abs(point.z - b.z) > b.d / 2 + 0.002
    )
      continue;
    for (const [axis, size] of [
      ['x', b.w],
      ['y', b.h],
      ['z', b.d],
    ] as const) {
      const gap = Math.abs(Math.abs(point[axis] - b[axis]) - size / 2);
      if (gap < distance) {
        distance = gap;
        normal = v();
        normal[axis] = point[axis] >= b[axis] ? 1 : -1;
      }
    }
  }
  return normal;
}
export function hasLOS(a: Vec, b: Vec, blocks: Block[]) {
  const len = dist(a, b);
  return (
    wallDistance(
      a,
      v((b.x - a.x) / len, (b.y - a.y) / len, (b.z - a.z) / len),
      blocks,
    ) >=
    len - 0.05
  );
}
export function bodyHeight(a: Actor) {
  return a.crouched || a.slide > 0 ? 1.12 : 1.85 - 0.73 * clamp(a.stanceBlend ?? 0, 0, 1);
}
export function eye(a: Actor) {
  return v(a.pos.x, a.pos.y + a.viewHeight, a.pos.z);
}
function overlapsXZ(p: Vec, b: Block, r = 0.34) {
  return (
    p.x + r > b.x - b.w / 2 &&
    p.x - r < b.x + b.w / 2 &&
    p.z + r > b.z - b.d / 2 &&
    p.z - r < b.z + b.d / 2
  );
}
export function moveActor(a: Actor, input: Input, dt: number, map: ArenaMap) {
  const wasGrounded = a.grounded,
    previousFootY = a.pos.y,
    fallingSpeed = Math.max(0, -a.vel.y);
  a.landingCompression = (a.landingCompression ?? 0) * Math.exp(-dt * 12);
  a.jumpBuffer =
    input.jump && !a.jumpHeld ? 0.15 : Math.max(0, a.jumpBuffer - dt);
  a.jumpHeld = input.jump;
  a.coyote = a.grounded ? 0.08 : Math.max(0, a.coyote - dt);
  if (
    input.slide &&
    !a.slideHeld &&
    a.slideCooldown <= 0 &&
    a.grounded &&
    Math.hypot(a.vel.x, a.vel.z) > (a.crouched ? 2.5 : 4)
  ) {
    a.slide = 0.55;
    a.slideCooldown = 1.3;
    const speed = Math.hypot(a.vel.x, a.vel.z);
    a.vel.x = (a.vel.x / speed) * Math.min(8.8, Math.max(7.2, speed + 2.6));
    a.vel.z = (a.vel.z / speed) * Math.min(8.8, Math.max(7.2, speed + 2.6));
  }
  a.slideHeld = input.slide;
  a.crouched = input.crouch;
  if (
    !a.crouched &&
    a.slide <= 0 &&
    map.blocks.some(
      (b) =>
        overlapsXZ(a.pos, b) &&
        b.y - b.h / 2 > a.pos.y + 0.1 &&
        b.y - b.h / 2 < a.pos.y + 1.85,
    )
  )
    a.crouched = true;
  a.stanceBlend = (a.stanceBlend ?? 0) + ((a.crouched || a.slide > 0 ? 1 : 0) - (a.stanceBlend ?? 0)) * (1 - Math.exp(-dt * 22));
  a.slideBlend = (a.slideBlend ?? 0) + ((a.slide > 0 ? 1 : 0) - (a.slideBlend ?? 0)) * (1 - Math.exp(-dt * 16));
  const height = bodyHeight(a);
  a.viewHeight += (height - 0.18 - (a.landingCompression ?? 0) * 0.065 - a.viewHeight) * (1 - Math.exp(-dt * 28));
  let wx = -Math.sin(a.yaw) * input.forward + Math.cos(a.yaw) * input.right,
    wz = -Math.cos(a.yaw) * input.forward - Math.sin(a.yaw) * input.right;
  const magnitude = Math.min(1, Math.hypot(wx, wz)),
    len = Math.hypot(wx, wz);
  if (len > 0) {
    wx /= len;
    wz /= len;
  }
  const speed =
    (a.crouched ? 2.85 : 6.08) *
    GUNS[a.weapon].speed *
    (input.ads && a.weapon !== 3 ? 0.66 : 1) *
    magnitude;
  if (a.slide > 0) {
    const length = Math.hypot(a.vel.x, a.vel.z),
      next = length * Math.exp(-1.08 * dt);
    a.vel.x *= next / Math.max(length, 0.001);
    a.vel.z *= next / Math.max(length, 0.001);
    // A small steering arc preserves momentum without allowing instant turns.
    if (magnitude > 0 && next > 0) {
      const angle = Math.atan2(
        a.vel.x * wz - a.vel.z * wx,
        a.vel.x * wx + a.vel.z * wz,
      );
      const turn = clamp(angle, -0.95 * dt, 0.95 * dt);
      const x = a.vel.x;
      a.vel.x = x * Math.cos(turn) - a.vel.z * Math.sin(turn);
      a.vel.z = x * Math.sin(turn) + a.vel.z * Math.cos(turn);
    }
  } else if (a.grounded) {
    const dx = wx * speed - a.vel.x,
      dz = wz * speed - a.vel.z,
      d = Math.hypot(dx, dz);
    const opposing = a.vel.x * wx + a.vel.z * wz < 0,
      acceleration = magnitude === 0 ? 78 : opposing ? 72 : 54;
    const change = Math.min(1, (acceleration * dt) / Math.max(d, 0.001));
    a.vel.x += dx * change;
    a.vel.z += dz * change;
  } else if (magnitude > 0) {
    // Steer the horizontal velocity toward WASD, including reversing in mid-air.
    // Retain slide-jump momentum without allowing air steering to manufacture speed.
    const cap=Math.max(speed,Math.hypot(a.vel.x,a.vel.z));
    const dx=wx*cap-a.vel.x,dz=wz*cap-a.vel.z;
    const blend=Math.min(1,22*dt*magnitude/Math.max(.001,Math.hypot(dx,dz)));
    a.vel.x+=dx*blend;a.vel.z+=dz*blend;
  }
  const horizontal = Math.hypot(a.vel.x, a.vel.z);
  if (horizontal > 10.2) {
    a.vel.x *= 10.2 / horizontal;
    a.vel.z *= 10.2 / horizontal;
  }
  if (a.jumpBuffer > 0 && a.coyote > 0) {
    a.vel.y = 8.4;
    a.grounded = false;
    a.slide = 0;
    a.jumpBuffer = 0;
    a.coyote = 0;
  }
  a.vel.y -= 30 * dt;
  if (a.grounded) a.stride += Math.hypot(a.vel.x, a.vel.z) * dt;
  for (const axis of ['x', 'z'] as const) {
    // Keep the incoming direction across overlapping colliders; contact zeros velocity.
    const travel=a.vel[axis],origin=a.pos[axis];
    a.pos[axis] += travel * dt;
    for (const b of map.blocks) {
      if (
        !overlapsXZ(a.pos, b) ||
        a.pos.y + height <= b.y - b.h / 2 + 0.01 ||
        a.pos.y >= b.y + b.h / 2 - 0.01
      )
        continue;
      const top = b.y + b.h / 2;
      if (wasGrounded && top - a.pos.y <= 0.43 && a.vel.y <= 0) {
        a.pos.y = top;
        a.vel.y = 0;
        continue;
      }
      a.pos[axis] =
        (travel > 0 || (travel === 0 && origin < b[axis]))
          ? b[axis] - (axis === 'x' ? b.w : b.d) / 2 - 0.341
          : b[axis] + (axis === 'x' ? b.w : b.d) / 2 + 0.341;
      a.vel[axis] = 0;
    }
  }
  const oldY = a.pos.y;
  a.pos.y += a.vel.y * dt;
  a.grounded = false;
  if (a.pos.y <= 0) {
    a.pos.y = 0;
    a.vel.y = 0;
    a.grounded = true;
  }
  for (const b of map.blocks) {
    if (!overlapsXZ(a.pos, b)) continue;
    const top = b.y + b.h / 2,
      bottom = b.y - b.h / 2;
    if (a.vel.y <= 0 && oldY >= top - 0.04 && a.pos.y <= top) {
      a.pos.y = top;
      a.vel.y = 0;
      a.grounded = true;
    } else if (
      a.vel.y > 0 &&
      oldY + height <= bottom + 0.04 &&
      a.pos.y + height >= bottom
    ) {
      a.pos.y = bottom - height;
      a.vel.y = 0;
    }
  }
  // Stay in contact descending ordinary stairs; never snap a deliberate jump.
  if (wasGrounded && !a.grounded && a.vel.y <= 0 && a.jumpBuffer === 0) {
    let support = 0;
    for (const b of map.blocks) {
      const top = b.y + b.h / 2;
      if (overlapsXZ(a.pos, b) && top <= oldY + 0.01)
        support = Math.max(support, top);
    }
    if (oldY - support <= 0.43 && oldY >= support) {
      a.pos.y = support;
      a.vel.y = 0;
      a.grounded = true;
      a.viewHeight = Math.min(1.95, a.viewHeight + oldY - support);
    }
  }
  if (a.slide > 0 && Math.hypot(a.vel.x, a.vel.z) < 1.5) a.slide = 0;
  if (!wasGrounded && a.grounded && fallingSpeed > 2)
    a.landingCompression = clamp((fallingSpeed - 2) / 10, 0, 1);
  // Keep the shared camera/shot origin under ceilings while the posture eases down.
  for (const b of map.blocks) {
    const ceiling = b.y - b.h / 2 - a.pos.y;
    if (overlapsXZ(a.pos, b) && ceiling > height - 0.02) {
      a.viewHeight = Math.min(a.viewHeight, ceiling - 0.08);
      if (ceiling < 1.85) a.stanceBlend = Math.max(a.stanceBlend ?? 0, clamp((1.85-ceiling+0.03)/0.73,0,1));
    }
  }
  // Absorb stair rises in the simulation eye so camera AND rays stay aligned.
  const stairRise = a.pos.y - previousFootY;
  if (wasGrounded && a.grounded && stairRise > 0 && stairRise <= 0.43)
    a.viewHeight = Math.max(0.55, a.viewHeight - stairRise);
  a.pos.x = clamp(a.pos.x, -map.width / 2 + 1, map.width / 2 - 1);
  a.pos.z = clamp(a.pos.z, -map.depth / 2 + 1, map.depth / 2 - 1);
}
export class Navigation {
  nodes: Vec[] = [];
  neighbors: number[][] = [];
  constructor(public map: ArenaMap) {
    if(map.id!==2){this.buildLayered();return;}
    const cells = new Map<string, number>();
    for (let x = -map.width / 2 + 2; x <= map.width / 2 - 2; x += 2)
      for (let z = -map.depth / 2 + 2; z <= map.depth / 2 - 2; z += 2) {
        const p = v(x, 0, z);
        if (
          !map.blocks.some(
            (b) => b.y - b.h / 2 < 1.85 && overlapsXZ(p, b, 0.65),
          )
        ) {
          cells.set(`${x},${z}`, this.nodes.length);
          this.nodes.push(p);
        }
      }
    this.neighbors = this.nodes.map((p) => {
      const near: number[] = [];
      for (const dx of [-2, 0, 2])
        for (const dz of [-2, 0, 2]) {
          if (dx === 0 && dz === 0) continue;
          const j = cells.get(`${p.x + dx},${p.z + dz}`);
          if (j === undefined) continue;
          if (
            dx &&
            dz &&
            (!cells.has(`${p.x + dx},${p.z}`) ||
              !cells.has(`${p.x},${p.z + dz}`))
          )
            continue;
          if (hasLOS(v(p.x, 0.8, p.z), v(p.x + dx, 0.8, p.z + dz), map.blocks))
            near.push(j);
        }
      return near;
    });
  }

  /** Separate ground/terrace nodes; sample full actor clearance along every edge. */
  private buildLayered() {
    const map=this.map,cells=new Map<string,number[]>();
    const nearby=(x:number,z:number)=>map.blocks.filter(b=>Math.abs(x-b.x)<b.w/2+2.5&&Math.abs(z-b.z)<b.d/2+2.5);
    const clear=(p:Vec,blocks:Block[])=>!blocks.some(b=>overlapsXZ(p,b,.35)&&b.y+b.h/2>p.y+.02&&b.y-b.h/2<p.y+1.85);
    const surfaces=new Set(['step','platform','pipebridge']);
    for(let x=-map.width/2+2;x<=map.width/2-2;x+=2)for(let z=-map.depth/2+2;z<=map.depth/2-2;z+=2){
      const blocks=nearby(x,z),walkable=blocks.filter(b=>surfaces.has(b.kind??''));
      const centered=walkable.some(b=>Math.abs(x-b.x)<=b.w/2+.001&&Math.abs(z-b.z)<=b.d/2+.001);
      const heights=[0,...(centered?walkable.filter(b=>overlapsXZ(v(x,0,z),b,.35)).map(b=>b.y+b.h/2):[])];
      for(const y of new Set(heights))if(clear(v(x,y,z),blocks)){
        const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);
        cells.get(key)!.push(this.nodes.length);this.nodes.push(v(x,y,z));
      }
    }
    this.neighbors=this.nodes.map(p=>{
      const out:number[]=[],blocks=nearby(p.x,p.z);
      for(const dx of [-2,0,2])for(const dz of [-2,0,2]){
        if(!dx&&!dz)continue;
        for(const j of cells.get(`${p.x+dx},${p.z+dz}`)??[]){
          const q=this.nodes[j];let height=p.y,valid=true;
          // Eight samples catch stair risers, headroom and diagonal wall corners.
          for(let k=1;k<=8;k++){
            const point=v(p.x+dx*k/8,height,p.z+dz*k/8);let support=0;
            for(const b of blocks){const top=b.y+b.h/2;if(top<=height+.431&&overlapsXZ(point,b,.35))support=Math.max(support,top);}
            if(height-support>.44){valid=false;break;} // No imaginary bridges across the skill gap.
            point.y=support;if(!clear(point,blocks)){valid=false;break;}height=support;
          }
          if(valid&&Math.abs(height-q.y)<.04)out.push(j);
        }
      }
      return out;
    });
  }

  nearest(p: Vec) {
    let best = 0,
      min = Infinity;
    this.nodes.forEach((q, i) => {
      const d = dist(p, q);
      if (d < min) {
        min = d;
        best = i;
      }
    });
    return best;
  }
  path(from: Vec, to: Vec) {
    const start = this.nearest(from),
      goal = this.nearest(to);
    const open = new Set([start]);
    const cost = new Map([[start, 0]]),
      prev = new Map<number, number>();
    let loops = 0;
    while (open.size && loops++ < Math.max(600, this.nodes.length)) {
      let cur = -1,
        score = Infinity;
      for (const n of open) {
        const s = cost.get(n)! + dist(this.nodes[n], this.nodes[goal]);
        if (s < score) {
          score = s;
          cur = n;
        }
      }
      if (cur === goal) {
        const out = [this.nodes[cur]];
        while (prev.has(cur)) {
          cur = prev.get(cur)!;
          out.unshift(this.nodes[cur]);
        }
        return out.slice(1);
      }
      open.delete(cur);
      for (const n of this.neighbors[cur]) {
        const c = cost.get(cur)! + dist(this.nodes[cur], this.nodes[n]);
        if (c < (cost.get(n) ?? Infinity)) {
          cost.set(n, c);
          prev.set(n, cur);
          open.add(n);
        }
      }
    }
    return [];
  }
}
export class Match {
  actors: Actor[] = [];
  map: ArenaMap;
  nav: Navigation;
  events: GameEvent[] = [];
  recentSpawns: {pos:Vec;time:number}[] = [];
  recentDeaths: {pos:Vec;time:number}[] = [];
  time = 300;
  duration = 300;
  elapsed = 0;
  ended = false;
  teams = [0, 0];
  winner = '';
  random: () => number;
  constructor(
    public mode: Mode,
    mapId = 0,
    public botCount = 3,
    public difficulty: Settings['difficulty'] = 'casual',
    seed = Date.now(),
    public fragLimit = 20,
  ) {
    this.map = makeMap(mapId);
    this.nav = new Navigation(this.map);
    this.random = rng(seed);
    const count =
      mode === 0
        ? clamp(botCount, 0, 7) + 1
        : mode === 1
          ? 2
          : mode === 2
            ? 4
            : 6;
    const names = ['YOU', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
    for (let i = 0; i < count; i++) {
      const team = mode < 2 ? i : i % 2;
      const a: Actor = {
        id: i,
        name: names[i],
        team,
        pos: v(),
        vel: v(),
        yaw: 0,
        pitch: 0,
        hp: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        score: 0,
        weapon: i === 0 ? 1 : i % 3,
        primary: i === 0 ? 1 : i % 3,
        previousWeapon: i === 0 ? 1 : i % 3,
        equip: 0,
        viewHeight: 1.67,
        jumpHeld: false,
        slideHeld: false,
        jumpBuffer: 0,
        coyote: 0,
        stride: 0,
        ammo: [32, 30, 2, 1],
        cooldown: 0,
        reload: 0,
        grounded: true,
        crouched: false,
        slide: 0,
        slideCooldown: 0,
        shield: 0,
        respawn: 0,
        lastDamage: 0,
        fired: 0,
        streak: 0,
        headshots: 0,
        meleeKills: 0,
        shots: 0,
        recoilPitch: 0,
        recoilYaw: 0,
        burst: 0,
        hits: 0,
        bot: i > 0,
        ai: {
          think: 0,
          target: -1,
          path: [],
          waypoint: this.map.spawns[i],
          reaction: 0,
          strafe: 1,
          repath: 0,
          stuck: 0,
          lastPos: v(),
        },
      };
      this.actors.push(a);
      this.spawn(a, true);
    }
    this.events = [];
  }
  get player() {
    return this.actors[0];
  }
  enemy(a: Actor, b: Actor) {
    return a.id !== b.id && (this.mode < 2 || a.team !== b.team);
  }
  spawn(a: Actor, initial = false) {
    a.spawnId = (a.spawnId ?? 0) + 1;
    a.stanceBlend = a.slideBlend = a.landingCompression = 0;
    const candidates =
      this.map.id!==2 ? this.map.spawns : this.mode === 1
        ? [v(-10, 0, -5), v(10, 0, 5), v(-10, 0, 5), v(10, 0, -5)]
        : [
            v(-10, 0, 5),
            v(10, 0, -5),
            v(-10, 0, -5),
            v(10, 0, 5),
            ...this.map.spawns,
          ];
    const spawnPoints = candidates.filter(p=>!this.map.blocks.some(b=>overlapsXZ(p,b,.38)&&b.y-b.h/2<p.y+1.85&&b.y+b.h/2>p.y+.01));
    let point = spawnPoints[a.id % spawnPoints.length] ?? this.map.spawns[0];
    if (!initial) {
      let best = -Infinity;
      for (const p of spawnPoints) {
        if(this.map.blocks.some(b=>Math.abs(p.x-b.x)<b.w/2+0.38&&Math.abs(p.z-b.z)<b.d/2+0.38&&b.y-b.h/2<1.85&&b.y+b.h/2>0.1)) continue;
        let safety = 80;
        for (const e of this.actors) {
          if (!e.alive || !this.enemy(a, e)) continue;
          const d = dist(p, e.pos);
          safety = Math.min(
            safety,
            d - (hasLOS(v(p.x, 1.6, p.z), eye(e), this.map.blocks) ? 10 : 0),
          );
        }
        for(const other of this.actors) if(other.alive&&other.id!==a.id&&dist(p,other.pos)<1.2) safety-=100;
        for(const recent of this.recentSpawns) if(this.elapsed-recent.time<4) safety-=Math.max(0,6-dist(p,recent.pos))*5;
        for(const death of this.recentDeaths) if(this.elapsed-death.time<8) safety-=Math.max(0,8-dist(p,death.pos))*3;
        safety += this.random() * 2;
        if (safety > best) {
          best = safety;
          point = p;
        }
      }
    }
    this.recentSpawns.push({pos:{...point},time:this.elapsed});
    this.recentSpawns=this.recentSpawns.slice(-16);
    a.edgeWindup = 0;
    a.edgeAttack = undefined;
    a.pos = { ...point };
    a.vel = v();
    a.hp = 100;
    a.alive = true;
    a.weapon = a.primary;
    a.previousWeapon = a.primary;
    a.equip = 0;
    a.viewHeight = 1.67;
    a.jumpHeld = false;
    a.slideHeld = false;
    a.jumpBuffer = 0;
    a.coyote = 0;
    a.stride = 0;
    a.ammo = [0, 0, 0, 1];
    a.ammo[a.primary] = GUNS[a.primary].mag;
    a.reload = 0;
    a.cooldown = 0.25;
    a.shield = 1.6;
    a.slide = 0;
    a.crouched = false;
    a.grounded = true;
    a.lastDamage = this.elapsed;
    a.yaw = Math.atan2(point.x, point.z);
    a.pitch = 0;
    a.recoilPitch = a.recoilYaw = a.burst = 0;
    a.ai.path = [];
    a.ai.target = -1;
    a.ai.seenUntil=0;a.ai.seenPos=undefined;
    this.events.push({ type: 'respawn', actor: a.id });
  }
  pendingSpawn = false;
  selectPrimary(primary: number) {
    if (
      !Number.isInteger(primary) ||
      primary < 0 ||
      primary > 2 ||
      !this.pendingSpawn ||
      this.ended
    )
      return false;
    this.player.primary = primary;
    return true;
  }
  deployPlayer() {
    if (!this.pendingSpawn || this.player.respawn > 0 || this.ended)
      return false;
    this.pendingSpawn = false;
    this.spawn(this.player);
    return true;
  }
  reload(a: Actor) {
    if (
      a.weapon === 3 ||
      a.reload > 0 ||
      a.ammo[a.weapon] === GUNS[a.weapon].mag
    )
      return;
    a.reload = GUNS[a.weapon].reload;
    this.events.push({ type: 'reload', actor: a.id, weapon: a.weapon });
  }
  switch(a: Actor, n: number) {
    if (!a.alive || (n !== a.primary && n !== 3) || n === a.weapon) return;
    a.previousWeapon =
      a.equip > EQUIP_SECONDS / 2 ? a.previousWeapon : a.weapon;
    a.weapon = n;
    a.equip = EQUIP_SECONDS;
    a.reload = 0;
    a.fired = 0;
    a.edgeWindup = 0;
    a.cooldown = Math.max(a.cooldown, EQUIP_SECONDS);
    this.events.push({ type: 'equip', actor: a.id, weapon: n });
  }
  damage(victim: Actor, attacker: Actor, amount: number, head = false) {
    if (!victim.alive || victim.shield > 0 || !this.enemy(victim, attacker))
      return;
    victim.hp -= amount;
    victim.lastDamage = this.elapsed;
    this.events.push({
      type: 'hit',
      actor: attacker.id,
      target: victim.id,
      damage: amount,
      head,
    });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.streak = 0;
      this.recentDeaths.push({pos:{...victim.pos},time:this.elapsed});
      this.recentDeaths=this.recentDeaths.slice(-16);
      victim.respawn = 2;
      if (victim.id === 0) this.pendingSpawn = true;
      attacker.kills++;
      attacker.streak++;
      attacker.score += 100 + (head ? 50 : 0);
      if (head) attacker.headshots++;
      if (attacker.weapon === 3) attacker.meleeKills++;
      if (this.mode >= 2) this.teams[attacker.team]++;
      this.events.push({
        type: 'kill',
        attack: attacker.weapon === 3 ? attacker.edgeAttack : undefined,
        actor: attacker.id,
        target: victim.id,
        weapon: attacker.weapon,
        pos: { ...victim.pos },
        head,
      });
      if (
        (this.mode >= 2 ? this.teams[attacker.team] : attacker.kills) >=
        this.fragLimit
      )
        this.finish();
    }
  }
  resolveEdge(a: Actor) {
    if (!a.alive || a.weapon !== 3 || this.ended) return;
    const origin=eye(a), attack=EDGE_ATTACKS[a.edgeAttack ?? 'slash'];
      // A short forward sweep, not a pin-thin bullet ray. Cover still blocks the contact.
      const aim = direction(a.yaw, a.pitch);
      let nearest: number = attack.range,
        victim: Actor | undefined,
        contact: Vec | undefined;
      for (const target of this.actors) {
        if (!target.alive || target.id === a.id) continue;
        const point = v(
          clamp(origin.x, target.pos.x - 0.28, target.pos.x + 0.28),
          clamp(
            origin.y,
            target.pos.y + 0.15,
            target.pos.y + bodyHeight(target) - 0.15,
          ),
          clamp(origin.z, target.pos.z - 0.28, target.pos.z + 0.28),
        );
        const dx = point.x - origin.x,
          dy = point.y - origin.y,
          dz = point.z - origin.z;
        const distance = Math.hypot(dx, dy, dz);
        const alignment =
          (dx * aim.x + dy * aim.y + dz * aim.z) / Math.max(distance, 0.001);
        if (
          distance <= nearest &&
          alignment >= attack.alignment &&
          hasLOS(origin, point, this.map.blocks)
        ) {
          nearest = distance;
          victim = target;
          contact = point;
        }
      }
      const wall = wallDistance(origin, aim, this.map.blocks);
      const reach = Math.min(attack.range, wall);
      this.events.push({
        type: 'melee-contact',
        attack: a.edgeAttack,
        actor: a.id,
        weapon: 3,
        pos: origin,
        end:
          contact ??
          v(
            origin.x + aim.x * reach,
            origin.y + aim.y * reach,
            origin.z + aim.z * reach,
          ),
        surface: victim ? 'actor' : wall <= attack.range ? 'world' : 'miss',
      });

      if (victim && this.enemy(a, victim) && victim.shield <= 0) {
        this.damage(victim, a, GUNS[3].damage);
        a.hits++;
      }
  }
  shoot(a: Actor, secondary = false) {
    const gun = GUNS[a.weapon];
    if (this.ended || !a.alive || a.cooldown > 0 || a.reload > 0 || a.equip > 0)
      return;
    if (a.weapon !== 3 && a.ammo[a.weapon] <= 0) {
      this.reload(a);
      return;
    }
    a.shield = 0;
    a.cooldown = gun.interval;
    a.fired = 0.12;
    if (a.weapon !== 3) a.ammo[a.weapon]--;
    a.shots++;
    a.burst++;
    const origin = eye(a);
    let gotHit = false;
    if (a.weapon === 3) {
      beginEdge(a, secondary ? 'stab' : 'slash');
      this.events.push({type:'shot',actor:a.id,weapon:3,attack:a.edgeAttack,pos:origin,end:origin,surface:'miss'});
      return;
    }
    for (let p = 0; p < gun.pellets; p++) {
      const spread = shotSpread(a, this.playerAds);
      // Uniform disk, rather than square pellet corners.
      const radius = Math.sqrt(this.random()) * spread;
      const angle = this.random() * Math.PI * 2;
      const d = direction(a.yaw + Math.cos(angle) * radius, a.pitch + Math.sin(angle) * radius);
      const wall = wallDistance(origin, d, this.map.blocks);
      let distance = Math.min(gun.range, wall),
        hit: Actor | undefined,
        head = false;
      for (const other of this.actors) {
        if (!other.alive || other.id === a.id) continue;
        const historical = !a.bot ? this.rewindPose?.(other, a) : undefined;
        const pos = historical?.pos ?? other.pos,
          height = historical?.height ?? bodyHeight(other);
        const body = rayBox(
          origin,
          d,
          v(pos.x - 0.34, pos.y + 0.05, pos.z - 0.27),
          v(pos.x + 0.34, pos.y + height - 0.38, pos.z + 0.27),
        );
        const hd = rayBox(
          origin,
          d,
          v(pos.x - 0.23, pos.y + height - 0.4, pos.z - 0.23),
          v(pos.x + 0.23, pos.y + height, pos.z + 0.23),
        );
        const near = Math.min(body, hd);
        if (near < distance) {
          distance = near;
          hit = other;
          head = hd < body;
        }
      }
      const end = v(
        origin.x + d.x * distance,
        origin.y + d.y * distance,
        origin.z + d.z * distance,
      );
      this.events.push({
        type: 'shot',
        actor: a.id,
        weapon: a.weapon,
        pos: { ...origin },
        end,
        surface: hit ? 'actor' : wall <= gun.range ? 'world' : 'miss',
        normal:
          !hit && wall <= gun.range
            ? impactNormal(end, this.map.blocks)
            : undefined,
      });
      if (hit && this.enemy(a, hit) && hit.shield <= 0) {
        const falloff =
          a.weapon === 2
            ? clamp(1 - Math.max(0, distance - 6) / 48, 0.25, 1)
            : a.weapon === 0
              ? clamp(1 - (distance - 12) / 85, 0.65, 1)
              : 1;
        this.damage(hit, a, gun.damage * (head ? gun.head : 1) * falloff, head);
        gotHit = true;
      }
    }
    if (gotHit) a.hits++;
    applyGunRecoil(a, this.playerAds);
  }

  playerAds = false;
  remoteInputs: Map<number, Input> | null = null;
  manualRespawns = false;
  rewindPose: ((target: Actor, shooter: Actor) => { pos: Vec; height: number } | undefined) | null = null;
  step(dt: number, input: Input) {
    if (this.ended) return;
    dt = clamp(dt, 0, 1 / 30);
    this.time = Math.max(0, this.time - dt);
    this.elapsed += dt;
    this.playerAds = input.ads;
    if (this.time <= 0) {
      this.finish();
      return;
    }
    for (const a of this.actors) {
      if (!a.alive) {
        a.respawn = Math.max(0, a.respawn - dt);
        if (
          a.respawn <= 0 &&
          (a.bot || (!this.manualRespawns && !this.pendingSpawn))
        )
          this.spawn(a);
        continue;
      }
      advanceGunTimers(a, dt);
      a.slide = Math.max(0, a.slide - dt);
      a.slideCooldown = Math.max(0, a.slideCooldown - dt);
      a.shield = Math.max(0, a.shield - dt);
      if (a.hp < 100 && this.elapsed - a.lastDamage > 5)
        a.hp = Math.min(100, a.hp + 18 * dt);
      const action =
        this.remoteInputs?.get(a.id) ?? (a.bot ? this.botInput(a, dt) : input);
      this.playerAds = action.ads;
      if (action.weapon >= 0) this.switch(a, action.weapon);
      if (action.reload) this.reload(a);
      const oldYVelocity = a.vel.y;
      const wasGrounded = a.grounded,
        wasSlide = a.slide;
      moveActor(a, action, dt, this.map);
      if (wasGrounded && !a.grounded && a.vel.y > 0)
        this.events.push({ type: 'jump', actor: a.id });
      if (wasSlide === 0 && a.slide > 0)
        this.events.push({ type: 'slide', actor: a.id });
      if (!wasGrounded && a.grounded && oldYVelocity < -2)
        this.events.push({
          type: 'land',
          actor: a.id,
          damage: Math.abs(oldYVelocity),
        });
      if ((a.edgeWindup ?? 0) > 0) {
        a.edgeWindup = Math.max(0, a.edgeWindup! - dt);
        if (a.edgeWindup === 0) this.resolveEdge(a);
      }
      if (action.fire || (a.weapon === 3 && action.ads)) this.shoot(a, a.weapon === 3 && action.ads);
      if (a.alive && !this.ended && a.weapon !== 3 && a.ammo[a.weapon] === 0 && a.equip === 0)
        this.reload(a);
      if (this.ended) break;
    }
  }
  botInput(a: Actor, dt: number) {
    const input = emptyInput();
    if (this.difficulty === 'dummy') return input;
    a.ai.think -= dt;
    a.ai.reaction -= dt;
    a.ai.repath -= dt;
    const difficulty = {
      casual: {
        reaction: 1.15,
        error: 0.12,
        rate: 0.28,
        speed: 0.52,
        turn: 4,
        range: 28,
      },
      normal: {
        reaction: 0.7,
        error: 0.065,
        rate: 0.45,
        speed: 0.68,
        turn: 6,
        range: 38,
      },
      hard: {
        reaction: 0.4,
        error: 0.033,
        rate: 0.7,
        speed: 0.85,
        turn: 9,
        range: 52,
      },
    }[this.difficulty];
    if (a.ai.think <= 0) {
      a.ai.think = 0.14 + this.random() * 0.08;
      let target = -1,
        best = Infinity;
      for (const e of this.actors) {
        if (!e.alive || !this.enemy(a, e) || e.shield > 0) continue;
        const d = dist(a.pos, e.pos);
        if (
          d < best &&
          d < difficulty.range &&
          (a.ai.target === e.id ||
            e.fired > 0 ||
            (-Math.sin(a.yaw) * (e.pos.x - a.pos.x) -
              Math.cos(a.yaw) * (e.pos.z - a.pos.z)) /
              Math.max(d, 0.01) >
              -0.17) &&
          hasLOS(eye(a), eye(e), this.map.blocks)
        ) {
          best = d;
          target = e.id;
        }
      }
      if (target !== a.ai.target) {
        a.ai.target = target;
        a.ai.reaction = difficulty.reaction;
      }
      if (this.random() < 0.14) a.ai.strafe *= -1;
    }
    const target = this.actors[a.ai.target];
    if (target?.alive && hasLOS(eye(a), eye(target), this.map.blocks)) {
      a.ai.seenPos={...target.pos};a.ai.seenUntil=this.elapsed+8;
      const dx = target.pos.x - a.pos.x,
        dz = target.pos.z - a.pos.z,
        d = Math.hypot(dx, dz);
      const aimY = target.pos.y + bodyHeight(target) - 0.55;
      const targetYaw = Math.atan2(-dx, -dz);
      const delta =
        ((((targetYaw - a.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
          (2 * Math.PI)) -
        Math.PI;
      a.yaw += delta * Math.min(1, dt * difficulty.turn);
      a.pitch = Math.atan2(aimY - eye(a).y, d);
      input.right = a.ai.strafe * 0.45;
      input.forward = d > (a.weapon === 2 ? 6 : 14) ? 1 : d < 5 ? -0.5 : 0.15;
      const stepTo=v(a.pos.x+Math.cos(a.yaw)*a.ai.strafe*.9,a.pos.y+.8,a.pos.z-Math.sin(a.yaw)*a.ai.strafe*.9);
      if(!hasLOS(v(a.pos.x,a.pos.y+.8,a.pos.z),stepTo,this.map.blocks)){
        const escape=v(a.pos.x-Math.cos(a.yaw)*a.ai.strafe*.9,a.pos.y+.8,a.pos.z+Math.sin(a.yaw)*a.ai.strafe*.9);
        if(hasLOS(v(a.pos.x,a.pos.y+.8,a.pos.z),escape,this.map.blocks)){a.ai.strafe*=-1;input.right=a.ai.strafe*.45;}else input.right=0;
      }
      if (a.ai.reaction <= 0 && Math.abs(delta) < 0.15 && a.cooldown <= 0) {
        const yaw = a.yaw,
          pitch = a.pitch;
        a.yaw += (this.random() - 0.5) * difficulty.error * 2;
        a.pitch += (this.random() - 0.5) * difficulty.error;
        this.shoot(a);
        a.yaw = yaw;
        a.pitch = pitch;
        if (a.cooldown > 0) a.cooldown /= difficulty.rate;
      }
      if (this.random() < dt * 0.035 && a.grounded) input.jump = true;
      a.ai.path = [];
      a.ai.waypoint = { ...target.pos };
    } else {
      const remembered=!!a.ai.seenPos&&(a.ai.seenUntil??0)>this.elapsed;
      if(remembered&&dist(a.ai.waypoint,a.ai.seenPos!)>.1){a.ai.waypoint={...a.ai.seenPos!};a.ai.repath=0;}
      if (a.ai.repath <= 0 || !a.ai.path.length) {
        if (!remembered&&(dist(a.pos, a.ai.waypoint) < 3 || a.ai.repath < -1))
          a.ai.waypoint =
            this.map.patrol[Math.floor(this.random() * this.map.patrol.length)] ??
            this.map.patrol[0];
        a.ai.path = this.nav.path(a.pos, a.ai.waypoint);
        a.ai.repath = 2.5;
      }
      const p = a.ai.path[0];
      if (p) {
        const dx = p.x - a.pos.x,
          dz = p.z - a.pos.z;
        if (Math.hypot(dx, dz) < 0.65) a.ai.path.shift();
        else {
          const wanted = Math.atan2(-dx, -dz);
          const delta = Math.atan2(
            Math.sin(wanted - a.yaw),
            Math.cos(wanted - a.yaw),
          );
          a.yaw += delta * Math.min(1, dt * 8);
          a.pitch *= Math.exp(-8 * dt);
          input.forward = Math.max(0, Math.cos(delta)) * 0.85;
        }
      } else if(remembered) a.yaw+=dt*2;
      else a.ai.waypoint=this.map.patrol[Math.floor(this.random()*this.map.patrol.length)];
    }
    a.ai.stuck += dt;
    if (a.ai.stuck > 1) {
      if (dist(a.pos, a.ai.lastPos) < 0.3) {
        a.ai.waypoint =
          this.map.patrol[Math.floor(this.random() * this.map.patrol.length)];
        a.ai.repath = 0;
        input.jump = true;
      }
      a.ai.lastPos = { ...a.pos };
      a.ai.stuck = 0;
    }
    if (
      a.ammo[a.weapon] === 0 ||
      (a.ai.target === -1 && a.ammo[a.weapon] < GUNS[a.weapon].mag / 2)
    )
      input.reload = true;
    // Local steering supplements static pathfinding; teammates do not stack in doorways.
    for (const other of this.actors) {
      if (other.id === a.id || !other.alive) continue;
      const dx = a.pos.x - other.pos.x,
        dz = a.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 1.1) {
        const strength = ((1.1 - d) * 0.65) / d;
        input.right += (Math.cos(a.yaw) * dx - Math.sin(a.yaw) * dz) * strength;
        input.forward +=
          (-Math.sin(a.yaw) * dx - Math.cos(a.yaw) * dz) * strength;
      }
    }
    input.forward *= difficulty.speed;
    input.right *= difficulty.speed;
    return input;
  }
  finish() {
    if (this.ended) return;
    this.ended = true;
    if (this.mode >= 2)
      this.winner =
        this.teams[0] === this.teams[1]
          ? 'DRAW'
          : this.teams[0] > this.teams[1]
            ? 'YOUR TEAM WINS'
            : 'OPPONENTS WIN';
    else {
      const ranked = [...this.actors].sort((a, b) => b.kills - a.kills);
      this.winner =
        ranked.length > 1 && ranked[0].kills === ranked[1].kills
          ? 'DRAW'
          : ranked[0].id === 0
            ? 'YOU WIN'
            : `${ranked[0].name} WINS`;
    }
    this.events.push({ type: 'end', actor: 0 });
  }
}

export function shotSpread(a: Actor, ads = false) {
  return GUNS[a.weapon].spread *
    (a.weapon === 1 ? Math.min(1.8, 0.65 + Math.max(0, a.burst - 1) * 0.10) : 1) *
    (ads ? 0.55 : 1) *
    (a.slide > 0 ? 1.85 : a.crouched ? 0.6 : Math.hypot(a.vel.x, a.vel.z) > 5 ? 1.25 : 1) *
    (a.grounded ? 1 : 1.4);
}

export function advanceGunTimers(a: Actor, dt: number) {
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.equip = Math.max(0, a.equip - dt);
      a.fired = Math.max(0, a.fired - dt);
      // Recover only the recoil contribution; leave the player's mouse input intact.
      if (a.fired === 0 && a.cooldown === 0 && !a.bot) {
        const recovery = 1 - Math.exp(-10 * dt);
        a.pitch = clamp(a.pitch - a.recoilPitch * recovery, -1.48, 1.48);
        a.yaw -= a.recoilYaw * recovery;
        a.recoilPitch *= 1 - recovery;
        a.recoilYaw *= 1 - recovery;
        if (Math.abs(a.recoilPitch) < 0.001) a.burst = 0;
      }
      if (a.reload > 0) {
        a.reload -= dt;
        if (a.reload <= 0) {
          a.ammo[a.weapon] = GUNS[a.weapon].mag;
          a.reload = 0;
        }
      }
}

export function applyGunRecoil(a: Actor, ads: boolean) {
  if (a.bot || a.weapon === 3) return;
  const gun = GUNS[a.weapon];
  const stance=a.slide>0?1.25:a.crouched?0.7:1;
  const patterns=[[0.15,0.3,0.45,0.4,0.1,-0.25,-0.5,-0.35],[0.2,0.4,0.7,0.4,-0.35,-0.65,-0.5,0.15],[0.45,-0.45]];
  const pattern=patterns[a.weapon],gain=stance*(ads?0.65:1);
  const rise=gun.recoil*(a.weapon===2?0.85:a.weapon===0?0.42:0.52)*gain;
  const lateral=pattern[(Math.max(1,a.burst)-1)%pattern.length]*gun.recoil*0.65*gain;
  const pitchKick=Math.min(rise,Math.max(0,gun.recoil*6-a.recoilPitch));
  const yawKick=clamp(a.recoilYaw+lateral,-gun.recoil*2,gun.recoil*2)-a.recoilYaw;
  const next=clamp(a.pitch+pitchKick,-1.48,1.48);
  a.recoilPitch+=next-a.pitch;a.pitch=next;
  a.recoilYaw+=yawKick;a.yaw+=yawKick;
}
