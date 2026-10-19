// The overlay's stage: a full-screen transparent PixiJS canvas over the desktop, the phosphor spirits, and the
// layers everything else lives on. Scenes add per-frame updaters and summon spirits as puppets.

import { createPhosphor, CFG } from "./phosphor.js";
import { clamp, loadImage, reducedMotion } from "./util.js";

const SPRITES = "../../../assets/sprites/";
const KEYS = ["marl", "past", "present", "yet"];

async function loadTextures() {
  const T = {}, spawn = {};
  const jobs = [];
  for (const k of KEYS) {
    for (const part of ["body", "head", "normal"]) jobs.push(loadImage(`${SPRITES}layers/${k}_${part}.webp`).then((i) => (T[`${k}_${part}`] = PIXI.Texture.from(i))));
    jobs.push(loadImage(`${SPRITES}${k}_glow.webp`).then((i) => (T[`${k}_glow`] = PIXI.Texture.from(i))));
    jobs.push(fetch(`${SPRITES}${k}_spawn.json`).then((r) => r.json()).then((j) => (spawn[k] = j)));
  }
  for (const [key, file] of [["stone", "stone.webp"], ["stone_normal", "layers/stone_normal.webp"], ["link", "link.webp"], ["edge", "edge.webp"], ["lock", "padlock.webp"]]) {
    jobs.push(loadImage(SPRITES + file).then((i) => (T[key] = PIXI.Texture.from(i))));
  }
  await Promise.all(jobs);
  return { T, spawn };
}

/** A spirit on the stage: springs towards where it's sent (or wanders near home), bobs, leans, glitches round. */
export class Puppet {
  constructor(stage, key, { home = [0.5, 0.58], height = 0.56, wander = [0.1, 0.04], flip = false, facing = 1, alpha = 0 } = {}) {
    this.stage = stage;
    this.key = key;
    this.sp = stage.sys.spirit(key);
    this.c = CFG[key];
    this.home = home;
    this.height = height;
    this.wander = wander;
    this.flip = flip;
    this.sp.s.facing = facing;
    this.sp.s.alpha = alpha;
    this.target = null;            // [x, y] in pixels, or null to wander near home
    this.k = 5; this.d = 3;        // spring
    this.extraY = 0;
    this.M = { x: stage.W * home[0], y: stage.H * home[1], vx: 0, vy: 0, lean: 0 };
    this.fade = null;
    this.t0 = Math.random() * 50;
    stage.sys.spirits.addChild(this.sp.root);
  }

  get h() { return this.stage.H * this.height; }
  get s() { return this.sp.s; }

  moveTo(x, y, k = 5, d = 3) { this.target = [x, y]; this.k = k; this.d = d; }
  roam() { this.target = null; this.k = 5; this.d = 3; }
  jump(x, y) { this.M.x = x; this.M.y = y; this.M.vx = this.M.vy = 0; }

  fadeTo(alpha, seconds = 1) { this.fade = { from: this.s.alpha, to: alpha, t: 0, dur: Math.max(0.01, seconds) }; }

  update(t, dt) {
    const { W, H } = this.stage, M = this.M, S = this.s, reduced = this.stage.reduced;
    if (this.fade) {
      this.fade.t += dt;
      const k = clamp(this.fade.t / this.fade.dur);
      S.alpha = this.fade.from + (this.fade.to - this.fade.from) * k;
      if (k >= 1) this.fade = null;
    }
    let tx, ty;
    if (this.target) [tx, ty] = this.target;
    else {
      const s = (t + this.t0) * 0.9;
      tx = W * (this.home[0] + (reduced ? 0 : this.wander[0] * (Math.sin(s * 0.16) + 0.5 * Math.sin(s * 0.37 + 1.2)) / 1.5));
      ty = H * (this.home[1] + (reduced ? 0 : this.wander[1] * Math.sin(s * 0.27)));
    }
    M.vx += (this.k * (tx - M.x) - this.d * M.vx) * dt;
    M.vy += (this.k * (ty - M.y) - this.d * M.vy) * dt;
    M.x += M.vx * dt; M.y += M.vy * dt;
    const bob = reduced ? 0 : Math.sin(t * 1.2 * this.c.m.speed) * 6 * (this.key === "yet" ? 0.3 : 1) * (this.h / 600) + S.laugh * 5 * Math.abs(Math.sin(t * 9));
    if (this.flip && !reduced) {
      const want = M.vx > 30 ? -1 : M.vx < -30 ? 1 : S.facing;
      if (want !== S.facing && !this.turning) {
        this.turning = true; this.stage.glitch(0.26);
        setTimeout(() => { S.facing *= -1; }, 120);
        setTimeout(() => { this.turning = false; }, 260);
      }
    }
    this.sp.place(M.x, M.y + bob + this.extraY, this.h, S.facing);
    M.lean += (clamp(M.vx / 900, -0.14, 0.14) - M.lean) * Math.min(1, dt * 4);
    this.sp.root.rotation = reduced ? 0 : M.lean;
    S.vx = M.vx;
    S.look = { x: this.stage.ptr.x, y: this.stage.ptr.y };
    this.sp.update(t, dt);
  }

  /** A point just above the head (Past: above the halo), for speech cards. */
  headTop() { return this.sp.bodyToWorld(this.c.w * 0.45, this.key === "past" ? -90 : -14); }
  /** Rough on-screen box, for hit testing while the overlay lets clicks through. */
  bounds() {
    const a = this.sp.bodyToWorld(0, 0), b = this.sp.bodyToWorld(this.c.w, this.c.h);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }
  centre() { return this.sp.bodyToWorld(this.c.w / 2, this.c.h * 0.45); }

  remove() {
    this.stage.sys.spirits.removeChild(this.sp.root);
    this.stage.puppets.delete(this);
  }
}

export async function createStage(host) {
  const W = innerWidth, H = innerHeight;
  const app = new PIXI.Application({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: devicePixelRatio || 1, autoDensity: true, powerPreference: "high-performance" });
  host.appendChild(app.view);
  const { T, spawn } = await loadTextures();

  const stage = {
    app, T, W, H,
    reduced: reducedMotion(),
    ptr: { x: W * 0.5, y: H * 0.4, seen: false, history: [] },
    puppets: new Set(),
    updaters: new Set(),     // per scene: cleared between scenes
    always: new Set(),       // for the life of the overlay (the dialogue)
    ramp: "marl",
    focus: null,
    glowStrength: 1,
    layers: {}
  };

  // bottom to top: your desktop (during a visit), the darkness, the stone, the spirits' monitor, icons, effects, cursor
  const L = stage.layers;
  for (const name of ["backdrop", "dim", "iconsBack", "stone", "ghosts", "iconsFront", "fx", "cursor"]) { L[name] = new PIXI.Container(); app.stage.addChild(L[name]); }
  const dim = new PIXI.Graphics().beginFill(0x000000).drawRect(0, 0, W, H).endFill();
  dim.alpha = 0; L.dim.addChild(dim); stage.dim = dim;

  let sys = createPhosphor(app, T, { W, H, cell: 3, spawn });
  L.ghosts.addChild(sys.output);
  stage.sys = sys;

  /** Match a new window size. Windows creates the hidden overlay clamped to the work area, then it grows on show. */
  stage.resize = (w = innerWidth, h = innerHeight) => {
    if (w === stage.W && h === stage.H) return;
    stage.W = w; stage.H = h;
    app.renderer.resize(w, h);
    dim.clear().beginFill(0x000000).drawRect(0, 0, w, h).endFill();
    if (stage.puppets.size) return;   // mid-scene: keep the spirits' buffers as they are
    const fog = sys.fog;
    L.ghosts.removeChild(sys.output);
    sys.output.destroy({ children: true });
    sys = stage.sys = createPhosphor(app, T, { W: w, H: h, cell: 3, spawn });
    sys.fog = fog;
    L.ghosts.addChild(sys.output);
  };
  addEventListener("resize", () => stage.resize());

  stage.summon = (key, opts) => { const p = new Puppet(stage, key, opts); stage.puppets.add(p); return p; };
  stage.glitch = (seconds = 0.3, amount = 0.8) => {
    if (stage.reduced) return;
    stage.sys.glitch = amount;
    clearTimeout(stage.glitchTimer);
    stage.glitchTimer = setTimeout(() => (stage.sys.glitch = 0), seconds * 1000);
  };
  stage.setCellFor = (spiritHeight) => stage.sys.setCell(clamp(Math.round(3 * spiritHeight / 650), 2, 8));
  stage.add = (fn) => { stage.updaters.add(fn); return () => stage.updaters.delete(fn); };
  stage.addAlways = (fn) => { stage.always.add(fn); return () => stage.always.delete(fn); };
  stage.clear = () => {
    const sys = stage.sys;
    for (const p of [...stage.puppets]) p.remove();
    stage.updaters.clear();
    sys.clearParticles();
    for (const name of ["backdrop", "iconsBack", "stone", "iconsFront", "fx", "cursor"]) L[name].removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const c of [...L.dim.children]) if (c !== dim) { L.dim.removeChild(c); c.destroy(); }
    for (const c of [...sys.world.children]) if (c !== sys.particles && c !== sys.spirits) { sys.world.removeChild(c); c.destroy({ children: true }); }
    sys.glitch = 0;
    dim.alpha = 0;
    stage.focus = null;
  };

  // the pointer: a candle that lights the spirits, and the eyes follow it
  const onMove = (e) => {
    stage.ptr.x = e.clientX; stage.ptr.y = e.clientY; stage.ptr.seen = true;
  };
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", onMove, { passive: true });

  let t = 0;
  app.ticker.add(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
    t += dt;
    const P = stage.ptr;
    P.history.push({ t, x: P.x, y: P.y });
    while (P.history.length && P.history[0].t < t - 1.2) P.history.shift();
    const sys = stage.sys;
    sys.light.x = P.x; sys.light.y = P.y; sys.light.z = stage.ramp === "yet" ? 160 : 260;
    for (const fn of stage.always) fn(t, dt);
    for (const fn of stage.updaters) fn(t, dt);
    for (const p of stage.puppets) p.update(t, dt);
    const lead = [...stage.puppets].at(-1);
    const focus = stage.focus ?? (lead ? { x: lead.M.x, y: lead.M.y + lead.h * 0.25, r: lead.h } : null);
    sys.frame(t, dt, stage.ramp, { focus, pool: focus ? 1 : 0, bloom: 0.42 * stage.glowStrength });
  });
  stage.time = () => t;
  /** Where the pointer was `seconds` ago (for the doppelgänger cursor). */
  stage.pointerAgo = (seconds) => {
    const h = stage.ptr.history, want = t - seconds;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= want) return h[i];
    return h[0] || stage.ptr;
  };
  return stage;
}
