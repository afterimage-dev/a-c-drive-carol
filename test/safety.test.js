// The house rules, checked in the source itself: no code that deletes, copies files about, or talks to the web.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function sources() {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(c?js|mjs|html)$/.test(e.name)) out.push(p); } };
  walk(path.join(ROOT, "core")); walk(path.join(ROOT, "src"));
  return out;
}
const code = (file) => fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

test("no file-deleting calls anywhere in the app", () => {
  const banned = /\b(unlink|unlinkSync|rmSync|rmdir|rmdirSync|rimraf|trashItem|moveItemToTrash)\b|\bfs\.rm\b|\bfs\.promises\.rm\b|Remove-Item|\bdel\s+\/|\brd\s+\/s/;
  const hits = sources().filter((f) => banned.test(code(f))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(hits, []);
});

test("files are moved, never copied", () => {
  const hits = sources().filter((f) => /\bcopyFile(Sync)?\b|\bcpSync\b|\bfs\.cp\b/.test(code(f))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(hits, []);
});

test("no network code: no http modules, no remote URLs, no external opening", () => {
  const banned = /require\(["'](https?|net|dgram|tls)["']\)|from ["']node:(https?|net|dgram|tls)["']|from ["'](https?|net|dgram|tls)["']|\bnet\.request\b|shell\.openExternal|fetch\(\s*["'`]https?:|new WebSocket|XMLHttpRequest|\bsendBeacon\b/;
  const hits = sources().filter((f) => banned.test(code(f))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(hits, []);
});

test("every page has a strict content security policy with no remote origins", () => {
  for (const f of sources().filter((p) => p.endsWith(".html"))) {
    const html = fs.readFileSync(f, "utf8");
    assert.match(html, /Content-Security-Policy" content="default-src 'none'/, path.relative(ROOT, f));
    assert.doesNotMatch(html, /https?:\/\//, path.relative(ROOT, f));
  }
});

test("Start with Windows is off unless chosen", async () => {
  const { DEFAULTS } = await import("../src/main/settings.js");
  assert.equal(DEFAULTS.startWithWindows, false);
  assert.equal(DEFAULTS.consented, false);
});
