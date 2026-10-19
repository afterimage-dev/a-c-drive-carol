// The gravestone: an SSD-shaped stone, lit by your candle, that rises from below the screen and carves its
// inscription letter by letter in Cinzel. At morning it cracks down the middle and falls away.

import { clamp } from "./util.js";

const PANEL = [266, 150], ANGLE = 0.125;   // the blank panel and its tilt (assets/landmarks.json)
const LINES = [{ y: -44, size: 21, alpha: 1 }, { y: -8, size: 15, alpha: 1 }, { y: 28, size: 14, alpha: 0.7 }];

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
      const tx = new PIXI.Text("", new PIXI.TextStyle({ fontFamily: "Cinzel", fontWeight: "700", fontSize: l.size, fill: "#0e121c", letterSpacing: 1, dropShadow: true, dropShadowColor: "#f2fdff", dropShadowAlpha: 0.85 * l.alpha, dropShadowBlur: 0, dropShadowAngle: Math.PI / 2, dropShadowDistance: 1.5 }));
      tx.anchor.set(0.5); tx.y = l.y; tx.alpha = l.alpha; tx.resolution = 2;
      this.carve.addChild(tx);
      return tx;
    });
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

  /** Carve line `i` (0..2) with `text`; resolves when the last letter is cut. */
  carveLine(i, text) {
    return new Promise((resolve) => this.queue.push({ i, text, n: 0, resolve }));
  }

  /** Break in two and fall. */
  crack() {
    if (this.broken) return;
    this.broken = true;
    this.sound?.crack();
    const [l, r] = this.halves;
    l.vx = -60; l.vr = -0.5; r.vx = 70; r.vr = 0.6;
    l.vy = r.vy = -40;
    this.carve.visible = false;
    for (let k = 0; k < 40; k++) this.puff(this.root.x + (Math.random() - 0.5) * 40 * this.scale, this.root.y - this.h * this.scale * (0.2 + Math.random() * 0.7), 1.6);
  }

  puff(x, y, spread = 1) {
    const p = new PIXI.Sprite(PIXI.Texture.WHITE);
    p.position.set(x, y); p.width = p.height = 1.5 + Math.random() * 2.5; p.tint = 0xcfe7ef; p.alpha = 0;
    p.vx = (Math.random() - 0.5) * 60 * spread; p.vy = 10 + Math.random() * 40; p.life = 0; p.max = 0.6 + Math.random() * 0.6;
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
    if (this.fall) {   // the carving is only legible as your light reaches it
      const p = this.carve.toGlobal(new PIXI.Point(0, 0)), d = Math.hypot(ptr.x - p.x, ptr.y - p.y);
      this.carve.alpha = 0.35 + 0.65 * clamp(1 - (d - 120) / 420);
    } else this.carve.alpha = 1;
    const job = this.queue[0];
    if (job) {
      const tx = this.texts[job.i];
      job.n += dt * 7;
      const n = Math.min(job.text.length, Math.floor(job.n));
      if (tx.text.length !== n) {
        tx.text = job.text.slice(0, n);
        if (job.text[n - 1] && job.text[n - 1] !== " ") this.sound?.grind();
        const gp = tx.toGlobal(new PIXI.Point(tx.width / 2 / tx.scale.x, 0));
        for (let k = 0; k < 3; k++) this.puff(gp.x, gp.y);
      }
      if (n >= job.text.length) { this.queue.shift(); job.resolve(); }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.life += dt;
      if (p.life >= p.max) { p.destroy(); this.dust.splice(i, 1); continue; }
      const k = p.life / p.max; p.alpha = 0.8 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98;
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
