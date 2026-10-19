// Is this a safe moment for a ghost? Never during a fullscreen app, a presentation or quiet hours, never while the
// camera or microphone is in use, and only once the user has paused for a few seconds. Everything here only reads.

import { execFile } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WIN = process.platform === "win32";

// SHQueryUserNotificationState: what Windows itself uses to decide whether a notification may interrupt.
export const QUNS = { 1: "nobody is at the screen", 2: "a fullscreen app is open", 3: "a fullscreen game is running", 4: "presentation mode is on", 5: "ok", 6: "quiet hours are on", 7: "a fullscreen app is open" };

let shq;
function notificationState() {
  if (!WIN) return 5;
  try {
    if (shq === undefined) {
      const koffi = require("koffi");
      shq = koffi.load("shell32.dll").func("int __stdcall SHQueryUserNotificationState(_Out_ int *pquns)");
    }
    const out = [0];
    return shq(out) === 0 ? out[0] : 5;
  } catch {
    shq = null;
    return 5;   // can't ask: don't block the haunting on it, the other checks still apply
  }
}

const CONSENT = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore";

/** True if any app in `reg query ... /s` output is using the device now (it started, and its stop time is 0). */
export function parseConsentStore(text) {
  return String(text).split(/\r?\n(?=HKEY_)/).some((block) => {
    const start = /LastUsedTimeStart\s+REG_QWORD\s+0x([0-9a-f]+)/i.exec(block);
    const stop = /LastUsedTimeStop\s+REG_QWORD\s+0x([0-9a-f]+)/i.exec(block);
    return !!start && !!stop && /^0+$/.test(stop[1]) && !/^0+$/.test(start[1]);
  });
}

function regQuery(key) {
  return new Promise((resolve) => {
    execFile("reg", ["query", key, "/s"], { windowsHide: true, timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => resolve(err ? "" : stdout));
  });
}

export async function deviceInUse() {
  if (!WIN) return { camera: false, microphone: false };
  const [cam, mic] = await Promise.all([regQuery(`${CONSENT}\\webcam`), regQuery(`${CONSENT}\\microphone`)]);
  return { camera: parseConsentStore(cam), microphone: parseConsentStore(mic) };
}

/**
 * @param {{ idleSeconds: () => number, minIdle?: number }} opts
 * @returns {Promise<{ safe: boolean, reasons: string[] }>}
 */
export async function checkSafe({ idleSeconds, minIdle = 10 }) {
  const reasons = [];
  const quns = notificationState();
  if (quns !== 5) reasons.push(QUNS[quns] || "Windows is busy");
  const dev = await deviceInUse();
  if (dev.camera) reasons.push("the camera is in use");
  if (dev.microphone) reasons.push("the microphone is in use");
  if (idleSeconds() < minIdle) reasons.push("you are typing or moving the mouse");
  return { safe: reasons.length === 0, reasons };
}
