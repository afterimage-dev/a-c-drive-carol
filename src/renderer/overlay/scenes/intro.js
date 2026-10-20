// The opening: a title page, then the book's first lines retold ("Marley was dead: to begin with."), Jacob Marlware's
// eulogy, one sentence at a time, before he appears in Stave One. Every night begins with it; Skip intro goes straight
// to him. Clicks pass through to your desktop everywhere except the button.

import { el, esc, wait, until, tween } from "../util.js";

const EULOGY = [
  "Jacob Marlware was dead, to begin with.",
  "There is no doubt whatever about that.",
  "The record of his removal was signed by the antivirus, the Task Manager, the Registry, and Windows Update.",
  "Old Marlware was as dead as a floppy disk."
];

export async function intro(ctx) {
  const { stage, sound, signal, ui } = ctx;
  const veil = new PIXI.Graphics().beginFill(0x050508).drawRect(0, 0, stage.W, stage.H).endFill();
  veil.alpha = 0;
  stage.layers.dim.addChild(veil);
  const titlePage = el("div", "title-page", `<h1>A C-Drive Carol</h1><hr><p>A retelling of one of the greatest ghost stories ever written</p>`);
  const page = el("div", "intro-page");
  page.innerHTML = EULOGY.map((line, i) => `<p class="${i === 0 ? "first" : ""}">${i === 0 ? `<span class="cap">${esc(line[0])}</span>${esc(line.slice(1))}` : esc(line)}</p>`).join("");
  const skip = el("button", "skip-intro interactive", "Skip intro");
  skip.type = "button";
  ui.append(titlePage, page, skip);
  sound.music("marl", { level: 0.4 });

  let skipped = false;
  const skipNow = until((resolve) => skip.addEventListener("click", () => { skipped = true; sound.clink(0.3); resolve(); }), signal);
  const play = (async () => {
    await tween(900, (k) => { veil.alpha = 0.78 * k; }, signal);
    requestAnimationFrame(() => skip.classList.add("on"));
    titlePage.classList.add("on");   // the title page
    await wait(4200, signal);
    if (skipped) return;
    titlePage.classList.remove("on");
    await wait(1100, signal);
    for (const p of page.querySelectorAll("p")) {
      if (skipped) return;
      p.classList.add("on");
      await wait(1600 + p.textContent.length * 38, signal);
    }
    await wait(1200, signal);
  })();
  try {
    await Promise.race([play, skipNow]);
  } finally {
    page.classList.add("gone");
    titlePage.classList.remove("on");
    skip.classList.remove("on");
    await tween(skipped ? 450 : 1100, (k) => { veil.alpha = Math.min(veil.alpha, 0.78 * (1 - k)); }, signal).catch(() => {});
    page.remove(); titlePage.remove(); skip.remove();
    stage.layers.dim.removeChild(veil); veil.destroy();
  }
}
