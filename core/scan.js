// A C-Drive Carol: the real scan.
//
// Looks through the user's own Downloads, Desktop and Documents folders and writes a manifest in exactly the same
// shape make-sample.js produces. It reads only: it never moves, changes or sends anything, and it never touches
// the network. On Windows it also reads where each file came from (its Zone.Identifier), which apps are installed
// (the same list "Apps & features" uses) and each installer's product name and version.
//
//   node scan.js                          -> prints the manifest to the console
//   node scan.js manifest.json            -> writes it to a file
//
// Windows details come from short PowerShell commands run locally; on other systems those parts are skipped.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DAY = 86400000;
const WIN = process.platform === "win32";

const KINDS = {
  installer: ["exe", "msi", "msix", "appx"],
  document: ["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "pptx", "ppt", "key", "epub", "pages"],
  image: ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "tif", "tiff", "svg", "raw", "cr2", "nef"],
  video: ["mp4", "mov", "mkv", "avi", "webm", "wmv", "m4v"],
  audio: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma"],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"],
  diskImage: ["iso", "img", "dmg", "vhd", "vhdx"],
  spreadsheet: ["xlsx", "xls", "csv", "ods", "numbers"],
  code: ["js", "ts", "py", "java", "c", "cpp", "cs", "go", "rs", "rb", "php", "json", "html", "css", "ipynb"]
};
const EXT_KIND = Object.fromEntries(Object.entries(KINDS).flatMap(([k, exts]) => exts.map((e) => [e, k])));
export const kindOf = (name) => EXT_KIND[path.extname(name).slice(1).toLowerCase()] || "other";

const SKIP_DIRS = new Set(["node_modules", ".git", "$recycle.bin", "appdata", "a c-drive carol", "my games", "windowspowershell", "zoom"]);
const DEPTH = { Downloads: 2, Desktop: 1, Documents: 3 };
const MAX_FILES = 20000;
const MIN_DUP_SIZE = 1024;           // ignore tiny files when looking for doubles

export function defaultRoots() {
  const home = os.homedir();
  return { Downloads: path.join(home, "Downloads"), Desktop: path.join(home, "Desktop"), Documents: path.join(home, "Documents") };
}
export function defaultCrypt() {
  return path.join(os.homedir(), "Documents", "A C-Drive Carol", "Crypt");
}

// ---------- Walking the folders ----------
function walk(rootName, rootPath, out) {
  const stack = [{ dir: rootPath, rel: rootName, depth: 0 }];
  while (stack.length && out.length < MAX_FILES) {
    const { dir, rel, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name.startsWith("~$") || e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < DEPTH[rootName] && !SKIP_DIRS.has(e.name.toLowerCase())) stack.push({ dir: abs, rel: `${rel}/${e.name}`, depth: depth + 1 });
      } else if (e.isFile() && !/^desktop\.ini$|\.lnk$|\.url$|\.tmp$|\.crdownload$|\.part$/i.test(e.name)) {
        let st;
        try { st = fs.statSync(abs, { bigint: true }); } catch { continue; }
        out.push({ abs, rel, name: e.name, st });
      }
    }
  }
  return out;
}

// ---------- Windows helpers (all local, all read-only) ----------
function powershell(script, input) {
  if (!WIN) return null;
  try {
    const tmp = path.join(os.tmpdir(), "a-c-drive-carol-scan.json");   // one reused file, emptied after each use
    if (input !== undefined) fs.writeFileSync(tmp, JSON.stringify(input));
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\$IN/g, `'${tmp}'`)],
      { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
    if (input !== undefined) fs.writeFileSync(tmp, "");   // leave nothing readable behind in the temp file
    return out.trim() ? JSON.parse(out) : null;
  } catch { return null; }
}
const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** Where a download came from, from the "Mark of the Web" Windows attaches to it. */
function originOf(abs) {
  if (!WIN) return null;
  try {
    const z = fs.readFileSync(abs + ":Zone.Identifier", "utf8");
    const url = (/^HostUrl=(.+)$/m.exec(z) || [])[1]?.trim();
    const ref = (/^ReferrerUrl=(.+)$/m.exec(z) || [])[1]?.trim();
    const pickUrl = [ref, url].find((u) => u && /^https?:/i.test(u));
    if (!pickUrl) return null;
    const site = new URL(pickUrl).hostname.replace(/^www\./, "");
    return { site, url: url && /^https?:/i.test(url) ? url : undefined };
  } catch { return null; }
}

/** InstallDate as written by the installer: usually YYYYMMDD, sometimes nonsense. Only real dates are kept. */
export function installDateOf(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(raw || "").trim());
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  return y > 1990 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && date.getTime() <= Date.now() ? date.toISOString() : null;
}

/** Installed programs, from the same registry list "Apps & features" reads. */
function installedApps() {
  const ps = `$p='HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*';
    Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, InstallDate | ConvertTo-Json -Compress`;
  return asArray(powershell(ps)).map((a) => ({
    name: a.DisplayName, version: a.DisplayVersion || null,
    installDate: installDateOf(a.InstallDate)
  }));
}

/** Product name and version embedded in each installer, without running it. */
function installerInfo(paths) {
  if (!paths.length) return new Map();
  const ps = `$list = Get-Content -Raw $IN | ConvertFrom-Json; $list | ForEach-Object {
      $i = (Get-Item -LiteralPath $_ -ErrorAction SilentlyContinue).VersionInfo
      [pscustomobject]@{ Path = $_; Product = $i.ProductName; Version = $i.ProductVersion }
    } | ConvertTo-Json -Compress`;
  return new Map(asArray(powershell(ps, paths)).map((r) => [r.Path, { product: (r.Product || "").trim() || null, version: (r.Version || "").trim() || null }]));
}

/** Files that only exist in the cloud (OneDrive and similar). Reading them would force a download, so they're skipped. */
function cloudOnly(paths) {
  if (!paths.length) return new Set();
  const ps = `$list = Get-Content -Raw $IN | ConvertFrom-Json; $list | ForEach-Object {
      $a = (Get-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue).Attributes.value__
      [pscustomobject]@{ Path = $_; A = $a } } | ConvertTo-Json -Compress`;
  const RECALL = 0x400000 | 0x40000 | 0x1000;   // recall-on-data-access, recall-on-open, offline
  return new Set(asArray(powershell(ps, paths)).filter((r) => r.A & RECALL).map((r) => r.Path));
}

/** Whether Windows updates "last opened" times on this machine, so "never opened" can be trusted. */
function accessTimesReliable() {
  if (!WIN) return false;
  try {
    const out = execFileSync("fsutil", ["behavior", "query", "disablelastaccess"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    const v = parseInt((/=\s*(\d+)/.exec(out) || [])[1], 10);
    return v === 0 || v === 2;   // 0: enabled by the user, 2: enabled by the system
  } catch { return false; }
}

// ---------- Matching installers to installed apps ----------
const NOISE = new Set(["setup", "installer", "install", "x64", "x86", "win64", "win32", "win", "windows", "amd64", "arm64", "full", "offline", "online", "msi", "exe", "latest", "release", "stable", "64bit", "32bit", "bit", "the", "for"]);
const tokens = (s) => String(s || "").toLowerCase().replace(/\(\d+\)/g, " ").split(/[^a-z0-9]+/).filter((t) => t && !NOISE.has(t) && !/^v?\d+$/.test(t));
function matchApp(product, fileName, apps) {
  const want = new Set([...tokens(product), ...(product ? [] : tokens(fileName))]);
  if (!want.size) return null;
  let best = null, bestScore = 0;
  for (const a of apps) {
    const have = tokens(a.name);
    if (!have.length) continue;
    const overlap = have.filter((t) => want.has(t)).length;
    const score = overlap / Math.min(have.length, want.size);
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return bestScore >= 0.6 ? best : null;
}
const versionFromName = (name) => (/(\d+(?:\.\d+){1,3})/.exec(name) || [])[1] || null;

// ---------- Duplicates ----------
export function hashFile(abs, limit = Infinity) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(1 << 20);
    let pos = 0, n;
    while (pos < limit && (n = fs.readSync(fd, buf, 0, Math.min(buf.length, limit - pos), pos)) > 0) { h.update(buf.subarray(0, n)); pos += n; }
  } finally { fs.closeSync(fd); }
  return h.digest("hex");
}

/** Files in the roots (same depths and skips as the scan) that are exactly `size` bytes, except `except`. */
export function findSameSize(roots, size, except = null) {
  const found = [];
  for (const [name, p] of Object.entries(roots)) if (fs.existsSync(p)) walk(name, p, found);
  const skip = except ? path.resolve(except).toLowerCase() : null;
  return found.filter((f) => Number(f.st.size) === size && path.resolve(f.abs).toLowerCase() !== skip).map((f) => ({ abs: f.abs, rel: f.rel, st: f.st }));
}

/** Describe specific files as a manifest would, for a visit about just them (a new twin, a returning file). */
export function describe(entries, { roots, crypt, cloud = [] }) {
  return entries.map(({ abs, rel, st }, i) => {
    const born = Number(st.birthtimeMs) || Number(st.mtimeMs);
    return {
      id: `x${i}`, path: abs, name: path.basename(abs), folder: rel, kind: kindOf(abs), size: Number(st.size),
      downloadedAt: new Date(born).toISOString(), lastOpenedAt: null, origin: originOf(abs), hash: null, group: null,
      installer: null, timesBanished: 0, cloudSynced: cloud.length ? within(abs, cloud) : false, simulated: []
    };
  });
}

/** Which root a path is in, and its folder relative to it ("Downloads", "Documents/Reports"), or null. */
export function placeOf(abs, roots) {
  for (const [name, root] of Object.entries(roots)) {
    const rel = path.relative(root, path.dirname(abs));
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) return rel ? `${name}/${rel.split(path.sep).join("/")}` : name;
  }
  return null;
}

// ---------- The scan ----------
/** True if `p` is inside any of `dirs` (case-insensitive, as Windows paths are). */
function within(p, dirs) {
  const r = path.resolve(p).toLowerCase();
  return dirs.some((d) => { const base = path.resolve(d).toLowerCase(); return r === base || r.startsWith(base + path.sep); });
}

/**
 * @param {object} opts
 * @param {Object<string,string>} [opts.roots]  folders to look in
 * @param {string} [opts.crypt]                 the Crypt (never scanned)
 * @param {string[]} [opts.cloud]               cloud-synced folders (OneDrive); files there are marked and never moved
 */
export async function scan({ roots = defaultRoots(), crypt = defaultCrypt(), cloud = [], onProgress = () => {} } = {}) {
  const found = [];
  for (const [name, p] of Object.entries(roots)) if (fs.existsSync(p)) walk(name, p, found);
  const cryptAbs = path.resolve(crypt).toLowerCase();
  const all = found.filter((f) => !path.resolve(f.abs).toLowerCase().startsWith(cryptAbs));
  onProgress(`Found ${all.length} files`);

  // Possible duplicates: same size first, then a quick hash of the first 64 KB, then a full hash.
  const bySize = new Map();
  for (const f of all) {
    const size = Number(f.st.size);
    if (size < MIN_DUP_SIZE) continue;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(f);
  }
  let candidates = [...bySize.values()].filter((g) => g.length > 1).flat();
  // the same file reached by two paths (a hard link) isn't a duplicate
  const seenIno = new Set();
  candidates = candidates.filter((f) => { const k = `${f.st.dev}:${f.st.ino}`; if (f.st.ino && seenIno.has(k)) return false; seenIno.add(k); return true; });
  const placeholders = cloudOnly(candidates.map((f) => f.abs));
  candidates = candidates.filter((f) => !placeholders.has(f.abs));
  onProgress(`Checking ${candidates.length} possible duplicates`);
  const quick = new Map();
  for (const f of candidates) {
    try { f.quick = `${f.st.size}:${hashFile(f.abs, 65536)}`; } catch { continue; }
    if (!quick.has(f.quick)) quick.set(f.quick, []);
    quick.get(f.quick).push(f);
  }
  const fullHash = new Map();
  for (const g of quick.values()) {
    if (g.length < 2) continue;
    for (const f of g) {
      try { f.hash = hashFile(f.abs); } catch { continue; }
      if (!fullHash.has(f.hash)) fullHash.set(f.hash, []);
      fullHash.get(f.hash).push(f);
    }
  }

  // Installers
  const apps = installedApps();
  const installers = all.filter((f) => kindOf(f.name) === "installer" && /^(Downloads|Desktop)/.test(f.rel));
  const info = installerInfo(installers.map((f) => f.abs));
  onProgress(`Read ${installers.length} installers against ${apps.length} installed apps`);

  const reliable = accessTimesReliable();
  const files = all.map((f, i) => {
    const born = Number(f.st.birthtimeMs) || Number(f.st.mtimeMs);
    const atime = Number(f.st.atimeMs);
    const kind = kindOf(f.name);
    let installer = null;
    if (kind === "installer" && /^(Downloads|Desktop)/.test(f.rel)) {
      const meta = info.get(f.abs) || {};
      const app = matchApp(meta.product, f.name, apps);
      installer = {
        product: meta.product || (app && app.name) || path.basename(f.name, path.extname(f.name)),
        version: meta.version || versionFromName(f.name),
        installed: app ? { version: app.version, installDate: app.installDate } : null
      };
    }
    return {
      id: `f${i}`,
      path: f.abs,
      name: f.name,
      folder: f.rel,
      kind,
      size: Number(f.st.size),
      downloadedAt: new Date(born).toISOString(),
      lastOpenedAt: atime - born > 60000 ? new Date(atime).toISOString() : null,
      origin: originOf(f.abs),
      hash: f.hash || null,
      group: null,
      installer,
      timesBanished: 0,
      cloudSynced: cloud.length ? within(f.abs, cloud) : false,
      simulated: []
    };
  });
  const byPath = new Map(files.map((f) => [f.path, f]));
  const groups = [];
  for (const [hash, g] of fullHash) {
    if (g.length < 2) continue;
    const id = `g${groups.length + 1}`;
    g.forEach((f) => { byPath.get(f.abs).group = id; });
    groups.push({ id, hash, members: g.map((f) => byPath.get(f.abs).id) });
  }

  // The drive: how much room is left, and roughly how fast these folders have been filling it.
  let total = 0, free = 0;
  try { const s = fs.statfsSync(Object.values(roots)[0]); total = s.blocks * s.bsize; free = s.bavail * s.bsize; } catch { /* unknown */ }
  const sixMonths = Date.now() - 182 * DAY;
  const recent = files.filter((f) => Date.parse(f.downloadedAt) > sixMonths).reduce((s, f) => s + f.size, 0);
  const growthPerMonth = Math.max(recent / 6, 512 * 1024 * 1024);

  return {
    version: 1,
    mode: "real",
    createdAt: new Date().toISOString(),
    roots,
    crypt,
    accessTimesReliable: reliable,
    drive: { total, free, growthPerMonth, simulated: false },
    files,
    groups
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  const m = await scan({ onProgress: (s) => process.stderr.write(s + "\n") });
  const json = JSON.stringify(m, null, 2);
  if (out) { fs.writeFileSync(out, json); process.stderr.write(`Wrote ${m.files.length} files and ${m.groups.length} duplicate groups to ${out}\n`); }
  else process.stdout.write(json + "\n");
}
