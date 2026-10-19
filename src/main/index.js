// A C-Drive Carol · main process entry.

import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lockBeforeReady, lockSession } from "./network-lock.js";
import { registerScheme, handleScheme } from "./protocol.js";
import { Controller } from "./controller.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Development switches (ignored in the packaged app unless --dev is given too):
//   --dev            DevTools and logging          --fast       minutes become seconds in the scheduler
//   --demo           start a sample night at once  --scene=X    skip the warning and start the visit at stave X
//   --autoplay       make default choices          --capture=F  save overlay pictures to F (--capture-at=2,5,9)
//   --no-backdrop    don't photograph the desktop for the visit (it just darkens instead)
//   --answer=X       with --autoplay, answer Marlware with X (here | notTonight | now)
//   --omen=X         show one omen on the sample files (passing | cold | rattle | notification)
//   --setup          open the settings window (with --capture, pictures are taken of it)
const argv = process.argv.slice(1);
const flag = (name) => argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name) => flag(name)?.split("=").slice(1).join("=") || null;
const devAllowed = !app.isPackaged || !!flag("dev");
const flags = {
  dev: devAllowed && !!flag("dev"),
  fast: devAllowed && !!flag("fast"),
  demo: devAllowed && !!flag("demo"),
  scene: devAllowed ? value("scene") : null,
  autoplay: devAllowed && !!flag("autoplay"),
  capture: devAllowed ? value("capture") : null,
  captureAt: devAllowed ? value("capture-at") : null,
  noBackdrop: devAllowed && !!flag("no-backdrop"),
  answer: devAllowed ? value("answer") : null,
  omen: devAllowed ? value("omen") : null,
  setup: !!flag("setup"),
  hidden: !!flag("hidden")
};

lockBeforeReady();
registerScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("dev.afterimage.acdrivecarol");
  let controller = null;
  app.on("second-instance", () => controller?.openSetup());
  app.on("window-all-closed", () => { /* the spirits keep to the tray */ });
  app.whenReady().then(async () => {
    lockSession();
    handleScheme(ROOT);
    controller = new Controller({ root: ROOT, flags });
    await controller.start();
  });
}
