// Runs inside the real page (injected by terminal-panel.test.ts) and writes what it saw as JSON into a pre element.
// window.TERM_MODE: "show" (show the Terminal, move it, hide it, show it), "reopen" (starts with what "show" saved), "strip" (show it and leave it),
// "stripReopen" (starts with what "strip" saved) or "before" (a Layout saved before the Terminal existed).
const report = { errors: [], mode: window.TERM_MODE };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (cond, ms = 3000) => { for (let t = 0; t < ms; t += 10) { if (cond()) return true; await wait(10); } return false; };
let applied = 0;
document.addEventListener("layout-applied", () => applied++);
const change = async (action) => { const n = applied; action(); await until(() => applied > n); await wait(0); };
const box = (id) => layoutApi.getPanel(id).group.element.getBoundingClientRect();
const inDock = () => layoutApi.panels.map((p) => p.id).sort();
const groups = () => layoutApi.groups.map((g) => g.panels.map((p) => p.id).sort().join("+")).sort();
const menuRow = (title) => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === title);
const menu = async (title) => { document.getElementById("panels-button").click(); await change(() => menuRow(title).click()); document.getElementById("panels-button").click(); };
const stored = () => localStorage.getItem("aidea.layout");
const withChat = () => layoutApi.getPanel("terminal").group === layoutApi.getPanel("chat").group;

// Where the Terminal stands: alone in its group, as wide as the whole Layout, and below every other group.
function geometry() {
  const t = box("terminal"), d = layoutDock.getBoundingClientRect();
  const others = layoutApi.groups.filter((g) => !g.panels.some((p) => p.id === "terminal"));
  return {
    inDock: inDock().includes("terminal"),
    alone: layoutApi.getPanel("terminal").group.panels.length === 1,
    fullWidth: t.width >= d.width - 2 * layoutGap - 4,
    below: others.every((g) => g.element.getBoundingClientRect().bottom <= t.top + 4),
    canvas: Math.round(box("canvas").height),
    ids: inDock(),
    text: (document.getElementById("terminal")?.textContent ?? "").trim().length,
  };
}

async function termShow() {
  const row = menuRow("Terminal");
  report.menu = { present: !!row, checked: row ? row.getAttribute("aria-checked") : null };
  report.start = { ids: inDock(), canvas: Math.round(box("canvas").height) };
  await menu("Terminal");
  report.shown = geometry();
  layoutApi.getPanel("terminal").api.moveTo({ group: layoutApi.getPanel("chat").group, position: "center" }); // a tab of the Builder
  await until(withChat);
  report.moved = { withChat: withChat(), groups: groups() };
  await menu("Terminal"); // hidden
  report.hidden = { ids: inDock(), canvas: Math.round(box("canvas").height), folded: JSON.parse(stored() ?? "{}").terminalFolded };
  await menu("Terminal"); // shown again: back where it was left
  report.back = { withChat: withChat(), groups: groups() };
  report.saved = stored();
}

async function termReopen() {
  report.opened = { inDock: inDock().includes("terminal"), withChat: inDock().includes("terminal") && withChat(), groups: groups() };
}

async function termStrip() {
  await menu("Terminal");
  report.strip = geometry();
}

async function termStripReopen() {
  report.opened = geometry();
}

async function termBefore() {
  const row = menuRow("Terminal");
  report.before = { present: !!row, checked: row ? row.getAttribute("aria-checked") : null, inDock: inDock().includes("terminal") };
}

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await until(() => $("home").hidden && $("opening").hidden, 10000);
    await wait(300);
    await ({ show: termShow, reopen: termReopen, strip: termStrip, stripReopen: termStripReopen, before: termBefore }[window.TERM_MODE])();
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "term-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
