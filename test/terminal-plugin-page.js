// Runs inside the real page (injected by terminal-plugin.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const tpWait = (ms) => new Promise((r) => setTimeout(r, ms));
const tpUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await tpWait(10); } return false; };
const tpInDock = () => layoutApi.panels.map((p) => p.id).sort();
const tpRow = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === "Terminal");
const tpPost = (what, id) => fetch("/plugins/" + what, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await tpUntil(() => $("home").hidden && $("opening").hidden, 10000);
    await tpWait(300);
    await tpUntil(() => tpRow());
    report.menu = { row: !!tpRow(), checked: tpRow()?.getAttribute("aria-checked") };
    document.getElementById("panels-button").click();
    tpRow().click();
    document.getElementById("panels-button").click();
    await tpUntil(() => layoutApi.getPanel("terminal"));
    const saved = JSON.parse(JSON.stringify(layoutApi.toJSON()));
    report.shown = { inDock: tpInDock().includes("terminal") };
    await tpPost("deactivate", "terminal");
    await pluginsSync();
    report.disabled = { inDock: tpInDock().includes("terminal"), row: !!tpRow(), core: ["canvas", "chat", "right"].every((id) => !!layoutApi.getPanel(id)) };
    // A Layout saved while the Terminal was in it still restores when the Terminal is gone.
    layoutRestore(saved);
    await tpWait(200);
    report.restored = { inDock: tpInDock(), canvasShown: layoutMain.getClientRects().length > 0 };
    await tpPost("activate", "terminal");
    await pluginsSync();
    await tpWait(200);
    report.back = { row: !!tpRow() };
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "tp-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
