// Runs inside the emergency screen (injected by plugins-safe-mode.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const emWait = (ms) => new Promise((r) => setTimeout(r, ms));
const emUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await emWait(10); } return false; };
const emRows = () => [...document.querySelectorAll("#plugins [data-plugin-id]")].map((r) => ({ id: r.dataset.pluginId, state: r.dataset.state, text: r.textContent }));

(async () => {
  try {
    await emUntil(() => emRows().length >= 3);
    report.rows = emRows();
    document.querySelector('#plugins [data-plugin-id="fixture.third"] button')?.click();
    await emUntil(() => emRows().find((r) => r.id === "fixture.third")?.state === "inactive");
    report.afterOff = emRows().find((r) => r.id === "fixture.third");
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "em-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
