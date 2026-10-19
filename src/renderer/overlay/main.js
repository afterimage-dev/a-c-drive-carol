// The overlay's entry point: sets the stage, then plays whatever the main process asks for. Esc (or any failure)
// ends a visit at once, with nothing applied.

import { createStage } from "./stage.js";
import { Sound } from "./audio.js";
import { Dialogue } from "./dialogue.js";
import { warning } from "./scenes/warning.js";
import { visit } from "./scenes/visit.js";
import { omen } from "./scenes/omens.js";
import { apparition, mini } from "./scenes/afterwards.js";
import { music } from "./scenes/music.js";
import { Aborted } from "./util.js";

const carol = window.carol;
const ui = document.getElementById("ui");
const stage = await createStage(document.getElementById("stage"));
const sound = new Sound();
const talk = new Dialogue(stage, sound, ui);

let soft = null;
function softTexture() {
  if (soft) return soft;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (soft = PIXI.Texture.from(c));
}

let run = null;   // { kind, ctx, ac }

// development: report the frame rate while something is on screen
let frames = 0, since = performance.now();
stage.app.ticker.add(() => {
  frames++;
  const now = performance.now();
  if (now - since < 5000) return;
  if (run?.ctx.settings.dev) {
    const lv = sound.level();
    carol.log(`${run.kind}: ${(frames * 1000 / (now - since)).toFixed(0)} fps at ${stage.W}x${stage.H}@${devicePixelRatio}x, cell ${stage.sys.cell}` +
      (lv ? ` · sound ${lv.theme} peak ${lv.peak.toFixed(2)} rms ${lv.rms.toFixed(3)}` : ""));
  }
  frames = 0; since = now;
});
let hovering = false;

function makeCtx(kind, payload, signal) {
  const settings = payload.settings || {};
  if (payload.size) stage.resize(payload.size.width, payload.size.height);
  sound.configure(settings);
  talk.autoplay = !!settings.autoplay;
  const wa = payload.workArea;
  stage.floorY = wa ? wa.y + wa.height : stage.H;
  stage.glowStrength = settings.glow ?? 1;
  const pointerDown = [], pointerUp = [];
  return {
    kind, carol, stage, sound, talk, ui, signal, settings,
    night: payload.night, icons: payload.icons || {}, thumbs: payload.thumbs || {}, refusals: payload.refusals || 0,
    floorY: stage.floorY,
    softTexture,
    hitTests: [],
    onPointerDown: (fn) => pointerDown.push(fn),
    onPointerUp: (fn) => pointerUp.push(fn),
    pointerDown, pointerUp
  };
}

function reset() {
  talk.hide();
  stage.clear();
  sound.stopAll();
  for (const c of [...ui.children]) if (c !== talk.card) c.remove();
  document.body.classList.remove("visit");
  if (hovering) { hovering = false; carol.hover(false); }
}

async function play(kind, scene, payload) {
  if (run) { run.ac.abort(); reset(); }
  const ac = new AbortController();
  const ctx = makeCtx(kind, payload, ac.signal);
  run = { kind, ctx, ac };
  document.body.classList.toggle("visit", kind === "visit");
  try {
    await scene(ctx, payload);
  } catch (err) {
    if (!(err instanceof Aborted)) {
      console.error(err);
      carol.log(`The ${kind} failed: ${err?.stack || err}`);
      // never leave anything stuck on the screen
      if (kind === "visit") carol.escape(); else carol.done(kind);
    }
  } finally {
    if (run?.ac === ac) { run = null; reset(); }
  }
}

carol.on("scene", (p) => {
  if (p.name === "warning") play("warning", warning, p);
  else if (p.name === "visit") play("visit", visit, p);
  else if (p.name === "apparition") play("apparition", apparition, p);
  else if (p.name === "mini") play("visit", mini, p);
  else if (p.name === "music") play("music", music, p);
});
carol.on("omen", (p) => { if (!run) play("omen", omen, p); });
carol.on("esc", () => { if (run) { run.ac.abort(); run = null; reset(); } });
carol.on("settings", (s) => { sound.configure(s); stage.glowStrength = s.glow ?? 1; });

// ---------- input ----------
// While the overlay lets clicks through, tell the main process when the pointer is over something touchable.
function overSomething(x, y) {
  const t = document.elementFromPoint(x, y);
  if (t && t.closest(".card.on, .interactive, button")) return true;
  return !!run?.ctx.hitTests.some((fn) => fn(x, y));
}
addEventListener("mousemove", (e) => {
  if (!run || run.kind === "visit") return;
  const over = overSomething(e.clientX, e.clientY);
  if (over !== hovering) { hovering = over; carol.hover(over); }
});
addEventListener("pointerdown", (e) => {
  if (!run) return;
  sound.ensure();
  if (e.target.closest("button, input, label, summary, .file, .copy, .review")) return;
  if (run.ctx.pointerDown.some((fn) => fn(e.clientX, e.clientY))) return;
  talk.advance();
});
addEventListener("pointerup", () => run?.ctx.pointerUp.forEach((fn) => fn()));
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && run?.kind === "visit") { carol.escape(); return; }
  if ((e.key === " " || e.key === "Enter") && run && !e.target.closest("button")) { e.preventDefault(); talk.advance(); }
});
