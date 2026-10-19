// What the overlay gets for a night: tonight's numbers in Marlware's mouth, files with their lines, ids only.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeSample } from "../core/make-sample.js";
import { prepareNight, omenFiles } from "../src/main/night.js";
import { tempDir } from "./helpers.js";

test("Marlware's warning carries the real weight and length of the chain", (t) => {
  const m = makeSample(path.join(tempDir(t, "night"), "Sample"));
  const n = prepareNight(m);
  assert.equal(n.simulated, true);
  assert.equal(n.marlware.opening.length, 4);
  assert.match(n.marlware.opening[1], new RegExp(`${m.files.length} links long`));
  assert.ok(n.past.length > 0 && n.past.every((f) => f.lines.length > 0));
  assert.ok(n.past.some((f) => f.pleads), "installers plead");
  assert.equal(n.present.groups.length, 3);
  assert.equal(n.present.extraCopies, 5);
  assert.ok(n.chain.biggest[0].size >= n.chain.biggest.at(-1).size);
  assert.ok(omenFiles(m).length > 0);
});

test("a repeat warning is shorter, and one after fleeing says so", (t) => {
  const m = makeSample(path.join(tempDir(t, "night"), "Sample"));
  const again = prepareNight(m, { again: true, fled: true, previousCount: m.files.length - 4 });
  assert.equal(again.marlware.opening.length, 2);
  assert.doesNotMatch(again.marlware.opening.join(" "), /\{\w+\}/);
});

test("no Christmas, anywhere the spirits speak", async () => {
  const { LINES } = await import("../core/spirit-lines.js");
  const all = JSON.stringify(LINES) + JSON.stringify(prepareNight({ mode: "sample", createdAt: "", files: [], groups: [], drive: { total: 1, free: 1, growthPerMonth: 1 } }));
  assert.doesNotMatch(all, /christmas|xmas|santa|holly|noel|yule/i);
});
