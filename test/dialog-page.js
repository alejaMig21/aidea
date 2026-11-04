// Runs inside the real page (injected by dialog-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [], nativeConfirms: 0 };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
window.confirm = () => { report.nativeConfirms++; return false; }; // the native dialog must never be used
const dgWait = (ms) => new Promise((r) => setTimeout(r, ms));
const dgUntil = async (cond, ms = 10000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await dgWait(20); } return false; };
const dgPlay = () => document.querySelector('[data-topbar-plugin="run.play"]');
const dgDialog = () => document.querySelector('[role="dialog"][data-dialog]');
const dgButton = (label) => [...(dgDialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);
const dgStatus = () => dgPlay().querySelector("[role=status]").textContent;
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await dgUntil(() => $("home").hidden && $("opening").hidden);
    await dgUntil(() => dgPlay());

    // Play on a recipe nobody accepted: an in-page dialog lists every command, and the focus starts on the safe button.
    dgPlay().querySelector("button").click();
    await dgUntil(() => dgDialog());
    const d = dgDialog();
    report.dialog = {
      modal: d.getAttribute("aria-modal"),
      labelled: !!document.getElementById(d.getAttribute("aria-labelledby") ?? "x"),
      title: d.querySelector("h2")?.textContent,
      commands: [...d.querySelectorAll("[data-line]")].map((l) => l.textContent),
      buttons: [...d.querySelectorAll("button")].map((b) => b.textContent),
      focused: document.activeElement?.textContent,
      zAbovePluginManager: Number(getComputedStyle(d.parentElement).zIndex) > Number(getComputedStyle(document.getElementById("plugins-manager")).zIndex),
      font: getComputedStyle(d.querySelector("[data-line]")).fontFamily.includes("mono") || /monospace|Consolas|Menlo/i.test(getComputedStyle(d.querySelector("[data-line]")).fontFamily),
    };
    // Tab stays inside the dialog.
    const first = [...d.querySelectorAll("button")][0], last = [...d.querySelectorAll("button")].at(-1);
    last.focus();
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    report.tabWraps = document.activeElement === first;

    // Escape means no: nothing starts and Play says so.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await dgUntil(() => !dgDialog());
    await dgUntil(() => /not accepted/i.test(dgStatus()));
    report.escape = { closed: !dgDialog(), status: dgStatus(), started: !!window.__started };

    // Cancel: the same.
    dgPlay().querySelector("button").click();
    await dgUntil(() => dgDialog());
    dgButton("Cancel").click();
    await dgUntil(() => !dgDialog());
    report.cancel = { closed: !dgDialog(), status: dgStatus() };
    report.afterCancelNothingRuns = !(await (await fetch(`/plugins/run/call/output`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current }) })).json()).parts.length;

    // Accept: the recipe is accepted and Play starts it.
    dgPlay().querySelector("button").click();
    await dgUntil(() => dgDialog());
    dgButton("Accept and start").click();
    await dgUntil(() => !dgDialog());
    await dgUntil(() => !dgPlay().querySelector("button:nth-child(2)").hidden); // Stop all appears when a part is alive
    report.accept = { closed: !dgDialog(), running: !dgPlay().querySelector("button:nth-child(2)").hidden };
    // A change to the recipe asks again and shows only what changed.
    await fetch("/plugins/run/call/stopAll", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    report.nativeConfirmsAtEnd = report.nativeConfirms;
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "dg-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
