// Runs in its own utility process so a long scan never stutters the ghosts. Read-only: see core/scan.js.
import { scan } from "../../core/scan.js";

process.parentPort.once("message", async ({ data }) => {
  try {
    const manifest = await scan({ ...data, onProgress: (text) => process.parentPort.postMessage({ progress: text }) });
    process.parentPort.postMessage({ manifest });
  } catch (err) {
    process.parentPort.postMessage({ error: String(err?.stack || err) });
  }
});
