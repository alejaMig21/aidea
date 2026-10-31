// Runs inside the real page (injected by docking.test.ts after every feature script) and writes what it saw as JSON into a pre element.
// Nothing here names a Panel except where a Panel's own behaviour is tested (Run depends on a Flow); what is expected comes from the registry.
// window.DOCK_MODE is "wide" or "narrow" (the window size is set by the test).
const report = { errors: [], mode: window.DOCK_MODE };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rect = (id) => (id === "canvas" ? layoutMain : document.getElementById(id)).getBoundingClientRect();
const group = (id) => layoutApi.getPanel(id).group.element.getBoundingClientRect();
const inDock = () => layoutApi.panels.map((p) => p.id);
// The Panels in the Layout, left to right (the DOM order of the library's cards is not the screen order).
const row = () => layoutApi.panels.filter((p) => p.group.panels.length === 1).sort((a, b) => group(a.id).left - group(b.id).left).map((p) => p.id);
const rows = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")];
const menuRow = (title) => rows().find((b) => b.dataset.title === title);
const menu = async (title) => { document.getElementById("panels-menu").hidden && document.getElementById("panels-button").click(); await wait(30); menuRow(title).click(); await wait(80); document.getElementById("panels-menu").hidden || document.getElementById("panels-button").click(); await wait(30); };
const mouse = (type, target, x, y) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));

async function wide() {
  const left = (id) => Math.round(group(id).left), width = (id) => Math.round(group(id).width);
  report.default = { row: row(), inDock: inDock().sort(), widths: Object.fromEntries(row().map((id) => [id, width(id)])), width: document.documentElement.clientWidth };
  report.closeButtons = [...document.querySelectorAll(".dv-default-tab-action")].filter((e) => getComputedStyle(e).display !== "none").length;
  report.cardsHaveNoTitleRow = document.querySelectorAll(".panel-card .card-head").length;

  // No Panel can be squeezed below its minimum: push a border with the mouse, and ask the library for impossible sizes.
  const sash = [...document.querySelectorAll(".dv-sash")].find((s) => s.getBoundingClientRect().height > 100);
  const sr = sash.getBoundingClientRect(), sx = sr.left + sr.width / 2, sy = sr.top + 300;
  const before = Object.fromEntries(row().map((id) => [id, width(id)]));
  const pointer = (type, target, x) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: sy, pointerId: 1, pointerType: "mouse", isPrimary: true, buttons: 1, view: window }));
  pointer("pointerdown", sash, sx); mouse("mousedown", sash, sx, sy);
  for (let i = 1; i <= 30; i++) { pointer("pointermove", document, sx - i * 60); mouse("mousemove", document, sx - i * 60, sy); }
  pointer("pointerup", document, sx - 1800); mouse("mouseup", document, sx - 1800, sy);
  await wait(100);
  report.pushed = { moved: row().some((id) => Math.abs(width(id) - before[id]) > 5), tooSmall: row().filter((id) => width(id) < (id === "canvas" ? layoutCanvasMin : layoutDef[id].min)), touched: layoutTouched };
  // Files then Code are shown from the menu: at the left of the Canvas, Files then Code.
  await menu("Files"); await menu("Code");
  report.filesCode = { row: row(), ordered: left("files") < left("code") && left("code") < left("canvas") };

  const tooSmall = [];
  for (const id of row()) layoutApi.getPanel(id).api.setSize({ width: 10 });
  await wait(100);
  for (const id of row()) { const min = id === "canvas" ? layoutCanvasMin : layoutDef[id].min; if (width(id) < min) tooSmall.push(`${id}:${width(id)}<${min}`); }
  report.minimums = { tooSmall, canvas: width("canvas") };
  await menu("Code"); await menu("Files");

  // A Panel that depends on something (Run) is in the Layout only while it is available, between the Canvas and the Tutor; a hide the person chose stays.
  const runIn = () => inDock().includes("run");
  report.run = { before: runIn() };
  layoutSetRunAvailable(true); await wait(100);
  report.run.available = runIn();
  report.run.order = row();
  layoutSetRunAvailable(false); await wait(100);
  report.run.unavailable = runIn();
  layoutSetRunAvailable(true); await wait(100);
  await menu("Run"); // the person hides it
  report.run.hiddenByPerson = !runIn();
  layoutSetRunAvailable(false); await wait(50); layoutSetRunAvailable(true); await wait(100);
  report.run.staysHidden = !runIn();
  await menu("Run");
  report.run.shownAgain = runIn();

  // A hidden Panel returns where it was: move the Tutor to the left of the Canvas, hide it, show it.
  layoutApi.getPanel("right").api.moveTo({ group: layoutApi.getPanel("canvas").group, position: "left" }); await wait(150);
  const placed = row();
  await menu("Tutor"); report.home = { placed, hidden: !inDock().includes("right") };
  await menu("Tutor"); report.home.back = row(); report.home.sameAsBefore = JSON.stringify(row()) === JSON.stringify(placed);
  layoutSetRunAvailable(false); await wait(100);

  // Tabs: two Panels in one group, through the library's own api; a Panel hidden from a group of tabs comes back as a tab of it.
  layoutApi.getPanel("chat").api.moveTo({ group: layoutApi.getPanel("canvas").group, position: "center" }); await wait(150);
  const tabs = layoutApi.getPanel("canvas").group.panels.map((p) => p.id).sort();
  await menu("Builder"); const gone = !inDock().includes("chat");
  await menu("Builder");
  report.tabs = { tabs, gone, back: layoutApi.getPanel("canvas").group.panels.map((p) => p.id).sort(), tabElements: document.querySelectorAll(".dv-tab").length };

  // The Canvas is never hidden by accident: with every other Panel hidden its row stays checked and disabled, and it stays on screen.
  for (const d of layoutRegistry) if (inDock().includes(d.id)) await menu(d.title);
  await wait(100);
  const canvasRow = menuRow("Canvas");
  report.alone = { inDock: inDock(), checked: canvasRow.getAttribute("aria-checked"), disabled: canvasRow.getAttribute("aria-disabled"), reason: canvasRow.querySelector(".reason")?.textContent ?? "" };
  canvasRow.click(); await wait(80);
  report.alone.afterClick = inDock();
  for (const d of layoutRegistry) if (!d.startsHidden && !d.available) await menu(d.title);
  report.restored = inDock();

  // The page serves the library.
  report.vendor = { found: (await fetch("/vendor/dockview/dockview-core.min.js")).status, missing: (await fetch("/vendor/dockview/nothing.js")).status };
}

async function narrow() {
  report.narrow = { is: layoutNarrow, inDock: inDock(), width: document.documentElement.clientWidth };
  const button = document.getElementById("panels-button");
  button.click(); await wait(50);
  menuRow("Tutor").click(); await wait(100);
  const card = document.getElementById("right");
  const r = card.getBoundingClientRect();
  report.drawer = { open: layoutDrawer, isDrawer: card.classList.contains("is-drawer"), role: card.getAttribute("role"), onScreen: card.getClientRects().length > 0, covers: r.height > 300, scrim: !document.getElementById("scrim").hidden, menuClosed: document.getElementById("panels-menu").hidden, inDock: inDock(), focusInDrawer: document.activeElement === card };
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(80);
  report.escape = { open: layoutDrawer, focusOnOpener: document.activeElement === button, onScreen: card.getClientRects().length > 0, parked: card.parentElement.id };
  button.click(); await wait(50); menuRow("Builder").click(); await wait(100);
  document.querySelector("#chat .drawer-close").click(); await wait(80);
  report.closeButton = { open: layoutDrawer };
  button.click(); await wait(50); menuRow("Builder").click(); await wait(100);
  document.getElementById("scrim").click(); await wait(80);
  report.scrim = { open: layoutDrawer };
  report.canvasRow = { disabled: menuRow("Canvas").getAttribute("aria-disabled") };
}

(async () => {
  try {
    await openProject(window.PANELS_PROJECT); // without a Project the Home screen covers the whole workspace
    for (let i = 0; i < 100 && (!$("home").hidden || !$("opening").hidden); i++) await wait(100);
    await wait(300);
    await (window.DOCK_MODE === "narrow" ? narrow() : wide());
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre"); // built, not written as text, so the page source never contains the marker the test looks for
  out.id = "dock-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
