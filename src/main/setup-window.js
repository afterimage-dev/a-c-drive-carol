// The one plain window: first-run consent and settings. Calm on purpose; the theatre happens in the overlay.

import { BrowserWindow } from "electron";
import path from "node:path";
import { ORIGIN } from "./protocol.js";

let win = null;

export function openSetup({ preload, root, dev = false }) {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return win; }
  win = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 480,
    minHeight: 560,
    title: "A C-Drive Carol",
    icon: path.join(root, "assets", "icon.png"),
    backgroundColor: "#0b0a12",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, devTools: dev }
  });
  win.setMenu(null);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; });
  win.loadURL(`${ORIGIN}/src/renderer/setup/index.html`);
  return win;
}

export const setupWindow = () => (win && !win.isDestroyed() ? win : null);
export function closeSetup() { if (win && !win.isDestroyed()) win.close(); }
