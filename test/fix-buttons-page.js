// Runs inside the real page (injected by fix-buttons-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [], defined: [], chats: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const fbWait = (ms) => new Promise((r) => setTimeout(r, ms));
const fbUntil = async (cond, ms = 10000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await fbWait(20); } return false; };
const fbCall = async (name, body = {}) => (await fetch(`/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, ...body }) })).json();
// Neither the Tutor nor the Builder is under test: what the control SENDS is. Their requests are recorded and answered.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  if (String(url) === "/tutor/define") { report.defined.push(JSON.parse(init.body)); return new Response(JSON.stringify({ definition: "an explanation" }), { status: 200, headers: { "content-type": "application/json" } }); }
  if (String(url) === "/chat") { report.chats.push(JSON.parse(init.body)); return new Response(JSON.stringify({ type: "text", text: "on it" }) + "\n", { status: 200, headers: { "content-type": "application/x-ndjson" } }); }
  return realFetch(url, init);
};
const fbPop = () => document.getElementById("select-pop");
const fbVisible = () => [...fbPop().querySelectorAll("button")].filter((b) => !b.closest("[hidden]") && !b.hidden).map((b) => b.textContent);
const fbButton = (label) => [...fbPop().querySelectorAll("button")].find((b) => b.textContent === label && !b.closest("[hidden]") && !b.hidden);
const fbSelect = async (node, from, to) => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); // closes the control, so waiting for it waits for THIS selection
  document.activeElement?.blur(); // a real mouse press leaves the chat box; the builder's turn gave it the focus back
  const range = document.createRange();
  const t = node.firstChild;
  range.setStart(t, from ?? 0);
  range.setEnd(t, Math.min(to ?? t.length, t.length));
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  await fbUntil(() => !fbPop().hidden);
};
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await fbUntil(() => $("home").hidden && $("opening").hidden);
    await fbCall("accept");
    await fbCall("play");
    document.getElementById("panels-button").click();
    document.querySelector('#panels-menu [data-title="Terminal"]').click();
    document.getElementById("panels-button").click();
    await fbUntil(() => /line 39 /.test(document.querySelector("pre[data-selection-source=terminal]")?.textContent ?? ""), 25000); // slow when the suite runs several tests at once
    await fbWait(1700); // the log is redrawn while lines arrive: select only once it has settled
    const log = document.querySelector("pre[data-selection-source=terminal]");

    // Which buttons where: four in the terminal and in the Code panel, two everywhere else.
    await fbSelect(log, 0, 60);
    report.terminalButtons = fbVisible();
    document.getElementById("panels-button").click(); // the Code panel starts hidden: show it, or a selection in it is empty
    document.querySelector('#panels-menu [data-title="Code"]').click();
    document.getElementById("panels-button").click();
    await fbWait(300);
    const code = Object.assign(document.createElement("div"), { id: "fb-code", textContent: "def total(cart): return cart.sum" });
    document.getElementById("pane-code").append(code);
    await fbSelect(code);
    report.codeButtons = fbVisible();
    const other = Object.assign(document.createElement("div"), { id: "fb-other", textContent: "some other text on the screen" });
    document.body.append(other);
    await fbSelect(other);
    report.otherButtons = fbVisible();

    // Fix: the selection goes to the Builder as a fix (data), not as a message, and not to the Tutor.
    await fbSelect(log, 0, 60);
    const wanted = getSelection().toString().trim();
    fbButton("Fix").click();
    await fbUntil(() => report.chats.length >= 1);
    report.fix = { chats: report.chats.length, defined: report.defined.length, body: report.chats[0], exact: report.chats[0]?.fix?.text === wanted, hasMessage: "message" in (report.chats[0] ?? {}) };
    await fbUntil(() => !document.getElementById("chat-log").querySelector(".you:last-of-type") || /Fix this/.test(document.getElementById("chat-log").textContent));
    report.chatShows = /Fix this \(from the terminal\)/.test(document.getElementById("chat-log").textContent);
    await fbUntil(() => !window.chatUi.isBusy());

    // Explain and fix: both at once.
    await fbSelect(code);
    fbButton("Explain and fix").click();
    await fbUntil(() => report.chats.length >= 2 && report.defined.length >= 1);
    report.both = { chats: report.chats.length, defined: report.defined.length, source: report.chats[1]?.fix?.source ?? null };
    await fbUntil(() => !window.chatUi.isBusy());

    // A secret asks first: nothing reaches the Builder until the person confirms.
    const secret = Object.assign(document.createElement("div"), { id: "fb-secret", textContent: "DB_PASSWORD=hunter2hunter2" });
    document.getElementById("pane-code").append(secret);
    const chatsBefore = report.chats.length;
    await fbSelect(secret);
    fbButton("Fix").click();
    await fbWait(60);
    report.secretAsked = !!fbButton("Send anyway");
    report.secretSentEarly = report.chats.length > chatsBefore;
    fbButton("Send anyway").click();
    await fbUntil(() => report.chats.length > chatsBefore);
    report.secretSentAfter = report.chats.length - chatsBefore;
    await fbCall("stopAll");
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "fb-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
