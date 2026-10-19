// The tray: where the spirits wait between nights.

import { Tray, Menu, nativeImage } from "electron";
import path from "node:path";

export function createTray(root, actions) {
  const image = nativeImage.createFromPath(path.join(root, "assets", "tray.png"));
  const tray = new Tray(image);
  const build = ({ busy = false } = {}) => Menu.buildFromTemplate([
    { label: "Summon the spirits", enabled: !busy, click: () => actions.summon("real") },
    { label: "Summon with sample files", enabled: !busy, click: () => actions.summon("sample") },
    { type: "separator" },
    { label: "Open the Crypt", click: () => actions.openCrypt() },
    { label: "Resurrect everything", click: () => actions.resurrectAll() },
    { type: "separator" },
    { label: "Settings", click: () => actions.settings() },
    { label: "Quit", click: () => actions.quit() }
  ]);
  tray.setToolTip("A C-Drive Carol");
  tray.setContextMenu(build());
  tray.on("click", () => tray.popUpContextMenu());
  return {
    tray,
    setBusy: (busy) => tray.setContextMenu(build({ busy })),
    setTip: (text) => tray.setToolTip(text || "A C-Drive Carol")
  };
}
