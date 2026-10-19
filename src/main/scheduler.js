// When the spirits come. A pure state machine: step(state, event) returns the next state and what to do about it,
// so it can be tested with a fake clock and persisted as plain JSON.
//
//   idle ──warned──▶ warning ──answer:here──▶ waiting ──visit due + safe──▶ visit ──ended──▶ idle
//                       │ answer:now ───────────────────────────────────────▶ visit
//                       └ answer:notTonight ──▶ idle (warns again tomorrow; after three refusals, only when summoned)
//   waiting ──30 min, never safe──▶ deferred ──user returns + safe──▶ visit
//
// Actions: { type: "omen", kind } · { type: "visit" } · { type: "warn", again: true }

export const MINUTE = 60000;
export const DAY = 24 * 60 * MINUTE;
export const HALF_HOUR = 30 * MINUTE;
export const COLD_LEAD = 30000;   // the cold edges come 30 seconds before the spirits

export function initialState() {
  return { phase: "idle", warnedAt: null, visitAt: null, deadline: null, omens: [], nextWarningAt: null, refusals: 0, fled: false };
}

/** A saved state, made safe to resume after the app restarts (nothing was on screen any more). */
export function restore(saved, now = Date.now()) {
  const s = { ...initialState(), ...(saved || {}) };
  if (s.phase === "warning" || s.phase === "visit") s.phase = "idle";
  if (s.phase === "waiting" && s.deadline && now > s.deadline) s.phase = "deferred";
  return s;
}

/**
 * @param {object} state
 * @param {object} ev       { type, now, ... }
 * @param {object} [opts]   { scale: time multiplier for testing (0.02 turns minutes into ~seconds), sound, rand }
 */
export function step(state, ev, { scale = 1, sound = true, rand = Math.random, waitMin = 8, waitMax = 30 } = {}) {
  const s = { ...state, omens: state.omens.map((o) => ({ ...o })) };
  const actions = [];
  const now = ev.now;

  switch (ev.type) {
    case "warned":
      s.phase = "warning"; s.warnedAt = now; s.nextWarningAt = null;
      break;

    case "answer":
      if (s.phase !== "warning") break;
      if (ev.answer === "now") {
        s.phase = "visit"; actions.push({ type: "visit" });
      } else if (ev.answer === "here") {
        const wait = (waitMin + rand() * (waitMax - waitMin)) * MINUTE * scale;
        s.phase = "waiting";
        s.visitAt = now + wait;
        s.deadline = (s.warnedAt ?? now) + HALF_HOUR * scale;
        s.omens = [
          { kind: sound ? "rattle" : "notification", at: now + wait / 3, done: false },
          { kind: rand() < 0.5 ? "breath" : "passing", at: now + (wait * 2) / 3, done: false },
          { kind: "cold", at: Math.max(now, s.visitAt - COLD_LEAD * scale), done: false }
        ];
      } else if (ev.answer === "notTonight") {
        s.refusals += 1;
        s.phase = "idle";
        s.nextWarningAt = s.refusals >= 3 ? null : now + DAY * scale;
      }
      break;

    case "tick":
      if (s.phase === "waiting") {
        for (let i = 0; i < s.omens.length; i++) {
          const o = s.omens[i];
          if (o.done || now < o.at) continue;
          const later = s.omens.slice(i + 1).find((n) => !n.done);
          if (ev.safe) { o.done = true; actions.push({ type: "omen", kind: o.kind }); break; }   // one omen at a time
          if (later && now >= later.at) o.done = true;   // its moment passed unsafely; let it go
        }
        if (now >= s.visitAt) {
          if (ev.safe) { s.phase = "visit"; s.omens.forEach((o) => (o.done = true)); actions.length = 0; actions.push({ type: "visit" }); }
          else if (now >= s.deadline) s.phase = "deferred";
        }
      } else if (s.phase === "idle" && s.nextWarningAt && now >= s.nextWarningAt && ev.safe) {
        s.nextWarningAt = null;
        actions.push({ type: "warn", again: true });
      }
      break;

    case "returned":
      if (s.phase === "deferred" && ev.safe) { s.phase = "visit"; actions.push({ type: "visit" }); }
      break;

    case "summoned":
      s.phase = "visit"; actions.push({ type: "visit" });
      break;

    case "visitEnded":
      s.phase = "idle"; s.visitAt = null; s.deadline = null; s.omens = [];
      if (ev.completed) { s.refusals = 0; s.fled = false; } else s.fled = true;
      break;

    case "dismissed":   // the warning was closed without an answer (Esc, or the app quit)
      if (s.phase === "warning") s.phase = "idle";
      break;
  }
  return { state: s, actions };
}

/** Whether the scheduler needs the safe-moment poll running right now. */
export const needsPolling = (s) => s.phase === "waiting" || s.phase === "deferred" || (s.phase === "idle" && !!s.nextWarningAt);
