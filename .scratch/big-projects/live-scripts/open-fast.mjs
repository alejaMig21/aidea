// Live check (real Electron window, second monitor) of big-projects 01: how long opening Telegram takes the first time and the second time, and that nothing
// was written inside the Project. playwright-core is not a dependency of aidea: it is loaded from the scratch folder that has it.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const project = process.argv[2] ?? "D:/Projects/Telegram";
const root = join(import.meta.dirname, "open-fast-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(root, { recursive: true });
const shots = join(import.meta.dirname, "open-fast-shots");
mkdirSync(shots, { recursive: true });
const listing = () => readdirSync(project, { recursive: true }).filter((p) => !/^\.git[\\/]/.test(p) && !/^\.codebase-memory/.test(p)).sort().join("\n");
const before = listing();
const env = { ...process.env, AIDEA_DISPLAY: "secondary", AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "store"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9382", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9382"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
const results = {};
for (const label of ["first opening", "second opening"]) {
  const ms = await page.evaluate(async (p) => {
    const t0 = performance.now();
    document.querySelectorAll("#world rect").forEach((r) => r.remove()); // a stale drawing must not count as the new one
    await openProject(p);
    for (let i = 0; i < 2400 && !(document.getElementById("home").hidden && document.getElementById("opening").hidden && document.querySelector("#world rect")); i++) await new Promise((r) => setTimeout(r, 25));
    return Math.round(performance.now() - t0);
  }, project);
  await wait(800);
  results[label] = ms;
  await page.screenshot({ path: join(shots, `${label.replace(" ", "-")}.png`) });
}
const cacheFiles = existsSync(join(root, "cache", "analysis")) ? readdirSync(join(root, "cache", "analysis")).map((f) => `${f} ${statSync(join(root, "cache", "analysis", f)).size} bytes`) : [];
const untouched = listing() === before;
console.log(JSON.stringify({ project, ...results, cacheFiles, projectFolderUntouched: untouched }, null, 1));
const pass = results["second opening"] < 1500 && cacheFiles.length === 1 && untouched;
console.log(pass ? "PASS" : "FAIL");
child.kill();
process.exit(pass ? 0 : 1);
