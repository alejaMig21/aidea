// Authored layers: Business, Requirements and Architecture Nodes on the Canvas, Rationale in the right panel.
// The core validates and shapes everything; this file only draws what GET /authored returns.
const AUTHORED_LAYERS = [
  { key: "business", label: "Business", detail: (n) => n.block },
  { key: "requirements", label: "Requirements", detail: (n) => `As ${n.as}, I want ${n.want}` },
  { key: "architecture", label: "Architecture", detail: (n) => n.technology },
];
let authoredShown = "components"; // "components" is the derived view
let authoredData = null;
let authoredLayouts = {};

const authoredStyle = document.createElement("style");
authoredStyle.textContent = `
  #layers { position: absolute; left: 0; right: 0; top: 0; height: 40px; padding: 0 12px; display: flex; align-items: flex-end; gap: 2px; background: var(--panel); border-bottom: 1px solid var(--line); z-index: 1; }
  #layers button { --tab: var(--derived); background: transparent; color: var(--text); border: 0; border-bottom: 3px solid color-mix(in srgb, var(--tab) 45%, transparent); border-radius: 6px 6px 0 0; }
  #layers :is([data-layer="business"], [data-layer="requirements"], [data-layer="architecture"]) { --tab: var(--authored); }
  #layers button[aria-pressed="true"] { border-bottom-color: var(--tab); background: color-mix(in srgb, var(--tab) 18%, transparent); font-weight: 600; }
  #layers button[disabled] { opacity: .55; cursor: default; }
  /* Visual order: authored tabs, then derived tabs; other controls (Zoom out) last. Features append buttons in any order. */
  #layers [data-layer="business"] { order: 1; } #layers [data-layer="requirements"] { order: 2; } #layers [data-layer="architecture"] { order: 3; }
  #layers [data-layer="components"] { order: 4; margin-left: 12px; } #layers [data-layer="algorithms"] { order: 5; } #layers [data-layer="code"] { order: 6; }
  #layers > :not([data-layer]) { order: 9; margin-left: auto; margin-bottom: 4px; }
  #authored-errors { position: absolute; left: 16px; top: 52px; max-width: 60%; color: var(--danger); font-size: 12px; }
  .anode { cursor: pointer; }
  .anode rect { fill: var(--class); }
  .anode.selected rect { stroke: var(--accent); stroke-width: 2; }
  .anode .sub { fill: var(--muted); font-size: 11px; }
  #panel dl { margin: 0; } #panel dt { color: var(--muted); font-size: 12px; margin-top: 8px; }
  #panel dd { margin: 0; } #panel li { display: block; }
`;
document.head.append(authoredStyle);

const authoredGroup = el("g", { id: "authored" });
const layerBar = document.createElement("div");
layerBar.id = "layers";
layerBar.setAttribute("role", "group"); // the buttons are toggles (aria-pressed), not tabs: they switch what the Canvas draws
layerBar.setAttribute("aria-label", "Layers");
const authoredErrors = document.createElement("div");
authoredErrors.id = "authored-errors";
authoredErrors.setAttribute("role", "alert");
document.querySelector("main").append(layerBar, authoredErrors);

function showRationale(n) {
  const h = document.createElement("h2");
  h.textContent = n.title;
  const why = document.createElement("p");
  why.textContent = n.rationale.why;
  const rejected = document.createElement("ul");
  rejected.replaceChildren(...n.rationale.rejected.map((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.option}: ${r.reason}`;
    return li;
  }));
  const parts = [h, why];
  if (rejected.children.length) {
    const h3 = document.createElement("h2");
    h3.textContent = "Rejected alternatives";
    parts.push(h3, rejected);
  }
  $("panel").replaceChildren(...parts);
}

function drawAuthored() {
  authoredGroup.replaceChildren();
  authoredErrors.replaceChildren();
  if (!authoredData) return;
  AUTHORED_LAYERS.forEach(({ key, detail }) => {
    const g = el("g", { "data-layer": key });
    authoredData.layers[key].nodes.forEach((n) => {
      // The core decides where each card sits.
      const { x, y, width, height } = authoredLayouts[key].find((r) => r.id === n.id);
      const node = el("g", { class: "anode", tabindex: 0, "data-node": n.id, "data-ref": n.id });
      node.append(
        el("rect", { x, y, width, height, rx: 6 }),
        el("text", { x: x + 10, y: y + 26 }, n.title),
        el("text", { x: x + 10, y: y + 47, class: "sub" }, detail(n) ?? ""),
      );
      const select = () => {
        authoredGroup.querySelectorAll(".selected").forEach((s) => s.classList.remove("selected"));
        node.classList.add("selected");
        showRationale(n);
      };
      node.addEventListener("click", select);
      node.addEventListener("keydown", (e) => { if (e.key === "Enter") select(); });
      g.append(node);
    });
    authoredGroup.append(g);
  });
  const all = [...authoredData.errors, ...AUTHORED_LAYERS.flatMap(({ key }) => authoredData.layers[key].errors)];
  authoredErrors.replaceChildren(...all.map((e) => {
    const d = document.createElement("div");
    d.textContent = `${e.file}: ${e.message}`;
    return d;
  }));
}

// One layer at a time: the derived view is everything on the Canvas except the authored group.
function showLayer(which) {
  authoredShown = which;
  const world = $("world");
  if (authoredGroup.parentNode !== world) world.append(authoredGroup);
  for (const child of world.children) {
    if (child !== authoredGroup) child.style.display = which === "components" ? "" : "none";
  }
  authoredGroup.style.display = which === "components" ? "none" : "";
  authoredGroup.querySelectorAll("[data-layer]").forEach((g) => { g.style.display = g.dataset.layer === which ? "" : "none"; });
  layerBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === which)));
  $("panel").replaceChildren();
}

layerBar.replaceChildren(...[{ key: "components", label: "Components" }, ...AUTHORED_LAYERS].map(({ key, label }) => {
  const b = document.createElement("button");
  b.textContent = label;
  b.dataset.layer = key;
  b.onclick = () => showLayer(key);
  return b;
}));
// "Code" has no view of its own: a Node's source opens in a box when it is selected on Components.
const codeTab = Object.assign(document.createElement("button"), { textContent: "Code", disabled: true, title: "Select a Node on Components to read its code" });
codeTab.dataset.layer = "code";
layerBar.append(codeTab);

// Each time a Project is drawn, fetch its authored files fresh and keep the chosen layer.
const drawDerived = draw;
draw = async (nodes) => {
  await drawDerived(nodes);
  const project = current;
  const id = encodeURIComponent(project);
  const data = await fetch(`/authored?project=${id}`).then((r) => (r.ok ? r.json() : null));
  const responses = await Promise.all(AUTHORED_LAYERS.map(({ key }) => fetch(`/layout?project=${id}&layer=${key}`)));
  if (project !== current || !data || responses.some((r) => !r.ok)) return;
  const layouts = {};
  (await Promise.all(responses.map((r) => r.json()))).forEach((body, i) => { layouts[AUTHORED_LAYERS[i].key] = body.rects; });
  if (project !== current) return;
  authoredData = data;
  authoredLayouts = layouts;
  drawAuthored();
  showLayer(authoredShown);
};
showLayer("components");
