// Preload must be CommonJS (package.json is "type": "module"). Exposes only the folder picker to the interface.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("aidea", { pickFolder: () => ipcRenderer.invoke("pick-folder") });
