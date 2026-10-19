// Builds tonight's manifest: a real, read-only scan in a utility process, or the sample set.

import { utilityProcess } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeSample } from "../../core/make-sample.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** @returns {Promise<import("../../core/manifest.js").Manifest>} */
export function scanReal({ roots, crypt, cloud }, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(path.join(HERE, "scan-worker.js"), [], { serviceName: "A C-Drive Carol scanner" });
    let settled = false;
    child.on("message", (msg) => {
      if (msg.progress) onProgress(msg.progress);
      if (msg.manifest) { settled = true; resolve(msg.manifest); child.kill(); }
      if (msg.error) { settled = true; reject(new Error(msg.error)); child.kill(); }
    });
    child.on("exit", (code) => { if (!settled) reject(new Error(`The scanner stopped unexpectedly (${code})`)); });
    child.postMessage({ roots, crypt, cloud });
  });
}

export function buildSample(root) {
  return makeSample(root);
}
