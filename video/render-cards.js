// The demo video's cards (cut.json) drawn to PNGs in the app's own type, in an offscreen Electron window. build.js
// runs this (electron video/render-cards.js); the pictures land in video/out/cards. Nothing is fetched: every request
// but the page's own files is cancelled, as in the app.

import { app, BrowserWindow, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cut = JSON.parse(fs.readFileSync(process.env.CUT || path.join(HERE, "cut.json"), "utf8"));
const [W, H] = cut.size;
const OUT = path.join(HERE, "out", "cards");

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith("file:") }));
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false, frame: false, transparent: true, backgroundColor: "#00000000",
    webPreferences: { offscreen: { deviceScaleFactor: 1 }, sandbox: true, contextIsolation: true }
  });
  win.setContentSize(W, H);   // Windows fits a new window inside the work area, short of the taskbar; a card is the full frame
  try {
    for (const [id, card] of Object.entries(cut.cards)) {
      await win.loadFile(path.join(HERE, "cards.html"), { query: { card: JSON.stringify(card) } });
      // every face loaded, and two frames drawn with them
      await win.webContents.executeJavaScript("document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))");
      const img = await win.webContents.capturePage();
      const { width, height } = img.getSize();
      fs.writeFileSync(path.join(OUT, `${id}.png`), img.toPNG());
      console.log(`card ${id}: ${width}x${height}`);
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  app.quit();
});
