// Marlware's chain: every link simulated (Verlet integration, 480 steps a second), forged from your biggest files.
// Only his hand is moved by code; everything below it is physics. Ported from prototypes/chain/chain.src.html,
// drawn as sprites in the spirits' world so it shows on the same phosphor as he does.

const DT = 1 / 480, ITER = 8;
// Sound: a link only clinks again once it has really moved away from where it last clinked (MIN_TRAVEL link
// pitches, measured as distance, so jitter never adds up), and the whole chain is capped at a few clinks a second.
const MIN_TRAVEL = 1.5, MAX_CLINKS_PER_SECOND = 4;
// Held, a link reaches no further than the chain allows (a little short of taut, so it never stretches); let go,
// no part of it moves faster than this many of his heights a second: it's iron, it drops.
const REACH = 0.98, LET_GO_SPEED = 1;
const HAND = [298, 485];   // his chain hand, in the body sprite's pixels (assets/landmarks.json)
const FILE = { w: 40, h: 50, pad: 9, scale: 3 };

function fileIcon(ext) {
  const s = FILE.scale, P = FILE.pad;
  const c = document.createElement("canvas");
  c.width = (FILE.w + P * 2) * s; c.height = (FILE.h + P * 2) * s;
  const g = c.getContext("2d");
  g.scale(s, s); g.translate(P, P);
  const page = () => { g.beginPath(); g.moveTo(3, 0); g.lineTo(28, 0); g.lineTo(40, 12); g.lineTo(40, 47); g.quadraticCurveTo(40, 50, 37, 50); g.lineTo(3, 50); g.quadraticCurveTo(0, 50, 0, 47); g.lineTo(0, 3); g.quadraticCurveTo(0, 0, 3, 0); g.closePath(); };
  g.lineWidth = 2.4;
  page(); g.fillStyle = "rgba(143,240,238,.18)"; g.fill();
  g.shadowColor = "#8ff0ee"; g.shadowBlur = 7; g.strokeStyle = "#e6fffd"; g.stroke();
  g.beginPath(); g.moveTo(28, 0); g.lineTo(28, 12); g.lineTo(40, 12); g.stroke();
  g.shadowBlur = 4; g.fillStyle = "#ffffff"; g.font = '600 11px "JetBrains Mono", monospace'; g.textAlign = "center";
  g.fillText(ext.slice(0, 5), 20, 36);
  g.beginPath(); g.arc(20, -4.5, 3.4, 0, Math.PI * 2); g.lineWidth = 1.8; g.strokeStyle = "#e6fffd"; g.stroke();
  return PIXI.Texture.from(c);
}

export class Chain {
  /**
   * @param {object} stage
   * @param {import("./stage.js").Puppet} puppet  Marlware
   * @param {object} o  { links, floorY, exts: file extensions for the pendants, sound }
   */
  constructor(stage, puppet, { links = 34, floorY, exts = [".exe", ".zip", ".iso", "(1)"], sound = null, walls = true, trail = -1 } = {}) {
    this.stage = stage;
    this.puppet = puppet;
    this.N = links;
    this.floorY = floorY ?? stage.H;
    this.sound = sound;
    this.walls = walls;   // the screen's sides stop the chain (off when it has to leave the screen)
    this.trail = trail;   // which way the slack lies on the floor at first: -1 left, +1 right (behind him as he enters)
    this.exts = exts.length ? exts : [".tmp"];
    this.view = new PIXI.Container();
    stage.sys.world.addChild(this.view);
    this.grab = { i: -1, len: 0 };
    this.acc = 0;
    this.tmp = { x: 0, y: 0 };
    this.events = [];
    this.snapMax = 0; this.slide = 0;
    this.clinkBudget = MAX_CLINKS_PER_SECOND;
    this.build();
    this.off = stage.add((t, dt) => this.update(dt));
  }

  hand() {
    const sp = this.puppet.sp;
    sp.bodyBend(HAND[0], HAND[1], this.tmp, sp.lastT || 0);
    return sp.bodyToWorld(this.tmp.x, this.tmp.y);
  }

  build() {
    const S = this.S = this.puppet.h;
    const { N } = this;
    // heavy: stronger gravity than a 1.2 m ghost would get, so it drops and drags rather than floats
    this.Lh = S * 0.09; this.P = this.Lh * 0.62; this.Lp = this.Lh * 1.75; this.Fk = (this.Lh * 1.35) / FILE.h; this.g = 13 * S;
    const fileAt = [];
    for (let k = 7; k < N - 3; k += 8) fileAt.push(k);
    const count = this.count = N + 2 + fileAt.length;
    this.X = new Float32Array(count); this.Y = new Float32Array(count); this.PX = new Float32Array(count); this.PY = new Float32Array(count);
    this.IM = new Float32Array(count); this.R = new Float32Array(count);
    this.heardX = new Float32Array(count); this.heardY = new Float32Array(count);   // where each point last made a sound
    const { X, Y, PX, PY, IM, R, P, Lp, Fk } = this;
    const h0 = this.hand(), rc = P * 0.42;
    const place = (i, along) => {
      let y = h0.y + along, x = h0.x;
      if (y > this.floorY - rc) { x += this.trail * (y - (this.floorY - rc)); y = this.floorY - rc; }
      X[i] = PX[i] = Math.max(rc, x); Y[i] = PY[i] = y;
    };
    for (let i = 0; i <= N; i++) { place(i, i * P); IM[i] = i === 0 ? 0 : 1; R[i] = rc; }
    this.pend = [];
    let idx = N + 1;
    place(idx, N * P + Lp * 0.46); IM[idx] = 1 / 7; R[idx] = Lp * 0.36;
    this.pend.push({ i: idx, at: N, kind: "lock", rest: Lp * 0.46 });
    fileAt.forEach((at, n) => {
      idx++;
      const rest = (FILE.h / 2 + 7.9) * Fk;
      X[idx] = PX[idx] = X[at] + 2; Y[idx] = PY[idx] = Y[at] + rest;
      IM[idx] = 1 / 2.5; R[idx] = FILE.h * Fk * 0.36;
      this.pend.push({ i: idx, at, kind: "file", rest, ext: this.exts[n % this.exts.length] });
    });
    this.IM0 = IM.slice();
    const list = [], attachOf = new Map(this.pend.map((p) => [p.i, p.at]));
    for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
      const aa = attachOf.has(a) ? attachOf.get(a) : null, bb = attachOf.has(b) ? attachOf.get(b) : null;
      if (aa === null && bb === null && b - a < 3) continue;
      if (aa === null && bb !== null && Math.abs(a - bb) < 2) continue;
      if (bb === null && aa !== null && Math.abs(b - aa) < 2) continue;
      list.push(a, b);
    }
    this.pairs = new Int32Array(list);
    // sprites: links alternate face-on and edge-on, which reads as 3D
    this.view.removeChildren();
    const T = this.stage.T;
    this.linkSprites = [];
    for (let i = 0; i < N; i++) {
      const tex = i % 2 === 0 ? T.link : T.edge;
      const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.height = this.Lh; s.width = this.Lh * tex.width / tex.height;
      this.view.addChild(s); this.linkSprites.push(s);
    }
    const icons = new Map();
    for (const p of this.pend) {
      let s;
      if (p.kind === "lock") { s = new PIXI.Sprite(T.lock); s.height = Lp; s.width = Lp * T.lock.width / T.lock.height; }
      else { if (!icons.has(p.ext)) icons.set(p.ext, fileIcon(p.ext)); s = new PIXI.Sprite(icons.get(p.ext)); s.width = (FILE.w + FILE.pad * 2) * Fk; s.height = (FILE.h + FILE.pad * 2) * Fk; }
      s.anchor.set(0.5); this.view.addChild(s); p.sprite = s;
    }
    for (let k = 0; k < 1100; k++) this.step(DT, true);   // settle before the first frame
    this.heardX.set(this.X); this.heardY.set(this.Y);
  }

  /** How far point i is from where it last made a sound. */
  moved(i) { return Math.hypot(this.X[i] - this.heardX[i], this.Y[i] - this.heardY[i]); }

  solveMax(a, b, rest) {
    const { X, Y, IM } = this;
    const dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.sqrt(dx * dx + dy * dy);
    if (d <= rest || d === 0) return 0;
    const w = IM[a] + IM[b]; if (!w) return 0;
    const f = (d - rest) / (d * w);
    X[a] += dx * f * IM[a]; Y[a] += dy * f * IM[a]; X[b] -= dx * f * IM[b]; Y[b] -= dy * f * IM[b];
    return d - rest;
  }

  solveMin(a, b, min) {
    const { X, Y, IM } = this;
    const dx = X[b] - X[a], dy = Y[b] - Y[a], d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-4, w = IM[a] + IM[b]; if (!w) return;
    const f = (min - d) / (d * w);
    X[a] -= dx * f * IM[a]; Y[a] -= dy * f * IM[a]; X[b] += dx * f * IM[b]; Y[b] += dy * f * IM[b];
  }

  step(dt, silent) {
    const { X, Y, PX, PY, IM, R, N, P, S, count, pairs } = this;
    const air = Math.exp(-2.2 * dt), gg = this.g * dt * dt, W = this.stage.W, floorY = this.floorY;
    for (let i = 0; i < count; i++) {
      if (IM[i] === 0) continue;
      const vx = (X[i] - PX[i]) * air, vy = (Y[i] - PY[i]) * air;
      PX[i] = X[i]; PY[i] = Y[i]; X[i] += vx; Y[i] += vy + gg;
    }
    const h = this.hand();
    PX[0] = X[0]; PY[0] = Y[0]; X[0] = h.x; Y[0] = h.y;
    if (this.grab.i > 0) {
      const p = this.stage.ptr, g = this.grab.i, dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy), k = d > this.grab.len * REACH ? this.grab.len * REACH / d : 1;
      PX[g] = X[g]; PY[g] = Y[g]; X[g] = h.x + dx * k; Y[g] = h.y + dy * k;
    }
    const minAdj = P * 0.55, minSkip = 2 * P * Math.cos((120 * Math.PI / 180) / 2);
    for (let it = 0; it < ITER; it++) {
      if (it & 1) { for (let i = N - 1; i >= 0; i--) this.solveMax(i, i + 1, P); }
      else { for (let i = 0; i < N; i++) { const s = this.solveMax(i, i + 1, P); if (it === 0 && s > this.snapMax) this.snapMax = s; } }
      for (const p of this.pend) this.solveMax(p.at, p.i, p.rest);
      for (let i = 0; i < N; i++) this.solveMin(i, i + 1, minAdj);
      for (let i = 0; i < N - 1; i++) this.solveMin(i, i + 2, minSkip);
    }
    const thr = 0.55 * S * dt;
    // links only collide with each other near the floor, where they pile up. In the air they pass freely, so a
    // flung chain can never jam into a knot round his hand: it always falls.
    const pileTop = floorY - this.Lh * 3;
    for (let k = 0; k < pairs.length; k += 2) {
      const a = pairs[k], b = pairs[k + 1], rs = R[a] + R[b];
      if (Y[a] < pileTop || Y[b] < pileTop) continue;
      const dx = X[b] - X[a]; if (dx > rs || dx < -rs) continue;
      const dy = Y[b] - Y[a]; if (dy > rs || dy < -rs) continue;
      const d2 = dx * dx + dy * dy; if (d2 >= rs * rs) continue;
      const w = IM[a] + IM[b]; if (!w) continue;
      const d = Math.sqrt(d2) || 1e-4, nx = dx / d, ny = dy / d;
      const rv = ((X[b] - PX[b]) - (X[a] - PX[a])) * nx + ((Y[b] - PY[b]) - (Y[a] - PY[a])) * ny;
      if (!silent && rv < -thr) this.events.push({ s: (-rv / dt) / S, x: X[a], i: this.moved(a) > this.moved(b) ? a : b });
      const f = (rs - d) / w;
      X[a] -= nx * f * IM[a]; Y[a] -= ny * f * IM[a]; X[b] += nx * f * IM[b]; Y[b] += ny * f * IM[b];
      PX[a] += (X[a] - PX[a]) * 0.03 * (IM[a] > 0); PY[a] += (Y[a] - PY[a]) * 0.03 * (IM[a] > 0);
      PX[b] += (X[b] - PX[b]) * 0.03 * (IM[b] > 0); PY[b] += (Y[b] - PY[b]) * 0.03 * (IM[b] > 0);
    }
    const mu = 0.85 * this.g * dt * dt;
    for (let i = 1; i < count; i++) {
      if (IM[i] === 0) continue;
      const r = R[i], lim = floorY - r;
      if (Y[i] >= lim) {
        const vy = Y[i] - PY[i];
        if (!silent && vy > thr) this.events.push({ s: (vy / dt) / S, x: X[i], i });
        Y[i] = lim; PY[i] = lim + vy * 0.1;
        const vx = X[i] - PX[i];
        if (Math.abs(vx) <= mu) PX[i] = X[i]; else PX[i] = X[i] - (vx - Math.sign(vx) * mu);
        this.slide += Math.abs(vx) / dt / S;
      }
      if (!this.walls) continue;
      if (X[i] < r) { const vx = X[i] - PX[i]; X[i] = r; PX[i] = r + vx * 0.3; }
      else if (X[i] > W - r) { const vx = X[i] - PX[i]; X[i] = W - r; PX[i] = W - r + vx * 0.3; }
    }
  }

  update(dt) {
    this.acc += dt;
    let steps = Math.floor(this.acc / DT);
    if (steps > 24) { steps = 24; this.acc = 0; } else this.acc -= steps * DT;
    this.snapMax = 0; this.slide = 0;
    for (let s = 0; s < steps; s++) this.step(DT, false);
    this.slide /= Math.max(1, steps);
    // a taut chain tugs him along when you pull it further than it reaches
    if (this.grab.i > 0) {
      const h = this.hand(), p = this.stage.ptr, dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
      if (d > this.grab.len * REACH) { const f = (d - this.grab.len * REACH) * 26; this.puppet.M.vx += dx / d * f * dt; this.puppet.M.vy += dy / d * f * dt; }   // he's heavy to tug
    }
    this.draw();
    this.sounds();
  }

  draw() {
    const { X, Y, N } = this, half = Math.PI / 2;
    for (let i = 0; i < N; i++) {
      const s = this.linkSprites[i];
      s.position.set((X[i] + X[i + 1]) / 2, (Y[i] + Y[i + 1]) / 2);
      s.rotation = Math.atan2(Y[i + 1] - Y[i], X[i + 1] - X[i]) - half;
    }
    for (const p of this.pend) {
      p.sprite.position.set(X[p.i], Y[p.i]);
      p.sprite.rotation = Math.atan2(Y[p.i] - Y[p.at], X[p.i] - X[p.at]) - half;
    }
    this.view.alpha = this.puppet.s.alpha;
  }

  sounds() {
    const snd = this.sound;
    if (!snd || this.view.alpha < 0.2) { this.events.length = 0; return; }
    const now = performance.now(), dt = Math.min(0.1, (now - (this.lastSoundCheck || now)) / 1000);
    this.lastSoundCheck = now;
    this.clinkBudget = Math.min(MAX_CLINKS_PER_SECOND, this.clinkBudget + dt * MAX_CLINKS_PER_SECOND);
    const minTravel = this.P * MIN_TRAVEL;
    // the chain snapping taut only counts when the hand has actually pulled it
    if (this.snapMax > this.P * 0.12) this.events.push({ s: Math.min(1.5, this.snapMax / this.P * 4), x: this.X[0], i: 0 });
    this.events.sort((a, b) => b.s - a.s);
    let played = 0;
    for (const ev of this.events) {
      if (played >= 2 || this.clinkBudget < 1) break;
      const s = Math.min(1, (ev.s - 0.8) / 3.5); if (s <= 0) break;
      if (this.moved(ev.i) < minTravel) continue;   // it hasn't really moved since it last clinked
      if (now - (this.lastClink || 0) < 45) break;
      snd.clink(s * 0.75, (ev.x / this.stage.W) * 2 - 1, 0.6, 0, { heavy: true });
      this.heardX[ev.i] = this.X[ev.i]; this.heardY[ev.i] = this.Y[ev.i];
      this.lastClink = now; this.clinkBudget -= 1; played++;
    }
    this.events.length = 0;
    // dragged along the floor, it drags as loud as it's sliding
    snd.scrape(Math.min(1, Math.max(0, (this.slide - 3) / 7)), (this.X[this.count >> 1] / this.stage.W) * 2 - 1);
  }

  /** The chain's extent on screen, for knowing when it has gone. */
  extent() {
    let minX = Infinity, maxY = -Infinity;
    for (let i = 0; i < this.count; i++) { if (this.X[i] < minX) minX = this.X[i]; if (this.Y[i] > maxY) maxY = this.Y[i]; }
    return { minX, maxY: maxY + this.Lp };
  }

  /** Resolves once `gone(extent)` is true (checked every frame), or after `maxMs` regardless. */
  gone(test, maxMs = 9000) {
    return new Promise((resolve) => {
      const start = performance.now();
      const off = this.stage.add(() => { if (test(this.extent()) || performance.now() - start > maxMs) { off(); resolve(); } });
    });
  }

  /** The nearest link or pendant to (x, y), within reach; -1 if none. */
  hit(x, y) {
    let best = -1, bd = Math.max(26, this.Lh * 1.4) ** 2;
    for (let i = 1; i < this.count; i++) { const d = (this.X[i] - x) ** 2 + (this.Y[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }

  take(i) {
    const pe = this.pend.find((q) => q.i === i);
    this.grab.len = pe ? pe.at * this.P + pe.rest : i * this.P;
    this.grab.i = i; this.IM[i] = 0;
  }

  drop() {
    if (this.grab.i < 0) return;
    this.IM[this.grab.i] = this.IM0[this.grab.i];
    this.grab.i = -1;
    const { X, Y, PX, PY } = this, max = LET_GO_SPEED * this.S * DT;
    for (let i = 1; i < this.count; i++) {
      const vx = X[i] - PX[i], vy = Y[i] - PY[i], v = Math.hypot(vx, vy);
      if (v > max) { PX[i] = X[i] - vx * max / v; PY[i] = Y[i] - vy * max / v; }
    }
  }

  remove() {
    this.off();
    this.sound?.scrape(0);
    this.stage.sys.world.removeChild(this.view);
    this.view.destroy({ children: true });
  }
}
