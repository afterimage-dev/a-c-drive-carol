// The chain's rattles and strikes: one recording of several rattles, cut into separate rattles to play at random,
// and into single strikes for the links landing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rattles, strikes } from "../src/renderer/overlay/audio.js";

const RATE = 8000;
/** Silence with bursts of noise at [start, end] seconds, each at `amp`. */
function recording(seconds, bursts, amp = 0.3) {
  const d = new Float32Array(seconds * RATE);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const [a, b] of bursts) for (let i = Math.round(a * RATE); i < b * RATE; i++) d[i] = noise() * amp;
  return d;
}
const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 0.05, `${msg}: ${actual} vs ${expected}`);

test("separate rattles are found where the recording goes quiet between them", () => {
  const parts = rattles(recording(6, [[0.5, 1.4], [2, 3.1], [4, 4.8]]), RATE);
  assert.equal(parts.length, 3);
  near(parts[0][0], 0.47, "a little lead-in");
  near(parts[0][1], 1.52, "and a tail");
  near(parts[2][0], 3.97, "third starts");
});

test("a gap shorter than a breath doesn't split a rattle, and a blip isn't one", () => {
  const parts = rattles(recording(4, [[0.5, 1], [1.08, 1.6], [2.5, 2.6]]), RATE);
  assert.equal(parts.length, 1);
  near(parts[0][1], 1.72, "runs on over the short gap");
});

test("a very long rattle is cut short, and one still sounding at the end is kept", () => {
  const parts = rattles(recording(8, [[0.2, 5], [6.5, 8]]), RATE);
  assert.equal(parts.length, 2);
  near(parts[0][1] - parts[0][0], 3, "capped");
  near(parts[1][1], 8, "to the end");
});

test("silence has no rattles", () => {
  assert.deepEqual(rattles(new Float32Array(RATE * 2), RATE), []);
});

/** Silence with sharp strikes at `at` seconds, each `amp` loud and dying away over a tenth of a second. */
function struck(seconds, hits) {
  const d = new Float32Array(seconds * RATE);
  let seed = 11;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const [at, amp] of hits) for (let i = 0; i < RATE * 0.2; i++) d[Math.round(at * RATE) + i] += noise() * amp * Math.exp(-i / (RATE * 0.04));
  return d;
}

test("single strikes are found where the sound jumps, levelled to a common loudness", () => {
  const found = strikes(struck(3, [[0.3, 0.5], [1.2, 0.15], [2.1, 0.3]]), RATE);
  assert.equal(found.length, 3);
  near(found[0].at, 0.3, "first strike");
  near(found[1].at, 1.2, "second strike");
  assert.ok(found[1].gain > found[0].gain * 2, "the quiet one is brought up");
});

test("strikes too close together count once, and ones too faint to bring up are left out", () => {
  const found = strikes(struck(3, [[0.5, 0.4], [0.53, 0.4], [1.5, 0.01]]), RATE);
  assert.equal(found.length, 1);
  near(found[0].at, 0.5, "the first of the pair");
});
