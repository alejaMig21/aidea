// Runs inside the real page (injected by panel-registry.test.ts after every feature script) and writes what it saw as JSON into a pre element.
// Nothing here names a Panel: what is expected is read from the registry itself, so a new Panel declared there needs no edit in this file.
const report = { errors: [] };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (target, k) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const rows = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox]")];
const entries = () => rows().map((b) => ({ title: b.dataset.title, id: b.dataset.panel, checked: b.getAttribute("aria-checked"), disabled: b.getAttribute("aria-disabled") === "true", reason: b.querySelector(".reason")?.textContent ?? "", markVisible: getComputedStyle(b.querySelector(".check")).visibility !== "hidden", focusable: b.tabIndex === -1 }));
// With a docking Layout the DOM order of the cards is not the screen order: the cards on screen are listed by their position, left to right.
const onScreen = (e) => !!e && e.getClientRects().length > 0;
const cards = () => [...document.querySelectorAll(".panel-card, main")].filter(onScreen).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((e) => e.id || e.tagName.toLowerCase());
const shown = (id) => onScreen(document.getElementById(id));
const row = (title) => rows().find((b) => b.dataset.title === title);
const openMenu = async () => { if (document.getElementById("panels-menu").hidden) document.getElementById("panels-button").click(); await wait(50); };

(async () => {
  try {
    await openProject(window.PANELS_PROJECT); // without a Project the Home screen covers the whole workspace
    for (let i = 0; i < 100 && (!$("home").hidden || !$("opening").hidden); i++) await wait(100);
    await wait(300);
    report.width = document.documentElement.clientWidth;
    report.registry = layoutRegistry.map((d) => ({ id: d.id, title: d.title, side: d.side, conditional: !!d.available }));
    report.cards = cards();
    report.headerControls = document.querySelectorAll("#panels-control > button").length; // the menu's own rows are not header controls
    report.perPanelButtons = document.querySelectorAll("[id^='fold-']").length;
    report.menuClosedAtStart = document.getElementById("panels-menu").hidden;
    report.entries = entries();
    // what the saved layout of an older version (plus an id nobody knows) did
    report.saved = { chatShown: shown("chat"), filesShown: shown("files"), chatSizeCarried: layoutSized.chat, ghostIgnored: !("ghost" in layoutState) && !("ghostFolded" in layoutState) };

    // keyboard: open, move, toggle, escape
    const button = document.getElementById("panels-button");
    button.click();
    await wait(50);
    report.menuOpen = { hidden: document.getElementById("panels-menu").hidden, expanded: button.getAttribute("aria-expanded"), focusIsItem: document.activeElement?.getAttribute("role") === "menuitemcheckbox" };
    const first = document.activeElement?.dataset.title;
    key(document.activeElement, "ArrowDown");
    report.menuOpen.moved = document.activeElement?.dataset.title !== first;
    const files = row("Files");
    const wasShown = shown("files");
    files.focus();
    key(files, " ");
    await wait(50);
    report.toggle = { was: wasShown, now: shown("files"), stillOpen: !document.getElementById("panels-menu").hidden, checked: files.getAttribute("aria-checked") };
    key(document.activeElement, "Escape");
    await wait(50);
    report.escape = { hidden: document.getElementById("panels-menu").hidden, focusOnButton: document.activeElement === button };
    // Tab and a click outside close it too
    await openMenu(); key(document.activeElement, "Tab"); await wait(50);
    const byTab = document.getElementById("panels-menu").hidden;
    await openMenu(); document.body.click(); await wait(50);
    report.closes = { byTab, byOutsideClick: document.getElementById("panels-menu").hidden };
    // a row that cannot be used is reachable by the keyboard, so its reason can be read, and does nothing when activated
    await openMenu();
    const unusable = rows().find((b) => b.getAttribute("aria-disabled") === "true");
    unusable.focus();
    const countBefore = layoutNames.filter((n) => layoutShown[n]).length;
    key(unusable, "Enter");
    await wait(50);
    report.unusable = { focused: document.activeElement === unusable, reason: unusable.querySelector(".reason")?.textContent ?? "", shownBefore: countBefore, shownAfter: layoutNames.filter((n) => layoutShown[n]).length };
    key(document.activeElement, "Escape");

    // the stored layout keeps the old key names and never holds an id nobody declares
    report.stored = Object.keys(JSON.parse(localStorage.getItem("aidea.layout") || "{}")).sort();

    // a conditional Panel (Run) is enabled when what it needs exists
    const conditional = report.registry.find((d) => d.conditional);
    layoutSetRunAvailable(true);
    await wait(100);
    await openMenu();
    const enabled = entries().find((e) => e.id === conditional.id);
    report.conditional = { id: conditional.id, enabled: !enabled.disabled, shown: shown(conditional.id) };
    key(document.activeElement, "Escape");
    layoutSetRunAvailable(false);
    await wait(100);

    // the Canvas hidden from the menu: the Panels stay, one group each, and the Canvas is off the screen
    await openMenu();
    row("Canvas").click();
    await wait(100);
    report.canvasHidden = { canvasShown: onScreen(document.querySelector("main")), panelsShown: layoutNames.filter((n) => layoutShown[n]).length, groups: layoutApi.groups.length };
    row("Canvas").click();
    await wait(100);
    report.canvasBack = { canvasShown: onScreen(document.querySelector("main")) };
    key(document.activeElement, "Escape");

    // a seventh Panel: one declaration
    const before = { entries: entries().length, header: document.querySelectorAll("#panels-control > button").length };
    layoutRegister({ id: "notes", title: "Notes", side: "right", min: 260, weight: 300, startsHidden: true, pane: "pane-notes", icon: '<path d="M5 6h6M5 9h6"/>' });
    await wait(100);
    const notes = entries().find((e) => e.title === "Notes");
    report.seventh = { entriesBefore: before.entries, entriesAfter: entries().length, hasCard: !!document.getElementById("notes"), hasPane: !!document.getElementById("pane-notes"), inLayoutAtStart: !!layoutApi.getPanel("notes"), entry: notes, headerBefore: before.header, headerAfter: document.querySelectorAll("#panels-control > button").length, hiddenAtStart: !shown("notes") };
    document.getElementById("panels-button").click();
    await wait(50);
    row("Notes").click();
    await wait(100);
    report.seventh.shownAfterMenu = shown("notes");
    report.seventh.inLayoutAfterMenu = !!layoutApi.getPanel("notes");
    report.finalCards = cards();
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  }
  const out = document.createElement("pre"); // built, not written as text, so the page source never contains the marker the test looks for
  out.id = "panel-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
