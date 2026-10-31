// Work-session layout: the Builder (chat), Files, Code, Run and the Tutor (right) are five side Panels, each its own card around the Canvas. They are
// resized by dragging or with the arrow keys, and folded from the top bar.
// The grid itself lives in index.html; this file sets its six tracks (--chat-track, --files-track, --code-track, --canvas-track, --run-track,
// --right-track), folds panes that do not fit, runs the drawers of narrow windows, and remembers sizes. Names are prefixed "layout" or "right"
// because every feature file shares one global scope. The key "right" is the Tutor panel, "run" is Run (it only exists while a Flow is open),
// and "files" and "code" start hidden.
const layoutKey = "aidea.layout";
const layoutCanvasMin = 360; // the Canvas is never squeezed below this (wide windows)
const layoutCanvasFr = 800; // the Canvas weight; the panes' weights (380, 300, 560, 420, 540 by default) are on the same scale
const layoutPaneMin = { chat: 268, files: 240, code: 320, run: 288, right: 288 }; // 260 and 280 px cards plus their 8px window margin
const layoutNames = ["chat", "files", "code", "run", "right"]; // left to right
const layoutLeft = ["chat", "files", "code"]; // the panes on the left of the Canvas; Run and the Tutor are on its right
const layoutFoldOrder = ["chat", "run", "right", "files", "code"]; // what auto-fold gives up first: choosing a file must not hide the Files panel it was chosen in
const layoutLabel = { chat: "Builder", files: "Files", code: "Code", run: "Run", right: "Tutor" };
const layoutNarrowBelow = 760; // narrower windows show the panes as drawers
const layoutStep = 20;
const layoutSeparatorWidth = 8; // the gap between two cards
const layoutEdge = 8; // the margin between a card and the window's edge

{
  const style = document.createElement("style");
  style.textContent = `
    #sepc, #sepf, #sepk, #sepx, #sepr { width: ${layoutSeparatorWidth}px; cursor: col-resize; touch-action: none; background: transparent; }
    #sepc { grid-area: sepc; } #sepf { grid-area: sepf; } #sepk { grid-area: sepk; } #sepx { grid-area: sepx; } #sepr { grid-area: sepr; }
    #sepc:hover, #sepf:hover, #sepk:hover, #sepx:hover, #sepr:hover, #sepc:focus-visible, #sepf:focus-visible, #sepk:focus-visible, #sepx:focus-visible, #sepr:focus-visible,
    #sepc.dragging, #sepf.dragging, #sepk.dragging, #sepx.dragging, #sepr.dragging { background: var(--accent); outline: none; }
    [role="separator"][hidden] { display: none; }
    body.chat-folded #chat, body.files-folded #files, body.code-folded #code, body.run-folded #run, body.right-folded #right, body.canvas-folded main { display: none; }
    /* The failure line lives in <main> over the Canvas; with the Canvas hidden it moves to the body (layoutApply) and floats at the bottom of the window. */
    body > #error { position: fixed; left: 50%; transform: translateX(-50%); bottom: 16px; max-width: min(560px, calc(100vw - 32px)); z-index: 25; padding: 6px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
    #fold-canvas:disabled, #fold-run:disabled { opacity: .45; cursor: default; }
    .drawer-close, #scrim { display: none; }
    body.narrow { --canvas-min: 0px; }
    body.narrow #scrim:not([hidden]) { display: block; position: fixed; inset: 51px 0 0 0; z-index: 15; background: rgba(0, 0, 0, .5); }
    body.narrow.drawer-chat #chat, body.narrow.drawer-files #files, body.narrow.drawer-code #code, body.narrow.drawer-run #run, body.narrow.drawer-right #right { display: flex; position: fixed; top: 51px; bottom: 0; z-index: 20; width: min(360px, calc(100vw - 16px)); box-shadow: 0 14px 36px rgba(0, 0, 0, .5); }
    body.narrow.drawer-chat #chat, body.narrow.drawer-files #files, body.narrow.drawer-code #code { left: 0; }
    body.narrow.drawer-run #run, body.narrow.drawer-right #right { right: 0; }
    body.narrow .drawer-close:not([hidden]) { display: block; position: absolute; top: 6px; right: 8px; z-index: 1; padding: 3px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); }
  `;
  document.head.append(style);
}

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


// ---- Sizes and folded state. A pane's size is a flex weight (fr), so every visible pane grows and shrinks with the window.
// Folded (by the person or automatically) means a 0 track with its separator hidden. Automatic folds are never saved.
// The defaults give the Tutor room (Builder 380, Files 300, Code 560, Run 420, Tutor 540); a size the person saved by resizing wins over them.
const layoutDefault = { chat: 380, files: 300, code: 560, run: 420, right: 540 };
const layoutState = { ...layoutDefault, chatFolded: false, filesFolded: true, codeFolded: true, runFolded: false, rightFolded: false, canvasFolded: false };
// A size is the person's own only once they have dragged a separator: folding a pane used to save all the numbers as if they were choices, and the
// defaults could then never reach anyone who had used the app. Saves from before the marks count as the person's own when they differ from the old defaults.
const layoutSized = { chat: false, files: false, code: false, run: false, right: false };
let layoutRunAvailable = false; // Run has something to show only while a Flow is open
try {
  const saved = JSON.parse(localStorage.getItem(layoutKey) || "{}");
  for (const f of ["chatFolded", "runFolded", "rightFolded", "canvasFolded"]) layoutState[f] = saved[f] === true;
  for (const f of ["filesFolded", "codeFolded"]) layoutState[f] = saved[f] !== false; // these stay hidden until the person shows them
  for (const n of layoutNames) {
    if (saved[n] > 0 && (saved.sized ? saved.sized[n] === true : saved[n] !== { chat: 340, right: 320 }[n])) { layoutState[n] = saved[n]; layoutSized[n] = true; }
  }
} catch {}
const layoutSave = () => {
  try {
    localStorage.setItem(layoutKey, JSON.stringify({ chatFolded: layoutState.chatFolded, filesFolded: layoutState.filesFolded, codeFolded: layoutState.codeFolded, runFolded: layoutState.runFolded, rightFolded: layoutState.rightFolded, canvasFolded: layoutState.canvasFolded, sized: layoutSized, ...Object.fromEntries(layoutNames.filter((n) => layoutSized[n]).map((n) => [n, layoutState[n]])) }));
  } catch {}
};

// Where a pane's card ends and the next begins: the track of the panes between it and the edge it is measured from.
const layoutBefore = (names) => names.reduce((n, o) => n + (layoutShown[o] ? layoutTrack(o) + layoutSeparatorWidth : 0), 0);
const layoutPanes = {
  chat: { sep: $("sepc"), el: $("chat"), button: $("fold-chat"), fold: "chatFolded", cls: "chat-folded", edge: (x) => x },
  // The panes on the left end at their own separator and begin where the ones before them end.
  files: { sep: $("sepf"), el: $("files"), button: $("fold-files"), fold: "filesFolded", cls: "files-folded", edge: (x) => x - layoutBefore(["chat"]) },
  code: { sep: $("sepk"), el: $("code"), button: $("fold-code"), fold: "codeFolded", cls: "code-folded", edge: (x) => x - layoutBefore(["chat", "files"]) },
  // Run sits between the Canvas and the Tutor: its card ends where the Tutor's separator begins.
  run: { sep: $("sepx"), el: $("run"), button: $("fold-run"), fold: "runFolded", cls: "run-folded", edge: (x) => layoutWidth() - layoutBefore(["right"]) - x },
  right: { sep: $("sepr"), el: $("right"), button: $("fold-right"), fold: "rightFolded", cls: "right-folded", edge: (x) => layoutWidth() - x },
};
let layoutShown = { chat: true, files: false, code: false, run: false, right: true }; // what is really on screen: the person's choice minus automatic folds
let layoutMargin = {}; // the window margin each card carries (8px for the outermost card on each side)
let layoutNarrow = false;
let layoutCanvasHidden = false; // the person's choice, unless it would leave nothing on screen or the window shows drawers
let layoutDrawer = null; // "chat" | "files" | "code" | "run" | "right" | null, only in narrow windows
let layoutOpener = null; // the button that opened the drawer, which gets the focus back
let layoutLastOpened = "chat"; // the pane the person opened last is the one auto-fold keeps

const layoutWidth = () => document.documentElement.clientWidth;
// What the person wants on screen: Run only counts while a Flow is open.
const layoutWanted = (name) => (name === "run" ? layoutRunAvailable && !layoutState.runFolded : !layoutState[layoutPanes[name].fold]);
const layoutAnyLeft = (shown) => layoutLeft.some((n) => shown[n]);
// A side without a pane leaves the Canvas an 8px margin; a pane costs its track minimum plus its separator.
const layoutEdges = (shown) => (layoutAnyLeft(shown) ? 0 : layoutEdge) + (shown.run || shown.right ? 0 : layoutEdge);
const layoutNeed = (shown) => (layoutCanvasHidden ? 0 : layoutCanvasMin) + layoutNames.reduce((n, p) => n + (shown[p] ? layoutPaneMin[p] + layoutSeparatorWidth : 0), 0) + layoutEdges(shown);
// The card plus the window margin it carries.
const layoutTrack = (name) => layoutPanes[name].el.offsetWidth + (layoutMargin[name] ?? 0);

function layoutResolve() {
  layoutNarrow = layoutWidth() < layoutNarrowBelow;
  layoutCanvasHidden = !layoutNarrow && layoutState.canvasFolded && layoutNames.some(layoutWanted);
  if (layoutNarrow) { layoutShown = Object.fromEntries(layoutNames.map((n) => [n, false])); return; }
  layoutDrawer = null;
  layoutShown = Object.fromEntries(layoutNames.map((n) => [n, layoutWanted(n)]));
  // For lack of room the Builder folds first, then Run and the Tutor, then Files and Code; the pane opened last is the last to go.
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
// stands between it and whatever comes next, and Run's is not needed.
function layoutFrame() {
  const order = layoutNames.filter((n) => layoutShown[n]);
  const first = order.find((n) => layoutLeft.includes(n) || layoutCanvasHidden);
  const last = [...order].reverse().find((n) => !layoutLeft.includes(n) || layoutCanvasHidden);
  layoutMargin = {};
  for (const [name, p] of Object.entries(layoutPanes)) {
    const [l, r] = [name === first ? layoutEdge : 0, name === last ? layoutEdge : 0];
    layoutMargin[name] = l + r;
    p.el.style.marginLeft = `${l}px`;
    p.el.style.marginRight = `${r}px`;
    p.sep.hidden = !layoutShown[name] || (layoutCanvasHidden && (layoutLeft.includes(name) ? order.indexOf(name) === order.length - 1 : name === "run" || !layoutShown.run));
  }
  const main = document.querySelector("main");
  main.style.marginLeft = `${!layoutCanvasHidden && !layoutAnyLeft(layoutShown) ? layoutEdge : 0}px`;
  main.style.marginRight = `${!layoutCanvasHidden && !(layoutShown.run || layoutShown.right) ? layoutEdge : 0}px`;
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
  const canvasButton = $("fold-canvas");
  canvasButton.disabled = layoutNarrow || !layoutNames.some(layoutWanted);
  canvasButton.setAttribute("aria-pressed", String(!layoutCanvasHidden));
  canvasButton.title = layoutNarrow ? "The Canvas stays on screen in a narrow window" : canvasButton.disabled ? "The Canvas stays on screen while every other panel is hidden" : "Show or hide the Canvas";
  $("scrim").hidden = !layoutDrawer;
  layoutFrame();
  for (const [name, p] of Object.entries(layoutPanes)) {
    const open = layoutNarrow && layoutDrawer === name;
    body.classList.toggle(p.cls, !layoutShown[name]);
    body.classList.toggle(`drawer-${name}`, open);
    p.el.setAttribute("role", open ? "dialog" : "region");
    p.closeButton.hidden = !open;
    if (name === "run") {
      p.button.disabled = !layoutRunAvailable;
      p.button.title = layoutRunAvailable ? "Show or hide Run" : "Run is available once you open a function's Flow";
    }
    if (layoutNarrow) { p.button.removeAttribute("aria-pressed"); p.button.setAttribute("aria-expanded", String(open)); }
    else { p.button.removeAttribute("aria-expanded"); p.button.setAttribute("aria-pressed", String(layoutShown[name])); }
    if (!layoutShown[name]) continue;
    p.sep.setAttribute("aria-valuemin", String(layoutPaneMin[name]));
    p.sep.setAttribute("aria-valuemax", String(Math.round(layoutMax(name))));
    p.sep.setAttribute("aria-valuenow", String(Math.round(layoutTrack(name))));
  }
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

// Opens a pane ("chat", "files", "code", "run" or "right", the Tutor), as a drawer in a narrow window.
function layoutShowPane(name) {
  if (layoutNarrow) layoutOpenDrawer(name);
  else { layoutState[layoutPanes[name].fold] = false; layoutLastOpened = name; layoutApply(); layoutSave(); }
}

// Run has something to show only while a Flow is open; until then its button is disabled and its card takes no room.
function layoutSetRunAvailable(on) {
  if (layoutRunAvailable === on) return;
  layoutRunAvailable = on;
  if (!on && layoutDrawer === "run") layoutDrawer = null; // the Flow closed under an open Run drawer: nothing left to show in it
  layoutApply();
}

for (const [name, p] of Object.entries(layoutPanes)) {
  p.el.tabIndex = -1;
  p.closeButton = Object.assign(document.createElement("button"), { type: "button", className: "drawer-close", textContent: "Close", hidden: true, onclick: layoutCloseDrawer });
  p.closeButton.setAttribute("aria-label", `Close ${layoutLabel[name]}`);
  p.el.append(p.closeButton);
  p.button.onclick = () => {
    if (layoutNarrow) { layoutDrawer === name ? layoutCloseDrawer() : layoutOpenDrawer(name); return; }
    // Hiding is the person's choice and is saved; showing a pane that had no room makes auto-fold take another one.
    layoutState[p.fold] = layoutShown[name];
    if (!layoutNames.some(layoutWanted)) layoutState.canvasFolded = false; // the last pane to go leaves the Canvas, never an empty window
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
  // Arrow keys move the edge: Right moves it right, so the panes on the left of the Canvas grow and Run and the Tutor shrink.
  p.sep.onkeydown = (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    layoutSet(name, layoutTrack(name) + layoutStep * dir * (layoutLeft.includes(name) ? 1 : -1));
  };
}

// A quick tour draws over the Canvas, so starting one brings the Canvas back. The person's choice is saved as it now stands (shown).
function layoutShowCanvas() {
  if (!layoutCanvasHidden) return;
  layoutState.canvasFolded = false;
  layoutApply();
  layoutSave();
}

$("fold-canvas").onclick = () => {
  layoutState.canvasFolded = !layoutCanvasHidden;
  layoutApply();
  layoutSave();
};

layoutApply();
window.addEventListener("resize", layoutApply);
