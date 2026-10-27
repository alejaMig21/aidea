// Authored layers: Business, Requirements and Architecture Nodes on the Canvas, Rationale in the right panel.
// The core validates and shapes everything; this file only draws what GET /authored returns.
const AUTHORED_LAYERS = [
  { key: "business", label: "Business", detail: (n) => n.block },
  { key: "requirements", label: "Requirements", detail: (n) => `As ${n.as}, I want ${n.want}` },
  { key: "architecture", label: "Architecture", detail: (n) => n.technology },
];
let authoredShown = "code"; // "code" is the derived view
let authoredData = null;

const authoredStyle = document.createElement("style");
authoredStyle.textContent = `
  #layers { position: absolute; left: 16px; top: 12px; display: flex; gap: 4px; }
  #layers button { background: var(--panel); color: var(--text); border: 1px solid var(--line); }
  #layers button[aria-pressed="true"] { border-color: var(--accent); }
  #authored-errors { position: absolute; left: 16px; top: 48px; max-width: 60%; color: #c0392b; font-size: 12px; }
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
    authoredData.layers[key].nodes.forEach((n, i) => {
      const x = (i % 4) * 280, y = Math.floor(i / 4) * 80;
      const node = el("g", { class: "anode", tabindex: 0 });
      node.append(
        el("rect", { x, y, width: 240, height: 64, rx: 6 }),
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
    if (child !== authoredGroup) child.style.display = which === "code" ? "" : "none";
  }
  authoredGroup.style.display = which === "code" ? "none" : "";
  authoredGroup.querySelectorAll("[data-layer]").forEach((g) => { g.style.display = g.dataset.layer === which ? "" : "none"; });
  layerBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === which)));
  $("panel").replaceChildren();
}

layerBar.replaceChildren(...[{ key: "code", label: "Code" }, ...AUTHORED_LAYERS].map(({ key, label }) => {
  const b = document.createElement("button");
  b.textContent = label;
  b.dataset.layer = key;
  b.onclick = () => showLayer(key);
  return b;
}));

// Each time a Project is drawn, fetch its authored files fresh and keep the chosen layer.
const drawDerived = draw;
draw = (nodes) => {
  drawDerived(nodes);
  const project = current;
  fetch(`/authored?project=${encodeURIComponent(project)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (project !== current) return;
      authoredData = data;
      drawAuthored();
      showLayer(authoredShown);
    });
};
showLayer("code");
