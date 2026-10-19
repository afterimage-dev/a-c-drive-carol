// Stave Two · The Ghost of Downloads Past. Your oldest forgotten files orbit him as their real Windows icons.
// Touch one and it tells you who it was; installers plead to be let go. Choices are only queued: nothing moves
// until the morning. His halo is a loading bar stuck at 99%, and completes when he leaves.

import { title, dock, fileCard, humanSize } from "../ui.js";
import { wait, tween, until, pickOne, countWords, clamp } from "../util.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function iconTexture(ctx, f) {
  const src = ctx.icons[f.id];
  if (src) { const t = PIXI.Texture.from(src); t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; return t; }
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const g = c.getContext("2d");
  g.strokeStyle = "#ffe2b8"; g.fillStyle = "rgba(255,226,184,.15)"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(7, 2); g.lineTo(20, 2); g.lineTo(26, 8); g.lineTo(26, 30); g.lineTo(7, 30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#fff4e6"; g.font = "600 7px monospace"; g.textAlign = "center"; g.fillText((f.ext || "").slice(0, 4), 16, 22);
  return PIXI.Texture.from(c);
}

/** The orbit: each file circles the spirit, oldest outermost, passing in front of and behind him. */
class Orbit {
  constructor(ctx, spirit, files) {
    this.ctx = ctx;
    this.spirit = spirit;
    this.items = [];
    this.onTap = null;
    const { stage } = ctx;
    const glowTex = ctx.softTexture();
    const n = files.length;
    files.forEach((f, i) => {
      const holder = new PIXI.Container();
      const glow = new PIXI.Sprite(glowTex); glow.anchor.set(0.5); glow.width = glow.height = 92; glow.tint = 0xffad3d; glow.alpha = 0.32; glow.blendMode = PIXI.BLEND_MODES.ADD;
      const icon = new PIXI.Sprite(iconTexture(ctx, f)); icon.anchor.set(0.5); icon.width = icon.height = 48;
      const label = new PIXI.Text(f.name, new PIXI.TextStyle({ fontFamily: "JetBrains Mono", fontSize: 12, fill: "#fff1d6", dropShadow: true, dropShadowColor: "#000", dropShadowBlur: 4, dropShadowDistance: 0 }));
      label.anchor.set(0.5, 0); label.y = 30; label.resolution = 3; label.alpha = 0;
      holder.addChild(glow, icon, label);
      holder.eventMode = "static"; holder.cursor = "pointer";
      holder.hitArea = new PIXI.Circle(0, 0, 34);
      const item = { f, holder, glow, icon, label, rank: n - 1 - i, angle: (i / n) * Math.PI * 2, hover: false, state: "orbit", t: 0, alpha: 0 };
      holder.on("pointerover", () => { item.hover = true; ctx.sound.clink(0.12, 0, 0.2); });
      holder.on("pointerout", () => { item.hover = false; });
      holder.on("pointertap", (e) => { e.stopPropagation(); if (item.state === "orbit" && this.onTap) this.onTap(item); });
      stage.layers.iconsBack.addChild(holder);
      this.items.push(item);
    });
    this.off = stage.add((t, dt) => this.update(t, dt));
  }

  get live() { return this.items.filter((i) => i.state === "orbit" || i.state === "chosen"); }

  next() { return new Promise((resolve) => { this.onTap = (item) => { this.onTap = null; resolve(item); }; }); }

  update(t, dt) {
    const { stage } = this.ctx;
    const c = this.spirit.centre();
    const n = Math.max(1, this.items.length);
    const scale = stage.H / 1080;
    // the whole orbit stops while you point at a file, so it holds still to be read
    const held = this.items.some((i) => i.hover && i.state === "orbit");
    this.spin = (this.spin ?? 1) + ((held ? 0 : 1) - (this.spin ?? 1)) * Math.min(1, dt * 6);
    for (const it of this.items) {
      it.t += dt;
      const rx = (250 + 190 * (it.rank / Math.max(1, n - 1))) * scale * 1.15, ry = rx * 0.32;
      if (it.state === "orbit" || it.state === "chosen") {
        it.angle += dt * (0.075 - 0.03 * (it.rank / n)) * (it.state === "chosen" ? 0.15 : 1) * (this.slow ? 0.3 : 1) * this.spin;
        it.alpha = Math.min(1, it.alpha + dt * 0.8);
        const x = c.x + Math.cos(it.angle) * rx, y = c.y - 20 * scale + Math.sin(it.angle) * ry;
        const front = Math.sin(it.angle) > 0;
        const want = front || it.hover || it.state === "chosen" ? stage.layers.iconsFront : stage.layers.iconsBack;
        if (it.holder.parent !== want) want.addChild(it.holder);
        it.holder.position.set(x, y);
        const depth = 0.78 + 0.22 * (Math.sin(it.angle) + 1) / 2;
        const pulse = it.pulse ? 1 + 0.18 * Math.abs(Math.sin(t * 4)) : 1;
        const big = it.state === "chosen" ? 1.6 : it.hover ? 2 : 1;
        it.grow = (it.grow ?? 1) + (big - (it.grow ?? 1)) * Math.min(1, dt * 10);
        it.holder.scale.set((it.hover || it.state === "chosen" ? 1 : depth) * pulse * it.grow);
        it.holder.alpha = it.alpha * (front || it.hover ? 0.97 : 0.6);
        if (it.hover) it.holder.parent?.setChildIndex(it.holder, it.holder.parent.children.length - 1);
        it.label.alpha += ((it.hover || it.state === "chosen" ? 1 : 0) - it.label.alpha) * Math.min(1, dt * 8);
        it.glow.alpha = 0.3 + (it.state === "chosen" ? 0.4 : 0) + 0.06 * Math.sin(t * 2 + it.rank);
      } else if (it.state === "rest") {   // sinks and dissolves, as if into the ground
        it.holder.y += dt * 60; it.holder.alpha -= dt * 0.7; it.holder.scale.x *= 1 - dt * 0.4;
      } else if (it.state === "banish") { // flung off to the nearest edge
        it.holder.x += it.vx * dt; it.holder.y += it.vy * dt; it.holder.alpha -= dt * 0.6;
      } else if (it.state === "keep") {   // rises gently and fades back into your folders
        it.holder.y -= dt * 40; it.holder.alpha -= dt * 0.5;
      }
      if (it.state !== "orbit" && it.state !== "chosen" && it.holder.alpha <= 0 && it.holder.parent) it.holder.parent.removeChild(it.holder);
    }
  }

  choose(item) { item.state = "chosen"; item.pulse = false; this.slow = true; }

  release(item, choice) {
    this.slow = false;
    item.state = choice;
    item.holder.eventMode = "none";
    if (choice === "banish") {
      const { W } = this.ctx.stage;
      const dir = item.holder.x < W / 2 ? -1 : 1;
      item.vx = dir * 900; item.vy = -120;
    }
  }

  hint() { const first = this.items.find((i) => i.state === "orbit"); if (first) first.pulse = true; }

  remove() {
    this.off();
    for (const it of this.items) it.holder.destroy({ children: true });
  }
}

export async function past(ctx) {
  const { stage, talk, night, sound, signal, decisions } = ctx;
  const { H } = stage;
  await title(ctx, "Stave Two", "The First of the Three Spirits");

  stage.ramp = "past";
  stage.setCellFor(H * 0.55);
  sound.music("past");
  const sp = stage.summon("past", { home: [0.5, 0.42], height: 0.5, wander: [0.04, 0.015], flip: true, alpha: 0 });
  sp.s.halo = 0.99;
  sound.whoosh(1.8, 0.06);
  stage.glitch(0.3);
  sp.fadeTo(1, 1.8);
  await wait(1600, signal);
  const say = (text, o = {}) => talk.say(text, { voice: "past", puppet: sp, signal, ...o });

  const files = night.past;
  if (!files.length) {
    await say(night.lines.emptyPast);
  } else {
    const orbit = new Orbit(ctx, sp, files);
    await talk.ask("I am the Ghost of Downloads Past.", [["long", "Long past?", true]], { voice: "past", puppet: sp, signal });
    await say("No. Your past. These are but shadows of the files that have been.");
    await say("Touch one, and it will tell you who it was.");

    const bar = dock(ctx, "Touch a file to hear it", [["enough", "Enough, spirit"]], { accent: "#ffb347" });
    const enough = bar.choice();
    let handled = 0;
    const autoChoices = ["rest", "banish", "keep"];
    while (orbit.live.length) {
      const hintTimer = setTimeout(() => orbit.hint(), 9000);
      const auto = ctx.settings.autoplay ? wait(2200, signal).then(() => orbit.items.find((i) => i.state === "orbit")) : new Promise(() => {});
      const picked = await Promise.race([orbit.next(), enough.then(() => "enough"), auto, until(() => {}, signal)]);
      clearTimeout(hintTimer);
      if (picked === "enough" || !picked || (ctx.settings.autoplay && handled >= 3)) break;
      orbit.choose(picked);
      bar.el.classList.remove("on");
      const choice = await fileCard(ctx, picked.f, { auto: ctx.settings.autoplay ? autoChoices[handled % 3] : null });
      decisions.add(choice, picked.f);
      orbit.release(picked, choice);
      if (choice === "rest") sound.whoosh(0.9, 0.04);
      const reaction = pickOne(night.lines.pastReactions[{ rest: "layToRest", banish: "banish", keep: "keep" }[choice]]).replace("{name}", picked.f.name);
      await say(reaction, { hold: 1300 });
      handled++;
      if (orbit.live.length) bar.el.classList.add("on");
    }
    bar.hide();

    const rested = decisions.rest.filter((f) => files.some((p) => p.id === f.id));
    const bytes = rested.reduce((s, f) => s + f.size, 0);
    await say(rested.length ? `My time grows short. ${cap(countWords(rested.length))} laid to rest. ${humanSize(bytes)} returned to you.` : "My time grows short.");
    orbit.slow = true;
    await say("These things were what they were. That they are what they are, do not blame me.", { hold: 1600 });
    // the halo completes
    await tween(1200, (k) => { sp.s.halo = 0.99 + 0.01 * k; }, signal);
    sp.s.haloFlash = 0.9;
    sound.clink(0.3, 0, 0.8);
    const flash = stage.add((t, dt) => { sp.s.haloFlash = clamp(sp.s.haloFlash - dt * 0.8); });
    await wait(1300, signal);
    flash();
    orbit.items.forEach((it) => { if (it.state === "orbit") it.state = "keep"; });
    await wait(400, signal);
    orbit.remove();
  }

  // he smiles, and dissolves into pixels
  sound.music(null);
  sp.s.pRate = 8;
  stage.glitch(0.3, 0.6);
  sp.fadeTo(0, 1.8);
  await wait(2000, signal);
  sp.remove();
  stage.sys.clearParticles();
}
