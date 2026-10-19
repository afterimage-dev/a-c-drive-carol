// The bell tolls. Your desktop dims to a third of its brightness, frost creeps in from the edges, and Marlware
// drifts in at full size, his chain dragging, to say they're coming. Then he rises out of frame.

import { Chain } from "../chain.js";
import { wait, tween } from "../util.js";

export async function bell(ctx) {
  const { stage, talk, night, sound, signal, backdrop } = ctx;
  const { W, H } = stage;
  await wait(400, signal);
  sound.bell();
  backdrop.set({ dim: 0.68, flicker: 0.6 }, { dim: 0.34, flicker: 0.5 });
  await wait(2200, signal);
  backdrop.set({ frost: 0.55, warp: 6 }, { frost: 0.02, warp: 1.5 });

  // chains drag somewhere off to the right
  sound.rattle({ count: 9, spread: 1.6, pan: 0.85, strength: 0.5 });
  stage.ramp = "marl";
  const h = H * 0.56;
  stage.setCellFor(h);
  const marl = stage.summon("marl", { home: [0.6, 0.5], height: 0.56, wander: [0.08, 0.03], flip: true, alpha: 0 });
  marl.jump(W + h * 0.6, H * 0.52);
  marl.facing = 1;
  const exts = [...new Set(night.chain.biggest.map((f) => (f.ext ? "." + f.ext : ".?")))];
  const chain = new Chain(stage, marl, { links: 40, floorY: H - 4, exts, sound, walls: false });
  marl.fadeTo(1, 1.4);
  await wait(2600, signal);

  await talk.say("The bell has struck One. They come.", { voice: "marl", puppet: marl, signal });

  // he bows his head, and rises out of frame with his chain trailing after him
  await tween(900, (k) => { marl.s.nod = k; }, signal);
  await wait(500, signal);
  sound.whoosh(1.6, 0.06);
  // keep rising until the last link of the chain has cleared the top of the screen
  marl.moveTo(marl.M.x - W * 0.05, -H * 2.6, 1.6, 1.7);
  await Promise.race([chain.gone((e) => e.maxY < -20), wait(1e9, signal)]);
  chain.remove();
  marl.remove();
  sound.scrape(0);
  await wait(1000, signal);   // silence, for one beat
}
