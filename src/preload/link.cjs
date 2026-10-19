// The chain link's door to the app: whether the cursor is over it, and when it's picked up.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("carol", {
  hover: (over) => ipcRenderer.send("link:hover", !!over),
  taken: () => ipcRenderer.send("link:taken")
});
