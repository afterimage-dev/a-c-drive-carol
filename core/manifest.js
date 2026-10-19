// A C-Drive Carol: the haunting manifest.
//
// Everything the spirits say comes from a manifest. A real run builds one with scan.js; a demo run builds one
// with make-sample.js. Both produce exactly the same shape, so the rest of the app never needs to know which
// kind of night it is.
//
// In a sample manifest the files on disk are real but tiny. Fields that would be impossible or unkind to make
// real (a 5.8 GB size, a download two years ago at 2:14 a.m.) are recorded in the manifest and listed in each
// file's `simulated` array, so the interface can label them.

/**
 * @typedef {Object} HauntFile
 * @property {string}   id             stable id within this manifest
 * @property {string}   path           absolute path of the real file on disk
 * @property {string}   name           file name, e.g. "vlc-3.0.20-win64.exe"
 * @property {string}   folder         where it lives, e.g. "Downloads" or "Documents/Reports"
 * @property {string}   kind           installer | document | image | video | audio | archive | diskImage | spreadsheet | code | other
 * @property {number}   size           bytes, as the spirits should describe it
 * @property {string}   downloadedAt   ISO date-time it arrived
 * @property {string|null} lastOpenedAt ISO date-time last opened, or null if never (or unknown, see accessTimesReliable)
 * @property {{site: string, url?: string}|null} origin  where it was downloaded from, if Windows recorded it
 * @property {string|null} hash        sha256 of the contents, only computed for possible duplicates
 * @property {string|null} group       duplicate group id, or null
 * @property {Installer|null} installer
 * @property {number}   timesBanished  how many times it has been banished before
 * @property {string[]} simulated      names of fields that are simulated (sample mode only)
 * @property {boolean}  [cloudSynced]  true if it lives in a cloud-synced folder (OneDrive); never moved
 *
 * @typedef {Object} Installer
 * @property {string}      product     product name, e.g. "VLC media player"
 * @property {string|null} version     the installer's version
 * @property {{version: string|null, installDate: string|null}|null} installed  the installed copy, or null
 *
 * @typedef {Object} Manifest
 * @property {1}        version
 * @property {"real"|"sample"} mode
 * @property {string}   createdAt
 * @property {Object<string,string>} roots   e.g. { Downloads: "C:\\Users\\me\\Downloads", ... }
 * @property {string}   crypt          the Crypt folder
 * @property {boolean}  accessTimesReliable  whether "never opened" can be trusted on this machine
 * @property {{total: number, free: number, growthPerMonth: number, simulated: boolean}} drive
 * @property {HauntFile[]} files
 * @property {{id: string, hash: string, members: string[]}[]} groups
 */

import { pick, ageWords, timeWords, timeOfDayPool, dateWords, clockWords, numberWords } from "./spirit-lines.js";

const DAY = 86400000;

// ---------- Small formatters ----------
export function humanSize(bytes) {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return i === 0 ? `${n} bytes` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TYPE_WORDS = {
  installer: "an installer", document: "a document", image: "a picture", video: "a film", audio: "a recording",
  archive: "a compressed archive", diskImage: "a disk image", spreadsheet: "a spreadsheet", code: "a piece of code", other: "a file"
};

export const byId = (m) => new Map(m.files.map((f) => [f.id, f]));
const daysSince = (iso, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));
const isCopyName = (name) => /\(\d+\)|^copy of |\s-\scopy\b/i.test(name);

// ---------- Choosing who haunts ----------

/** Old, forgotten files for the Ghost of Downloads Past. Duplicates are left for the Present. Oldest first. */
export function pastCandidates(m, { minAgeDays = 30, limit = 16 } = {}) {
  const oldestFirst = (a, b) => Date.parse(a.downloadedAt) - Date.parse(b.downloadedAt);
  const pool = m.files
    .filter((f) => !f.group && !f.cloudSynced)
    .filter((f) => daysSince(f.downloadedAt) >= minAgeDays)
    .filter((f) => /^(Downloads|Desktop)/.test(f.folder) || f.timesBanished > 0);
  // installers always get their say; the oldest of everything else fills the rest
  const installers = pool.filter((f) => f.installer).sort(oldestFirst);
  const rest = pool.filter((f) => !f.installer).sort(oldestFirst).slice(0, Math.max(0, limit - installers.length));
  return [...installers, ...rest].sort(oldestFirst);
}

/** Duplicate groups for the Ghost of Filesystems Present, each with a suggested original and every copy's claim. */
export function presentGroups(m) {
  const idx = byId(m);
  return m.groups.map((g) => {
    const files = g.members.map((id) => idx.get(id)).filter(Boolean);
    const original = suggestOriginal(files);
    return { ...g, files, original: original.id, claims: Object.fromEntries(files.map((f) => [f.id, claimFor(f, files)])) };
  }).sort((a, b) => b.files[0].size * (b.files.length - 1) - a.files[0].size * (a.files.length - 1));
}

/** The eldest, in the tidiest house, with the cleanest name has the best claim. */
export function suggestOriginal(files) {
  const score = (f) => (isCopyName(f.name) ? 0 : 4) + (/^(Downloads|Desktop)$/.test(f.folder) ? 0 : 3) - Date.parse(f.downloadedAt) / 1e14;
  return [...files].sort((a, b) => score(b) - score(a))[0];
}

/** Which real argument a copy makes in Stave Three. */
export function claimFor(f, files) {
  const oldest = [...files].sort((a, b) => Date.parse(a.downloadedAt) - Date.parse(b.downloadedAt))[0];
  if (f === oldest && files.some((o) => o !== f && Date.parse(o.downloadedAt) - Date.parse(f.downloadedAt) > DAY)) return "oldest";
  if (!/^(Downloads|Desktop)$/.test(f.folder)) return "tidiestFolder";
  if (!isCopyName(f.name) && files.some((o) => isCopyName(o.name))) return "cleanestName";
  const opened = files.filter((o) => o.lastOpenedAt).sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  if (opened[0] === f) return "mostOpened";
  const newest = [...files].sort((a, b) => Date.parse(b.downloadedAt) - Date.parse(a.downloadedAt))[0];
  if (f === newest) return "newest";
  return "weakClaim";
}

// ---------- Facts, for filling line templates ----------
export function facts(f, m) {
  const d = new Date(f.downloadedAt);
  const days = daysSince(f.downloadedAt);
  const siteCount = f.origin ? m.files.filter((o) => o.origin && o.origin.site === f.origin.site).length : 0;
  return {
    name: f.name,
    type: TYPE_WORDS[f.kind] || TYPE_WORDS.other,
    size: humanSize(f.size),
    site: f.origin ? f.origin.site : undefined,
    time: timeWords(d),
    clock: clockWords(d),
    weekday: WEEKDAYS[d.getDay()],
    date: dateWords(d),
    age: ageWords(days),
    days,
    folder: f.folder.includes("/") ? f.folder.split("/").pop() : `your ${f.folder}`,
    count: siteCount || undefined,
    others: siteCount > 1 ? numberWords(siteCount - 1) : undefined,
    times: f.timesBanished ? (["", "once", "twice", "three times", "four times", "five times"][f.timesBanished] || `${f.timesBanished} times`) : undefined,
    app: f.installer ? f.installer.product : undefined,
    version: f.installer && f.installer.version ? f.installer.version : undefined,
    newVersion: f.installer && f.installer.installed && f.installer.installed.version ? f.installer.installed.version : undefined,
    installDate: f.installer && f.installer.installed && f.installer.installed.installDate ? dateWords(new Date(f.installer.installed.installDate)) : undefined
  };
}

/** Compare dotted versions: -1 if a is older than b, 0 if equal, 1 if newer. */
export function compareVersions(a, b) {
  const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number), pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Which pool of lines a file speaks from in Stave Two (first match wins, as set out in spirit-lines.js). */
export function poolFor(f, m) {
  if (f.installer) {
    const inst = f.installer.installed;
    if (!inst) return "installer.notInstalled";
    if (!f.installer.version || !inst.version || compareVersions(f.installer.version, inst.version) === 0) return "installer.sameVersion";
    return compareVersions(f.installer.version, inst.version) < 0 ? "installer.olderVersion" : "installer.notInstalled";
  }
  if (f.timesBanished > 0) return "returning";
  const h = new Date(f.downloadedAt).getHours();
  if (h < 5) return "timeOfDay.lateNight";
  if (f.size > 1024 ** 3) return "large";
  if (!f.lastOpenedAt && (m.accessTimesReliable || f.simulated.includes("lastOpenedAt"))) return "neverOpened";
  if (!f.origin) return "site.unknown";
  const siteCount = m.files.filter((o) => o.origin && o.origin.site === f.origin.site).length;
  if (siteCount >= 3) return "site.frequent";
  if (siteCount === 1 && Math.random() < 0.5) return "site.rare";
  const typePool = { document: "document", image: "image", video: "video", audio: "audio", archive: "archive", diskImage: "diskImage", spreadsheet: "spreadsheet", code: "code" }[f.kind];
  return typePool && Math.random() < 0.6 ? `byType.${typePool}` : "general";
}

/** The line a file speaks when the user taps it, plus an optional second line drawn from a fact not yet used. */
export function linesFor(f, m) {
  const data = facts(f, m);
  const pool = poolFor(f, m);
  const first = pick(pool, data) || pick("general", data);
  let second = "";
  if (!pool.startsWith("timeOfDay") && !pool.startsWith("installer") && Math.random() < 0.4) {
    second = pick("timeOfDay." + timeOfDayPool(new Date(f.downloadedAt)), data);
  }
  return { pool, lines: [first, second].filter(Boolean) };
}

export const epitaphFor = (f, m) => pick("epitaphs", facts(f, m));
export const claimLine = (f, files, m) => pick("doppelganger." + claimFor(f, files), facts(f, m));

// ---------- The gravestone ----------

/** When the drive fills if nothing changes, and when it would if `buryBytes` were buried. */
export function forecast(m, buryBytes = 0, now = Date.now()) {
  const g = Math.max(m.drive.growthPerMonth, 1);
  const monthsLeft = m.drive.free / g;
  const full = new Date(now + monthsLeft * 30.44 * DAY);
  const redeemed = new Date(now + ((m.drive.free + buryBytes) / g) * 30.44 * DAY);
  const label = (d) => `${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
  return { full, redeemed, fullLabel: label(full), redeemedLabel: label(redeemed), simulated: m.drive.simulated };
}

// Quick look: `node manifest.js path/to/manifest.json` prints what each spirit would say.
if (typeof process !== "undefined" && process.argv?.[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { readFileSync } = await import("node:fs");
  const path = process.argv[2];
  if (!path) { console.log("Usage: node manifest.js <manifest.json>"); process.exit(0); }
  const m = JSON.parse(readFileSync(path, "utf8"));
  console.log(`\n${m.mode.toUpperCase()} manifest · ${m.files.length} files · ${m.groups.length} duplicate groups\n`);
  console.log("STAVE TWO · The Ghost of Downloads Past");
  for (const f of pastCandidates(m)) {
    const { pool, lines } = linesFor(f, m);
    console.log(`\n  ${f.name}  (${humanSize(f.size)}, ${f.folder})  [${pool}]${f.simulated.length ? "  simulated: " + f.simulated.join(", ") : ""}`);
    lines.forEach((l) => console.log("    " + l));
  }
  console.log("\nSTAVE THREE · The Ghost of Filesystems Present");
  for (const g of presentGroups(m)) {
    console.log(`\n  ${g.files.length} copies of ${g.files[0].name}`);
    for (const f of g.files) console.log(`    ${f.id === g.original ? "*" : " "} ${f.folder}/${f.name}: ${claimLine(f, g.files, m)}`);
  }
  const bury = pastCandidates(m).reduce((s, f) => s + f.size, 0);
  const fc = forecast(m, bury);
  console.log(`\nSTAVE FOUR · HERE LIES C: · FULL · ${fc.fullLabel} · OR · ${fc.redeemedLabel}${fc.simulated ? "  (simulated)" : ""}\n`);
}
