/** Contacts follow magazine insertion and bolt/hinge closure, not animation phase entry. */
export class ReloadCues {
  weapon = -1;
  progress = 0;
  reset() { this.weapon = -1; this.progress = 0; }
  update(weapon: number, remaining: number, duration: number, alive = true): ('feed' | 'close')[] {
    if (!alive || remaining <= 0 || duration <= 0 || weapon > 2) { this.reset(); return []; }
    const progress = Math.max(0, Math.min(1, 1 - remaining / duration));
    if (weapon !== this.weapon || progress < this.progress - .15) { this.weapon = weapon; this.progress = 0; }
    const result: ('feed' | 'close')[] = [];
    for (const [cue, threshold] of [['feed', weapon === 2 ? .58 : .76], ['close', weapon === 2 ? .91 : .86]] as const)
      if (this.progress < threshold && progress >= threshold) result.push(cue);
    this.progress = Math.max(this.progress, progress);
    // After a stalled frame only the latest contact is relevant, never a burst of stale clicks.
    return result.slice(-1);
  }
}
