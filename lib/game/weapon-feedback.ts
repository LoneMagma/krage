import { advanceGunTimers, applyGunRecoil, beginEdge, type EdgeAttack, EQUIP_SECONDS, GUNS, type Actor, type GameEvent } from './core.js';
import type { InputFrame } from './network-state.js';
export type Feedback = { type: 'shot' | 'reload' | 'equip'; weapon: number; attack?: EdgeAttack; seq: number; life: number };
/** Predict only local weapon presentation. No raycasts, damage, rewards or remote state. */
export class WeaponFeedback {
  state: Actor;
  life = -1;
  played = new Set<string>();
  constructor(actor: Actor) { this.state = { ...actor, ammo: [...actor.ammo] }; }
  key(type: string, life: number, seq: number, weapon: number) { return `${type}:${life}:${seq}:${weapon}`; }
  advance(frame: InputFrame, steps = 2, audible = true): Feedback[] {
    const a = this.state, events: Feedback[] = [];
    if (!a.alive || frame.life !== this.life) return events;
    const emit = (type: Feedback['type']) => {
      const key = this.key(type, frame.life, frame.seq, a.weapon);
      if (audible && !this.played.has(key)) { this.played.add(key); events.push({type, attack: a.edgeAttack, weapon: a.weapon, life: frame.life, seq: frame.seq}); }
      while (this.played.size > 256) this.played.delete(this.played.values().next().value!);
    };
    const reload = () => { if (a.weapon !== 3 && a.reload <= 0 && a.ammo[a.weapon] < GUNS[a.weapon].mag) { a.reload = GUNS[a.weapon].reload; emit('reload'); } };
    for (let n = 0; n < steps; n++) {
      advanceGunTimers(a, 1 / 120);
      if ((frame.weapon === a.primary || frame.weapon === 3) && frame.weapon !== a.weapon) {
        a.previousWeapon = a.equip > EQUIP_SECONDS / 2 ? a.previousWeapon : a.weapon;
        a.weapon = frame.weapon; a.equip = EQUIP_SECONDS; a.reload = 0; a.fired = 0;
        a.cooldown = Math.max(a.cooldown, EQUIP_SECONDS); emit('equip');
      }
      if (frame.reload) reload();
      if ((frame.fire || (a.weapon === 3 && frame.ads)) && a.cooldown <= 0 && a.reload <= 0 && a.equip <= 0) {
        if (a.weapon !== 3 && a.ammo[a.weapon] <= 0) reload();
        else {
          if (a.weapon !== 3) a.ammo[a.weapon]--;
          a.cooldown = GUNS[a.weapon].interval; a.fired = 0.12;
          if (a.weapon === 3) beginEdge(a, frame.ads ? 'stab' : 'slash');
          a.burst++; a.shots++; a.crouched = frame.crouch;
          applyGunRecoil(a, frame.ads); emit('shot');
        }
      }
      if (a.weapon !== 3 && a.ammo[a.weapon] === 0 && a.equip <= 0) reload();
    }
    return events;
  }
  reconcile(actor: Actor, life: number, frames: InputFrame[], pendingSeq: number, remainingSteps: number) {
    if (life !== this.life || actor.alive !== this.state.alive) this.played.clear();
    this.life = life;
    this.state = { ...actor, ammo: [...actor.ammo] };
    for (const frame of frames) this.advance(frame, frame.seq === pendingSeq ? remainingSteps : 2, false);
  }
  confirmed(event: GameEvent) {
    return event.inputSeq !== undefined && event.life !== undefined && this.played.has(this.key(event.type, event.life, event.inputSeq, event.weapon ?? -1));
  }
}
