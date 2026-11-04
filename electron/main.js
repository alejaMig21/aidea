// Desktop shell: runs the core as a separate Node process and shows its interface.
// AIDEA_DISPLAY=secondary opens the window on the second monitor, for live testing.
import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const coreScript = fileURLToPath(new URL("../src/core/main.ts", import.meta.url));
// windowsHide: without it Windows opens a console window for the core, which looks untrustworthy in a desktop app.
// --safe starts with every plugin that does not ship with aidea off (the way back from a plugin that breaks the start).
const safe = process.argv.includes("--safe");
const core = spawn("node", [coreScript], { stdio: ["ignore", "pipe", "inherit"], windowsHide: true, env: { ...process.env, ...(safe ? { AIDEA_SAFE_MODE: "1" } : {}) } });
app.on("quit", () => core.kill());
// What Play started lives under the core, and killing the core does not end it: before the core goes, ask it to stop the parts.
let coreUrl = null;
const callRun = async (name) => {
  try { return await (await fetch(`${coreUrl}/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json(); } catch { return {}; }
};
// Folder picker for the interface. Resolves to the chosen path, or null when cancelled.
ipcMain.handle("pick-folder", async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory"] });
  return canceled ? null : filePaths[0];
});
// A change to the plugins that needs a restart (removing code that already ran): the core and the window start again.
ipcMain.handle("restart-app", async (_e, inSafeMode) => {
  await callRun("stopAll");
  core.kill();
  const args = process.argv.slice(1).filter((a) => a !== "--safe");
  app.relaunch({ args: inSafeMode ? [...args, "--safe"] : args });
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
  // Closing with parts running asks first; with nothing running it does not. Confirming stops every part and its children, then closes.
  let closing = false, asking = false;
  win.on("close", async (e) => {
    if (closing) return;
    e.preventDefault();
    if (asking) return;
    asking = true;
    try {
      const { count = 0 } = await callRun("running");
      if (count) {
        const { response } = await dialog.showMessageBox(win, { type: "question", buttons: ["Stop and close", "Keep aidea open"], defaultId: 1, cancelId: 1, title: "aidea", message: `${count === 1 ? "A part of your project is" : `${count} parts of your project are`} still running.`, detail: "Closing aidea stops everything Play started." });
        if (response !== 0) return;
        await callRun("stopAll");
      }
      closing = true;
      win.close();
    } finally { asking = false; }
  });
  // A link that asks for a new window (such as the licence link on the Business canvas) opens in the person's browser, never in this window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(url);
}

core.stdout.on("data", (chunk) => {
  const url = /listening on (\S+)/.exec(chunk.toString())?.[1];
  if (url) coreUrl = url;
  if (url) app.whenReady().then(() => openWindow(url));
});
