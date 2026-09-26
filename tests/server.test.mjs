import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Room, sanitizeInput } from '../server/rooms.mjs';
import { createArenaServer } from '../server/index.mjs';
import { NetworkState, localId, ROOM_PROTOCOL } from '../.server-build/network-state.js';
import { emptyInput, makeLegacyMap, EDGE_ATTACKS } from '../.server-build/core.js';
import { EconomyStore } from '../server/economy.mjs';
const message = (seq, extra = {}) => ({
  seq,
  forward: 1,
  right: 0,
  yaw: 0,
  pitch: 0,
  ...extra,
});
await test('room owns movement, bounds input and rejects replayed input', () => {
  const room = new Room(1, 1),
    a = room.join('one'),
    b = room.join('two');
  const player = room.match.actors[a.id];
  player.pos = { x: -20, y: 0, z: 10 };
  room.input(
    a.token,
    message(1, {
      forward: 999,
      health: 999,
      position: { x: 1000 },
      damage: 999,
    }),
  );
  assert.equal(room.input(a.token, message(1)), false);
  for (let n = 0; n < 12; n++) room.step();
  assert.ok(player.pos.z < 10 && player.pos.z > 9);
  assert.equal(player.hp, 100);
  assert.equal(player.kills, 0);
  assert.throws(() => sanitizeInput(message(2, { yaw: Infinity })));
  assert.throws(() => room.join('third'), /full/);
  room.disconnect(b.token, 1000);
  assert.equal(room.join('ignored', b.token, 1500).id, b.id);
});
await test('only server-authorized deployment restores a dead player', () => {
  const room = new Room(1, 0),
    a = room.join('one');
  const actor = room.match.actors[a.id];
  assert.equal(room.deploy(a.token, 2), false);
  actor.alive = false;
  actor.respawn = 1;
  assert.equal(room.deploy(a.token, 2), false);
  actor.respawn = 0;
  assert.equal(room.deploy(a.token, 2), true);
  assert.equal(actor.primary, 2);
  assert.equal(actor.ammo[2], 2);
});
await test(
  'two independent sockets share one authoritative room and reconnect',
  { timeout: 10000 },
  async () => {
    const server = createArenaServer({ port: 0 });
    const address = await server.listen();
    const url = `ws://127.0.0.1:${address.port}/play`,
      sockets = [];
    const connect = async () => {
      const socket = new WebSocket(url);
      sockets.push(socket);
      await once(socket, 'open');
      return socket;
    };
    const waitFor = (socket, type) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.off('message', handler);
          reject(new Error('Message timeout ' + type));
        }, 3000);
        const handler = (raw) => {
          const value = JSON.parse(raw.toString());
          if (value.type === type) {
            clearTimeout(timer);
            socket.off('message', handler);
            resolve(value);
          }
        };
        socket.on('message', handler);
      });
    try {
      const a = await connect(),
        welcomeA = waitFor(a, 'welcome');
      a.send(JSON.stringify({ type: 'create', mode: 1, map: 0, name: 'A' }));
      const first = await welcomeA;
      const b = await connect(),
        welcomeB = waitFor(b, 'welcome');
      b.send(JSON.stringify({ type: 'join', room: first.room, name: 'B' }));
      const second = await welcomeB;
      assert.notEqual(first.id, second.id);
      assert.equal(first.room, second.room);
      let snapshot = await waitFor(a, 'snapshot');
      assert.equal(snapshot.staging,true);
      a.send(JSON.stringify({type:'lobby',ready:true}));
      b.send(JSON.stringify({type:'lobby',ready:true}));
      do { snapshot = await waitFor(a,'snapshot'); } while(snapshot.actors.some(p=>p.connected&&!p.ready));
      a.send(JSON.stringify({type:'start'}));
      do { snapshot = await waitFor(a,'snapshot'); } while(snapshot.staging);
      assert.equal(snapshot.actors.length, 2);
      assert.equal(snapshot.state, 'playing');
      a.send(JSON.stringify({ type: 'input', ...message(7) }));
      let next = await waitFor(a, 'snapshot');
      if (next.ack !== 7) next = await waitFor(a, 'snapshot');
      assert.equal(next.ack, 7);
      const closed = once(b, 'close');
      b.close();
      await closed;
      const replacement = await connect(),
        resumed = waitFor(replacement, 'welcome');
      replacement.send(
        JSON.stringify({ type: 'join', room: first.room, token: second.token }),
      );
      assert.equal((await resumed).id, second.id);
    } finally {
      for (const socket of sockets) socket.terminate();
      await server.close();
    }
  },
);
await test('persistent economy operations are atomic, replay-safe and cannot mint paid credit', () => {
  const store = new EconomyStore();
  try {
    store.create('player');
    const receipt = {
      id: 'round-1',
      eligible: true,
      seconds: 60,
      kills: 20,
      headshots: 0,
      meleeKills: 0,
      matches: 1,
      wins: 0,
    };
    assert.equal(store.settleAuthoritativeMatch('player', receipt).balance, 11);
    assert.equal(store.settleAuthoritativeMatch('player', receipt).balance, 11);
    assert.equal(store.buy('player', 'finish-frost').balance, 11);
    for(let i=2;i<=11;i++)store.settleAuthoritativeMatch('player', { ...receipt, id: 'round-'+i });
    const bought = store.buy('player', 'finish-frost');
    assert.equal(bought.balance, 1);
    assert.ok(bought.owned.includes('finish-frost'));
    assert.equal(store.buy('player', 'finish-frost').balance, 1);
    assert.throws(() => store.grantPaid(), /disabled/);
  } finally {
    store.close();
  }
});

await test('held network jump triggers once until release and stale input stops movement', () => {
  const room = new Room(1, 0),
    a = room.join('one');
  room.join('two');
  const p = room.match.actors[a.id];
  p.pos = { x: -26, y: 0, z: 8 };
  p.grounded = true;
  room.input(a.token, message(1, { forward: 0, jump: true }));
  for (let i = 0; i < 180; i++) room.step();
  assert.equal(p.grounded, true);
  assert.ok(p.pos.y < 0.01);
  room.input(a.token, message(2, { forward: 0, jump: false }));
  room.step();
  room.step();
  room.input(a.token, message(3, { forward: 0, jump: true }));
  room.step();
  assert.ok(p.vel.y > 0);
  room.input(a.token, message(4), 1000);
  room.step(1300);
  assert.equal(room.match.remoteInputs.get(a.id).forward, 0);
});

await test('room results belong to the receiving player rather than local player zero', () => {
  const room = new Room(1, 0),
    a = room.join('one'),
    b = room.join('two');
  room.match.actors[b.id].kills = 20;
  room.match.finish();
  assert.equal(room.snapshot(a.token).outcome, 'defeat');
  assert.equal(room.snapshot(b.token).outcome, 'victory');
  assert.equal(room.snapshot(a.token).winnerId, b.id);
  const teams = new Room(2, 0),
    t = teams.join('one');
  teams.match.teams[teams.match.actors[t.id].team] = 20;
  teams.match.finish();
  assert.equal(teams.snapshot(t.token).outcome, 'victory');
});

await test('prediction replays only unapplied ticks, including a half-applied frame', () => {
  const room = new Room(1, 0),
    a = room.join('one');
  room.join('two');
  const p = room.match.actors[a.id];
  p.pos = { x: -26, y: 0, z: 8 };
  p.yaw = 0;
  const client = new NetworkState(room.snapshot(a.token));
  const input = { ...emptyInput(), forward: 1 };
  const f1 = client.frame(input);
  room.input(a.token, f1);
  room.step();
  assert.equal(room.snapshot(a.token).ack, -1);
  assert.equal(room.snapshot(a.token).remainingSteps, 1);
  const expected = { ...client.match.player.pos };
  client.accept(room.snapshot(a.token));
  assert.ok(Math.abs(client.match.player.pos.z - expected.z) < 1e-9);
  room.step();
  assert.equal(room.snapshot(a.token).ack, f1.seq);
  client.accept(room.snapshot(a.token));
  assert.equal(client.history.length, 0);
  assert.ok(Math.abs(client.match.player.pos.z - p.pos.z) < 1e-9);
  for (let n = 0; n < 30; n++) {
    const f = client.frame(input);
    room.input(a.token, f);
    room.step();
    room.step();
    if (n % 3 === 0) client.accept(room.snapshot(a.token));
  }
  client.accept(room.snapshot(a.token));
  assert.ok(Math.abs(client.match.player.pos.z - p.pos.z) < 1e-9);
});
await test('the second client gets its own HUD, team, death, event identity and spawn choice', () => {
  const room = new Room(2, 0),
    a = room.join('one'),
    b = room.join('two', undefined, Date.now(), 2);
  const client = new NetworkState(room.snapshot(b.token));
  assert.equal(client.match.player.name, 'two');
  assert.equal(client.match.player.primary, 2);
  assert.equal(client.match.player.team, 0);
  assert.equal(client.match.actors[localId(a.id, b.id)].team, 1);
  const victim = room.match.actors[b.id];
  victim.shield = 0;
  room.match.damage(victim, room.match.actors[a.id], 100, false);
  room.step();
  client.accept(room.snapshot(b.token));
  assert.equal(client.match.pendingSpawn, true);
  assert.equal(client.match.player.alive, false);
  assert.ok(
    client.match.events.some(
      (e) => e.type === 'kill' && e.target === 0 && e.actor === 1,
    ),
  );
  client.match.events = [];
  client.accept(room.snapshot(b.token));
  assert.equal(client.match.events.length, 0);
  victim.respawn = 0;
  assert.equal(room.deploy(b.token, 0), true);
  room.step();
  client.accept(room.snapshot(b.token));
  assert.equal(client.match.player.primary, 0);
  assert.equal(client.match.pendingSpawn, false);
  assert.equal(room.input(b.token, { ...message(100), life: 0 }), false);
});

await test('delayed movement delivery stays bounded and converges after acknowledgements', () => {
  for (const latencyTicks of [6, 12, 18]) {
    const room = new Room(1, 1),
      a = room.join('one');
    room.join('two');
    room.match.actors[a.id].pos = { x: -20, y: 0, z: 10 };
    room.match.actors[a.id].yaw = 0;
    const client = new NetworkState(room.snapshot(a.token)),
      transit = [];
    for (let tick = 0; tick < 360; tick++) {
      if (tick % 2 === 0 && tick < 300) {
        const input = {
          ...emptyInput(),
          forward: tick < 200 ? 1 : 0,
          right: tick < 100 ? 0.5 : 0,
          crouch: tick >= 100 && tick < 160,
        };
        transit.push({ at: tick + latencyTicks, frame: client.frame(input) });
      }
      while (transit.length && transit[0].at <= tick)
        room.input(a.token, transit.shift().frame);
      room.step();
      if (tick % 6 === 0) client.accept(room.snapshot(a.token));
      assert.ok(client.history.length <= 90);
      assert.ok(Number.isFinite(client.match.player.pos.z));
    }
    client.accept(room.snapshot(a.token));
    assert.equal(client.history.length, 0);
    assert.ok(
      Math.abs(client.match.player.pos.z - room.match.actors[a.id].pos.z) <
        1e-9,
    );
  }
});

await test('room settings enforce capacity, duration, loadout and team identities', () => {
  assert.throws(() => new Room(0,0,undefined,{ duration: 2 }), /Invalid/);
  assert.throws(() => new Room(0,0,undefined,{ capacity: 100 }), /Invalid/);
  const r = new Room(0,1,undefined,{duration:60,capacity:2});
  const a = r.join('A',undefined,Date.now(),0,1); r.join('B');
  assert.equal(r.snapshot(a.token).duration,60);
  assert.equal(r.match.actors[a.id].operator,1);
  assert.equal(r.match.actors[a.id].ammo[0],35);
  assert.throws(() => r.join('C'), /full/);
  r.match.time = 0.001; r.step(); assert.equal(r.match.ended,true);
  const team = new Room(2,0); const x=team.join('X'), y=team.join('Y');
  assert.notEqual(team.match.actors[x.id].operator,team.match.actors[y.id].operator);
});
await test('public rooms fill with server bots and replace them with humans', () => {
  const r = new Room(2,0,undefined,{public:true,duration:180});
  const a=r.join('A'); r.step();
  let snap=r.snapshot(a.token);
  assert.equal(snap.state,'playing'); assert.equal(snap.actors.length,4);
  assert.equal(snap.actors.filter(x=>x.bot).length,3);
  const b=r.join('B'); snap=r.snapshot(a.token);
  assert.equal(snap.actors.filter(x=>x.bot).length,2);
  r.disconnect(b.token,1000); r.step(122001);
  assert.equal(r.snapshot(a.token).actors.filter(x=>x.bot).length,3);
});

await test('Quick Play ignores private preferences and pools live players', { timeout: 10000 }, async () => {
  const server = createArenaServer({port:0}); const address = await server.listen(); const sockets=[];
  const connect = async () => { const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`); sockets.push(ws); await once(ws,'open'); return ws; };
  const waitFor = (ws,type) => new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error(`Missing ${type}`));},3000);
    const handler=data=>{const m=JSON.parse(data);if(m.type===type){clearTimeout(timer);ws.off('message',handler);resolve(m);}};
    ws.on('message',handler);
  });
  try {
    const options={type:'quick',mode:0,map:1,duration:180,capacity:4,primary:0,operator:1};
    const a=await connect(); const aw=waitFor(a,'welcome'); a.send(JSON.stringify({...options,name:'A'}));const first=await aw;
    const b=await connect(); const bw=waitFor(b,'welcome'); b.send(JSON.stringify({...options,name:'B',primary:2}));const second=await bw;
    assert.equal(first.room,second.room); assert.notEqual(first.id,second.id);
    const snap=await waitFor(a,'snapshot');
    assert.equal(snap.actors.filter(x=>x.bot).length,4); assert.equal(snap.actors.filter(x=>x.connected).length,2);
    assert.equal(snap.duration,300);assert.equal(snap.map,0);assert.equal(snap.state,'playing');
    assert.equal(snap.actors.find(x=>x.id===second.id).primary,2);
    const c=await connect();const cw=waitFor(c,'welcome');c.send(JSON.stringify({...options,map:0,name:'C'}));assert.equal((await cw).room,first.room);
  } finally { for (const ws of sockets) ws.terminate(); await server.close(); }
});

await test('rewind is bounded to 200ms and never crosses a spawn', async () => {
  const { LagHistory }=await import('../server/lag-history.mjs');
  const r=new Room(1,0);r.join('A');r.join('B');const a=r.match.actors[1], h=new LagHistory();
  for(let tick=0;tick<=40;tick++){a.pos.x=tick;h.record(tick,r.match.actors);}
  assert.equal(h.pose(a,0,40).pos.x,16);
  assert.equal(h.pose(a,999,40).pos.x,40);
  assert.equal(h.pose(a,NaN,40),undefined);
  r.match.spawn(a,true);assert.equal(h.pose(a,20,40),undefined);
  assert.ok(h.frames.length<=26);
});
await test('authoritative shot events identify input frame and expose tick diagnostics', () => {
  const r=new Room(1,0), a=r.join('A');r.join('B');
  r.match.actors[a.id].equip=0;r.match.actors[a.id].cooldown=0;
  r.input(a.token,message(9,{fire:true,viewTick:0}));r.step();
  const shot=r.snapshot(a.token).events.find(e=>e.type==='shot' && e.actor===a.id);
  assert.equal(shot.inputSeq,9);assert.equal(shot.life,0);
  assert.ok(r.snapshot(a.token).serverStepMs>=0);
});

await test('room hitscan uses historical targets but still respects solid cover', () => {
  for (const blocked of [false,true]) {
    const r=new Room(1,1), owner=r.join('A');r.join('B');r.match.map=makeLegacyMap(1);
    const [a,b]=r.match.actors;
    a.pos={x:-5,y:0,z:-2};b.pos={x:-5,y:0,z:-7};
    a.yaw=0;a.pitch=0;a.cooldown=0;a.equip=0;a.shield=0;b.shield=0;
    r.match.random=()=>0;
    r.lagHistory.record(0,r.match.actors);
    b.pos={x:-10,y:0,z:-7};r.tickId=12;
    if(blocked)r.match.map.blocks.push({x:-5,y:1.5,z:-4.5,w:2,h:3,d:1,color:'#555',kind:'wall'});
    r.input(owner.token,message(1,{forward:0,fire:true,viewTick:0}));r.step();
    assert.equal(b.hp<100,!blocked);
    assert.equal(b.pos.x,-10,'rewind must not move the live target');
  }
});

await test('friend staging freezes simulation, publishes loadout, and enforces host/ready rules', () => {
  const r=new Room(0,1,undefined,{staging:true,botFill:true,capacity:4,fragLimit:50,duration:180,difficulty:'hard'});
  const a=r.join('Alpha'),b=r.join('Beta');
  for(let i=0;i<60;i++)r.step();
  assert.equal(r.match.time,180);assert.equal(r.snapshot(a.token).state,'waiting');
  r.lobbyChange(b.token,{primary:2,operator:1,ready:true});
  const remote=r.snapshot(a.token).actors.find(p=>p.id===b.id);
  assert.equal(remote.primary,2);assert.equal(remote.operator,1);assert.equal(remote.ready,true);
  assert.throws(()=>r.startMatch(b.token),/host/);
  assert.throws(()=>r.startMatch(a.token),/ready/);
  r.lobbyChange(a.token,{ready:true});r.startMatch(a.token);for(let i=0;i<361;i++)r.step();
  assert.equal(r.snapshot(a.token).state,'playing');assert.equal(r.match.fragLimit,50);
  assert.equal(r.match.difficulty,'hard');assert.ok(r.match.time<180);
  assert.equal(r.match.actors[b.id].ammo[2],2);
  assert.throws(()=>r.lobbyChange(b.token,{primary:0}),/editable/);
});
await test('friend lobby host transfers and invalid match rules are rejected', () => {
  for(const options of [{fragLimit:999},{difficulty:'impossible'},{duration:7}]) assert.throws(()=>new Room(0,0,undefined,options),/Invalid/);
  const r=new Room(1,0,undefined,{staging:true});const a=r.join('A'),b=r.join('B');
  r.disconnect(a.token);assert.equal(r.snapshot(b.token).host,b.id);
  assert.throws(()=>r.lobbyChange(b.token,{operator:9}),/Invalid/);
  assert.throws(()=>r.lobbyChange(b.token,{primary:3}),/Invalid/);
});

await test('online secondary EDGE attack is server timed and reaches beyond slash',()=>{
 for(const secondary of [false,true]){
  const r=new Room(1,0);const x=r.join('A'),y=r.join('B');const a=r.match.actors[x.id],b=r.match.actors[y.id];
  r.match.map.blocks=[];a.pos={x:0,y:0,z:0};b.pos={x:0,y:0,z:-2.6};a.weapon=3;a.equip=0;a.cooldown=0;a.yaw=a.pitch=0;a.shield=b.shield=0;
  r.match.remoteInputs.set(a.id,{...emptyInput(),fire:!secondary,ads:secondary});
  r.step();assert.equal(b.hp,100);assert.equal(a.edgeAttack,secondary?'stab':'slash');
  for(let n=0;n<Math.ceil(EDGE_ATTACKS.stab.contact*120)+2;n++)r.step();assert.equal(b.alive,!secondary);
  assert.equal(r.snapshot(x.token).events.filter(e=>e.type==='melee-contact').length,1);
 }
});

await test('private rematch preserves party, clears combat and accepts the next life sequence',()=>{
 const r=new Room(1,0,undefined,{staging:true});const x=r.join('A'),y=r.join('B');
 r.lobbyChange(x.token,{primary:0,ready:true});r.lobbyChange(y.token,{primary:2,ready:true});r.startMatch(x.token);
 const roundId=r.snapshot(x.token).roundId;assert.ok(roundId);assert.equal(r.snapshot(y.token).roundId,roundId);
 r.slots.get(x.token).seq=500;r.match.actors[x.id].kills=20;r.match.finish();
 assert.throws(()=>r.rematch(y.token),/host/);r.rematch(x.token);
 const s=r.snapshot(x.token);assert.notEqual(s.roundId,roundId);assert.equal(s.staging,true);assert.equal(s.actors.find(a=>a.id===x.id).primary,0);assert.equal(s.actors.find(a=>a.id===y.id).primary,2);assert.equal(s.actors.find(a=>a.id===x.id).kills,0);
 assert.equal(r.input(x.token,message(501,{life:0})),false);
 r.lobbyChange(x.token,{ready:true});r.lobbyChange(y.token,{ready:true});r.startMatch(x.token);for(let i=0;i<360;i++)r.step();
 assert.equal(r.input(x.token,message(1,{life:0})),false);assert.equal(r.input(x.token,message(1,{life:1})),true);
 assert.equal(r.snapshot(y.token).room,s.room);assert.equal(r.slots.size,2);
});

await test('delayed input bursts retire stale frames without disconnecting or fast-forwarding', () => {
  const r=new Room(1,0),a=r.join('A');r.join('B');
  const actor=r.match.actors[a.id];actor.pos={x:-22,y:0,z:10};
  for(let seq=1;seq<=180;seq++)assert.equal(r.input(a.token,message(seq)),true);
  assert.ok(r.slots.get(a.token).queue.length<=6);
  assert.ok(r.snapshot(a.token).droppedInputs>0);
  for(let i=0;i<12;i++)r.step();
  assert.equal(r.snapshot(a.token).ack,180);
  assert.ok(actor.pos.z>9 && actor.pos.z<10,'burst cannot simulate multiple seconds in one tick');
  assert.equal(r.slots.get(a.token).connected,true);
});
await test('reconnecting after 90 seconds preserves identity, score and equipment; expired slots reject', () => {
  const r=new Room(1,0);r.join('A');const b=r.join('B');
  const receiptRound=r.snapshot(b.token).roundId;
  const actor=r.match.actors[b.id];actor.kills=7;actor.deaths=3;actor.score=850;actor.primary=2;
  r.disconnect(b.token,1000);r.step(91000);
  const back=r.join('ignored',b.token,91000);
  assert.equal(back.id,b.id);assert.equal(back.token,b.token);assert.equal(r.snapshot(back.token).roundId,receiptRound);
  assert.deepEqual([actor.kills,actor.deaths,actor.score,actor.primary],[7,3,850,2]);
  r.disconnect(b.token,92000);r.step(213001);
  assert.throws(()=>r.join('ignored',b.token,213001),/Session unavailable/);
});
await test('websocket packet burst remains connected and acknowledges the newest input', {timeout:10000}, async () => {
  const server=createArenaServer({port:0}),address=await server.listen();
  const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`);
  const waitFor=predicate=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error('Packet burst timeout'));},4000);
    const handler=raw=>{const m=JSON.parse(raw);if(predicate(m)){clearTimeout(timer);ws.off('message',handler);resolve(m);}};ws.on('message',handler);
  });
  try {
    await once(ws,'open');const welcome=waitFor(m=>m.type==='welcome');
    ws.send(JSON.stringify({type:'quick',mode:1,map:0,name:'Burst'}));await welcome;
    const caughtUp=waitFor(m=>m.type==='snapshot'&&m.ack===180);
    for(let seq=1;seq<=180;seq++)ws.send(JSON.stringify({type:'input',...message(seq)}));
    const snap=await caughtUp;assert.ok(snap.droppedInputs>0);assert.equal(ws.readyState,WebSocket.OPEN);
  }finally{ws.terminate();await server.close();}
});
await test('manual retry retains session and ignores callbacks from the old socket', async () => {
  const {RoomClient}=await import('../.server-build/room-client.js');
  const {ROOM_PROTOCOL}=await import('../.server-build/network-state.js');
  const originals=['WebSocket','location','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const sockets=[];
  class FakeSocket {
    static OPEN=1;readyState=1;bufferedAmount=0;sent=[];
    constructor(){sockets.push(this);}
    send(raw){this.sent.push(JSON.parse(raw));}
    close(){this.readyState=3;}
  }
  let client;
  try {
    Object.defineProperty(globalThis,'WebSocket',{value:FakeSocket,configurable:true});
    Object.defineProperty(globalThis,'location',{value:{protocol:'http:'},configurable:true});
    Object.defineProperty(globalThis,'document',{value:{hidden:false},configurable:true});
    client=new RoomClient({url:'ws://localhost:3002/play',name:'A',mode:0,map:0,primary:1,quickPlay:true},()=>{},()=>{});
    client.connect();const old=sockets[0];await old.onopen();
    old.onmessage({data:JSON.stringify({type:'welcome',protocol:ROOM_PROTOCOL,token:'secret',room:'ABCDEF'})});
    client.retry();const next=sockets[1];await next.onopen();
    assert.deepEqual(next.sent[0],{type:'join',room:'ABCDEF',token:'secret'});
    old.onmessage({data:JSON.stringify({type:'error',message:'late'})});old.onclose();
    assert.equal(client.socket,next);assert.equal(client.info.status,'reconnecting');assert.equal(client.stopped,false);
    next.onmessage({data:JSON.stringify({type:'welcome',protocol:ROOM_PROTOCOL,token:'secret',room:'ABCDEF'})});
    assert.equal(client.info.status,'connected');
  }finally{client?.stop();for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

await test('four live friends share one match and a returning socket keeps its score', {timeout:10000}, async () => {
  const server=createArenaServer({port:0}),address=await server.listen(),sockets=[];
  const connect=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`);sockets.push(ws);await once(ws,'open');return ws;};
  const waitFor=(ws,type)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error('Missing '+type));},3000);
    const handler=raw=>{const m=JSON.parse(raw);if(m.type===type){clearTimeout(timer);ws.off('message',handler);resolve(m);}};ws.on('message',handler);
  });
  try {
    const sessions=[];
    for(let i=0;i<4;i++){
      const ws=await connect(),welcome=waitFor(ws,'welcome');
      ws.send(JSON.stringify({type:'quick',mode:0,map:1,duration:600,capacity:4,name:'Friend'+i}));sessions.push(await welcome);
    }
    assert.equal(new Set(sessions.map(s=>s.room)).size,1);
    const room=server.rooms.get(sessions[0].room),returning=sessions[2];
    const actor=room.match.actors[returning.id];actor.kills=6;actor.score=720;actor.deaths=2;
    const closed=once(sockets[2],'close');sockets[2].close();await closed;
    const ws=await connect(),welcome=waitFor(ws,'welcome'),snapshot=waitFor(ws,'snapshot');
    ws.send(JSON.stringify({type:'join',room:returning.room,token:returning.token}));
    assert.equal((await welcome).id,returning.id);
    const snap=await snapshot,own=snap.actors.find(a=>a.id===returning.id);
    assert.equal(snap.actors.filter(a=>a.connected&&!a.bot).length,4);
    assert.deepEqual([own.kills,own.score,own.deaths],[6,720,2]);assert.equal(snap.duration,300);
  }finally{for(const ws of sockets)ws.terminate();await server.close();}
});

await test('global chat is bounded, identifies senders and rate limits without dropping sockets', {timeout:10000},async()=>{
 const server=createArenaServer({port:0}),address=await server.listen(),sockets=[];
 const wait=(ws,type)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',handler);reject(Error(type));},2500);const handler=raw=>{const m=JSON.parse(raw);if(m.type===type){clearTimeout(timer);ws.off('message',handler);resolve(m);}};ws.on('message',handler);});
 try{
  for(const name of ['One','Two']){const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`);sockets.push(ws);await once(ws,'open');const ready=wait(ws,'chat-ready');ws.send(JSON.stringify({type:'chat-hello',name}));await ready;}
  const received=wait(sockets[1],'chat');sockets[0].send(JSON.stringify({type:'chat',channel:'global',text:'x'.repeat(200),name:'spoof'}));const message=await received;assert.equal(message.name,'One');assert.equal(message.text.length,160);
  const limited=wait(sockets[0],'chat-error');sockets[0].send(JSON.stringify({type:'chat',channel:'global',text:'again'}));await limited;assert.equal(sockets[0].readyState,1);
 }finally{sockets.forEach(s=>s.terminate());await server.close();}
});
await test('third character is selectable online and invalid variants are rejected',()=>{
 const r=new Room(0,0,undefined,{staging:true}),a=r.join('Third',undefined,Date.now(),1,2);
 assert.equal(r.match.actors[a.id].operator,2);r.lobbyChange(a.token,{operator:1});r.lobbyChange(a.token,{operator:2});assert.equal(r.snapshot(a.token).actors.find(p=>p.id===a.id).operator,2);assert.throws(()=>r.lobbyChange(a.token,{operator:9}));
});
await test('match and team chat never leak into other rooms or opposing teams', {timeout:10000},async()=>{
 const server=createArenaServer({port:0}),address=await server.listen(),clients=[];
 const connect=async options=>{const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`),entry={ws,messages:[],id:0,room:''};clients.push(entry);await once(ws,'open');const welcome=new Promise(resolve=>ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'){entry.id=m.id;entry.room=m.room;resolve(m);}if(m.type==='chat')entry.messages.push(m);}));ws.send(JSON.stringify(options));await welcome;return entry;};
 try{
  const a=await connect({type:'create',name:'A',mode:2,map:0});await connect({type:'join',name:'B',room:a.room});await connect({type:'join',name:'C',room:a.room});await connect({type:'create',name:'Other',mode:0,map:0});
  a.ws.send(JSON.stringify({type:'chat',channel:'team',text:'private'}));await new Promise(r=>setTimeout(r,100));
  const room=server.rooms.get(a.room),team=room.match.actors[a.id].team;
  for(const c of clients)assert.equal(c.messages.length,c.room===a.room&&room.match.actors[c.id].team===team?1:0);
 }finally{clients.forEach(c=>c.ws.terminate());await server.close();}
});

await test('Dune and Skirmish rooms expose their matching shared arena and protocol',()=>{
 for(const map of [0,2]){
  const room=new Room(0,map,undefined,{public:true,capacity:4});const player=room.join('Explorer');
  const state=room.snapshot(player.token);assert.equal(state.map,map);assert.equal(state.protocol,ROOM_PROTOCOL);
  assert.equal(room.match.map.width,map===0?72:60);assert.equal(room.match.map.name,map===0?'DUNE':'CELL I');
  for(const a of room.match.actors)assert.ok(!room.match.map.blocks.some(b=>Math.abs(a.pos.x-b.x)<b.w/2+.33&&Math.abs(a.pos.z-b.z)<b.d/2+.33&&b.y-b.h/2<a.pos.y+1.85&&b.y+b.h/2>a.pos.y+.01));
 }
 assert.throws(()=>new Room(0,4));
});

await test('new Snow and CELL II are selectable online with shared geometry',()=>{
 for(const map of [1,3]){const room=new Room(2,map,undefined,{botFill:true});const a=room.join('A'),b=room.join('B');assert.equal(room.snapshot(a.token).map,map);assert.equal(room.snapshot(b.token).protocol,ROOM_PROTOCOL);assert.equal(room.match.map.name,map===1?'SNOW':'CELL II');}
});

await test('public rotation preserves sessions and loadouts and skips undersized team modes',()=>{
 const r=new Room(0,0,undefined,{public:true,capacity:6});const people=Array.from({length:5},(_,i)=>r.join('P'+i,undefined,1000,i%3));
 const old=r.roundId;r.match.ended=true;r.finishedAt=1000;r.step(9001);
 assert.notEqual(r.roundId,old);assert.equal(r.mode,3);assert.equal(r.map,1);assert.equal(r.slots.size,5);
 for(const [i,p] of people.entries()){const s=r.snapshot(p.token);assert.equal(s.state,'playing');assert.equal(s.actors.find(a=>a.id===s.you).name,'P'+i);assert.equal(s.actors.find(a=>a.id===s.you).primary,i%3);assert.equal(s.actors.find(a=>a.id===s.you).kills,0);assert.equal(s.actors.find(a=>a.id===s.you).life,1);}
 r.disconnect(people[0].token,9002);const resumed=r.join('ignored',people[0].token,9003);assert.equal(resumed.token,people[0].token);
 const privateRoom=new Room(0,0);privateRoom.join('Host');privateRoom.match.ended=true;assert.equal(privateRoom.rotatePublic(),false);
});
await test('small public parties cycle FFA, 2v2 and 3v3 with all bot skills',()=>{
 const r=new Room(0,0,undefined,{public:true,capacity:6});r.join('A');r.join('B');
 assert.equal(new Set(r.match.actors.filter(a=>a.bot).map(a=>a.botDifficulty)).size,3);
 for(const mode of [2,3,0]){r.match.ended=true;r.rotatePublic();assert.equal(r.mode,mode);assert.equal(r.match.actors.length,r.capacity);assert.equal(r.slots.size,2);}
});

await test('full global room spills into another room without splitting existing players', {timeout:10000}, async()=>{
 const server=createArenaServer({port:0}),address=await server.listen(),sockets=[],sessions=[];
 try{for(let i=0;i<7;i++){
  const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`);sockets.push(ws);await once(ws,'open');
  const welcome=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('welcome timeout')),2000);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'){clearTimeout(timer);resolve(m);}});});
  ws.send(JSON.stringify({type:'quick',name:'Q'+i,mode:i%4,map:i%4}));sessions.push(await welcome);
 }assert.ok(sessions.slice(0,6).every(s=>s.room===sessions[0].room));assert.notEqual(sessions[6].room,sessions[0].room);
 }finally{for(const ws of sockets)ws.terminate();await server.close();}
});

await test('new outfits and bounded cosmetic IDs survive multiplayer snapshots and reconnects',()=>{
 const room=new Room(0,0,undefined,{botFill:true,staging:true});
 const one=room.join('Sable',undefined,1000,1,3,[6,6,6,6]);
 const two=room.join('Flint',undefined,1000,2,4,[999,-1,'6',6]);
 room.lobbyChange(one.token,{operator:4,primary:2});
 const state=room.snapshot(two.token),actor=state.actors.find(a=>a.id===one.id);
 assert.equal(actor.operator,4);assert.equal(actor.primary,2);assert.deepEqual(actor.weaponFinishes,[6,6,6,6]);
 assert.deepEqual(state.actors.find(a=>a.id===two.id).weaponFinishes,[0,0,0,6]);
 room.disconnect(one.token,2000);room.join('ignored',one.token,3000);
 assert.deepEqual(room.match.actors[one.id].weaponFinishes,[6,6,6,6]);
 assert.throws(()=>room.lobbyChange(one.token,{operator:5}),/character/);
});

await test('custom room directory only reveals live listed human rooms',()=>{
 const room=new Room(0,1,undefined,{staging:true,capacity:4,botFill:true});
 assert.equal(room.listing(),null);
 const host=room.join('Host'),guest=room.join('Guest');
 assert.deepEqual({...room.listing(),room:'CODE'},{room:'CODE',name:'Host',map:1,mode:0,humans:2,capacity:4,available:2,locked:false,state:'waiting',duration:300,fragLimit:20});
 room.disconnect(host.token);assert.equal(room.listing().name,'Guest');assert.equal(room.listing().humans,1);assert.equal(room.listing().available,2);
 room.listed=false;assert.equal(room.listing(),null);room.listed=true;room.disconnect(guest.token);assert.equal(room.listing(),null);
 const publicRoom=new Room(0,0,undefined,{public:true});publicRoom.join('Human');assert.equal(publicRoom.listing().humans,1);assert.equal(publicRoom.listing().name,`ARENA ${publicRoom.code}`);
});
await test('password storage is salted, listings reveal no secret, kick is host-only and revokes reconnect',async()=>{
 const room=new Room(0,0,undefined,{staging:true,botFill:true});await room.setPassword('friends only');
 assert.equal(await room.checkPassword('wrong'),false);assert.equal(await room.checkPassword('friends only'),true);
 const host=room.join('Host'),guest=room.join('Guest');
 assert.equal(room.listing().locked,true);assert.ok(!JSON.stringify(room.listing()).includes('friends only'));
 assert.ok(!JSON.stringify(room.snapshot(host.token)).includes('password'));
 assert.throws(()=>room.kick(guest.token,host.id),/host/);assert.throws(()=>room.kick(host.token,host.id),/another/);
 assert.equal(room.kick(host.token,guest.id),guest.token);assert.equal(room.slots.size,1);assert.equal(room.match.actors[guest.id].bot,true);
 assert.throws(()=>room.join('Guest',guest.token),/Session/);
 await assert.rejects(room.setPassword('x'.repeat(65)),/Password/);
});
await test('real sockets browse, enforce passwords, reject non-host kicks and notify a kicked player', {timeout:15000},async()=>{
 const server=createArenaServer({port:0}),address=await server.listen(),sockets=[];
 const socket=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${address.port}/play`);sockets.push(ws);await once(ws,'open');return ws;};
 const message=(ws,type)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',listener);reject(Error('Missing '+type));},4000);const listener=raw=>{const m=JSON.parse(raw);if(m.type===type){clearTimeout(timer);ws.off('message',listener);resolve(m);}};ws.on('message',listener);});
 try{
  const host=await socket(),welcome=message(host,'welcome');host.send(JSON.stringify({type:'create',name:'HOST',mode:0,map:1,password:'secret',staging:true}));const h=await welcome;
  const browser=await socket(),list=message(browser,'rooms');browser.send(JSON.stringify({type:'rooms'}));const directory=await list;
  assert.equal(directory.rooms.length,1);assert.equal(directory.rooms[0].locked,true);
  const bad=await socket(),denied=message(bad,'error');bad.send(JSON.stringify({type:'join',room:h.room,name:'BAD',password:'no'}));assert.match((await denied).message,/password/);
  assert.equal(server.rooms.get(h.room).slots.size,1);
  const guest=await socket(),joined=message(guest,'welcome');guest.send(JSON.stringify({type:'join',room:h.room,name:'GUEST',password:'secret'}));const g=await joined;
  const forbidden=message(guest,'lobby-error');guest.send(JSON.stringify({type:'kick',id:h.id}));assert.match((await forbidden).message,/host/);
  const kicked=message(guest,'kicked');host.send(JSON.stringify({type:'kick',id:g.id}));assert.equal((await kicked).message,'Removed by host');assert.equal(server.rooms.get(h.room).slots.size,1);
 }finally{for(const ws of sockets)ws.terminate();await server.close();}
});

await test('custom countdown freezes match and rejects input; disconnect cancels and requires readiness again',()=>{
 const r=new Room(1,0,undefined,{staging:true}),a=r.join('A'),b=r.join('B');
 r.lobbyChange(a.token,{ready:true});r.lobbyChange(b.token,{ready:true});r.startMatch(a.token);
 assert.equal(r.snapshot(a.token).countdown,3);assert.equal(r.snapshot(a.token).staging,true);assert.equal(r.input(a.token,message(1)),false);
 const time=r.match.time;for(let i=0;i<120;i++)r.step();assert.equal(r.snapshot(a.token).countdown,2);assert.equal(r.match.time,time);
 r.disconnect(b.token);assert.equal(r.startTicks,0);assert.equal(r.started,false);assert.equal(r.slots.get(a.token).ready,false);
 r.join('B',b.token);r.lobbyChange(a.token,{ready:true});r.lobbyChange(b.token,{ready:true});r.startMatch(a.token);
 for(let i=0;i<360;i++)r.step();assert.equal(r.snapshot(a.token).staging,false);assert.equal(r.match.time,time);r.step();assert.ok(r.match.time<time);
});
