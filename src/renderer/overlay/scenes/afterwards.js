// Afterwards: between nights the haunting carries on lightly. A new download that's an exact copy of a file you
// already have flickers as a twin at the edge of the screen; a banished file whose thirty days are up drifts back as a
// wisp. Touch one for a short visit about just that file, ending in the same review: nothing moves without Wake up.

import { Backdrop } from "../backdrop.js";
import { presentRow, fileCard, review, candle, humanSize } from "../ui.js";
import { queue } from "./visit.js";
import { wait, until, pickOne, el } from "../util.js";

const LIFETIME = 90;   // seconds an apparition waits to be noticed before fading

/** The flicker at the edge. Resolves true if touched, false if it fades unnoticed. */
export async function apparition(ctx, { kind, files, icons }) {
  const { stage, sound, signal } = ctx;
  stage.sys.fog = 0;
  const first = kind === "twin" ? files.groups?.[0]?.files?.[0] : files[0];
  const src = first && icons[first.id];
  const tint = kind === "twin" ? 0x9dff9f : 0xffad3d;
  const holder = new PIXI.Container();
  const glow = new PIXI.Sprite(ctx.softTexture()); glow.anchor.set(0.5); glow.width = glow.height = 150; glow.tint = tint; glow.blendMode = PIXI.BLEND_MODES.ADD;
  holder.addChild(glow);
  const copies = (kind === "twin" ? [-1, 1] : [0]).map((side) => {
    const s = src ? new PIXI.Sprite(PIXI.Texture.from(src)) : new PIXI.Sprite(ctx.softTexture());
    s.anchor.set(0.5); s.width = s.height = 48; s.tint = kind === "wisp" ? 0xffe2b8 : 0xffffff;
    s.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    s.side = side; holder.addChild(s); return s;
  });
  const x = stage.W - 70, y = stage.H * 0.42;
  holder.position.set(x, y);
  holder.alpha = 0;
  stage.layers.iconsFront.addChild(holder);
  ctx.hitTests.push((px, py) => Math.hypot(px - x, py - y) < 60);
  let touched = false, t = 0;
  ctx.onPointerDown((px, py) => { if (Math.hypot(px - x, py - y) < 60) { touched = true; return true; } return false; });
  if (kind === "twin") sound.glitch(0.2); else sound.whoosh(1.6, 0.04);
  if (ctx.settings.autoplay) setTimeout(() => (touched = true), 3000);
  const result = await until((resolve) => {
    const off = stage.add((_t, dt) => {
      t += dt;
      const flick = kind === "twin" ? (Math.random() < 0.12 ? 0.25 : 1) : 0.7 + 0.3 * Math.sin(t * 2.1);
      holder.alpha = Math.min(1, t / 1.2) * Math.min(1, (LIFETIME - t) / 3) * flick;
      copies.forEach((c) => { c.x = c.side * (8 + 6 * Math.sin(t * 9 + c.side)) ; c.y = Math.sin(t * 1.4 + c.side) * 6; c.alpha = c.side ? 0.8 : 0.7; });
      if (kind === "wisp") holder.y = y + Math.sin(t * 0.8) * 14;
      glow.alpha = 0.3 + 0.12 * Math.sin(t * 3);
      if (touched || t > LIFETIME) { off(); resolve(touched); }
    });
  }, signal);
  if (result) sound.clink(0.4, 0.8);
  ctx.carol.done("apparition", { summon: result });
}

/** A short visit: one spirit, one file or one set of twins, then the review. */
export async function mini(ctx, { kind, backdrop: bytes }) {
  const { stage, talk, night, sound, signal, ui } = ctx;
  ctx.decisions = queue();
  ctx.returnDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  stage.sys.fog = 1;
  const backdrop = ctx.backdrop = new Backdrop(stage);
  await backdrop.show(bytes);
  const stopCandle = candle(stage);
  ui.appendChild(el("div", "esc-hint", "Click or Space to go on · Esc to wake"));
  backdrop.set({ dim: 0.62, flicker: 0.5, frost: 0.3, warp: 4 }, { dim: 0.4, frost: 0.05, warp: 1 });
  await wait(1200, signal);

  if (kind === "twin") {
    const g = night.present.groups[0];
    stage.ramp = "present";
    stage.setCellFor(stage.H * 0.56);
    sound.music("present");
    const sp = stage.summon("present", { home: [0.5, 0.38], height: 0.56, wander: [0.03, 0.02], alpha: 0 });
    sp.sp.setTwins(Math.min(6, g.files.length - 1));
    sp.fadeTo(1, 1); stage.glitch(0.3);
    await wait(900, signal);
    const say = (text, o = {}) => talk.say(text, { voice: "present", puppet: sp, signal, ...o });
    await say("Another brother! Come, come.");
    const row = presentRow(ctx, g, { top: Math.min(stage.H * 0.62, ctx.floorY - 300) });
    await row.argue();
    if (ctx.settings.autoplay) setTimeout(() => row.choose(g.original), 1500);
    const picked = await Promise.race([row.choice(), until(() => {}, signal)]);
    if (picked === "all") {
      g.files.forEach((f) => ctx.decisions.add("keep", f));
      await row.remove();
      await say(pickOne(night.lines.presentReactions.keepAll));
    } else {
      g.files.filter((f) => f.id !== picked && !f.cloudSynced).forEach((f) => ctx.decisions.add("impostors", f));
      row.fall(picked);
      setTimeout(() => { sp.s.begone = true; stage.glitch(0.3, 1); sound.glitch(0.3); }, 600);
      await say("Impostors, begone!", { hold: 1500 });
      await row.remove();
    }
    sp.fadeTo(0, 1.2); stage.glitch(0.3);
    await wait(1300, signal);
    sp.remove();
  } else {
    const f = night.past[0];
    stage.ramp = "past";
    stage.setCellFor(stage.H * 0.5);
    sound.music("past");
    const sp = stage.summon("past", { home: [0.5, 0.4], height: 0.5, wander: [0.04, 0.015], flip: true, alpha: 0 });
    sp.s.halo = 0.99;
    sp.fadeTo(1, 1.4); stage.glitch(0.3);
    await wait(1200, signal);
    const say = (text, o = {}) => talk.say(text, { voice: "past", puppet: sp, signal, ...o });
    await say("I told you it would return.");
    const choice = await fileCard(ctx, f, { auto: ctx.settings.autoplay ? "rest" : null });
    ctx.decisions.add(choice, f);
    await say(pickOne(night.lines.pastReactions[{ rest: "layToRest", banish: "banish", keep: "keep" }[choice]]).replace("{name}", f.name), { hold: 1300 });
    sp.fadeTo(0, 1.4);
    await wait(1500, signal);
    sp.remove();
  }

  sound.music(null);
  backdrop.set({ dim: 0.3, frost: 0, warp: 0, flicker: 0 }, { dim: 0.5, frost: 0.3, warp: 4, flicker: 1 });
  const panel = review(ctx, ctx.decisions.lists());
  const ticked = await panel.wake();
  const result = await ctx.carol.wake(ticked);
  await panel.result(result);
  panel.el.querySelector(".tiny")?.remove();
  panel.el.querySelectorAll(".note, .actions").forEach((e) => (e.style.opacity = "1"));
  backdrop.set({ dim: 0 }, { dim: 0.3 });
  await until((resolve) => {
    panel.el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b?.dataset.act === "crypt") ctx.carol.openCrypt();
      if (b?.dataset.act === "close") resolve();
    });
    if (ctx.settings.autoplay) setTimeout(resolve, 3000);
  }, signal);
  stopCandle();
  ctx.carol.done("mini");
}

export { humanSize };
