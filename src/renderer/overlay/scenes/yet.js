// Stave Four · The Spirit of Disk Space Yet to Come. He never speaks. The screen goes dark but for your candle, and
// he can only be seen where its light falls; your thoughts wait until you've found him. He never moves while you're
// looking: when your light leaves him there's a black, glitched instant and he's nearer. Everything falls silent, a
// thud, and a frosted gravestone rises. The chisel carves beneath the frost; your candle has to melt it to read your
// own name, what your drive died of, and how long it has, while a heartbeat quickens and your candle gutters. If you
// chose anything tonight the date is scratched out and carved later; if not, it's carved again, deeper.

import { title } from "../ui.js";
import { Stone } from "../stone.js";
import { darkness } from "../backdrop.js";
import { wait, tween, until, clamp } from "../util.js";
import { daysUntil, fullLine, redemption } from "../../../../core/epitaph.js";

// where he stands at each step closer: x and height as fractions of the screen; the candle gutters as he nears
const STEPS = [
  { x: 0.2, y: 0.5, h: 0.5, gutter: 0 },
  { x: 0.27, y: 0.5, h: 0.6, gutter: 0.3 },
  { x: 0.32, y: 0.5, h: 0.71, gutter: 0.6 },
  { x: 0.36, y: 0.52, h: 0.84, gutter: 0.85 }
];
const PARTS = [[256, 108], [300, 300], [52, 406], [380, 432], [300, 560]];   // hood, chest, pointing hand, hand, robe

export async function yet(ctx) {
  const { stage, talk, sound, signal, decisions, backdrop, carol, night } = ctx;
  const { W, H } = stage;
  await title(ctx, "Stave Four", "The Last of the Spirits");

  // the dark: only your candle shows anything now, your desktop drained of colour and freezing over beneath it
  sound.music(null);   // nothing for him but the wind
  sound.wind(true);
  backdrop.set({ dim: 0.45, flicker: 0, frost: 0.72, drain: 1 }, { dim: 0.3, frost: 0.022, drain: 0.035 });
  const dark = darkness(stage);
  const flame = ctx.candle;
  stage.ramp = "yet";
  stage.poolLevel = 0;
  stage.sys.fog = 0.25;
  stage.sys.ambient = 0.03;   // all but invisible without your light...
  stage.sys.fall = 9;         // ...and your light only reaches so far
  stage.sys.rimAtt = 1;       // even his outline only catches light near the flame
  stage.sys.candleLight = 1.5;

  const sp = stage.summon("yet", { home: [STEPS[0].x, STEPS[0].y], height: STEPS[0].h, wander: [0.003, 0.003], facing: -1, alpha: 0, pace: 0.3, k: 0.9, d: 1.5 });
  sp.jump(W * STEPS[0].x, H * STEPS[0].y);
  stage.setCellFor(H * STEPS[0].h);
  sp.fadeTo(1, 3);
  const stone = ctx.stone = new Stone(stage, sound);
  stone.layout({ x: W * 0.73, baseY: (ctx.floorY ?? H) + 6, size: 0.54 });
  stone.ambient = 0.1; stone.fall = 0.00004;

  // how well your candle lights him, 0..1, and his shedding pixels follow it so they don't give him away
  const lit = () => {
    const p = stage.ptr;
    if (!p.seen) return 0;
    const d = Math.min(...PARTS.map(([x, y]) => { const w = sp.sp.bodyToWorld(x, y); return Math.hypot(p.x - w.x, p.y - w.y); }));
    return clamp(1 - (d - sp.h * 0.12) / (sp.h * 0.3));
  };
  const shed = stage.add(() => { sp.s.pRate = lit(); });   // no drifting pixels to give him away in the dark

  /** Resolves once he has been lit for `ms` without a break. Glints to show where he is if you can't find him. */
  const found = (ms = 1000) => until((resolve) => {
    let held = 0, waited = 0, glinted = false;
    const off = stage.add((_t, dt) => {
      held = lit() > 0.35 ? held + dt * 1000 : 0;
      waited += dt * 1000;
      if (!glinted && waited > 10000) { glinted = true; tween(1400, (k) => { sp.s.pins = Math.sin(Math.PI * k); }, signal).catch(() => {}); }
      if (held >= ms || waited > (ctx.settings.autoplay ? 3000 : 25000)) { off(); resolve(); }
    });
  }, signal);

  /** He comes nearer, but only once your light has left him (or after a few seconds): a black, glitched instant. */
  let step = 0;
  const closer = async () => {
    if (step >= STEPS.length - 1) return;
    await until((resolve) => {
      let t = 0;
      const off = stage.add((_t, dt) => { t += dt; if (lit() < 0.15 || t > 3.5) { off(); resolve(); } });
    }, signal);
    const s = STEPS[++step];
    dark.black = 1; stage.glitch(0.12, 1); sound.glitch(0.12);
    await wait(90, signal);
    sp.height = s.h; sp.home = [s.x, s.y]; sp.jump(W * s.x, H * s.y);
    stage.setCellFor(H * s.h);
    flame.gutter = s.gutter; dark.gutter = s.gutter;
    await wait(60, signal);
    dark.black = 0;
  };

  const think = (text) => talk.say(text, { voice: "you", signal, hold: 2600 + text.length * 30, afraid: true });   // you are afraid of him
  await wait(2500, signal);
  await found(1000);   // not a word until you've seen him, for more than a second
  await think("I fear you more than any spectre I have seen.");
  await closer();
  await found(1000);
  await think("You are about to show me the shadows of the drive that will be?");
  await closer();

  // no answer. Silence: the wind stops dead. Then something heavy, close, and the stone rises, frosted over.
  await wait(600, signal);
  sound.wind(false, { fast: true });   // a last gust, then nothing at all...
  await wait(2400, signal);
  sound.thud();                        // ...then something heavy, very close
  sound.heartbeat(56);
  const arm = stage.add((t, dt) => { sp.s.arm += (1 - sp.s.arm) * Math.min(1, dt * 1.5); });
  stone.frost();
  stone.raise();
  await wait(1800, signal);
  sound.wind(true);
  const now = await carol.forecast(0);
  const days = now ? daysUntil(now.full) : 365;
  const grave = night.grave ?? { owner: "YOUR C:", cause: "DIED OF DOWNLOADS" };

  // the chisel works beneath the frost: you hear every letter, but you can't read them yet
  sound.heartbeat(66);
  await stone.carveLine(0, "HERE LIES");
  await wait(1100, signal);                                  // a pause before the name
  await stone.carveLine(1, grave.owner, { speed: 4.5 });
  sound.heartbeat(80);
  await stone.carveLine(2, grave.cause);
  await stone.carveLine(3, fullLine(days));
  sound.heartbeat(92);

  // read it: bring your light to the stone and melt the frost. When your own name comes clear, your heart stops.
  await until((resolve) => {
    let t = 0, since = 0, named = false;
    const off = stage.add((_t, dt) => {
      t += dt; since += dt;
      if (since < 0.25) return;
      since = 0;
      if (!named && stone.cleared(1) > 0.5) {
        named = true;
        sound.heartbeat(0);
        setTimeout(() => sound.heartbeat(112), 1600);
      }
      const all = stone.cleared();
      if (all > 0.6 || t > (ctx.settings.autoplay ? 5 : 30)) {   // or, if you never come, the frost thaws by itself
        off();
        if (all <= 0.6) { stone.thaw(); if (!named) sound.heartbeat(104); }
        resolve();
      }
    });
  }, signal);
  await wait(1400, signal);

  await think("Are these the shadows of the things that will be, or of things that may be, only?");
  await closer();
  sp.s.tremble = 1;
  await tween(1600, (k) => { sp.s.pins = k; }, signal);

  // what tonight changed: the date scratched out and carved later, or the days it bought carved beneath. If
  // nothing, the same date is carved again, deeper, and the candle all but goes out.
  const queued = decisions.queuedBytes();
  let redeemed = false;
  if (queued > 0) {
    const later = await carol.forecast(queued);
    const change = redemption(days, later ? daysUntil(later.redeemed) : days);
    await wait(600, signal);
    if (change.kind === "rewrite") { await stone.strike(3); await stone.carveLine(3, change.line, { speed: 6 }); redeemed = true; }
    else if (change.kind === "more") { await stone.carveLine(4, change.line); redeemed = true; }
  }
  if (redeemed) {
    flame.gutter = 0; dark.gutter = 0;   // the flame steadies
    sound.heartbeat(74);
  } else {
    await stone.deepen(3);
    flame.gutter = 1; dark.gutter = 1;
  }
  await wait(1200, signal);

  // your vow, in your own voice (or, if you chose nothing, simply waking)
  await talk.reply([["wake", queued > 0 ? "I will keep my drive in my heart, and tidy it all the year." : "Wake."]], { signal });

  // he shrinks, collapses, and dwindles into your cursor; the heartbeat stops dead
  arm();
  shed();
  sp.s.pRate = 1;
  sound.heartbeat(0);
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
  // light returns for the morning
  dark.target = 0;
  flame.gutter = 0;
  stage.sys.ambient = 1; stage.sys.fall = 1; stage.sys.rimAtt = 0; stage.sys.candleLight = 1; stage.poolLevel = 1;
  stone.ambient = 0.35; stone.fall = 0;
  backdrop.set({ drain: 0 }, { drain: 0.4 });
  await wait(900, signal);
  dark.stop();
}
