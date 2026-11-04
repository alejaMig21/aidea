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
    // The look of an extensions list: a search box, sections with a count, and for each plugin an icon, its name, a line of description and who made it.
    const cleanItem = pmRow("Title of fixture.clean");
    report.list = {
      search: document.getElementById("pm-search")?.type === "search" && !!document.getElementById("pm-search").placeholder,
      sections: pmAll("button[data-section]").map((s) => [s.dataset.section, s.querySelector(".pm-count")?.textContent ?? "", s.getAttribute("aria-expanded")]),
      quarantineItem: { icon: cleanItem.querySelector(".pm-icon")?.textContent, desc: cleanItem.querySelector(".pm-desc")?.textContent, publisher: cleanItem.querySelector(".pm-publisher")?.textContent, badge: cleanItem.querySelector(".pm-badge")?.textContent },
    };
    report.quarantine = pmAll("#pm-quarantine [data-q-id]").map((r) => ({ title: r.dataset.qTitle, blocking: r.querySelectorAll('[data-finding][data-severity="block"]').length, boxes: r.querySelectorAll("input[data-confirm]").length, installDisabled: r.querySelector(".pm-install")?.disabled }));
    // The clean plugin installs with one click and its Panel appears at once.
    pmRow("Title of fixture.clean").querySelector(".pm-install").click();
    await pmUntil(() => pmPanelRow("Installed live") && document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]') && !pmRow("Title of fixture.clean"));
    report.clean = { panelRow: !!pmPanelRow("Installed live"), inInstalled: !!document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]'), leftQuarantine: !pmRow("Title of fixture.clean") };
    const item = document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]');
    report.item = { icon: item.querySelector(".pm-icon")?.textContent, title: item.querySelector(".pm-title")?.textContent, desc: item.querySelector(".pm-desc")?.textContent, publisher: item.querySelector(".pm-publisher")?.textContent, version: item.querySelector(".pm-version")?.textContent, badges: [...item.querySelectorAll(".pm-badge")].map((b) => b.textContent) };
    report.countsAfterInstall = pmAll("button[data-section]").map((s) => [s.dataset.section, s.querySelector(".pm-count")?.textContent ?? ""]);
    // "Ask the Tutor" opens a class about the plugin (the id only), and closes the manager so the Tutor can be seen.
    window.tutorUi = { isRunning: () => false, startClass: (o) => { report.askTutor = { payload: o.payload, managerClosed: !pmVisible(document.getElementById("plugins-manager")) }; } };
    const loudRow = pmRow("Title of fixture.loud");
    report.askButton = !!loudRow.querySelector(".pm-ask-tutor");
    const loudId = loudRow.dataset.qId;
    loudRow.querySelector(".pm-ask-tutor").click();
    report.askTutor.expected = loudId;
    document.getElementById("plugins-button").click(); // the manager closed itself: open it again for the steps that follow
    await pmUntil(() => pmVisible(document.getElementById("plugins-manager")));
    await pmUntil(() => pmRow("Title of fixture.loud"));
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
    // Search narrows both lists as the person types, and says so when nothing matches.
    const search = document.getElementById("pm-search");
    const shown = () => pmAll("#pm-installed .pm-row, #pm-quarantine .pm-row").filter((r) => !r.hidden).map((r) => r.dataset.pluginId ?? r.dataset.qTitle);
    const type = (value) => { search.value = value; search.dispatchEvent(new Event("input", { bubbles: true })); };
    report.searchAll = shown().length;
    type("fixture.clean");
    report.searchOne = shown();
    type("TESTS"); // the publisher, in any case
    report.searchPublisher = shown().length;
    type("zzz-nothing");
    report.searchNone = { shown: shown().length, emptyText: pmVisible(document.getElementById("pm-empty")) ? document.getElementById("pm-empty").textContent : "" };
    type("");
    report.searchCleared = { shown: shown().length, emptyHidden: !pmVisible(document.getElementById("pm-empty")) };
    // A section folds away and back.
    const head = document.querySelector('button[data-section="installed"]');
    head.click();
    report.fold = { hidden: !pmVisible(document.getElementById("pm-installed")), expanded: head.getAttribute("aria-expanded") };
    head.click();
    report.unfold = { shown: pmVisible(document.getElementById("pm-installed")), expanded: head.getAttribute("aria-expanded") };
    // The settings form: drawn from the schema, valid values saved, a bad one named and nothing saved.
    const clean = () => document.querySelector('#pm-installed [data-plugin-id="fixture.clean"]');
    await pmWait(600); // a refresh started by the step before would replace the rows and wipe the form
    clean().querySelector(".pm-settings-button").click();
    await pmUntil(() => clean().querySelector("form.pm-settings"));
    const form = () => clean().querySelector("form.pm-settings");
    const field = (name) => form().elements[name];
    report.settings = { fields: [...form().elements].filter((e) => e.name).map((e) => `${e.name}:${e.tagName}`), mood: field("mood").value, count: field("count").value, tokenType: field("token").type, tokenPlaceholder: field("token").placeholder };
    field("mood").value = "lively";
    field("count").value = "7";
    field("token").value = "page-secret-value";
    form().querySelector(".pm-save").click();
    await pmUntil(() => /are saved/.test(document.getElementById("pm-message").textContent));
    report.settings.savedMessage = document.getElementById("pm-message").textContent;
    const stored = (await pmJson("GET", "/plugins/fixture.clean/settings")).body.values;
    report.settings.afterSave = { mood: stored.mood, count: stored.count, tokenPlaceholder: field("token").placeholder, secretInPage: clean().innerHTML.includes("page-secret-value") || field("token").value !== "" };
    field("mood").append(new Option("green", "green"));
    field("mood").value = "green";
    form().querySelector(".pm-save").click();
    await pmUntil(() => /Nothing was saved/.test(document.getElementById("pm-message").textContent));
    report.settings.badMessage = document.getElementById("pm-message").textContent;
    report.settings.badError = form().querySelector('[data-error="mood"]').textContent;
    report.settings.afterBad = (await pmJson("GET", "/plugins/fixture.clean/settings")).body.values.mood;
    // Switching a plugin off and on again from its row takes its Panel away and brings it back at once.
    clean().querySelector(".pm-disable").click();
    await pmUntil(() => clean()?.dataset.state === "inactive" && !pmPanelRow("Installed live"));
    report.off = { state: clean()?.dataset.state, panelGone: !pmPanelRow("Installed live") };
    clean().querySelector(".pm-enable").click();
    await pmUntil(() => clean()?.dataset.state === "active" && pmPanelRow("Installed live"));
    report.on = { state: clean()?.dataset.state, panelBack: !!pmPanelRow("Installed live") };
    // Removing code that already ran asks for a restart, with the button.
    clean().querySelector(".pm-remove").click();
    await pmUntil(() => !clean() && document.querySelector("#pm-message .pm-restart"));
    report.removed = { gone: !clean(), panelGone: !pmPanelRow("Installed live"), restartButton: !!document.querySelector("#pm-message .pm-restart"), message: document.getElementById("pm-message").textContent };
    // Escape closes it, the button opens it again.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await pmWait(100);
    report.closed = !pmVisible(document.getElementById("plugins-manager"));
    button.click();
    await pmWait(100);
    report.reopened = pmVisible(document.getElementById("plugins-manager"));
    // The Builder proposes a plugin: the manager opens on it even when it was closed.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await pmWait(100);
    pmProposed({ id: "x", title: "Made by the Builder" });
    await pmWait(100);
    report.proposed = { visible: pmVisible(document.getElementById("plugins-manager")), message: document.getElementById("pm-message").textContent };
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre");
  out.id = "pm-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
