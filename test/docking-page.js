// Runs inside the real page (injected by docking.test.ts after every feature script) and writes what it saw as JSON into a pre element.
// Nothing here names a Panel except where a Panel's own behaviour is tested (Run depends on a Flow); what is expected comes from the registry.
// window.DOCK_MODE is "wide" or "narrow" (the window size is set by the test).
const report = { errors: [], mode: window.DOCK_MODE };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Waits for a condition instead of a fixed time (the Layout announces every change with "layout-applied", the library settles on animation frames).
const until = async (cond, ms = 3000) => { for (let t = 0; t < ms; t += 10) { if (cond()) return true; await wait(10); } return false; };
let applied = 0;
document.addEventListener("layout-applied", () => applied++);
// Runs an action that makes the Layout apply, and waits until it has.
const change = async (action) => { const n = applied; action(); await until(() => applied > n); await wait(0); };
const group = (id) => layoutApi.getPanel(id).group.element.getBoundingClientRect();
const inDock = () => layoutApi.panels.map((p) => p.id);
// The Panels in the Layout, left to right (the DOM order of the library's cards is not the screen order).
const row = () => layoutApi.panels.filter((p) => p.group.panels.length === 1).sort((a, b) => group(a.id).left - group(b.id).left).map((p) => p.id);
const rows = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")];
const menuRow = (title) => rows().find((b) => b.dataset.title === title);
const menuOpen = () => document.getElementById("panels-menu").hidden && document.getElementById("panels-button").click();
const menuClose = () => document.getElementById("panels-menu").hidden || document.getElementById("panels-button").click();
const menu = async (title) => { menuOpen(); await change(() => menuRow(title).click()); menuClose(); };
const mouse = (type, target, x, y) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
const realWidth = layoutWidth; // the page's own width function, put back after a test makes the window look narrow or wide

async function wide() {
  const left = (id) => Math.round(group(id).left), width = (id) => Math.round(group(id).width);
  report.default = { row: row(), inDock: inDock().sort(), widths: Object.fromEntries(row().map((id) => [id, width(id)])), width: document.documentElement.clientWidth };
  report.closeButtons = [...document.querySelectorAll(".dv-default-tab-action")].filter((e) => getComputedStyle(e).display !== "none").length;
  report.cardsHaveNoTitleRow = document.querySelectorAll(".panel-card .card-head").length;

  // No Panel can be squeezed below its minimum: push a border with the mouse (the first press on a border that does not move anything is no choice of sizes).
  const sash = [...document.querySelectorAll(".dv-sash")].find((s) => s.getBoundingClientRect().height > 100);
  const sr = sash.getBoundingClientRect(), sx = sr.left + sr.width / 2, sy = sr.top + 300;
  const before = Object.fromEntries(row().map((id) => [id, width(id)]));
  const pointer = (type, target, x) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: sy, pointerId: 1, pointerType: "mouse", isPrimary: true, buttons: 1, view: window }));
  pointer("pointerdown", sash, sx); pointer("pointerup", document, sx); // a press with no drag
  report.pressOnly = { widths: Object.fromEntries(row().map((id) => [id, width(id)])) };
  pointer("pointerdown", sash, sx); mouse("mousedown", sash, sx, sy);
  for (let i = 1; i <= 30; i++) { pointer("pointermove", document, sx - i * 60); mouse("mousemove", document, sx - i * 60, sy); }
  pointer("pointerup", document, sx - 1800); mouse("mouseup", document, sx - 1800, sy);
  await until(() => row().some((id) => Math.abs(width(id) - before[id]) > 5));
  report.pushed = { moved: row().some((id) => Math.abs(width(id) - before[id]) > 5), tooSmall: row().filter((id) => width(id) < (id === "canvas" ? layoutCanvasMin : layoutDef[id].min)) };
  await menu("Files"); await menu("Code");
  report.filesCode = { row: row(), ordered: left("files") < left("code") && left("code") < left("canvas") };

  const tooSmall = [];
  for (const id of row()) layoutApi.getPanel(id).api.setSize({ width: 10 });
  await wait(50);
  for (const id of row()) { const min = id === "canvas" ? layoutCanvasMin : layoutDef[id].min; if (width(id) < min) tooSmall.push(`${id}:${width(id)}<${min}`); }
  report.minimums = { tooSmall, canvas: width("canvas") };
  await menu("Code"); await menu("Files");

  // A Panel that depends on something (Run) is in the Layout only while it is available, between the Canvas and the Tutor; a hide the person chose stays.
  const runIn = () => inDock().includes("run");
  report.run = { before: runIn() };
  await change(() => layoutSetRunAvailable(true));
  report.run.available = runIn();
  report.run.order = row();
  await change(() => layoutSetRunAvailable(false));
  report.run.unavailable = runIn();
  await change(() => layoutSetRunAvailable(true));
  await menu("Run"); // the person hides it
  report.run.hiddenByPerson = !runIn();
  await change(() => layoutSetRunAvailable(false)); await change(() => layoutSetRunAvailable(true));
  report.run.staysHidden = !runIn();
  await menu("Run");
  report.run.shownAgain = runIn();

  // A hidden Panel returns where it was: move the Tutor to the left of the Canvas, hide it, show it.
  layoutApi.getPanel("right").api.moveTo({ group: layoutApi.getPanel("canvas").group, position: "left" });
  await until(() => row().indexOf("right") < row().indexOf("canvas"));
  const placed = row();
  await menu("Tutor"); report.home = { placed, hidden: !inDock().includes("right") };
  await menu("Tutor"); report.home.sameAsBefore = JSON.stringify(row()) === JSON.stringify(placed);
  await change(() => layoutSetRunAvailable(false)); await change(() => layoutSetRunAvailable(true));

  // Tabs: Run and the Tutor in one group, through the library's own api; a Panel hidden from a group of tabs comes back as a tab of it.
  layoutApi.getPanel("run").api.moveTo({ group: layoutApi.getPanel("right").group, position: "center" });
  await until(() => layoutApi.getPanel("run").group === layoutApi.getPanel("right").group);
  const tabs = layoutApi.getPanel("right").group.panels.map((p) => p.id).sort();
  await menu("Run"); const gone = !inDock().includes("run");
  await menu("Run");
  report.tabs = { tabs, gone, back: layoutApi.getPanel("right").group.panels.map((p) => p.id).sort(), tabElements: document.querySelectorAll(".dv-tab").length };
  // ... and the tabs and the sizes survive a trip through a narrow window (the window is made to look narrow and wide again; the dock itself keeps its size).
  layoutApi.getPanel("chat").api.setSize({ width: 300 });
  const trip = { sizes: Object.fromEntries(inDock().map((id) => [id, Math.round(group(id).width)])) };
  await change(() => { window.layoutWidth = () => 700; layoutApply(); });
  trip.narrowIn = inDock();
  await change(() => { window.layoutWidth = realWidth; layoutApply(); });
  trip.groups = layoutApi.getPanel("right").group.panels.map((p) => p.id).sort();
  trip.sizesAfter = Object.fromEntries(inDock().map((id) => [id, Math.round(group(id).width)]));
  report.trip = trip;
  await change(() => layoutSetRunAvailable(false));

  // A drop that would put the Canvas in a group of tabs, or a Panel behind the Canvas, is not offered; a drop between other Panels is (the control).
  const tab = (title) => [...document.querySelectorAll(".dv-tab")].find((e) => e.textContent.trim() === title);
  const fire = (el, type, x, y, dt) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
  const preview = () => [...document.querySelectorAll(".dv-drop-target-selection, .dv-drop-target-anchor")].some((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).display !== "none"; });
  const offered = async (dragTitle, onto) => {
    const dt = new DataTransfer();
    fire(tab(dragTitle), "dragstart", 0, 0, dt);
    const g = group(onto), x = g.left + g.width / 2, y = g.top + g.height / 2;
    const target = layoutApi.getPanel(onto).group.element.querySelector(".dv-content-container") ?? layoutApi.getPanel(onto).group.element;
    fire(target, "dragenter", x, y, dt); fire(target, "dragover", x, y, dt);
    await wait(60);
    const shown = preview();
    fire(tab(dragTitle), "dragend", 0, 0, dt); fire(target, "dragleave", x, y, dt);
    await wait(30);
    return shown;
  };
  report.drops = { tutorOntoBuilder: await offered("Tutor", "chat"), tutorOntoCanvas: await offered("Tutor", "canvas"), canvasOntoBuilder: await offered("Canvas", "chat") };

  // A Panel taken out of the Layout by the library (a stray drag-out) comes back, and is not saved as hidden. A failing add leaves the Layout working.
  const realAdd = layoutApi.addPanel.bind(layoutApi);
  layoutApi.addPanel = (o) => { if (o.id === "run") throw new Error("the library failed"); return realAdd(o); };
  let threw = false;
  try { layoutSetRunAvailable(true); } catch { threw = true; }
  layoutApi.addPanel = realAdd;
  await change(() => layoutApply());
  layoutApi.removePanel(layoutApi.getPanel("right"));
  await until(() => inDock().includes("right"));
  report.stray = { threw, runAfterFailure: inDock().includes("run"), tutorBack: inDock().includes("right"), tutorSavedHidden: JSON.parse(localStorage.getItem("aidea.layout") || "{}").rightFolded === true };
  await change(() => layoutSetRunAvailable(false));

  // The Canvas is never hidden by accident: with every other Panel hidden its row stays checked and disabled, and it stays on screen.
  for (const d of layoutRegistry) if (inDock().includes(d.id)) await menu(d.title);
  const canvasRow = menuRow("Canvas");
  report.alone = { inDock: inDock(), checked: canvasRow.getAttribute("aria-checked"), disabled: canvasRow.getAttribute("aria-disabled"), reason: canvasRow.querySelector(".reason")?.textContent ?? "" };
  canvasRow.click(); await wait(50);
  report.alone.afterClick = inDock();
  for (const d of layoutRegistry) if (!d.startsHidden && !d.available) await menu(d.title);
  report.restored = inDock();

  // The page serves the library.
  report.vendor = { found: (await fetch("/vendor/dockview/dockview-core.min.js")).status, missing: (await fetch("/vendor/dockview/nothing.js")).status };
}

// The library's file is missing (the test's proxy answers 404): the Layout engine is a stand-in, the Canvas is shown with a plain sentence.
async function nolib() {
  menuOpen();
  report.message = document.getElementById("layout-notice")?.textContent ?? "";
  report.canvasShown = layoutMain.getClientRects().length > 0;
  report.chatBuilt = !!document.getElementById("chat-log");
  report.menuOpens = !document.getElementById("panels-menu").hidden && rows().length >= 5;
}

async function narrow() {
  report.narrow = { is: layoutNarrow, inDock: inDock(), width: document.documentElement.clientWidth };
  const button = document.getElementById("panels-button");
  menuOpen(); await change(() => menuRow("Tutor").click());
  const card = document.getElementById("right");
  const r = card.getBoundingClientRect();
  report.drawer = { open: layoutDrawer, isDrawer: card.classList.contains("is-drawer"), role: card.getAttribute("role"), onScreen: card.getClientRects().length > 0, covers: r.height > 300, scrim: !document.getElementById("scrim").hidden, menuClosed: document.getElementById("panels-menu").hidden, inDock: inDock(), focusInDrawer: document.activeElement === card };
  await change(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  report.escape = { open: layoutDrawer, focusOnOpener: document.activeElement === button, onScreen: card.getClientRects().length > 0, parked: card.parentElement.id };
  menuOpen(); await change(() => menuRow("Builder").click());
  await change(() => document.querySelector("#chat .drawer-close").click());
  report.closeButton = { open: layoutDrawer };
  menuOpen(); await change(() => menuRow("Builder").click());
  await change(() => document.getElementById("scrim").click());
  report.scrim = { open: layoutDrawer };
  report.canvasRow = { disabled: menuRow("Canvas").getAttribute("aria-disabled") };
  // The window grows wide under an open drawer: the drawer goes, the focus goes to the Panels button (not to the page), and the Panels are back in the Layout.
  menuOpen(); await change(() => menuRow("Tutor").click());
  await change(() => { window.layoutWidth = () => 1400; layoutApply(); });
  report.grown = { open: layoutDrawer, focusOnPanels: document.activeElement === button, scrim: !document.getElementById("scrim").hidden, wide: !layoutNarrow, inDock: inDock().sort() };
  // Escape afterwards must not do anything stale; and a new drawer cannot return its focus to the old opener.
  await change(() => { window.layoutWidth = realWidth; layoutApply(); });
  document.getElementById("chat-input")?.focus();
  menuOpen(); await change(() => menuRow("Builder").click());
  await change(() => document.getElementById("scrim").click());
  report.afterGrown = { open: layoutDrawer, focusOnPanels: document.activeElement === button };
}

(async () => {
  try {
    await openProject(window.PANELS_PROJECT); // without a Project the Home screen covers the whole workspace
    await until(() => $("home").hidden && $("opening").hidden, 10000);
    await wait(300);
    await (window.DOCK_MODE === "narrow" ? narrow() : window.DOCK_MODE === "nolib" ? nolib() : wide());
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre"); // built, not written as text, so the page source never contains the marker the test looks for
  out.id = "dock-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
