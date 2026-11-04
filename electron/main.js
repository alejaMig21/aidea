// Desktop shell: runs the core as a separate Node process and shows its interface.
// AIDEA_DISPLAY=secondary opens the window on the second monitor, for live testing.
import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const coreScript = fileURLToPath(new URL("../src/core/main.ts", import.meta.url));
// windowsHide: without it Windows opens a console window for the core, which looks untrustworthy in a desktop app.
const core = spawn("node", [coreScript], { stdio: ["ignore", "pipe", "inherit"], windowsHide: true });
app.on("quit", () => core.kill());
// Folder picker for the interface. Resolves to the chosen path, or null when cancelled.
ipcMain.handle("pick-folder", async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory"] });
  return canceled ? null : filePaths[0];
});
// A change to the plugins that needs a restart (removing code that already ran): the core and the window start again.
ipcMain.handle("restart-app", () => {
  core.kill();
  app.relaunch();
  app.exit(0);
});
Menu.setApplicationMenu(null); // the default File/Edit/View/Window menu has nothing aidea needs

function openWindow(url) {
  const primary = screen.getPrimaryDisplay();
  const target = process.env.AIDEA_DISPLAY === "secondary"
    ? screen.getAllDisplays().find((d) => d.id !== primary.id) ?? primary
    : primary;
  const { x, y } = target.workArea;
  // Placing the window with setBounds is more reliable than x and y in the constructor when the screens have
  // different scales (the second launch of the first test opened on the wrong screen).
  const win = new BrowserWindow({ width: 1280, height: 800, minWidth: 720, minHeight: 520, show: false, webPreferences: { preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)), contextIsolation: true, nodeIntegration: false } });
  // Twice: the first call moves the window and the second fixes its size, which the first one reads at the old screen's scale.
  win.setBounds({ x, y, width: 1280, height: 800 });
  win.setBounds({ x, y, width: 1280, height: 800 });
  win.once("ready-to-show", () => win.show());
  // A link that asks for a new window (such as the licence link on the Business canvas) opens in the person's browser, never in this window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(url);
}

core.stdout.on("data", (chunk) => {
  const url = /listening on (\S+)/.exec(chunk.toString())?.[1];
  if (url) app.whenReady().then(() => openWindow(url));
});
