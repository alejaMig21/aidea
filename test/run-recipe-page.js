// Runs inside the real page (injected by run-recipe-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const rrWait = (ms) => new Promise((r) => setTimeout(r, ms));
const rrUntil = async (cond, ms = 8000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await rrWait(20); } return false; };
const rrPlay = () => document.querySelector('[data-topbar-plugin="run.play"]');
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await rrUntil(() => $("home").hidden && $("opening").hidden, 10000);
    await rrUntil(() => rrPlay());
    report.askHiddenAtStart = rrPlay().querySelector("[data-ask-recipe]").hidden;
    rrPlay().querySelector("button").click(); // Play: the project has no recipe
    await rrUntil(() => /no run recipe/i.test(rrPlay().querySelector("[role=status]").textContent));
    report.askShown = !rrPlay().querySelector("[data-ask-recipe]").hidden;
    rrPlay().querySelector("[data-ask-recipe]").click();
    await rrUntil(() => document.querySelector("#chat-log [data-run-recipe]"));
    const card = () => document.querySelector("#chat-log [data-run-recipe]");
    report.askHiddenAfter = rrPlay().querySelector("[data-ask-recipe]").hidden;
    report.card = card()?.textContent ?? null;
    report.buttons = [...(card()?.querySelectorAll("button") ?? [])].map((b) => b.textContent);
    [...card().querySelectorAll("button")].find((b) => b.textContent === "Accept").click();
    await rrUntil(() => /Written to/.test(card().textContent));
    report.afterAccept = card().querySelector("[role=status]").textContent;
    report.buttonsDisabled = [...card().querySelectorAll("button")].every((b) => b.disabled);
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "rr-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
