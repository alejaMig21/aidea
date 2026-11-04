// Runs inside the real page (injected by plugin-manager.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const pmWait = (ms) => new Promise((r) => setTimeout(r, ms));
const pmUntil = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 10) { if (await cond()) return true; await pmWait(10); } return false; };
const pmAll = (sel) => [...document.querySelectorAll(sel)];
const pmVisible = (el) => !!el && el.getClientRects().length > 0 && !el.hidden;
const pmRow = (id) => document.querySelector(`#pm-quarantine [data-q-title="${id}"]`);
const pmPanelRow = (title) => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === title);

(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await pmUntil(() => $("home").hidden && $("opening").hidden, 10000);
    await pmWait(300);
    const button = document.getElementById("plugins-button");
    report.button = { present: !!button, visible: pmVisible(button), outsidePanels: !!button && !button.closest("#panels-control"), panelsControlButtons: document.querySelectorAll("#panels-control > button").length };
    button.click();
    await pmUntil(() => pmVisible(document.getElementById("plugins-manager")));
    report.opened = pmVisible(document.getElementById("plugins-manager"));
    await pmUntil(() => pmAll("#pm-quarantine [data-q-id]").length >= 2);
    report.note = document.getElementById("pm-note")?.textContent ?? "";
    report.quarantine = pmAll("#pm-quarantine [data-q-id]").map((r) => ({ title: r.dataset.qTitle, blocking: r.querySelectorAll('[data-finding][data-severity="block"]').length, boxes: r.querySelectorAll("input[data-confirm]").length, installDisabled: r.querySelector(".pm-install")?.disabled }));
    // The clean plugin installs with one click and its Panel appears at once.
    pmRow("Title of fixture.clean").querySelector(".pm-install").click();
    await pmUntil(() => pmPanelRow("Installed live") && document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]') && !pmRow("Title of fixture.clean"));
    report.clean = { panelRow: !!pmPanelRow("Installed live"), inInstalled: !!document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]'), leftQuarantine: !pmRow("Title of fixture.clean") };
    // The loud plugin cannot be installed until each blocking finding is confirmed.
    const loud = pmRow("Title of fixture.loud");
    const boxes = [...loud.querySelectorAll("input[data-confirm]")];
    report.loudBefore = { boxes: boxes.length, disabled: loud.querySelector(".pm-install").disabled };
    boxes[0].click();
    report.loudPartial = { disabled: loud.querySelector(".pm-install").disabled, ofBoxes: boxes.length };
    for (const box of boxes) if (!box.checked) box.click();
    report.loudAll = { disabled: loud.querySelector(".pm-install").disabled };
    loud.querySelector(".pm-install").click();
    await pmUntil(() => document.querySelector('#pm-installed [data-plugin-id="fixture.loud"]'));
    report.loudInstalled = { state: document.querySelector('#pm-installed [data-plugin-id="fixture.loud"]')?.dataset.state, leftQuarantine: !pmRow("Title of fixture.loud") };
    // Adding a folder from the screen puts it in the quarantine.
    document.getElementById("pm-source").value = window.PM_ADD;
    document.getElementById("pm-add").click();
    await pmUntil(() => pmRow("Title of fixture.added"));
    report.added = !!pmRow("Title of fixture.added");
    document.getElementById("pm-source").value = "--upload-pack=evil";
    document.getElementById("pm-add").click();
    await pmUntil(() => (document.getElementById("pm-message")?.textContent ?? "") !== "");
    report.refused = document.getElementById("pm-message").textContent;
    // Escape closes it, the button opens it again.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await pmWait(100);
    report.closed = !pmVisible(document.getElementById("plugins-manager"));
    button.click();
    await pmWait(100);
    report.reopened = pmVisible(document.getElementById("plugins-manager"));
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "pm-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
