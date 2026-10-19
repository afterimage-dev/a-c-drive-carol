// Speech cards. Each speaker has its own typeface and its own way of arriving: Marlware types with glitching letters,
// the Past's words surface like memories, the Present's pop and shake, your thoughts fade in, files type in code.
// A tap (or Space) completes a line; the next tap moves on. Lines also move on by themselves.

import { clamp, el, esc, until, wait } from "./util.js";

const GLYPHS = "#%&@$*/";
const VOICES = {
  marl: { who: "Jacob Marlware", mode: "type", cps: 24 },
  past: { who: "The Ghost of Downloads Past", mode: "words", wps: 3.2 },
  present: { who: "The Ghost of Filesystems Present", mode: "words", wps: 4.6 },
  you: { who: "", mode: "fade", quote: true, at: "lowerLeft" },   // your own lines: large, in quotes, from where you sit
  narrator: { who: "", mode: "fade" },
  tiny: { who: "Tiny.tmp", mode: "type", cps: 16, plain: true }
};

export const holdFor = (text) => 2400 + (text.length / 45) * 1000;

export class Dialogue {
  constructor(stage, sound, root) {
    this.stage = stage;
    this.sound = sound;
    this.root = root;
    this.card = el("div", "card");
    this.card.setAttribute("aria-live", "polite");
    root.appendChild(this.card);
    this.line = null;
    this.frozen = false;   // while choices are showing, lines don't move on by themselves
    this.autoplay = false; // development: choose for the user
    stage.add((t, dt) => this.step(dt));
  }

  /**
   * Show one line and resolve when it has been read (held, or tapped past).
   * @param {string} text
   * @param {object} o  { voice, who, puppet, at: "head" | "top" | "bottom" | "centre", hold (ms), signal, linger }
   */
  async say(text, { voice = "marl", who, puppet = null, at, hold, signal, linger = false } = {}) {
    if (!text) return;
    const v = VOICES[voice] || VOICES.marl;
    if (v.quote) text = `\u201C${text}\u201D`;
    const card = this.card;
    card.className = `card v-${voice}`;
    const label = who ?? v.who;
    const words = v.mode === "words" ? text.split(/(\s+)/).filter(Boolean) : null;
    card.innerHTML = (label ? `<span class="who">${esc(label)}</span>` : "") +
      (words ? `<span class="txt">${words.map((w) => `<span class="w">${esc(w)}</span>`).join("")}</span>`
        : `<span class="txt"><span class="typed"></span><span class="rest">${esc(text)}</span></span>`);   // the untyped rest keeps the card its final size
    const txt = card.querySelector(v.mode === "type" ? ".typed" : ".txt");
    const rest = card.querySelector(".rest");
    if (v.mode === "fade") { rest.textContent = ""; txt.textContent = text; }
    this.line = { text, v, voice, puppet, at: at || v.at || (puppet ? "head" : "bottom"), n: 0, done: v.mode === "fade", heldMs: 0, hold: hold ?? holdFor(text), txt, rest, words: words ? [...txt.querySelectorAll(".w")] : null, resolve: null };
    requestAnimationFrame(() => card.classList.add("on"));
    this.place();
    try {
      await until((resolve) => { this.line.resolve = resolve; }, signal);
    } finally {
      if (puppet) { puppet.s.open = 0; }
      if (!linger) card.classList.remove("on");
    }
  }

  /** Buttons under the current card (or at `at`), resolving with the chosen key. */
  async choose(options, { signal, className = "", auto = null } = {}) {
    const row = el("div", `choices ${className}`);
    options.forEach(([key, label, primary]) => {
      const b = el("button", primary ? "primary" : "", esc(label));
      b.type = "button";
      b.dataset.key = key;
      row.appendChild(b);
    });
    this.card.appendChild(row);
    this.card.classList.add("on", "interactive");
    this.frozen = true;
    this.place();
    try {
      return await until((resolve) => {
        row.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (b) { e.stopPropagation(); this.sound.clink(0.3, 0, 0.3); resolve(b.dataset.key); }
        });
        if (this.autoplay) setTimeout(() => resolve(auto ?? options.find((o) => o[2])?.[0] ?? options[0][0]), 1500);
      }, signal);
    } finally {
      this.frozen = false;
      row.remove();
      this.card.classList.remove("interactive");
    }
  }

  /** Say a line and offer buttons beneath it in one card. */
  async ask(text, options, o = {}) {
    const said = this.say(text, { ...o, linger: true, hold: Infinity });
    said.catch(() => {});
    await this.typed(o.signal);
    const answer = await this.choose(options, o);
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
    if (L.words) L.words.forEach((w) => w.classList.add("in"));
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
