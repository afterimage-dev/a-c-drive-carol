// Something left behind: the morning after a visit, a single chain link lies on the edge of the taskbar and
// rattles if your cursor touches it. Click it to pick it up, and it's gone. Its own tiny window, so nothing else
// on the screen is covered, and it hides whenever a fullscreen app or presentation is showing.

import { BrowserWindow, screen, ipcMain } from "electron";
import { ORIGIN } from "./protocol.js";

const W = 180, H = 110;

export class ChainLink {
  constructor({ preload, dev = false, onTaken = () => {} }) {
    this.preload = preload;
    this.dev = dev;
    this.win = null;
    ipcMain.on("link:hover", (e, over) => { if (this.win && e.sender === this.win.webContents) this.win.setIgnoreMouseEvents(!over, { forward: true }); });
    ipcMain.on("link:taken", (e) => { if (this.win && e.sender === this.win.webContents) { this.close(); onTaken(); } });
  }

  show({ sound = true, volume = 0.5 } = {}) {
    if (this.win) { if (!this.win.isVisible()) this.win.showInactive(); return; }
    const wa = screen.getPrimaryDisplay().workArea;
    const win = this.win = new BrowserWindow({
      x: Math.round(wa.x + wa.width * (0.3 + Math.random() * 0.4)), y: wa.y + wa.height - H + 6, width: W, height: H,
      transparent: true, backgroundColor: "#00000000", frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, hasShadow: false, focusable: false, show: false, title: "A chain link",
      webPreferences: { preload: this.preload, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, devTools: this.dev }
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true, { forward: true });
    win.once("ready-to-show", () => win.showInactive());
    win.on("closed", () => { if (this.win === win) this.win = null; });
    win.loadURL(`${ORIGIN}/src/renderer/link/index.html?sound=${sound ? 1 : 0}&volume=${Number(volume) || 0.5}`);
  }

  hide() { if (this.win?.isVisible()) this.win.hide(); }
  close() { if (this.win) { this.win.destroy(); this.win = null; } }
  get open() { return !!this.win; }
}
