// Stave Four · The Spirit of Disk Space Yet to Come. He never speaks. Your own thoughts carry the scene, everything
// falls silent but the wind, and a gravestone rises to carve the month your drive will be full. If you chose
// anything tonight, a second, later date carves itself beneath.

import { title, dock } from "../ui.js";
import { Stone } from "../stone.js";
import { wait, tween } from "../util.js";

export async function yet(ctx) {
  const { stage, talk, sound, signal, decisions, backdrop, carol } = ctx;
  const { W, H } = stage;
  await title(ctx, "Stave Four", "The Last of the Spirits");

  sound.wind(true);
  backdrop.set({ dim: 0.86, flicker: 0.25 }, { dim: 0.12 });
  stage.ramp = "yet";
  stage.setCellFor(H * 0.74);
  const sp = stage.summon("yet", { home: [0.68, 0.5], height: 0.74, wander: [0.004, 0.004], alpha: 0 });
  sp.jump(W * 0.9, H * 0.52);
  sp.k = 0.9; sp.d = 1.5;
  sp.fadeTo(1, 4);
  const stone = ctx.stone = new Stone(stage, sound);
  stone.layout({ x: W * 0.27, baseY: (ctx.floorY ?? H) + 6, size: 0.44 });
  await wait(3600, signal);

  const think = (text) => talk.say(text, { voice: "you", at: "topLeft", signal, hold: 2600 + text.length * 30 });
  await think("I fear you more than any spectre I have seen.");
  await think("You are about to show me the shadows of the drive that will be?");
  await wait(1400, signal);   // no answer

  // he raises one wireframe arm; the stone rises
  const arm = stage.add((t, dt) => { sp.s.arm += (1 - sp.s.arm) * Math.min(1, dt * 1.5); });
  stone.raise();
  sound.whoosh(2.4, 0.05);
  await wait(1800, signal);
  const now = await carol.forecast(0);
  await stone.carveLine(0, "HERE LIES C:");
  await stone.carveLine(1, `FULL · ${now?.fullLabel ?? "SOON"}`);
  await wait(1400, signal);

  await think("Are these the shadows of the things that will be, or of things that may be, only?");
  sp.s.tremble = 1;
  await tween(1600, (k) => { sp.s.pins = k; }, signal);

  const queued = decisions.queuedBytes();
  if (queued > 0) {
    const later = await carol.forecast(queued);
    await wait(600, signal);
    await stone.carveLine(2, `OR · ${later?.redeemedLabel ?? ""}`);
  }
  await wait(1200, signal);

  const bar = dock(ctx, "", [["wake", queued > 0 ? "I will keep my drive in my heart, and tidy it all the year" : "Wake", true]], { accent: "#a194de" });
  bar.el.querySelector("span").remove();
  bar.el.style.paddingLeft = "8px";
  if (ctx.settings.autoplay) setTimeout(() => bar.el.querySelector("button").click(), 2000);
  await Promise.race([bar.choice(), wait(1e9, signal)]);
  bar.hide();

  // he shrinks, collapses, and dwindles into your cursor
  arm();
  sp.s.tremble = 0;
  const from = sp.height;
  sound.whoosh(1.4, 0.05);
  await tween(1700, (k) => {
    sp.moveTo(stage.ptr.x, stage.ptr.y, 9, 5);
    sp.height = Math.max(0.01, from * (1 - k));
    sp.s.alpha = 1 - k * k;
  }, signal);
  sp.remove();
  sound.wind(false);
  stage.sys.clearParticles();
}
