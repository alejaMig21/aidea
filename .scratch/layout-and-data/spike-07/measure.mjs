// Same scenario on both prototypes, headless Chrome. Usage: node measure.mjs > results.json
import { chromium } from "playwright-core";
import http from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
const root = import.meta.dirname, types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const srv = http.createServer((q, r) => { try { const p = join(root, q.url.split("?")[0]); r.setHeader("content-type", types[extname(p)] || "text/plain"); r.end(readFileSync(p)); } catch { r.statusCode = 404; r.end(); } }).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/`;
mkdirSync(join(root, "shots"), { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const out = {};

async function run(engine, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(page); await cdp.send("Performance.enable"); await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const t0 = Date.now(); await page.goto(base + (engine === "plain" ? "plain.html" : "dock.html")); await page.waitForFunction(() => window.spike);
  const loadMs = Date.now() - t0;
  await page.evaluate(() => { const R = (window.__rec = { f: [], on: false, long: 0 }); let last = 0;
    new PerformanceObserver((l) => { if (R.on) R.long += l.getEntries().length; }).observe({ entryTypes: ["longtask"] });
    (function loop(t) { if (R.on) { if (last) R.f.push(t - last); last = t; } else last = 0; requestAnimationFrame(loop); })(0); });
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const res = { loadMs, errs };

  const geo = (id) => page.evaluate((id) => ({ p: spike.panelRect(id), g: spike.groupRect(id) }), id);
  const pointIn = (g, zone) => { const f = .1, cx = g.x + g.width / 2, cy = g.y + g.height / 2; return { center: [cx, cy + 40], left: [g.x + g.width * f, cy], right: [g.x + g.width * (1 - f), cy], top: [cx, g.y + 34 + (g.height - 34) * f], bottom: [cx, g.y + g.height * (1 - f)] }[zone]; };
  const sashBetween = async (idA) => { const { g } = await geo(idA); return page.evaluate(([x, y, sel]) => { const c = [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }).filter((r) => r.w > 0 && r.h > 0); c.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)); return c[0]; }, [g.x + g.width, g.y + g.height / 2, await page.evaluate(() => spike.sashSel)]); };

  // A drag that records frames, CPU time and long tasks.
  async function drag(from, to, { steps = 60, pace = 16, label, keepDown = false }) {
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + (to.x > from.x ? 6 : -6), from.y + (to.y > from.y ? 6 : -6), { steps: 3 });
    await page.waitForTimeout(60);
    await page.evaluate(() => { __rec.f = []; __rec.long = 0; __rec.on = true; }); const m0 = await metrics(); const w0 = Date.now();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await page.waitForTimeout(pace); }
    const wall = Date.now() - w0; const m1 = await metrics(); const rec = await page.evaluate(() => { __rec.on = false; return { f: __rec.f, long: __rec.long }; });
    await page.waitForTimeout(120); const preview = await page.evaluate(() => spike.previewShown());
    if (label) await page.screenshot({ path: join(root, "shots", `${engine}-x${throttle}-${label}.png`) });
    if (!keepDown) await page.mouse.up();
    const cpu = (k) => +((m1[k] - m0[k]) * 1000).toFixed(0);
    return { frames: rec.f.length, p50: pct(rec.f, .5), p95: pct(rec.f, .95), max: pct(rec.f, 1), over25: rec.f.filter((x) => x > 25).length, over50: rec.f.filter((x) => x > 50).length, longTasks: rec.long, wallMs: wall,
      scriptMs: cpu("ScriptDuration"), layoutMs: cpu("LayoutDuration"), styleMs: cpu("RecalcStyleDuration"), taskMs: cpu("TaskDuration"), previewAtEnd: preview };
  }

  const kb = { before: Math.round((await geo("canvas")).g.width) };
  await page.mouse.move(5, 5); await page.keyboard.press("Tab");
  let focusInfo = []; for (let i = 0; i < 12; i++) { focusInfo.push(await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}.${(a.className + "").slice(0, 28)}[${a.getAttribute("role") || ""}]` : null; })); await page.keyboard.press("Tab"); }
  kb.tabOrder = focusInfo;
  const sashFocusable = await page.evaluate(() => { const e = document.querySelector(spike.sashSel); return e ? { tabindex: e.getAttribute("tabindex"), role: e.getAttribute("role") } : null; });
  kb.sash = sashFocusable;
  if (sashFocusable?.tabindex != null) { await page.evaluate(() => [...document.querySelectorAll(spike.sashSel)][3].focus()); await page.keyboard.press("ArrowLeft"); kb.afterArrowLeft = Math.round((await geo("canvas")).g.width); }
  res.keyboard = kb;
  // 1. splitter drag: the border between Canvas and Run, 300px left then back (default row layout)
  let s = await sashBetween("canvas"); const before = (await geo("canvas")).p.width;
  res.splitter = await drag({ x: s.x, y: s.y }, { x: s.x - 300, y: s.y }, { label: "splitter" });
  const mid = (await geo("canvas")).p.width; s = await sashBetween("canvas");
  res.splitterBack = await drag({ x: s.x, y: s.y }, { x: s.x + 300, y: s.y }, {});
  res.splitterWidths = { before: Math.round(before), afterDrag: Math.round(mid), afterBack: Math.round((await geo("canvas")).p.width) };

  // 2. minimum size: push the Builder/Files border far to the left
  s = await sashBetween("builder"); await drag({ x: s.x, y: s.y }, { x: 20, y: s.y }, { steps: 20, pace: 5 });
  res.minBuilder = { min: 268, gotGroup: Math.round((await geo("builder")).g.width) };
  s = await sashBetween("builder"); await drag({ x: s.x, y: s.y }, { x: 1800, y: s.y }, { steps: 20, pace: 5 });
  const crushed = await page.evaluate(() => ["builder", "files", "code", "canvas", "run", "tutor"].map((id) => Math.round(spike.groupRect(id).width)));
  res.minPush = { widths: crushed, mins: [268, 200, 240, 376, 240, 288] };


  // 4. docking moves (title drag with landing preview)
  const move = async (id, target, zone, label) => { const t = await page.evaluate((i) => spike.tabPoint(i), id); const g = (await geo(target)).g; const [x, y] = pointIn(g, zone);
    return drag(t, { x, y }, { steps: 80, label, keepDown: false }); };
  await page.reload(); await page.waitForFunction(() => window.spike);
  await page.evaluate(() => { const R = (window.__rec = { f: [], on: false, long: 0 }); let last = 0; new PerformanceObserver((l) => { if (R.on) R.long += l.getEntries().length; }).observe({ entryTypes: ["longtask"] });
    (function loop(t) { if (R.on) { if (last) R.f.push(t - last); last = t; } else last = 0; requestAnimationFrame(loop); })(0); });
  res.moveA = await move("run", "tutor", "bottom", "A-stack");
  res.moveB = await move("code", "files", "bottom", "B-stack");
  res.moveC = await move("tutor", "code", "center", "C-tabs-across");
  res.moveD = await move("builder", "canvas", "bottom", "D-nest");
  const gs = await page.evaluate(() => ["builder", "files", "code", "canvas", "run", "tutor"].map((id) => [id, spike.visible(id), Object.values(spike.groupRect(id)).slice(0, 4).map(Math.round).join(",")]));
  res.afterMoves = gs;
  res.structure = { tutorWithCode: gs.find((x) => x[0] === "tutor")[2] === gs.find((x) => x[0] === "code")[2], runStacked: gs.find((x) => x[0] === "run")[2] !== gs.find((x) => x[0] === "tutor")[2] };
  await page.screenshot({ path: join(root, "shots", `${engine}-x${throttle}-after-moves.png`) });

  // 5. serialise / restore across a reload
  const j = await page.evaluate(() => spike.json()); const js = JSON.stringify(j);
  const snap = await page.evaluate(() => Object.fromEntries(["builder", "files", "code", "canvas", "run", "tutor"].map((id) => [id, [spike.visible(id), spike.panelRect(id)]])));
  await page.reload(); await page.waitForFunction(() => window.spike); await page.evaluate((j) => spike.restore(j), j); await page.waitForTimeout(300);
  const snap2 = await page.evaluate(() => Object.fromEntries(["builder", "files", "code", "canvas", "run", "tutor"].map((id) => [id, [spike.visible(id), spike.panelRect(id)]])));
  let maxDiff = 0, visMismatch = 0; for (const id in snap) { if (snap[id][0] !== snap2[id][0]) visMismatch++; if (snap[id][0]) for (const k of ["x", "y", "width", "height"]) maxDiff = Math.max(maxDiff, Math.abs(snap[id][1][k] - snap2[id][1][k])); }
  res.serialiseDetail = Object.fromEntries(Object.keys(snap).map((k) => [k, [snap[k][0], Math.round(snap[k][1].width), Math.round(snap2[k][1].width), Math.round(snap[k][1].height), Math.round(snap2[k][1].height)]]));
  res.serialise = { jsonBytes: js.length, roundTripMaxPxDiff: Math.round(maxDiff * 10) / 10, visibilityMismatches: visMismatch, sample: js.slice(0, 300) };

  // 6. restore tolerates an id the registry no longer knows (ticket 18)
  const bad = JSON.parse(js.replaceAll('"tutor"', '"ghost"'));
  await page.reload(); await page.waitForFunction(() => window.spike);
  res.unknownId = await page.evaluate((j) => { try { spike.restore(j); return { threw: false, panels: spike.api ? spike.api.panels.map((p) => p.id) : "n/a" }; } catch (e) { return { threw: true, msg: String(e.message).slice(0, 100), panelsLeft: spike.api ? spike.api.panels.length : "n/a" }; } }, bad);

  // 7. second window (dockview only; plain has no such code)
  if (engine === "dockview") {
    try { await page.reload(); await page.waitForFunction(() => window.spike);
      const pop = ctx.waitForEvent("page", { timeout: 5000 });
      const ok = await page.evaluate(() => spike.api.addPopoutGroup(spike.api.getPanel("run"), { popoutUrl: "popout.html" }));
      const p2 = await pop; await p2.waitForLoadState(); await page.waitForTimeout(400);
      res.popout = { ok, pages: ctx.pages().length, runInPopup: await p2.evaluate(() => !!document.querySelector('[data-panel="run"]')), mainStillHasRun: await page.evaluate(() => !!document.querySelector('[data-panel="run"]')) };
      await p2.screenshot({ path: join(root, "shots", `dockview-popout.png`) });
      await p2.close(); await page.waitForTimeout(400);
      res.popout.afterCloseRunBackInMain = await page.evaluate(() => !!document.querySelector('[data-panel="run"]') && spike.visible("run"));
    } catch (e) { res.popout = { error: String(e.message).slice(0, 200) }; }
  }
  await ctx.close(); return res;
}

for (const throttle of [1, 4]) for (const engine of ["plain", "dockview"]) { (out[`${engine}@x${throttle}`] = await run(engine, throttle)); console.error("done", engine, throttle); }
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
