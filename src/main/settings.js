// Settings and the spirits' memory, kept in userData/settings.json. Read with care; a broken file means defaults.

import fs from "node:fs";
import path from "node:path";

export const DEFAULTS = Object.freeze({
  version: 1,
  consented: false,          // agreed on the first-run screen
  sound: true,
  volume: 0.5,               // quiet by default
  startWithWindows: false,   // opt-in only
  glow: 1,
  mode: null,                // "real" | "sample": the kind of night last chosen
  scheduler: null,           // the scheduler's persisted state
  kept: [],                  // [{ path, size }] never asked about again
  banished: [],              // [{ path, size, until, times }] return after 30 days
  chainLinkUntil: null       // the morning-after chain link shows until this time
});

export function loadSettings(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ...DEFAULTS, ...raw, kept: Array.isArray(raw.kept) ? raw.kept : [], banished: Array.isArray(raw.banished) ? raw.banished : [] };
  } catch {
    return { ...DEFAULTS, kept: [], banished: [] };
  }
}

export function saveSettings(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".new";
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, file);   // replaces the old file in one step, so a crash can't leave half a file
}
