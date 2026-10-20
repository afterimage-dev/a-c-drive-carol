// Where the spirits may look, which URLs pages may load, and when the camera or microphone is busy.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { isInside, cloudFolders, appFolder, cryptFolder } from "../src/main/places.js";
import { resolveAppUrl, isAllowedUrl } from "../src/main/app-url.js";
import { parseConsentStore } from "../src/main/safe-moment.js";

test("isInside compares whole folder names, case-insensitively", () => {
  const base = path.resolve("/Users/me/Downloads");
  assert.ok(isInside(path.join(base, "a.zip"), base));
  assert.ok(isInside(base, base));
  assert.ok(isInside(path.join(base, "X", "y.txt").toUpperCase(), base));
  assert.ok(!isInside(path.resolve("/Users/me/Downloads2/a.zip"), base));
  assert.ok(!isInside(path.resolve("/Users/me/Downloads/../Documents/a"), base));
});

test("the Crypt moves out of a cloud-synced Documents folder", () => {
  const home = path.resolve("/Users/me");
  const local = appFolder({ documents: path.join(home, "Documents"), home, cloud: [] });
  assert.equal(cryptFolder(local), path.join(home, "Documents", "A C-Drive Carol", "Crypt"));
  const od = path.join(home, "OneDrive");
  const synced = appFolder({ documents: path.join(od, "Documents"), home, cloud: [od] });
  assert.equal(synced, path.join(home, "A C-Drive Carol"));
});

test("cloud folders come from OneDrive's environment variables, without repeats", () => {
  const dirs = cloudFolders({ OneDrive: "/x/OneDrive", OneDriveConsumer: "/x/onedrive", OneDriveCommercial: "/x/OneDrive - Work" });
  assert.equal(dirs.length, 2);
  assert.deepEqual(cloudFolders({}), []);
});

test("app:// serves only the app's own folders", () => {
  const root = path.resolve("/app");
  assert.equal(resolveAppUrl("app://carol/src/renderer/overlay/index.html", root), path.join(root, "src", "renderer", "overlay", "index.html"));
  assert.equal(resolveAppUrl("app://carol/assets/sprites/stone.webp", root), path.join(root, "assets", "sprites", "stone.webp"));
  assert.equal(resolveAppUrl("app://carol/assets/sounds/chain-drag.mp3", root), path.join(root, "assets", "sounds", "chain-drag.mp3"));
  assert.equal(resolveAppUrl("app://carol/assets/originals/x.png", root), null);
  assert.equal(resolveAppUrl("app://carol/src/main/controller.js", root), null);
  assert.equal(resolveAppUrl("app://carol/src/renderer/../../package.json", root), null);
  assert.equal(resolveAppUrl("app://carol/%2e%2e/%2e%2e/Windows/win.ini", root), null);
  assert.equal(resolveAppUrl("app://evil/src/renderer/x.js", root), null);
  assert.equal(resolveAppUrl("not a url", root), null);
});

test("only the app's own schemes may load; the web may not", () => {
  for (const u of ["app://carol/x", "file:///C:/x", "data:image/png;base64,AA", "blob:app://carol/1", "devtools://devtools/x"]) assert.ok(isAllowedUrl(u), u);
  for (const u of ["https://example.com", "http://localhost:3000", "wss://x", "ftp://x"]) assert.ok(!isAllowedUrl(u), u);
});

const REG = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam
    Value    REG_SZ    Allow

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\\Some.App
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x1dcb166425d50c8
    LastUsedTimeStop    REG_QWORD    0x1dcb1664783fbf5
`;

test("camera and microphone: in use only while an app has started and not stopped", () => {
  assert.equal(parseConsentStore(REG), false);
  const live = REG + `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\\NonPackaged\\C:#Program Files#Zoom#zoom.exe
    LastUsedTimeStart    REG_QWORD    0x1dd47f932398ff2
    LastUsedTimeStop    REG_QWORD    0x0
`;
  assert.equal(parseConsentStore(live), true);
  assert.equal(parseConsentStore(""), false);
  assert.equal(parseConsentStore(live.replace(/\n/g, "\r\n")), true);
});
