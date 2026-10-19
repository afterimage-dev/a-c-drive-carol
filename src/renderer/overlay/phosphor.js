/* A C-Drive Carol · phosphor spirits (PixiJS 7.4.2, loaded as the global PIXI)
 *
 * Ported from prototypes/phosphor/spirits-phosphor.js. Changes for the app: an ES module; any number of lagging
 * copies for the Ghost of Filesystems Present (one per duplicate); a bow for Marlware.
 *
 * Each spirit is two lit layers (body, and a separate head on a spring), drawn into a low-resolution buffer,
 * then shown through a dithered phosphor "monitor" pass with scanlines, bloom and fog. Each spirit has its own
 * phosphor: Marlware cool white-blue, the Past amber, the Present green, Yet to Come a dim violet that blocks the light.
 *
 *   const sys = CarolPhosphor.create(app, textures, { W, H, cell: 3, spawn });
 *   const sp = sys.spirit("marl");  sys.spirits.addChild(sp.root);  sp.place(x, y, height);
 *   every frame: sp.update(t, dt);  sys.frame(t, dt, "marl");
 *   sys.output goes into app.stage wherever the ghosts should appear; sys.world is the ghosts' own space
 *   (give it a position/scale to move a camera).
 *
 * Textures needed: <key>_body, <key>_head, <key>_normal, <key>_glow for marl, past, present, yet.
 */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const hash = (a, b = 0) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be59b, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  const VERT = `
    attribute vec2 aVertexPosition; attribute vec2 aTextureCoord;
    uniform mat3 projectionMatrix; uniform mat3 translationMatrix; uniform mat3 uTextureMatrix;
    varying vec2 vTextureCoord;
    void main(void) {
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
      vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy;
    }`;

  // A sprite lit by a moving point light, using its normal map: diffuse, distance falloff and a rim on the edges.
  const LIT = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler; uniform sampler2D uNormal; uniform vec4 uColor;
    uniform vec2 uSize; uniform vec3 uKey; uniform float uKeyI; uniform float uAmb; uniform float uRim; uniform float uFall;
    void main(void) {
      vec4 c = texture2D(uSampler, vTextureCoord);
      if (c.a < 0.004) { gl_FragColor = vec4(0.0); return; }
      vec3 n = texture2D(uNormal, vTextureCoord).xyz * 2.0 - 1.0;
      vec2 p = vTextureCoord * uSize;
      vec3 L = uKey - vec3(p, 0.0);
      float d = length(L); L /= d;
      float diff = max(dot(n, L), 0.0);
      float att = 1.0 / (1.0 + d * d * uFall);
      float edge = 1.0 - clamp(n.z, 0.0, 1.0);
      float rim = edge * edge * uRim * (0.4 + 0.6 * max(dot(normalize(n.xy + vec2(1e-4)), normalize(L.xy + vec2(1e-4))), 0.0));
      float k = uAmb + uKeyI * diff * att + rim;
      gl_FragColor = vec4(c.rgb * k, c.a) * uColor;
    }`;

  // The monitor: quantise brightness into four phosphor levels with an ordered dither, per low-res cell,
  // with scanlines, a faint flicker, row tearing when glitching, and occlusion so dark spirits block what is behind.
  const PHOS = `
    precision highp float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler; uniform vec4 uColor;
    uniform vec2 uLowSize; uniform vec2 uRT; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
    uniform float uGain; uniform float uGamma; uniform float uOcc; uniform float uTime; uniform float uGlitch; uniform float uSeed;
    float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(void) {
      vec2 g = vTextureCoord * uLowSize;
      vec2 cell = floor(g); vec2 f = fract(g);
      if (uGlitch > 0.0) {
        float band = floor(cell.y / 6.0);
        float r = rnd(vec2(band, uSeed));
        if (r < 0.35 * uGlitch) cell.x += floor((rnd(vec2(band, uSeed + 3.1)) - 0.5) * 40.0 * uGlitch);
      }
      vec4 s = texture2D(uSampler, (cell + 0.5) / uRT);
      float lum = dot(s.rgb, vec3(0.3, 0.59, 0.11));
      float v = pow(clamp(lum * uGain, 0.0, 1.0), uGamma) * 4.0;
      float lvl = clamp(floor(v + bayer4(cell)), 0.0, 4.0);
      vec3 col = lvl < 0.5 ? vec3(0.0) : lvl < 1.5 ? uC1 : lvl < 2.5 ? uC2 : lvl < 3.5 ? uC3 : uC4;
      col *= (f.y < 0.34 ? 0.58 : 1.0) * (0.965 + 0.035 * sin(uTime * 41.0 + cell.y * 0.71));
      float a = max(clamp(s.a * uOcc, 0.0, 1.0), max(col.r, max(col.g, col.b)));
      gl_FragColor = vec4(col, a) * uColor.a;
    }`;

  const RAMPS = {
    marl:    { c: ["#0f2c36", "#2f8799", "#93e4ea", "#f2fffe"], occ: 0.45, gain: 0.95, gamma: 1.45, pool: "#2f8799" },
    past:    { c: ["#331a06", "#a85a14", "#ffad3d", "#fff1d6"], occ: 0.45, gain: 0.92, gamma: 1.5,  pool: "#a85a14" },
    present: { c: ["#0c3319", "#279448", "#8ef58f", "#f0fff0"], occ: 0.45, gain: 0.88, gamma: 1.5,  pool: "#279448" },
    yet:     { c: ["#16122a", "#463c78", "#a194de", "#ece8ff"], occ: 0.92, gain: 1.5,  gamma: 1.0,  pool: "#463c78" }
  };

  const CFG = {
    marl: { w: 398, h: 705, eyes: [[115, 204], [211, 202]], eyeR: [17, 19], mouth: [160, 250, 34], neck: [171, 289], hands: [[58, 504, 0], [298, 485, 2.1]],
      m: { speed: 1, breath: 1, tilt: 0.05, hand: 6, tailStart: 0.52, tail: 0.04 }, light: { amb: 0.4, key: 0.95, rim: 0.6 }, pRate: 46, pAlpha: 0.9, glowA: 0.22 },
    past: { w: 369, h: 661, eyes: [[110, 165], [195, 165]], eyeR: [16, 15], mouth: [152, 211, 40], neck: [160, 248], hands: [[46, 419, 0.5], [281, 424, 2.4]],
      m: { speed: 0.7, breath: 0.7, tilt: 0.06, hand: 7, tailStart: 0.45, tail: 0.06, hair: 0.26 }, light: { amb: 0.38, key: 0.95, rim: 0.6 }, pRate: 34, pAlpha: 0.8, glowA: 0.18, halo: true },
    present: { w: 614, h: 697, eyes: [[297, 151], [347, 151]], eyeR: [11, 8], mouth: [317, 196, 46], neck: [321, 258], hands: [[112, 337, 0.3], [501, 494, 2.2]], belly: [292, 407, 120],
      m: { speed: 1.15, breath: 1.6, tilt: 0.045, hand: 8, tailStart: 0.62, tail: 0.03 }, light: { amb: 0.38, key: 0.95, rim: 0.55 }, pRate: 40, pAlpha: 0.85, glowA: 0.16 },
    yet: { w: 629, h: 711, eyes: [], neck: [275, 197], hands: [[380, 432, 1.2]], pointHand: [52, 406], hood: [256, 108],
      m: { speed: 0.4, breath: 0.25, tilt: 0.02, hand: 3, tailStart: 0.5, tail: 0.035 }, light: { amb: 0.32, key: 1.3, rim: 1.0 }, pRate: 26, pAlpha: 0.6, glowA: 0.0 }
  };

  function softTex(stops, size = 128) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return PIXI.Texture.from(c);
  }
  function fogTex(seed) {
    const w = 512, h = 256, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.filter = "blur(18px)";
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 90, a = 0.05 + r() * 0.12;
      for (const dx of [-w, 0, w]) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x + dx, y, rad * 1.8, rad * 0.7, 0, 0, Math.PI * 2); g.fill(); }
    }
    const t = PIXI.Texture.from(c); t.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT; return t;
  }

  function create(app, T, opts) {
    const W = opts.W, H = opts.H, spawn = opts.spawn || {};
    let cell = opts.cell || 3, lowW = Math.ceil(W / cell), lowH = Math.ceil(H / cell);
    const LIT_PROGRAM = PIXI.Program.from(VERT, LIT, "carol-lit");
    const PHOS_PROGRAM = PIXI.Program.from(VERT, PHOS, "carol-phosphor");
    const EYE = {
      socket: softTex([[0, "rgba(10,14,26,.8)"], [0.75, "rgba(10,14,26,.55)"], [1, "rgba(10,14,26,0)"]]),
      halo: softTex([[0, "rgba(255,255,255,.55)"], [0.4, "rgba(255,255,255,.18)"], [1, "rgba(255,255,255,0)"]]),
      disc: softTex([[0, "#ffffff"], [0.6, "#f2f2f2"], [0.85, "#cfcfcf"], [1, "rgba(200,200,200,0)"]]),
      core: softTex([[0, "rgba(255,255,255,1)"], [0.6, "rgba(255,255,255,.7)"], [1, "rgba(255,255,255,0)"]]),
      mouth: softTex([[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,.8)"], [1, "rgba(255,255,255,0)"]])
    };
    const POOL = softTex([[0, "rgba(255,255,255,.9)"], [0.35, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]], 256);

    // the ghosts' own world, rendered small, then shown through the monitor
    const world = new PIXI.Container();
    const particles = new PIXI.Container(), spirits = new PIXI.Container();
    world.addChild(particles, spirits);
    const lowRT = PIXI.RenderTexture.create({ width: lowW, height: lowH, resolution: 1 });
    const lowMatrix = new PIXI.Matrix(1 / cell, 0, 0, 1 / cell, 0, 0);
    const maxCell = (opts.cell || 3) * 4;

    const output = new PIXI.Container();
    const pool = new PIXI.Sprite(POOL); pool.anchor.set(0.5); pool.blendMode = PIXI.BLEND_MODES.ADD;
    const fogBack = new PIXI.TilingSprite(fogTex(7), W, H); fogBack.alpha = 0.16;
    const bloom = new PIXI.Sprite(lowRT); bloom.scale.set(cell); bloom.blendMode = PIXI.BLEND_MODES.ADD;
    const blur = new PIXI.BlurFilter(5, 3, 1 / cell); bloom.filters = [blur];
    const phosMat = new PIXI.MeshMaterial(lowRT, { program: PHOS_PROGRAM, uniforms: { uLowSize: [W / cell, H / cell], uRT: [lowW, lowH], uC1: [0, 0, 0], uC2: [0, 0, 0], uC3: [0, 0, 0], uC4: [0, 0, 0], uGain: 1, uGamma: 1, uOcc: 0.3, uTime: 0, uGlitch: 0, uSeed: 0 } });
    const phos = new PIXI.Mesh(new PIXI.PlaneGeometry(W, H, 2, 2), phosMat);
    const fogFront = new PIXI.TilingSprite(fogTex(91), W, H); fogFront.alpha = 0.1;
    output.addChild(pool, fogBack, bloom, phos, fogFront);

    const live = [], spare = [];
    const sys = { world, particles, spirits, output, lowRT, cell, W, H, glitch: 0, fog: 1, light: { x: W * 0.3, y: H * 0.25, z: 320 } };

    function mkMesh(tex, normal, w, h, nx, ny, lighting) {
      const mat = new PIXI.MeshMaterial(tex, { program: LIT_PROGRAM, uniforms: { uNormal: normal, uSize: [w, h], uKey: [0, 0, 300], uKeyI: lighting.key, uAmb: lighting.amb, uRim: lighting.rim, uFall: 0.0000025 } });
      const mesh = new PIXI.Mesh(new PIXI.PlaneGeometry(w, h, nx, ny), mat);
      mesh.buf = mesh.geometry.getBuffer("aVertexPosition"); mesh.base = Float32Array.from(mesh.buf.data);
      return mesh;
    }

    class Spirit {
      constructor(key) {
        const c = this.c = CFG[key]; this.key = key;
        this.root = new PIXI.Container(); this.body = new PIXI.Container(); this.body.pivot.set(c.w / 2, c.h / 2); this.root.addChild(this.body);
        this.glow = new PIXI.Sprite(T[key + "_glow"]); this.glow.anchor.set(0.5); this.glow.width = c.w + 140; this.glow.height = c.h + 140; this.glow.position.set(c.w / 2, c.h / 2); this.glow.blendMode = PIXI.BLEND_MODES.ADD; this.body.addChild(this.glow);
        const N = T[key + "_normal"];
        this.twins = [];   // lagging copies of himself (the Present): { body, head, lag, x }
        this.twinLayer = new PIXI.Container(); this.body.addChild(this.twinLayer);
        this.bodyMesh = mkMesh(T[key + "_body"], N, c.w, c.h, 12, 28, c.light);
        this.headMesh = mkMesh(T[key + "_head"], N, c.w, c.h, 10, 12, c.light);
        this.body.addChild(this.bodyMesh, this.headMesh);
        this.mouth = new PIXI.Sprite(EYE.mouth); this.mouth.anchor.set(0.5); this.mouth.tint = 0x101018; this.body.addChild(this.mouth);
        this.eyes = (c.eyes || []).map(() => { const m = (tex, add) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); if (add) s.blendMode = PIXI.BLEND_MODES.ADD; this.body.addChild(s); return s; }; return { socket: m(EYE.socket), halo: m(EYE.halo, true), disc: m(EYE.disc), core: m(EYE.core, true) }; });
        if (c.hood) this.pins = [0, 1].map(() => { const s = new PIXI.Sprite(EYE.core); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; this.body.addChild(s); return s; });
        if (c.halo) { this.halo = new PIXI.Graphics(); this.body.addChild(this.halo); }
        this.s = { open: 0, flare: 0, laugh: 0, tremble: 0, arm: 0, pins: 0, halo: 0.99, haloFlash: 0, begone: false, look: null, glitch: 0, gseed: 0, alpha: 1, vx: 0, facing: 1, eyesOpen: 1, twin: 1, nod: 0 };
        this.head = { a: 0, va: 0, ox: 0, vox: 0, oy: 0, voy: 0 };
        this.tmp = { x: 0, y: 0 }; this.scale = 1; this.pAcc = 0;
      }
      /** Show `n` lagging copies, each half a second further behind and further out, alternating sides. */
      setTwins(n) {
        const c = this.c, N = T[this.key + "_normal"];
        while (this.twins.length < n) {
          const k = this.twins.length + 1;
          const body = mkMesh(T[this.key + "_body"], N, c.w, c.h, 12, 28, c.light), head = mkMesh(T[this.key + "_head"], N, c.w, c.h, 10, 12, c.light);
          this.twinLayer.addChildAt(head, 0); this.twinLayer.addChildAt(body, 0);
          this.twins.push({ body, head, lag: 0.5 * k, x: (k % 2 ? 1 : -1) * 170 * Math.ceil(k / 2), seed: k * 1.7 });
        }
        this.twins.forEach((tw, i) => { tw.on = i < n; tw.body.visible = tw.head.visible = tw.on; });
        this.twinCount = n;
      }
      place(x, y, h, facing = 1) { this.scale = h / this.c.h; this.root.position.set(x, y); this.body.scale.set(this.scale * facing, this.scale); this.s.facing = facing; }
      // everything below the head: breathing, drifting hands, a laughing belly, a pointing arm, a rippling robe
      bodyBend(x, y, out, tt) {
        const c = this.c, m = c.m, S = this.s;
        let dx = 0, dy = 0;
        const u = x / c.w, v = y / c.h, s = tt * m.speed, br = Math.sin(s * 1.55), chest = bell(v, c.belly ? 0.55 : 0.5, 0.11);
        dx += (x - c.w * 0.45) * 0.02 * m.breath * br * chest; dy += -2 * m.breath * br * chest;
        for (const h of c.hands) { const w = Math.exp(-(((x - h[0]) ** 2) + ((y - h[1]) ** 2)) / 7200); dx += w * m.hand * Math.sin(s * 1.1 + h[2]); dy += w * m.hand * 0.8 * Math.sin(s * 0.9 + h[2] + 1); }
        if (c.belly) { const bw = Math.exp(-(((x - c.belly[0]) ** 2) + ((y - c.belly[1]) ** 2)) / (2 * c.belly[2] * c.belly[2])), j = S.laugh * Math.sin(tt * 19); dx += (x - c.belly[0]) * bw * (0.05 * j + 0.012 * br); dy += bw * 6 * j; }
        if (c.pointHand) {
          const aw = clamp((c.w * 0.42 - x) / (c.w * 0.37)) * bell(v, c.pointHand[1] / c.h, 0.13); dy += -aw * 26 * S.arm;
          const hw = Math.exp(-(((x - c.pointHand[0]) ** 2) + ((y - c.pointHand[1]) ** 2)) / 4050); dx += hw * S.tremble * 3.5 * Math.sin(tt * 37); dy += hw * S.tremble * 2.5 * Math.cos(tt * 31);
        }
        const tail = clamp((v - m.tailStart) / (1 - m.tailStart)), t2 = tail * tail;
        dx += t2 * c.w * m.tail * Math.sin(s * 1.9 - v * 8 + u * 1.6) + t2 * c.w * m.tail * 1.4 * Math.sin(s * 0.8 - v * 3);
        dx += -t2 * clamp(S.vx / this.scale * 0.18, -90, 90) * S.facing;
        dy += tail * 4 * Math.sin(s * 1.3 + u * 5);
        if (S.glitch > 0) { const band = Math.min(9, Math.floor(v * 10)); if (hash(S.gseed, band) < 0.45) dx += (hash(S.gseed + 7, band) - 0.5) * 0.18 * c.w * S.glitch; }
        out.x = x + dx; out.y = y + dy; return out;
      }
      // the head moves as one piece about the neck, riding the body's breathing, on its own spring
      headXform(x, y, out, tt, pose) {
        const c = this.c, m = c.m, S = this.s, n = c.neck;
        const rx = x - n[0], ry = y - n[1], co = Math.cos(pose.a), si = Math.sin(pose.a);
        let X = n[0] + rx * co - ry * si + pose.ox + pose.ndx, Y = n[1] + rx * si + ry * co + pose.oy + pose.ndy;
        if (m.hair) { const v = y / c.h, k = clamp((m.hair - v) / m.hair), s = tt * m.speed; X += k * 5 * Math.sin(s * 2.1 + x / c.w * 9 + v * 6); Y += k * 2 * Math.cos(s * 1.7 + x / c.w * 7); }
        if (S.glitch > 0) { const band = Math.min(9, Math.floor(y / c.h * 10)); if (hash(S.gseed, band) < 0.45) X += (hash(S.gseed + 7, band) - 0.5) * 0.18 * c.w * S.glitch; }
        out.x = X; out.y = Y; return out;
      }
      headTarget(tt) {
        const c = this.c, m = c.m, S = this.s, s = tt * m.speed;
        let lookX = 0;
        if (S.look) { const l = this.body.toLocal(new PIXI.Point(S.look.x, S.look.y), world); lookX = clamp((l.x - c.neck[0]) / 400, -1, 1); }
        return {
          a: S.nod * 0.32 + m.tilt * Math.sin(s * 0.7) + m.tilt * 0.5 * Math.sin(s * 1.9) + S.open * 0.03 * Math.sin(tt * 9) + S.laugh * 0.07 * Math.sin(tt * 16) - clamp(S.vx * 0.00035, -0.14, 0.14) * S.facing + lookX * 0.05,
          ox: lookX * 7 - clamp(S.vx * 0.015, -14, 14) * S.facing, oy: S.nod * 14 + Math.sin(s * 1.55 + 0.6) * 1.6 + S.laugh * 3 * Math.abs(Math.sin(tt * 9))
        };
      }
      update(t, dt) {
        const c = this.c, S = this.s, tmp = this.tmp, H_ = this.head;
        this.lastT = t;
        dt = Math.min(dt, 0.05);
        this.root.alpha = S.alpha;
        // head spring: it overshoots and settles, so it lags behind the body and follows through
        const tg = this.headTarget(t), k = 70, d = 9;
        H_.va += ((tg.a - H_.a) * k - H_.va * d) * dt; H_.a += H_.va * dt;
        H_.vox += ((tg.ox - H_.ox) * k - H_.vox * d) * dt; H_.ox += H_.vox * dt;
        H_.voy += ((tg.oy - H_.oy) * k - H_.voy * d) * dt; H_.oy += H_.voy * dt;
        this.bodyBend(c.neck[0], c.neck[1], tmp, t);
        const pose = { a: H_.a, ox: H_.ox, oy: H_.oy, ndx: tmp.x - c.neck[0], ndy: tmp.y - c.neck[1] };
        this.pose = pose;
        const fill = (mesh, fn, tt, p) => { const b = mesh.buf.data, base = mesh.base; for (let i = 0; i < b.length; i += 2) { fn.call(this, base[i], base[i + 1], tmp, tt, p); b[i] = tmp.x; b[i + 1] = tmp.y; } mesh.buf.update(); };
        fill(this.bodyMesh, this.bodyBend, t);
        fill(this.headMesh, this.headXform, t, pose);
        for (const tw of this.twins) {
          const on = tw.on && !S.begone && S.twin > 0;
          tw.body.visible = tw.head.visible = on;
          if (!on) continue;
          const lag = t - tw.lag, tp = this.headTarget(lag); this.bodyBend(c.neck[0], c.neck[1], tmp, lag);
          const p2 = { a: tp.a, ox: tp.ox, oy: tp.oy, ndx: tmp.x - c.neck[0], ndy: tmp.y - c.neck[1] };
          fill(tw.body, this.bodyBend, lag); fill(tw.head, this.headXform, lag, p2);
          tw.body.x = tw.head.x = tw.x;
          tw.body.alpha = tw.head.alpha = (0.5 + 0.12 * Math.sin(t * 7 + tw.seed)) * S.twin * (1 - 0.08 * (tw.lag / 0.5 - 1));
        }
        // light: the key light, in this spirit's own image pixels
        const L = this.body.toLocal(new PIXI.Point(sys.light.x, sys.light.y), world);
        const z = sys.light.z / Math.max(0.05, this.scale);
        for (const mesh of [this.bodyMesh, this.headMesh, ...this.twins.flatMap((tw) => (tw.on ? [tw.body, tw.head] : []))]) { const u = mesh.material.uniforms; u.uKey[0] = L.x; u.uKey[1] = L.y; u.uKey[2] = z; u.uKeyI = c.light.key * (sys.lightI ?? 1); u.uAmb = c.light.amb; }
        this.glow.alpha = c.glowA * (0.8 + 0.2 * Math.sin(t * 1.1)) + S.flare * 0.08;
        // eyes ride the head
        const blinkPhase = (t * 0.31 + c.w * 0.001) % 1, blink = blinkPhase > 0.965 ? Math.abs(Math.cos(Math.PI * (blinkPhase - 0.965) / 0.035)) * 0.92 + 0.08 : 1, open = blink * S.eyesOpen, flare = 1 + S.flare * 0.18;
        let local = null; if (S.look) local = this.body.toLocal(new PIXI.Point(S.look.x, S.look.y), world);
        (c.eyes || []).forEach((e, i) => {
          const p = this.eyes[i]; this.headXform(e[0], e[1], tmp, t, pose);
          const cx = tmp.x, cy = tmp.y; let lx = 0, ly = 0;
          if (local) { lx = local.x - cx; ly = local.y - cy; const len = Math.hypot(lx, ly) || 1, reach = Math.min(1, len / 220); lx = lx / len * reach; ly = ly / len * reach; }
          const rx = c.eyeR[0] * flare, ry = c.eyeR[1] * flare;
          p.socket.position.set(cx, cy); p.socket.width = c.eyeR[0] * 2.5; p.socket.height = c.eyeR[1] * 2.5;
          p.halo.position.set(cx, cy); p.halo.width = rx * 5; p.halo.height = ry * 5 * (0.5 + open * 0.5); p.halo.alpha = (0.8 + 0.2 * Math.sin(t * 2.2)) * (0.7 + S.flare * 0.3);
          p.disc.position.set(cx, cy); p.disc.width = rx * 2.3; p.disc.height = ry * 2.3 * open;
          p.core.position.set(cx + lx * rx * 0.4, cy + ly * ry * 0.4 * open); p.core.width = rx * 1.15; p.core.height = ry * 1.15 * open;
        });
        if (this.pins) { this.headXform(c.hood[0], c.hood[1], tmp, t, pose); this.pins.forEach((s, i) => { s.position.set(tmp.x + (i ? 15 : -15), tmp.y + 6); s.width = s.height = 26; s.alpha = S.pins * (0.7 + 0.3 * Math.sin(t * 3 + i)); }); }
        this.mouth.visible = !!c.mouth && S.open > 0.05;
        if (this.mouth.visible) { this.headXform(c.mouth[0], c.mouth[1], tmp, t, pose); const h = 2 + S.open * (this.key === "present" ? 7 : 5); this.mouth.position.set(tmp.x, tmp.y + h * 0.4); this.mouth.width = c.mouth[2] * (0.55 + S.open * 0.2); this.mouth.height = h * 2.2; this.mouth.alpha = 0.45 + 0.4 * S.open; }
        if (this.halo) {
          this.halo.clear(); this.headXform(c.w * 0.45, 22, tmp, t, pose);
          const bw = 150, bh = 22, x0 = tmp.x - bw / 2, y0 = tmp.y - 50, col = 0xffffff;
          this.halo.lineStyle(4, col, S.halo >= 0.999 ? 1 : 0.8).drawRoundedRect(x0, y0, bw, bh, 6);
          const n = 10, gap = 4, sw = (bw - 10 - gap * (n - 1)) / n, filled = S.halo * n;
          for (let i = 0; i < n; i++) { const a = clamp(filled - i); if (a > 0) this.halo.lineStyle(0).beginFill(col, Math.min(1, 0.7 * a + S.haloFlash)).drawRect(x0 + 5 + i * (sw + gap), y0 + 5, sw * (i === n - 1 ? a : 1), bh - 10).endFill(); }
        }
        // shed pixels
        if (S.particles !== false) { this.pAcc += dt * c.pRate * (S.pRate ?? 1); while (this.pAcc > 1) { this.spawn(); this.pAcc--; } }
      }
      spawn() {
        const c = this.c, sp = spawn[this.key]; if (!sp || !sp.length) return;
        const pt = sp[(Math.random() * sp.length) | 0];
        this.bodyBend(pt[0] * c.w, pt[1] * c.h, this.tmp, this.lastT || 0);
        const g = this.bodyToWorld(this.tmp.x, this.tmp.y);
        const p = spare.pop() || new PIXI.Sprite(PIXI.Texture.WHITE);
        p.position.set(g.x, g.y);
        const size = (1.4 + Math.random() * 2.6) * Math.max(1, this.scale * 2.4);
        p.width = p.height = size; p.tint = 0xffffff; p.alpha = 0; p.amax = c.pAlpha * this.s.alpha;
        p.vx = (Math.random() - 0.5) * 22 - this.s.vx * 0.15; p.vy = (14 + Math.random() * 30) * (this.key === "yet" ? 0.5 : 1) * Math.max(1, this.scale * 1.6);
        p.life = 0; p.max = 0.9 + Math.random() * 1.4;
        particles.addChild(p); live.push(p);
      }
      bodyToWorld(x, y) {
        // body-local -> world-local, without relying on world's parent transform
        const b = this.body, r = this.root;
        const sx = b.scale.x, sy = b.scale.y;
        let px = (x - b.pivot.x) * sx, py = (y - b.pivot.y) * sy;
        const co = Math.cos(r.rotation), si = Math.sin(r.rotation);
        return { x: r.x + px * co - py * si, y: r.y + px * si + py * co };
      }
    }

    sys.spirit = (key) => new Spirit(key);
    // the monitor's pixel size, in output pixels: bigger for close-ups so the art stays chunky
    sys.setCell = (c) => {
      c = Math.max(1, Math.min(maxCell, Math.round(c)));
      if (c === cell) return;
      cell = c; lowW = Math.ceil(W / cell); lowH = Math.ceil(H / cell);
      lowRT.resize(lowW, lowH);
      lowMatrix.a = lowMatrix.d = 1 / cell;
      phosMat.uniforms.uLowSize = [W / cell, H / cell]; phosMat.uniforms.uRT = [lowW, lowH];
      bloom.scale.set(cell); blur.resolution = 1 / cell; sys.cell = cell;
    };
    sys.clearParticles = () => { live.forEach((p) => { particles.removeChild(p); spare.push(p); }); live.length = 0; };
    // after updating the spirits: step particles, render the ghosts small, and set the monitor for this spirit's phosphor
    sys.frame = (t, dt, rampKey, opts2 = {}) => {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i]; p.life += dt;
        if (p.life >= p.max) { particles.removeChild(p); spare.push(p); live.splice(i, 1); continue; }
        const k = p.life / p.max; p.alpha = p.amax * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
      }
      app.renderer.render(world, { renderTexture: lowRT, clear: true, transform: lowMatrix });
      const R = RAMPS[rampKey] || RAMPS.marl, u = phosMat.uniforms;
      [u.uC1, u.uC2, u.uC3, u.uC4] = R.c.map(hex);
      u.uGain = R.gain * (opts2.gain ?? 1); u.uGamma = R.gamma; u.uOcc = R.occ * (opts2.occ ?? 1); u.uTime = t; u.uGlitch = sys.glitch; u.uSeed = Math.floor(t * 30) % 97;
      bloom.tint = parseInt(R.c[2].slice(1), 16); bloom.alpha = (opts2.bloom ?? 0.42) * (rampKey === "yet" ? 0.5 : 1);
      // a pool of the spirit's light on the scene behind it
      const focus = opts2.focus;
      pool.visible = !!focus && (opts2.pool ?? 1) > 0;
      if (focus) {
        const wt = world.localTransform; world.transform.updateLocalTransform();
        const p = wt.apply(new PIXI.Point(focus.x, focus.y));
        pool.position.set(p.x, p.y); pool.width = (focus.r || 900) * world.scale.x * 1.15; pool.height = pool.width * 0.7;
        pool.tint = parseInt(R.pool.slice(1), 16); pool.alpha = 0.13 * (opts2.pool ?? 1);
      }
      fogBack.visible = fogFront.visible = sys.fog > 0;
      fogBack.alpha = 0.07 * sys.fog; fogFront.alpha = 0.045 * sys.fog;
      fogBack.tilePosition.x = -t * 14; fogBack.tilePosition.y = Math.sin(t * 0.1) * 20; fogFront.tilePosition.x = t * 26 + 200;
      fogBack.tint = fogFront.tint = parseInt(R.c[1].slice(1), 16);
    };
    return sys;
  }

export { create as createPhosphor, CFG, RAMPS };
