// Shared test helpers: throwaway folders and small manifests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tempDir(t, name = "carol") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  // test scratch only: these folders live in the OS temp dir and are left for the OS to clear
  return dir;
}

export function write(file, body = "x") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return file;
}

/** A minimal real-mode manifest over files in `root`. */
export function manifestFor(root, files, extra = {}) {
  return {
    version: 1, mode: "real", createdAt: new Date().toISOString(),
    roots: { Downloads: path.join(root, "Downloads"), Desktop: path.join(root, "Desktop"), Documents: path.join(root, "Documents") },
    crypt: path.join(root, "Crypt"), accessTimesReliable: true,
    drive: { total: 512e9, free: 10e9, growthPerMonth: 1e9, simulated: false },
    files: files.map((f, i) => ({
      id: f.id ?? `f${i}`, path: f.path, name: path.basename(f.path), folder: f.folder ?? "Downloads", kind: f.kind ?? "document",
      size: f.size ?? 2048, downloadedAt: f.downloadedAt ?? new Date(Date.now() - 400 * 864e5).toISOString(), lastOpenedAt: null,
      origin: f.origin ?? null, hash: f.hash ?? null, group: f.group ?? null, installer: f.installer ?? null,
      timesBanished: f.timesBanished ?? 0, cloudSynced: !!f.cloudSynced, simulated: f.simulated ?? []
    })),
    groups: extra.groups ?? [],
    ...extra
  };
}

/** Every file under `dir`, relative, sorted. */
export function listFiles(dir) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(dir, p)); } };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}
