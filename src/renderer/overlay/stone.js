// The gravestone: an SSD-shaped stone, lit by your candle, that rises from below the screen and carves its
// inscription letter by letter in Cinzel, beneath frost your candle has to melt before you can read it. A line can be
// scratched out and re-carved, or carved again, deeper. At morning it cracks down the middle and falls away.

import { clamp } from "./util.js";

const PANEL = [266, 150], ANGLE = 0.125;   // the blank panel and its tilt (assets/landmarks.json)
// five lines on the panel: HERE LIES · whose drive · what it died of · how long it has · what tonight bought it
const LINES = [{ y: -57, size: 18, alpha: 1 }, { y: -30, size: 21, alpha: 1 }, { y: -6, size: 12, alpha: 1 }, { y: 16, size: 14, alpha: 1 }, { y: 37, size: 11, alpha: 0.85 }];
const MAX_W = 150, MIN_FIT = 0.55;   // the panel is about 150 px across; long lines shrink to fit, down to 55%
const FROST = { w: 220, h: 150, y: -10, k: 2 };   // the frost over the panel, in panel units (canvas at k x)

/** A frosted pane over the inscription: dense in the middle, feathered at the edges, with ice crystals in it. */
function frostCanvas() {
  const c = document.createElement("canvas"); c.width = FROST.w * FROST.k; c.height = FROST.h * FROST.k;
  const g = c.getContext("2d", { willReadFrequently: true }), w = c.width, h = c.height;   // read back to know how much is melted
  g.fillStyle = "rgba(214,230,242,1)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {   // rime: a mottled, opaque crust, so nothing carved beneath shows through
    const v = 200 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v + 6},${Math.min(255, v + 14)},0.6)`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineCap = "round";
  for (let i = 0; i < 70; i++) {   // crystals
    let x = Math.random() * w, y = Math.random() * h, a = Math.random() * Math.PI * 2;
    for (let s = 0; s < 5; s++) {
      const len = 6 + Math.random() * 18, x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = 0.8 + Math.random() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      x = x2; y = y2; a += (Math.random() - 0.5) * 1.2;
    }
  }
  g.globalCompositeOperation = "destination-in";   // feather it into the panel
  g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
  const e = g.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.52);
  e.addColorStop(0, "rgba(0,0,0,1)"); e.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = e; g.fillRect(-w / 2, -w / 2, w, w); g.restore();
  g.globalCompositeOperation = "source-over";
  return c;
}

const VERT = `attribute vec2 aVertexPosition; attribute vec2 aTextureCoord; uniform mat3 projectionMatrix; uniform mat3 translationMatrix; uniform mat3 uTextureMatrix; varying vec2 vTextureCoord;
  void main(void){ gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy; }`;
const FRAG = `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform sampler2D uNormal; uniform vec4 uColor; uniform vec2 uSize; uniform vec3 uKey; uniform float uAmb; uniform float uFall;
  void main(void){ vec4 c = texture2D(uSampler, vTextureCoord); if (c.a < 0.004) { gl_FragColor = vec4(0.0); return; }
    vec3 n = texture2D(uNormal, vTextureCoord).xyz * 2.0 - 1.0; vec3 D = uKey - vec3(vTextureCoord * uSize, 0.0); vec3 L = normalize(D);
    float k = uAmb + 1.1 * max(dot(n, L), 0.0) / (1.0 + dot(D, D) * uFall); gl_FragColor = vec4(c.rgb * k, c.a) * uColor; }`;

export class Stone {
  constructor(stage, sound) {
    this.stage = stage;
    this.sound = sound;
    const T = stage.T, w = T.stone.width, h = T.stone.height;
    this.w = w; this.h = h;
    const program = PIXI.Program.from(VERT, FRAG, "carol-stone");
    // two halves, so it can break; drawn as one until then
    this.halves = [0, 1].map((side) => {
      const tex = new PIXI.Texture(T.stone.baseTexture, new PIXI.Rectangle(side ? w / 2 : 0, 0, w / 2, h));
      const ntex = new PIXI.Texture(T.stone_normal.baseTexture, new PIXI.Rectangle(side ? w / 2 : 0, 0, w / 2, h));
      const mesh = new PIXI.Mesh(new PIXI.PlaneGeometry(w / 2, h, 2, 2), new PIXI.MeshMaterial(tex, { program, uniforms: { uNormal: ntex, uSize: [w, h], uKey: [0, 0, 300], uAmb: 0.35, uFall: 0 } }));
      const holder = new PIXI.Container();
      holder.addChild(mesh);
      mesh.position.set(side ? 0 : -w / 2, -h);
      holder.position.set(0, 0);
      holder.vx = 0; holder.vy = 0; holder.vr = 0; holder.offsetX = side ? w / 2 : 0;   // texture coordinates span the whole stone
      return holder;
    });
    this.root = new PIXI.Container();
    this.halves.forEach((hv) => this.root.addChild(hv));
    this.carve = new PIXI.Container();
    this.carve.rotation = ANGLE;
    this.carve.position.set(PANEL[0] - w / 2, PANEL[1] - h);
    this.root.addChild(this.carve);
    this.texts = LINES.map((l) => {
      const tx = new PIXI.Text("", Stone.style(l.size, l.alpha));
      tx.anchor.set(0.5); tx.y = l.y; tx.alpha = l.alpha; tx.resolution = 3;
      this.carve.addChild(tx);
      return tx;
    });
    this.scratches = new PIXI.Graphics(); this.carve.addChild(this.scratches);
    this.frosted = null;
    this.queue = [];
    this.ambient = 0.35;   // in the dark, lower, with `fall` so only your candle shows it
    this.fall = 0;
    this.rise = 0; this.riseTo = 0;
    this.broken = false;
    this.dust = [];
    stage.layers.stone.addChild(this.root);
    this.layout({ x: stage.W * 0.26, baseY: stage.H * 0.98, size: 0.42 });
    this.off = stage.add((t, dt) => this.update(t, dt));
  }

  /** Where it stands: x centre, the bottom of the stone, and its height as a fraction of the screen. */
  layout({ x, baseY, size }) {
    const { W, H } = this.stage;
    this.scale = Math.min(W * 0.4 / this.w, H * size / this.h);
    this.root.scale.set(this.scale);
    this.x = Math.max(this.w * this.scale * 0.5 + 8, x);
    this.baseY = baseY;
  }

  raise() { this.riseTo = 1; }
  lower() { this.riseTo = 0; }

  static style(size, alpha = 1, deep = false) {
    return new PIXI.TextStyle({ fontFamily: "Cinzel", fontWeight: "700", fontSize: size, fill: deep ? "#04060b" : "#0e121c", letterSpacing: deep ? 1.6 : 1,
      dropShadow: true, dropShadowColor: "#f2fdff", dropShadowAlpha: (deep ? 1 : 0.85) * alpha, dropShadowBlur: 0, dropShadowAngle: Math.PI / 2, dropShadowDistance: deep ? 2 : 1.5 });
  }

  /** Before carving: size the whole line to fit the panel, and anchor it at its left end, so it's cut in place. */
  fit(tx, text) {
    tx.anchor.set(0.5); tx.scale.set(1); tx.x = 0;
    tx.text = text;
    if (tx.width > MAX_W) tx.scale.set(Math.max(MIN_FIT, MAX_W / tx.width));
    const w = tx.width;
    tx.anchor.set(0, 0.5); tx.x = -w / 2;
    tx.text = "";
  }

  /** Carve line `i` (0..4) with `text` at `speed` letters a second; resolves when the last letter is cut. */
  carveLine(i, text, { speed = 7 } = {}) {
    return new Promise((resolve) => this.queue.push({ i, text, n: 0, speed, resolve }));
  }

  /** The chisel scratches line `i` out, and what was carved there crumbles away. */
  async strike(i) {
    const tx = this.texts[i], x0 = tx.x, x1 = tx.x + tx.width, g = this.scratches;
    for (let pass = 0; pass < 3; pass++) {
      const y = tx.y + (pass - 1) * 3;
      g.lineStyle(1.6, 0x0b0e16, 0.9).moveTo(x0 - 4, y + (Math.random() - 0.5) * 3);
      for (let x = x0; x <= x1 + 4; x += 8) {
        g.lineTo(x, y + (Math.random() - 0.5) * 4);
        if ((x - x0) % 24 < 8) { this.sound?.grind(); const p = this.carve.toGlobal(new PIXI.Point(x, y)); this.puff(p.x, p.y); }
        await new Promise((r) => setTimeout(r, 22));
      }
    }
    await new Promise((resolve) => {   // the scratched line crumbles and falls
      let t = 0;
      const off = this.stage.add((_t, dt) => {
        t += dt; tx.alpha = Math.max(0, LINES[i].alpha * (1 - t / 0.7)); tx.y = LINES[i].y + t * 10; g.alpha = Math.max(0, 1 - t / 0.7);
        if (t >= 0.7) { off(); resolve(); }
      });
    });
    tx.text = ""; tx.alpha = LINES[i].alpha; tx.y = LINES[i].y; g.clear(); g.alpha = 1;
  }

  /** Carve line `i` again, deeper and darker: nothing you did tonight changed it. */
  async deepen(i) {
    const tx = this.texts[i], text = tx.text;
    tx.text = ""; tx.style = Stone.style(LINES[i].size, LINES[i].alpha, true);
    await this.carveLine(i, text, { speed: 4 });
  }

  /** Frost over the inscription. Your candle melts it where it lingers; `read()` reports how much is clear. */
  frost() {
    const c = frostCanvas(), tex = PIXI.Texture.from(c);
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.width = FROST.w; s.height = FROST.h; s.y = FROST.y;
    this.carve.addChild(s);
    this.frosted = { c, g: c.getContext("2d"), tex, s, thaw: 0, base: {} };
    for (const i of [0, 1, 2, 3, 4, null]) this.frosted.base[i] = this.frostIn(i);   // how frosted each line starts
  }

  /** The total frost over line `i` (or the whole inscription), from the canvas. */
  frostIn(i) {
    const F = this.frosted, k = FROST.k;
    const top = i == null ? LINES[0].y - 12 : LINES[i].y - LINES[i].size * 0.55, bottom = i == null ? LINES[3].y + 10 : LINES[i].y + LINES[i].size * 0.55;
    const y0 = Math.round((top - FROST.y + FROST.h / 2) * k), y1 = Math.round((bottom - FROST.y + FROST.h / 2) * k);
    const x0 = Math.round((FROST.w / 2 - 70) * k), x1 = Math.round((FROST.w / 2 + 70) * k);
    const data = F.g.getImageData(x0, y0, x1 - x0, Math.max(1, y1 - y0)).data;
    let sum = 0;
    for (let p = 3; p < data.length; p += 16) sum += data[p];
    return sum;
  }

  /** How much of line `i` (or, with no `i`, of the whole inscription) your candle has cleared: 0..1. */
  cleared(i) {
    const F = this.frosted;
    if (!F) return 1;
    const base = F.base[i ?? null] || 1;
    return clamp(1 - (this.frostIn(i ?? null) / base) * (1 - F.thaw));
  }

  /** The frost thaws by itself (if you never bring your light to it). */
  thaw() { if (this.frosted) this.frosted.thawing = true; }

  /** Break in two and fall. */
  crack() {
    if (this.broken || this.cracking) return;
    this.cracking = true;
    // first a crack runs down the stone, splintering as it goes...
    const g = new PIXI.Graphics(), pts = [];
    let x = (Math.random() - 0.5) * 16, y = -this.h;
    pts.push([x, y]);
    while (y < -this.h * 0.04) { y += 14 + Math.random() * 18; x += (Math.random() - 0.5) * 22; pts.push([x, y]); }
    this.root.addChild(g);
    this.sound?.crackle();
    let shown = 0;
    const grow = this.stage.add((_t, dt) => {
      shown = Math.min(pts.length, shown + dt * 40);
      g.clear().lineStyle(3, 0x05070c, 0.95).moveTo(...pts[0]);
      for (let i = 1; i < shown; i++) g.lineTo(...pts[i]);
      g.lineStyle(1, 0xdff4ff, 0.35).moveTo(pts[0][0] + 1.5, pts[0][1]);
      for (let i = 1; i < shown; i++) g.lineTo(pts[i][0] + 1.5, pts[i][1]);
      if (shown >= pts.length) { grow(); setTimeout(() => this.shatter(g, pts), 260); }
    });
  }

  /** ...then it gives way: a boom, the halves fall, shards and gravel spill out of the break, and dust rolls up. */
  shatter(g, pts) {
    this.broken = true;
    this.sound?.crack();
    g.destroy();
    const [l, r] = this.halves;
    l.vx = -110; l.vr = -0.9; r.vx = 125; r.vr = 1.05;
    l.vy = r.vy = -70;
    this.carve.visible = false;
    const s = this.scale, gx = (px) => this.root.x + px * s, gy = (py) => this.root.y + py * s;
    for (let k = 0; k < 160; k++) {   // dust out of the whole length of the break
      const [px, py] = pts[Math.floor(Math.random() * pts.length)];
      this.puff(gx(px), gy(py), 2.6, { size: 2 + Math.random() * 4, life: 0.8 + Math.random() * 1.4, rise: Math.random() < 0.5 });
    }
    for (let k = 0; k < 34; k++) this.shard(gx((Math.random() - 0.5) * 60), gy(-this.h * (0.1 + Math.random() * 0.8)));
    for (let k = 0; k < 14; k++) this.cloud(gx((Math.random() - 0.5) * this.w * 0.7), gy(-this.h * Math.random() * 0.6));
  }

  /** A sharp fragment of stone: flung out, spinning, bouncing once off the ground, then lying still and fading. */
  shard(x, y) {
    const p = new PIXI.Graphics(), r = (3 + Math.random() * 9) * this.scale, n = 3 + Math.floor(Math.random() * 3), v = 90 + Math.floor(Math.random() * 70);
    p.beginFill((v << 16) | ((v + 8) << 8) | (v + 18)).moveTo(r, 0);
    for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.6; p.lineTo(Math.cos(a) * r * (0.5 + Math.random() * 0.6), Math.sin(a) * r * (0.5 + Math.random() * 0.6)); }
    p.endFill(); p.position.set(x, y);
    p.vx = (Math.random() - 0.5) * 420; p.vy = -80 - Math.random() * 260; p.vr = (Math.random() - 0.5) * 14; p.life = 0; p.max = 2.6 + Math.random();
    p.floor = this.baseY - Math.random() * 10 * this.scale; p.isShard = true;
    this.stage.layers.fx.addChild(p); this.dust.push(p);
  }

  /** A slow, rolling cloud of stone dust. */
  cloud(x, y) {
    const p = new PIXI.Sprite(this.cloudTex ||= (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const gg = c.getContext("2d"), gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(220,230,236,0.5)"); gr.addColorStop(1, "rgba(220,230,236,0)");
      gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64); return PIXI.Texture.from(c);
    })());
    p.anchor.set(0.5); p.position.set(x, y); p.width = p.height = (40 + Math.random() * 60) * this.scale; p.alpha = 0;
    p.vx = (Math.random() - 0.5) * 60; p.vy = -10 - Math.random() * 20; p.life = 0; p.max = 2 + Math.random() * 1.5; p.isCloud = true; p.amax = 0.35 + Math.random() * 0.25;
    this.stage.layers.fx.addChild(p); this.dust.push(p);
  }

  puff(x, y, spread = 1, { size = 1.5 + Math.random() * 2.5, life = 0.6 + Math.random() * 0.6, rise = false } = {}) {
    const p = new PIXI.Sprite(PIXI.Texture.WHITE);
    p.position.set(x, y); p.width = p.height = size; p.tint = Math.random() < 0.5 ? 0xcfe7ef : 0x9aa6ae; p.alpha = 0;
    p.vx = (Math.random() - 0.5) * 60 * spread; p.vy = rise ? -20 - Math.random() * 50 : 10 + Math.random() * 40 * spread; p.life = 0; p.max = life;
    this.stage.layers.fx.addChild(p); this.dust.push(p);
  }

  update(t, dt) {
    this.rise += (this.riseTo - this.rise) * Math.min(1, dt * 1.6);
    const { H, ptr } = this.stage;
    this.root.position.set(this.x, this.baseY + (1 - this.rise) * H * 0.62);
    for (const hv of this.halves) {
      const mesh = hv.children[0];
      const L = mesh.toLocal(new PIXI.Point(ptr.x, ptr.y));
      mesh.material.uniforms.uKey = [L.x + hv.offsetX, L.y, 260 / this.scale];
      mesh.material.uniforms.uAmb = this.ambient;
      mesh.material.uniforms.uFall = this.fall / (this.scale * this.scale);
      if (this.broken) { hv.vy += 900 * dt; hv.x += hv.vx * dt; hv.y += hv.vy * dt; hv.rotation += hv.vr * dt; hv.alpha = Math.max(0, hv.alpha - dt * 0.5); }
    }
    const F = this.frosted;
    if (F) {   // your candle melts the frost where it lingers
      if (F.thawing) { F.thaw = Math.min(1, F.thaw + dt * 0.5); F.s.alpha = 1 - F.thaw; }
      // in the dark the frost is lit only by your candle, like the stone
      const c = this.carve.toGlobal(new PIXI.Point(0, FROST.y)), near = this.fall ? clamp(1 - (Math.hypot(ptr.x - c.x, ptr.y - c.y) - 60) / 340) : 1;
      const v = Math.round(34 + 221 * (ptr.seen || !this.fall ? near : 0));
      F.s.tint = (v << 16) | (Math.min(255, v + 6) << 8) | Math.min(255, v + 12);
      const l = this.carve.toLocal(new PIXI.Point(ptr.x, ptr.y));
      const r = 80 / this.scale;
      if (ptr.seen && Math.abs(l.x) < FROST.w / 2 + r && Math.abs(l.y - FROST.y) < FROST.h / 2 + r) {
        const k = FROST.k, x = (l.x + FROST.w / 2) * k, y = (l.y - FROST.y + FROST.h / 2) * k;
        const gr = F.g.createRadialGradient(x, y, 0, x, y, r * k);
        gr.addColorStop(0, `rgba(0,0,0,${Math.min(1, dt * 2.2)})`); gr.addColorStop(0.6, `rgba(0,0,0,${Math.min(1, dt * 1.2)})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        F.g.globalCompositeOperation = "destination-out"; F.g.fillStyle = gr; F.g.fillRect(x - r * k, y - r * k, r * 2 * k, r * 2 * k);
        F.g.globalCompositeOperation = "source-over";
        F.tex.baseTexture.update();
      }
    }
    // the carving takes light from your candle like the stone does: dark letters with a faint edge of light when your
    // flame is far, crisp as it comes close
    let light = 1;
    if (this.fall) {
      const p = this.carve.toGlobal(new PIXI.Point(0, 0)), d = Math.hypot(ptr.x - p.x, ptr.y - p.y);
      light = ptr.seen ? clamp(this.ambient + (1 - this.ambient) * (1 - (d - 90) / 380)) : this.ambient;
    }
    const lv = Math.round(255 * light), tint = (lv << 16) | (lv << 8) | lv;
    for (const tx of this.texts) tx.tint = tint;
    this.scratches.tint = tint;
    this.carve.alpha = 1;
    const job = this.queue[0];
    if (job) {
      const tx = this.texts[job.i];
      job.n += dt * job.speed;
      const n = Math.min(job.text.length, Math.floor(job.n));
      if (!job.fitted) { this.fit(tx, job.text); job.fitted = true; }
      if (tx.text.length !== n) {
        tx.text = job.text.slice(0, n);
        if (job.text[n - 1] && job.text[n - 1] !== " ") this.sound?.grind();
        const gp = tx.toGlobal(new PIXI.Point(tx.width / tx.scale.x, 0));   // where the chisel is: the end of the line so far
        for (let k = 0; k < 3; k++) this.puff(gp.x, gp.y);
      }
      if (n >= job.text.length) { this.queue.shift(); job.resolve(); }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.life += dt;
      if (p.life >= p.max) { p.destroy(); this.dust.splice(i, 1); continue; }
      const k = p.life / p.max;
      if (p.isShard) {   // falls, bounces once, settles, fades
        p.vy += 1100 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.vr * dt;
        if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.5; p.vr *= 0.4; if (Math.abs(p.vy) < 30) p.vy = 0; }
        p.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      } else if (p.isCloud) {   // swells and drifts
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99; p.scale.set(p.scale.x * (1 + dt * 0.35));
        p.alpha = p.amax * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
      } else {
        p.alpha = 0.8 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98;
      }
    }
  }

  /** A point on the panel, for the pointing hand to aim at. */
  panelPoint() { return this.carve.toGlobal(new PIXI.Point(0, -60)); }
  get top() { return this.root.y - this.h * this.scale; }
  get alpha() { return this.root.alpha; }
  set alpha(a) { this.root.alpha = clamp(a); }

  remove() {
    this.off();
    this.dust.forEach((p) => p.destroy());
    this.root.destroy({ children: true });
  }
}
