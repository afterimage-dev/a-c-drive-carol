// Stave One · Marlware's Ghost. A warning, not a takeover: he appears small in the corner, the screen isn't dimmed,
// and clicks go straight through to your desktop everywhere except on him, his chain and his card.

import { Chain } from "../chain.js";
import { wait } from "../util.js";

export async function warning(ctx) {
  const { stage, talk, night, sound, signal } = ctx;
  const { W, H } = stage;
  const floor = ctx.floorY;
  const h = H * 0.56 / 3 * 1.15;
  stage.ramp = "marl";
  stage.setCellFor(h * 1.6);
  stage.sys.fog = 0;   // no fog over your whole desktop for a warning
  const x = W - h * 0.55 - 36, y = floor - h * 0.62;

  const marl = stage.summon("marl", { home: [x / W, y / H], height: h / H, wander: [0.012, 0.006], flip: false, alpha: 0 });
  marl.jump(x, y);

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
  sound.clink(0.5, 0.7);
  await wait(1500, signal);

  const lines = night.marlware.opening;
  for (let i = 0; i < lines.length - 1; i++) {
    await talk.say(lines[i], { voice: "marl", puppet: marl, signal });
    if (/chain you bear/.test(lines[i])) {   // the chain uncoils a little
      marl.moveTo(x - h * 0.8, y - h * 0.05, 3, 2.6);
      await wait(1400, signal);
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
    marl.moveTo(W + h * 1.4, y + h * 0.05, 2.2, 2.4);
    await wait(3200, signal);
  } else {
    stage.glitch(0.35);
    sound.whoosh(1.2, 0.07);
    marl.fadeTo(0, 1.1);
    await wait(1300, signal);
  }
  shadeOff();
  chain.remove();
  ctx.carol.done("warning");
}
