// The night's director in the main process: scans, tells the overlay what to show, keeps the scheduler's clock,
// checks for safe moments, and is the only place files are ever moved (into the Crypt, after Wake up).

import { app, ipcMain, shell, Notification, powerMonitor } from "electron";
import fs from "node:fs";
import path from "node:path";
import { layToRest, resurrect, resting } from "../../core/crypt.js";
import { forecast } from "../../core/manifest.js";
import { Overlay } from "./overlay.js";
import { createTray } from "./tray.js";
import { openSetup, setupWindow, closeSetup } from "./setup-window.js";
import { loadSettings, saveSettings } from "./settings.js";
import { appFolder, cryptFolder, sampleFolder, cloudFolders, isInside } from "./places.js";
import { scanReal, buildSample } from "./scanner.js";
import { prepareNight, omenFiles, omenWord } from "./night.js";
import { applyMemory, remember } from "./memory.js";
import { iconsFor } from "./icons.js";
import { captureDesktop } from "./capture.js";
import { initialState, restore, step, needsPolling } from "./scheduler.js";
import { checkSafe, notificationState } from "./safe-moment.js";
import { ChainLink } from "./link.js";

const DAY = 86400000;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class Controller {
  /**
   * @param {object} o
   * @param {string} o.root   the app's own folder
   * @param {object} o.flags  { dev, fast, demo, scene, capture, autoplay, hidden }
   */
  constructor({ root, flags }) {
    this.root = root;
    this.flags = flags;
    this.settingsFile = path.join(app.getPath("userData"), "settings.json");
    this.settings = loadSettings(this.settingsFile);
    this.sched = restore(this.settings.scheduler);
    this.manifest = null;
    this.night = null;
    this.icons = {};
    this.scene = null;          // what the overlay is showing: "warning" | "visit" | "omen" | null
    this.pendingVisit = false;
    this.busy = false;
    this.lastIdle = 0;
    const cloud = cloudFolders();
    const appDir = appFolder({ documents: app.getPath("documents"), home: app.getPath("home"), cloud });
    this.places = {
      roots: { Downloads: app.getPath("downloads"), Desktop: app.getPath("desktop"), Documents: app.getPath("documents") },
      cloud,
      crypt: cryptFolder(appDir),
      sample: sampleFolder(appDir)
    };
    if (flags.roots) {   // development: haunt a test folder instead of your own
      const r = path.resolve(flags.roots);
      this.places.roots = { Downloads: path.join(r, "Downloads"), Desktop: path.join(r, "Desktop"), Documents: path.join(r, "Documents") };
      this.places.crypt = path.join(r, "Crypt");
    }
  }

  // ---------- start-up ----------
  async start() {
    const preloadDir = path.join(this.root, "src", "preload");
    this.overlay = new Overlay({ preload: path.join(preloadDir, "overlay.cjs"), onEsc: () => this.onEsc(), dev: this.flags.dev });
    this.setupPreload = path.join(preloadDir, "setup.cjs");
    this.link = new ChainLink({ preload: path.join(preloadDir, "link.cjs"), dev: this.flags.dev, onTaken: () => { this.settings.chainLinkUntil = null; this.save(); } });
    this.tray = createTray(this.root, {
      summon: (mode) => this.summon(mode),
      openCrypt: () => this.openCrypt(),
      resurrectAll: () => this.resurrectAll(),
      settings: () => this.openSetup(),
      quit: () => app.quit()
    });
    this.wireIpc();
    powerMonitor.on("unlock-screen", () => this.dispatch({ type: "returned", safe: true }));
    powerMonitor.on("resume", () => this.poll());
    await this.overlay.create();
    if (this.flags.link) { this.settings.chainLinkUntil = new Date(Date.now() + 86400000).toISOString(); this.capture(); }
    this.timer = setInterval(() => { this.poll(); this.checkLink(); }, this.flags.fast ? 1000 : 5000);
    this.checkLink();

    if (this.flags.omen) {
      await this.prepare("sample");
      this.omen(this.flags.omen);
      this.capture();
    } else if (this.flags.demo) {
      this.settings.consented = true;
      await this.begin(this.flags.demoMode, { visitNow: !!this.flags.scene });
    } else if (!this.settings.consented || this.flags.setup) {
      this.openSetup();
      if (this.flags.setup) this.capture();
    } else if (!this.flags.hidden) {
      this.tray.setTip("A C-Drive Carol · the spirits wait in the tray");
    }
  }

  openSetup() { openSetup({ preload: this.setupPreload, root: this.root, dev: this.flags.dev }); }

  save() {
    this.settings.scheduler = this.sched;
    try { saveSettings(this.settingsFile, this.settings); } catch (err) { console.error("Couldn't save settings:", err.message); }
  }

  rendererSettings() {
    return { sound: this.settings.sound, volume: this.settings.volume, glow: this.settings.glow, dev: !!this.flags.dev, autoplay: !!this.flags.autoplay, autoAnswer: this.flags.answer, startAt: this.flags.scene || null, fast: !!this.flags.fast };
  }

  // ---------- the scheduler ----------
  dispatch(ev) {
    const { state, actions } = step(this.sched, { now: Date.now(), ...ev }, { scale: this.flags.fast ? 0.02 : 1, sound: this.settings.sound });
    this.sched = state;
    this.save();
    for (const a of actions) this.act(a);
  }

  act(a) {
    if (a.type === "visit") {
      if (this.scene === "warning" || this.scene === "omen") this.pendingVisit = true;
      else this.startVisit();
    } else if (a.type === "omen") this.omen(a.kind);
    else if (a.type === "warn") this.begin(this.settings.mode || "real", { again: true });
  }

  async poll() {
    if (this.pollBusy || !needsPolling(this.sched) || this.scene) return;
    this.pollBusy = true;
    try {
      const idle = powerMonitor.getSystemIdleTime();
      const returned = this.lastIdle > 600 && idle < 5;
      this.lastIdle = idle;
      const { safe, reasons } = await checkSafe({ idleSeconds: () => idle, minIdle: this.flags.fast ? 0 : 10 });
      if (this.flags.dev && !safe) console.log("Not a safe moment:", reasons.join(", "));
      if (returned) this.dispatch({ type: "returned", safe });
      this.dispatch({ type: "tick", safe });
    } finally {
      this.pollBusy = false;
    }
  }

  /** The morning-after chain link: there until picked up or a day has passed; never over fullscreen apps or scenes. */
  checkLink() {
    const until = Date.parse(this.settings.chainLinkUntil || "") || 0;
    if (until <= Date.now()) { if (this.link.open) this.link.close(); return; }
    if (this.scene || notificationState() !== 5) this.link.hide();
    else this.link.show({ sound: this.settings.sound, volume: this.settings.volume });
  }

  // ---------- the night ----------
  summon(mode) {
    if (!this.settings.consented) { this.openSetup(); return; }
    this.begin(mode);
  }

  /** Scan (or build the sample set), then Marlware's warning. */
  async begin(mode, { again = false, visitNow = false, onProgress = () => {} } = {}) {
    if (this.busy || this.scene === "visit") return;
    this.busy = true;
    this.tray.setBusy(true);
    try {
      this.settings.mode = mode;
      await this.prepare(mode, { again, onProgress });
      if (visitNow) { this.dispatch({ type: "summoned" }); return; }
      this.dispatch({ type: "warned" });
      this.link.hide();
      await this.overlay.passive();
      this.scene = "warning";
      this.overlay.send("scene", { name: "warning", night: this.night, icons: this.icons, refusals: this.sched.refusals, workArea: this.overlay.workArea(), size: this.overlay.size(), settings: this.rendererSettings() });
      this.capture();
    } catch (err) {
      console.error(err);
      new Notification({ title: "A C-Drive Carol", body: `The spirits couldn't look through your folders: ${err.message.split("\n")[0]}` }).show();
    } finally {
      this.busy = false;
      this.tray.setBusy(false);
      this.tray.setTip("A C-Drive Carol");
    }
  }

  async prepare(mode, { again = false, onProgress = () => {} } = {}) {
    this.tray.setTip(mode === "sample" ? "A C-Drive Carol · laying out the sample files" : "A C-Drive Carol · looking through your folders (read-only)");
    let m;
    if (mode === "sample") {
      m = buildSample(this.places.sample);
    } else {
      m = await scanReal({ roots: this.places.roots, crypt: this.places.crypt, cloud: this.places.cloud }, (text) => {
        onProgress(text);
        setupWindow()?.webContents.send("setup:progress", text);
      });
    }
    this.manifest = applyMemory(m, this.settings);
    this.night = prepareNight(this.manifest, { again, fled: this.sched.fled, previousCount: this.settings.lastCount ?? null });
    this.settings.lastCount = this.manifest.files.length;
    const shown = new Map();
    for (const f of [...this.night.past, ...this.night.chain.biggest, ...this.night.present.groups.flatMap((g) => g.files)]) shown.set(f.id, f);
    const byId = new Map(this.manifest.files.map((f) => [f.id, f]));
    this.icons = await iconsFor([...shown.keys()].map((id) => byId.get(id)).filter(Boolean));
    this.save();
  }

  async startVisit() {
    this.pendingVisit = false;
    if (!this.night) {
      try { await this.prepare(this.settings.mode || "sample"); } catch (err) { console.error(err); this.dispatch({ type: "visitEnded", completed: false }); return; }
    }
    this.scene = "visit";
    this.woke = false;
    this.link.hide();
    this.overlay.hide();
    await delay(250);   // let Windows take the overlay off the screen before the picture is taken
    const backdrop = this.flags.noBackdrop ? null : await captureDesktop();
    await this.overlay.visit();
    if (this.flags.escAt) setTimeout(() => { console.log("Pressing Esc"); this.onEsc(); console.log("Scheduler after Esc:", JSON.stringify({ phase: this.sched.phase, fled: this.sched.fled })); }, this.flags.escAt * 1000);
    this.overlay.send("scene", { name: "visit", night: this.night, icons: this.icons, backdrop: backdrop ? new Uint8Array(backdrop) : null, workArea: this.overlay.workArea(), size: this.overlay.size(), settings: this.rendererSettings() });
    this.capture();
  }

  async omen(kind) {
    if (kind === "notification") {
      new Notification({ title: "Jacob Marlware", body: "The hour approaches.", icon: path.join(this.root, "assets", "icon.png"), silent: true }).show();
      return;
    }
    if (kind === "cold") this.tray.setTip("The hour approaches.");
    const files = this.manifest ? omenFiles(this.manifest) : [];
    const icons = this.manifest ? await iconsFor(files) : {};
    if (kind === "rattle") { this.overlay.send("omen", { kind, settings: this.rendererSettings() }); return; }   // sound only
    this.scene = "omen";
    await this.overlay.passive();
    this.overlay.send("omen", { kind, files: files.map((f) => ({ id: f.id, name: f.name })), icons, word: this.manifest ? omenWord(this.manifest) : null, workArea: this.overlay.workArea(), size: this.overlay.size(), settings: this.rendererSettings() });
  }

  onEsc() {
    if (this.scene !== "visit") return;
    this.overlay.send("esc");
    this.overlay.hide();
    this.scene = null;
    this.night = null;
    this.dispatch({ type: "visitEnded", completed: !!this.woke });   // after Wake up, Esc just closes the morning
  }

  // ---------- after Wake up: the only place files move ----------
  wake(decisions) {
    const m = this.manifest;
    if (!m) return { moved: 0, bytes: 0, skipped: [] };
    const known = new Set(m.files.map((f) => f.id));
    const ids = (list) => (Array.isArray(list) ? list.map(String).filter((id) => known.has(id)) : []);
    const toRest = [...new Set([...ids(decisions.rest), ...ids(decisions.impostors)])];
    const result = layToRest(m, toRest);
    this.woke = true;
    this.settings = remember(this.settings, m, { banish: ids(decisions.banish), keep: ids(decisions.keep) });
    this.settings.chainLinkUntil = new Date(Date.now() + DAY).toISOString();
    const byId = new Map(m.files.map((f) => [f.id, f]));
    const bytes = result.moved.reduce((s, id) => s + (byId.get(id)?.size || 0), 0);
    // the manifest no longer describes moved files; drop them so nothing is offered twice
    const gone = new Set(result.moved);
    this.manifest = { ...m, files: m.files.filter((f) => !gone.has(f.id)) };
    this.save();
    return { moved: result.moved.length, bytes, skipped: result.skipped.map((s) => ({ name: byId.get(s.id)?.name || s.id, reason: s.reason })), simulated: m.mode === "sample", crypt: m.crypt };
  }

  // ---------- the Crypt ----------
  crypts() { return [this.places.crypt, path.join(this.places.sample, "Crypt")]; }

  restingSummary() {
    const all = this.crypts().map((c) => ({ crypt: c, ...resting(c) }));
    return {
      count: all.reduce((s, r) => s + r.count, 0),
      bytes: all.reduce((s, r) => s + r.bytes, 0),
      simulated: all.some((r) => r.simulated && r.count),
      entries: all.flatMap((r) => r.entries.map((e) => ({ key: e.key, name: e.name, from: e.from, size: e.size, simulatedSize: !!e.simulatedSize, at: e.at, sample: r.crypt !== this.places.crypt })))
    };
  }

  resurrectAll(keys = null) {
    const back = [], skipped = [];
    for (const c of this.crypts()) {
      if (!fs.existsSync(c)) continue;
      const r = resurrect(c, keys);
      back.push(...r.back); skipped.push(...r.skipped);
    }
    if (!keys) new Notification({ title: "A C-Drive Carol", body: back.length ? `Back from the grave: ${back.length} file${back.length === 1 ? "" : "s"} returned to where they were.` : "The Crypt is empty. Nothing to resurrect." }).show();
    return { back: back.length, skipped };
  }

  openCrypt(which) {
    const dir = which || (this.settings.mode === "sample" ? path.join(this.places.sample, "Crypt") : this.places.crypt);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  }

  // ---------- messages from the windows ----------
  wireIpc() {
    ipcMain.on("overlay:hover", (_e, over) => this.overlay.hover(over));
    ipcMain.on("overlay:answer", (_e, answer) => { if (["here", "now", "notTonight"].includes(answer)) this.dispatch({ type: "answer", answer }); });
    ipcMain.on("overlay:done", (_e, what) => {
      if (what === "warning" || what === "omen") {
        this.scene = null;
        if (this.pendingVisit) this.startVisit();
        else this.overlay.hide();
        if (what === "warning" && this.sched.phase === "warning") this.dispatch({ type: "dismissed" });
      } else if (what === "morning") {
        this.scene = null;
        this.overlay.hide();
        this.night = null;
        this.dispatch({ type: "visitEnded", completed: true });
        setTimeout(() => this.checkLink(), 1500);   // something left behind
      }
    });
    ipcMain.handle("overlay:wake", (_e, decisions) => this.wake(decisions || {}));
    ipcMain.handle("overlay:forecast", (_e, bytes) => {
      if (!this.manifest) return null;
      const f = forecast(this.manifest, Math.max(0, Number(bytes) || 0));
      return { full: f.full.toISOString(), redeemed: f.redeemed.toISOString(), fullLabel: f.fullLabel, redeemedLabel: f.redeemedLabel, simulated: f.simulated };
    });
    ipcMain.on("overlay:esc", () => this.onEsc());
    ipcMain.on("overlay:openCrypt", () => this.openCrypt(this.manifest?.crypt));
    ipcMain.on("overlay:log", (_e, text) => console.log("[overlay]", text));

    ipcMain.handle("setup:get", () => ({
      settings: { consented: this.settings.consented, sound: this.settings.sound, volume: this.settings.volume, startWithWindows: this.settings.startWithWindows, glow: this.settings.glow },
      places: { ...this.places.roots, crypt: this.places.crypt, synced: Object.keys(this.places.roots).filter((k) => this.places.cloud.some((c) => isInside(this.places.roots[k], c))) },
      resting: this.restingSummary(),
      version: app.getVersion()
    }));
    ipcMain.handle("setup:save", (_e, patch) => {
      const allowed = ["sound", "volume", "startWithWindows", "glow", "consented"];
      for (const k of allowed) if (patch && k in patch) this.settings[k] = k === "volume" || k === "glow" ? Number(patch[k]) : !!patch[k];
      if (patch && "startWithWindows" in patch && app.isPackaged) app.setLoginItemSettings({ openAtLogin: this.settings.startWithWindows, args: ["--hidden"] });
      this.save();
      this.overlay.send("settings", this.rendererSettings());
      return true;
    });
    ipcMain.handle("setup:begin", async (_e, mode) => {
      this.settings.consented = true;
      this.save();
      await this.begin(mode === "sample" ? "sample" : "real");
      closeSetup();
      return true;
    });
    ipcMain.handle("setup:resting", () => this.restingSummary());
    ipcMain.handle("setup:resurrect", (_e, keys) => this.resurrectAll(keys));
    ipcMain.on("setup:openCrypt", () => this.openCrypt(this.places.crypt));
    ipcMain.on("setup:close", () => closeSetup());
  }

  // ---------- development: save a picture of the overlay to check the look ----------
  capture() {
    const { capture, captureAt } = this.flags;
    if (!capture || !this.overlay.win) return;
    const target = () => (this.flags.setup ? setupWindow() : this.flags.link ? this.link.win : this.overlay.win);
    const times = String(captureAt || "4").split(",").map(Number).filter((n) => n >= 0);
    times.forEach((t, i) => setTimeout(async () => {
      const win = target();
      if (!win) return;
      const img = await win.webContents.capturePage();
      const file = times.length > 1 ? capture.replace(/(\.png)?$/, `-${i}.png`) : capture;
      fs.writeFileSync(file, img.toPNG());
      console.log("Captured", file);
    }, t * 1000));
  }
}

export { initialState };
