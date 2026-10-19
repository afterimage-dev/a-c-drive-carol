// Every sound is synthesised here: no samples, nothing to license. Quiet by default, and silent if sound is off.
// Recipes follow trailer/soundtrack.py (bell, clinks, wind, grind, birdsong) so the app and the trailer match.

const rnd = (a, b) => a + Math.random() * (b - a);

export class Sound {
  constructor() {
    this.ac = null;
    this.enabled = true;
    this.volume = 0.5;
    this.loops = {};
  }

  configure({ sound, volume }) {
    this.enabled = sound !== false;
    if (typeof volume === "number") this.volume = volume;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ac.currentTime, 0.1);
  }

  ensure() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return this.ac; }
    const ac = this.ac = new AudioContext();
    this.master = ac.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(ac.destination);
    // a generated room: a decaying noise impulse for reverb
    const len = ac.sampleRate * 3.2, imp = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = imp.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ac.createConvolver(); this.verb.buffer = imp;
    this.verbIn = ac.createGain(); this.verbIn.gain.value = 0.5;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    return ac;
  }

  /** An output bus: dry to the master, `send` to the reverb, panned. */
  out(gain = 1, pan = 0, send = 0.3) {
    const ac = this.ensure();
    const g = ac.createGain(); g.gain.value = gain;
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    const s = ac.createGain(); s.gain.value = send;
    g.connect(p); p.connect(this.master); p.connect(s); s.connect(this.verbIn);
    return g;
  }

  noiseSource(loop = false) {
    const src = this.ac.createBufferSource(); src.buffer = this.noise; src.loop = loop;
    return src;
  }

  band(lo, hi) {
    const f = this.ac.createBiquadFilter(); f.type = "bandpass";
    f.frequency.value = Math.sqrt(lo * hi); f.Q.value = Math.sqrt(lo * hi) / (hi - lo);
    return f;
  }

  /** One deep bell: the hour has struck. */
  bell(gain = 0.32) {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime + 0.02, out = this.out(gain, 0, 0.75), base = 98;
    for (const [r, a, d] of [[0.5, 0.9, 7], [1, 1, 5], [1.19, 0.6, 3.4], [1.56, 0.5, 2.6], [2, 0.55, 2.2], [2.51, 0.35, 1.6], [2.66, 0.3, 1.4], [3.01, 0.25, 1.1], [4.1, 0.2, 0.7]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = base * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.16, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.6);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d * 1.6 + 0.1);
    }
    const n = this.noiseSource(), f = this.band(1500, 6000), g = ac.createGain();
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.05);
  }

  /** A single chain clink: four inharmonic partials and a tick. */
  clink(strength = 0.6, pan = 0, send = 0.45, when = 0) {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime + when, out = this.out(0.04 + 0.32 * Math.pow(strength, 1.2), pan, send);
    const f = rnd(1100, 2600);
    for (const [m, a, d] of [[1, 1, 0.16], [2.76, 0.55, 0.11], [5.4, 0.32, 0.07], [8.93, 0.18, 0.045]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * m * rnd(0.995, 1.005);
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * (0.7 + strength * 0.6));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.1);
    }
    const n = this.noiseSource(), bp = this.band(3500, 7000), g = ac.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.03);
  }

  /** A chain rattling: near, or far off in another room. */
  rattle({ count = 7, spread = 1.1, strength = 0.6, pan = 0.4, far = false } = {}) {
    if (!this.enabled) return;
    for (let k = 0; k < count; k++) this.clink(strength * rnd(0.5, 1) * (far ? 0.35 : 1), pan + rnd(-0.15, 0.15), far ? 0.9 : 0.45, Math.random() * spread);
  }

  /** A chain dragging along the floor; `level` 0..1, call every frame or on change. */
  scrape(level) {
    if (!this.enabled && !this.loops.scrape) return;
    this.ensure();
    if (!this.loops.scrape) {
      const src = this.noiseSource(true), bp = this.band(1200, 2400), g = this.ac.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(this.out(1, 0.3, 0.4)); src.start();
      this.loops.scrape = g;
    }
    this.loops.scrape.gain.setTargetAtTime(Math.min(0.25, level) * (this.enabled ? 1 : 0), this.ac.currentTime, 0.06);
  }

  /** Low wind for the last spirit. */
  wind(on) {
    this.ensure();
    if (on && !this.loops.wind && this.enabled) {
      const ac = this.ac, src = this.noiseSource(true), a = this.band(300, 900), b = this.band(900, 2200), g = ac.createGain(), mix = ac.createGain();
      mix.gain.value = 0; src.connect(a); src.connect(b); a.connect(g); b.connect(g); g.gain.value = 0.6; g.connect(mix);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.21; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(mix.gain);
      mix.connect(this.out(1, -0.2, 0.5)); src.start(); lfo.start();
      mix.gain.setTargetAtTime(0.09, ac.currentTime, 1.2);
      this.loops.wind = { mix, src, lfo };
    } else if (!on && this.loops.wind) {
      const w = this.loops.wind, t = this.ac.currentTime;
      w.mix.gain.setTargetAtTime(0, t, 0.6); w.src.stop(t + 3); w.lfo.stop(t + 3);
      this.loops.wind = null;
    }
  }

  /** The chisel: one short grind per carved letter. */
  grind() {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime, out = this.out(0.18, -0.15, 0.25);
    for (const [lo, hi, a] of [[1800, 4200, 1], [300, 800, 0.4]]) {
      const n = this.noiseSource(), f = this.band(lo, hi), g = ac.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.1);
    }
  }

  /** A short digital tear, for glitches. */
  glitch(dur = 0.18) {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime, out = this.out(0.06, rnd(-0.4, 0.4), 0.1);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "square"; o.frequency.setValueAtTime(rnd(80, 220), t); o.frequency.linearRampToValueAtTime(rnd(600, 1400), t + dur);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  /** Air rushing: a spirit arriving or leaving. */
  whoosh(dur = 1.4, gain = 0.1) {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime, out = this.out(gain, rnd(-0.3, 0.3), 0.6);
    const n = this.noiseSource(true), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = "bandpass"; f.Q.value = 0.9; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05);
  }

  /** Morning birdsong, for a while. */
  birds(seconds = 14) {
    if (!this.enabled) return;
    const ac = this.ensure(), t0 = ac.currentTime + 0.3;
    for (let t = 0.2; t < seconds - 0.4; t += rnd(0.6, 2)) {
      const n = 2 + Math.floor(Math.random() * 4), f0 = rnd(2600, 4400), out = this.out(0.05, rnd(-0.8, 0.8), 0.4);
      for (let k = 0; k < n; k++) {
        const d = rnd(0.05, 0.12), at = t0 + t + k * (d + 0.03), o = ac.createOscillator(), g = ac.createGain();
        const f = f0 * (1 + 0.04 * k);
        o.frequency.setValueAtTime(f, at); o.frequency.linearRampToValueAtTime(f * 1.35, at + d / 2); o.frequency.linearRampToValueAtTime(f, at + d);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + d / 2); g.gain.linearRampToValueAtTime(0, at + d);
        o.connect(g); g.connect(out); o.start(at); o.stop(at + d + 0.02);
      }
    }
  }

  /** The stone breaking. */
  crack() {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime, out = this.out(0.3, 0, 0.5);
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
    for (let k = 0; k < 6; k++) setTimeout(() => this.grind(), k * 60 + Math.random() * 40);
  }

  stopAll() {
    this.scrape(0);
    this.wind(false);
  }
}
