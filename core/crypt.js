// A C-Drive Carol: the Crypt.
//
// The spirits never delete anything. "Lay to rest" moves a file into the Crypt folder and writes down where it
// came from; "Resurrect" moves it back. Burying a file for good is something only the user does, by emptying the
// Crypt themselves in File Explorer. This module contains no code that deletes files.
//
// Moves only, never copies: on the same drive a move is a rename, so no duplicate is ever made. A file on a
// different drive from the Crypt is left where it is and reported, rather than copied across.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const LOG = "crypt-log.json";

function readLog(crypt) {
  try { return JSON.parse(fs.readFileSync(path.join(crypt, LOG), "utf8")); }
  catch { return { version: 1, entries: [] }; }
}
function writeLog(crypt, log) {
  fs.mkdirSync(crypt, { recursive: true });
  fs.writeFileSync(path.join(crypt, LOG), JSON.stringify(log, null, 2));
}
/** A name that doesn't clash with anything already in `dir`: "report.pdf", then "report (resting 2).pdf"... */
function freeName(dir, name, tag) {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  let candidate = name, n = 1;
  while (fs.existsSync(path.join(dir, candidate))) { n++; candidate = `${stem} (${tag} ${n})${ext}`; }
  return candidate;
}
/** True if `p` is inside one of `roots` (the folders the user agreed to let the spirits look at). */
function inside(p, roots) {
  const r = path.resolve(p).toLowerCase();
  return roots.some((root) => { const base = path.resolve(root).toLowerCase(); return r === base || r.startsWith(base + path.sep); });
}

/**
 * Lay files to rest: move each into the Crypt and log where it came from.
 * @param {import("./manifest.js").Manifest} m
 * @param {string[]} ids  file ids from the manifest
 * @returns {{moved: string[], skipped: {id: string, reason: string}[]}}
 */
export function layToRest(m, ids) {
  fs.mkdirSync(m.crypt, { recursive: true });
  const log = readLog(m.crypt);
  const files = new Map(m.files.map((f) => [f.id, f]));
  const moved = [], skipped = [];
  for (const id of ids) {
    const f = files.get(id);
    if (!f) { skipped.push({ id, reason: "not in the manifest" }); continue; }
    if (!inside(f.path, Object.values(m.roots))) { skipped.push({ id, reason: "outside the folders you allowed" }); continue; }
    if (f.cloudSynced) { skipped.push({ id, reason: "it lives in a cloud-synced folder, so it was left where it is" }); continue; }
    if (!fs.existsSync(f.path)) { skipped.push({ id, reason: "no longer there" }); continue; }
    const dest = path.join(m.crypt, freeName(m.crypt, f.name, "resting"));
    try {
      fs.renameSync(f.path, dest);
    } catch (err) {
      skipped.push({ id, reason: err.code === "EXDEV" ? "on a different drive from the Crypt, so it was left where it is" : err.message });
      continue;
    }
    // manifest ids are only unique within one night, so every entry gets its own key
    log.entries.push({ key: crypto.randomUUID(), id, name: f.name, from: f.path, to: dest, size: f.size, simulatedSize: f.simulated.includes("size"), at: new Date().toISOString(), resurrected: null });
    moved.push(id);
  }
  writeLog(m.crypt, log);
  return { moved, skipped };
}

/**
 * Resurrect files: move them back to exactly where they were. `keys` are log entry keys (see `resting`); with no
 * keys, resurrects everything in the Crypt. If something new now sits at the original path, the file comes back
 * beside it as "name (resurrected).ext".
 */
export function resurrect(crypt, keys = null) {
  const log = readLog(crypt);
  const back = [], skipped = [];
  for (const e of log.entries) {
    const key = e.key ?? e.id;
    if (e.resurrected || (keys && !keys.includes(key))) continue;
    if (!fs.existsSync(e.to)) { skipped.push({ id: e.id, key, reason: "no longer in the Crypt (buried?)" }); continue; }
    const dir = path.dirname(e.from);
    fs.mkdirSync(dir, { recursive: true });
    const name = fs.existsSync(e.from) ? freeName(dir, path.basename(e.from), "resurrected") : path.basename(e.from);
    const dest = path.join(dir, name);
    try {
      fs.renameSync(e.to, dest);
    } catch (err) {
      skipped.push({ id: e.id, key, reason: err.code === "EXDEV" ? "its old folder is on a different drive now" : err.message });
      continue;
    }
    e.resurrected = new Date().toISOString();
    e.returnedTo = dest;
    back.push(key);
  }
  writeLog(crypt, log);
  return { back, skipped };
}

/** What's resting now: count, bytes as the spirits describe them, and whether any size is simulated. */
export function resting(crypt) {
  const entries = readLog(crypt).entries.filter((e) => !e.resurrected && fs.existsSync(e.to)).map((e) => ({ ...e, key: e.key ?? e.id }));
  return {
    count: entries.length,
    bytes: entries.reduce((s, e) => s + (e.size || 0), 0),
    simulated: entries.some((e) => e.simulatedSize),
    entries
  };
}
