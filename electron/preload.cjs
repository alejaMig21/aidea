// Preload must be CommonJS (package.json is "type": "module"). Exposes only the folder picker and the restart of the application to the interface.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("aidea", { pickFolder: () => ipcRenderer.invoke("pick-folder"), restart: (inSafeMode) => ipcRenderer.invoke("restart-app", !!inSafeMode) });
