// A C-Drive Carol: build the demo night.
//
// Creates a folder of tiny sample files (a few hundred bytes each, under 20 KB in all) that stand in for old
// downloads, installers and duplicates, and writes manifest.json describing them as the spirits should see them.
// Sizes, dates and history are simulated and flagged; duplicates are real identical copies, so hashing runs for real;
// on Windows each file gets a real "downloaded from" record (Zone.Identifier), so the origin lookup runs for real too.
//
//   node make-sample.js                  -> Documents/A C-Drive Carol/Sample
//   node make-sample.js D:\somewhere     -> a folder of your choosing
//
// Nothing outside the chosen folder is touched. Running it again resurrects anything resting in the sample Crypt
// and writes fresh copies over the sample files. Nothing is deleted.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { resurrect } from "./crypt.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function defaultSampleRoot() {
  return path.join(os.homedir(), "Documents", "A C-Drive Carol", "Sample");
}

/** "426 days ago at 21:37", optionally moved to the nearest earlier given weekday. */
function when(ago, now = new Date()) {
  const d = new Date(now.getTime() - ago.days * DAY);
  if (ago.weekday) {
    const target = WEEKDAYS.indexOf(ago.weekday);
    while (d.getDay() !== target) d.setTime(d.getTime() - DAY);
  }
  if (ago.at) { const [h, m] = ago.at.split(":").map(Number); d.setHours(h, m, Math.floor(Math.random() * 50), 0); }
  return d;
}

function contents(entry) {
  // Duplicates share their text exactly; everything else is unique.
  const label = entry.same ? `duplicate set "${entry.same}"` : entry.id;
  const text = [
    "A C-Drive Carol sample file.",
    `This is not a real ${entry.kind}. It is a few bytes pretending to be something larger, for the demo.`,
    `Sample: ${label}`,
    ""
  ].join("\r\n");
  // padded to 1.5 KB so the real duplicate check (which ignores files under 1 KB) still finds the sample doubles
  return text + "~".repeat(Math.max(0, 1536 - text.length - 2)) + "\r\n";
}

function zoneIdentifier(origin) {
  return ["[ZoneTransfer]", "ZoneId=3", `ReferrerUrl=https://${origin.site}/`, `HostUrl=${origin.url || `https://${origin.site}/`}`, ""].join("\r\n");
}

/** Build the sample folder and return its manifest (also written to <root>/manifest.json). */
export function makeSample(root = defaultSampleRoot(), { now = new Date() } = {}) {
  const spec = JSON.parse(fs.readFileSync(path.join(HERE, "sample-manifest.json"), "utf8"));
  root = path.resolve(root);
  if (fs.existsSync(root) && fs.readdirSync(root).length) {
    // Only ever reuse a folder this script made. Nothing is deleted: anything resting in the sample Crypt is
    // resurrected first, then each sample file is simply written over with a fresh copy.
    if (!fs.existsSync(path.join(root, ".carol-sample"))) throw new Error(`${root} isn't empty and isn't a sample folder. Choose an empty or new folder.`);
    resurrect(path.join(root, "Crypt"));
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, ".carol-sample"), "Made by A C-Drive Carol's make-sample.js. Safe to delete.\r\n");
  const crypt = path.join(root, "Crypt");
  fs.mkdirSync(crypt, { recursive: true });

  const files = [];
  const hashes = new Map();
  for (const e of spec.files) {
    const abs = path.join(root, ...e.path.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const body = contents(e);
    fs.writeFileSync(abs, body);
    const downloaded = when(e.ago, now);
    const opened = e.opened ? when({ days: e.opened.days, at: e.ago.at }, now) : null;
    fs.utimesSync(abs, opened || downloaded, downloaded);
    if (process.platform === "win32" && e.origin) {
      try { fs.writeFileSync(abs + ":Zone.Identifier", zoneIdentifier(e.origin)); } catch { /* not NTFS: skip */ }
    }
    const hash = e.same ? crypto.createHash("sha256").update(body).digest("hex") : null;
    if (hash) hashes.set(e.same, hash);
    const parts = e.path.split("/");
    files.push({
      id: e.id,
      path: abs,
      name: parts[parts.length - 1],
      folder: parts.slice(0, -1).join("/"),
      kind: e.kind,
      size: e.size,
      downloadedAt: downloaded.toISOString(),
      lastOpenedAt: opened ? opened.toISOString() : null,
      origin: e.origin || null,
      hash,
      group: e.same || null,
      installer: e.installer ? {
        product: e.installer.product,
        version: e.installer.version,
        installed: e.installer.installed ? {
          version: e.installer.installed.version,
          installDate: new Date(now.getTime() - e.installer.installed.daysAgo * DAY).toISOString()
        } : null
      } : null,
      timesBanished: e.timesBanished || 0,
      simulated: ["size", "downloadedAt", "lastOpenedAt", ...(e.installer ? ["installer"] : [])]
    });
  }
  const groups = [...hashes.entries()].map(([id, hash]) => ({ id, hash, members: files.filter((f) => f.group === id).map((f) => f.id) }));

  const manifest = {
    version: 1,
    mode: "sample",
    createdAt: now.toISOString(),
    roots: { Downloads: path.join(root, "Downloads"), Desktop: path.join(root, "Desktop"), Documents: path.join(root, "Documents") },
    crypt,
    accessTimesReliable: true,
    drive: { ...spec.drive, simulated: true },
    files,
    groups
  };
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || defaultSampleRoot();
  const m = makeSample(root);
  const bytes = m.files.reduce((s, f) => s + fs.statSync(f.path).size, 0);
  console.log(`Made ${m.files.length} sample files (${bytes} bytes on disk) and ${m.groups.length} duplicate sets in ${root}`);
  console.log(`Manifest: ${path.join(root, "manifest.json")}`);
}
