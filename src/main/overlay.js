// The overlay: one transparent, frameless, always-on-top window over the primary display. Hidden when nothing is
// haunting. In "passive" mode (the warning, omens) clicks pass straight through to the desktop except over the ghost
// itself; in "visit" mode it takes the screen, and Esc always ends it.

import { BrowserWindow, screen, globalShortcut } from "electron";
import path from "node:path";
import { ORIGIN } from "./protocol.js";

export class Overlay {
  constructor({ preload, onEsc, dev = false }) {
    this.preload = preload;
    this.onEsc = onEsc;
    this.dev = dev;
    this.win = null;
    this.mode = "hidden";
    this.ready = null;
  }

  create() {
    const d = screen.getPrimaryDisplay();
    const win = this.win = new BrowserWindow({
      ...d.bounds,
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: false,
      show: false,
      title: "A C-Drive Carol",
      webPreferences: {
        preload: this.preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        spellcheck: false,
        devTools: this.dev
      }
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on("closed", () => { this.win = null; this.releaseEsc(); });
    if (this.dev) win.webContents.on("console-message", (e) => { if (e.level === "error" || e.level === "warning") console.log(`[overlay ${e.level}] ${e.message} (${e.sourceId}:${e.lineNumber})`); });
    this.ready = new Promise((resolve) => win.webContents.once("did-finish-load", resolve));
    win.loadURL(`${ORIGIN}/src/renderer/overlay/index.html`);
    screen.on("display-metrics-changed", () => this.fit());
    return this.ready;
  }

  fit() {
    if (!this.win) return;
    const d = screen.getPrimaryDisplay();
    this.win.setBounds(d.bounds);
  }

  /** The work area (above the taskbar) in overlay coordinates, for the chain's floor. */
  workArea() {
    const d = screen.getPrimaryDisplay();
    return { x: d.workArea.x - d.bounds.x, y: d.workArea.y - d.bounds.y, width: d.workArea.width, height: d.workArea.height, scale: d.scaleFactor };
  }

  /** The overlay's full size: the whole primary display. */
  size() {
    const d = screen.getPrimaryDisplay();
    return { width: d.bounds.width, height: d.bounds.height };
  }

  async passive() {
    if (!this.win) await this.create();
    await this.ready;
    this.releaseEsc();
    this.mode = "passive";
    this.win.setFocusable(false);
    this.win.setIgnoreMouseEvents(true, { forward: true });
    this.fit();
    this.win.showInactive();
    this.win.setAlwaysOnTop(true, "screen-saver");
  }

  async visit() {
    if (!this.win) await this.create();
    await this.ready;
    this.mode = "visit";
    this.fit();
    this.win.setIgnoreMouseEvents(false);
    this.win.setFocusable(true);
    this.win.show();
    this.win.setAlwaysOnTop(true, "screen-saver");
    this.win.focus();
    this.holdEsc();
  }

  hide() {
    this.releaseEsc();
    this.mode = "hidden";
    if (this.win) { this.win.setIgnoreMouseEvents(true, { forward: true }); this.win.setFocusable(false); this.win.hide(); }
  }

  /** While passive, the renderer says when the pointer is over something it can touch. */
  hover(over) {
    if (this.win && this.mode === "passive") this.win.setIgnoreMouseEvents(!over, { forward: true });
  }

  holdEsc() {
    if (this.escHeld) return;
    this.escHeld = globalShortcut.register("Escape", () => this.onEsc());
  }

  releaseEsc() {
    if (this.escHeld) { globalShortcut.unregister("Escape"); this.escHeld = false; }
  }

  send(channel, payload) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload);
  }

  get visible() { return !!this.win && this.win.isVisible(); }
}

export const overlayPreload = (dir) => path.join(dir, "..", "preload", "overlay.cjs");
