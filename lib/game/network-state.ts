import { RemoteBuffer } from './remote-buffer.js';
import { WeaponFeedback, type Feedback } from './weapon-feedback.js';
import {
  Match,
  moveActor,
  emptyInput,
  type Actor,
  type Input,
  type GameEvent,
} from './core.js';
export const ROOM_PROTOCOL = 18;
export type WireActor = Omit<Actor, 'ai'> & {
  life: number;
  connected: boolean;
  ready?: boolean;
};
export type InputFrame = Input & {
  viewTick?: number;
  seq: number;
  yaw: number;
  pitch: number;
  life: number;
};
export type RoomSnapshot = {
  roundId?: string;
  nextRound?: {mode:number;map:number;seconds:number}|null;
  staging?: boolean;
  host?: number | null;
  fragLimit?: number;
  botFill?: boolean;
  difficulty?: string;
  type: 'snapshot';
  protocol: number;
  room: string;
  tick: number;
  you: number;
  ack: number;
  pendingSeq: number;
  remainingSteps: number;
  eventHead: number;
  state: 'waiting' | 'playing' | 'ended';
  mode: 0 | 1 | 2 | 3;
  map: number;
  time: number;
  duration?: number;
  capacity?: number;
  elapsed: number;
  teams: number[];
  outcome: 'victory' | 'defeat' | 'draw' | null;
  actors: WireActor[];
  events: (GameEvent & { eventId: number })[];
};
/** Keep the existing presentation's local actor at zero, without changing server IDs. */
export const localId = (id: number, you: number) =>
  id === you ? 0 : id === 0 ? you : id;
export function predictMovement(
  a: Actor,
  input: Input,
  map: Match['map'],
  steps = 2,
  yaw = a.yaw,
) {
  if (!a.alive) return;
  const originalYaw = a.yaw;
  a.yaw = yaw;
  for (let i = 0; i < steps; i++) {
    a.slide = Math.max(0, a.slide - 1 / 120);
    a.slideCooldown = Math.max(0, a.slideCooldown - 1 / 120);
    moveActor(a, input, 1 / 120, map);
  }
  a.yaw = originalYaw;
}
function move(match: Match, frame: InputFrame, steps = 2) {
  predictMovement(
    match.player,
    frame,
    match.map,
    steps,
    frame.yaw + match.player.recoilYaw,
  );
}
export class NetworkState {
  remote = new RemoteBuffer();
  match: Match;
  feedback: WeaponFeedback;
  feedbackEvents: Feedback[] = [];
  you: number;
  active = new Set<number>();
  targets = new Map<number, WireActor>();
  history: InputFrame[] = [];
  seq = 0;
  eventCursor = -1;
  life = -1;
  lastTick = -1;
  state: RoomSnapshot['state'] = 'waiting';
  constructor(snapshot: RoomSnapshot) {
    this.you = snapshot.you;
    this.match = new Match(snapshot.mode, snapshot.map, 7, 'dummy');
    this.match.manualRespawns = true;
    for (const a of this.match.actors) {
      a.alive = false;
      a.bot = false;
    }
    this.match.events = [];
    this.feedback = new WeaponFeedback(this.match.player);
    this.accept(snapshot, true);
  }
  frame(input: Input): InputFrame {
    const p = this.match.player;
    const frame = {
      ...input,
      seq: ++this.seq,
      yaw: p.yaw - p.recoilYaw,
      pitch: p.pitch - p.recoilPitch,
      life: this.life,
      viewTick: Math.floor(Math.max(0, this.remote.time) * 120),
    };
    this.history.push(frame);
    // A stalled link never grows replay work indefinitely.
    if (this.history.length > 90) this.history.shift();
    if (this.state === 'playing') {
      move(this.match, frame);
      this.feedback.state.slide = p.slide;
      this.feedbackEvents.push(...this.feedback.advance(frame));
    }
    return frame;
  }
  accept(snapshot: RoomSnapshot, initial = false) {
    if (
      snapshot.protocol !== ROOM_PROTOCOL ||
      snapshot.you !== this.you ||
      snapshot.tick < this.lastTick
    )
      return false;
    this.lastTick = snapshot.tick;
    this.state = snapshot.state;
    const own = snapshot.actors.find((a) => a.id === this.you);
    if (!own) return false;
    const p = this.match.player,
      baseYaw = p.yaw - p.recoilYaw,
      basePitch = p.pitch - p.recoilPitch;
    const newLife = initial || own.life !== this.life || own.alive !== p.alive;
    if (newLife) this.history = [];
    this.life = own.life;
    this.active.clear();
    const localTeam = own.team;
    for (const wire of snapshot.actors) {
      const id = localId(wire.id, this.you),
        a = this.match.actors[id];
      if (!a) continue;
      this.active.add(id);
      const team = snapshot.mode >= 2 ? (wire.team === localTeam ? 0 : 1) : id;
      if (
        id === 0 ||
        initial ||
        !a.alive ||
        !wire.alive ||
        this.targets.get(id)?.life !== wire.life
      ) {
        Object.assign(a, wire, {
          id,
          team,
          pos: { ...wire.pos },
          vel: { ...wire.vel },
          ammo: [...wire.ammo],
        });
      } else {
        const pos = a.pos,
          yaw = a.yaw,
          pitch = a.pitch;
        Object.assign(a, wire, {
          id,
          team,
          pos,
          yaw,
          pitch,
          vel: { ...wire.vel },
          ammo: [...wire.ammo],
        });
      }
      this.targets.set(id, wire);
      if (id !== 0) this.remote.accept(id, { ...a, ...wire }, snapshot.elapsed);
    }
    for (const a of this.match.actors)
      if (!this.active.has(a.id)) {
        a.alive = false;
        this.targets.delete(a.id);
        this.remote.poses.delete(a.id);
      }
    this.history = this.history.filter(
      (f) => f.seq > snapshot.ack && f.life === this.life,
    );
    if (snapshot.state === 'playing' && p.alive)
      for (const frame of this.history) {
        move(
          this.match,
          frame,
          frame.seq === snapshot.pendingSeq ? snapshot.remainingSteps : 2,
        );
      }
    if (!newLife) {
      p.yaw = baseYaw + p.recoilYaw;
      p.pitch = Math.max(-1.48, Math.min(1.48, basePitch + p.recoilPitch));
    }
    this.feedback.reconcile({ ...p, ...own }, this.life, this.history, snapshot.pendingSeq, snapshot.remainingSteps);
    this.match.fragLimit = snapshot.fragLimit ?? 20;
    this.match.time = snapshot.time;
    this.match.duration = snapshot.duration ?? 300;
    this.match.elapsed = snapshot.elapsed;
    this.match.ended = snapshot.state === 'ended';
    this.match.pendingSpawn = !p.alive && !this.match.ended;
    this.match.teams =
      snapshot.mode >= 2 && localTeam === 1
        ? [...snapshot.teams].reverse()
        : [...snapshot.teams];
    this.match.winner =
      snapshot.outcome === 'victory'
        ? 'YOU WIN'
        : snapshot.outcome === 'defeat'
          ? 'DEFEAT'
          : snapshot.outcome === 'draw'
            ? 'DRAW'
            : '';
    if (this.eventCursor < 0) this.eventCursor = snapshot.eventHead;
    else
      for (const event of snapshot.events)
        if (event.eventId > this.eventCursor) {
          this.match.events.push({
            ...event,
            actor: localId(event.actor, this.you),
            target:
              event.target === undefined
                ? undefined
                : localId(event.target, this.you),
          });
          this.eventCursor = event.eventId;
        }
    return true;
  }
  interpolate(dt: number) {
    this.remote.advance(dt);
    for (const id of this.targets.keys()) if (id !== 0) this.remote.apply(id, this.match.actors[id]);
  }
  neutral() {
    return this.frame(emptyInput());
  }
}
