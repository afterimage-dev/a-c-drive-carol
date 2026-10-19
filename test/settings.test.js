// Settings survive a broken file and are written in one step.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadSettings, saveSettings, DEFAULTS } from "../src/main/settings.js";
import { tempDir } from "./helpers.js";

test("a missing or broken settings file gives the defaults", (t) => {
  const dir = tempDir(t);
  assert.deepEqual(loadSettings(path.join(dir, "missing.json")), { ...DEFAULTS, kept: [], banished: [] });
  fs.writeFileSync(path.join(dir, "bad.json"), "{ not json");
  assert.equal(loadSettings(path.join(dir, "bad.json")).sound, true);
});

test("saved settings load back, and lists are always lists", (t) => {
  const file = path.join(tempDir(t), "nested", "settings.json");
  saveSettings(file, { ...DEFAULTS, sound: false, kept: [{ path: "a", size: 1 }] });
  saveSettings(file, { ...loadSettings(file), volume: 0.2 });
  const s = loadSettings(file);
  assert.equal(s.sound, false);
  assert.equal(s.volume, 0.2);
  assert.equal(s.kept.length, 1);
  fs.writeFileSync(file, JSON.stringify({ kept: "nope" }));
  assert.deepEqual(loadSettings(file).kept, []);
});
