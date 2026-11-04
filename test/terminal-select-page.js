// Runs inside the real page (injected by terminal-select-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [], defined: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const tsWait = (ms) => new Promise((r) => setTimeout(r, ms));
const tsUntil = async (cond, ms = 10000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await tsWait(20); } return false; };
const tsCall = async (name, body = {}) => (await fetch(`/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, ...body }) })).json();
// The Tutor is not under test here: what the control SENDS is. Its request is recorded and answered.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  if (String(url) === "/tutor/define") { report.defined.push(JSON.parse(init.body)); return new Response(JSON.stringify({ definition: "an explanation" }), { status: 200, headers: { "content-type": "application/json" } }); }
  return realFetch(url, init);
};
const tsSelect = (node, from, to) => {
  const range = document.createRange();
  const t = node.firstChild;
  range.setStart(t, from);
  range.setEnd(t, Math.min(to, t.length));
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
};
const tsPop = () => document.getElementById("select-pop");
const tsButtons = () => Object.fromEntries([...tsPop().querySelectorAll("button")].map((b) => [b.textContent, !b.disabled]));
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await tsUntil(() => $("home").hidden && $("opening").hidden);
    await tsCall("accept");
    await tsCall("play");
    document.getElementById("panels-button").click();
    document.querySelector('#panels-menu [data-title="Terminal"]').click();
    document.getElementById("panels-button").click();
    await tsUntil(() => /line 399/.test(document.querySelector("pre[data-selection-source=terminal]")?.textContent ?? ""));
    const log = document.querySelector("pre[data-selection-source=terminal]");
    report.marked = !!log;
    const all = log.textContent.length;
    report.terminalLength = all;

    // A long selection in the terminal: the control stays usable, says it cut the start, and sends the END.
    tsSelect(log, 0, all);
    await tsUntil(() => !tsPop().hidden);
    report.longButtons = tsButtons();
    report.longHint = tsPop().querySelector(".hint").hidden ? "" : tsPop().querySelector(".hint").textContent;
    [...tsPop().querySelectorAll("button")].find((b) => b.textContent === "Explain").click();
    await tsUntil(() => report.defined.length >= 1);
    report.longSent = { source: report.defined[0].source, length: report.defined[0].text.length, endsLikeTheOutput: log.textContent.trim().endsWith(report.defined[0].text.trim().slice(-40)) };

    // A short selection in the terminal: sent whole, with no cut notice.
    tsSelect(log, 0, 40);
    await tsUntil(() => tsPop().querySelector(".hint").hidden);
    report.shortHint = tsPop().querySelector(".hint").hidden;
    [...tsPop().querySelectorAll("button")].find((b) => b.textContent === "Explain").click();
    await tsUntil(() => report.defined.length >= 2);
    report.shortSent = { source: report.defined[1].source, length: report.defined[1].text.length };

    // Elsewhere the limit stays at 2000: the control refuses, and no request is made.
    const other = Object.assign(document.createElement("div"), { id: "ts-other", textContent: "z".repeat(3000) });
    document.body.append(other);
    tsSelect(other, 0, 3000);
    await tsUntil(() => /Select less text/.test(tsPop().querySelector(".hint").textContent));
    report.elsewhere = { buttons: tsButtons(), hint: tsPop().querySelector(".hint").textContent };
    report.requestsAfterElsewhere = report.defined.length;
    await tsCall("stopAll");
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "ts-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
