// A C-Drive Carol: what the gravestone says. Whose drive it is (your own name, as Scrooge read his on the stone),
// what it died of (whatever is eating it), and how long it has. Pure functions, no Node or DOM, so the main process
// and the overlay can both use them.

import { numberWords } from "./spirit-lines.js";

const DAY = 86400000;
// Account names that aren't anyone's name: carving "HERE LIES ADMIN'S C:" would be bathos, not horror.
const IMPERSONAL = new Set(["admin", "administrator", "user", "users", "owner", "guest", "pc", "windows", "default", "defaultuser",
  "me", "home", "root", "test", "desktop", "laptop", "computer", "local", "office", "student", "support"]);
const MAX_NAME = 15;

/**
 * The name to carve, from a Windows account name, or null if it isn't a personal name.
 * "OFFICE\nicholas.tweedale" -> "NICHOLAS", "jsmith42" -> "JSMITH", "Administrator" -> null.
 */
export function graveName(account) {
  const user = String(account || "").split(/[\\/]/).pop();
  const first = user.split(/[._\-\s]+/).find((part) => /\p{L}/u.test(part)) || "";
  const letters = first.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2 || IMPERSONAL.has(letters.toLowerCase())) return null;
  return letters.toUpperCase().slice(0, MAX_NAME);
}

/** The second line of the stone: "NICKY'S C:", or "YOUR C:" when there's no name to carve. */
export const ownerLine = (name) => (name ? `${name}'S C:` : "YOUR C:");

const spell = (n) => (n <= 20 ? numberWords(n).toUpperCase() : n.toLocaleString("en-GB"));
const count = (n, one, many) => `${spell(n)} ${n === 1 ? one : many}`;

/**
 * What the drive died of: whatever takes up the most room among the things the spirits haunt.
 * "DIED OF FORTY-SIX INSTALLERS" reads badly, so counts over twenty are numerals: "DIED OF 46 INSTALLERS".
 */
export function causeOfDeath(m) {
  const byId = new Map(m.files.map((f) => [f.id, f]));
  const sum = (list) => list.reduce((s, f) => s + f.size, 0);
  const copies = (m.groups || []).flatMap((g) => g.members.slice(1)).map((id) => byId.get(id)).filter(Boolean);
  const of = (pred) => m.files.filter((f) => !f.group && pred(f));
  const causes = [
    { files: copies, one: "DUPLICATE", many: "DUPLICATES" },
    { files: of((f) => f.kind === "installer"), one: "INSTALLER", many: "INSTALLERS" },
    { files: of((f) => f.kind === "diskImage"), one: "DISK IMAGE", many: "DISK IMAGES" },
    { files: of((f) => f.kind === "video"), one: "FORGOTTEN FILM", many: "FORGOTTEN FILMS" },
    { files: of((f) => f.kind === "archive"), one: "UNOPENED ARCHIVE", many: "UNOPENED ARCHIVES" },
    { files: of((f) => f.kind === "image" && /screen ?shot|screen ?capture|snip/i.test(f.name)), one: "SCREENSHOT", many: "SCREENSHOTS" }
  ].map((c) => ({ ...c, bytes: sum(c.files) })).filter((c) => c.files.length);
  if (!causes.length) return "DIED OF DOWNLOADS";
  const worst = causes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
  return `DIED OF ${count(worst.files.length, worst.one, worst.many)}`;
}

/**
 * How long, in words: "SEVEN MONTHS", "TWELVE DAYS", "EIGHTEEN YEARS". `fine` adds the remainder:
 * "SEVEN MONTHS AND SIXTEEN DAYS".
 */
export function spanWords(days, { fine = false } = {}) {
  const d = Math.max(0, Math.round(days));
  if (d < 60) return count(d, "DAY", "DAYS");
  if (d < 730) {
    const months = Math.floor(d / 30.44), rest = Math.round(d - months * 30.44);
    return fine && rest ? `${count(months, "MONTH", "MONTHS")} AND ${count(rest, "DAY", "DAYS")}` : count(Math.round(d / 30.44), "MONTH", "MONTHS");
  }
  const years = Math.floor(d / 365.25), rest = Math.round((d - years * 365.25) / 30.44);
  return fine && rest ? `${count(years, "YEAR", "YEARS")} AND ${count(rest, "MONTH", "MONTHS")}` : count(Math.round(d / 365.25), "YEAR", "YEARS");
}

/** The fourth line: "FULL IN SEVEN MONTHS", or "ALREADY FULL" when there's no room left at all. */
export const fullLine = (days) => (days < 1 ? "ALREADY FULL" : `FULL IN ${spanWords(days)}`);

/**
 * What tonight's choices change on the stone. Either the fourth line is re-carved later ("rewrite"), or, when the
 * difference is too small to change it, a fifth line is added beneath ("AND SIXTEEN DAYS MORE").
 * @returns {{ kind: "rewrite", line: string } | { kind: "more", line: string } | { kind: "none" }}
 */
export function redemption(daysNow, daysLater) {
  const gained = daysLater - daysNow;
  if (!(gained > 0.5)) return { kind: "none" };
  const before = fullLine(daysNow), after = fullLine(daysLater);
  if (after !== before) return { kind: "rewrite", line: after };
  const g = Math.max(1, Math.round(gained));
  return { kind: "more", line: g < 60 ? `AND ${g === 1 ? "A DAY" : count(g, "DAY", "DAYS")} MORE` : `AND ${spanWords(g)} MORE` };
}

/** Days from now until a date (ISO or Date). */
export const daysUntil = (when, now = Date.now()) => (Date.parse(when) - now) / DAY;
