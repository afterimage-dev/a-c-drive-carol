// The gravestone: whose drive it is, what it died of, how long it has, and what tonight changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { graveName, ownerLine, causeOfDeath, spanWords, fullLine, redemption } from "../core/epitaph.js";
import { makeSample } from "../core/make-sample.js";
import { tempDir } from "./helpers.js";

test("the name to carve comes from the account name, cleaned and kept short", () => {
  assert.equal(graveName("Nicky"), "NICKY");
  assert.equal(graveName("nicholas.tweedale"), "NICHOLAS");
  assert.equal(graveName("OFFICE\\jsmith42"), "JSMITH");
  assert.equal(graveName("mary-jane_watson"), "MARY");
  assert.equal(graveName("Bartholomewsworthington"), "BARTHOLOMEWSWOR");   // never longer than fifteen letters
  assert.equal(graveName("José"), "JOSÉ");
});

test("impersonal or empty account names carve YOUR C: instead", () => {
  for (const n of ["Administrator", "admin", "User", "OWNER", "guest", "", null, "x", "42"]) assert.equal(graveName(n), null, String(n));
  assert.equal(ownerLine(null), "YOUR C:");
  assert.equal(ownerLine("NICKY"), "NICKY'S C:");
  assert.equal(ownerLine("JAMES"), "JAMES'S C:");
});

test("the cause of death is whatever takes the most room", (t) => {
  const m = makeSample(path.join(tempDir(t, "grave"), "Sample"));
  assert.equal(causeOfDeath(m), "DIED OF ONE DISK IMAGE");   // the sample's 5.8 GB ubuntu .iso outweighs everything
  const f = (id, kind, size, extra = {}) => ({ id, kind, size, name: `${id}.x`, group: null, ...extra });
  assert.equal(causeOfDeath({ files: [f("a", "installer", 50), f("b", "installer", 60), f("c", "video", 70)], groups: [] }), "DIED OF TWO INSTALLERS");
  const many = Array.from({ length: 46 }, (_, i) => f(`i${i}`, "installer", 10));
  assert.equal(causeOfDeath({ files: many, groups: [] }), "DIED OF 46 INSTALLERS");
  assert.equal(causeOfDeath({ files: [f("d1", "document", 5, { group: "g" }), f("d2", "document", 5, { group: "g" }), f("d3", "document", 5, { group: "g" })], groups: [{ id: "g", members: ["d1", "d2", "d3"] }] }), "DIED OF TWO DUPLICATES");
  assert.equal(causeOfDeath({ files: [f("x", "document", 5)], groups: [] }), "DIED OF DOWNLOADS");
});

test("time in words, as an inscription would have it", () => {
  assert.equal(spanWords(12), "TWELVE DAYS");
  assert.equal(spanWords(1), "ONE DAY");
  assert.equal(spanWords(213), "SEVEN MONTHS");
  assert.equal(spanWords(6600), "EIGHTEEN YEARS");
  assert.equal(spanWords(229, { fine: true }), "SEVEN MONTHS AND SIXTEEN DAYS");
  assert.equal(fullLine(213), "FULL IN SEVEN MONTHS");
  assert.equal(fullLine(0.3), "ALREADY FULL");
});

test("tonight's choices either re-carve the date, add the days gained, or change nothing", () => {
  assert.deepEqual(redemption(213, 280), { kind: "rewrite", line: "FULL IN NINE MONTHS" });
  assert.deepEqual(redemption(213, 229), { kind: "rewrite", line: "FULL IN EIGHT MONTHS" });   // rounds to a new month
  assert.deepEqual(redemption(213, 220), { kind: "more", line: "AND SEVEN DAYS MORE" });
  assert.deepEqual(redemption(213, 214), { kind: "more", line: "AND A DAY MORE" });
  assert.deepEqual(redemption(6600, 6700), { kind: "more", line: "AND THREE MONTHS MORE" });
  assert.deepEqual(redemption(213, 213.2), { kind: "none" });
});
