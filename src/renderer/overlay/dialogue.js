// Speech cards. Each speaker has its own typeface and its own way of arriving: Marlware types with glitching letters,
// the Past's words surface like memories, the Present's pop and shake, files type in code. Your own lines rise in
// quickly, word by word, faster than any spirit's, since they're already in your head; when you're afraid they come
// haltingly, with uneven gaps, and every letter trembles.
// A tap (or Space) completes a line; the next tap moves on. Lines also move on by themselves.

import { clamp, el, esc, until, wait } from "./util.js";

const GLYPHS = "#%&@$*/";
const VOICES = {
  marl: { who: "Jacob Marlware", mode: "type", cps: 24 },
  past: { who: "The Ghost of Downloads Past", mode: "words", wps: 3.2 },
  present: { who: "The Ghost of Filesystems Present", mode: "words", wps: 4.6 },
  you: { who: "", mode: "rise", quote: true, at: "lowerLeft" },   // your own lines: large, in quotes, from where you sit
  narrator: { who: "", mode: "fade" },
  tiny: { who: "Tiny.tmp", mode: "type", cps: 16, plain: true }
};

export const holdFor = (text) => 2400 + (text.length / 45) * 1000;

/**
 * Which words of a frightened line stutter, and after how many letters: Map(part index -> letters shown first).
 * "you" and "your" usually do (it's him you're afraid of); about a third of other words of three letters or more;
 * always at least one.
 */
export function stutterPlan(parts, random = Math.random) {
  const plan = new Map(), candidates = [];
  parts.forEach((part, i) => {
    const letters = part.replace(/[^\p{L}]/gu, "");
    if (letters.length < 3) return;
    candidates.push(i);
    const lead = part.length - part.replace(/^[^\p{L}]+/u, "").length;   // a leading quote mark comes with the first letter
    const show = lead + (letters.length > 5 && random() < 0.4 ? 2 : 1);
    if (/^you(r|rs)?$/i.test(letters) ? random() < 0.75 : random() < 0.33) plan.set(i, show);
  });
  if (!plan.size && candidates.length) {
    const i = candidates[Math.floor(random() * candidates.length)];
    plan.set(i, parts[i].length - parts[i].replace(/^[^\p{L}]+/u, "").length + 1);
  }
  return plan;
}

export class Dialogue {
  constructor(stage, sound, root) {
    this.stage = stage;
    this.sound = sound;
    this.root = root;
    this.card = el("div", "card");
    this.card.setAttribute("aria-live", "polite");
    root.appendChild(this.card);
    this.line = null;
    this.frozen = false;   // while your replies are showing, lines don't move on by themselves
    this.autoplay = false; // development: choose for the user
    stage.addAlways((t, dt) => this.step(dt));
  }

  /**
   * Show one line and resolve when it has been read (held, or tapped past).
   * @param {string} text
   * @param {object} o  { voice, who, puppet, at: "head" | "top" | "bottom" | "centre", hold (ms), signal, linger }
   */
  async say(text, { voice = "marl", who, puppet = null, at, hold, signal, linger = false, afraid = false } = {}) {
    if (!text) return;
    const v = VOICES[voice] || VOICES.marl;
    if (v.quote) text = `\u201C${text}\u201D`;
    const card = this.card;
    card.className = `card v-${voice}${afraid ? " afraid" : ""}`;
    const label = who ?? v.who;
    const words = v.mode === "words" ? text.split(/(\s+)/).filter(Boolean) : null;
    card.innerHTML = (label ? `<span class="who">${esc(label)}</span>` : "") +
      (words ? `<span class="txt">${words.map((w) => `<span class="w">${esc(w)}</span>`).join("")}</span>`
        : `<span class="txt"><span class="typed"></span><span class="rest">${esc(text)}</span></span>`);   // the untyped rest keeps the card its final size
    const txt = card.querySelector(v.mode === "type" ? ".typed" : ".txt");
    const rest = card.querySelector(".rest");
    if (v.mode === "fade") { rest.textContent = ""; txt.textContent = text; }
    let risen = null, times = null;
    if (v.mode === "rise") {
      // each word in its own span (and, when afraid, each letter, so it can tremble and stutter)
      let li = 0;
      rest.textContent = "";
      const parts = text.split(/(\s+)/).filter(Boolean);
      const stutters = afraid ? stutterPlan(parts) : new Map();
      txt.innerHTML = parts.map((part, pi) => {
        if (/^\s+$/.test(part)) return part;
        if (!afraid) return `<span class="w">${esc(part)}</span>`;
        const cut = stutters.get(pi) ?? Infinity;   // letters after the cut wait a beat
        return `<span class="w">${[...part].map((ch, ci) => `<span class="l${ci >= cut ? " hid" : ""}" style="animation-delay:-${(li++ * 0.037) % 0.18}s">${esc(ch)}</span>`).join("")}</span>`;
      }).join("");
      risen = [...txt.querySelectorAll(".w")];
      // when each word arrives (ms): a steady 40 ms apart, or halting when afraid, catching breath at commas.
      // A stuttered word shows its first letter or two, hangs, then completes, and the line waits for it.
      let at = 0;
      times = risen.map((w) => {
        const now = at;
        if (w.querySelector(".hid")) { w.finishAt = now + 300 + Math.random() * 260; at = w.finishAt; }
        at += afraid ? 90 + Math.random() * 170 + (/[,;:\u2014]\W*$/.test(w.textContent) ? 380 : 0) + (Math.random() < 0.15 ? 320 : 0) : 40;
        return now;
      });
    }
    this.line = { text, v, voice, puppet, at: at || v.at || (puppet ? "head" : "bottom"), n: 0, done: v.mode === "fade", heldMs: 0, hold: hold ?? holdFor(text), txt, rest, words: risen || (words ? [...txt.querySelectorAll(".w")] : null), times, elapsed: 0, resolve: null };
    requestAnimationFrame(() => card.classList.add("on"));
    this.place();
    try {
      await until((resolve) => { this.line.resolve = resolve; }, signal);
    } finally {
      if (puppet) { puppet.s.open = 0; }
      if (!linger) card.classList.remove("on");
    }
  }

  /**
   * Your possible replies, in your own voice: quoted lines low on the left, as if you're about to say one.
   * The one you pick stays a moment, as said; the others fade. Resolves with its key.
   */
  async reply(options, { signal, auto = null } = {}) {
    const box = el("div", "replies interactive");
    options.forEach(([key, label]) => {
      const b = el("button", "reply", esc(`\u201C${label}\u201D`));
      b.type = "button";
      b.dataset.key = key;
      box.appendChild(b);
    });
    const floor = this.stage.floorY ?? this.stage.H;
    box.style.left = `${Math.round(this.stage.W * 0.06)}px`;
    box.style.bottom = `${Math.round(this.stage.H - floor + this.stage.H * 0.07)}px`;
    this.root.appendChild(box);
    requestAnimationFrame(() => box.classList.add("on"));
    this.frozen = true;   // the spirit's line waits for your answer
    try {
      const key = await until((resolve) => {
        box.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b || box.classList.contains("said")) return;
          e.stopPropagation();
          this.sound.clink(0.3, -0.4, 0.3);
          b.classList.add("chosen");
          box.classList.add("said");
          resolve(b.dataset.key);
        });
        if (this.autoplay) setTimeout(() => box.querySelector(`[data-key="${auto ?? options[0][0]}"]`)?.click(), 1500);
      }, signal);
      await wait(900, signal);
      return key;
    } finally {
      this.frozen = false;
      box.classList.remove("on");
      setTimeout(() => box.remove(), 600);
    }
  }

  /** A spirit's line, then your replies to it. The line stays up while you choose. */
  async ask(text, options, o = {}) {
    const said = this.say(text, { ...o, linger: true, hold: Infinity });
    said.catch(() => {});
    await this.typed(o.signal);
    await wait(this.line?.v.mode === "words" ? 1100 : 600, o.signal);   // let the last words surface, and be read
    const answer = await this.reply(options, o);
    this.advance(true);
    await said;
    this.card.classList.remove("on");
    return answer;
  }

  /** Resolves once the current line is fully shown. */
  typed(signal) {
    return until((resolve) => { const check = () => (!this.line || this.line.done ? resolve() : requestAnimationFrame(check)); check(); }, signal);
  }

  /** Tap: finish typing, or move on. */
  advance(force = false) {
    const L = this.line;
    if (!L) return;
    if (!L.done) { this.finish(); if (!force) return; }
    if (this.frozen && !force) return;
    this.line = null;
    L.resolve?.();
  }

  finish() {
    const L = this.line;
    if (!L) return;
    if (L.words) L.words.forEach((w) => { w.classList.add("in"); w.finishAt = null; w.querySelectorAll?.(".hid").forEach((l) => l.classList.remove("hid")); });
    else { L.txt.textContent = L.text; if (L.rest) L.rest.textContent = ""; }
    L.done = true;
  }

  hide() { this.card.classList.remove("on"); this.line = null; }

  step(dt) {
    const L = this.line;
    if (!L) return;
    let open = 0;
    if (!L.done) {
      if (L.v.mode === "type") {
        const ch = L.text[Math.floor(L.n)] || " ";
        L.n += dt * L.v.cps * (/[.,?;:!]/.test(ch) ? 0.25 : 1);
        const n = Math.floor(L.n);
        const glitch = !L.v.plain && !this.stage.reduced && Math.random() < 0.3 && n < L.text.length ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : "";
        L.txt.textContent = L.text.slice(0, n) + glitch;
        L.rest.textContent = L.text.slice(n + (glitch ? 1 : 0));
        open = /[aeiou]/i.test(ch) ? 1 : /[\s.,?;:!]/.test(ch) ? 0 : 0.55;
        if (n >= L.text.length) this.finish();
      } else if (L.v.mode === "rise") {
        L.elapsed += dt * 1000;
        while (L.n < L.words.length && L.times[L.n] <= L.elapsed) L.words[L.n++].classList.add("in");
        for (let i = 0; i < L.n; i++) {   // stuttered words complete a beat after they began
          const w = L.words[i];
          if (w.finishAt != null && w.finishAt <= L.elapsed) { w.querySelectorAll(".hid").forEach((l) => l.classList.remove("hid")); w.finishAt = null; }
        }
        if (L.n >= L.words.length && !L.words.some((w) => w.finishAt != null)) this.finish();
      } else if (L.v.mode === "words") {
        const before = Math.floor(L.n);
        L.n += dt * L.v.wps * 2;   // the list includes the spaces between words
        const n = Math.floor(L.n);
        for (let i = before; i < Math.min(n, L.words.length); i++) {
          L.words[i].classList.add("in");
          if (L.voice === "present" && /!/.test(L.words[i].textContent)) {
            this.card.classList.remove("shake"); void this.card.offsetWidth; this.card.classList.add("shake");
            if (L.puppet) L.puppet.s.laugh = 1;
          }
        }
        open = 0.35 + 0.65 * Math.abs(Math.sin(L.n * Math.PI / 2));
        if (n >= L.words.length) this.finish();
      }
    } else if (!this.frozen) {
      L.heldMs += dt * 1000;
      if (L.heldMs >= L.hold) this.advance();
    }
    const P = L.puppet;
    if (P) {
      const talking = !L.done && L.voice !== "you" && L.voice !== "narrator";
      P.s.open += ((talking ? open : 0) - P.s.open) * Math.min(1, dt * 22);
      P.s.flare = talking ? Math.min(1, P.s.flare + dt * 4) : Math.max(0, P.s.flare - dt * 2);
      P.s.laugh = Math.max(0, P.s.laugh - dt * 1.4);
    }
    this.place();
  }

  place() {
    const L = this.line, card = this.card, { W, H } = this.stage;
    if (!L) return;
    const bw = card.offsetWidth, bh = card.offsetHeight, floor = this.stage.floorY ?? H;
    let x, y;
    if (L.at === "head" && L.puppet) {
      const top = L.puppet.headTop();
      x = clamp(top.x - bw / 2, 12, W - bw - 12);
      y = clamp(top.y - bh - 10, 12, floor - bh - 12);
    } else if (L.at === "top") { x = (W - bw) / 2; y = Math.round(H * 0.07); }
    else if (L.at === "topLeft") { x = Math.round(W * 0.06); y = Math.round(H * 0.08); }
    else if (L.at === "lowerLeft") { x = Math.round(W * 0.06); y = floor - bh - Math.round(H * 0.07); }
    else if (L.at === "centre") { x = (W - bw) / 2; y = (H - bh) / 2 - H * 0.12; }
    else { x = (W - bw) / 2; y = floor - bh - Math.round(H * 0.08); }
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}

export { wait };
