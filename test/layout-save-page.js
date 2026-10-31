// Runs inside the real page (injected by layout-save.test.ts) and writes what it saw as JSON into a pre element.
// window.SAVE_MODE: "arrange" (the person arranges the Layout), "reopen" (the page starts with what "arrange" saved, then is fed bad data) or "legacy" (an old save).
const report = { errors: [], mode: window.SAVE_MODE };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (cond, ms = 3000) => { for (let t = 0; t < ms; t += 10) { if (cond()) return true; await wait(10); } return false; };
let applied = 0;
document.addEventListener("layout-applied", () => applied++);
const change = async (action) => { const n = applied; action(); await until(() => applied > n); await wait(0); };
const box = (id) => layoutApi.getPanel(id).group.element.getBoundingClientRect();
const inDock = () => layoutApi.panels.map((p) => p.id).sort();
const widths = () => Object.fromEntries(inDock().map((id) => [id, Math.round(box(id).width)]));
const groups = () => layoutApi.groups.map((g) => g.panels.map((p) => p.id).sort().join("+")).sort();
const menuRow = (title) => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === title);
const menu = async (title) => { document.getElementById("panels-button").click(); await change(() => menuRow(title).click()); document.getElementById("panels-button").click(); };
const stored = () => localStorage.getItem("aidea.layout");

async function arrange() {
  await menu("Files");
  await menu("Code");
  layoutApi.getPanel("files").api.moveTo({ group: layoutApi.getPanel("chat").group, position: "center" }); // Files is a tab of the Builder
  await until(() => layoutApi.getPanel("files").group === layoutApi.getPanel("chat").group);
  // Run coming and going makes the library share the room again, so the person's width is set after each.
  const size = async () => { layoutApi.getPanel("chat").api.setSize({ width: 333 }); await wait(300); };
  await change(() => layoutSetRunAvailable(true)); // Run is in the Layout that gets saved ...
  await size();
  const withRun = stored();
  await change(() => layoutSetRunAvailable(false)); // ... and the window is described without it
  await size();
  const base = { groups: groups(), inDock: inDock(), widths: widths() };
  report.arranged = { ...base, stored: stored(), withRun, twice: JSON.stringify(layoutApi.toJSON()) === JSON.stringify(layoutApi.toJSON()) };
}

async function reopen() {
  report.opened = { groups: groups(), inDock: inDock(), widths: widths() };
  // Run was in the saved Layout, but there is no Flow open: it is not in the window until it is available.
  report.run = { atStart: inDock().includes("run") };
  await change(() => layoutSetRunAvailable(true));
  report.run.whenAvailable = inDock().includes("run");
  await change(() => layoutSetRunAvailable(false));
  // Bad data is fed to the restore, which must drop only what is unknown or fall back to the default arrangement (never an empty window).
  const dock = JSON.parse(window.SAVE_STORED).dock;
  const ghost = JSON.parse(JSON.stringify(dock));
  const firstLeaf = (n) => (n.type === "leaf" ? n : n.data.map(firstLeaf).find(Boolean));
  firstLeaf(ghost.grid.root).data.views.push("ghost");
  ghost.panels.ghost = { id: "ghost", contentComponent: "ghost", title: "ghost" };
  const unrestorable = JSON.parse(JSON.stringify(dock));
  delete unrestorable.panels.canvas; // a leaf names a Panel the description does not define: the library throws
  // Saved while Run was in the window, restored without it: the other Panels keep their relations.
  layoutRestore(JSON.parse(window.SAVE_WITH_RUN).dock);
  await wait(100);
  report.withRun = { inDock: inDock(), widths: widths(), saved: Object.fromEntries(JSON.parse(window.SAVE_WITH_RUN).dock.grid.root.data.map((n) => [n.data.views[0], n.size])) };
  const cases = { unknownId: ghost, notData: "not data", empty: {}, nullDock: null, wrongShape: { grid: 5, panels: [] }, unrestorable };
  report.cases = {};
  for (const [name, value] of Object.entries(cases)) {
    layoutRestore(value);
    await wait(100);
    report.cases[name] = { inDock: inDock(), groups: groups(), canvasShown: layoutMain.getClientRects().length > 0 };
  }
}

async function legacy() {
  report.legacy = { inDock: inDock(), chatWidth: Math.round(box("chat").width) };
}

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await until(() => $("home").hidden && $("opening").hidden, 10000);
    await wait(300);
    await ({ arrange, reopen, legacy }[window.SAVE_MODE])();
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "save-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
