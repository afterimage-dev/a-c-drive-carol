// Omens during the wait: a chain rattling somewhere far off, one of your old downloads drifting past along the
// bottom of the screen, and the cold creeping in at the edges just before they come. Nothing blocks the screen.

import { coldEdges } from "../backdrop.js";
import { rand, wait } from "../util.js";

export async function omen(ctx, { kind, files = [], icons = {} }) {
  const { stage, sound, signal } = ctx;
  stage.sys.fog = 0;
  if (kind === "rattle") { sound.rattle({ far: true, pan: rand(-0.9, 0.9), count: 6, spread: 1.4 }); return; }
  if (kind === "cold") {
    sound.whoosh(2.2, 0.04);
    await coldEdges(stage, 2.2);
  } else if (kind === "passing") {
    const f = files[0];
    const src = f && icons[f.id];
    const holder = new PIXI.Container();
    if (src) {
      const tex = PIXI.Texture.from(src);
      const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.width = s.height = 48; s.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      holder.addChild(s);
    } else {
      const g = new PIXI.Graphics().lineStyle(2, 0xcffcfa, 0.9).beginFill(0x8ff0ee, 0.15).drawRoundedRect(-16, -20, 32, 40, 3).endFill();
      holder.addChild(g);
    }
    if (f) {
      const label = new PIXI.Text(f.name, new PIXI.TextStyle({ fontFamily: "JetBrains Mono", fontSize: 12, fill: "#dffcfb" }));
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
        holder.alpha = 0.55 * Math.sin(Math.PI * Math.min(1, k));
        if (k >= 1) { off(); resolve(); }
      });
    });
  }
  await wait(200, signal);
  ctx.carol.done("omen");
}
