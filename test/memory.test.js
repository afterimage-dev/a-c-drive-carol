// The spirits' memory between nights: kept files stay quiet, banished ones return after thirty days.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMemory, remember, returningFiles, BANISH_DAYS } from "../src/main/memory.js";
import { DEFAULTS } from "../src/main/settings.js";

const DAY = 86400000;
const m = {
  mode: "real",
  files: [
    { id: "a", path: "C:\\U\\Downloads\\a.zip", size: 10, group: null, timesBanished: 0 },
    { id: "b", path: "C:\\U\\Downloads\\b.zip", size: 20, group: "g1", timesBanished: 0 },
    { id: "c", path: "C:\\U\\Desktop\\b.zip", size: 20, group: "g1", timesBanished: 0 },
    { id: "d", path: "C:\\U\\Downloads\\d.iso", size: 30, group: null, timesBanished: 0 }
  ],
  groups: [{ id: "g1", members: ["b", "c"] }]
};
const fresh = () => ({ ...DEFAULTS, kept: [], banished: [] });

test("keeping and banishing are remembered; banishing twice counts twice", () => {
  const now = 1e12;
  let s = remember(fresh(), m, { keep: ["a"], banish: ["d"] }, now);
  assert.deepEqual(s.kept, [{ path: m.files[0].path, size: 10 }]);
  assert.equal(s.banished[0].times, 1);
  assert.equal(Date.parse(s.banished[0].until), now + BANISH_DAYS * DAY);
  s = remember(s, m, { banish: ["d"] }, now + 40 * DAY);
  assert.equal(s.banished.length, 1);
  assert.equal(s.banished[0].times, 2);
});

test("kept and still-banished files are hidden; a broken duplicate pair stops being a group", () => {
  const now = 1e12;
  const s = remember(fresh(), m, { keep: ["c"], banish: ["d"] }, now);
  const seen = applyMemory(m, s, now + DAY);
  assert.deepEqual(seen.files.map((f) => f.id), ["a", "b"]);
  assert.equal(seen.groups.length, 0);
  assert.equal(seen.files.find((f) => f.id === "b").group, null);
});

test("a banished file returns after thirty days, knowing how often it was sent away", () => {
  const now = 1e12;
  const s = remember(fresh(), m, { banish: ["d"] }, now);
  const later = now + (BANISH_DAYS + 1) * DAY;
  const seen = applyMemory(m, s, later);
  assert.equal(seen.files.find((f) => f.id === "d").timesBanished, 1);
  assert.equal(returningFiles(s, later).length, 1);
});

test("matching is case-insensitive on the path and exact on the size", () => {
  const s = { ...fresh(), kept: [{ path: "c:\\u\\downloads\\A.ZIP", size: 10 }] };
  assert.ok(!applyMemory(m, s).files.some((f) => f.id === "a"));
  const s2 = { ...fresh(), kept: [{ path: m.files[0].path, size: 11 }] };
  assert.ok(applyMemory(m, s2).files.some((f) => f.id === "a"));
});

test("sample nights are never remembered", () => {
  const sampleM = { ...m, mode: "sample" };
  const s = remember(fresh(), sampleM, { keep: ["a"] });
  assert.deepEqual(s.kept, []);
  assert.equal(applyMemory(sampleM, { kept: [{ path: m.files[0].path, size: 10 }], banished: [] }), sampleM);
});
