// Development: hear each spirit's theme in turn, with Next and Stop. Clicks pass through everywhere else.

import { el, until, wait } from "../util.js";

const THEMES = [
  ["marl", "Jacob Marlware", "cold and low, a minor drone that never resolves"],
  ["past", "The Ghost of Downloads Past", "melancholy, minor chords that drift slowly"],
  ["present", "The Ghost of Filesystems Present", "bright major chords on a reedy organ, swaying"]
];

export async function music(ctx, { theme } = {}) {
  const { sound, ui, signal } = ctx;
  const first = Math.max(0, THEMES.findIndex(([key]) => key === theme));
  const panel = el("div", "music-panel interactive");
  ui.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add("on"));
  try {
    for (let i = first; i < THEMES.length; i++) {
      const [key, who, how] = THEMES[i];
      panel.innerHTML = `<span class="stave">Theme ${i + 1} of ${THEMES.length}</span><strong>${who}</strong><span class="how">${how}</span>
        <div class="choices"><button type="button" data-act="next">${i < THEMES.length - 1 ? "Next" : "Finish"}</button><button type="button" data-act="stop">Stop</button></div>`;
      sound.music(key);
      const act = await Promise.race([
        until((resolve) => panel.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) resolve(b.dataset.act); }, { once: false }), signal),
        wait(40000, signal).then(() => "next")
      ]);
      if (act === "stop") break;
    }
  } finally {
    sound.music(null);
    panel.classList.remove("on");
  }
  await wait(1500, signal);
  ctx.carol.done("omen");
}
