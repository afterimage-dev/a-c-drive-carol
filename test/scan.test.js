// The real scan: read-only, finds exact duplicates by hash, ignores hard links, marks cloud-synced files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scan } from "../core/scan.js";
import { tempDir, write, listFiles } from "./helpers.js";

const body = (s) => s.repeat(Math.ceil(4096 / s.length)).slice(0, 4096);

test("finds identical files as one group, and leaves same-size different files alone", async (t) => {
  const root = tempDir(t);
  const roots = { Downloads: path.join(root, "Downloads"), Desktop: path.join(root, "Desktop"), Documents: path.join(root, "Documents") };
  write(path.join(roots.Downloads, "report (1).pdf"), body("same"));
  write(path.join(roots.Documents, "Reports", "report.pdf"), body("same"));
  write(path.join(roots.Desktop, "other.pdf"), body("diff"));
  write(path.join(roots.Downloads, "tiny.txt"), "small");
  const before = listFiles(root);
  const m = await scan({ roots, crypt: path.join(root, "Crypt") });
  assert.equal(m.mode, "real");
  assert.equal(m.files.length, 4);
  assert.equal(m.groups.length, 1);
  assert.equal(m.groups[0].members.length, 2);
  assert.deepEqual(listFiles(root), before, "the scan changes nothing on disk");
});

test("a hard link to the same file isn't a duplicate", async (t) => {
  const root = tempDir(t);
  const roots = { Downloads: path.join(root, "Downloads") };
  const a = write(path.join(roots.Downloads, "a.bin"), body("link"));
  fs.linkSync(a, path.join(roots.Downloads, "b.bin"));
  const m = await scan({ roots, crypt: path.join(root, "Crypt") });
  assert.equal(m.groups.length, 0);
});

test("skips the Crypt, hidden files and partial downloads", async (t) => {
  const root = tempDir(t);
  const roots = { Downloads: path.join(root, "Downloads") };
  write(path.join(roots.Downloads, ".hidden"), "h");
  write(path.join(roots.Downloads, "movie.mp4.crdownload"), "p");
  write(path.join(roots.Downloads, "kept.txt"), "k");
  write(path.join(roots.Downloads, "A C-Drive Carol", "Crypt", "rested.txt"), "r");
  const m = await scan({ roots, crypt: path.join(roots.Downloads, "A C-Drive Carol", "Crypt") });
  assert.deepEqual(m.files.map((f) => f.name), ["kept.txt"]);
});

test("marks files in cloud-synced folders", async (t) => {
  const root = tempDir(t);
  const roots = { Downloads: path.join(root, "Downloads"), Documents: path.join(root, "OneDrive", "Documents") };
  write(path.join(roots.Downloads, "local.txt"), "l");
  write(path.join(roots.Documents, "synced.txt"), "s");
  const m = await scan({ roots, crypt: path.join(root, "Crypt"), cloud: [path.join(root, "OneDrive")] });
  const byName = Object.fromEntries(m.files.map((f) => [f.name, f]));
  assert.equal(byName["local.txt"].cloudSynced, false);
  assert.equal(byName["synced.txt"].cloudSynced, true);
});
