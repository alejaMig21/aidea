// Runs inside the real page (injected by layout-presets-page.test.ts) and writes what it saw as JSON into a pre element.
const report = { errors: [], nativeConfirms: 0 };
window.addEventListener("error", (e) => report.errors.push(String(e.message)));
window.confirm = () => { report.nativeConfirms++; return false; };
window.prompt = () => { report.nativeConfirms++; return null; };
const lpWait = (ms) => new Promise((r) => setTimeout(r, ms));
const lpUntil = async (cond, ms = 8000) => { for (let t = 0; t < ms; t += 20) { if (await cond()) return true; await lpWait(20); } return false; };
const lpOpenMenu = async () => { if (document.getElementById("panels-menu").hidden) document.getElementById("panels-button").click(); await lpWait(30); };
const lpRows = () => [...document.querySelectorAll("#panels-menu [data-preset]")];
const lpRow = (name) => lpRows().find((r) => r.dataset.preset === name);
const lpAction = (a) => document.querySelector(`#panels-menu [data-action="${a}"]`);
const lpPanelsOn = () => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox][data-panel]")].filter((b) => b.getAttribute("aria-checked") === "true").map((b) => b.dataset.panel).sort();
const lpDialog = () => document.querySelector('[role="dialog"][data-dialog]');
const lpDialogButton = (label) => [...(lpDialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);
const lpChoose = async (name) => { await lpOpenMenu(); lpRow(name).click(); await lpWait(400); };
const lpSavedMeta = async () => JSON.parse(decodeURIComponent(/<meta name="aidea-saved" content="([^"]*)">/.exec(await (await fetch("/")).text())[1]));
(async () => {
  try {
    await openProject(window.PANELS_PROJECT);
    await lpUntil(() => $("home").hidden && $("opening").hidden);
    await lpWait(500);

    // The menu lists the built-in layouts first, then the person's own.
    await lpOpenMenu();
    report.menu = { builtIns: lpRows().map((r) => r.dataset.preset), actions: [...document.querySelectorAll("#panels-menu [data-action]")].map((a) => a.dataset.action), roles: [...new Set(lpRows().map((r) => r.getAttribute("role")))] };

    // The built-ins arrange the window.
    await lpChoose("Canvas only");
    await lpOpenMenu();
    report.canvasOnly = lpPanelsOn();
    await lpChoose("Classic IDE");
    await lpOpenMenu();
    report.classic = lpPanelsOn();
    await lpChoose("Default");
    await lpOpenMenu();
    report.default = lpPanelsOn();

    // Saving the current layout under a name: a dialog of aidea's own, which refuses a built-in name and an empty one.
    await lpChoose("Classic IDE");
    await lpOpenMenu();
    lpAction("save").click();
    await lpUntil(() => lpDialog());
    const input = lpDialog().querySelector("input");
    report.promptFocus = document.activeElement === input;
    input.value = "default";
    lpDialogButton("Save").click();
    await lpWait(100);
    report.refusedBuiltIn = { stillOpen: !!lpDialog(), error: lpDialog()?.querySelector("[data-error]")?.textContent ?? "" };
    input.value = "   ";
    lpDialogButton("Save").click();
    await lpWait(100);
    report.refusedEmpty = { stillOpen: !!lpDialog(), error: lpDialog()?.querySelector("[data-error]")?.textContent ?? "" };
    input.value = "My work";
    lpDialogButton("Save").click();
    await lpUntil(() => !lpDialog());
    await lpWait(300);
    report.afterSave = { rows: (await lpOpenMenu(), lpRows().map((r) => r.dataset.preset)), served: Object.keys((await lpSavedMeta()).presets ?? {}) };

    // Switching: arrange something else, then bring the saved one back in one click.
    await lpChoose("Canvas only");
    await lpOpenMenu();
    report.beforeSwitch = lpPanelsOn();
    await lpChoose("My work");
    await lpOpenMenu();
    report.afterSwitch = lpPanelsOn();

    // Managing: rename, then delete, from one dialog.
    await lpOpenMenu();
    lpAction("manage").click();
    await lpUntil(() => lpDialog());
    report.manage = { names: [...lpDialog().querySelectorAll("[data-preset-name]")].map((n) => n.textContent) };
    [...lpDialog().querySelectorAll("button")].find((b) => b.textContent === "Rename").click();
    await lpUntil(() => document.querySelectorAll('[role="dialog"][data-dialog]').length === 2);
    const renameDialog = document.querySelectorAll('[role="dialog"][data-dialog]')[1];
    renameDialog.querySelector("input").value = "Work";
    [...renameDialog.querySelectorAll("button")].find((b) => b.textContent === "Rename").click();
    await lpUntil(() => document.querySelectorAll('[role="dialog"][data-dialog]').length === 1);
    await lpWait(300);
    report.renamed = { names: [...lpDialog().querySelectorAll("[data-preset-name]")].map((n) => n.textContent), served: Object.keys((await lpSavedMeta()).presets ?? {}) };
    [...lpDialog().querySelectorAll("button")].find((b) => b.textContent === "Delete").click();
    await lpUntil(() => document.querySelectorAll('[role="dialog"][data-dialog]').length === 2);
    const askDialog = document.querySelectorAll('[role="dialog"][data-dialog]')[1];
    report.deleteAsks = askDialog.textContent.includes("Work");
    [...askDialog.querySelectorAll("button")].find((b) => b.textContent === "Delete").click();
    await lpUntil(() => document.querySelectorAll('[role="dialog"][data-dialog]').length === 1);
    await lpWait(300);
    report.deleted = { names: [...lpDialog().querySelectorAll("[data-preset-name]")].map((n) => n.textContent), served: Object.keys((await lpSavedMeta()).presets ?? {}) };
    lpDialogButton("Close").click();
    await lpUntil(() => !lpDialog());

    // Whether a layout is remembered for each project: the choice and the layout of this project reach the core, and nothing is lost when it is switched back.
    await lpOpenMenu();
    const scope = () => document.querySelector('#panels-menu [data-action="scope"]');
    report.scopeStart = scope().getAttribute("aria-checked");
    scope().click();
    await lpWait(400);
    await lpChoose("Classic IDE");
    await lpWait(500);
    const meta = await lpSavedMeta();
    report.scopeProject = { scope: meta.layoutScope, projects: Object.keys(meta.projectLayouts ?? {}), mine: current in (meta.projectLayouts ?? {}) };
    await lpOpenMenu();
    scope().click();
    await lpWait(400);
    report.scopeBack = (await lpSavedMeta()).layoutScope;
    await lpOpenMenu();
    report.menuClosedByClicks = true;
    report.nativeConfirmsAtEnd = report.nativeConfirms;
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "lp-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
