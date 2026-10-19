// Every sound is synthesised here: no samples, nothing to license. Quiet by default, and silent if sound is off.
// Recipes follow trailer/soundtrack.py (bell, clinks, wind, grind, birdsong) so the app and the trailer match.

const rnd = (a, b) => a + Math.random() * (b - a);
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Background themes: slow, long tones rather than melodies, one character per spirit. Each chord swells in over a few
// seconds and overlaps the next, so it never quite moves. Yet to Come has none: only the wind.
//   chords: MIDI notes · dur: seconds per chord · wave: oscillator · cutoff: lowpass Hz · sway: a lilting pulse
const THEMES = {
  // Jacob Marlware: cold and low, a minor drone that shifts without resolving
  marl: { chords: [[38, 45, 50, 53], [38, 45, 48, 52], [36, 43, 50, 51], [38, 45, 50, 53]], dur: 11, wave: "sine", wave2: "triangle", cutoff: 900, gain: 0.5, attack: 4, glass: 74 },
  // the Ghost of Downloads Past: melancholy and wistful, minor chords with a bittersweet added note, drifting slowly
  // like a half-remembered afternoon (A minor add 9, F major 7, D minor 9, E minor 7)
  past: { chords: [[45, 52, 59, 60], [41, 48, 57, 64], [38, 50, 53, 57, 64], [40, 47, 55, 59, 62]], dur: 11, wave: "triangle", wave2: "sine", cutoff: 1150, gain: 0.44, attack: 4.5, vibrato: 3.6, glass: 71 },
  // the Ghost of Filesystems Present: jovial, bright major chords on a reedy organ, swaying like a full table
  present: { chords: [[43, 50, 55, 59, 62], [48, 55, 60, 64], [43, 50, 59, 62, 67], [50, 57, 62, 66]], dur: 4.6, wave: "sawtooth", wave2: "triangle", cutoff: 1700, gain: 0.3, attack: 1.2, sway: { rate: 1.35, depth: 0.32 } }
};

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
    if (!this.enabled && this.theme) this.music(null);
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
    // an echo for the chain: a dark, repeating tail that gives it depth and weight
    this.echoIn = ac.createGain(); this.echoIn.gain.value = 1;
    const delay = ac.createDelay(1); delay.delayTime.value = 0.19;
    const fb = ac.createGain(); fb.gain.value = 0.42;
    const dark = ac.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 1400;
    const wet = ac.createGain(); wet.gain.value = 0.5;
    this.echoIn.connect(delay); delay.connect(dark); dark.connect(fb); fb.connect(delay); dark.connect(wet); wet.connect(this.master); wet.connect(this.verbIn);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    return ac;
  }

  /** Development: how loud the output is right now (peak and RMS, 0..1), to check nothing is silent or clipping. */
  level() {
    if (!this.ac) return null;
    if (!this.meter) { this.meter = this.ac.createAnalyser(); this.meter.fftSize = 2048; this.master.connect(this.meter); }
    const d = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(d);
    let peak = 0, sum = 0;
    for (const x of d) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    return { peak, rms: Math.sqrt(sum / d.length), theme: this.theme?.name || "-" };
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

  /**
   * A single clink: four inharmonic partials and a tick. Heavy (Marlware's chain) is an octave lower, rings longer,
   * has a dull iron thud beneath it, and echoes; light (buttons) is small and bright.
   */
  clink(strength = 0.6, pan = 0, send = 0.45, when = 0, { heavy = false } = {}) {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime + when, out = this.out((heavy ? 0.06 : 0.04) + (heavy ? 0.4 : 0.32) * Math.pow(strength, 1.2), pan, heavy ? 0.7 : send);
    if (heavy) { const e = ac.createGain(); e.gain.value = 0.55; out.connect(e); e.connect(this.echoIn); }
    const f = heavy ? rnd(420, 900) : rnd(1100, 2600), ring = heavy ? 2.2 : 1;
    for (const [m, a, d] of [[1, 1, 0.16], [2.76, 0.55, 0.11], [5.4, 0.32, 0.07], [8.93, 0.18, 0.045]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * m * rnd(0.995, 1.005);
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * ring * (0.7 + strength * 0.6));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d * ring * 1.3 + 0.1);
    }
    if (heavy) {   // the weight of it: a short, low knock under the ring
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(rnd(120, 170), t); o.frequency.exponentialRampToValueAtTime(rnd(60, 80), t + 0.16);
      g.gain.setValueAtTime(0.9 * (0.5 + strength * 0.5), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
    }
    const n = this.noiseSource(), bp = this.band(3500, 7000), g = ac.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.03);
  }

  /** A chain rattling: near, or far off in another room. */
  rattle({ count = 7, spread = 1.1, strength = 0.6, pan = 0.4, far = false } = {}) {
    if (!this.enabled) return;
    for (let k = 0; k < count; k++) this.clink(strength * rnd(0.5, 1) * (far ? 0.35 : 1), pan + rnd(-0.15, 0.15), far ? 0.9 : 0.45, Math.random() * spread, { heavy: true });
  }

  /** A chain dragging along the floor; `level` 0..1, call every frame or on change. */
  scrape(level) {
    if (!this.enabled && !this.loops.scrape) return;
    this.ensure();
    if (!this.loops.scrape) {
      const src = this.noiseSource(true), bp = this.band(500, 1300), g = this.ac.createGain(); g.gain.value = 0;   // a low, heavy drag
      src.connect(bp); bp.connect(g); g.connect(this.out(1, 0.3, 0.4)); src.start();
      this.loops.scrape = g;
    }
    this.loops.scrape.gain.setTargetAtTime(Math.min(0.25, level) * (this.enabled ? 1 : 0), this.ac.currentTime, 0.06);
  }

  /** Low wind for the last spirit. `fast` cuts it dead instead of letting it die away. */
  wind(on, { fast = false } = {}) {
    this.ensure();
    if (on && !this.loops.wind && this.enabled) {
      const ac = this.ac, src = this.noiseSource(true), a = this.band(300, 900), b = this.band(900, 2200), g = ac.createGain(), mix = ac.createGain();
      mix.gain.value = 0; src.connect(a); src.connect(b); a.connect(g); b.connect(g); g.gain.value = 0.6; g.connect(mix);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.21; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(mix.gain);
      mix.connect(this.out(1, -0.2, 0.5)); src.start(); lfo.start();
      mix.gain.setTargetAtTime(0.045, ac.currentTime, 1.6);
      this.loops.wind = { mix, src, lfo };
    } else if (!on && this.loops.wind) {
      const w = this.loops.wind, t = this.ac.currentTime, g = w.mix.gain, now = g.value;
      g.cancelScheduledValues(t); g.setValueAtTime(now, t);
      if (fast) { g.linearRampToValueAtTime(now * 1.7, t + 0.3); g.linearRampToValueAtTime(0, t + 0.95); }   // a last gust, sucked away
      else g.setTargetAtTime(0, t, 0.6);
      w.src.stop(t + 3); w.lfo.stop(t + 3);
      this.loops.wind = null;
    }
  }

  /** A heartbeat at `bpm` (lub-dub, low and close), or stop it with 0. Changing bpm while it beats changes its pace. */
  heartbeat(bpm) {
    if (!bpm) { clearTimeout(this.beatTimer); this.beatTimer = null; this.bpm = 0; return; }
    this.bpm = bpm;
    if (this.beatTimer || !this.enabled) return;
    const beat = () => {
      if (!this.bpm) return;
      const ac = this.ensure(), t = ac.currentTime + 0.02, out = this.out(0.5, 0, 0.15);
      for (const [at, f, a] of [[0, 58, 1], [0.17, 50, 0.65]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(f, t + at); o.frequency.exponentialRampToValueAtTime(f * 0.65, t + at + 0.12);
        g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(a, t + at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.2);
        o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + 0.25);
      }
      this.beatTimer = setTimeout(beat, 60000 / this.bpm);
    };
    beat();
  }

  /** One deep thud: something heavy, very close. */
  thud() {
    if (!this.enabled) return;
    const ac = this.ensure(), t = ac.currentTime + 0.02, out = this.out(0.8, 0, 0.55);
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.7);
    const n = this.noiseSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
    f.type = "lowpass"; f.frequency.value = 260;
    ng.gain.setValueAtTime(0.7, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f); f.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.4);
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

  /** Change the background theme ("marl" | "past" | "present" | null), crossfading over a few seconds. */
  music(name, { level = 1 } = {}) {
    if (!this.enabled && name) return;
    if (!name && !this.theme) return;
    if (this.theme?.name === name) { this.theme.bus.gain.setTargetAtTime(this.theme.base * level, this.ac.currentTime, 1.2); return; }
    const ac = this.ensure();
    if (this.theme) {   // let the old one fade away under the new
      const old = this.theme;
      clearTimeout(old.timer);
      old.bus.gain.cancelScheduledValues(ac.currentTime);
      old.bus.gain.setTargetAtTime(0, ac.currentTime, 1.4);
      old.stopAll(ac.currentTime + 7);
      this.theme = null;
    }
    const T = THEMES[name];
    if (!T) return;
    const bus = ac.createGain();
    bus.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = T.cutoff; lp.Q.value = 0.4;
    // the filter breathes slowly, so held chords never sound static
    const breath = ac.createOscillator(), breathDepth = ac.createGain();
    breath.frequency.value = 0.07; breathDepth.gain.value = T.cutoff * 0.25; breath.connect(breathDepth); breathDepth.connect(lp.frequency); breath.start();
    let into = lp;
    const nodes = [breath];
    if (T.sway) {   // a lilting swell and ebb, for the Present
      const sway = ac.createGain(); sway.gain.value = 1 - T.sway.depth;
      const lfo = ac.createOscillator(), d = ac.createGain(); lfo.frequency.value = T.sway.rate; d.gain.value = T.sway.depth;
      lfo.connect(d); d.connect(sway.gain); lfo.start(); nodes.push(lfo);
      sway.connect(lp); into = sway;
    }
    const out = this.out(1, 0, 0.6);
    lp.connect(bus); bus.connect(out);
    const base = T.gain * 0.36;
    bus.gain.setTargetAtTime(base * level, ac.currentTime, 1.6);
    const voices = [];
    const theme = this.theme = {
      name, bus, base, timer: null, i: 0,
      stopAll: (when) => { for (const v of voices) try { v.stop(when); } catch { /* already stopped */ } nodes.forEach((n) => { try { n.stop(when); } catch { /* done */ } }); }
    };
    const play = () => {
      if (this.theme !== theme) return;
      const t = ac.currentTime + 0.05, chord = T.chords[theme.i++ % T.chords.length], len = T.dur + T.attack * 1.6;
      for (const note of chord) {
        for (const [wave, detune, amp] of [[T.wave, -6, 0.6], [T.wave2, 5, 0.5]]) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = wave; o.frequency.value = hz(note); o.detune.value = detune + rnd(-3, 3);
          if (T.vibrato) { const v = ac.createOscillator(), vd = ac.createGain(); v.frequency.value = T.vibrato * rnd(0.9, 1.1); vd.gain.value = 4; v.connect(vd); vd.connect(o.detune); v.start(t); v.stop(t + len + 0.2); voices.push(v); }
          const peak = amp / chord.length * (note < 48 ? 1.2 : 1);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + T.attack); g.gain.setValueAtTime(peak, t + T.dur); g.gain.linearRampToValueAtTime(0, t + len);
          o.connect(g); g.connect(into); o.start(t); o.stop(t + len + 0.1); voices.push(o);
        }
      }
      if (T.glass && theme.i % 2 === 0) {   // now and then a faint high tone, like a finger round a glass
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = hz(T.glass + (theme.i % 4 === 0 ? 0 : 7));
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + T.dur * 0.5); g.gain.linearRampToValueAtTime(0, t + T.dur * 1.2);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + T.dur * 1.2 + 0.1); voices.push(o);
      }
      while (voices.length > 200) voices.shift();
      theme.timer = setTimeout(play, T.dur * 1000);
    };
    play();
  }

  stopAll() {
    this.scrape(0);
    this.wind(false);
    this.heartbeat(0);
    this.music(null);
  }
}
