// Watches your Downloads folder for one thing: a new file that's an exact copy of one you already have.
// Read-only, like the scan. A twin flickers at the edge of the screen; nothing moves unless you say so.

import fs from "node:fs";
import path from "node:path";
import { findSameSize, hashFile, describe, placeOf } from "../../core/scan.js";

const PARTIAL = /\.(crdownload|part|tmp|download|partial)$|^~\$|^\./i;
const SETTLE_MS = 3000;
const MIN_SIZE = 1024;

export class DownloadWatcher {
  /** @param {{ roots: object, crypt: string, cloud: string[], onTwin: (group) => void }} o */
  constructor({ roots, crypt, cloud, onTwin }) {
    this.roots = roots; this.crypt = crypt; this.cloud = cloud; this.onTwin = onTwin;
    this.timers = new Map();
    this.checked = new Map();   // name -> when it was last looked at (reading files can itself raise change events)
    this.watcher = null;
  }

  start() {
    if (this.watcher || !fs.existsSync(this.roots.Downloads)) return;
    try {
      // "rename" is a file appearing (a finished download is renamed into place); ignore edits to existing files
      this.watcher = fs.watch(this.roots.Downloads, (event, name) => { if (event === "rename" && name && !PARTIAL.test(name)) this.settle(name); });
      this.watcher.on("error", () => this.stop());
    } catch { this.watcher = null; }
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /** Wait until a file stops changing (the download has finished), then look for its twins. */
  settle(name) {
    if (Date.now() - (this.checked.get(name) || 0) < 120000) return;
    clearTimeout(this.timers.get(name));
    this.timers.set(name, setTimeout(() => { this.timers.delete(name); this.checked.set(name, Date.now()); this.check(path.join(this.roots.Downloads, name)); }, SETTLE_MS));
  }

  check(abs) {
    let st;
    try { st = fs.statSync(abs, { bigint: true }); } catch { return; }
    if (!st.isFile() || Number(st.size) < MIN_SIZE) return;
    const twins = findTwins(abs, st, this.roots);
    if (!twins.length) return;
    const entries = [{ abs, rel: placeOf(abs, this.roots) || "Downloads", st }, ...twins];
    this.onTwin(describe(entries, { roots: this.roots, crypt: this.crypt, cloud: this.cloud }));
  }
}

/** Files elsewhere in your folders that are byte-for-byte the same as `abs`. */
export function findTwins(abs, st, roots) {
  const same = findSameSize(roots, Number(st.size), abs).filter((f) => !(f.st.ino && f.st.ino === st.ino && f.st.dev === st.dev));
  if (!same.length) return [];
  let mine;
  try { mine = hashFile(abs); } catch { return []; }
  return same.filter((f) => { try { return hashFile(f.abs) === mine; } catch { return false; } });
}
