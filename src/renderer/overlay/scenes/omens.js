// Omens during the wait: a chain rattling somewhere far off, one of your old downloads drifting past along the
// bottom of the screen (or breath condensing on the glass, with a word traced through it), and the cold creeping in
// at the edges just before they come. Nothing blocks the screen.

import { coldEdges } from "../backdrop.js";
import { rand, wait } from "../util.js";

/** Breath on the glass: fog condenses in a corner, a finger traces `word` through it, and it fades. */
async function breath(ctx, word) {
  const { stage } = ctx;
  const w = 460, h = 230, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  const fog = document.createElement("canvas"); fog.width = w; fog.height = h;
  const fg = fog.getContext("2d");
  for (let i = 0; i < 90; i++) {   // condensation: many soft, overlapping patches, densest in the middle
    const x = w / 2 + (Math.random() - 0.5) * w * 0.7, y = h / 2 + (Math.random() - 0.5) * h * 0.6, r = 30 + Math.random() * 70;
    const gr = fg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(214,226,238,0.16)"); gr.addColorStop(1, "rgba(214,226,238,0)");
    fg.fillStyle = gr; fg.fillRect(0, 0, w, h);
  }
  // feather it into an oval, so the patch has no edges
  fg.globalCompositeOperation = "destination-in";
  fg.save(); fg.translate(w / 2, h / 2); fg.scale(1, h / w);
  const edge = fg.createRadialGradient(0, 0, w * 0.18, 0, 0, w * 0.5);
  edge.addColorStop(0, "rgba(0,0,0,1)"); edge.addColorStop(1, "rgba(0,0,0,0)");
  fg.fillStyle = edge; fg.fillRect(-w / 2, -w / 2, w, w);
  fg.restore();
  const tex = PIXI.Texture.from(c);
  const sprite = new PIXI.Sprite(tex);
  sprite.position.set(stage.W - w - stage.W * 0.04, stage.H * 0.08);
  stage.layers.fx.addChild(sprite);
  const font = `italic 400 ${word.length > 8 ? 52 : 70}px "Atkinson Hyperlegible", sans-serif`;
  g.font = font;
  const tw = g.measureText(word).width, x0 = (w - tw) / 2, y0 = h / 2 + 22;
  let t = 0;
  await new Promise((resolve) => {
    const off = stage.add((_t, dt) => {
      t += dt;
      const appear = Math.min(1, t / 1.4), trace = Math.max(0, Math.min(1, (t - 1.6) / 2.6)), fade = Math.max(0, Math.min(1, (t - 5.6) / 1.6));
      g.clearRect(0, 0, w, h);
      g.globalAlpha = appear * (1 - fade);
      g.globalCompositeOperation = "source-over";
      g.drawImage(fog, 0, 0);
      // the finger: wipe the fog away along the letters, left to right
      g.save();
      g.beginPath(); g.rect(x0 - 10, 0, (tw + 20) * trace, h); g.clip();
      g.globalCompositeOperation = "destination-out";
      g.globalAlpha = 1;
      g.font = font; g.lineWidth = 6; g.lineCap = g.lineJoin = "round"; g.strokeStyle = "#000";
      g.strokeText(word, x0, y0);
      g.restore();
      tex.baseTexture.update();
      if (t > 7.4) { off(); stage.layers.fx.removeChild(sprite); sprite.destroy({ texture: true, baseTexture: true }); resolve(); }
    });
  });
}

export async function omen(ctx, { kind, files = [], icons = {}, word = null }) {
  const { stage, sound, signal } = ctx;
  stage.sys.fog = 0;
  if (kind === "rattle") { sound.rattle({ far: true, pan: rand(-0.9, 0.9), count: 6, spread: 1.4 }); return; }
  if (kind === "breath") {
    await breath(ctx, word || "4.2 GB");
  } else if (kind === "cold") {
    sound.whoosh(2.2, 0.04);
    await coldEdges(stage, 2.2);
  } else if (kind === "passing") {
    const f = files[0];
    const src = f && icons[f.id];
    const holder = new PIXI.Container();
    const glow = new PIXI.Sprite(ctx.softTexture()); glow.anchor.set(0.5); glow.width = glow.height = 110; glow.tint = 0x8ff0ee; glow.alpha = 0.35; glow.blendMode = PIXI.BLEND_MODES.ADD;
    holder.addChild(glow);
    if (src) {
      const tex = PIXI.Texture.from(src);
      const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.width = s.height = 48; s.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      holder.addChild(s);
    } else {
      const g = new PIXI.Graphics().lineStyle(2, 0xcffcfa, 0.9).beginFill(0x8ff0ee, 0.15).drawRoundedRect(-16, -20, 32, 40, 3).endFill();
      holder.addChild(g);
    }
    if (f) {
      const label = new PIXI.Text(f.name, new PIXI.TextStyle({ fontFamily: "JetBrains Mono", fontSize: 12, fill: "#eafffe", dropShadow: true, dropShadowColor: "#0b1a22", dropShadowBlur: 5, dropShadowDistance: 0 }));
      label.anchor.set(0.5, 0); label.y = 30; label.resolution = 2; holder.addChild(label);
    }
    holder.alpha = 0;
    stage.layers.iconsFront.addChild(holder);
    const y0 = ctx.floorY - 60;
    let t = 0;
    await new Promise((resolve) => {
      const off = stage.add((_t, dt) => {
        t += dt;
        const k = t / 3.4;
        holder.position.set(stage.W * (0.08 + 0.5 * k), y0 + Math.sin(t * 2.4) * 6);
        holder.alpha = 0.75 * Math.sin(Math.PI * Math.min(1, k));
        if (k >= 1) { off(); resolve(); }
      });
    });
  }
  await wait(200, signal);
  ctx.carol.done("omen");
}
