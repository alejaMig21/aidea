// Runs inside the real page (injected by plugin-lessons-page.test.ts): the quick tour of "How aidea works" carries the lessons of the enabled plugins.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const plWait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    await plWait(800);
    $("guide-open").click(); // no Project is open, so the quick tour opens at once
    await plWait(800);
    const tour = $("layer-tour");
    report.opened = !tour.hidden;
    const titles = [];
    for (let i = 0; i < 40 && !tour.hidden; i++) {
      titles.push(tour.querySelector("#layer-tour > :first-child")?.textContent ?? tour.textContent.slice(0, 80));
      const buttons = [...tour.querySelectorAll("button")];
      const next = buttons.find((b) => b.textContent === "Next" || b.textContent === "Finish");
      if (!next || next.textContent === "Finish") break;
      next.click();
      await plWait(60);
    }
    report.titles = titles;
    report.last = tour.textContent.slice(0, 400);
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "pl-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
