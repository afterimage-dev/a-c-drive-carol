// Haunting your actual desktop. At the bell a picture of the screen becomes the visit's backdrop (in memory only),
// so it can dim, flicker like candlelight, warp like breath on glass, and frost over from the edges.
// Without a picture (capture failed) the overlay just darkens the live desktop.

import { clamp } from "./util.js";

function noiseTexture(size = 256, blobs = 120) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "rgb(128,128,128)"; g.fillRect(0, 0, size, size);
  g.filter = "blur(10px)";
  for (let i = 0; i < blobs; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 10 + Math.random() * 40;
    g.fillStyle = `rgba(${(Math.random() * 255) | 0},${(Math.random() * 255) | 0},128,0.35)`;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); }
  }
  const t = PIXI.Texture.from(c); t.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
  return t;
}

/** Frost: ice crystals growing in from the edges; `reach` is how far in (0..1 of the half-screen). */
function frostTexture(W, H, reach, seed) {
  const s = 0.5, w = Math.ceil(W * s), h = Math.ceil(H * s);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.62 - reach * 0.35), w / 2, h / 2, Math.hypot(w, h) / 2);
  edge.addColorStop(0, "rgba(220,240,255,0)"); edge.addColorStop(1, "rgba(220,240,255,0.55)");
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(235,248,255,0.5)"; g.lineCap = "round";
  const branch = (x, y, a, len, depth) => {
    if (depth <= 0 || len < 2) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = Math.max(0.5, depth * 0.45);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    branch(x2, y2, a + (rnd() - 0.5) * 0.5, len * 0.82, depth - 1);
    if (rnd() < 0.55) branch(x2, y2, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.5), len * 0.55, depth - 2);
  };
  const n = 140;
  for (let i = 0; i < n; i++) {
    const side = i % 4;
    const along = rnd();
    const [x, y, a] = side === 0 ? [along * w, 0, Math.PI / 2] : side === 1 ? [along * w, h, -Math.PI / 2] : side === 2 ? [0, along * h, 0] : [w, along * h, Math.PI];
    branch(x, y, a + (rnd() - 0.5) * 1.2, (10 + rnd() * 26) * (0.4 + reach), 6);
  }
  return PIXI.Texture.from(c);
}

function edgeTexture(W, H) {
  const c = document.createElement("canvas"); c.width = 256; c.height = Math.round(256 * H / W);
  const g = c.getContext("2d"), w = c.width, h = c.height;
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) / 2);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return PIXI.Texture.from(c);
}

export class Backdrop {
  constructor(stage) {
    this.stage = stage;
    this.sprite = null;
    this.level = { dim: 0, frost: 0, warp: 0, flicker: 0, drain: 0 };
    this.target = { ...this.level };
    this.rate = { dim: 1, frost: 0.05, warp: 0.3, flicker: 1, drain: 0.05 };
    this.off = stage.add((t, dt) => this.update(t, dt));
  }

  async show(bytes) {
    const { W, H, layers } = this.stage;
    if (bytes) {
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }).catch(() => null);
      URL.revokeObjectURL(url);
      if (img.naturalWidth) {
        this.sprite = new PIXI.Sprite(PIXI.Texture.from(img));
        this.sprite.width = W; this.sprite.height = H;
        this.colour = new PIXI.ColorMatrixFilter();
        this.noise = new PIXI.Sprite(noiseTexture()); this.noise.renderable = false;
        this.noise.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        this.noise.scale.set(Math.max(W, H) / 256 / 1.5);
        this.warpFilter = new PIXI.DisplacementFilter(this.noise, 0);
        this.warpFilter.resolution = 0.5;
        this.sprite.filters = this.stage.reduced ? [this.colour] : [this.warpFilter, this.colour];
        layers.backdrop.addChild(this.sprite, this.noise);
      }
    }
    this.frost = [0.25, 0.6, 1].map((reach, i) => {
      const s = new PIXI.Sprite(frostTexture(W, H, reach, 17 + i * 31)); s.width = W; s.height = H; s.alpha = 0; s.tint = 0xdff4ff;
      layers.backdrop.addChild(s); return s;
    });
  }

  /** Ease towards these levels: dim (0..1 darkness), frost (0..1), warp (pixels), flicker (0..1). */
  set(levels, rates = {}) { Object.assign(this.target, levels); Object.assign(this.rate, rates); }

  update(t, dt) {
    for (const k of Object.keys(this.level)) {
      const r = this.rate[k] ?? 1;
      const d = this.target[k] - this.level[k];
      this.level[k] += clamp(d, -r * dt, r * dt);
    }
    const L = this.level;
    const flick = L.flicker * (0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1) + 0.04 * Math.sin(t * 23.1));
    this.stage.dim.alpha = clamp(L.dim + flick, 0, 0.96);
    if (this.warpFilter) {
      this.warpFilter.scale.set(L.warp, L.warp * 0.8);
      this.noise.x = -t * 18; this.noise.y = Math.sin(t * 0.21) * 40;
    }
    if (this.frost) this.frost.forEach((s, i) => { s.alpha = clamp(L.frost * 3 - i) * 0.85; });
    if (this.colour && Math.abs(L.drain - (this.drained ?? 0)) > 0.002) {   // colour drains towards grey, a little cold
      const k = L.drain, a = 1 - k;
      const r = 0.299 * k, g = 0.587 * k, b = 0.114 * k;
      this.colour.matrix = [a + r, g, b, 0, 0, r, a + g, b, 0, 0, r, g, a + b, 0, 0.02 * k, 0, 0, 0, 1, 0];
      this.drained = L.drain;
    }
  }

  remove() {
    this.off();
    this.sprite?.texture.destroy(true);
  }
}

/**
 * Darkness everywhere except a pool round your cursor: your candle is the only light. Drawn each frame into a small
 * full-screen canvas (so it always covers the whole screen, wherever the pool is) and scaled up softly.
 * `radius` is the clear pool in pixels; set `.gutter` (0..1) to make the flame shrink and flicker.
 */
export function darkness(stage, { radius = 190 } = {}) {
  const k = 8, c = document.createElement("canvas");   // one canvas pixel per 8 screen pixels: darkness can be soft
  c.width = Math.ceil(stage.W / k); c.height = Math.ceil(stage.H / k);
  const g = c.getContext("2d");
  const tex = PIXI.Texture.from(c);
  const s = new PIXI.Sprite(tex); s.width = stage.W; s.height = stage.H; s.alpha = 0;
  stage.layers.dim.addChild(s);
  const ctl = { sprite: s, gutter: 0, alpha: 0, target: 1, black: 0 };
  const off = stage.add((t, dt) => {
    ctl.alpha += (ctl.target - ctl.alpha) * Math.min(1, dt * 1.5);
    const flick = stage.reduced ? 0 : ctl.gutter * (0.18 * Math.sin(t * 17) * Math.sin(t * 5.3) + 0.12 * (Math.random() - 0.5));
    const r = radius * (1 - 0.45 * ctl.gutter + flick) / k, x = stage.ptr.x / k, y = stage.ptr.y / k;
    g.globalCompositeOperation = "copy";
    g.fillStyle = "rgba(0,0,0,0.97)"; g.fillRect(0, 0, c.width, c.height);
    if (!ctl.black && stage.ptr.seen) {
      g.globalCompositeOperation = "destination-out";
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.3, "rgba(0,0,0,0.9)"); gr.addColorStop(0.6, "rgba(0,0,0,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
    }
    tex.baseTexture.update();
    s.alpha = Math.min(1, ctl.alpha + ctl.black);
  });
  ctl.stop = () => { off(); stage.layers.dim.removeChild(s); s.destroy({ texture: true, baseTexture: true }); };
  return ctl;
}

/** The cold: the screen's edges tint icy blue for a couple of seconds, then fade. */
export function coldEdges(stage, seconds = 2) {
  const s = new PIXI.Sprite(edgeTexture(stage.W, stage.H));
  s.width = stage.W; s.height = stage.H; s.tint = 0x7fc4ff; s.alpha = 0;
  stage.layers.fx.addChild(s);
  let t = 0;
  return new Promise((resolve) => {
    const off = stage.add((_t, dt) => {
      t += dt;
      const k = t / seconds;
      s.alpha = 0.55 * Math.sin(Math.PI * clamp(k));
      if (k >= 1) { off(); stage.layers.fx.removeChild(s); s.destroy({ texture: true, baseTexture: true }); resolve(); }
    });
  });
}
