import { useEffect, useState } from 'react';
import { type Settings } from '@/lib/game/core';
export function KeyBindings({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [conflictName, setConflictName] = useState('');
  const [listening, setListening] = useState<string | null>(null);
  const actions = [['KeyW','Forward'],['KeyS','Back'],['KeyA','Left'],['KeyD','Right'],['Space','Jump'],[settings.crouchKey,'Hold crouch'],[settings.slideKey,'Slide'],['KeyR','Reload'],['Digit1','Primary'],['Digit2','Melee'],['KeyQ','Switch'],['Tab','Scoreboard'],['Mouse0','Fire'],['Mouse2','Aim']];
  useEffect(() => {
    if (!listening) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.code === 'Escape') { setListening(null); return; }
      if (event.repeat || event.metaKey || event.code === 'MetaLeft' || event.code === 'MetaRight') return;
      const code = event.code === 'ShiftRight' ? 'ShiftLeft' : event.code === 'ControlRight' ? 'ControlLeft' : event.code;
      const bindings = { ...settings.bindings };
      const old = bindings[listening] ?? listening;
      const conflict = actions.find(([key]) => key !== listening && (bindings[key] ?? key) === code)?.[0];
      if (conflict && old.startsWith('Mouse')) { setConflictName('KEY IN USE'); return; }
      if (conflict) bindings[conflict] = old;
      bindings[listening] = code;
      onChange({ ...settings, bindings }); setListening(null);
    };
    window.addEventListener('keydown', capture, true);
    return () => window.removeEventListener('keydown', capture, true);
  });
  return <div className="keybinds">{actions.map(([key, label]) => <button key={key} onClick={() => { setListening(key); setConflictName(''); }} aria-pressed={listening === key}><strong>{label}</strong><kbd>{listening === key ? conflictName || 'PRESS KEY' : (settings.bindings?.[key] ?? key).replace('Key','').replace('Digit','').replace('Left','').replace('Mouse0','LMB').replace('Mouse2','RMB')}</kbd></button>)}<button onClick={() => { onChange({ ...settings, bindings: {} }); setListening(null); }}>RESET KEYS</button><span>ESC · pause / cancel binding</span></div>;
}
