// Runs inside the real page (injected by layout-keys-page.test.ts, window 1100 wide: three groups on screen) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const lkWait = (ms) => new Promise((r) => setTimeout(r, ms));
const lkUntil = async (cond, ms = 6000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await lkWait(20); } return false; };
const lkKey = (target, key, opts = {}) => { const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }); target.dispatchEvent(e); return e; };
const lkTitle = (id) => (id === "canvas" ? "Canvas" : layoutDef[id]?.title ?? id);
const lkGroups = () => layoutApi.groups.filter((g) => g.panels.length).sort((a, b) => a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left || a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top);
const lkNames = () => lkGroups().map((g) => g.panels.map((p) => p.id).join("+"));
const lkWhere = () => { const a = document.activeElement; const g = lkGroups().find((x) => x.element.contains(a) || x.panels.some((p) => layoutEl(p.id).contains(a))); return g ? g.panels.map((p) => p.id).join("+") : null; };
const lkTab = (name) => lkGroups().find((g) => g.panels.some((p) => p.id === name)).element.querySelector('.dv-tab[tabindex="0"]');
const lkWidth = (name) => Math.round(lkGroups().find((g) => g.panels.some((p) => p.id === name)).element.getBoundingClientRect().width);
const lkSashes = () => [...document.querySelectorAll(".dv-sash[role=separator]")];
const lkLive = () => document.getElementById("layout-live")?.textContent ?? "";

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await lkUntil(() => $("home").hidden && $("opening").hidden);
    await lkWait(800);
    report.start = lkNames();

    // The layer tabs of the Canvas stay reachable at this width without a sideways scroll.
    const layers = document.getElementById("layers");
    const box = layers.getBoundingClientRect();
    report.layers = { scrolls: layers.scrollWidth > layers.clientWidth + 1, outside: [...layers.querySelectorAll("button[data-layer]")].filter((b) => { const r = b.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; }).map((b) => b.dataset.layer), width: Math.round(box.width) };

    // The keys are written down where the person looks for the Panels.
    document.getElementById("panels-button").click();
    await lkWait(100);
    report.note = document.querySelector("#panels-menu .menu-note")?.textContent ?? "";
    report.menuNav = [...document.querySelectorAll("#panels-menu [role=menuitem],#panels-menu [role=menuitemcheckbox]")].length > 5;
    document.getElementById("panels-button").click();
    await lkWait(100);

    // F6 moves between the Panels in the order they are on screen, and wraps.
    document.activeElement?.blur();
    const seen = [];
    for (let i = 0; i < 4; i++) { lkKey(document.body, "F6"); await lkWait(60); seen.push(lkWhere()); }
    report.f6 = seen;
    const back = [];
    for (let i = 0; i < 3; i++) { lkKey(document.activeElement ?? document.body, "F6", { shiftKey: true }); await lkWait(60); back.push(lkWhere()); }
    report.shiftF6 = back;
    const ring = getComputedStyle(document.activeElement.closest(".dv-tab") ?? document.activeElement);
    report.ring = { style: ring.outlineStyle, width: ring.outlineWidth };

    // Tab walks the Panels in screen order: the tab of a Panel, then what is in it, then the next Panel.
    lkTab("chat").focus();
    const walk = [lkWhere()];
    for (let i = 0; i < 45; i++) {
      const before = document.activeElement;
      const e = lkKey(before, "Tab");
      await lkWait(5);
      if (!e.defaultPrevented) break; // it left the dock
      walk.push(lkWhere() ?? ("sash:" + (document.activeElement?.getAttribute("aria-label") ?? "?")));
    }
    report.tabWalk = walk.filter((x, i) => x !== walk[i - 1]); // each stretch once
    // And back with Shift+Tab, from the last Panel.
    const back2 = [lkWhere()];
    for (let i = 0; i < 45; i++) {
      const e = lkKey(document.activeElement, "Tab", { shiftKey: true });
      await lkWait(5);
      if (!e.defaultPrevented) break;
      back2.push(lkWhere() ?? ("sash:" + (document.activeElement?.getAttribute("aria-label") ?? "?")));
    }
    report.tabBack = back2.filter((x, i) => x !== back2[i - 1]);

    // The borders between Panels: separators with a value, focusable, moved with the arrow keys.
    const sashes = lkSashes();
    report.sashes = sashes.map((s) => ({ orientation: s.getAttribute("aria-orientation"), label: s.getAttribute("aria-label"), now: Number(s.getAttribute("aria-valuenow")), min: Number(s.getAttribute("aria-valuemin")), max: Number(s.getAttribute("aria-valuemax")), tabindex: s.getAttribute("tabindex") }));
    const first = sashes[0];
    const w0 = lkWidth("chat");
    first.focus();
    lkKey(first, "ArrowRight"); await lkWait(250);
    const w1 = lkWidth("chat");
    lkKey(first, "ArrowRight", { shiftKey: true }); await lkWait(250);
    const w2 = lkWidth("chat");
    lkKey(first, "ArrowLeft"); await lkWait(250);
    const w3 = lkWidth("chat");
    for (let i = 0; i < 40; i++) lkKey(first, "ArrowLeft", { shiftKey: true });
    await lkWait(300);
    const wMin = lkWidth("chat");
    report.resize = { w0, w1, w2, w3, wMin, now: Number(first.getAttribute("aria-valuenow")), min: Number(first.getAttribute("aria-valuemin")) };
    lkKey(first, "Home"); await lkWait(250);
    report.home = { w: lkWidth("chat"), now: Number(first.getAttribute("aria-valuenow")) };
    lkKey(first, "End"); await lkWait(250);
    report.end = { w: lkWidth("chat"), now: Number(first.getAttribute("aria-valuenow")), max: Number(first.getAttribute("aria-valuemax")), canvas: lkWidth("canvas") };

    // Moving a Panel: the Tutor goes to the left of the Canvas with Alt+Shift+Left; then into the tabs of the Builder with Alt+Shift+Enter; the Canvas never goes into tabs.
    layoutUse({ canvasFolded: false, ...Object.fromEntries(layoutNames.map((n) => [`${n}Folded`, !["chat", "right"].includes(n)])) }); // Builder, Canvas, Tutor, in that order
    await lkWait(500);
    report.before = lkNames();
    lkTab("right").focus();
    lkKey(document.activeElement, "ArrowLeft", { altKey: true, shiftKey: true }); await lkWait(500);
    report.movedLeft = { names: lkNames(), live: lkLive() };
    lkTab("right").focus();
    lkKey(document.activeElement, "Enter", { altKey: true, shiftKey: true }); await lkWait(500);
    report.tabbed = { names: lkNames(), live: lkLive() };
    lkTab("canvas").focus();
    lkKey(document.activeElement, "Enter", { altKey: true, shiftKey: true }); await lkWait(400);
    report.canvasRefused = { names: lkNames(), live: lkLive() };
    lkTab("right").focus();
    lkKey(document.activeElement, "ArrowRight", { altKey: true, shiftKey: true }); await lkWait(500); // out of the tabs, to the right of the Canvas
    report.movedRight = { names: lkNames(), live: lkLive() };
    lkTab("canvas").focus();
    lkKey(document.activeElement, "ArrowRight", { altKey: true, shiftKey: true }); await lkWait(500); // the Canvas is the one on the left of the Tutor now: it swaps with it
    report.canvasMoves = lkNames();
    // The arrangement was saved.
    report.savedDock = !!JSON.parse(localStorage.getItem("aidea.layout") || "{}").dock;
    report.liveRegion = { role: document.getElementById("layout-live")?.getAttribute("role"), live: document.getElementById("layout-live")?.getAttribute("aria-live") };
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "lk-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
