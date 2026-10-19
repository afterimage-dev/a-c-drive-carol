// When you're afraid, some words stutter: their first letter or two, then the rest a beat later.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stutterPlan } from "../src/renderer/overlay/dialogue.js";

const split = (s) => s.split(/(\s+)/).filter(Boolean);

test("every frightened line stutters somewhere, and only on words of three letters or more", () => {
  for (let k = 0; k < 50; k++) {
    const parts = split("\u201CI fear you more than any spectre I have seen.\u201D");
    const plan = stutterPlan(parts);
    assert.ok(plan.size >= 1);
    for (const i of plan.keys()) assert.ok(parts[i].replace(/[^\p{L}]/gu, "").length >= 3, parts[i]);
  }
});

test("a word shows one letter first (two for a long word), and a leading quote mark comes with it", () => {
  const always = () => 0;   // every candidate stutters, short cuts
  const plan = stutterPlan(split("\u201CYou are about"), always);
  assert.equal(plan.get(0), 2);   // the quote mark and the Y
  const long = stutterPlan(split("shadows"), always);
  assert.equal(long.get(0), 2);   // seven letters: "sh", then the rest
});

test("\u201Cyou\u201D stutters far more often than other words", () => {
  let you = 0, other = 0;
  for (let k = 0; k < 400; k++) {
    const plan = stutterPlan(split("fear you more"));
    if (plan.has(2)) you++;
    if (plan.has(4)) other++;
  }
  assert.ok(you > other * 1.5, `${you} vs ${other}`);
});

test("a line with no long words has nothing to stutter", () => {
  assert.equal(stutterPlan(split("I am so")).size, 0);
});
