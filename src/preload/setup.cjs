// The setup and settings window's door to the app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("carol", {
  get: () => ipcRenderer.invoke("setup:get"),
  save: (patch) => ipcRenderer.invoke("setup:save", patch),
  begin: (mode) => ipcRenderer.invoke("setup:begin", mode === "sample" ? "sample" : "real"),
  resting: () => ipcRenderer.invoke("setup:resting"),
  resurrect: (keys) => ipcRenderer.invoke("setup:resurrect", Array.isArray(keys) ? keys.map(String) : null),
  openCrypt: () => ipcRenderer.send("setup:openCrypt"),
  close: () => ipcRenderer.send("setup:close"),
  onProgress: (fn) => ipcRenderer.on("setup:progress", (_e, text) => fn(String(text)))
});
