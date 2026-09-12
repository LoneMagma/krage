import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Match,
  Navigation,
  makeMap,
  rayBox,
  hasLOS,
  v,
  emptyInput,
  moveActor,
  eye,
  shotSpread,
  type Mode,
} from '../lib/game/core.js';
const step = (m: Match, seconds: number, input = emptyInput()) => {
  for (let i = 0; i < seconds * 120; i++) m.step(1 / 120, input);
};
function duel() {
  const m = new Match(1, 1, 1, 'normal', 123);
  m.random = () => 0.5;
  const [a, b] = m.actors;
  a.pos = v(-5, 0, -2);
  b.pos = v(-5, 0, -7);
  a.yaw = 0;
  a.pitch = 0;
  a.cooldown = 0;
  a.shield = 0;
  b.shield = 0;
  b.bot = false;
  return { m, a, b };
}
await test('slab ray rejects parallel misses and geometry behind the muzzle', () => {
  assert.equal(rayBox(v(), v(0, 0, -1), v(1, 0, -4), v(3, 2, -2)), Infinity);
  assert.equal(rayBox(v(), v(0, 0, -1), v(-1, -1, 2), v(1, 1, 4)), Infinity);
  assert.equal(rayBox(v(), v(0, 0, -1), v(-1, -1, -4), v(1, 1, -2)), 2);
});
await test('all four modes create the exact roster and opposing teams', () => {
  assert.equal(new Match(0, 0, 0).actors.length, 1);
  assert.equal(new Match(0, 0, 7).actors.length, 8);
  for (const [mode, count] of [
    [1, 2],
    [2, 4],
    [3, 6],
  ]) {
    const m = new Match(mode as Mode);
    assert.equal(m.actors.length, count);
    if (mode >= 2)
      assert.equal(m.actors.filter((a) => a.team === 0).length, count / 2);
  }
});
await test('AK body damage and headshot multiplier are distinct', () => {
  const { m, a, b } = duel();
  a.pitch = -Math.atan2(0.5, 5);
  m.shoot(a);
  assert.equal(b.hp, 68);
  a.pitch = 0;
  a.cooldown = 0;
  m.shoot(a);
  assert.ok(Math.abs(b.hp - 7.2) < 0.001);
  a.cooldown = 0;
  m.shoot(a);
  assert.equal(a.kills, 1);
  assert.equal(a.score, 150);
  assert.equal(b.deaths, 1);
});
await test('solid cover blocks shots, including melee', () => {
  const { m, a, b } = duel();
  a.pos = v(0, 0, 7);
  b.pos = v(0, 0, -7);
  a.pitch = 0;
  for (const gun of [0, 1, 2, 3]) {
    a.weapon = gun;
    a.cooldown = 0;
    m.shoot(a);
  }
  assert.equal(b.hp, 100);
  assert.equal(a.hits, 0);
  assert.ok(!hasLOS(eye(a), eye(b), m.map.blocks));
});
await test('blade kills in reach but never outside its range', () => {
  const { m, a, b } = duel();
  a.weapon = 3;
  b.pos = v(-5, 0, -5);
  m.shoot(a, true);
  step(m,0.16);
  assert.equal(b.hp, 100);
  a.cooldown = 0;
  b.pos.z = -4;
  m.shoot(a, true);
  step(m,0.16);
  assert.equal(b.alive, false);
  assert.equal(a.kills, 1);
});
await test('team damage and spawn protection cannot award frags', () => {
  const m = new Match(2);
  const [a, b, c] = m.actors;
  b.shield = 0;
  c.shield = 0;
  m.damage(c, a, 1000);
  assert.equal(c.hp, 100);
  b.shield = 1;
  m.damage(b, a, 1000);
  assert.equal(b.hp, 100);
  assert.equal(a.kills, 0);
});
await test('firing immediately ends your own spawn protection', () => {
  const { m, a } = duel();
  a.shield = 1;
  m.shoot(a);
  assert.equal(a.shield, 0);
});
await test('double barrel has exactly two shots and damages at close range', () => {
  const { m, a, b } = duel();
  a.primary = 2;
  a.weapon = 2;
  a.ammo[2] = 2;
  a.pitch = -0.08;
  m.shoot(a);
  assert.equal(a.ammo[2], 1);
  assert.equal(b.alive, false);
  a.cooldown = 0;
  m.shoot(a);
  assert.equal(a.ammo[2], 0);
  a.cooldown = 0;
  m.shoot(a);
  assert.ok(a.reload > 0);
});
await test('reload takes time, refills only its magazine, and cancels on switch', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  a.ammo[1] = 3;
  m.reload(a);
  step(m, 1);
  assert.equal(a.ammo[1], 3);
  m.switch(a, 3);
  assert.equal(a.reload, 0);
  step(m, 2);
  assert.equal(a.ammo[1], 3);
  m.switch(a, 1);
  m.reload(a);
  step(m, 2.2);
  assert.equal(a.ammo[1], 25);
});
await test('health regeneration waits five seconds after damage', () => {
  const m = new Match(0, 0, 0);
  m.player.hp = 50;
  m.player.lastDamage = 0;
  step(m, 4.9);
  assert.equal(m.player.hp, 50);
  step(m, 1.1);
  assert.ok(m.player.hp > 65 && m.player.hp < 70);
});
await test('player jumps, lands, and remains above the ground', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  const input = emptyInput();
  input.jump = true;
  moveActor(a, input, 1 / 120, m.map);
  assert.ok(a.vel.y > 0);
  input.jump = false;
  let max = 0;
  for (let n = 0; n < 180; n++) {
    moveActor(a, input, 1 / 120, m.map);
    max = Math.max(max, a.pos.y);
    assert.ok(a.pos.y >= 0);
  }
  assert.ok(max > 1.05 && max < 1.3);
  assert.equal(a.grounded, true);
  assert.equal(a.pos.y, 0);
});
await test('movement collides with a building and cannot escape arena bounds', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  a.pos = v(-17, 0, -5);
  a.yaw = 0;
  const input = emptyInput();
  input.forward = 1;
  step(m, 4, input);
  assert.ok(a.pos.z >= -7.66);
  a.pos = v(-27, 0, -22);
  step(m, 5, input);
  assert.ok(a.pos.z >= -m.map.depth / 2 + 1);
});
await test('slide gives a bounded impulse and obeys its cooldown', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  a.pos = v(-19, 0, 0);
  a.yaw = 0;
  const input = emptyInput();
  input.forward = 1;
  step(m, 0.3, input);
  input.slide = true;
  step(m, 0.02, input);
  assert.ok(
    Math.hypot(a.vel.x, a.vel.z) > 8.2 && Math.hypot(a.vel.x, a.vel.z) < 8.8,
  );
  assert.ok(a.slideCooldown > 1);
  assert.ok(a.slide > 0);
  step(m, 0.5, input);
  assert.ok(a.slideCooldown < 0.8);
});
await test('small steps lead onto the central platform', () => {
  const m = new Match(0, 0, 0);
  m.player.pos = v(-13, 0, 0);
  m.player.yaw = -Math.PI / 2;
  const input = emptyInput();
  input.forward = 1;
  step(m, 1.5, input);
  assert.ok(
    m.player.pos.y >= 3.1,
    `expected platform height, got ${m.player.pos.y}`,
  );
});
await test('safe spawns avoid occupied enemy sightlines when possible', () => {
  const { m, a, b } = duel();
  b.pos = { ...m.map.spawns[0] };
  a.alive = false;
  m.spawn(a);
  assert.ok(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 15);
  assert.equal(a.hp, 100);
  assert.ok(a.shield > 0);
});
await test('frag limit ends a match and prevents future simulation', () => {
  const { m, a, b } = duel();
  a.kills = 19;
  m.damage(b, a, 1000);
  assert.equal(m.ended, true);
  assert.equal(m.winner, 'YOU WIN');
  const time = m.time;
  step(m, 10);
  assert.equal(m.time, time);
});
await test('team score, time limit, and ties use frags, not bonus points', () => {
  const m = new Match(2);
  m.teams = [3, 3];
  m.player.score = 999;
  m.time = 0.001;
  m.step(1 / 120, emptyInput());
  assert.equal(m.winner, 'DRAW');
  const n = new Match(3);
  n.teams = [19, 3];
  n.actors[1].shield = 0;
  n.damage(n.actors[1], n.player, 1000);
  assert.equal(n.winner, 'YOUR TEAM WINS');
  assert.equal(n.teams[0], 20);
});
await test('navigation paths route around geometry on both maps', () => {
  for (const id of [0, 1]) {
    const map = makeMap(id),
      nav = new Navigation(map);
    const path = nav.path(map.spawns[0], map.spawns[1]);
    assert.ok(path.length > 4);
    for (let i = 1; i < path.length; i++)
      assert.ok(
        hasLOS(
          v(path[i - 1].x, 0.8, path[i - 1].z),
          v(path[i].x, 0.8, path[i].z),
          map.blocks,
        ),
      );
  }
});
await test('bots navigate and produce real combat in every mode on both maps', () => {
  for (const id of [0, 1])
    for (const mode of [0, 1, 2, 3] as Mode[]) {
      const m = new Match(mode, id, 5, 'normal', 123, 1000);
      step(m, 65);
      const kills = m.actors.reduce((n, a) => n + a.kills, 0);
      assert.ok(kills > 0, `${mode}/${id} had no kills`);
      assert.ok(
        m.actors.filter((a) => a.bot).every((a) => a.shots > 0),
        `${mode}/${id} had a bot unable to fire`,
      );
      for (const a of m.actors) {
        assert.ok(Number.isFinite(a.pos.x) && Number.isFinite(a.pos.y));
        assert.ok(a.pos.y >= 0);
        assert.ok(Math.abs(a.pos.x) < m.map.width / 2);
      }
    }
});
await test('same seed and input produce the same simulation', () => {
  const a = new Match(0, 1, 3, 'normal', 878),
    b = new Match(0, 1, 3, 'normal', 878);
  step(a, 12);
  step(b, 12);
  assert.deepEqual(
    a.actors.map((x) => [x.pos, x.kills, x.hp]),
    b.actors.map((x) => [x.pos, x.kills, x.hp]),
  );
});
await test('partial analog input never outruns full input; diagonal movement is normalized', () => {
  const speeds = [0.4, 0.8, 1].map((magnitude) => {
    const m = new Match(0, 0, 0);
    m.player.pos = v(-27, 0, 5);
    m.player.yaw = 0;
    const input = emptyInput();
    input.forward = magnitude;
    step(m, 1, input);
    return Math.hypot(m.player.vel.x, m.player.vel.z);
  });
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  assert.ok(Math.abs(speeds[2] - 6.08) < 0.01);
  const m = new Match(0, 0, 0),
    input = emptyInput();
  input.forward = 1;
  input.right = 1;
  step(m, 0.3, input);
  assert.ok(Math.hypot(m.player.vel.x, m.player.vel.z) <= 6.401);
});
await test('releasing movement stops in under 100 ms without drift', () => {
  const m = new Match(0, 0, 0);
  const input = emptyInput();
  input.forward = 1;
  step(m, 0.4, input);
  const before = { ...m.player.pos };
  step(m, 0.12);
  assert.equal(Math.hypot(m.player.vel.x, m.player.vel.z), 0);
  assert.ok(
    Math.hypot(before.x - m.player.pos.x, before.z - m.player.pos.z) < 0.3,
  );
});
await test('holding jump or slide does not repeatedly retrigger either action', () => {
  const m = new Match(0, 0, 0);
  const input = emptyInput();
  input.jump = true;
  step(m, 2, input);
  assert.equal(m.player.grounded, true);
  assert.equal(m.player.pos.y, 0);
  input.jump = false;
  input.forward = 1;
  step(m, 0.3, input);
  input.slide = true;
  step(m, 1.6, input);
  assert.equal(m.player.slide, 0);
});
await test('loadout permits one primary plus melee and rejects the third slot', () => {
  const m = new Match(0, 0, 0),
    p = m.player;
  assert.deepEqual(p.ammo, [0, 25, 0, 1]);
  m.switch(p, 0);
  assert.equal(p.weapon, 1);
  m.switch(p, 3);
  assert.equal(p.weapon, 3);
  m.switch(p, 2);
  assert.equal(p.weapon, 3);
  m.switch(p, 1);
  assert.equal(p.weapon, 1);
  assert.equal(m.selectPrimary(0), false);
});
await test('each death waits for a primary choice and explicit deploy', () => {
  const m = new Match(1),
    p = m.player;
  p.shield = 0;
  m.damage(p, m.actors[1], 1000);
  assert.equal(m.pendingSpawn, true);
  assert.equal(m.deployPlayer(), false);
  assert.equal(m.selectPrimary(2), true);
  assert.equal(m.selectPrimary(3), false);
  assert.equal(m.selectPrimary(NaN), false);
  step(m, 2.1);
  assert.equal(p.alive, false);
  assert.equal(m.deployPlayer(), true);
  assert.equal(p.primary, 2);
  assert.equal(p.weapon, 2);
  assert.deepEqual(p.ammo, [0, 0, 2, 1]);
  assert.equal(m.pendingSpawn, false);
  assert.equal(m.deployPlayer(), false);
});
await test('stationary test bots neither move nor fire', () => {
  const m = new Match(0, 0, 5, 'dummy', 11);
  const positions = m.actors.slice(1).map((a) => ({ ...a.pos }));
  step(m, 25);
  assert.deepEqual(
    m.actors.slice(1).map((a) => a.pos),
    positions,
  );
  assert.ok(m.actors.slice(1).every((a) => a.shots === 0));
});
await test('Foundry shooting slit is physically open between solid sill and lintel', () => {
  const map = makeMap(0);
  assert.ok(hasLOS(v(0, 1.4, 8), v(0, 1.4, 12), map.blocks));
  assert.equal(hasLOS(v(0, 0.8, 8), v(0, 0.8, 12), map.blocks), false);
  assert.equal(hasLOS(v(0, 2, 8), v(0, 2, 12), map.blocks), false);
});
await test('Relay service gate blocks standing but allows crouched passage', () => {
  const run = (crouch: boolean) => {
    const m = new Match(0, 1, 0);
    m.player.pos = v(0, 0, 16);
    m.player.yaw = 0;
    const input = emptyInput();
    input.forward = 1;
    input.crouch = crouch;
    step(m, 2, input);
    return m.player;
  };
  const standing = run(false),
    crouched = run(true);
  assert.ok(standing.pos.z >= 13.3);
  assert.ok(crouched.pos.z < 11);
});
await test('the gantry underpass and separated landing are real walkable surfaces', () => {
  const map = makeMap(0);
  assert.ok(hasLOS(v(-4, 1.6, 0), v(4, 1.6, 0), map.blocks));
  const m = new Match(0, 0, 0);
  m.player.pos = v(4, 3.6, 0);
  m.player.yaw = -Math.PI / 2;
  m.player.grounded = true;
  const input = emptyInput();
  input.forward = 1;
  step(m, 0.2, input);
  input.jump = true;
  step(m, 0.02, input);
  input.jump = false;
  step(m, 0.57, input);
  assert.ok(
    m.player.pos.x > 8.2 && m.player.pos.y >= 3.19,
    `landing failed ${JSON.stringify(m.player.pos)}`,
  );
});
await test('crouch uses the current collision height on its first simulation step', () => {
  const m = new Match(0, 1, 0);
  m.player.pos = v(0, 0, 13.36);
  m.player.yaw = 0;
  const input = emptyInput();
  input.forward = 1;
  input.crouch = true;
  step(m, 0.4, input);
  assert.ok(m.player.pos.z < 13);
  assert.ok(eye(m.player).y < 1.1);
});

await test('recoil rises on fire then settles without erasing mouse adjustment', () => {
  const { m, a } = duel();
  m.difficulty = 'dummy';
  a.pitch = -0.3;
  m.shoot(a);
  const rise = a.pitch + 0.3;
  assert.ok(rise > 0);
  a.pitch += 0.2;
  for (let i = 0; i < 180; i++) m.step(1 / 120, emptyInput());
  assert.ok(Math.abs(a.pitch - -0.1) < 0.001, `pitch ${a.pitch}`);
});
await test('shot events distinguish misses, world surfaces and individual shotgun pellets', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  a.pos = v(-26, 0, 5);
  a.pitch = 1.4;
  a.cooldown = 0;
  m.events = [];
  m.shoot(a);
  assert.equal(m.events.find((e) => e.type === 'shot')?.surface, 'miss');
  a.pitch = -1.4;
  a.cooldown = 0;
  m.events = [];
  m.shoot(a);
  const impact = m.events.find((e) => e.type === 'shot');
  assert.equal(impact?.surface, 'world');
  assert.equal(impact?.normal?.y, 1);
  a.weapon = 2;
  a.ammo[2] = 2;
  a.cooldown = 0;
  m.events = [];
  m.shoot(a);
  assert.equal(m.events.filter((e) => e.type === 'shot').length, 10);
  assert.equal(a.ammo[2], 1);
});
await test('stepping up stairs does not snap the shared camera and bullet eye upward', () => {
  const m = new Match(0, 0, 0),
    a = m.player,
    input = emptyInput();
  a.pos = v(-12.4, 0, 0);
  a.yaw = -Math.PI / 2;
  input.forward = 1;
  let lastEye = eye(a).y;
  for (let i = 0; i < 120; i++) {
    m.step(1 / 120, input);
    assert.ok(eye(a).y - lastEye < 0.12, `eye jumped ${eye(a).y - lastEye}`);
    lastEye = eye(a).y;
  }
  assert.ok(a.pos.y > 1);
});

await test('KILO first shot stays inside the small aim cone before recoil', () => {
  const m = new Match(0, 0, 0);
  const a = m.player;
  a.pos = v(-27, 0, 0);
  a.yaw = 0.4;
  a.pitch = 0.8;
  a.cooldown = 0;
  m.random = () => 0.99;
  m.shoot(a);
  const shot = m.events.find((e) => e.type === 'shot')!;
  const dx = shot.end!.x - shot.pos!.x,
    dy = shot.end!.y - shot.pos!.y,
    dz = shot.end!.z - shot.pos!.z;
  const spread = shotSpread(a);
  assert.ok(Math.abs(Math.atan2(dy, Math.hypot(dx, dz)) - 0.8) <= spread);
  assert.ok(Math.abs(Math.atan2(-dx, -dz) - 0.4) <= spread);
  assert.ok(a.pitch > 0.8, 'recoil affects the next shot, not the fired ray');
});
await test('casual bot cannot acquire a silent opponent behind its field of view', () => {
  const m = new Match(1, 0, 1, 'casual', 4);
  const [player, bot] = m.actors;
  player.pos = v(-27, 0, 4);
  bot.pos = v(-27, 0, 0);
  bot.yaw = 0;
  player.shield = 0;
  player.fired = 0;
  bot.ai.think = 0;
  bot.ai.target = -1;
  m.botInput(bot, 1 / 120);
  assert.equal(bot.ai.target, -1);
  player.fired = 0.1;
  bot.ai.think = 0;
  m.botInput(bot, 1 / 120);
  assert.equal(bot.ai.target, player.id);
  assert.equal(
    player.hp,
    100,
    'hearing starts a reaction delay, not an instant hit',
  );
});

await test('descending ordinary stairs preserves contact while deliberate jumps still leave ground', () => {
  const m = new Match(0, 0, 0),
    a = m.player;
  m.map.blocks = [
    { x: 0, y: 0.36, z: 0, w: 2, h: 0.72, d: 4, color: '#fff' },
    { x: 2, y: 0.18, z: 0, w: 2, h: 0.36, d: 4, color: '#fff' },
  ];
  a.pos = v(0, 0.72, 0);
  a.vel = v();
  a.yaw = 0;
  const input = emptyInput();
  input.right = 1;
  for (let i = 0; i < 90; i++) {
    m.step(1 / 120, input);
    assert.equal(a.grounded, true);
  }
  assert.equal(a.pos.y, 0);
  input.jump = true;
  m.step(1 / 120, input);
  assert.equal(a.grounded, false);
  assert.ok(a.vel.y > 0);
});

await test('slide steering bends the route gradually without adding speed', () => {
  const m = new Match(0, 0, 0),
    a = m.player;
  m.map.blocks = [];
  a.pos = v();
  a.vel = v(0, 0, -8);
  a.slide = 0.4;
  const input = emptyInput();
  input.right = 1;
  for (let n = 0; n < 12; n++) m.step(1 / 120, input);
  const speed = Math.hypot(a.vel.x, a.vel.z);
  assert.ok(a.vel.x > 0 && a.vel.z < 0);
  assert.ok(speed < 8);
  assert.ok(Math.atan2(a.vel.x, -a.vel.z) < 0.11);
});

await test('EDGE sweep hits an offset crouched opponent, rejects backs and respects nearby cover', () => {
  const { m, a, b } = duel();
  m.map.blocks = [];
  a.weapon = 3;
  a.pos = v();
  a.yaw = 0;
  a.pitch = 0;
  b.pos = v(0.5, 0, -1.6);
  b.crouched = true;
  m.shoot(a);
  step(m,0.1);
  assert.equal(b.alive, false);
  m.spawn(b);
  b.shield = 0;
  b.pos = v(0, 0, 1);
  a.cooldown = 0;
  m.shoot(a);
  step(m,0.1);
  assert.equal(b.alive, true);
  b.pos = v(0, 0, -1.6);
  a.cooldown = 0;
  m.map.blocks = [{ x: 0, y: 1, z: -0.7, w: 2, h: 2, d: 0.2, color: '#fff' }];
  m.shoot(a);
  step(m,0.1);
  assert.equal(b.alive, true);
});

await test('empty primary reloads automatically without another trigger press', () => {
  for (const weapon of [0, 1, 2]) {
    const m = new Match(0, 0, 0);
    m.player.weapon = m.player.primary = weapon;
    m.player.ammo[weapon] = 1;
    m.player.equip = m.player.cooldown = 0;
    const input = emptyInput();
    input.fire = true;
    m.step(1 / 120, input);
    assert.equal(m.player.ammo[weapon], 0);
    assert.ok(m.player.reload > 0);
    input.fire = false;
    for (let i = 0; i < 360; i++) m.step(1 / 120, input);
    assert.ok(m.player.ammo[weapon] > 0);
  }
});

await test('crouch tightens spread, slide widens it, magazines match the loadout', async () => {
  const { shotSpread, GUNS } = await import('../lib/game/core.js');
  const m = new Match(0,0,0); const a = m.player;
  a.grounded = true; a.vel = v(); a.burst = 1;
  for (const weapon of [0,1,2]) {
    a.weapon = weapon; a.crouched = false; a.slide = 0;
    const standing = shotSpread(a); assert.ok(standing > 0);
    a.crouched = true; assert.ok(shotSpread(a) < standing);
    a.slide = 0.4; assert.ok(shotSpread(a) > standing);
  }
  assert.deepEqual(GUNS.slice(0,3).map(g => g.mag), [35,25,2]);
});

await test('landing compression is bounded, recovers, and never triggers on level steps', () => {
  const m=new Match(0,0,0),a=m.player,input=emptyInput();
  a.pos=v(-20,3,15);a.vel=v(0,-8,0);a.grounded=false;
  let peak=0;
  for(let i=0;i<180;i++){m.step(1/120,input);peak=Math.max(peak,a.landingCompression??0);}
  assert.ok(peak>.4 && peak<=1);assert.ok((a.landingCompression??0)<.001);
  assert.ok(Math.abs(a.viewHeight-1.67)<.01);
  for(let i=0;i<30;i++)m.step(1/120,input);
  assert.ok((a.landingCompression??0)<.001);
});
await test('crouch release under cover preserves collision and eye clearance', () => {
  const m=new Match(0,0,0),a=m.player,input=emptyInput();
  m.map.blocks=[{x:0,y:1.4,z:0,w:5,h:.4,d:5,color:'#555'}];
  a.pos=v();a.vel=v();a.crouched=true;a.grounded=true;
  for(let i=0;i<30;i++){
    m.step(1/120,input);assert.equal(a.crouched,true);
    assert.ok(eye(a).y<1.2);assert.ok((a.stanceBlend??0)>.85);
  }
  a.pos.x=6;
  for(let i=0;i<60;i++)m.step(1/120,input);
  assert.equal(a.crouched,false);assert.ok(a.viewHeight>1.65);
});

await test('EDGE uses delayed contact, distinct reach, shared cooldown and cancellable windup', () => {
  for (const stab of [false,true]) {
    const {m,a,b}=duel();m.map.blocks=[];a.pos=v();a.weapon=3;b.pos=v(0,0,-2.6);
    m.shoot(a,stab); assert.equal(b.hp,100); assert.equal(a.edgeAttack,stab?'stab':'slash');
    const shots=a.shots;m.shoot(a,!stab);assert.equal(a.shots,shots);
    step(m,0.17);assert.equal(b.alive,!stab);
    assert.equal(m.events.filter(e=>e.type==='melee-contact').length,1);
    step(m,0.1);assert.equal(m.events.filter(e=>e.type==='melee-contact').length,1);
  }
  const {m,a,b}=duel();m.map.blocks=[];a.weapon=3;b.pos=v(-5,0,-3);
  m.shoot(a,true);m.switch(a,a.primary);step(m,0.2);assert.equal(b.hp,100);
});
await test('EDGE checks target position and cover at contact, not at button press',()=>{
  const {m,a,b}=duel();m.map.blocks=[];a.weapon=3;b.pos=v(-5,0,-3);
  m.shoot(a);b.pos=v(-5,0,2);step(m,0.12);assert.equal(b.hp,100);
  a.cooldown=0;b.pos=v(-5,0,-3);m.shoot(a);
  m.map.blocks=[{x:-5,y:1,z:-2.5,w:2,h:2,d:0.1,color:'#fff'}];step(m,0.12);assert.equal(b.hp,100);
});
await test('right-click starts stab without left-click and slashes alternate',()=>{
  const m=new Match(0,0,0);m.map.blocks=[];const a=m.player;a.weapon=3;a.equip=0;a.cooldown=0;
  const input=emptyInput();input.ads=true;m.step(1/120,input);assert.equal(a.edgeAttack,'stab');assert.equal(a.shots,1);
  input.ads=false;step(m,0.5,input);input.fire=true;m.step(1/120,input);const side=a.edgeSide;assert.equal(a.edgeAttack,'slash');
  step(m,0.31,input);assert.equal(a.edgeSide,-side!);
});

await test('v0.5 recoil has bounded climb, both lateral directions and returns to base aim',async()=>{
 const {applyGunRecoil,advanceGunTimers,GUNS}=await import('../lib/game/core.js');
 for(const weapon of [0,1,2]){
  const a=new Match(0,0,0).player;a.weapon=weapon;a.pitch=0.2;a.yaw=0.4;a.cooldown=a.fired=0;
  let positive=false,negative=false;
  for(let n=1;n<=80;n++){a.burst=n;const before=a.yaw;applyGunRecoil(a,false);positive ||= a.yaw>before;negative ||= a.yaw<before;}
  assert.ok(positive&&negative);assert.ok(a.recoilPitch<=GUNS[weapon].recoil*6+1e-9);
  for(let n=0;n<240;n++)advanceGunTimers(a,1/120);
  assert.ok(Math.abs(a.pitch-0.2)<1e-6);assert.ok(Math.abs(a.yaw-0.4)<1e-6);
 }
});
await test('respawns avoid occupied and recently fatal positions',()=>{
 const m=new Match(1,0,1,'dummy');m.map.blocks=[];m.random=()=>0;
 const [a,b]=m.actors;b.alive=true;b.pos=v(-10,0,-5);m.recentSpawns=[];
 m.recentDeaths=[{pos:v(10,0,5),time:m.elapsed}];m.spawn(a);
 assert.ok(Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)>1.2);
 assert.notDeepEqual(a.pos,v(10,0,5));
 for(let n=0;n<25;n++)m.spawn(a);assert.ok(m.recentSpawns.length<=16);
});
await test('MICA remains pellet based with stronger useful range, EDGE bonus is reduced',async()=>{
 const {GUNS}=await import('../lib/game/core.js');assert.equal(GUNS[2].damage,16);assert.equal(GUNS[2].range,38);assert.equal(GUNS[2].pellets,10);assert.ok(GUNS[3].speed<=1.06);
 const {m,a,b}=duel();m.map.blocks=[];a.weapon=a.primary=2;a.ammo[2]=2;a.pitch=0;b.pos=v(-5,0,-18);m.random=()=>0;
 m.shoot(a);assert.equal(b.alive,false);
});

await test('light weapons remain faster than KILO and MICA after the global speed reduction',async()=>{
 const {GUNS}=await import('../lib/game/core.js');
 assert.ok(GUNS[3].speed>GUNS[1].speed&&GUNS[0].speed>GUNS[1].speed);
 assert.ok(GUNS[3].speed<1.06&&GUNS[0].speed<1.04);
});
