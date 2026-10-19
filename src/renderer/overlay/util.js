// Small helpers shared by the overlay's scenes.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Aborted extends Error {
  constructor() { super("The visit was ended"); this.name = "Aborted"; }
}

/** Resolves after `ms`, or rejects at once if the night is ended (Esc). */
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const id = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    const stop = () => { clearTimeout(id); reject(new Aborted()); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

/** A promise that settles when `register(resolve)` calls back, or rejects when the night is ended. */
export function until(register, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const stop = () => reject(new Aborted());
    signal?.addEventListener("abort", stop, { once: true });
    register((v) => { signal?.removeEventListener("abort", stop); resolve(v); });
  });
}

/** Animate `fn(k)` with k from 0 to 1 over `ms` on animation frames. Resolves when done. */
export function tween(ms, fn, signal, curve = ease) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const frame = (now) => {
      if (signal?.aborted) return reject(new Aborted());
      const k = clamp((now - start) / ms);
      fn(curve(k));
      if (k < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

/** Number words for small counts, so spirits say "three", not "3". */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const countWords = (n) => (n < WORDS.length ? WORDS[n] : n.toLocaleString("en-GB"));
export const plural = (n, one, many = one + "s") => `${countWords(n)} ${n === 1 ? one : many}`;
