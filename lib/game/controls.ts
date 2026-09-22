/** Crouch is a hold action. Sliding has its own independent binding. */
export class CrouchControl {
 active=false;held=false;
 press(_now:number){this.active=this.held=true;}
 release(){this.active=this.held=false;}
 consumeSlide(){return false;}
 reset(){this.active=this.held=false;}
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
