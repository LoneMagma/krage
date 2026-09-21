import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Mesh } from 'three';
import { Match, direction, eye, emptyInput, v } from '../lib/game/core.js';
import { syncView } from '../lib/game/view.js';
import { CrouchControl } from '../lib/game/controls.js';
import {
  avatar,
  animateAvatar,
  poseAvatar,
  makeWeapon,
  disposeObject,
} from '../lib/game/graphics.js';

await test('rendered center ray agrees with hitscan above, below and around the player', () => {
  const m = new Match(0, 1, 0),
    camera = new PerspectiveCamera(90, 1.7, 0.06, 150);
  for (const yaw of [-2.4, -0.3, 0, 1.8])
    for (const pitch of [-1.2, -0.3, 0.2, 1.1]) {
      m.player.yaw = yaw;
      m.player.pitch = pitch;
      m.player.pos = v(2, 3, 5);
      m.player.viewHeight = 0.94;
  m.player.stanceBlend = 1;
      syncView(camera, m.player);
      const forward = camera.getWorldDirection(new Vector3());
      assert.ok(
        forward.distanceTo(new Vector3().copy(direction(yaw, pitch))) < 1e-10,
      );
      assert.ok(
        camera.position.distanceTo(new Vector3().copy(eye(m.player))) < 1e-10,
      );
    }
});
await test('hold crouches, release stands, double-tap requests exactly one slide', () => {
  const c = new CrouchControl();
  c.press(1000);
  assert.equal(c.active, true);
  c.press(1010);
  assert.equal(c.active, true);
  c.release();
  assert.equal(c.active, false);
  c.press(1190);
  assert.equal(c.active, false);
  assert.equal(c.consumeSlide(), true);
  assert.equal(c.consumeSlide(), false);
  c.release();
  c.press(1600);
  assert.equal(c.active, true);
  c.release();
  c.press(2100);
  assert.equal(c.active, true);
  c.reset();
  assert.equal(c.active, false);
  assert.equal(c.held, false);
});
await test('double-tap slide works after first tap has slowed the player into crouch', () => {
  const m = new Match(0, 0, 0),
    input = emptyInput(),
    c = new CrouchControl();
  m.player.pos = v(-26, 0, 8);
  m.player.yaw = 0;
  input.forward = 1;
  for (let i = 0; i < 60; i++) m.step(1 / 120, input);
  c.press(1000);
  input.crouch = c.active;
  for (let i = 0; i < 24; i++) m.step(1 / 120, input);
  assert.ok(Math.hypot(m.player.vel.x, m.player.vel.z) <= 3.01);
  c.release();
  c.press(1200);
  input.crouch = c.active;
  input.slide = c.consumeSlide();
  m.step(1 / 120, input);
  assert.ok(m.player.slide > 0);
  assert.ok(Math.hypot(m.player.vel.x, m.player.vel.z) > 7 && Math.hypot(m.player.vel.x, m.player.vel.z) < 8.8);
});
await test('standing double-tap cannot launch a stationary player', () => {
  const m = new Match(0, 0, 0),
    input = emptyInput();
  input.slide = true;
  m.step(1 / 120, input);
  assert.equal(m.player.slide, 0);
});
await test('character geometry survives a live-pose to ragdoll-pose handoff unchanged', () => {
  const m = new Match(0, 0, 0),
    model = avatar('#c68b58');
  m.player.crouched = true;
  m.player.viewHeight = 0.94;
  m.player.stanceBlend = 1;
  m.player.vel.x = 3;
  m.player.stride = 1;
  animateAvatar(model, m.player, 1);
  const geometries = model.parts.map((p) => (p.children[0] as Mesh).geometry);
  const joints = model.joints.map((p) => p.clone().add(new Vector3(1, 0, 2)));
  poseAvatar(model, joints);
  assert.equal(model.parts.length, 10);
  model.parts.forEach((part, i) => {
    assert.equal((part.children[0] as Mesh).geometry, geometries[i]);
    assert.ok(Number.isFinite(part.quaternion.w));
  });
  assert.ok(
    model.joints[0].y < 1.1,
    'crouched head is lowered, not a scaled standing doll',
  );
  disposeObject(model.group);
});
await test('weapons retain movable reload groups while batching small details', () => {
  for (const id of [0, 1, 2]) {
    const gun = makeWeapon(id);
    let meshes = 0;
    gun.traverse((o) => {
      if (o instanceof Mesh) meshes++;
    });
    assert.ok(meshes <= 8, `weapon ${id} uses ${meshes} meshes`);
    assert.ok(gun.getObjectByName('support-hand'));
    assert.ok(
      gun.getObjectByName(id === 2 ? 'barrel-hinge' : 'reload-magazine'),
    );
    disposeObject(gun);
  }
});

await test('reload phase opens, feeds and closes before returning to ready', async () => {
  const { weaponPose, motionState } = await import('../lib/game/animation.js');
  const { GUNS } = await import('../lib/game/core.js');
  const a = new Match(0, 0, 0).player;
  a.weapon = 2;
  a.reload = GUNS[2].reload * 0.9;
  assert.equal(weaponPose(a).phase, 'open');
  a.reload = GUNS[2].reload * 0.5;
  assert.equal(weaponPose(a).phase, 'feed');
  assert.equal(weaponPose(a).hinge, 1);
  a.reload = GUNS[2].reload * 0.04;
  assert.equal(weaponPose(a).phase, 'close');
  assert.equal(weaponPose(a).hinge, 0);
  a.reload = 0;
  assert.equal(weaponPose(a).phase, 'ready');
  assert.equal(weaponPose(a).magazine, 0);
  a.slide = 0.3;
  assert.equal(motionState(a), 'slide');
  a.alive = false;
  assert.equal(motionState(a), 'dead');
});

await test('frame report includes slow frames, rejects invalid samples and stays bounded', async () => {
  const { FrameStats } = await import('../lib/game/performance.js');
  const stats = new FrameStats();
  for (let i = 0; i < 95; i++) stats.record(0.016);
  for (let i = 0; i < 5; i++) stats.record(0.05);
  stats.record(NaN);
  stats.record(-1);
  stats.record(0);
  assert.equal(stats.report().samples, 100);
  assert.equal(stats.report().medianMs, 16);
  assert.equal(stats.report().p95Ms, 16);
  assert.equal(stats.report().p99Ms, 50);
  assert.equal(stats.report().over33Ms, 5);
  for (let i = 0; i < 4000; i++) stats.record(1 / 60);
  assert.equal(stats.report().samples, 3600);
  stats.reset();
  assert.equal(stats.report().samples, 0);
});

await test('ragdoll clone reuses GPU geometry and disposal preserves the living character', async () => {
  const { cloneAvatar } = await import('../lib/game/graphics.js');
  const live = avatar('#d17a4f', 1, 2),
    doll = cloneAvatar(live);
  let disposed = false;
  const geometry = (live.parts[0].children[0] as Mesh).geometry;
  geometry.addEventListener('dispose', () => {
    disposed = true;
  });
  assert.equal((doll.parts[0].children[0] as Mesh).geometry, geometry);
  assert.notEqual(doll.parts[0], live.parts[0]);
  assert.equal(doll.finish, 2);
  disposeObject(doll.group);
  assert.equal(disposed, false);
  disposeObject(live.group);
  assert.equal(disposed, true);
});

await test('equip animation swaps at the lowest point and blocks premature damage', async () => {
  const { equipPose } = await import('../lib/game/animation.js');
  const { EQUIP_SECONDS } = await import('../lib/game/core.js');
  const m = new Match(0, 0, 0),
    a = m.player;
  m.switch(a, 3);
  assert.equal(equipPose(a).weapon, 1);
  a.equip = EQUIP_SECONDS / 2;
  assert.equal(equipPose(a).weapon, 3);
  assert.equal(equipPose(a).lower, 1);
  a.cooldown = 0;
  const shots = a.shots;
  m.shoot(a);
  assert.equal(a.shots, shots);
  a.equip = 0;
  assert.equal(equipPose(a).lower, 0);
  m.shoot(a);
  assert.equal(a.shots, shots + 1);
});

await test('ragdoll contacts resolve ceilings, exact block centers and floor without rebound', async () => {
  const { contactPoint } = await import('../lib/game/ragdoll.js');
  const block = { x: 0, y: 2, z: 0, w: 4, h: 1, d: 4, color: '#fff' };
  const p = v(0, 1.49, 0),
    old = v(0, 1.3, 0);
  contactPoint(p, old, 0.1, [block]);
  assert.ok(p.y <= 1.400001);
  assert.equal(old.y, p.y);
  const center = v(0, 2, 0),
    previous = v(0, 1.2, 0);
  contactPoint(center, previous, 0.1, [block]);
  assert.ok(center.y < 1.5);
  const floor = v(1, -0.2, 1),
    prior = v(0.9, 0.1, 1);
  contactPoint(floor, prior, 0.15, []);
  assert.equal(floor.y, 0.15);
  assert.equal(prior.y, floor.y);
  assert.ok(floor.x - prior.x < 0.1);
});

await test('falling articulated body stays finite and rests above ground with bounded limb stretch', async () => {
  const { stepRagdoll } = await import('../lib/game/ragdoll.js');
  const { RIG_POINTS, RIG_LINKS } = await import('../lib/game/graphics.js');
  const points = RIG_POINTS.map((p) => v(p[0], p[1] + 2, p[2]));
  const old = points.map((p) => v(p.x - 0.015, p.y, p.z - 0.01));
  const links = RIG_LINKS.map(([a, b]) => [
    a,
    b,
    Math.hypot(
      points[a].x - points[b].x,
      points[a].y - points[b].y,
      points[a].z - points[b].z,
    ),
  ]);
  let energy = 0;
  for (let n = 0; n < 600; n++) energy = stepRagdoll(points, old, links, []);
  for (const point of points)
    assert.ok(Number.isFinite(point.x) && point.y >= 0.094);
  for (const [a, b, length] of links)
    assert.ok(
      Math.abs(
        Math.hypot(
          points[a].x - points[b].x,
          points[a].y - points[b].y,
          points[a].z - points[b].z,
        ) - length,
      ) < 0.025,
    );
  assert.ok(energy < 0.00001);
});

await test('result outcome follows team frags and tied leaders, not scoreboard position', async () => {
  const { matchReport } = await import('../lib/game/report.js');
  const rows = [
    { id: 1, team: 1, kills: 10, deaths: 2 },
    { id: 0, team: 0, kills: 6, deaths: 3 },
    { id: 2, team: 0, kills: 10, deaths: 4 },
  ];
  assert.equal(matchReport(0, rows, [0, 0]).outcome, 'draw');
  assert.equal(matchReport(2, rows, [16, 10]).outcome, 'victory');
  assert.equal(matchReport(2, rows, [16, 20]).outcome, 'defeat');
  assert.equal(matchReport(3, rows, [20, 20]).outcome, 'draw');
  assert.equal(matchReport(0, rows.slice(0, 2), [0, 0]).outcome, 'defeat');
  assert.equal(matchReport(0, rows, [0, 0]).rank, 3);
});

await test('practice rewards, purchases and claims are idempotent and UTC schedules refresh', async () => {
  const {
    newProfile,
    recordMatch,
    challenges,
    claimChallenge,
    purchase,
    equipCosmetic,
    refreshProfile,
    DAY,
  } = await import('../lib/game/progression.js');
  const now = Date.UTC(2026, 8, 7, 12),
    base = newProfile(now);
  const receipt = {
    id: 'match-1',
    seconds: 60,
    eligible: true,
    kills: 20,
    headshots: 8,
    meleeKills: 4,
    matches: 1,
    wins: 1,
  };
  let p = recordMatch(base, receipt, now);
  assert.equal(p.balance, 278);
  assert.deepEqual(recordMatch(p, receipt, now), p);
  assert.deepEqual(
    recordMatch(p, { ...receipt, id: 'bench', eligible: false }, now),
    p,
  );
  p = purchase(p, 'finish-frost');
  assert.equal(p.balance, 158);
  assert.deepEqual(purchase(p, 'finish-frost'), p);
  assert.equal(equipCosmetic(p, 'finish-frost').finish, 'finish-frost');
  assert.equal(equipCosmetic(p, 'op-spectre').operator, 'op-spectre');
  assert.equal(equipCosmetic(p, 'unknown-operator').operator, 'op-scout');
  p = recordMatch(p, { ...receipt, id: 'match-2' }, now);
  const challenge = challenges(p).find(
    (c) => c.period === 'daily' && p.daily[c.metric] >= c.target,
  )!;
  const earned = claimChallenge(p, challenge.id, now);
  assert.equal(earned.balance, p.balance + challenge.reward);
  assert.deepEqual(claimChallenge(earned, challenge.id, now), earned);
  const next = refreshProfile(earned, now + DAY);
  assert.equal(next.daily.kills, 0);
  assert.equal(next.weekly.kills, 40);
  assert.ok(!challenges(next).some((c) => c.id === challenge.id));
  const monday = refreshProfile(earned, now + 7 * DAY);
  assert.equal(monday.weekly.kills, 0);
  assert.deepEqual(claimChallenge(next, challenge.id, now + DAY), next);
});

await test('operator variants preserve joint positions and articulated part topology', () => {
  const models = [0, 1, 2].map((variant) => avatar('#ff5c78', variant));
  for (const model of models) {
    assert.deepEqual(
      model.joints.map((p) => p.toArray()),
      models[0].joints.map((p) => p.toArray()),
    );
    assert.equal(model.parts.length, models[0].parts.length);
    disposeObject(model.group);
  }
});
await test('damaged practice storage falls back without breaking the locker', async () => {
  const { loadProfile, newProfile, purchase } =
    await import('../lib/game/progression.js');
  const damaged = { ...newProfile(), ledger: [null] };
  const restored = loadProfile(JSON.stringify(damaged));
  assert.equal(purchase(restored, 'finish-frost').balance, 80);
  assert.equal(loadProfile('{broken').balance, 200);
});

await test('weapon skins equip independently and survive saved-profile loading', async () => {
  const { newProfile, purchase, equipCosmetic, weaponFinish, loadProfile } = await import('../lib/game/progression.js');
  let p = {...newProfile(),balance:4000};
  for (const id of ['skin-echo-carbon', 'skin-kilo-carbon', 'skin-mica-carbon']) p = equipCosmetic(purchase(p, id), id);
  assert.deepEqual([0, 1, 2].map(i => weaponFinish(p, i)), [4, 4, 4]);
  p = loadProfile(JSON.stringify(p));
  assert.deepEqual([0, 1, 2].map(i => weaponFinish(p, i)), [4, 4, 4]);
});

await test('key rebinding remaps press and release, disables old keys and normalizes Shift', async () => {
  const { boundKey } = await import('../lib/game/controls.js');
  const bindings = { KeyW: 'KeyZ', ShiftLeft: 'ControlLeft', Mouse0: 'KeyF' };
  assert.equal(boundKey('KeyZ', bindings), 'KeyW');
  assert.equal(boundKey('KeyW', bindings), 'Unbound');
  assert.equal(boundKey('ControlRight', bindings), 'ShiftLeft');
  assert.equal(boundKey('KeyF', bindings), 'Mouse0');
  assert.equal(boundKey('Escape', bindings), 'Escape');
});

await test('weapons, reload stages and result cues have distinct sound signatures', async () => {
  const { AudioSystem } = await import('../lib/game/audio.js');
  const audio = new AudioSystem();
  let events: unknown[][] = [];
  audio.tone = (...args) => { events.push(['tone', ...args]); };
  audio.burst = (...args) => { events.push(['burst', ...args]); };
  const capture = (run: () => void) => { events = []; run(); return JSON.stringify(events); };
  assert.equal(new Set([0,1,2].map(w => capture(() => audio.shot(w, v(), v(), 0, true)))).size, 3);
  assert.equal(new Set([0,1,2].map(w => capture(() => audio.reload(w)))).size, 3);
  assert.equal(new Set(['feed','close'].flatMap(p => [0,1,2].map(w => capture(() => audio.reloadPhase(p,w))))).size, 6);
  assert.notEqual(capture(() => audio.result(true)), capture(() => audio.result(false)));
  assert.notEqual(capture(() => audio.hit(true)), capture(() => audio.hit(false)));
  assert.ok(capture(() => audio.click()).length > 2);
  assert.notEqual(capture(()=>audio.shot(3,v(),v(),0,true,'slash')),capture(()=>audio.shot(3,v(),v(),0,true,'stab')));
  assert.notEqual(capture(()=>audio.bladeContact(true)),capture(()=>audio.bladeContact(false)));
  assert.notEqual(capture(()=>audio.edgeKill()),capture(()=>audio.kill()));
});

await test('network model refresh agrees with creation for vacant and occupied slots', async () => {
  const { modelVariant, avatar } = await import('../lib/game/graphics.js');
  for (const mode of [0,2] as const) {
    const m = new Match(mode, 0, 7);
    m.actors[1].operator = 1;
    for (const a of m.actors) {
      const variant = modelVariant(a, mode, 1);
      const model = avatar('#ff754d', variant);
      for (let frame = 0; frame < 10; frame++) assert.equal(model.group.userData.operator, modelVariant(a, mode, 1));
    }
  }
});

await test('weapon feedback matches authoritative timers and ammo through firing, reload and switching', async () => {
  const { WeaponFeedback } = await import('../lib/game/weapon-feedback.js');
  for (const weapon of [0,1,2]) {
    const m = new Match(0,0,0);m.selectPrimary(weapon);m.spawn(m.player,true);
    const feedback=new WeaponFeedback(m.player);feedback.reconcile(m.player,0,[], -1,0);
    for (let seq=1;seq<=420;seq++) {
      const input=emptyInput();input.fire=seq<170 || seq>240;input.weapon=seq===180?3:seq===200?weapon:-1;input.reload=seq===230;
      const frame={...input,seq,life:0,yaw:0,pitch:0};
      feedback.advance(frame);m.step(1/120,input);m.step(1/120,input);
      for(const key of ['cooldown','reload','equip','recoilPitch','recoilYaw','fired'] as const) assert.ok(Math.abs(feedback.state[key]-m.player[key])<1e-8, `${weapon}:${seq}:${key}`);
      assert.deepEqual(feedback.state.ammo,m.player.ammo);
      assert.equal(feedback.state.weapon,m.player.weapon);
    }
  }
});
await test('predicted feedback deduplicates confirmations and resets safely on death', async () => {
  const { WeaponFeedback }=await import('../lib/game/weapon-feedback.js');
  const m=new Match(0,0,0);
  m.player.cooldown=0;m.player.equip=0;
  const f=new WeaponFeedback(m.player);
  f.reconcile(m.player,2,[],-1,0);
  const frame={...emptyInput(),fire:true,seq:7,life:2,yaw:0,pitch:0};
  assert.equal(f.advance(frame).filter(e=>e.type==='shot').length,1);
  assert.equal(f.confirmed({type:'shot',actor:0,weapon:1,inputSeq:7,life:2}),true);
  assert.equal(f.confirmed({type:'shot',actor:0,weapon:1,inputSeq:8,life:2}),false);
  const authoritative={...m.player,alive:false};f.reconcile(authoritative,3,[],-1,0);
  assert.equal(f.advance({...frame,seq:8,life:3}).length,0);
  assert.equal(f.played.size,0);
});
await test('remote buffer interpolates server time and never bridges respawns', async () => {
  const { RemoteBuffer }=await import('../lib/game/remote-buffer.js');
  const m=new Match(1), a=m.actors[1], buffer=new RemoteBuffer();
  buffer.accept(1,{...a,pos:v(0,0,0),life:1},1);
  buffer.accept(1,{...a,pos:v(1,0,0),life:1},1.1);
  buffer.time=1.05;buffer.apply(1,a);assert.ok(Math.abs(a.pos.x-0.5)<1e-8);
  buffer.accept(1,{...a,pos:v(15,0,0),life:2},1.15);buffer.apply(1,a);assert.equal(a.pos.x,15);
  for(let i=0;i<50;i++)buffer.accept(1,{...a,life:2},1.2+i*0.05);
  assert.ok(buffer.poses.get(1)!.length<=12);
});

await test('recorded gunfire plays one source per shot, pans remotely and releases voices', async () => {
  const {AudioSystem}=await import('../lib/game/audio.js');
  const audio=new AudioSystem();
  const sources: {start:()=>void;onended:()=>void;playbackRate:{value:number}}[]=[];
  const filters: {frequency:{value:number}}[]=[], pans: {pan:{value:number}}[]=[];
  let starts=0;
  const node=()=>({connect:()=>{},disconnect:()=>{}});
  audio.ctx={
    createBufferSource:()=>{const n={...node(),playbackRate:{value:1},start:()=>{starts++;},onended:()=>{}};sources.push(n);return n;},
    createGain:()=>({...node(),gain:{value:0}}),
    createBiquadFilter:()=>{const n={...node(),frequency:{value:0}};filters.push(n);return n;},
    createStereoPanner:()=>{const n={...node(),pan:{value:0}};pans.push(n);return n;},
  } as unknown as AudioContext;
  audio.master=node() as unknown as GainNode;
  audio.samples.set(0,[{} as AudioBuffer,{} as AudioBuffer]);
  audio.samples.set(1,[{} as AudioBuffer]);audio.samples.set(2,[{} as AudioBuffer]);
  audio.burst=()=>{throw new Error('Synthesized shot must not overlap a recording');};
  audio.tone=()=>{throw new Error('Synthesized shot must not overlap a recording');};
  for(const weapon of [0,0,1,2]) audio.shot(weapon,v(),v(),0,true);
  assert.equal(starts,4);assert.equal(audio.voices,4);
  audio.shot(1,v(10,0,0),v(),0,false);
  assert.ok(pans.at(-1)!.pan.value>0);
  assert.ok(filters.at(-1)!.frequency.value<filters[0].frequency.value);
  sources.forEach(s=>s.onended());assert.equal(audio.voices,0);
  assert.equal(audio.recordedShot(3,.2,0,0,true),false);
  for(const name of ['click','hit','headshot','echo-reload-open','echo-reload-feed','echo-reload-close','edge-stab','edge-hit','victory','reward','defeat','kilo-reload-open','kilo-reload-feed','kilo-reload-close'])audio.effects.set(name,{} as AudioBuffer);
  const actions=[()=>audio.click(),()=>audio.hit(),()=>audio.hit(true),()=>audio.reload(0),()=>audio.reloadPhase('feed',0),()=>audio.reloadPhase('close',0),()=>audio.shot(3,v(),v(),0,true,'stab'),()=>audio.bladeContact(true),()=>audio.result(true),()=>audio.reward(),()=>audio.result(false),()=>audio.reload(1),()=>audio.reloadPhase('feed',1),()=>audio.reloadPhase('close',1)];
  const previous=starts;actions.forEach(action=>action());
  assert.equal(starts-previous,actions.length,'each recorded event plays once without synthesized overlap');
  sources.slice(previous).forEach(source=>source.onended());assert.equal(audio.voices,0);
  audio.voices=48;assert.equal(audio.effect('click'),true);assert.equal(starts,previous+actions.length,'voice budget prevents unbounded overlapping sounds');
});

await test('two-bone IK preserves limb length for crouched, airborne and unreachable targets', async () => {
  const {solveLimb}=await import('../lib/game/motion.js');
  const root=v(0,.86,0);
  for(const target of [v(0,.08,0),v(.2,.25,-.2),v(0,4,0),root,v(9,.86,0)]) {
    const pose=solveLimb(root,target,.4,.38,v(0,0,-1));
    assert.ok(Math.abs(new Vector3().copy(root).distanceTo(new Vector3().copy(pose.joint))-.4)<1e-7);
    assert.ok(Math.abs(new Vector3().copy(pose.joint).distanceTo(new Vector3().copy(pose.end))-.38)<1e-7);
  }
});
await test('strafe/slide camera motion preserves center aim and can be disabled', async () => {
  const {cameraMotion}=await import('../lib/game/motion.js');
  const m=new Match(0,0,0), a=m.player, camera=new PerspectiveCamera(90,1.7,.06,150);
  a.vel=v(6,0,4);a.slideBlend=1;a.landingCompression=1;
  for(const yaw of [-2,0,2])for(const pitch of [-1,0,1]){
    a.yaw=yaw;a.pitch=pitch;syncView(camera,a);
    const motion=cameraMotion(a,0,1,3);camera.rotation.z=motion.roll;
    camera.fov=90+motion.fov;camera.updateProjectionMatrix();
    assert.ok(camera.getWorldDirection(new Vector3()).distanceTo(new Vector3().copy(direction(yaw,pitch)))<1e-9);
    assert.ok(Math.abs(motion.roll)<.075 && motion.fov<=3.5);
  }
  assert.deepEqual(cameraMotion(a,0,0,3),{roll:0,fov:0});
});
await test('animated model clones can enter ragdoll poses without stale locomotion state', async () => {
  const {cloneAvatar}=await import('../lib/game/graphics.js');
  const m=new Match(0,0,0),model=avatar('#ff754d');
  m.player.vel.x=5;
  for(let i=0;i<10;i++)animateAvatar(model,m.player,i/60,1/60);
  const copy=cloneAvatar(model);
  animateAvatar(copy,m.player,1,1/60);
  assert.ok(copy.joints.every(p=>Number.isFinite(p.x+p.y+p.z)));
  disposeObject(copy.group);disposeObject(model.group);
});

await test('locomotion stays finite across render rates and plants feet in world space', () => {
  for(const fps of [20,60,144]) {
    const m=new Match(0,0,0),a=m.player,model=avatar('#ff754d');
    a.pos=v();a.yaw=0;a.vel=v(0,0,-4);a.grounded=true;
    let checked=0;const previous=[new Vector3(),new Vector3()];const planted=[false,false];
    for(let frame=0;frame<fps;frame++){
      a.pos.z-=4/fps;a.stride+=4/fps;
      animateAvatar(model,a,frame/fps,1/fps);
      const memory=model.group.userData.locomotion;
      for(const [index,foot] of [[0,11],[1,14]]) {
        const world=model.joints[foot].clone().add(a.pos);
        if(memory.planted[index] && planted[index]){assert.ok(world.distanceTo(previous[index])<1e-6);checked++;}
        previous[index].copy(world);planted[index]=memory.planted[index];
      }
      assert.ok(model.joints.every(p=>Number.isFinite(p.x+p.y+p.z)));
    }
    assert.ok(checked>0);disposeObject(model.group);
  }
});

await test('camera has no stationary landing oscillation, directional slide tilt, or ADS FOV pulse',async()=>{
  const {cameraMotion}=await import('../lib/game/motion.js');const a=new Match(0,0,0).player;
  a.vel=v();a.landingCompression=1;a.slideBlend=1;
  assert.ok(cameraMotion(a,0,1,0).roll===0);assert.ok(cameraMotion(a,0,1,1).roll===0);
  a.yaw=0;a.vel=v(8,0,0);const right=cameraMotion(a,0,1,0);a.vel.x=-8;const left=cameraMotion(a,0,1,0);
  assert.equal(right.roll,-left.roll);assert.ok(Math.abs(right.roll)<=0.012);assert.ok(right.fov<=1);
  assert.equal(cameraMotion(a,1,1,0).fov,0);
});
await test('both EDGE predictions match authoritative cadence and attack selection',async()=>{
 const {WeaponFeedback}=await import('../lib/game/weapon-feedback.js');
 for(const secondary of [false,true]){
  const m=new Match(0,0,0);m.player.weapon=3;m.player.equip=0;m.player.cooldown=0;
  const f=new WeaponFeedback(m.player);f.reconcile(m.player,0,[],-1,0);
  const input={...emptyInput(),fire:!secondary,ads:secondary};
  for(let seq=1;seq<=60;seq++){
   f.advance({...input,seq,life:0,yaw:0,pitch:0});m.step(1/120,input);m.step(1/120,input);
   assert.equal(f.state.edgeAttack,m.player.edgeAttack);assert.equal(f.state.edgeSide,m.player.edgeSide);
   assert.ok(Math.abs(f.state.fired-m.player.fired)<1e-9);assert.equal(f.state.shots,m.player.shots);
  }
 }
});

await test('capture requests reject stale failures and repeated respawn keys',async()=>{
 const {CaptureGuard,respawnShortcut}=await import('../lib/game/controls.js');
 const guard=new CaptureGuard();const first=guard.begin();guard.cancel();const second=guard.begin();
 assert.equal(guard.settle(first),false);assert.equal(guard.pending,true);assert.equal(guard.settle(second),true);assert.equal(guard.settle(second),false);
 assert.equal(respawnShortcut('Space',false),true);assert.equal(respawnShortcut('Enter',false),true);assert.equal(respawnShortcut('Space',true),false);
});

await test('premium finishes require ownership and Factory restores only the selected weapon', async () => {
 const {newProfile,purchase,equipWeaponFinish,weaponFinish,loadProfile}=await import('../lib/game/progression.js');
 let p={...newProfile(),balance:1500};
 assert.deepEqual(equipWeaponFinish(p,0,'skin-echo-carbon'),p);
 p=purchase(p,'skin-echo-carbon');assert.equal(p.balance,750);
 assert.deepEqual(purchase(p,'skin-echo-carbon'),p);
 assert.deepEqual(equipWeaponFinish(p,1,'skin-echo-carbon'),p);
 p=equipWeaponFinish(p,0,'skin-echo-carbon');
 p=equipWeaponFinish(purchase({...p,balance:950},'skin-kilo-carbon'),1,'skin-kilo-carbon');
 assert.deepEqual([0,1,2].map(w=>weaponFinish(p,w)),[4,4,0]);
 p=loadProfile(JSON.stringify(equipWeaponFinish(p,0,'finish-factory')));
 assert.deepEqual([0,1,2].map(w=>weaponFinish(p,w)),[0,4,0]);
 assert.deepEqual(purchase(p,'skin-mica-carbon'),p);
});
await test('lobby carry poses preserve arm lengths across all models and all primaries', async () => {
 const {poseLobbyAvatar}=await import('../lib/game/graphics.js');
 const {RIG_POINTS}=await import('../lib/game/graphics.js');
 for(const variant of [0,1,2])for(const weapon of [0,1,2]){
  const model=avatar('#aabbcc',variant),m=new Match(0,0,weapon);
  for(const time of [0,1,5]){
   animateAvatar(model,m.player,time,.016);poseLobbyAvatar(model,time);
   for(const [a,b] of [[3,4],[4,5],[6,7],[7,8]]){
    const expected=new Vector3(...RIG_POINTS[a]).distanceTo(new Vector3(...RIG_POINTS[b]));
    assert.ok(Math.abs(model.joints[a].distanceTo(model.joints[b])-expected)<1e-5);
   }
  }
  disposeObject(model.group);
 }
});
await test('all three block character meshes are finite, distinct and within the lightweight budget',()=>{
 const counts=[];
 for(const variant of [0,1,2]){
  const model=avatar('#ff8855',variant);let triangles=0;
  for(const part of model.parts)part.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));triangles+=(o.geometry.index?.count??p.count)/3;}});
  assert.ok(triangles>200&&triangles<900);counts.push(triangles);disposeObject(model.group);
 }
 assert.equal(new Set(counts).size,3);
});
await test('KR challenge sets award bonuses once, refresh on UTC boundaries and retain savings',async()=>{
 const {newProfile,challenges,claimChallenge,refreshProfile,DAY,CATALOG,purchase,recordMatch}=await import('../lib/game/progression.js');
 const now=Date.UTC(2026,8,14,12);let p=newProfile(now);
 assert.deepEqual(purchase(p,'skin-echo-carbon'),p,'starter credits alone cannot unlock an elite skin');
 p=recordMatch(p,{id:'earned',eligible:true,seconds:60,kills:10,headshots:3,meleeKills:2,matches:1,wins:1},now);assert.equal(p.balance,253);
 for(const key of ['kills','headshots','meleeKills','matches','wins'] as const)p.daily[key]=p.weekly[key]=100;
 const initial=p.balance,list=challenges(p);
 for(const c of list)p=claimChallenge(p,c.id,now);
 assert.equal(p.balance,initial+list.reduce((n,c)=>n+c.reward,0)+200);
 for(const c of list)assert.deepEqual(claimChallenge(p,c.id,now),p);
 const next=refreshProfile(p,now+7*DAY);assert.equal(next.balance,p.balance);assert.equal(next.daily.kills,0);assert.equal(next.weekly.kills,0);
 for(const weapon of [0,1,2]){const skins=CATALOG.filter(i=>'weapon'in i&&i.weapon===weapon).sort((a,b)=>a.cost-b.cost);assert.equal(skins.length,2);assert.ok(skins[0].cost<skins[1].cost);assert.equal(skins[1].variant,5);}
});

await test('Dune static scenery stays within a small draw and geometry budget',async()=>{
 const {buildMap}=await import('../lib/game/graphics.js');const {makeMap}=await import('../lib/game/core.js');
 const group=buildMap(makeMap(0));let meshes=0,triangles=0;
 group.traverse(o=>{if(o instanceof Mesh){meshes++;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}});
 assert.ok(meshes<100,`${meshes} draws`);assert.ok(triangles<40000,`${triangles} triangles`);
 assert.equal(group.userData.mapTextures.length,7);
 const tiles=group.userData.mapTextures as import('three').DataTexture[];
 assert.equal(new Set(tiles.map(t=>Buffer.from(t.image.data as Uint8Array).toString('base64'))).size,7,'each surface needs its own texture');
 for(const tile of tiles){assert.equal(tile.image.width,128);assert.equal(tile.image.height,128);assert.ok(tile.generateMipmaps);}
 disposeObject(group);
});

await test('Snow and open cells stay within geometry budgets',async()=>{
 const {buildMap}=await import('../lib/game/graphics.js');const {makeMap}=await import('../lib/game/core.js');
 for(const id of [1,2,3]){const g=buildMap(makeMap(id));let triangles=0,draws=0;g.traverse(o=>{if(o instanceof Mesh){draws++;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}});assert.ok(draws<75);assert.ok(triangles<35000);if(id>=2)assert.equal(g.name,'open-cell');disposeObject(g);}
});

await test('v0.9 block rigs stand upright at rest and weapon meshes stay inexpensive',async()=>{
 const {poseLobbyAvatar}=await import('../lib/game/graphics.js');
 for(const variant of [0,1,2]){const m=new Match(0,0,0),model=avatar('#bbccdd',variant);m.player.vel=v();m.player.grounded=true;
 animateAvatar(model,m.player,0);poseLobbyAvatar(model,0);
 for(const [hip,knee,foot] of [[9,10,11],[12,13,14]]){assert.equal(model.joints[hip].x,model.joints[knee].x);assert.equal(model.joints[knee].x,model.joints[foot].x);assert.equal(model.joints[knee].z,model.joints[foot].z);}
 disposeObject(model.group);}
 for(const weapon of [0,1,2,3])for(const finish of [0,1,2,3,4,5]){const g=makeWeapon(weapon,true,finish);let triangles=0;g.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});assert.ok(triangles<2500,`${weapon}/${finish}: ${triangles}`);disposeObject(g);}
});

await test('retired finishes refund once and reset equipped copies without losing savings',async()=>{
 const {newProfile,loadProfile,refreshProfile,weaponFinish}=await import('../lib/game/progression.js');
 const now=Date.UTC(2026,8,21),old={...newProfile(now),balance:40,owned:['op-scout','finish-factory','skin-echo','skin-kilo','skin-mica','skin-echo-corona'],weaponFinishes:['skin-echo','skin-kilo','skin-mica']};
 const p=loadProfile(JSON.stringify(old),now);assert.equal(p.balance,1090);assert.deepEqual([0,1,2].map(w=>weaponFinish(p,w)),[0,0,0]);assert.ok(p.owned.includes('skin-echo-corona'));
 assert.deepEqual(refreshProfile(p,now),p);assert.deepEqual(loadProfile(JSON.stringify(p),now),p);
});
await test('authored challenge rotation is deterministic, diverse and refreshes while retaining earnings',async()=>{
 const {newProfile,challenges,refreshProfile,claimChallenge,DAY}=await import('../lib/game/progression.js');
 const start=Date.UTC(2026,8,21);const seen=new Set<string>();
 for(let day=0;day<35;day++){
  const p=newProfile(start+day*DAY),list=challenges(p);assert.deepEqual(challenges(p),list);
  for(const period of ['daily','weekly'] as const){const set=list.filter(c=>c.period===period);assert.equal(set.length,period==='daily'?3:4);assert.equal(new Set(set.map(c=>c.metric)).size,set.length);assert.ok(set.every(c=>c.expires>start+day*DAY));}
  seen.add(list.filter(c=>c.period==='daily').map(c=>c.title).join(','));
  const next=refreshProfile(p,start+(day+1)*DAY);assert.equal(next.balance,p.balance);assert.deepEqual(claimChallenge(next,list[0].id,start+(day+1)*DAY),next);
 }
 assert.ok(seen.size>20);
});
