// Who haunts, what they say, and the gravestone's dates, using the real sample set.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeSample } from "../core/make-sample.js";
import { pastCandidates, presentGroups, suggestOriginal, claimFor, poolFor, linesFor, forecast, humanSize, compareVersions, facts } from "../core/manifest.js";
import { LINES, timeOfDayPool, pick } from "../core/spirit-lines.js";
import { tempDir } from "./helpers.js";

const sample = (t) => makeSample(path.join(tempDir(t, "sample"), "Sample"));

test("the Past only haunts old files in Downloads or on the Desktop, never duplicates, oldest first", (t) => {
  const m = sample(t);
  const past = pastCandidates(m);
  assert.ok(past.length > 5);
  for (const f of past) {
    assert.equal(f.group, null);
    assert.match(f.folder, /^(Downloads|Desktop)/);
  }
  assert.ok(!past.some((f) => f.name === "boarding_pass.pdf"), "too recent to haunt");
  const times = past.map((f) => Date.parse(f.downloadedAt));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("cloud-synced files are never offered to the Past", (t) => {
  const m = sample(t);
  const target = pastCandidates(m)[0];
  m.files.find((f) => f.id === target.id).cloudSynced = true;
  assert.ok(!pastCandidates(m).some((f) => f.id === target.id));
});

test("installers plead according to what's installed", (t) => {
  const m = sample(t);
  const byName = (n) => m.files.find((f) => f.name === n);
  assert.equal(poolFor(byName("vlc-3.0.20-win64.exe"), m), "installer.olderVersion");
  assert.equal(poolFor(byName("SteamSetup.exe"), m), "installer.sameVersion");
  assert.equal(poolFor(byName("gimp-2.10.38-setup.exe"), m), "installer.notInstalled");
  assert.equal(poolFor(byName("invoice_march (3).pdf"), m), "timeOfDay.lateNight");
});

test("the Present finds every duplicate group and suggests the tidiest original", (t) => {
  const m = sample(t);
  const groups = presentGroups(m);
  assert.equal(groups.length, 3);
  const report = groups.find((g) => g.files.some((f) => f.name === "report.pdf"));
  const original = report.files.find((f) => f.id === report.original);
  assert.equal(original.folder, "Documents/Reports");
  assert.equal(claimFor(original, report.files), "oldest");
  assert.equal(suggestOriginal(report.files).id, original.id);
});

test("every file speaks at least one fully filled line", (t) => {
  const m = sample(t);
  for (const f of pastCandidates(m)) {
    const { lines } = linesFor(f, m);
    assert.ok(lines.length >= 1, f.name);
    for (const l of lines) assert.doesNotMatch(l, /\{\w+\}/, `${f.name}: ${l}`);
  }
});

test("line grammar: no doubled evening, weekends aren't working days, counts exclude the file itself", () => {
  const sat = new Date(2026, 9, 17, 14, 2);   // a Saturday afternoon
  assert.equal(timeOfDayPool(sat), "weekend");
  assert.equal(timeOfDayPool(new Date(2026, 9, 19, 14, 2)), "working");
  for (let i = 0; i < 30; i++) {
    const evening = pick("timeOfDay.evening", { time: "7:40 in the evening", clock: "7:40", weekday: "Tuesday" });
    assert.doesNotMatch(evening, /evening.*evening/);
  }
  const m = { files: [1, 2, 3].map((i) => ({ origin: { site: "drive.google.com" }, id: `f${i}` })) };
  const f = { ...m.files[0], name: "a.zip", kind: "archive", size: 1, downloadedAt: new Date().toISOString(), folder: "Downloads", timesBanished: 0, installer: null };
  assert.equal(facts(f, m).others, "two");
  assert.ok(LINES.site.frequent.some((l) => l.includes("{others} others")));
});

test("the gravestone: a later date when something is buried, labelled simulated for the sample", (t) => {
  const m = sample(t);
  const none = forecast(m, 0), some = forecast(m, 3 * 1024 ** 3);
  assert.ok(some.redeemed > none.full);
  assert.match(none.fullLabel, /^[A-Z]+ \d{4}$/);
  assert.equal(none.simulated, true);
});

test("sizes and versions", () => {
  assert.equal(humanSize(512), "512 bytes");
  assert.equal(humanSize(5.8 * 1024 ** 3), "5.8 GB");
  assert.equal(humanSize(42 * 1024 ** 2), "42 MB");
  assert.equal(compareVersions("3.0.20", "3.0.21"), -1);
  assert.equal(compareVersions("22.11.0", "22.11"), 0);
  assert.equal(compareVersions("10.0", "9.9.9"), 1);
});
