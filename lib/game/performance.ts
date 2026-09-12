export type FrameReport = {
  samples: number;
  seconds: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  averageFps: number;
  over33Ms: number;
};
/** Bounded, local-only frame samples. Pauses and menu frames are never submitted. */
export class FrameStats {
  values: number[] = [];
  cursor = 0;
  record(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const ms = seconds * 1000;
    if (this.values.length < 3600) this.values.push(ms);
    else {
      this.values[this.cursor] = ms;
      this.cursor = (this.cursor + 1) % 3600;
    }
  }
  reset() {
    this.values = [];
    this.cursor = 0;
  }
  report(): FrameReport {
    const sorted = [...this.values].sort((a, b) => a - b),
      n = sorted.length;
    const quantile = (q: number) =>
      sorted[Math.max(0, Math.ceil(n * q) - 1)] ?? 0;
    const seconds = sorted.reduce((a, b) => a + b, 0) / 1000;
    return {
      samples: n,
      seconds,
      medianMs: quantile(0.5),
      p95Ms: quantile(0.95),
      p99Ms: quantile(0.99),
      averageFps: seconds ? n / seconds : 0,
      over33Ms: sorted.filter((ms) => ms > 33.34).length,
    };
  }
}
