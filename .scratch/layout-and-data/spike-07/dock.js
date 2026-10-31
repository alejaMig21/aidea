// dockview-core prototype. Throwaway. Works on the declared PANELS registry (id, title, min).
import { PANELS, makeContent } from "./content.js";
const dv = window["dockview-core"];
const ids = Object.keys(PANELS), contents = Object.fromEntries(ids.map((id) => [id, makeContent(id)]));
const api = dv.createDockview(document.getElementById("app"), {
  theme: { ...dv.themeAbyssSpaced, name: "aidea", className: "dockview-theme-aidea", gap: 8 },
  defaultRenderer: "always", // keep hidden tabs mounted, as the app's cards are today
  createComponent: ({ name }) => ({ element: contents[name], init() {} }),
});
const W = { builder: 380, files: 200, code: 240, canvas: 800, run: 240, tutor: 540 };
ids.forEach((id, i) => api.addPanel({ id, component: id, title: PANELS[id].title, minimumWidth: PANELS[id].min[0], minimumHeight: PANELS[id].min[1],
  ...(i ? { position: { referencePanel: ids[i - 1], direction: "right" } } : {}) }));
const scale = (api.width || document.getElementById("app").clientWidth) / Object.values(W).reduce((a, b) => a + b, 0);
ids.forEach((id) => api.getPanel(id).api.setSize({ width: Math.round(W[id] * scale) }));

const groupEl = (id) => api.getPanel(id).group.element;
window.spike = {
  engine: "dockview", groupSel: ".dv-groupview", sashSel: ".dv-sash",
  json: () => JSON.parse(JSON.stringify(api.toJSON())),
  restore: (j) => api.fromJSON(j),
  panelRect: (id) => contents[id].getBoundingClientRect().toJSON(),
  groupRect: (id) => groupEl(id).getBoundingClientRect().toJSON(),
  tabPoint: (id) => { const t = [...groupEl(id).querySelectorAll(".dv-tab")].find((e) => e.textContent.trim() === PANELS[id].title); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  visible: (id) => contents[id].offsetParent !== null,
  previewShown: () => [...document.querySelectorAll(".dv-drop-target-selection, .dv-drop-target-anchor")].some((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).display !== "none"; }),
  api,
};
