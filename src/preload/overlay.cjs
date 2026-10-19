// The overlay's only door to the rest of the app. It can show what it's told and send back ids and answers.
const { contextBridge, ipcRenderer } = require("electron");

const LISTEN = new Set(["scene", "omen", "backdrop", "settings", "esc"]);

contextBridge.exposeInMainWorld("carol", {
  on(channel, fn) {
    if (!LISTEN.has(channel)) throw new Error(`No such channel: ${channel}`);
    ipcRenderer.on(channel, (_e, payload) => fn(payload));
  },
  hover: (over) => ipcRenderer.send("overlay:hover", !!over),
  answer: (answer) => ipcRenderer.send("overlay:answer", String(answer)),
  done: (what, data) => ipcRenderer.send("overlay:done", String(what), data ?? null),
  wake: (decisions) => ipcRenderer.invoke("overlay:wake", decisions),
  forecast: (bytes) => ipcRenderer.invoke("overlay:forecast", Number(bytes) || 0),
  escape: () => ipcRenderer.send("overlay:esc"),
  openCrypt: () => ipcRenderer.send("overlay:openCrypt"),
  log: (...args) => ipcRenderer.send("overlay:log", args.map(String).join(" "))
});
