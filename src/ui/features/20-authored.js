// Authored layers: Business, Requirements and Architecture Nodes on the Canvas, Rationale in the right panel.
// The core validates and shapes everything; this file only draws what GET /authored returns.
const AUTHORED_LAYERS = [
  { key: "business", label: "Business", detail: (n) => n.block },
  { key: "requirements", label: "Requirements", detail: (n) => n.kind === "non-functional" ? n.statement : `As ${n.as}, I want ${n.want}` },
  { key: "architecture", label: "Architecture", detail: (n) => n.technology },
];
let authoredShown = "components"; // "components" is the derived view
let authoredData = null;
let authoredLayouts = {};

const authoredGroup = el("g", { id: "authored" });
const layerBar = document.createElement("div");
layerBar.id = "layers";
layerBar.setAttribute("role", "group"); // the buttons are toggles (aria-pressed), not tabs: they switch what the Canvas draws
layerBar.setAttribute("aria-label", "Layers");
const authoredErrors = document.createElement("div");
authoredErrors.id = "authored-errors";
authoredErrors.setAttribute("role", "alert");
document.querySelector("main").append(layerBar, authoredErrors);

// The card is 240 wide: a longer line is cut (notationClip), and the whole text stays available as the tooltip of the card.
const authoredShort = (t) => notationClip(t, 28);

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
  const parts = [h];
  if (n.kind) parts.push(Object.assign(document.createElement("p"), { className: "node-sub", textContent: `[${n.kind}]` }));
  if (n.description) parts.push(Object.assign(document.createElement("p"), { textContent: n.description }));
  parts.push(why);
  if (n.relations?.length) {
    const h3 = document.createElement("h2");
    h3.textContent = "Relations";
    const ul = document.createElement("ul");
    ul.replaceChildren(...n.relations.map((r) => Object.assign(document.createElement("li"), { textContent: `${r.label} → ${r.to}${r.technology ? ` [${r.technology}]` : ""}` })));
    parts.push(h3, ul);
  }
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
  AUTHORED_LAYERS.forEach(({ key }) => {
    const g = el("g", { "data-layer": key });
    if (key === "business" || key === "requirements") { // these layers draw themselves (46-business.js, 46-requirements.js)
      const draw = key === "business" ? drawBusiness : drawRequirements;
      draw(g, authoredData.layers[key].nodes, authoredLayouts[key], (n, card) => {
        authoredGroup.querySelectorAll(".selected").forEach((s) => s.classList.remove("selected"));
        card.classList.add("selected");
        showRationale(n);
      });
      authoredGroup.append(g);
      return;
    }
    authoredGroup.append(g); // architecture: drawn into it by 46-architecture.js (boundaries and relationships)
  });
  architectureRender();
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
  (await Promise.all(responses.map((r) => r.json()))).forEach((body, i) => { layouts[AUTHORED_LAYERS[i].key] = Object.assign(body.rects, { blocks: body.blocks }); if (AUTHORED_LAYERS[i].key === "architecture") architectureDrawing = body; });
  if (project !== current) return;
  architecturePreview = null; // refreshProposals brings it back when Proposals are pending
  authoredData = data;
  authoredLayouts = layouts;
  drawAuthored();
  showLayer(authoredShown);
};
showLayer("components");
