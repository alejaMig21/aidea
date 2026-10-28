// Work-session layout: the chat (left) and the right slot are resized by dragging or with the arrow keys, and folded from the top bar.
// The grid itself lives in index.html; this file sets its three tracks (--chat-track, --canvas-track, --right-track), folds panes
// that do not fit, runs the drawers of narrow windows, and remembers sizes. Names are prefixed "layout" or "right" because every
// feature file shares one global scope.
const layoutKey = "aidea.layout";
const layoutCanvasMin = 360; // the Canvas is never squeezed below this (wide windows)
const layoutCanvasFr = 800; // the Canvas weight; the panes' weights (340, 320 by default) are on the same scale
const layoutPaneMin = { chat: 268, right: 288 }; // 260 and 280 px cards plus their 8px window margin
const layoutNarrowBelow = 760; // narrower windows show the panes as drawers
const layoutStep = 20;
const layoutSeparatorWidth = 8; // the gap between two cards
const layoutEdge = 8; // the margin between a card and the window's edge

{
  const style = document.createElement("style");
  style.textContent = `
    #sepc, #sepr { grid-area: sepc; width: ${layoutSeparatorWidth}px; cursor: col-resize; touch-action: none; background: transparent; }
    #sepr { grid-area: sepr; }
    #sepc:hover, #sepr:hover, #sepc:focus-visible, #sepr:focus-visible, #sepc.dragging, #sepr.dragging { background: var(--accent); outline: none; }
    body.chat-folded #chat, body.chat-folded #sepc, body.right-folded #right, body.right-folded #sepr { display: none; }
    body.chat-folded main { margin-left: ${layoutEdge}px; } body.right-folded main { margin-right: ${layoutEdge}px; }
    .drawer-close, #scrim { display: none; }
    body.narrow { --canvas-min: 0px; }
    body.narrow #scrim:not([hidden]) { display: block; position: fixed; inset: 51px 0 0 0; z-index: 15; background: rgba(0, 0, 0, .5); }
    body.narrow.drawer-chat #chat, body.narrow.drawer-right #right { display: flex; position: fixed; top: 51px; bottom: 0; z-index: 20; width: min(360px, calc(100vw - 16px)); box-shadow: 0 14px 36px rgba(0, 0, 0, .5); }
    body.narrow.drawer-chat #chat { left: 0; }
    body.narrow.drawer-right #right { right: 0; }
    body.narrow .drawer-close:not([hidden]) { display: block; position: absolute; top: 6px; right: 8px; z-index: 1; padding: 3px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); }
  `;
  document.head.append(style);
}

// ---- Right slot tabs: a small registry so ticket 08 can add the Algorithm tab with one call.
const rightTabs = $("right-tabs");
const rightPanes = $("right-panes");
function rightSelectTab(id) {
  for (const b of rightTabs.children) b.setAttribute("aria-selected", String(b.dataset.tab === id));
  for (const p of rightPanes.children) p.hidden = p.dataset.tab !== id;
}
// Adds a tab (button in the tab bar plus its pane). The first one registered is selected.
function rightRegisterTab(id, label, pane) {
  const b = Object.assign(document.createElement("button"), { type: "button", textContent: label, id: `tab-${id}`, onclick: () => rightSelectTab(id) });
  b.dataset.tab = id;
  b.setAttribute("role", "tab");
  b.setAttribute("aria-controls", `pane-${id}`);
  pane.dataset.tab = id;
  pane.id = `pane-${id}`;
  pane.setAttribute("role", "tabpanel");
  pane.setAttribute("aria-labelledby", b.id);
  rightTabs.append(b);
  rightPanes.append(pane);
  rightSelectTab(rightTabs.children.length === 1 ? id : rightTabs.querySelector('[aria-selected="true"]').dataset.tab);
}

// Removes a tab and its pane; if it was selected, the first tab left (the Tutor) is selected.
function rightUnregisterTab(id) {
  const b = rightTabs.querySelector(`[data-tab="${id}"]`);
  if (!b) return;
  const wasSelected = b.getAttribute("aria-selected") === "true";
  b.remove();
  rightPanes.querySelector(`[data-tab="${id}"]`)?.remove();
  if (wasSelected) { for (const x of rightPanes.children) x.hidden = x.dataset.tab !== rightTabs.firstChild.dataset.tab; rightTabs.firstChild.setAttribute("aria-selected", "true"); }
}

// Enables or disables a tab; a disabled tab that was selected hands the selection back to the first tab.
function rightSetTabEnabled(id, enabled) {
  const b = rightTabs.querySelector(`[data-tab="${id}"]`);
  b.disabled = !enabled;
  if (!enabled && b.getAttribute("aria-selected") === "true") rightSelectTab(rightTabs.firstChild.dataset.tab);
}

// The Tutor tab is always present. Its entry point stays disabled until the Tutor exists.
{
  const pane = document.createElement("div");
  const tile = Object.assign(document.createElement("div"), { className: "tile", textContent: "?" });
  tile.setAttribute("aria-hidden", "true");
  const title = Object.assign(document.createElement("h2"), { textContent: "The Tutor is not available yet" });
  const text = Object.assign(document.createElement("p"), {
    textContent: "When it is, it will explain why each decision was made and ask you questions about your project.",
  });
  const start = Object.assign(document.createElement("button"), { type: "button", textContent: "Start a class", disabled: true });
  pane.append(tile, title, text, start);
  rightRegisterTab("tutor", "Tutor", pane);
}


// ---- Sizes and folded state. A pane's size is a flex weight (fr), so every visible column grows and shrinks with the window.
// Folded (by the person or automatically) means a 0 track with its separator hidden. Automatic folds are never saved.
const layoutState = { chat: 340, right: 320, chatFolded: false, rightFolded: false };
try { Object.assign(layoutState, JSON.parse(localStorage.getItem(layoutKey) || "{}")); } catch {}
for (const n of ["chat", "right"]) if (!(layoutState[n] > 0)) layoutState[n] = n === "chat" ? 340 : 320;
const layoutSave = () => { try { localStorage.setItem(layoutKey, JSON.stringify(layoutState)); } catch {} };

const layoutPanes = {
  chat: { sep: $("sepc"), el: $("chat"), button: $("fold-chat"), fold: "chatFolded", cls: "chat-folded", other: "right", edge: (x) => x },
  right: { sep: $("sepr"), el: $("right"), button: $("fold-right"), fold: "rightFolded", cls: "right-folded", other: "chat", edge: (x) => layoutWidth() - x },
};
let layoutShown = { chat: true, right: true }; // what is really on screen: the person's choice minus automatic folds
let layoutNarrow = false;
let layoutDrawer = null; // "chat" | "right" | null, only in narrow windows
let layoutOpener = null; // the button that opened the drawer, which gets the focus back
let layoutLastOpened = "chat"; // the pane the person opened last is the one auto-fold keeps

const layoutWidth = () => document.documentElement.clientWidth;
// A side without a pane leaves the Canvas an 8px margin; a side with one costs its track minimum plus the separator.
const layoutSide = (shown, name) => (shown[name] ? layoutPaneMin[name] + layoutSeparatorWidth : layoutEdge);
const layoutNeed = (shown) => layoutCanvasMin + layoutSide(shown, "chat") + layoutSide(shown, "right");
const layoutTrack = (name) => layoutPanes[name].el.offsetWidth + layoutEdge; // the card plus its 8px window margin

function layoutResolve() {
  layoutNarrow = layoutWidth() < layoutNarrowBelow;
  if (layoutNarrow) { layoutShown = { chat: false, right: false }; return; }
  layoutDrawer = null;
  layoutShown = { chat: !layoutState.chatFolded, right: !layoutState.rightFolded };
  for (const n of layoutLastOpened === "right" ? ["chat", "right"] : ["right", "chat"]) if (layoutNeed(layoutShown) > layoutWidth()) layoutShown[n] = false;
}

// Most a pane's track may take: the window minus the Canvas minimum, the other side and this separator.
function layoutMax(name) {
  const other = layoutPanes[name].other;
  return Math.max(layoutPaneMin[name], layoutWidth() - layoutCanvasMin - layoutSeparatorWidth - (layoutShown[other] ? layoutTrack(other) + layoutSeparatorWidth : layoutEdge));
}

function layoutApply() {
  layoutResolve();
  const body = document.body;
  const track = (name) => (layoutShown[name] ? `minmax(${layoutPaneMin[name]}px, ${layoutState[name]}fr)` : "0px");
  const canvasMin = layoutNarrow ? 0 : layoutCanvasMin + layoutEdge * ((layoutShown.chat ? 0 : 1) + (layoutShown.right ? 0 : 1));
  body.style.setProperty("--chat-track", track("chat"));
  body.style.setProperty("--right-track", track("right"));
  body.style.setProperty("--canvas-track", `minmax(${canvasMin}px, ${layoutCanvasFr}fr)`);
  body.classList.toggle("narrow", layoutNarrow);
  $("scrim").hidden = !layoutDrawer;
  for (const [name, p] of Object.entries(layoutPanes)) {
    const open = layoutNarrow && layoutDrawer === name;
    body.classList.toggle(p.cls, !layoutShown[name]);
    body.classList.toggle(`drawer-${name}`, open);
    p.el.setAttribute("role", open ? "dialog" : "region");
    p.closeButton.hidden = !open;
    if (layoutNarrow) { p.button.removeAttribute("aria-pressed"); p.button.setAttribute("aria-expanded", String(open)); }
    else { p.button.removeAttribute("aria-expanded"); p.button.setAttribute("aria-pressed", String(layoutShown[name])); }
    if (!layoutShown[name]) continue;
    p.sep.setAttribute("aria-valuemin", String(layoutPaneMin[name]));
    p.sep.setAttribute("aria-valuemax", String(Math.round(layoutMax(name))));
    p.sep.setAttribute("aria-valuenow", String(Math.round(layoutTrack(name))));
  }
}

// Sets a pane to a wanted track width in px by turning it into a weight: w / (w + canvas + other) = wanted / available.
function layoutSet(name, px) {
  if (!layoutShown[name]) return;
  const other = layoutPanes[name].other;
  const t = Math.min(layoutMax(name), Math.max(layoutPaneMin[name], px));
  const available = layoutWidth() - (layoutShown.chat ? layoutSeparatorWidth : 0) - (layoutShown.right ? layoutSeparatorWidth : 0);
  layoutState[name] = Math.round(t * (layoutCanvasFr + (layoutShown[other] ? layoutState[other] : 0)) / Math.max(1, available - t) * 100) / 100;
  layoutApply();
  layoutSave();
}

// ---- Drawers (narrow windows): one panel over the Canvas at a time, opened from the top-bar buttons.
function layoutOpenDrawer(name) {
  layoutDrawer = name;
  layoutOpener = layoutPanes[name].button;
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && layoutDrawer && $("switcher-menu").hidden) layoutCloseDrawer(); }, true);

// Selects a tab and makes sure the right slot is open to show it.
function rightShowTab(id) {
  if (layoutNarrow) layoutOpenDrawer("right");
  else { layoutState.rightFolded = false; layoutLastOpened = "right"; layoutApply(); layoutSave(); }
  rightSelectTab(id);
}

for (const [name, p] of Object.entries(layoutPanes)) {
  p.el.tabIndex = -1;
  p.closeButton = Object.assign(document.createElement("button"), { type: "button", className: "drawer-close", textContent: "Close", hidden: true, onclick: layoutCloseDrawer });
  p.closeButton.setAttribute("aria-label", `Close the ${name === "chat" ? "chat" : "right panel"}`);
  p.el.append(p.closeButton);
  p.button.onclick = () => {
    if (layoutNarrow) { layoutDrawer === name ? layoutCloseDrawer() : layoutOpenDrawer(name); return; }
    // Hiding is the person's choice and is saved; showing a pane that had no room makes auto-fold take the other one.
    layoutState[p.fold] = layoutShown[name];
    if (!layoutShown[name]) layoutLastOpened = name;
    layoutApply();
    layoutSave();
  };
  p.sep.onpointerdown = (e) => {
    e.preventDefault();
    p.sep.setPointerCapture(e.pointerId);
    p.sep.classList.add("dragging");
  };
  p.sep.onpointermove = (e) => { if (p.sep.hasPointerCapture(e.pointerId)) layoutSet(name, p.edge(e.clientX)); };
  p.sep.onpointerup = p.sep.onpointercancel = () => p.sep.classList.remove("dragging");
  // Arrow keys move the edge: Right moves it right, so the chat grows and the right slot shrinks.
  p.sep.onkeydown = (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    layoutSet(name, layoutTrack(name) + layoutStep * dir * (name === "chat" ? 1 : -1));
  };
}

layoutApply();
window.addEventListener("resize", layoutApply);
