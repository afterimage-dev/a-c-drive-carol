// When the spirits come: a pure state machine, driven here with a fake clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, restore, step, needsPolling, MINUTE, DAY } from "../src/main/scheduler.js";

const run = (state, events, opts = {}) => {
  let s = state; const all = [];
  for (const ev of events) { const r = step(s, ev, { rand: () => 0.5, ...opts }); s = r.state; all.push(...r.actions); }
  return { state: s, actions: all };
};

test("Bring them now goes straight to the visit", () => {
  const { state, actions } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "now", now: 1000 }]);
  assert.equal(state.phase, "visit");
  assert.deepEqual(actions, [{ type: "visit" }]);
});

test("I shall be here waits 8 to 30 minutes with three omens, then visits at a safe moment", () => {
  const { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }]);
  assert.equal(state.phase, "waiting");
  assert.equal(state.visitAt, 19 * MINUTE);   // rand 0.5 → halfway between 8 and 30
  assert.deepEqual(state.omens.map((o) => o.kind), ["rattle", "passing", "cold"]);
  assert.ok(state.omens[0].at < state.omens[1].at && state.omens[1].at < state.omens[2].at && state.omens[2].at < state.visitAt);
  const omens = [];
  let s = state;
  for (let now = 0; now <= 20 * MINUTE; now += 5000) {
    const r = step(s, { type: "tick", now, safe: true });
    s = r.state; omens.push(...r.actions);
    if (s.phase === "visit") break;
  }
  assert.deepEqual(omens.map((a) => a.kind || a.type), ["rattle", "passing", "cold", "visit"]);
});

test("the middle omen is sometimes breath on the glass", () => {
  const { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }], { rand: () => 0.2 });
  assert.equal(state.omens[1].kind, "breath");
});

test("the omen without sound is a notification instead of a rattle", () => {
  const { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }], { sound: false });
  assert.equal(state.omens[0].kind, "notification");
});

test("never visits while it's unsafe; after the half hour it waits for you to come back", () => {
  let { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }]);
  let r = step(state, { type: "tick", now: 20 * MINUTE, safe: false });
  assert.equal(r.state.phase, "waiting");
  assert.ok(!r.actions.some((a) => a.type === "visit"));
  r = step(r.state, { type: "tick", now: 31 * MINUTE, safe: false });
  assert.equal(r.state.phase, "deferred");
  r = step(r.state, { type: "returned", now: 3 * 60 * MINUTE, safe: false });
  assert.equal(r.state.phase, "deferred");
  r = step(r.state, { type: "returned", now: 3 * 60 * MINUTE, safe: true });
  assert.equal(r.state.phase, "visit");
  assert.deepEqual(r.actions, [{ type: "visit" }]);
});

test("an omen whose moment passed unsafely is dropped, not stacked up", () => {
  let { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }]);
  let r = step(state, { type: "tick", now: state.omens[1].at + 1, safe: false });
  assert.equal(r.state.omens[0].done, true);   // the rattle's time is gone
  r = step(r.state, { type: "tick", now: state.omens[1].at + 2, safe: true });
  assert.deepEqual(r.actions, [{ type: "omen", kind: "passing" }]);
});

test("Not tonight returns tomorrow, and three refusals in a row stop the warnings", () => {
  let s = initialState();
  for (let i = 1; i <= 3; i++) {
    s = run(s, [{ type: "warned", now: i * DAY }, { type: "answer", answer: "notTonight", now: i * DAY }]).state;
    assert.equal(s.refusals, i);
    assert.equal(s.nextWarningAt, i < 3 ? (i + 1) * DAY : null);
  }
  assert.equal(needsPolling(s), false);
});

test("a due warning waits for a safe moment, then fires once", () => {
  let s = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "notTonight", now: 0 }]).state;
  let r = step(s, { type: "tick", now: DAY + 1, safe: false });
  assert.deepEqual(r.actions, []);
  r = step(r.state, { type: "tick", now: DAY + 2, safe: true });
  assert.deepEqual(r.actions, [{ type: "warn", again: true }]);
  r = step(r.state, { type: "tick", now: DAY + 3, safe: true });
  assert.deepEqual(r.actions, []);
});

test("fleeing a visit is remembered; finishing one clears refusals", () => {
  let s = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "now", now: 0 }, { type: "visitEnded", completed: false, now: 1 }]).state;
  assert.equal(s.fled, true);
  s = run({ ...s, refusals: 2 }, [{ type: "warned", now: 2 }, { type: "answer", answer: "now", now: 2 }, { type: "visitEnded", completed: true, now: 3 }]).state;
  assert.equal(s.fled, false);
  assert.equal(s.refusals, 0);
});

test("restore() never resumes on a warning or visit that's no longer on screen", () => {
  assert.equal(restore({ ...initialState(), phase: "visit" }).phase, "idle");
  assert.equal(restore({ ...initialState(), phase: "warning" }).phase, "idle");
  assert.equal(restore({ ...initialState(), phase: "waiting", deadline: 10 }, 20).phase, "deferred");
  assert.deepEqual(restore(null), initialState());
});

test("scale shrinks the wait for testing", () => {
  const { state } = run(initialState(), [{ type: "warned", now: 0 }, { type: "answer", answer: "here", now: 0 }], { scale: 0.02 });
  assert.ok(state.visitAt < 30 * MINUTE * 0.02 + 1);
});
