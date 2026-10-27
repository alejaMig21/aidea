// Work-session layout: the chat (left) and the right slot are resized by dragging or with the arrow keys, and folded from the top bar.
// The grid itself lives in index.html (the Canvas track has a minimum width the other tracks can never take); this file only sets
// --chat-w / --right-w, clamps them, and remembers them. Names are prefixed "layout" or "right" because every feature file shares one global scope.
const layoutKey = "aidea.layout";
const layoutCanvasMin = 320; // keep equal to --canvas-min in index.html
const layoutPaneMin = 160;
const layoutStep = 20;
const layoutSeparatorWidth = 8; // the gap between two cards
const layoutOuterMargins = 16; // 8px of the window's edge on each side of the cards

{
  const style = document.createElement("style");
  style.textContent = `
    #sepc, #sepr { grid-area: sepc; width: ${layoutSeparatorWidth}px; cursor: col-resize; touch-action: none; background: transparent; }
    #sepr { grid-area: sepr; }
    #sepc:hover, #sepr:hover, #sepc:focus-visible, #sepr:focus-visible, #sepc.dragging, #sepr.dragging { background: var(--accent); outline: none; }
    body.chat-folded #chat, body.chat-folded #sepc, body.right-folded #right, body.right-folded #sepr { display: none; }
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

// ---- Sizes and folded state.
const layoutState = { chat: 340, right: 320, chatFolded: false, rightFolded: false };
try { Object.assign(layoutState, JSON.parse(localStorage.getItem(layoutKey) || "{}")); } catch {}
const layoutSave = () => { try { localStorage.setItem(layoutKey, JSON.stringify(layoutState)); } catch {} };

const layoutPanes = {
  chat: { sep: $("sepc"), el: $("chat"), button: $("fold-chat"), fold: "chatFolded", cls: "chat-folded", grow: (x) => x - $("chat").getBoundingClientRect().left, other: "right" },
  right: { sep: $("sepr"), el: $("right"), button: $("fold-right"), fold: "rightFolded", cls: "right-folded", grow: (x) => $("right").getBoundingClientRect().right - x, other: "chat" },
};

// Most a pane may take: everything except the Canvas minimum, the side list's current width, the other pane and the separators.
function layoutMax(name) {
  const o = layoutPanes[layoutPanes[name].other];
  const used = layoutOuterMargins + (layoutState[o.fold] ? 0 : layoutState[layoutPanes[name].other]) + 2 * layoutSeparatorWidth;
  return Math.max(layoutPaneMin, window.innerWidth - layoutCanvasMin - used);
}
const layoutClamp = (name, w) => Math.round(Math.min(layoutMax(name), Math.max(layoutPaneMin, w)));

function layoutApply() {
  for (const [name, p] of Object.entries(layoutPanes)) {
    document.body.classList.toggle(p.cls, layoutState[p.fold]);
    document.body.style.setProperty(`--${name}-w`, `${layoutState[name]}px`);
    p.button.setAttribute("aria-pressed", String(!layoutState[p.fold]));
    p.sep.setAttribute("aria-valuemin", String(layoutPaneMin));
    p.sep.setAttribute("aria-valuemax", String(Math.round(layoutMax(name))));
    p.sep.setAttribute("aria-valuenow", String(Math.round(layoutState[name])));
  }
}
// Selects a tab and makes sure the right slot is open to show it.
function rightShowTab(id) {
  layoutState.rightFolded = false;
  layoutApply();
  layoutSave();
  rightSelectTab(id);
}
function layoutSet(name, w) { layoutState[name] = layoutClamp(name, w); layoutApply(); layoutSave(); }

for (const [name, p] of Object.entries(layoutPanes)) {
  p.button.onclick = () => { layoutState[p.fold] = !layoutState[p.fold]; layoutApply(); layoutSave(); };
  p.sep.onpointerdown = (e) => {
    e.preventDefault();
    p.sep.setPointerCapture(e.pointerId);
    p.sep.classList.add("dragging");
  };
  p.sep.onpointermove = (e) => { if (p.sep.hasPointerCapture(e.pointerId)) layoutSet(name, p.grow(e.clientX)); };
  p.sep.onpointerup = p.sep.onpointercancel = () => p.sep.classList.remove("dragging");
  // Arrow keys move the edge: Right moves it right, so the chat grows and the right slot shrinks.
  p.sep.onkeydown = (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    layoutSet(name, layoutState[name] + layoutStep * dir * (name === "chat" ? 1 : -1));
  };
}

// A saved width may no longer fit (smaller window, other pane bigger): re-clamp what is stored, and keep the ARIA values honest.
const layoutReclamp = () => {
  for (const name of ["chat", "right"]) layoutState[name] = layoutClamp(name, layoutState[name]);
  layoutApply();
};
layoutReclamp();
window.addEventListener("resize", layoutApply);
