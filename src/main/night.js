// Everything the overlay needs for one night, worked out before the spirits arrive so the visit never waits.
// Built from a manifest (real or sample); the renderer only ever gets this, and sends back file ids.

import path from "node:path";
import { pastCandidates, presentGroups, linesFor, claimLine, epitaphFor, humanSize, facts } from "../../core/manifest.js";
import { pick, LINES } from "../../core/spirit-lines.js";

const DAY = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_GROUPS = 12;
const fmtCount = (n) => n.toLocaleString("en-GB");
const shortDate = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

function installerNote(f) {
  const i = f.installer;
  if (!i) return null;
  if (!i.installed) return `${i.product} is not installed`;
  return `${i.product}${i.installed.version ? " " + i.installed.version : ""} is installed`;
}

/** What a file card shows: the facts, flagged where they're simulated. */
function card(f, m) {
  const fx = facts(f, m);
  return {
    id: f.id,
    name: f.name,
    ext: path.extname(f.name).slice(1).toLowerCase(),
    kind: f.kind,
    folder: f.folder,
    size: f.size,
    sizeText: humanSize(f.size),
    age: fx.age,
    days: fx.days,
    arrived: `${shortDate(f.downloadedAt)}, ${fx.time}`,
    site: f.origin?.site || null,
    installer: installerNote(f),
    simulated: f.simulated
  };
}

/**
 * @param {import("../../core/manifest.js").Manifest} m
 * @param {{ again?: boolean, fled?: boolean, previousCount?: number }} [opts]  previousCount: files at the last warning
 */
export function prepareNight(m, { again = false, fled = false, previousCount = null } = {}) {
  const total = m.files.reduce((s, f) => s + f.size, 0);
  const anySimulatedSize = m.files.some((f) => f.simulated.includes("size"));

  const past = pastCandidates(m).map((f) => {
    const { pool, lines } = linesFor(f, m);
    return { ...card(f, m), pool, lines, pleads: pool.startsWith("installer"), epitaph: epitaphFor(f, m) };
  });

  const groups = presentGroups(m).slice(0, MAX_GROUPS).map((g) => ({
    id: g.id,
    original: g.original,
    size: g.files[0].size,
    wasted: g.files[0].size * (g.files.length - 1),
    files: g.files.map((f) => ({ ...card(f, m), date: shortDate(f.downloadedAt), claim: claimLine(f, g.files, m), cloudSynced: !!f.cloudSynced }))
  }));
  const extraCopies = presentGroups(m).reduce((s, g) => s + g.files.length - 1, 0);

  const biggest = [...m.files].sort((a, b) => b.size - a.size).slice(0, 6).map((f) => card(f, m));

  // Marlware's warning, with tonight's numbers in it
  const opening = [];
  if (fled) opening.push(pick("marlware.afterEsc"));
  const longer = previousCount != null && m.files.length > previousCount ? fmtCount(m.files.length - previousCount) : undefined;
  if (again) opening.push(pick("marlware.warningAgain", { count: longer }));
  else {
    opening.push("Do not be alarmed. I was Jacob Marlware, quarantined these seven years.");
    opening.push(`Would you know the weight and length of the chain you bear? It is ${humanSize(total)} heavy, and ${fmtCount(m.files.length)} links long.`);
    opening.push("Every file you saved and never opened is a link in it. I dragged mine through every folder of the machine that held me.");
    opening.push("You have yet a chance of escaping my fate. You will be haunted by three spirits. Expect the first within the half hour.");
  }

  return {
    mode: m.mode,
    createdAt: m.createdAt,
    simulated: m.mode === "sample",
    simulatedSizes: anySimulatedSize,
    marlware: {
      opening,
      replies: {
        here: "Then mind the hour. Look to see me no more.",
        notTonight: pick("marlware.notTonight"),
        giveUp: pick("marlware.giveUp"),
        now: "Impatient, as the living always are. Very well."
      }
    },
    chain: { total, totalText: humanSize(total), count: m.files.length, biggest },
    past,
    present: { groups, extraCopies },
    drive: { ...m.drive },
    lines: {
      pastReactions: LINES.pastReactions,
      presentReactions: LINES.presentReactions,
      emptyPast: LINES.empty.past[0],
      emptyPresent: LINES.empty.present[0]
    }
  };
}

/** Old downloads for the passing-file omen: the oldest few still in Downloads or on the Desktop. */
export function omenFiles(m, count = 3) {
  return pastCandidates(m, { minAgeDays: 30, limit: count }).slice(0, count).map((f) => ({ id: f.id, name: f.name, path: f.path }));
}

/** The word traced through the breath on the glass: the size of the heaviest old download. */
export function omenWord(m) {
  const old = pastCandidates(m, { minAgeDays: 30, limit: 50 });
  const big = old.reduce((a, f) => (!a || f.size > a.size ? f : a), null);
  return big ? humanSize(big.size) : null;
}

export { humanSize, DAY };
