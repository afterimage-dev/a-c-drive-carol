// Stave Five · The End of It. Morning: birdsong, your desktop comes back, and one review of tonight's choices.
// Nothing has moved until now. Wake up lays everything chosen in the Crypt at once, the counter rolls up, and the
// gravestone cracks. Nothing is ever deleted.

import { title, review } from "../ui.js";
import { Stone } from "../stone.js";
import { wait, tween, until } from "../util.js";

export async function morning(ctx) {
  const { stage, talk, sound, signal, decisions, backdrop, carol } = ctx;
  const { W, H } = stage;
  await title(ctx, "Stave Five", "The End of It");

  sound.birds(18);
  backdrop.set({ dim: 0.18, frost: 0, warp: 0, flicker: 0 }, { dim: 0.45, frost: 0.35, warp: 4, flicker: 1 });
  // the stone stands behind the review, waiting to break
  const stone = ctx.stone || new Stone(stage, sound);
  await tween(600, (k) => { stone.alpha = 1 - k; }, signal);
  stone.layout({ x: W / 2, baseY: H * 0.9, size: 0.6 });
  stone.raise();
  stone.rise = 1;
  await tween(900, (k) => { stone.alpha = 0.9 * k; }, signal);

  await talk.say("Yes! And the desktop was your own. The Downloads folder was your own.", { voice: "narrator", at: "top", signal });
  await talk.say("Best of all, the time before you was your own, to make amends in.", { voice: "narrator", at: "top", signal });
  backdrop.set({ dim: 0.32 });

  const panel = review(ctx, decisions.lists());
  const ticked = await panel.wake();
  ctx.woke = true;
  const result = await carol.wake(ticked);
  stone.crack();
  await panel.result(result);
  const tiny = panel.el.querySelector(".tiny");
  const line = "And so, as Tiny.tmp observed: Git bless us, every one, and every zero.";
  await tween(line.length * 55, (k) => { tiny.textContent = line.slice(0, Math.round(line.length * k)); }, signal, (k) => k);
  await wait(600, signal);
  panel.el.querySelectorAll(".note, .actions").forEach((e) => (e.style.opacity = "1"));
  backdrop.set({ dim: 0 }, { dim: 0.2 });

  await until((resolve) => {
    panel.el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.act === "crypt") { ctx.openCryptAfter = true; resolve(); }   // close first, or Explorer opens behind us
      if (b.dataset.act === "close") resolve();
    });
    if (ctx.settings.autoplay) setTimeout(resolve, 4000);
  }, signal);
  panel.el.classList.remove("on");
  await wait(700, signal);
}
