// Stave One · Marlware's Ghost. A warning, not a takeover: he appears small in the corner, the screen isn't dimmed,
// and clicks go straight through to your desktop everywhere except on him, his chain and his card.

import { Chain } from "../chain.js";
import { wait, el, clamp } from "../util.js";

/** Dark towards the far corners, clear around (fx, fy): a light pool round his corner, the rest in shadow. */
function cornerVignette(W, H, fx, fy) {
  const c = document.createElement("canvas"); c.width = 480; c.height = Math.round(480 * H / W);
  const g = c.getContext("2d"), cx = fx * c.width, cy = fy * c.height, r = Math.hypot(c.width, c.height);
  const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.9);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.12, "rgba(0,0,0,0.25)"); gr.addColorStop(0.32, "rgba(0,0,0,0.7)");
  gr.addColorStop(0.55, "rgba(0,0,0,0.84)"); gr.addColorStop(1, "rgba(0,0,0,0.9)");
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  return PIXI.Texture.from(c);
}

export async function warning(ctx) {
  const { stage, talk, night, sound, signal } = ctx;
  const { W, H } = stage;
  const floor = ctx.floorY;
  const h = H * 0.56 / 3 * 1.15;
  stage.ramp = "marl";
  stage.setCellFor(h * 1.6);
  stage.sys.fog = 0;   // no fog over your whole desktop for a warning
  const x = W - h * 0.55 - 36, y = floor - h * 0.62;

  const marl = stage.summon("marl", { home: [x / W, y / H], height: h / H, wander: [0.012, 0.006], flip: false, alpha: 0, pace: 0.45, k: 1.6, d: 2.4 });
  marl.jump(x, y);

  // the rest of the screen darkens towards its other three corners; his corner stays as it was
  const vignette = new PIXI.Sprite(cornerVignette(W, H, x / W, y / H));
  vignette.width = W; vignette.height = H; vignette.alpha = 0;
  stage.layers.dim.addChild(vignette);
  const vignetteOff = stage.add(() => { vignette.alpha = marl.s.alpha; });

  // a soft shadow behind him, so the phosphor reads even over a bright window
  const shade = new PIXI.Sprite(ctx.softTexture());
  shade.anchor.set(0.5); shade.tint = 0x000000; shade.width = h * 1.9; shade.height = h * 1.5; shade.alpha = 0;
  stage.layers.dim.addChild(shade);
  const shadeOff = stage.add(() => { shade.alpha = 0.42 * marl.s.alpha; shade.position.set(marl.M.x - h * 0.05, marl.M.y + h * 0.02); });
  const exts = [...new Set(night.chain.biggest.map((f) => (f.ext ? "." + f.ext : ".?")))];
  const chain = new Chain(stage, marl, { links: 30, floorY: floor, exts, sound });
  ctx.hitTests.push((px, py) => {
    const b = marl.bounds();
    return (px > b.x + b.w * 0.15 && px < b.x + b.w * 0.85 && py > b.y && py < b.y + b.h * 0.8) || chain.hit(px, py) >= 0;
  });
  ctx.onPointerDown((px, py) => { const i = chain.hit(px, py); if (i > 0) { chain.take(i); return true; } return false; });
  ctx.onPointerUp(() => chain.drop());

  marl.fadeTo(1, 1.4);
  sound.clink(0.6, 0.7, 0.6, 0, { heavy: true });
  sound.music("marl", { level: 0.55 });   // quieter: your desktop isn't dimmed for a warning
  await wait(1200, signal);

  // the stave's title, small, in his corner: where his first line will appear, gone before it does
  const title = el("div", "corner-title", `<span class="stave">Stave One</span><span class="name">Marlware's Ghost</span>`);
  ctx.ui.appendChild(title);
  const top = marl.headTop();
  title.style.left = `${Math.round(clamp(top.x - title.offsetWidth / 2, 12, W - title.offsetWidth - 12))}px`;
  title.style.top = `${Math.round(top.y - title.offsetHeight - 14)}px`;
  requestAnimationFrame(() => title.classList.add("on"));
  try {
    await wait(2800, signal);
    title.classList.remove("on");
    await wait(700, signal);
  } finally {
    title.remove();
  }
  if (ctx.settings.fling) {   // development: whirl a link round his hand, then let go
    const ptr = stage.ptr, hand = chain.hand();
    chain.take(12);
    const start = performance.now();
    const off = stage.add(() => {
      const k = (performance.now() - start) / 1000;
      ptr.x = hand.x + Math.cos(k * 9) * h * 0.55; ptr.y = hand.y + Math.sin(k * 9) * h * 0.55;
    });
    await wait(2500, signal);
    off(); chain.drop();
  }

  const lines = night.marlware.opening;
  for (let i = 0; i < lines.length - 1; i++) {
    await talk.say(lines[i], { voice: "marl", puppet: marl, signal });
    if (/chain you bear/.test(lines[i])) {   // the chain uncoils a little
      marl.moveTo(x - h * 0.8, y - h * 0.05, 1.3, 2.2);
      await wait(2200, signal);
      marl.roam();
    }
  }
  const answer = await talk.ask(lines.at(-1), [["here", "I shall be here"], ["notTonight", "Not tonight, spirit"], ["now", "Bring them now", true]], { voice: "marl", puppet: marl, signal, auto: ctx.settings.autoAnswer || "now" });
  ctx.carol.answer(answer);

  const R = night.marlware.replies;
  const reply = answer === "notTonight" && ctx.refusals >= 2 ? R.giveUp : R[answer];
  await talk.say(reply, { voice: "marl", puppet: marl, signal });

  if (answer === "here") {
    // he drags the chain off-screen
    // until the whole chain has been dragged off the right edge
    chain.walls = false;
    marl.moveTo(W + h * 6, y + h * 0.05, 1.2, 2.2);
    await Promise.race([chain.gone((e) => e.minX > W + 20), wait(1e9, signal)]);
  } else {
    stage.glitch(0.35);
    sound.whoosh(1.2, 0.07);
    marl.fadeTo(0, 1.1);
    await wait(1300, signal);
  }
  shadeOff();
  vignetteOff();
  chain.remove();
  sound.music(null);
  ctx.carol.done("warning");
}
