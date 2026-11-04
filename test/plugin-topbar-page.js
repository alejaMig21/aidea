// Runs inside the real page (injected by plugin-topbar.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const tbWait = (ms) => new Promise((r) => setTimeout(r, ms));
const tbUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await tbWait(10); } return false; };
const tbBox = () => document.querySelector('[data-topbar-plugin="fixture.bar.go"]');
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await tbUntil(() => $("home").hidden && $("opening").hidden, 10000);
    await tbWait(300);
    await tbUntil(() => tbBox());
    const header = document.querySelector("header");
    report.placed = { present: !!tbBox(), inHeader: !!tbBox() && header.contains(tbBox()), beforePluginsButton: !!tbBox() && !!(tbBox().compareDocumentPosition(document.getElementById("plugins-button")) & Node.DOCUMENT_POSITION_FOLLOWING) };
    tbBox().querySelector("button").click();
    await tbUntil(() => tbBox().querySelector("output")?.textContent);
    report.called = tbBox().querySelector("output").textContent;
    tbBox().querySelector("button").dataset.fail = "1";
    tbBox().querySelector("button").click();
    await tbUntil(() => /it broke/.test(tbBox().querySelector("output").textContent));
    report.failed = tbBox().querySelector("output").textContent;
    await fetch("/plugins/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "fixture.bar" }) });
    await pluginsSync();
    report.gone = !tbBox();
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "tb-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
