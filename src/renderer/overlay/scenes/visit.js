// The visit, in Dickens's staves: the bell, the Past, the Present, Yet to Come, and the morning. Choices made along
// the way are only queued here; the main process moves files after Wake up, and Esc throws the queue away.

import { Backdrop } from "../backdrop.js";
import { bell } from "./bell.js";
import { past } from "./past.js";
import { present } from "./present.js";
import { yet } from "./yet.js";
import { morning } from "./morning.js";
import { candle } from "../ui.js";
import { el } from "../util.js";

const ORDER = ["bell", "past", "present", "yet", "morning"];
const STAVES = { bell, past, present, yet, morning };
const DAY = 86400000;

/** Tonight's queue: what you chose for each file, last choice wins. */
export function queue() {
  const choice = new Map();   // id -> { kind, file }
  return {
    add(kind, file) { choice.set(file.id, { kind, file }); },
    get rest() { return [...choice.values()].filter((c) => c.kind === "rest").map((c) => c.file); },
    lists() {
      const out = { rest: [], impostors: [], banish: [], keep: [] };
      for (const { kind, file } of choice.values()) out[kind]?.push(file);
      return out;
    },
    queuedBytes() { return [...choice.values()].filter((c) => c.kind === "rest" || c.kind === "impostors").reduce((s, c) => s + c.file.size, 0); }
  };
}

export async function visit(ctx, { backdrop: bytes }) {
  const { ui, stage, night } = ctx;
  ctx.decisions = queue();
  ctx.returnDate = new Date(Date.now() + 30 * DAY).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  stage.sys.fog = 1;
  ctx.backdrop = new Backdrop(stage);
  await ctx.backdrop.show(bytes);
  const flame = ctx.candle = candle(stage);
  ui.appendChild(el("div", "esc-hint", "Click or Space to go on · Esc to wake"));
  if (night.simulated) ui.appendChild(el("div", "sample-tag", "Sample files"));

  const start = Math.max(0, ORDER.indexOf(ctx.settings.startAt || "bell"));
  if (start > 0) ctx.backdrop.set({ dim: 0.68, frost: 0.4, warp: 5, flicker: 0.6 }, { dim: 5, frost: 5, warp: 50, flicker: 5 });
  for (const name of ORDER.slice(start)) await STAVES[name](ctx);

  flame.stop();
  ctx.carol.done("morning", { openCrypt: !!ctx.openCryptAfter });
}
