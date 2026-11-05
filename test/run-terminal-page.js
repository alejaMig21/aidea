// Runs inside the real page (injected by run-terminal-page.test.ts): Play's failure message offers to open the Terminal, and the Terminal's Stop and Restart buttons work on their own part.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const rtWait = (ms) => new Promise((r) => setTimeout(r, ms));
const rtUntil = async (cond, ms = 12000) => { for (let t = 0; t < ms; t += 50) { if (await cond()) return true; await rtWait(50); } return false; };
const rtButton = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text || b.textContent.startsWith(text));
const rtCall = (project, name, body = {}) => fetch("/plugins/run/call/" + name, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, ...body }) }).then((r) => r.json());
(async () => {
  try {
    await rtWait(1200);
    // 1. A recipe whose part exits before it is ready: Play says so, offers to open the Terminal, and does.
    await openProject(__FAIL__);
    await rtWait(1200);
    await rtCall(current, "accept");
    const topbar = document.getElementById("topbar");
    rtButton(topbar, "Play").click();
    await rtUntil(() => /broken/.test(topbar.innerText));
    report.failMessage = topbar.innerText.replace(/\s+/g, " ").slice(0, 300);
    const open = rtButton(topbar, "Open the Terminal");
    report.openOffered = !!open && !open.hidden;
    report.terminalBefore = !!layoutShown.terminal;
    open?.click();
    await rtUntil(() => layoutShown.terminal === true, 3000);
    report.terminalAfter = !!layoutShown.terminal;
    report.openHiddenAfter = !open || open.hidden;
    // 2. A recipe with one program that keeps running: the tab's Stop ends it, its Restart starts it again.
    await openProject(__WAIT__);
    await rtWait(1200);
    await rtCall(current, "accept");
    rtButton(topbar, "Play").click();
    const pane = document.getElementById("pane-terminal");
    const tab = () => pane.querySelector("[role=tab][data-part=waiter]");
    report.runningTab = await rtUntil(() => /running/.test(tab()?.textContent ?? ""));
    rtButton(pane, "Stop")?.click();
    report.stoppedTab = await rtUntil(() => /stopped/.test(tab()?.textContent ?? ""));
    rtButton(pane, "Restart")?.click();
    report.restartedTab = await rtUntil(() => /running/.test(tab()?.textContent ?? ""));
    await rtCall(current, "stopAll");
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "rt-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
