// Desktop shell: runs the core as a separate Node process and shows its interface.
// AIDEA_DISPLAY=secondary opens the window on the second monitor, for live testing.
import { app, BrowserWindow, screen } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const coreScript = fileURLToPath(new URL("../src/core/main.ts", import.meta.url));
const core = spawn("node", [coreScript], { stdio: ["ignore", "pipe", "inherit"] });
app.on("quit", () => core.kill());

function openWindow(url) {
  const primary = screen.getPrimaryDisplay();
  const target = process.env.AIDEA_DISPLAY === "secondary"
    ? screen.getAllDisplays().find((d) => d.id !== primary.id) ?? primary
    : primary;
  const { x, y } = target.workArea;
  new BrowserWindow({ x, y, width: 1280, height: 800 }).loadURL(url);
}

core.stdout.on("data", (chunk) => {
  const url = /listening on (\S+)/.exec(chunk.toString())?.[1];
  if (url) app.whenReady().then(() => openWindow(url));
});
