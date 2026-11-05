// Runs inside the real page (injected by language-offer-page.test.ts): a Project in a language no plugin reads says so, names it, and offers a lesson; the offer sends nothing.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const loWait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    await loWait(1200);
    window.tutorUi.startClass = (opts) => { report.started = opts; return Promise.resolve(false); };
    await openProject(__PROJECT__);
    await loWait(1500);
    const none = document.getElementById("no-code");
    report.hidden = none.hidden;
    report.text = none.textContent;
    report.languages = document.getElementById("languages").textContent;
    const button = document.getElementById("no-reader-offer");
    report.button = button?.textContent;
    button?.click();
    report.rectWidth = Math.round(none.getBoundingClientRect().width);
    const chat = document.getElementById("chat-input");
    report.chat = chat.value;
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "lo-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
