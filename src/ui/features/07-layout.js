// Work-session layout. Every Panel (Builder, Files, Code, Run, Tutor) is DECLARED ONCE in the registry below (layoutRegister); its card, its place in the
// docking Layout (dockview-core, vendored in src/ui/vendor/dockview, ADR 0007) and the Panels menu in the top bar are all produced from it, so a new Panel
// is one declaration plus its content, and the top bar keeps its one "Panels" control however many Panels there are. The Canvas is a Panel of the Layout
// too ("canvas") but is not declared here (its content is the page's own). Panels are resized and moved with the library (drag a border, drag a tab) and
// shown or hidden from the menu. Names are prefixed "layout" or "panels" because every feature file shares one global scope.
const layoutKey = "aidea.layout";
const layoutCanvasMin = 360; // the Canvas is never squeezed below this (wide windows)
const layoutCanvasFr = 800; // the Canvas weight; the Panels' weights (380, 300, 560, 420, 540 by default) are on the same scale
const layoutNarrowBelow = 760; // narrower windows show the Panels as drawers
const layoutGap = 8; // the gap between two cards, and the margin between a card and the window's edge
const layoutMinHeight = 120; // the least height of a Panel stacked above or below another
const layoutSvg = (inner) => `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"/>${inner}</svg>`;

// ---- The registry. Order is the order on screen by default: the Panels of the left, then the Canvas, then the Panels of the right.
const layoutRegistry = [];
const layoutNames = []; // the ids in that order (kept in step with the registry), without the Canvas
const layoutLeft = []; // the ids of the Panels on the left of the Canvas
const layoutDef = {}; // the declaration of each Panel, by id
let layoutFoldOrder = []; // what auto-fold gives up first: choosing a file must not hide the Files panel it was chosen in
const layoutState = { canvasFolded: false }; // per Panel: its default weight (by id) and `<id>Folded`
const layoutPanes = {}; // per Panel: { el: its card, closeButton }
const layoutHome = {}; // per Panel: where it was when it went away ({ ref: the id of a neighbour, direction }), so showing it again puts it back there
let layoutRunAvailable = false; // Run has something to show only while a Flow is open
let layoutShown = {}; // what is really on screen: the person's choice minus automatic folds
let layoutNarrow = false;
let layoutCanvasHidden = false; // the person's choice, unless it would leave nothing on screen or the window shows drawers
let layoutDrawer = null; // the id of the Panel open as a drawer, only in narrow windows
let layoutOpener = null; // the control that opened the drawer, which gets the focus back
let layoutLastOpened = "chat"; // the Panel the person opened last is the one auto-fold keeps
let layoutReady = false; // false while the first Panels are being declared
let layoutTouched = false; // true once the person has dragged a border: from then on their sizes are kept when a Panel is shown or hidden
let layoutBusy = false; // true while this file adds or removes Panels, so a removal made by the library itself (not by the menu) can be told apart

// A Panel's flags are the person's own only once they chose. The sizes an old save holds (`sized` and the weight under each id) are written back as they were
// and not used: ticket 19 saves the whole arrangement and reads them.
let layoutSaved = {};
try { layoutSaved = JSON.parse(localStorage.getItem(layoutKey) || "{}") ?? {}; } catch {}
layoutState.canvasFolded = layoutSaved.canvasFolded === true;
const layoutSave = () => {
  try {
    const old = Object.fromEntries(layoutNames.filter((n) => layoutSaved[n] > 0).map((n) => [n, layoutSaved[n]]));
    localStorage.setItem(layoutKey, JSON.stringify({ ...(layoutSaved.sized ? { sized: layoutSaved.sized } : {}), ...old, canvasFolded: layoutState.canvasFolded, ...Object.fromEntries(layoutNames.map((n) => [`${n}Folded`, layoutState[`${n}Folded`]])) }));
  } catch {}
};

// ---- The Layout: a dockview in #dock. Cards that are not in it wait in #dock-parking (hidden), so the features can always find their bodies by id.
const layoutMain = document.querySelector("main");
// Without the library (its file did not load) there is no Layout: the page says so, shows the Canvas, and the rest of the features go on working.
const layoutDv = window["dockview-core"] ?? (() => {
  // a line of its own: #error is cleared by whatever the person does next
  layoutMain.append(Object.assign(document.createElement("p"), { id: "layout-notice", className: "said", textContent: "The window layout could not be loaded, so only the Canvas is shown. Restart aidea to try again.", style: "position:absolute;left:15px;bottom:15px;margin:0;color:var(--danger);z-index:1" }));
  layoutMain.setAttribute("role", "region");
  const none = { width: 0, height: 0, panels: [], groups: [], getPanel: () => undefined, addPanel() {}, removePanel() {}, layout() {}, onDidRemovePanel() {}, onWillShowOverlay() {}, toJSON: () => ({}), fromJSON() {} };
  return { themeAbyssSpaced: {}, createDockview: () => none, none: true };
})();
const layoutDock = Object.assign(document.createElement("div"), { id: "dock" });
const layoutParking = Object.assign(document.createElement("div"), { id: "dock-parking", hidden: true });
document.getElementById("topbar").after(layoutDock);
layoutDock.after(layoutParking);
(layoutDv.none ? layoutDock : layoutParking).append(layoutMain);
const layoutEl = (id) => (id === "canvas" ? layoutMain : layoutPanes[id].el);
const layoutApi = layoutDv.createDockview(layoutDock, {
  theme: { ...layoutDv.themeAbyssSpaced, name: "aidea", className: "dockview-theme-aidea", gap: layoutGap },
  defaultRenderer: "always", // a Panel that is not the visible tab keeps its scroll and zoom
  disableFloatingGroups: true,
  getTabContextMenuItems: () => [], // hiding is done from the Panels menu
  createComponent: ({ name }) => ({ element: layoutEl(name), init() {}, dispose() {} }),
});
// The library measures itself later (a resize observer), too late for the first arrangement and for sizes set right after a resize: measure when the size differs.
function layoutMeasure() {
  const w = layoutDock.clientWidth - 2 * layoutGap, h = layoutDock.clientHeight - layoutGap;
  if (layoutApi.width !== w || layoutApi.height !== h) layoutApi.layout(w, h);
}
layoutMeasure();
// The person's sizes count (layoutTouched) once a border drag has really changed a width. It is not reset in a session: it lasts until the page is reloaded.
const layoutWidths = () => layoutApi.groups.map((g) => Math.round(g.element.getBoundingClientRect().width)).join();
let layoutSashFrom = null;
layoutDock.addEventListener("pointerdown", (e) => { layoutSashFrom = e.target.closest?.(".dv-sash") ? layoutWidths() : null; }, true);
document.addEventListener("pointerup", () => { if (layoutSashFrom !== null && layoutWidths() !== layoutSashFrom) layoutTouched = true; layoutSashFrom = null; }, true);
// A Panel taken out of the Layout by the library itself (not through the menu) is a stray drag-out, not a choice: it is not saved as hidden and the next sync puts it back.
layoutApi.onDidRemovePanel((p) => {
  if (layoutBusy) return;
  layoutParking.append(layoutEl(p.id));
  queueMicrotask(layoutApply);
});
// The Canvas is never put behind another Panel in a group of tabs (it would be on the menu as shown and not visible), and no Panel is put behind the Canvas.
layoutApi.onWillShowOverlay((e) => {
  if (e.position !== "center" || !e.group) return;
  const data = e.getData();
  const dragged = data?.panelId ? [data.panelId] : (layoutApi.getGroup?.(data?.groupId)?.panels ?? []).map((p) => p.id);
  if (dragged.includes("canvas") !== e.group.panels.some((p) => p.id === "canvas") && !(dragged.length && e.group.panels.every((p) => dragged.includes(p.id)))) e.preventDefault();
});

// Declares a Panel. { id, title, side: "left" | "right", min, weight, startsHidden, foldRank, pane: id of its body (or null), adopt: ids of elements
// already in the page that move into its card, icon: svg shapes for the menu, available: () => boolean with unavailable: the reason when it is not }.
// Folded state keeps the old names (`<id>Folded`), so layouts saved by earlier versions still load; a saved id nobody declares is ignored.
function layoutRegister(def) {
  const d = { side: "right", min: 288, weight: 400, startsHidden: false, foldRank: 50, pane: null, adopt: [], icon: "", ...def };
  if (layoutDef[d.id]) return;
  layoutRegistry.push(d);
  layoutDef[d.id] = d;
  const left = layoutRegistry.filter((x) => x.side === "left"), right = layoutRegistry.filter((x) => x.side !== "left");
  layoutNames.splice(0, layoutNames.length, ...[...left, ...right].map((x) => x.id));
  layoutLeft.splice(0, layoutLeft.length, ...left.map((x) => x.id));
  layoutFoldOrder = [...layoutRegistry].sort((a, b) => a.foldRank - b.foldRank).map((x) => x.id);
  layoutState[d.id] = d.weight;
  const saved = layoutSaved[`${d.id}Folded`];
  layoutState[`${d.id}Folded`] = d.startsHidden ? saved !== false : saved === true; // a Panel that starts hidden stays hidden until the person shows it
  layoutShown[d.id] = false;
  layoutBuild(d);
  if (layoutReady) { panelsBuild(); layoutApply(); }
}

// The card and its body. The library draws the title (the tab) and the border around the card.
function layoutBuild(d) {
  const card = Object.assign(document.createElement("section"), { id: d.id, className: "panel-card", tabIndex: -1 });
  card.setAttribute("aria-label", d.title);
  card.append(Object.assign(document.createElement("h2"), { className: "drawer-title", textContent: d.title })); // shown only when the card is a drawer: in the Layout the tab is the title
  if (d.pane) card.append(Object.assign(document.createElement("div"), { id: d.pane }));
  for (const id of d.adopt) { const e = $(id); if (e) card.append(e); }
  const closeButton = Object.assign(document.createElement("button"), { type: "button", className: "drawer-close", textContent: "Close", hidden: true, onclick: () => layoutCloseDrawer() });
  closeButton.setAttribute("aria-label", `Close ${d.title}`);
  card.append(closeButton);
  layoutPanes[d.id] = { el: card, closeButton };
  layoutParking.append(card);
}

{
  const style = document.createElement("style");
  style.textContent = `
    #dock { min-height: 0; padding: 0 ${layoutGap}px ${layoutGap}px; position: relative; }
    .dockview-theme-aidea {
      --dv-background-color: var(--bg); --dv-group-view-background-color: var(--panel); --dv-separator-border: transparent; --dv-sash-color: transparent; --dv-active-sash-color: var(--accent);
      --dv-tabs-and-actions-container-background-color: var(--panel); --dv-tabs-and-actions-container-height: 40px; --dv-tabs-and-actions-container-font-size: 13.5px; --dv-tab-font-size: 13.5px;
      --dv-activegroup-visiblepanel-tab-background-color: var(--panel); --dv-activegroup-hiddenpanel-tab-background-color: var(--panel);
      --dv-inactivegroup-visiblepanel-tab-background-color: var(--panel); --dv-inactivegroup-hiddenpanel-tab-background-color: var(--panel);
      --dv-activegroup-visiblepanel-tab-color: var(--text); --dv-activegroup-hiddenpanel-tab-color: var(--muted);
      --dv-inactivegroup-visiblepanel-tab-color: var(--text); --dv-inactivegroup-hiddenpanel-tab-color: var(--muted);
      --dv-drag-over-background-color: rgba(138, 164, 255, .22); --dv-drag-over-border: 2px solid var(--accent);
    }
    .dockview-theme-aidea .dv-groupview { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--panel); }
    .dockview-theme-aidea .dv-tabs-and-actions-container { border-bottom: 1px solid var(--line); }
    .dockview-theme-aidea .dv-tab { padding: 0 14px; font-weight: 600; }
    .dockview-theme-aidea .dv-tab.dv-active-tab:not(:only-child) { box-shadow: inset 0 -2px 0 var(--accent); } /* with several tabs in a group, the one in front is underlined */
    .dockview-theme-aidea .dv-default-tab-action { display: none !important; }
    .panel-card, main { width: 100%; height: 100%; background: var(--panel); border: 0; border-radius: 0 0 12px 12px; margin: 0; overflow: hidden; }
    main { background-color: var(--canvas); }
    .panel-card { min-width: 0; display: flex; flex-direction: column; }
    /* The failure line lives in <main> over the Canvas; with the Canvas hidden it moves to the body (layoutApply) and floats at the bottom of the window. */
    body > #error { position: fixed; left: 50%; transform: translateX(-50%); bottom: 16px; max-width: min(560px, calc(100vw - 32px)); z-index: 25; padding: 6px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
    .drawer-close, .drawer-title, #scrim { display: none; }
    .panel-card.is-drawer .drawer-title { display: flex; align-items: center; flex: none; height: 40px; padding: 0 14px; font-size: 13.5px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--text); border-bottom: 1px solid var(--line); }
    body.narrow #scrim:not([hidden]) { display: block; position: fixed; inset: 51px 0 0 0; z-index: 15; background: rgba(0, 0, 0, .5); }
    .panel-card.is-drawer { display: flex; position: fixed; top: 51px; bottom: 0; height: auto; z-index: 20; width: min(360px, calc(100vw - 16px)); margin: 0; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); }
    .panel-card.is-drawer[data-side="left"] { left: 0; }
    .panel-card.is-drawer[data-side="right"] { right: 0; }
    body.narrow .drawer-close:not([hidden]) { display: block; position: absolute; top: 6px; right: 8px; z-index: 1; padding: 3px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); }
  `;
  document.head.append(style);
}

// ---- What is on screen. The Layout holds the Panels the person wants, minus the ones given up for lack of room (never saved). In a narrow window it
// holds the Canvas only and a Panel opens as a drawer over it.
function layoutWidth() { return document.documentElement.clientWidth; }
// What the person wants on screen: a Panel that is not available (Run with no Flow open) does not count.
const layoutAvailable = (name) => !layoutDef[name].available || layoutDef[name].available();
const layoutWanted = (name) => layoutAvailable(name) && !layoutState[`${name}Folded`];
// Every minimum is padded by the library's gap. The window leaves the Layout a margin of 8px at each side.
// (the library counts the gap into the size of a group, so a group is never narrower than its declared minimum.)
const layoutMin = (name) => (name === "canvas" ? layoutCanvasMin : layoutDef[name].min) + layoutGap;
const layoutNeed = (shown) => 2 * layoutGap + (layoutCanvasHidden ? 0 : layoutMin("canvas")) + layoutNames.reduce((n, p) => n + (shown[p] ? layoutMin(p) : 0), 0);
const layoutOrder = () => [...layoutLeft, "canvas", ...layoutNames.filter((n) => !layoutLeft.includes(n))];
const layoutInDock = (id) => !!layoutApi.getPanel(id);

function layoutResolve() {
  layoutNarrow = layoutWidth() < layoutNarrowBelow;
  layoutCanvasHidden = !layoutNarrow && layoutState.canvasFolded && layoutNames.some(layoutWanted);
  if (layoutNarrow) { layoutShown = Object.fromEntries(layoutNames.map((n) => [n, false])); return; }
  layoutDrawer = null;
  layoutShown = Object.fromEntries(layoutNames.map((n) => [n, layoutWanted(n)]));
  // For lack of room the Panels fold in the order of their fold rank (the Builder first); the one opened last is the last to go.
  for (const n of [...layoutFoldOrder.filter((x) => x !== layoutLastOpened), layoutLastOpened]) if (layoutNeed(layoutShown) > layoutWidth()) layoutShown[n] = false;
}

// Where a Panel was when it left, so that showing it again puts it back: in the tabs of a neighbour, or at its side.
function layoutRemember(id) {
  const group = layoutApi.getPanel(id).group, mate = group.panels.find((x) => x.id !== id);
  if (mate) { layoutHome[id] = { ref: mate.id, direction: "within" }; return; }
  const r = group.element.getBoundingClientRect(), near = (a, b) => Math.abs(a - b) <= layoutGap + 4;
  for (const other of layoutApi.groups) {
    if (other === group || !other.panels.length) continue;
    const q = other.element.getBoundingClientRect(), rows = q.top < r.bottom && q.bottom > r.top, cols = q.left < r.right && q.right > r.left;
    const direction = rows && near(q.right, r.left) ? "right" : rows && near(q.left, r.right) ? "left" : cols && near(q.bottom, r.top) ? "below" : cols && near(q.top, r.bottom) ? "above" : null;
    if (direction) { layoutHome[id] = { ref: other.panels[0].id, direction }; return; }
  }
  delete layoutHome[id];
}

// Where a Panel goes: where it was, else beside the nearest Panel of the registry order (the one before it, else the one after it).
function layoutPlace(id) {
  const home = layoutHome[id];
  if (home && layoutInDock(home.ref)) return { referencePanel: home.ref, direction: home.direction };
  const order = layoutOrder(), at = order.indexOf(id);
  const before = order.slice(0, at).reverse().find(layoutInDock);
  if (before) return { referencePanel: before, direction: "right" };
  const after = order.slice(at + 1).find(layoutInDock);
  return after ? { referencePanel: after, direction: "left" } : undefined;
}

// The width of a card by weight, as the fixed grid gave it: the weights share the window minus the gaps, and a card at a window edge gives up its margin.
const layoutWeight = (id) => (id === "canvas" ? layoutCanvasFr : layoutState[id]);
function layoutTarget(id, row) {
  const track = (layoutApi.width + 2 * layoutGap - layoutGap * (row.length - 1)) * layoutWeight(id) / row.reduce((n, x) => n + layoutWeight(x), 0);
  return Math.max(layoutMin(id) - layoutGap, Math.round(track - (row[0] === id ? layoutGap : 0) - (row.at(-1) === id ? layoutGap : 0)));
}
// Sets a group to a card width. The library counts half a gap into the size of the outer groups, so the width is measured and corrected once.
function layoutWiden(id, want) {
  const p = layoutApi.getPanel(id);
  if (!p) return;
  p.api.setSize({ width: want });
  const got = p.group.element.getBoundingClientRect().width;
  if (Math.abs(got - want) > 1) p.api.setSize({ width: Math.round(want + want - got) });
}

// Puts the Layout in step with the Panels that should be on screen, then gives the new groups their size by weight.
function layoutSync(wanted) {
  layoutMeasure(); // the sizes below need the width the window has now, not the one the library last measured
  const had = layoutApi.panels.length;
  const gone = layoutApi.panels.map((p) => p.id).filter((id) => !wanted.includes(id));
  const added = [];
  layoutBusy = true;
  try { // a failure of the library must not leave the flag set: every later removal made by the library would be ignored
    for (const id of gone) { layoutRemember(id); layoutApi.removePanel(layoutApi.getPanel(id)); layoutParking.append(layoutEl(id)); }
    for (const id of layoutOrder().filter((x) => wanted.includes(x) && !layoutInDock(x))) {
      const position = layoutPlace(id);
      layoutApi.addPanel({ id, component: id, title: id === "canvas" ? "Canvas" : layoutDef[id].title, minimumWidth: layoutMin(id), minimumHeight: layoutMinHeight, ...(position ? { position } : {}) });
      added.push(id);
    }
  } finally { layoutBusy = false; }
  // Sizes. While the person has not dragged a border and every group holds one Panel in one row, the weights decide every width (as the fixed grid did),
  // so showing or hiding a Panel shares the room by weight. Afterwards only a Panel that comes back is sized, and the others keep what the person made.
  const groups = layoutApi.groups.filter((g) => g.panels.length).sort((a, b) => a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left);
  const row = groups.map((g) => g.panels[0].id);
  const plain = !layoutTouched && groups.every((g) => g.panels.length === 1 && Math.abs(g.element.getBoundingClientRect().top - groups[0].element.getBoundingClientRect().top) < 2);
  if ((!had || added.length || gone.length) && row.length > 1) {
    if (plain) for (const id of row.slice(0, -1)) layoutWiden(id, layoutTarget(id, row));
    else for (const id of added) if (layoutApi.getPanel(id).group.panels.length === 1) layoutWiden(id, layoutTarget(id, row));
  }
  layoutShown = Object.fromEntries(layoutNames.map((n) => [n, layoutInDock(n)]));
}

let layoutStash = null; // the Layout as the library describes it, kept in memory only while the window is narrow (never saved: ticket 19 saves)
function layoutApply() {
  const dropped = layoutDrawer && layoutWidth() >= layoutNarrowBelow; // the window grew wide under an open drawer
  const wasNarrow = layoutNarrow;
  layoutResolve();
  if (layoutNarrow && !wasNarrow && layoutApi.panels.length > 1) layoutStash = layoutApi.toJSON();
  if (!layoutNarrow && wasNarrow && layoutStash) {
    layoutMeasure();
    layoutBusy = true;
    try { layoutApi.fromJSON(layoutStash); } catch { /* the sync below adds what is missing */ } finally { layoutBusy = false; layoutStash = null; }
  }
  const body = document.body;
  body.classList.toggle("narrow", layoutNarrow);
  const wanted = layoutNarrow ? ["canvas"] : [...(layoutCanvasHidden ? [] : ["canvas"]), ...layoutNames.filter((n) => layoutShown[n])];
  layoutSync(wanted);
  const errorHome = layoutCanvasHidden ? body : layoutMain;
  if ($("error").parentNode !== errorHome) errorHome.append($("error"));
  $("scrim").hidden = !layoutDrawer;
  for (const [name, p] of Object.entries(layoutPanes)) {
    const open = layoutNarrow && layoutDrawer === name;
    if (open) { p.el.dataset.side = layoutLeft.includes(name) ? "left" : "right"; document.body.append(p.el); } else if (!layoutInDock(name)) layoutParking.append(p.el);
    p.el.classList.toggle("is-drawer", open);
    p.el.setAttribute("role", open ? "dialog" : "region");
    p.closeButton.hidden = !open;
  }
  panelsSync();
  if (dropped) { panelsButton.focus(); layoutOpener = null; } // the drawer went with the narrow window: the focus must not fall to the page
  document.dispatchEvent(new Event("layout-applied")); // the Files panel loads its tree only while it is on screen
}

// Brings a Panel's tab to the front (it may be one of several tabs of a group).
const layoutReveal = (name) => layoutApi.getPanel(name)?.api.setActive();

// ---- Drawers (narrow windows): one panel over the Canvas at a time, opened from the Panels menu.
function layoutOpenDrawer(name, opener) {
  layoutDrawer = name;
  layoutOpener = opener ?? (document.activeElement && document.activeElement !== document.body ? document.activeElement : panelsButton);
  layoutApply();
  layoutPanes[name].el.focus();
}
function layoutCloseDrawer() {
  if (!layoutDrawer) return;
  layoutDrawer = null;
  layoutApply();
  layoutOpener?.focus();
  layoutOpener = null;
}
$("scrim").onclick = layoutCloseDrawer;
// Capture phase: the switcher's own Escape handler closes its popover first, and that Escape must not also close a drawer.
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && layoutDrawer && $("switcher-menu").hidden && $("panels-menu").hidden) layoutCloseDrawer(); }, true);

// Opens a Panel by its id, as a drawer in a narrow window.
function layoutShowPane(name) {
  if (layoutNarrow) layoutOpenDrawer(name);
  else { layoutState[`${name}Folded`] = false; layoutLastOpened = name; layoutApply(); layoutSave(); layoutReveal(name); }
}

// Run has something to show only while a Flow is open; until then it is listed in the menu as unavailable and its card takes no room.
function layoutSetRunAvailable(on) {
  if (layoutRunAvailable === on) return;
  layoutRunAvailable = on;
  if (!on && layoutDrawer === "run") layoutDrawer = null; // the Flow closed under an open Run drawer: nothing left to show in it
  layoutApply();
}

// Shows or hides a Panel (a drawer in a narrow window) on the person's choice, from the menu.
function layoutToggle(name) {
  if (layoutNarrow) { layoutDrawer === name ? layoutCloseDrawer() : layoutOpenDrawer(name, panelsButton); return; }
  // Hiding is the person's choice and is saved; showing a pane that had no room makes auto-fold take another one.
  layoutState[`${name}Folded`] = layoutShown[name];
  if (!layoutNames.some(layoutWanted)) layoutState.canvasFolded = false; // the last pane to go leaves the Canvas, never an empty window
  if (!layoutShown[name]) layoutLastOpened = name;
  layoutApply();
  layoutSave();
  if (layoutShown[name]) layoutReveal(name);
}

function layoutToggleCanvas() {
  layoutState.canvasFolded = !layoutCanvasHidden;
  layoutApply();
  layoutSave();
  layoutReveal("canvas");
}

// A quick tour draws over the Canvas, so starting one brings the Canvas back. The person's choice is saved as it now stands (shown).
function layoutShowCanvas() {
  if (layoutCanvasHidden) { layoutState.canvasFolded = false; layoutApply(); layoutSave(); }
  layoutReveal("canvas");
}

// ---- The Panels menu: the one control for Panels in the top bar. One row per Panel (and the Canvas) in screen order, a check mark when it is on
// screen (or open as a drawer), disabled with its reason when it cannot be used. Opens on the first row; Up, Down, Home and End move, Space and Enter
// toggle and leave the menu open, Escape closes it and gives the focus back.
const panelsButton = $("panels-button");
const panelsMenu = $("panels-menu");
const panelsItems = () => [...panelsMenu.querySelectorAll("[role=menuitemcheckbox]")];

function panelsBuild() {
  const hadFocus = document.activeElement?.closest?.("#panels-menu") ? document.activeElement.dataset.panel : null;
  const row = (id, title, icon, toggle) => {
    const b = Object.assign(document.createElement("button"), { type: "button", tabIndex: -1 });
    b.setAttribute("role", "menuitemcheckbox");
    b.dataset.title = title;
    b.dataset.panel = id;
    b.append(Object.assign(document.createElement("span"), { className: "check", textContent: "✓" }));
    b.querySelector(".check").setAttribute("aria-hidden", "true");
    b.insertAdjacentHTML("beforeend", layoutSvg(icon));
    b.append(Object.assign(document.createElement("span"), { className: "label", textContent: title }));
    b.onclick = () => { if (b.getAttribute("aria-disabled") === "true") return; toggle(); if (layoutNarrow) panelsClose(false); };
    return b;
  };
  const side = (left) => layoutRegistry.filter((d) => (d.side === "left") === left).map((d) => row(d.id, d.title, d.icon, () => layoutToggle(d.id)));
  panelsMenu.replaceChildren(...side(true), row("canvas", "Canvas", '<path d="M5 3v10M11 3v10"/>', layoutToggleCanvas), ...side(false));
  panelsSync();
  if (hadFocus) panelsItems().find((b) => b.dataset.panel === hadFocus)?.focus(); // a Panel declared while the menu is open does not take the focus away
}

// Updates the rows in place (checked, disabled, reason) so the focus stays where it is while the layout changes.
function panelsSync() {
  for (const b of panelsItems()) {
    const id = b.dataset.panel;
    let on, why = "";
    if (id === "canvas") {
      on = !layoutCanvasHidden;
      if (layoutNarrow) why = "The Canvas stays on screen in a narrow window";
      else if (!layoutNames.some(layoutWanted)) why = "The Canvas stays on screen while every other panel is hidden";
    } else {
      on = layoutNarrow ? layoutDrawer === id : !!layoutShown[id];
      if (!layoutAvailable(id)) why = layoutDef[id].unavailable ?? "Not available now";
    }
    b.setAttribute("aria-checked", String(on));
    b.setAttribute("aria-disabled", String(!!why)); // not `disabled`: the row stays focusable, so the keyboard and a screen reader reach the reason
    const shownReason = b.querySelector(".reason")?.textContent ?? "";
    if (shownReason === why) continue; // layoutApply runs on every resize and drag step: touch the page only when the text changes
    b.querySelector(".reason")?.remove();
    if (why) b.querySelector(".label").append(Object.assign(document.createElement("span"), { className: "reason", textContent: why }));
  }
}

function panelsOpen() {
  panelsMenu.hidden = false;
  panelsButton.setAttribute("aria-expanded", "true");
  panelsSync();
  (panelsItems().find((b) => b.getAttribute("aria-disabled") !== "true") ?? panelsItems()[0])?.focus();
}
function panelsClose(focusButton) {
  panelsMenu.hidden = true;
  panelsButton.setAttribute("aria-expanded", "false");
  if (focusButton) panelsButton.focus();
}
panelsButton.onclick = () => (panelsMenu.hidden ? panelsOpen() : panelsClose(true));
panelsMenu.onkeydown = (e) => {
  const items = panelsItems(), at = items.indexOf(document.activeElement);
  const go = (b) => { b?.focus(); e.preventDefault(); };
  if (e.key === "ArrowDown") go(items[(at + 1) % items.length]);
  else if (e.key === "ArrowUp") go(items[(at - 1 + items.length) % items.length]);
  else if (e.key === "Home") go(items[0]);
  else if (e.key === "End") go(items.at(-1));
  else if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) document.activeElement?.click?.(); } // toggled here, once, so the key-up cannot toggle it again
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); panelsClose(true); }
  else if (e.key === "Tab") panelsClose(false);
};
panelsMenu.onkeyup = (e) => { if (e.key === " " || e.key === "Enter") e.preventDefault(); };
document.addEventListener("click", (e) => { if (!panelsMenu.hidden && !$("panels-control").contains(e.target)) panelsClose(false); });

// ---- The Panels of aidea, in screen order. The body ids (pane-*) are the ones the features fill; `adopt` moves the Details into the Tutor's card.
layoutRegister({ id: "chat", title: "Builder", side: "left", min: 268, weight: 380, legacySize: 340, foldRank: 10, icon: '<path d="M6 3v10"/>' });
layoutRegister({ id: "files", title: "Files", side: "left", min: 240, weight: 300, startsHidden: true, foldRank: 40, pane: "pane-files", icon: '<path d="M4.5 6h3M4.5 8.5h3M4.5 11h3"/>' });
layoutRegister({ id: "code", title: "Code", side: "left", min: 320, weight: 560, startsHidden: true, foldRank: 50, pane: "pane-code", icon: '<path d="M6.5 6 4.5 8l2 2M9.5 6l2 2-2 2"/>' });
layoutRegister({ id: "run", title: "Run", side: "right", min: 288, weight: 420, foldRank: 20, pane: "pane-run", icon: '<path d="M7 3v10"/>', available: () => layoutRunAvailable, unavailable: "Open a function's Flow to use Run" });
layoutRegister({ id: "right", title: "Tutor", side: "right", min: 288, weight: 540, legacySize: 320, foldRank: 30, pane: "pane-tutor", adopt: ["panel"], icon: '<path d="M10 3v10"/>' });

// The Tutor's entry point stays disabled until the Tutor exists. The head of the panel is the topic field
// (50-tutor.js), the "Start a class" button and one line of help; the other files add the rest below it.
{
  const pane = $("pane-tutor");
  const help = Object.assign(document.createElement("p"), { className: "tutor-help", textContent: "Open a Project to start a class." });
  const start = Object.assign(document.createElement("button"), { type: "button", id: "tutor-start", textContent: "Start a class", disabled: true });
  const head = Object.assign(document.createElement("div"), { id: "tutor-head" });
  head.append(start, help);
  pane.append(head);
}

layoutReady = true;
panelsBuild();
layoutApply();
let layoutFrame = 0; // a resize event comes many times a frame: the Layout is put in step once per frame
window.addEventListener("resize", () => { layoutFrame ||= requestAnimationFrame(() => { layoutFrame = 0; layoutApply(); }); });
