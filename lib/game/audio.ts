import { type Vec } from './core.js';
export class AudioSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.5;
  voices = 0;
  foot = 0;
  noise: AudioBuffer | null = null;
  samples = new Map<number, AudioBuffer[]>();
  sampleLoad: Promise<void> | null = null;
  sampleAbort = new AbortController();
  sampleIndex = 0;
  effects = new Map<string, AudioBuffer>();
  effectIndex = 0;
  /** Prepared user assets use the same master volume and bounded voice pool. */
  effect(name: string, volume=1, pan=0, rate=1, cutoff=12000) {
    const buffer=this.effects.get(name),ctx=this.ctx;
    if(!buffer||!ctx||!this.master)return false;
    if(this.voices>=48)return true;
    this.voices++;
    const source=ctx.createBufferSource(),gain=ctx.createGain(),stereo=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();
    source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;stereo.pan.value=pan;
    filter.type='lowpass';filter.frequency.value=cutoff;
    source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(this.master);
    source.onended=()=>{this.voices--;source.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect();};
    source.start();return true;
  }
  reward() { if(!this.effect('reward',0.7))this.tone(330,.15,.06,'triangle',440); }
  /** Decode once, outside the fire loop. Failed files keep the synthesized fallback. */
  loadSamples() {
    if (!this.ctx || this.sampleLoad) return this.sampleLoad;
    const ctx = this.ctx;
    const effects=['edge-slash','edge-stab','edge-hit','headshot','kill','slide','victory','defeat','reward','step-0','step-1','step-2','land','hit','click',...['echo','kilo','mica'].flatMap(w=>['open','feed','close'].map(p=>`${w}-reload-${p}`))];
    const decode=async(name:string)=>{
      const response=await fetch(`/audio/v07/${name}.wav`,{signal:this.sampleAbort.signal});
      if(!response.ok)throw new Error(`Audio: ${response.status}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    };
    this.sampleLoad=Promise.allSettled([
      ...[['echo-a','echo-b'],['kilo'],['mica']].map(async(names,weapon)=>{const buffers=await Promise.all(names.map(async name=>{const r=await fetch(`/audio/weapons/${name}.wav`,{signal:this.sampleAbort.signal});if(!r.ok)throw new Error('Weapon audio');return ctx.decodeAudioData(await r.arrayBuffer());}));if(this.ctx===ctx)this.samples.set(weapon,buffers);}),
      ...effects.map(async name=>{const buffer=await decode(name);if(this.ctx===ctx)this.effects.set(name,buffer);}),
    ]).then(()=>{});
    return this.sampleLoad;
  }
  recordedShot(weapon: number, volume: number, pan: number, distance: number, own: boolean) {
    const buffers = this.samples.get(weapon), ctx = this.ctx;
    if (!buffers?.length || !ctx || !this.master) return false;
    if (this.voices >= 40) return true;
    this.voices++;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    const filter = ctx.createBiquadFilter(), stereo = ctx.createStereoPanner();
    source.buffer = buffers[this.sampleIndex++ % buffers.length];
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.035;
    // Minor variation avoids machine-gun repetition without changing fire cadence.
    gain.gain.value = volume * [2.0, 2.1, 2.35][weapon] * (0.96 + Math.random() * 0.04);
    filter.type = 'lowpass';
    filter.frequency.value = own ? 18000 : Math.max(1800, 12000 / (1 + distance * 0.08));
    stereo.pan.value = pan;
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.master);
    source.onended = () => { this.voices--; source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect(); };
    source.start();
    return true;
  }
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 0.3,
        this.ctx.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.loadSamples();
    void this.ctx.resume().catch(() => {});
    this.master!.gain.value = this.volume;
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015);
  }
  tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    end = frequency,
    pan = 0,
    delay = 0,
  ) {
    if (!this.ctx || !this.master || this.voices >= 48) return;
    this.voices++;
    const ctx = this.ctx,
      at = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    stereo.pan.value = pan;
    o.type = type;
    o.frequency.setValueAtTime(frequency, at);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      at + duration,
    );
    g.gain.setValueAtTime(volume, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + duration);
    o.connect(g);
    g.connect(stereo);
    stereo.connect(this.master);
    o.start(at);
    o.stop(at + duration);
    o.onended = () => {
      this.voices--;
      o.disconnect();
      g.disconnect();
      stereo.disconnect();
    };
  }
  burst(duration: number, volume: number, freq: number, pan = 0) {
    if (!this.ctx || !this.master || !this.noise || this.voices >= 48) return;
    this.voices++;
    const c = this.ctx,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      p = c.createStereoPanner();
    source.buffer = this.noise;
    source.playbackRate.value = 0.94 + Math.random() * 0.12;
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    p.pan.value = pan;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(p);
    p.connect(this.master);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      this.voices--;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      p.disconnect();
    };
  }
  shot(weapon: number, source: Vec, listener: Vec, yaw: number, own: boolean, attack?: string) {
    const dx = source.x - listener.x,
      dz = source.z - listener.z,
      d = Math.hypot(dx, dz),
      vol = own ? 0.28 : Math.max(0, 0.25 - d * 0.007);
    if (vol <= 0) return;
    const pan = own
      ? 0
      : Math.max(
          -1,
          Math.min(
            1,
            (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / Math.max(1, d),
          ),
        );
    if (weapon === 3) {
      if(this.effect(attack==='stab'?'edge-stab':'edge-slash',vol*2,pan))return;
      this.burst(attack === 'stab' ? 0.09 : 0.16, vol * 0.65, attack === 'stab' ? 700 : 1500, pan);
      this.tone(attack === 'stab' ? 125 : 190, 0.09, vol * 0.16, 'triangle', 55, pan);
      return;
    }
    if (this.recordedShot(weapon, vol, pan, d, own)) return;
    const brightness = own ? 1 : Math.max(0.35, 1 - d / 60);
    // ECHO: short, bright mechanical snap. KILO: dry crack and low receiver punch.
    // MICA: broad double-barrel blast with a longer low-frequency tail.
    if (weapon === 0) {
      this.burst(0.032, vol * 0.85, 7200 * brightness, pan);
      this.tone(245, 0.055, vol * 0.42, 'square', 95, pan);
      this.tone(1800, 0.022, vol * 0.07, 'triangle', 900, pan, 0.025);
    } else if (weapon === 1) {
      this.burst(0.018, vol * 1.15, 5200 * brightness, pan);
      this.burst(0.13, vol * 0.72, 1850 * brightness, pan);
      this.tone(125, 0.14, vol * 0.85, 'triangle', 42, pan);
      this.tone(720, 0.035, vol * 0.08, 'square', 280, pan, 0.045);
    } else {
      this.burst(0.028, vol * 1.3, 6800 * brightness, pan);
      this.burst(0.28, vol * 1.2, 1250 * brightness, pan);
      this.tone(72, 0.32, vol, 'sine', 27, pan);
      this.tone(155, 0.14, vol * 0.42, 'triangle', 48, pan, 0.025);
    }
  }
  click() {
    if(this.effect('click',0.3))return;
    this.tone(1450, 0.035, 0.065, 'triangle', 850);
    this.tone(700, 0.025, 0.025, 'sine', 520, 0, 0.015);
  }
  hit(head = false) {
    if(this.effect(head?'headshot':'hit',head?0.55:0.3,0,head?0.9:1))return;
    if (head) {
      this.tone(180, 0.13, 0.18, 'triangle', 90);
      this.tone(270, 0.18, 0.1, 'sine', 135, 0, 0.045);
      this.burst(0.055, 0.08, 650);
    } else { this.tone(260,0.05,0.085,'triangle',130); this.burst(0.025,0.035,850); }
  }
  kill(combo = 1) {
    if(this.effect('kill',0.7,0,Math.max(.86,1-(combo-1)*.025)))return;
    if(combo>1)this.tone(165,0.14,0.035,'triangle',82,0,0.12);
    this.tone(130, 0.16, 0.16, 'triangle', 65);
    this.tone(195, 0.20, 0.09, 'sine', 98, 0, 0.065);
  }
  reloadPhase(phase: string, weapon = 1) {
    if(this.effect(`${['echo','kilo','mica'][weapon]}-reload-${phase}`,0.65))return;
    if (phase === 'feed') {
      if (weapon === 2) {
        this.tone(1250, 0.075, 0.07, 'triangle', 550);
        this.tone(1450, 0.075, 0.07, 'triangle', 650, 0, 0.12);
        this.burst(0.07, 0.12, 3200);
      } else {
        this.burst(0.075, 0.14, weapon === 0 ? 4200 : 2100);
        this.tone(weapon === 0 ? 620 : 280, 0.065, 0.075, 'triangle', 130);
      }
    }
    if (phase === 'close') {
      this.burst(weapon === 2 ? 0.12 : 0.055, 0.17, weapon === 2 ? 1100 : 3800);
      this.tone(weapon === 2 ? 180 : weapon === 0 ? 780 : 420, 0.09, 0.08, 'triangle', 100);
      if (weapon !== 2) this.tone(950, 0.035, 0.035, 'square', 480, 0, 0.065);
    }
  }
  reload(weapon = 1) {
    if(this.effect(`${['echo','kilo','mica'][weapon]}-reload-open`,0.65))return;
    this.burst(weapon === 2 ? 0.15 : 0.055, 0.14, weapon === 2 ? 850 : weapon === 0 ? 3500 : 1700);
    this.tone(weapon === 2 ? 190 : weapon === 0 ? 680 : 350, 0.09, 0.07, 'triangle', 100);
    if (weapon === 2) this.tone(1600, 0.09, 0.035, 'sine', 1000, 0, 0.09);
  }
  bladeContact(actor: boolean, stab=false, pan=0, volume=1) {
    if(actor&&this.effect('edge-hit',0.8*volume,pan,stab?.88:1))return;
    this.burst(actor ? 0.12 : 0.055, 0.24*volume, actor ? (stab ? 430 : 850) : 2400, pan);
    this.tone(actor ? 105 : 420, 0.13, 0.13*volume, 'triangle', actor ? 38 : 170, pan);
    if (actor) this.burst(0.035,0.08*volume,1800,pan);
  }
  edgeKill() {
    this.tone(92,0.22,0.12,'sine',38);
    this.tone(138,0.14,0.05,'triangle',62,0,0.045);
    this.burst(0.09,0.065,520);
  }
  jump() {
    this.burst(0.045, 0.045, 1500);
    this.tone(130, 0.055, 0.02, 'sine', 80);
  }
  slide(surface: 'metal' | 'stone') {
    this.burst(.29,.045,surface==='metal'?1150:850);
  }
  spawn() {
    this.tone(300, 0.16, 0.04, 'sine', 620);
  }

  equip(weapon: number) {
    this.burst(0.065, 0.065, weapon === 3 ? 4300 : 1600);
    this.tone(weapon === 3 ? 900 : 240, 0.06, 0.018, 'triangle', 150);
  }
  step(
    surface: 'metal' | 'stone' = 'stone',
    crouch = false,
    pan = 0,
    volume = 1,
  ) {
    const gain = (crouch ? 0.35 : 1) * volume;
    if(this.effect(`step-${this.effectIndex++%3}`,0.39*gain,pan,surface==='metal'?1.06:1))return;
    this.foot = 1 - this.foot;
    this.burst(
      surface === 'metal' ? 0.075 : 0.045,
      0.05 * gain,
      surface === 'metal' ? 2200 : 950,
      pan,
    );
    this.tone(
      surface === 'metal' ? 260 + this.foot * 25 : 95 + this.foot * 10,
      0.045,
      0.028 * gain,
      'sine',
      55,
      pan,
    );
  }
  land(speed: number, metal: boolean) {
    const force = Math.min(1, speed / 12);
    if(this.effect('land',0.8*force,0,.78,metal?2400:1100))return;
    this.burst(0.13, 0.12 * force, metal ? 1700 : 600);
    this.tone(85, 0.1, 0.06 * force, 'sine', 35);
  }
  impact(metal: boolean, pan: number, volume: number) {
    this.burst(metal ? 0.07 : 0.045, volume * 0.045, metal ? 5300 : 1600, pan);
    if (metal) this.tone(1600, 0.07, volume * 0.012, 'sine', 950, pan);
  }
  result(win: boolean) {
    if(this.effect(win?'victory':'defeat',win?0.65:0.38))return;
    const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 311.13, 261.63, 196];
    notes.forEach((note, i) => {
      this.tone(note, i === 3 ? 0.75 : 0.22, 0.13, win ? 'triangle' : 'sine', note, 0, i * 0.16);
    });
    this.tone(win ? 130.81 : 98, 0.9, 0.09, 'sine', win ? 130.81 : 49);
  }
  dispose() {
    this.sampleAbort.abort();
    this.samples.clear();
    this.effects.clear();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
