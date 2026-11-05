// Which part of the Components drawing slows panning? Headless Chrome (playwright-core), Telegram with its test modules open.
import { createRequire } from "node:module";
const require = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/");
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("http://127.0.0.1:4066");
const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fps = (ms) => new Promise((res) => { let n = 0, t0 = performance.now(); const tick = (t) => { view.x += n % 2 ? 4 : -4; apply(); n++; if (t - t0 < ms) requestAnimationFrame(tick); else res(Math.round(n / ((t - t0) / 1000))); }; requestAnimationFrame(tick); });
  const css = (txt) => { const s = document.createElement("style"); s.textContent = txt; document.head.append(s); return s; };
  await openProject("D:/Projects/Telegram");
  for (let i = 0; i < 400 && !document.querySelector("#world rect"); i++) await wait(25);
  await wait(500);
  const out = { closed: await fps(1500) };
  componentsToggleTests();
  await wait(1500);
  out.elements = document.querySelectorAll("#world *").length;
  out.testsOpen = await fps(1500);
  for (const [name, rule] of [["noText", "#world text { display: none !important; }"], ["noPaths", "#world path { display: none !important; }"], ["noMarkers", "#world path { marker-end: none !important; marker-start: none !important; }"], ["noRects", "#world rect { display: none !important; }"], ["noTitles", "#world title { display: none; }"], ["optimizeSpeed", "#world * { shape-rendering: optimizeSpeed !important; }"]]) {
    const s = css(rule);
    await wait(150);
    out[name] = await fps(1200);
    s.remove();
  }
  const special = [...document.querySelectorAll("#world *")].filter((e) => { const c = getComputedStyle(e); return c.filter !== "none" || c.paintOrder !== "normal" || c.mixBlendMode !== "normal"; });
  out.special = special.length;
  out.specialSample = [...new Set(special.map((e) => e.tagName + "." + (e.getAttribute("class") || "")))].slice(0, 6);
  return out;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(0);
