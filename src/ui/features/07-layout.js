// Work-session layout. Every Panel (Builder, Files, Code, Run, Tutor) is DECLARED ONCE in the registry below (layoutRegister); the cards, their
// separators, the grid, the sizes, the saved layout and the Panels menu in the top bar are all produced from it, so a new Panel is one declaration plus
// its content, and the top bar keeps its one "Panels" control however many Panels there are. The Canvas sits between the Panels of the left and of the
// right and is not declared here (its content is the page's own). Panels are resized by dragging or with the arrow keys, and shown or hidden from the
// menu. Names are prefixed "layout" or "panels" because every feature file shares one global scope.
const layoutKey = "aidea.layout";
const layoutCanvasMin = 360; // the Canvas is never squeezed below this (wide windows)
const layoutCanvasFr = 800; // the Canvas weight; the Panels' weights (380, 300, 560, 420, 540 by default) are on the same scale
const layoutNarrowBelow = 760; // narrower windows show the Panels as drawers
const layoutStep = 20;
const layoutSeparatorWidth = 8; // the gap between two cards
const layoutEdge = 8; // the margin between a card and the window's edge
const layoutSvg = (inner) => `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"/>${inner}</svg>`;

// ---- The registry. Order is the order on screen: the Panels of the left, then the Canvas, then the Panels of the right.
const layoutRegistry = [];
const layoutNames = []; // the ids in that order (kept in step with the registry)
const layoutLeft = []; // the ids of the Panels on the left of the Canvas
const layoutPaneMin = {}; // minimum track width (the card plus its 8px window margin)
const layoutDef = {}; // the declaration of each Panel, by id
let layoutFoldOrder = []; // what auto-fold gives up first: choosing a file must not hide the Files panel it was chosen in
const layoutState = { canvasFolded: false }; // per Panel: its weight (by id) and `<id>Folded`
const layoutSized = {}; // per Panel: whether the weight is the person's own (they dragged a separator)
const layoutPanes = {}; // per Panel: { sep, el, edge }
let layoutRunAvailable = false; // Run has something to show only while a Flow is open
let layoutShown = {}; // what is really on screen: the person's choice minus automatic folds
let layoutMargin = {}; // the window margin each card carries (8px for the outermost card on each side)
let layoutNarrow = false;
let layoutCanvasHidden = false; // the person's choice, unless it would leave nothing on screen or the window shows drawers
let layoutDrawer = null; // the id of the Panel open as a drawer, only in narrow windows
let layoutOpener = null; // the control that opened the drawer, which gets the focus back
let layoutLastOpened = "chat"; // the Panel the person opened last is the one auto-fold keeps
let layoutReady = false; // false while the first Panels are being declared

// A size is the person's own only once they have dragged a separator: folding a pane used to save all the numbers as if they were choices, and the
// defaults could then never reach anyone who had used the app. Saves from before the marks count as the person's own when they differ from the old defaults.
let layoutSaved = {};
try { layoutSaved = JSON.parse(localStorage.getItem(layoutKey) || "{}") ?? {}; } catch {}
layoutState.canvasFolded = layoutSaved.canvasFolded === true;
const layoutSave = () => {
  try {
    const keys = layoutNames.flatMap((n) => [`${n}Folded`, ...(layoutSized[n] ? [n] : [])]);
    localStorage.setItem(layoutKey, JSON.stringify({ canvasFolded: layoutState.canvasFolded, sized: layoutSized, ...Object.fromEntries(keys.map((k) => [k, layoutState[k]])) }));
  } catch {}
};

// Declares a Panel. { id, title, side: "left" | "right", min, weight, startsHidden, foldRank, pane: id of its body (or null), adopt: ids of elements
// already in the page that move into its card, icon: svg shapes for the menu, available: () => boolean with unavailable: the reason when it is not,
// legacySize: the weight an old save held when it was never the person's own }.
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
  layoutPaneMin[d.id] = d.min;
  layoutState[d.id] = d.weight;
  layoutSized[d.id] = false;
  const saved = layoutSaved[`${d.id}Folded`];
  layoutState[`${d.id}Folded`] = d.startsHidden ? saved !== false : saved === true; // a Panel that starts hidden stays hidden until the person shows it
  const size = layoutSaved[d.id];
  if (size > 0 && (layoutSaved.sized ? layoutSaved.sized[d.id] === true : size !== d.legacySize)) { layoutState[d.id] = size; layoutSized[d.id] = true; }
  layoutShown[d.id] = !layoutState[`${d.id}Folded`] && !d.available; // a Panel that depends on something is not on screen until it is available
  layoutBuild(d);
  if (layoutReady) { layoutGrid(); panelsBuild(); layoutApply(); }
}

// The card, its separator and its body, put where the registry says. The page keeps only the Canvas.
function layoutBuild(d) {
  const card = Object.assign(document.createElement("section"), { id: d.id, className: "panel-card", tabIndex: -1 });
  card.dataset.side = d.side === "left" ? "left" : "right";
  card.setAttribute("aria-label", d.title);
  card.append(Object.assign(document.createElement("h2"), { className: "card-head", textContent: d.title }));
  if (d.pane) card.append(Object.assign(document.createElement("div"), { id: d.pane }));
  for (const id of d.adopt) { const e = $(id); if (e) card.append(e); }
  const sep = Object.assign(document.createElement("div"), { id: `sep-${d.id}`, className: "panel-sep", tabIndex: 0 });
  sep.setAttribute("role", "separator");
  sep.setAttribute("aria-orientation", "vertical");
  sep.setAttribute("aria-label", `Resize ${d.title}`);
  card.style.gridArea = d.id;
  sep.style.gridArea = `sep-${d.id}`;
  if (d.side === "left") document.querySelector("main").before(card, sep); else $("scrim").before(sep, card);
  const closeButton = Object.assign(document.createElement("button"), { type: "button", className: "drawer-close", textContent: "Close", hidden: true, onclick: () => layoutCloseDrawer() });
  closeButton.setAttribute("aria-label", `Close ${d.title}`);
  card.append(closeButton);
  const before = (names) => names.reduce((n, o) => n + (layoutShown[o] ? layoutTrack(o) + layoutSeparatorWidth : 0), 0);
  // The separator of a Panel on the left sits after its card, so the pointer is at the end of the track; on the right it sits before it.
  const edge = (x) => (d.side === "left" ? x - before(layoutLeft.slice(0, layoutLeft.indexOf(d.id))) : layoutWidth() - before(layoutNames.slice(layoutNames.indexOf(d.id) + 1)) - x);
  layoutPanes[d.id] = { sep, el: card, closeButton, edge };
  sep.onpointerdown = (e) => { e.preventDefault(); sep.setPointerCapture(e.pointerId); sep.classList.add("dragging"); };
  sep.onpointermove = (e) => { if (sep.hasPointerCapture(e.pointerId)) layoutSet(d.id, edge(e.clientX)); };
  sep.onpointerup = sep.onpointercancel = () => sep.classList.remove("dragging");
  // Arrow keys move the edge: Right moves it right, so the Panels on the left of the Canvas grow and the ones on its right shrink.
  sep.onkeydown = (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    layoutSet(d.id, layoutTrack(d.id) + layoutStep * dir * (d.side === "left" ? 1 : -1));
  };
}

// The grid follows the registry: a track and a separator per Panel, the Canvas between the two sides, one row under the top bar.
function layoutGrid() {
  const left = layoutLeft, right = layoutNames.filter((n) => !layoutLeft.includes(n));
  const columns = [...left.flatMap((n) => [`var(--${n}-track)`, "auto"]), "var(--canvas-track)", ...right.flatMap((n) => ["auto", `var(--${n}-track)`])];
  const row = [...left.flatMap((n) => [n, `sep-${n}`]), "main", ...right.flatMap((n) => [`sep-${n}`, n])];
  document.body.style.gridTemplateColumns = columns.join(" ");
  document.body.style.gridTemplateRows = "auto minmax(0, 1fr)";
  document.body.style.gridTemplateAreas = `"${columns.map(() => "top").join(" ")}" "${row.join(" ")}"`;
}

{
  const style = document.createElement("style");
  style.textContent = `
    .panel-sep { width: ${layoutSeparatorWidth}px; cursor: col-resize; touch-action: none; background: transparent; }
    .panel-sep:hover, .panel-sep:focus-visible, .panel-sep.dragging { background: var(--accent); outline: none; }
    .panel-sep[hidden] { display: none; }
    .panel-card[data-folded]:not(.is-drawer), body.canvas-folded main { display: none; }
    /* The failure line lives in <main> over the Canvas; with the Canvas hidden it moves to the body (layoutApply) and floats at the bottom of the window. */
    body > #error { position: fixed; left: 50%; transform: translateX(-50%); bottom: 16px; max-width: min(560px, calc(100vw - 32px)); z-index: 25; padding: 6px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
    .drawer-close, #scrim { display: none; }
    body.narrow { --canvas-min: 0px; }
    body.narrow #scrim:not([hidden]) { display: block; position: fixed; inset: 51px 0 0 0; z-index: 15; background: rgba(0, 0, 0, .5); }
    .panel-card.is-drawer { display: flex; position: fixed; top: 51px; bottom: 0; z-index: 20; width: min(360px, calc(100vw - 16px)); margin: 0; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); }
    .panel-card.is-drawer[data-side="left"] { left: 0; }
    .panel-card.is-drawer[data-side="right"] { right: 0; }
    body.narrow .drawer-close:not([hidden]) { display: block; position: absolute; top: 6px; right: 8px; z-index: 1; padding: 3px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); }
  `;
  document.head.append(style);
}

// ---- Sizes and folded state. A pane's size is a flex weight (fr), so every visible pane grows and shrinks with the window.
// Folded (by the person or automatically) means a 0 track with its separator hidden. Automatic folds are never saved.

const layoutWidth = () => document.documentElement.clientWidth;
// What the person wants on screen: a Panel that is not available (Run with no Flow open) does not count.
const layoutAvailable = (name) => !layoutDef[name].available || layoutDef[name].available();
const layoutWanted = (name) => layoutAvailable(name) && !layoutState[`${name}Folded`];
const layoutAnyLeft = (shown) => layoutLeft.some((n) => shown[n]);
// A side without a pane leaves the Canvas an 8px margin; a pane costs its track minimum plus its separator.
const layoutAnyRight = (shown) => layoutNames.some((n) => !layoutLeft.includes(n) && shown[n]);
const layoutEdges = (shown) => (layoutAnyLeft(shown) ? 0 : layoutEdge) + (layoutAnyRight(shown) ? 0 : layoutEdge);
const layoutNeed = (shown) => (layoutCanvasHidden ? 0 : layoutCanvasMin) + layoutNames.reduce((n, p) => n + (shown[p] ? layoutPaneMin[p] + layoutSeparatorWidth : 0), 0) + layoutEdges(shown);
// The card plus the window margin it carries.
const layoutTrack = (name) => layoutPanes[name].el.offsetWidth + (layoutMargin[name] ?? 0);

function layoutResolve() {
  layoutNarrow = layoutWidth() < layoutNarrowBelow;
  layoutCanvasHidden = !layoutNarrow && layoutState.canvasFolded && layoutNames.some(layoutWanted);
  if (layoutNarrow) { layoutShown = Object.fromEntries(layoutNames.map((n) => [n, false])); return; }
  layoutDrawer = null;
  layoutShown = Object.fromEntries(layoutNames.map((n) => [n, layoutWanted(n)]));
  // For lack of room the Panels fold in the order of their fold rank (the Builder first); the one opened last is the last to go.
  for (const n of [...layoutFoldOrder.filter((x) => x !== layoutLastOpened), layoutLastOpened]) if (layoutNeed(layoutShown) > layoutWidth()) layoutShown[n] = false;
}

// Most a pane's track may take: the window minus the Canvas minimum, the other panes and this separator.
function layoutMax(name) {
  const others = layoutNames.filter((n) => n !== name && layoutShown[n]);
  return Math.max(layoutPaneMin[name], layoutWidth() - (layoutCanvasHidden ? 0 : layoutCanvasMin) - layoutSeparatorWidth - others.reduce((n, o) => n + layoutTrack(o) + layoutSeparatorWidth, 0) - layoutEdges(layoutShown));
}

// Margins and separators follow from what is on screen. The card at each window edge carries the 8px margin; with the Canvas hidden those are the
// first and last cards shown, otherwise the first of the panes on its left and the last of the panes on its right. A separator stands between two
// cards that are both on screen: with the Canvas visible each pane has the one on its Canvas side; with it hidden, a left pane's own separator
// stands between it and whatever comes next, a right pane's stands between it and the right pane before it, and the first right pane has none.
function layoutFrame() {
  const order = layoutNames.filter((n) => layoutShown[n]);
  const rightShown = order.filter((n) => !layoutLeft.includes(n));
  const first = order.find((n) => layoutLeft.includes(n) || layoutCanvasHidden);
  const last = [...order].reverse().find((n) => !layoutLeft.includes(n) || layoutCanvasHidden);
  layoutMargin = {};
  for (const [name, p] of Object.entries(layoutPanes)) {
    const [l, r] = [name === first ? layoutEdge : 0, name === last ? layoutEdge : 0];
    layoutMargin[name] = l + r;
    p.el.style.marginLeft = `${l}px`;
    p.el.style.marginRight = `${r}px`;
    const isLeft = layoutLeft.includes(name);
    p.sep.hidden = !layoutShown[name] || (layoutCanvasHidden && (isLeft ? order.indexOf(name) === order.length - 1 : rightShown[0] === name));
  }
  const main = document.querySelector("main");
  main.style.marginLeft = `${!layoutCanvasHidden && !layoutAnyLeft(layoutShown) ? layoutEdge : 0}px`;
  main.style.marginRight = `${!layoutCanvasHidden && !layoutAnyRight(layoutShown) ? layoutEdge : 0}px`;
}

function layoutApply() {
  layoutResolve();
  const body = document.body;
  const track = (name) => (layoutShown[name] ? `minmax(${layoutPaneMin[name]}px, ${layoutState[name]}fr)` : "0px");
  const canvasMin = layoutNarrow || layoutCanvasHidden ? 0 : layoutCanvasMin + layoutEdges(layoutShown);
  for (const name of layoutNames) body.style.setProperty(`--${name}-track`, track(name));
  body.style.setProperty("--canvas-track", layoutCanvasHidden ? "0px" : `minmax(${canvasMin}px, ${layoutCanvasFr}fr)`);
  body.classList.toggle("narrow", layoutNarrow);
  body.classList.toggle("canvas-folded", layoutCanvasHidden);
  const errorHome = layoutCanvasHidden ? body : document.querySelector("main");
  if ($("error").parentNode !== errorHome) errorHome.append($("error"));
  $("scrim").hidden = !layoutDrawer;
  layoutFrame();
  for (const [name, p] of Object.entries(layoutPanes)) {
    const open = layoutNarrow && layoutDrawer === name;
    p.el.toggleAttribute("data-folded", !layoutShown[name]);
    p.el.classList.toggle("is-drawer", open);
    p.el.setAttribute("role", open ? "dialog" : "region");
    p.closeButton.hidden = !open;
    if (!layoutShown[name]) continue;
    p.sep.setAttribute("aria-valuemin", String(layoutPaneMin[name]));
    p.sep.setAttribute("aria-valuemax", String(Math.round(layoutMax(name))));
    p.sep.setAttribute("aria-valuenow", String(Math.round(layoutTrack(name))));
  }
  panelsSync();
  document.dispatchEvent(new Event("layout-applied")); // the Files panel loads its tree only while it is on screen
}

// Sets a pane to a wanted track width in px by turning it into a weight: w / (w + the rest) = wanted / available.
function layoutSet(name, px) {
  if (!layoutShown[name]) return;
  const others = layoutNames.filter((n) => n !== name && layoutShown[n]);
  const t = Math.min(layoutMax(name), Math.max(layoutPaneMin[name], px));
  const available = layoutWidth() - layoutSeparatorWidth * (1 + others.length);
  const rest = (layoutCanvasHidden ? 0 : layoutCanvasFr) + others.reduce((n, o) => n + layoutState[o], 0);
  layoutState[name] = Math.round(t * rest / Math.max(1, available - t) * 100) / 100;
  layoutSized[name] = true;
  layoutApply();
  layoutSave();
}

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
}
$("scrim").onclick = layoutCloseDrawer;
// Capture phase: the switcher's own Escape handler closes its popover first, and that Escape must not also close a drawer.
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && layoutDrawer && $("switcher-menu").hidden && $("panels-menu").hidden) layoutCloseDrawer(); }, true);

// Opens a Panel by its id, as a drawer in a narrow window.
function layoutShowPane(name) {
  if (layoutNarrow) layoutOpenDrawer(name);
  else { layoutState[`${name}Folded`] = false; layoutLastOpened = name; layoutApply(); layoutSave(); }
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
}

function layoutToggleCanvas() {
  layoutState.canvasFolded = !layoutCanvasHidden;
  layoutApply();
  layoutSave();
}

// A quick tour draws over the Canvas, so starting one brings the Canvas back. The person's choice is saved as it now stands (shown).
function layoutShowCanvas() {
  if (!layoutCanvasHidden) return;
  layoutState.canvasFolded = false;
  layoutApply();
  layoutSave();
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
layoutGrid();
panelsBuild();
layoutApply();
window.addEventListener("resize", layoutApply);
