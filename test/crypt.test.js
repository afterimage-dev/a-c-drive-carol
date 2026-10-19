// The Crypt: moves only, logged, reversible, never overwriting, never outside the allowed folders.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { layToRest, resurrect, resting } from "../core/crypt.js";
import { tempDir, write, manifestFor, listFiles } from "./helpers.js";

test("lays a file to rest by moving it into the Crypt, with a log entry", (t) => {
  const root = tempDir(t);
  const f = write(path.join(root, "Downloads", "old.pdf"), "old");
  const m = manifestFor(root, [{ path: f }]);
  const r = layToRest(m, ["f0"]);
  assert.deepEqual(r.moved, ["f0"]);
  assert.equal(fs.existsSync(f), false);
  assert.equal(fs.readFileSync(path.join(m.crypt, "old.pdf"), "utf8"), "old");
  const log = JSON.parse(fs.readFileSync(path.join(m.crypt, "crypt-log.json"), "utf8"));
  assert.equal(log.entries.length, 1);
  assert.equal(log.entries[0].from, f);
  assert.match(log.entries[0].key, /^[0-9a-f-]{36}$/);
});

test("refuses files outside the allowed folders and files in cloud-synced folders", (t) => {
  const root = tempDir(t);
  const outside = write(path.join(root, "Elsewhere", "secret.txt"));
  const synced = write(path.join(root, "Documents", "synced.docx"));
  const m = manifestFor(root, [{ path: outside }, { path: synced, folder: "Documents", cloudSynced: true }]);
  const r = layToRest(m, ["f0", "f1", "nope"]);
  assert.deepEqual(r.moved, []);
  assert.equal(r.skipped.length, 3);
  assert.ok(fs.existsSync(outside) && fs.existsSync(synced));
});

test("never overwrites: name clashes in the Crypt get a resting number", (t) => {
  const root = tempDir(t);
  const a = write(path.join(root, "Downloads", "report.pdf"), "a");
  const b = write(path.join(root, "Desktop", "report.pdf"), "b");
  const m = manifestFor(root, [{ path: a }, { path: b, folder: "Desktop" }]);
  layToRest(m, ["f0", "f1"]);
  assert.deepEqual(listFiles(m.crypt), ["crypt-log.json", "report (resting 2).pdf", "report.pdf"]);
  assert.equal(fs.readFileSync(path.join(m.crypt, "report (resting 2).pdf"), "utf8"), "b");
});

test("resurrects everything back to exactly where it was", (t) => {
  const root = tempDir(t);
  const a = write(path.join(root, "Downloads", "deep", "a.zip"), "a");
  const m = manifestFor(root, [{ path: a }]);
  layToRest(m, ["f0"]);
  fs.rmdirSync(path.join(root, "Downloads", "deep"));   // test setup only: the folder it came from has gone too
  const r = resurrect(m.crypt);
  assert.equal(r.back.length, 1);
  assert.equal(fs.readFileSync(a, "utf8"), "a");
  assert.equal(resting(m.crypt).count, 0);
});

test("resurrecting onto an occupied path comes back beside it, never over it", (t) => {
  const root = tempDir(t);
  const a = write(path.join(root, "Downloads", "notes.txt"), "old");
  const m = manifestFor(root, [{ path: a }]);
  layToRest(m, ["f0"]);
  write(a, "new");
  resurrect(m.crypt);
  assert.equal(fs.readFileSync(a, "utf8"), "new");
  assert.equal(fs.readFileSync(path.join(root, "Downloads", "notes (resurrected 2).txt"), "utf8"), "old");
});

test("resurrects one entry by key, even when another night reused the same manifest id", (t) => {
  const root = tempDir(t);
  const one = write(path.join(root, "Downloads", "one.txt"), "1");
  layToRest(manifestFor(root, [{ path: one }]), ["f0"]);
  const two = write(path.join(root, "Downloads", "two.txt"), "2");
  layToRest(manifestFor(root, [{ path: two }]), ["f0"]);   // a second night: its file is also "f0"
  const crypt = path.join(root, "Crypt");
  const entries = resting(crypt).entries;
  assert.equal(entries.length, 2);
  assert.notEqual(entries[0].key, entries[1].key);
  const keyForTwo = entries.find((e) => e.name === "two.txt").key;
  resurrect(crypt, [keyForTwo]);
  assert.ok(fs.existsSync(two));
  assert.ok(!fs.existsSync(one));
  assert.equal(resting(crypt).count, 1);
});

test("resting() totals the bytes and flags simulated sizes", (t) => {
  const root = tempDir(t);
  const a = write(path.join(root, "Downloads", "big.iso"));
  const m = manifestFor(root, [{ path: a, size: 5e9, simulated: ["size"] }]);
  layToRest(m, ["f0"]);
  const r = resting(m.crypt);
  assert.equal(r.count, 1);
  assert.equal(r.bytes, 5e9);
  assert.equal(r.simulated, true);
});
