// The chain's rattles: one recording of several, cut into separate rattles to play at random.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rattles } from "../src/renderer/overlay/audio.js";

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
