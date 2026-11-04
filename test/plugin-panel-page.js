// Runs inside the real page (injected by plugin-panel.test.ts) and writes what it saw as JSON into a pre element.
// window.PLUG_MODE: "live" (a plugin adds a Panel, is disabled, enabled, and the Panel is moved) or "reopen" (starts with what "live" saved).
const report = { errors: [], mode: window.PLUG_MODE };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const plugWait = (ms) => new Promise((r) => setTimeout(r, ms));
const plugUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await plugWait(10); } return false; };
const plugId = "fixture.panel.hello";
const plugInDock = () => layoutApi.panels.map((p) => p.id).sort();
const plugRow = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === "Hello plugin");
const plugList = async () => (await (await fetch("/plugins")).json()).plugins;
const plugPost = (what, id) => fetch("/plugins/" + what, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });

async function plugLive() {
  await plugUntil(() => layoutApi.getPanel(plugId));
  report.added = { inDock: plugInDock().includes(plugId), row: !!plugRow(), text: document.getElementById("pane-" + plugId)?.textContent ?? null, checked: plugRow()?.getAttribute("aria-checked") };
  report.menuTitles = [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].map((b) => b.dataset.title);
  await plugUntil(async () => (await plugList()).find((p) => p.id === "fixture.badslot")?.state === "failed");
  const bad = (await plugList()).find((p) => p.id === "fixture.badslot");
  report.badSlot = { state: bad?.state, reason: bad?.reason ?? "", panelOnScreen: plugInDock().some((id) => id.startsWith("fixture.badslot")), row: !![...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === "Never shown") };
  // The person moves the Panel into the tabs of the Builder; the Layout is saved.
  layoutApi.getPanel(plugId).api.moveTo({ group: layoutApi.getPanel("chat").group, position: "center" });
  await plugUntil(() => layoutApi.getPanel(plugId).group === layoutApi.getPanel("chat").group);
  await plugWait(100);
  // Disabling the plugin takes the Panel away at once.
  globalThis.__plugDisposed = false;
  await plugPost("deactivate", "fixture.panel");
  await pluginsSync();
  report.disabled = { inDock: plugInDock().includes(plugId), row: !!plugRow(), disposed: globalThis.__plugDisposed, groups: layoutApi.groups.length, canvas: !!layoutApi.getPanel("canvas"), chat: !!layoutApi.getPanel("chat") };
  await plugPost("activate", "fixture.panel");
  await pluginsSync();
  await plugUntil(() => layoutApi.getPanel(plugId));
  report.enabled = { inDock: plugInDock().includes(plugId), row: !!plugRow() };
  // Leave the plugin enabled and the Panel in the tabs of the Builder: this is what the next load restores.
  layoutApi.getPanel(plugId).api.moveTo({ group: layoutApi.getPanel("chat").group, position: "center" });
  await plugUntil(() => layoutApi.getPanel(plugId).group === layoutApi.getPanel("chat").group);
  await plugWait(200);
}

async function plugReopen() {
  await plugUntil(() => layoutApi.getPanel(plugId));
  report.opened = { inDock: plugInDock().includes(plugId), withChat: !!layoutApi.getPanel(plugId) && layoutApi.getPanel(plugId).group === layoutApi.getPanel("chat").group, groups: layoutApi.groups.length };
}

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await plugUntil(() => $("home").hidden && $("opening").hidden, 10000);
    await plugWait(300);
    await ({ live: plugLive, reopen: plugReopen }[window.PLUG_MODE])();
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "plug-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
