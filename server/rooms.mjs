import { ROOM_PROTOCOL } from '../.server-build/network-state.js';
import { LagHistory } from './lag-history.mjs';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const deriveKey = promisify(scrypt);
import { Match, emptyInput } from '../.server-build/core.js';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function sanitizeInput(message) {
  if (!message || !Number.isSafeInteger(message.seq) || message.seq < 0)
    throw new Error('Invalid sequence');
  for (const key of ['forward', 'right', 'yaw', 'pitch'])
    if (typeof message[key] !== 'number' || !Number.isFinite(message[key]))
      throw new Error(`Invalid ${key}`);
  const input = emptyInput();
  input.forward = clamp(message.forward, -1, 1);
  input.right = clamp(message.right, -1, 1);
  for (const key of ['jump', 'slide', 'crouch', 'fire', 'ads', 'reload'])
    input[key] = message[key] === true;
  input.weapon = [-1, 0, 1, 2, 3].includes(message.weapon)
    ? message.weapon
    : -1;
  return {
    viewTick: Number.isSafeInteger(message.viewTick) && message.viewTick >= 0 ? message.viewTick : undefined,
    seq: message.seq,
    input,
    yaw: ((message.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: clamp(message.pitch, -1.48, 1.48),
  };
}
export class Room {
  constructor(
    mode = 0,
    map = 0,
    code = randomBytes(3).toString('hex').toUpperCase(),
    options = {},
  ) {
    if (![0, 1, 2, 3].includes(mode) || ![0, 1, 2, 3].includes(map))
      throw new Error('Invalid room settings');
    this.code = code;
    this.roundId=randomBytes(12).toString('hex');
    this.mode = mode;
    this.map = map;
    const duration = options.duration ?? 300;
    const capacity = mode === 0 ? (options.capacity ?? 8) : [8, 2, 4, 6][mode];
    if (![60, 180, 300, 600].includes(duration) || ![2, 4, 6, 8].includes(capacity)) throw new Error('Invalid duration or player count');
    const fragLimit = options.fragLimit ?? 20;
    const difficulty = options.difficulty ?? 'casual';
    if (![10,20,30,50,100].includes(fragLimit) || !['dummy','casual','normal','hard'].includes(difficulty)) throw new Error('Invalid score or bot skill');
    this.staging = options.staging === true;
    this.started = !this.staging;
    this.hostToken = null;
    this.botFill = options.public === true || options.botFill === true;
    this.difficulty = difficulty;
    this.capacity = capacity;
    this.public = options.public === true;
    this.listed = options.listed !== false;
    this.passwordHash = null;
    this.passwordSalt = null;
    this.match = new Match(mode, map, capacity - 1, this.botFill ? difficulty : 'dummy');
    this.match.fragLimit = fragLimit;
    this.match.time = this.match.duration = duration;
    this.match.manualRespawns = true;
    this.match.remoteInputs = new Map();
    this.slots = new Map();
    this.tickId = 0;
    this.lagHistory = new LagHistory();
    this.stepMs = 0;
    this.match.rewindPose = (target, shooter) => {
      const slot = [...this.slots.values()].find(slot => slot.id === shooter.id);
      return this.lagHistory.pose(target, slot?.current?.viewTick, this.tickId);
    };
    this.lastActive = Date.now();
    this.finishedAt = 0;
    this.eventHead = 0;
    this.eventLog = [];
    for (const a of this.match.actors) {
      a.bot = false;
      a.alive = false;
      a.respawn = Infinity;
      if (this.botFill) this.fillBot(a);
    }
  }
  async setPassword(value = '') {
    if (typeof value !== 'string' || value.length > 64) throw new Error('Password must be at most 64 characters');
    if (!value) return;
    this.passwordSalt = randomBytes(16);
    this.passwordHash = await deriveKey(value, this.passwordSalt, 32);
  }
  async checkPassword(value = '') {
    if (!this.passwordHash) return true;
    if (typeof value !== 'string' || value.length > 64) return false;
    return timingSafeEqual(this.passwordHash, await deriveKey(value, this.passwordSalt, 32));
  }
  listing() {
    const connected = [...this.slots.values()].filter(s => s.connected);
    if (this.public || !this.listed || !connected.length) return null;
    const host = this.slots.get(this.hostToken);
    return {room:this.code, name:host ? this.match.actors[host.id].name : 'LOBBY',
      map:this.map, mode:this.mode, humans:connected.length, capacity:this.capacity,
      available:this.capacity-this.slots.size, locked:!!this.passwordHash,
      state:this.match.ended?'ended':this.started?'playing':'waiting',
      duration:this.match.duration, fragLimit:this.match.fragLimit};
  }
  kick(token, id) {
    if (this.public || token !== this.hostToken || !this.slots.get(token)?.connected) throw new Error('Only the host can remove players');
    const target = [...this.slots].find(([,s]) => s.id === id);
    if (!target || target[0] === token) throw new Error('Choose another player');
    this.slots.delete(target[0]);
    this.match.remoteInputs.delete(id);
    const actor = this.match.actors[id];
    actor.alive = false; actor.respawn = Infinity;
    if (this.botFill) this.fillBot(actor);
    return target[0];
  }
  fillBot(actor) {
    actor.bot = true;
    actor.weaponFinishes=[0,0,0,0];
    actor.botDifficulty=this.public?['casual','normal','hard'][actor.id%3]:this.difficulty;
    actor.name = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'][actor.id];
    actor.operator = this.mode >= 2 ? actor.team : actor.id % 2;
    actor.primary = actor.id % 3;
    actor.kills = actor.deaths = actor.score = actor.headshots = actor.hits = actor.shots = actor.meleeKills = 0;
    this.match.remoteInputs.delete(actor.id);
    this.match.spawn(actor, true);
  }
  join(name, token, now = Date.now(), primary = 1, operator = 0, weaponFinishes = []) {
    if (token) {
      const slot = this.slots.get(token);
      if (!slot || now - slot.lastSeen > 120000 || slot.connected)
        throw new Error('Session unavailable');
      slot.connected = true;
      if (!this.hostToken) this.hostToken = token;
      slot.lastSeen = now;
      slot.seq = -1;
      slot.ack = -1;
      slot.queue = [];
      slot.current = null;
      slot.remaining = 0;
      slot.lastInput = now;
      this.lastActive = now;
      return { token, id: slot.id };
    }
    if (this.match.ended) throw new Error('Round ended');
    const occupied = new Set([...this.slots.values()].map((s) => s.id));
    const a = this.match.actors.find((a) => !occupied.has(a.id));
    if (!a) throw new Error('Room full');
    token = randomBytes(24).toString('hex');
    a.bot = false;
    a.name =
      String(name ?? 'PLAYER')
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .slice(0, 16) || 'PLAYER';
    a.kills =
      a.deaths =
      a.score =
      a.headshots =
      a.hits =
      a.shots =
      a.meleeKills =
        0;
    a.primary = [0, 1, 2].includes(primary) ? primary : 1;
    a.operator = this.mode >= 2 ? a.team : [0,1,2,3,4].includes(operator) ? operator : 0;
    a.weaponFinishes=Array.from({length:4},(_,i)=>Array.isArray(weaponFinishes)&&Number.isInteger(weaponFinishes[i])&&weaponFinishes[i]>=0&&weaponFinishes[i]<=6?weaponFinishes[i]:0);
    this.match.spawn(a, true);
    this.match.remoteInputs.set(a.id, emptyInput());
    if (!this.hostToken) this.hostToken = token;
    this.slots.set(token, {
      ready: false,
      id: a.id,
      connected: true,
      seq: -1,
      ack: -1,
      life: 0,
      queue: [],
      current: null,
      remaining: 0,
      lastSeen: now,
      lastInput: now,
    });
    this.lastActive = now;
    return { token, id: a.id };
  }
  lobbyChange(token, change) {
    const slot = this.slots.get(token);
    if (!slot?.connected || !this.staging || this.started) throw new Error('Lobby is not editable');
    const a = this.match.actors[slot.id];
    if (change.primary !== undefined && ![0,1,2].includes(change.primary)) throw new Error('Invalid weapon');
    if (change.operator !== undefined && ![0,1,2,3,4].includes(change.operator)) throw new Error('Invalid character');
    if (change.primary !== undefined || change.operator !== undefined) {
      if (change.primary !== undefined) a.primary = a.weapon = change.primary;
      if (change.operator !== undefined) a.operator = this.mode >= 2 ? a.team : change.operator;
      slot.ready = false;
    }
    if (typeof change.ready === 'boolean') slot.ready = change.ready;
    return true;
  }
  rematch(token) {
    if(this.public || token!==this.hostToken || !this.match.ended) throw new Error('Only the host can reopen a finished private match');
    const m=this.match;
    this.roundId=randomBytes(12).toString('hex');
    m.ended=false;m.time=m.duration;m.elapsed=0;m.teams=[0,0];m.winner='';m.pendingSpawn=false;m.events=[];
    m.recentSpawns=[];m.recentDeaths=[];this.finishedAt=0;this.started=false;this.staging=true;this.lagHistory=new LagHistory();this.eventLog=[];
    for(const a of m.actors){a.kills=a.deaths=a.score=a.headshots=a.hits=a.shots=a.meleeKills=a.streak=0;if(a.bot)m.spawn(a,true);}
    for(const slot of this.slots.values()){
      slot.life++;slot.ready=false;slot.seq=-1;slot.ack=-1;slot.queue=[];slot.current=null;slot.remaining=0;
      m.remoteInputs.set(slot.id,emptyInput());m.spawn(m.actors[slot.id],true);
      if(!slot.connected)m.actors[slot.id].alive=false;
    }
    return true;
  }
  nextPublicSettings(){
    const modes=[0,2,3],start=modes.indexOf(this.mode);
    let mode=modes[(start+1)%modes.length];
    if(mode===2&&this.slots.size>4)mode=3;
    return {mode,map:(this.map+1)%2};
  }
  rotatePublic(now=Date.now()){
    if(!this.public||!this.match.ended)return false;
    const {mode,map}=this.nextPublicSettings(),previous=this.match;
    const saved=[...this.slots].map(([token,slot])=>({token,slot,actor:previous.actors[slot.id]}));
    this.mode=mode;this.map=map;this.capacity=mode===2?4:6;
    const next=new Match(mode,map,this.capacity-1,'normal');
    next.manualRespawns=true;next.remoteInputs=new Map();next.rewindPose=previous.rewindPose;
    next.duration=next.time=300;next.fragLimit=30;this.match=next;
    this.roundId=randomBytes(12).toString('hex');this.finishedAt=0;this.eventLog=[];this.lagHistory=new LagHistory();
    for(const actor of next.actors)this.fillBot(actor);
    saved.forEach(({slot,actor},id)=>{
      slot.id=id;slot.life++;slot.seq=slot.ack=-1;slot.queue=[];slot.current=null;slot.remaining=0;slot.lastInput=now;
      const a=next.actors[id];a.bot=false;a.name=actor.name;a.primary=actor.primary;a.weaponFinishes=actor.weaponFinishes?.slice();a.operator=mode>=2?a.team:actor.operator;
      next.spawn(a,true);if(!slot.connected)a.alive=false;
      next.remoteInputs.set(id,emptyInput());
    });
    return true;
  }
  startMatch(token) {
    if (token !== this.hostToken || !this.staging || this.started) throw new Error('Only the host can start this lobby');
    const connected = [...this.slots.values()].filter(s => s.connected);
    if (connected.some(s => !s.ready)) throw new Error('Waiting for players to ready up');
    if (!this.botFill && connected.length < 2) throw new Error('At least two players are required');
    for (const slot of this.slots.values()) {
      slot.queue=[];slot.current=null;slot.remaining=0;
      if (!slot.connected) { this.match.actors[slot.id].alive=false; continue; }
      this.match.spawn(this.match.actors[slot.id],true);
    }
    this.started = true;
    return true;
  }
  input(token, message, now = Date.now()) {
    const slot = this.slots.get(token);
    if (!slot?.connected) throw new Error('Join first');
    if (!this.started) return false;
    const accepted = sanitizeInput(message);
    if (accepted.seq <= slot.seq) return false;
    if (message.life !== undefined && message.life !== slot.life) return false;
    // Retire stale unsimulated input after packet bursts; never disconnect for congestion.
    // Acknowledgement advances only when a retained frame is actually simulated.
    if(slot.queue.length>=6){slot.droppedInputs=(slot.droppedInputs??0)+slot.queue.length-3;slot.queue.splice(0,slot.queue.length-3);}
    slot.seq = accepted.seq;
    slot.lastInput = slot.lastSeen = now;
    slot.queue.push(accepted);
    return true;
  }
  deploy(token, primary) {
    const slot = this.slots.get(token),
      a = slot && this.match.actors[slot.id];
    if (
      !slot?.connected ||
      !a ||
      a.alive ||
      a.respawn > 0 ||
      this.match.ended ||
      ![0, 1, 2].includes(primary)
    )
      return false;
    a.primary = primary;
    slot.life++;
    slot.queue = [];
    slot.current = null;
    slot.remaining = 0;
    this.match.remoteInputs.set(slot.id, emptyInput());
    this.match.spawn(a);
    if (a.id === 0) this.match.pendingSpawn = false;
    return true;
  }
  disconnect(token, now = Date.now()) {
    const slot = this.slots.get(token);
    if (!slot) return;
    slot.connected = false;
    slot.ready = false;
    if (this.hostToken === token) this.hostToken = [...this.slots].find(([key,s]) => key !== token && s.connected)?.[0] ?? null;
    slot.lastSeen = now;
    slot.queue = [];
    slot.current = null;
    slot.remaining = 0;
    this.match.remoteInputs.set(slot.id, emptyInput());
  }
  step(now = Date.now()) {
    for (const [token, slot] of this.slots) {
      if (!slot.connected && now - slot.lastSeen > 120000) {
        const a = this.match.actors[slot.id];
        a.alive = false;
        a.respawn = Infinity;
        this.slots.delete(token);
        this.match.remoteInputs.delete(slot.id);
        if (this.botFill && !this.match.ended) this.fillBot(a);
      } else if (now - slot.lastInput > 250) {
        slot.queue = [];
        slot.current = null;
        slot.remaining = 0;
        this.match.remoteInputs.set(slot.id, emptyInput());
      }
    }
    const connected = [...this.slots.values()].filter(
      (s) => s.connected,
    ).length;
    if (this.started && connected >= (this.botFill ? 1 : 2) && !this.match.ended) {
      for (const slot of this.slots.values()) {
        if (!slot.connected) continue;
        if (slot.remaining === 0 && slot.queue.length) {
          const frame = slot.queue.shift();
          slot.current = frame;
          slot.remaining = 2;
          const a = this.match.actors[slot.id];
          a.yaw = frame.yaw + a.recoilYaw;
          a.pitch = clamp(frame.pitch + a.recoilPitch, -1.48, 1.48);
          this.match.remoteInputs.set(slot.id, { ...frame.input });
        }
      }
      const stepStart = performance.now();
      this.lagHistory.record(this.tickId, this.match.actors);
      const eventStart = this.match.events.length;
      this.match.step(1 / 120, emptyInput());
      for (const event of this.match.events.slice(eventStart)) {
        const source = [...this.slots.values()].find(slot => slot.id === event.actor);
        if (source?.current) { event.inputSeq = source.current.seq; event.life = source.life; }
      }
      for (const slot of this.slots.values())
        if (slot.remaining > 0) {
          slot.remaining--;
          if (slot.remaining === 0) slot.ack = slot.current.seq;
        }
      this.tickId++;
      this.stepMs = performance.now() - stepStart;
      for (const input of this.match.remoteInputs.values()) {
        input.reload = false;
        input.weapon = -1;
      }
      if (this.match.ended) this.finishedAt = now;
    }
    for (const event of this.match.events.splice(0))
      this.eventLog.push({ ...event, eventId: ++this.eventHead });
    if (this.eventLog.length > 256)
      this.eventLog.splice(0, this.eventLog.length - 256);
    if (connected > 0) this.lastActive = now;
    if(this.public&&connected>0&&this.match.ended&&now-this.finishedAt>=8000)this.rotatePublic(now);
  }
  snapshot(token) {
    const slot = this.slots.get(token),
      ids = new Set([...this.slots.values()].map((s) => s.id));
    let winnerId = null,
      winnerTeam = null,
      outcome = null;
    if (this.match.ended) {
      if (this.mode >= 2) {
        const [a, b] = this.match.teams;
        winnerTeam = a === b ? null : a > b ? 0 : 1;
        outcome =
          winnerTeam === null
            ? 'draw'
            : this.match.actors[slot?.id]?.team === winnerTeam
              ? 'victory'
              : 'defeat';
      } else {
        const ranked = [...this.match.actors].sort((a, b) => b.kills - a.kills);
        winnerId = ranked[0].kills === ranked[1]?.kills ? null : ranked[0].id;
        outcome =
          winnerId === null
            ? 'draw'
            : slot?.id === winnerId
              ? 'victory'
              : 'defeat';
      }
    }
    return {
      type: 'snapshot',
      roundId:this.roundId,
      nextRound:this.public&&this.match.ended?{...this.nextPublicSettings(),seconds:Math.max(0,Math.ceil((this.finishedAt+8000-Date.now())/1000))}:null,
      protocol: ROOM_PROTOCOL,
      staging: this.staging && !this.started,
      host: this.slots.get(this.hostToken)?.id ?? null,
      fragLimit: this.match.fragLimit,
      botFill: this.botFill,
      difficulty: this.difficulty,
      room: this.code,
      tick: this.tickId,
      you: slot?.id,
      ack: slot?.ack ?? -1,
      serverStepMs: this.stepMs,
      queuedInputs: slot?.queue.length ?? 0,
      droppedInputs: slot?.droppedInputs ?? 0,
      pendingSeq: slot?.remaining ? slot.current.seq : -1,
      remainingSteps: slot?.remaining ?? 0,
      eventHead: this.eventHead,
      state: this.match.ended
        ? 'ended'
        : !this.started || [...this.slots.values()].filter((s) => s.connected).length < (this.botFill ? 1 : 2)
          ? 'waiting'
          : 'playing',
      mode: this.mode,
      map: this.map,
      time: this.match.time,
      duration: this.match.duration,
      capacity: this.capacity,
      public: this.public,
      elapsed: this.match.elapsed,
      teams: this.match.teams,
      winnerId,
      winnerTeam,
      outcome,
      actors: this.match.actors
        .filter((a) => ids.has(a.id) || (this.botFill && a.bot))
        .map((a) => {
          const { ai: _ai, ...actor } = a;
          const connection = [...this.slots.values()].find(
            (s) => s.id === a.id,
          );
          return {
            ...actor,
            pos: { ...actor.pos },
            vel: { ...actor.vel },
            ammo: [...actor.ammo],
            respawn: Number.isFinite(actor.respawn) ? actor.respawn : 0,
            life: connection?.life ?? 0,
            connected: connection?.connected ?? false,
            ready: connection?.ready ?? false,
          };
        }),
      events: this.eventLog,
    };
  }
}
