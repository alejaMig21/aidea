// Real double clicks in Chrome (playwright-core from the old scratchpad): a Canvas box must not select text or show the popup; text in the Tutor still does.
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/");
const { chromium } = require("playwright-core");
process.chdir("D:/Projects/aidea");
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const scratch = mkdtempSync(join(tmpdir(), "aidea-dbl-"));
const project = join(scratch, "project");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "tally.py"), "def tally(words):\n    return len(words)\n\n\ndef build(n):\n    return n\n");
const core = await startCore({ port: 0, recentsFile: join(scratch, "r.json"), preferencesFile: join(scratch, "p.json"), learnerDir: join(scratch, "l"), pluginsDir: join(scratch, "s") });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const out = {};
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(core.url);
  await page.evaluate((p) => openProject(p), project);
  await page.waitForSelector('rect[data-id="tally.build"]', { timeout: 20000 });
  const state = () => page.evaluate(() => ({ selected: getSelection().toString(), popHidden: document.getElementById("select-pop").hidden }));
  // 1. A Node on Components (the same rule covers module boxes, function rows and authored Nodes).
  await page.dblclick('rect[data-id="tally.build"]');
  await page.waitForTimeout(500);
  out.boxDoubleClick = await state();
  out.userSelect = await page.evaluate(() => getComputedStyle(document.querySelector('rect[data-id="tally.build"]')).userSelect);
  // 2. A double click on text of the Tutor column still offers the popup.
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.click(5, 5);
  await page.locator("#panel, [aria-label='Tutor']").first().waitFor({ timeout: 5000 }).catch(() => {});
  const at = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf("questions"); if (i >= 0 && n.parentElement.closest("#panel, [aria-label=Tutor]")) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 9); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } } return null; });
  out.at = at;
  await page.mouse.dblclick(at.x, at.y);
  await page.waitForTimeout(500);
  out.tutorTextDoubleClick = await state();
  await page.screenshot({ path: join(scratch, "dbl.png") });
  out.shot = join(scratch, "dbl.png");
} catch (e) { out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out, null, 1));
await browser.close();
await core.plugins.deactivate("run"); core.close();
process.exit(0);
