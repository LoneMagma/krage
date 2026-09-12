/** Hold crouches; release stands. A second press within 300 ms requests one slide. */
export class CrouchControl {
  active = false;
  held = false;
  lastTap = -Infinity;
  slideRequested = false;
  press(now: number) {
    if (this.held) return;
    this.held = true;
    if (now - this.lastTap <= 300) {
      this.active = false;
      this.slideRequested = true;
      this.lastTap = -Infinity;
    } else {
      this.active = true;
      this.lastTap = now;
    }
  }
  release() {
    this.active = false;
    this.held = false;
  }
  consumeSlide() {
    const requested = this.slideRequested;
    this.slideRequested = false;
    return requested;
  }
  reset() {
    this.active = this.held = this.slideRequested = false;
    this.lastTap = -Infinity;
  }
}
export const BINDABLE_KEYS = [
  'ShiftLeft',
  'ControlLeft',
  'KeyC',
  'KeyV',
  'AltLeft',
] as const;
export const keyLabel = (code: string) =>
  ({
    ShiftLeft: 'SHIFT',
    ControlLeft: 'CTRL',
    KeyC: 'C',
    KeyV: 'V',
    AltLeft: 'ALT',
  })[code] ?? code;

export function boundKey(code: string, bindings: Record<string, string> = {}) {
  const normalized = code === 'ShiftRight' ? 'ShiftLeft' : code === 'ControlRight' ? 'ControlLeft' : code;
  return Object.keys(bindings).find(key => bindings[key] === normalized) ?? (bindings[normalized] && bindings[normalized] !== normalized ? 'Unbound' : normalized);
}

export class CaptureGuard {
  generation=0;
  pending=false;
  begin(){this.pending=true;return ++this.generation;}
  settle(id:number){if(id!==this.generation||!this.pending)return false;this.pending=false;return true;}
  cancel(){this.pending=false;this.generation++;}
}
export function respawnShortcut(code:string,repeat:boolean){return !repeat&&(code==='Space'||code==='Enter');}
