// Runs inside the real page (injected by panel-registry.test.ts after every feature script) and writes what it saw as JSON into a pre element.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (target, k) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const entries = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].map((b) => ({ title: b.dataset.title, checked: b.getAttribute("aria-checked"), disabled: b.disabled, reason: b.querySelector(".reason")?.textContent ?? "", markVisible: getComputedStyle(b.querySelector(".check")).visibility !== "hidden" }));
const cards = () => [...document.querySelectorAll(".panel-card, main")].map((e) => e.id || e.tagName.toLowerCase());
const shown = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none"; };

(async () => {
  try {
    await openProject(window.PANELS_PROJECT); // without a Project the Home screen covers the whole workspace
    for (let i = 0; i < 100 && (!$("home").hidden || !$("opening").hidden); i++) await wait(100);
    await wait(300);
    report.width = document.documentElement.clientWidth;
    report.cards = cards();
    report.headerControls = document.querySelectorAll("#fold-buttons > button").length; // the menu's own rows are not header controls
    report.perPanelButtons = document.querySelectorAll("[id^='fold-']:not(#fold-buttons)").length;
    report.menuClosedAtStart = document.getElementById("panels-menu").hidden;
    report.entries = entries();
    // what the saved layout of an older version (plus an id nobody knows) did
    report.saved = { chatShown: shown("chat"), filesShown: shown("files"), chatWeight: layoutState.chat, ghostIgnored: !("ghost" in layoutState) };

    // keyboard: open, move, toggle, escape
    const button = document.getElementById("panels-button");
    button.click();
    await wait(50);
    report.menuOpen = { hidden: document.getElementById("panels-menu").hidden, expanded: button.getAttribute("aria-expanded"), focusIsItem: document.activeElement?.getAttribute("role") === "menuitemcheckbox" };
    const first = document.activeElement?.dataset.title;
    key(document.activeElement, "ArrowDown");
    report.menuOpen.moved = document.activeElement?.dataset.title !== first;
    const files = [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === "Files");
    const wasShown = shown("files");
    files.focus();
    key(files, " ");
    await wait(50);
    report.toggle = { was: wasShown, now: shown("files"), stillOpen: !document.getElementById("panels-menu").hidden, checked: files.getAttribute("aria-checked") };
    key(document.activeElement, "Escape");
    await wait(50);
    report.escape = { hidden: document.getElementById("panels-menu").hidden, focusOnButton: document.activeElement === button };

    // the stored layout keeps the old key names
    report.stored = Object.keys(JSON.parse(localStorage.getItem("aidea.layout") || "{}")).sort();

    // a seventh Panel: one declaration
    const before = { entries: entries().length, header: document.querySelectorAll("#fold-buttons > button").length };
    layoutRegister({ id: "notes", title: "Notes", side: "right", min: 260, weight: 300, startsHidden: true, pane: "pane-notes", icon: '<path d="M5 6h6M5 9h6"/>' });
    await wait(100);
    const notes = entries().find((e) => e.title === "Notes");
    report.seventh = { entriesBefore: before.entries, entriesAfter: entries().length, hasCard: !!document.getElementById("notes"), hasPane: !!document.getElementById("pane-notes"), hasSeparator: !!document.getElementById("sep-notes"), entry: notes, headerBefore: before.header, headerAfter: document.querySelectorAll("#fold-buttons > button").length, hiddenAtStart: !shown("notes") };
    document.getElementById("panels-button").click();
    await wait(50);
    [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")].find((b) => b.dataset.title === "Notes").click();
    await wait(100);
    report.seventh.shownAfterMenu = shown("notes");
    report.finalCards = cards();
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre"); // built, not written as text, so the page source never contains the marker the test looks for
  out.id = "panel-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
