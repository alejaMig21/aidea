// Runs inside the real page (injected by secret-warning-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [], sent: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const swWait = (ms) => new Promise((r) => setTimeout(r, ms));
const swUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await swWait(10); } return false; };
// The Tutor is not under test: what the control SENDS is. Its request is recorded and answered.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  if (String(url) === "/tutor/define") { report.sent.push(JSON.parse(init.body).text); return new Response(JSON.stringify({ definition: "an explanation" }), { status: 200, headers: { "content-type": "application/json" } }); }
  return realFetch(url, init);
};
const swPop = () => document.getElementById("select-pop");
const swButton = (label) => [...swPop().querySelectorAll("button")].find((b) => b.textContent === label && !b.closest("[hidden]"));
const swSelect = (text) => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); // closes the control, so waiting for it to appear waits for THIS selection
  const box = document.getElementById("sw-box");
  box.textContent = text;
  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  box.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
};
const swWarn = () => swPop().querySelector(".warn");
const swWarnShown = () => !!swWarn() && !swWarn().hidden;

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await swUntil(() => $("home").hidden && $("opening").hidden);
    document.body.append(Object.assign(document.createElement("div"), { id: "sw-box" }));
    const secrets = window.SW_SECRETS, ordinary = window.SW_ORDINARY;

    // Ordinary text: Explain sends it at once, with no question.
    report.ordinary = [];
    for (const text of ordinary) {
      const before = report.sent.length;
      swSelect(text);
      await swUntil(() => !swPop().hidden);
      swButton("Explain").click();
      await swUntil(() => report.sent.length > before, 600);
      report.ordinary.push({ text: text.slice(0, 50), warned: swWarnShown(), sent: report.sent.length > before });
    }

    // A secret: Explain asks first; Cancel sends nothing.
    report.secrets = [];
    for (const text of secrets) {
      const before = report.sent.length;
      swSelect(text);
      await swUntil(() => !swPop().hidden);
      swButton("Explain").click();
      await swWait(30);
      const warned = swWarnShown();
      const wording = warned ? swWarn().textContent : "";
      if (warned) swButton("Cancel").click();
      await swWait(30);
      report.secrets.push({ text: text.slice(0, 40), warned, wording, sentBeforeAnswer: report.sent.length > before, warnGoneAfterCancel: !swWarnShown() });
    }

    // Confirming sends the text exactly as selected.
    const secret = secrets[0];
    swSelect(secret);
    await swUntil(() => !swPop().hidden);
    const before = report.sent.length;
    swButton("Explain").click();
    await swWait(30);
    swButton("Send anyway").click();
    await swUntil(() => report.sent.length > before);
    report.confirmed = { count: report.sent.length - before, exact: report.sent[report.sent.length - 1] === getSelection().toString().trim() };

    // "Enter the Tutor" asks too, and cancelling starts no class.
    window.tutorUi = { isRunning: () => false, startClass: (o) => { report.classStarted = (report.classStarted ?? 0) + 1; report.classText = o.payload.selection; } };
    swSelect(secret);
    await swUntil(() => !swPop().hidden);
    swButton("Enter the Tutor").click();
    await swWait(30);
    report.enterWarned = swWarnShown();
    swButton("Cancel").click();
    await swWait(30);
    report.classAfterCancel = report.classStarted ?? 0;
    swSelect(secret);
    await swUntil(() => !swPop().hidden);
    swButton("Enter the Tutor").click();
    await swWait(30);
    swButton("Send anyway").click();
    await swWait(30);
    report.classAfterConfirm = report.classStarted ?? 0;
    report.classTextExact = report.classText === secret.trim();
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "sw-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
