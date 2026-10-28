// Algorithms layer: double-click a function on the Components layer to see its Algorithm graph;
// double-click a step to see its source text. The core builds and lays out the graph; this only draws it.
const algoStyle = document.createElement("style");
algoStyle.textContent = `
  .flow-edge { stroke: #4a546c; fill: none; marker-end: url(#flow-arrow); }
  .flow-arrow-head { fill: #4a546c; }
  .flow-label { fill: var(--muted); font-size: 11px; font-weight: 400; }
  .flow-step { cursor: pointer; }
  .flow-step text { font: 500 12.5px var(--mono); }
  .flow-branch rect, .flow-loop rect { stroke: var(--accent); }
`;
document.head.append(algoStyle);

// Arrow heads for the wires
const defs = el("defs", {});
defs.append(el("marker", { id: "flow-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }));
defs.firstChild.append(el("path", { d: "M0 0 L10 5 L0 10 z", class: "flow-arrow-head" }));
svg.prepend(defs);

const algoGroup = el("g", { id: "algorithm" });
const algoTab = document.createElement("button");
algoTab.textContent = "Algorithms";
algoTab.dataset.layer = "algorithms";
algoTab.disabled = true;
algoTab.onclick = () => showLayer("algorithms");
layerBar.append(algoTab);

// This view is one more layer: shown only when asked for, hidden by every other layer.
const showLayerWithoutAlgorithms = showLayer;
showLayer = (which) => {
  showLayerWithoutAlgorithms(which);
  if (algoGroup.parentNode !== $("world")) $("world").append(algoGroup);
  algoGroup.style.display = which === "algorithms" ? "" : "none";
};

function drawAlgorithm(graph) {
  const at = new Map(graph.rects.map((r) => [r.id, r]));
  const parts = [];
  // The core returns one route per edge (same order): a polyline of horizontal and vertical segments, and where the label goes.
  for (const route of graph.routes) {
    parts.push(el("path", { class: "flow-edge", d: "M" + route.points.map((p) => `${p.x} ${p.y}`).join(" L") }));
    if (route.label) parts.push(el("text", { class: "flow-label", x: route.label.x, y: route.label.y }, route.label.text));
  }
  for (const step of graph.steps) {
    const r = at.get(step.id);
    const g = el("g", { class: `flow-step flow-${step.kind} flow-step-${step.kind}`, "data-step": step.id, tabindex: 0 });
    const tip = el("title", {}, `${step.reads.length ? "reads: " + step.reads.join(", ") : ""}${step.reads.length && step.writes.length ? " · " : ""}${step.writes.length ? "writes: " + step.writes.join(", ") : ""}`);
    g.append(tip, el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: step.kind === "step" ? 6 : 18 }), el("text", { x: r.x + 14, y: r.y + 27 }, step.label));
    parts.push(g);
  }
  algoGroup.replaceChildren(...parts);
}

let algoNodes = [];
let algoGraph = null;
let algoRequest = 0; // numbers the requests so a slow answer cannot replace a newer one
const drawWithoutAlgorithms = draw;
draw = async (nodes) => {
  algoNodes = nodes;
  algoGraph = null;
  algoTab.disabled = true;
  algoGroup.replaceChildren();
  await drawWithoutAlgorithms(nodes);
};

svg.addEventListener("dblclick", async (e) => {
  const project = current;
  // A function on the Components layer opens its Algorithm graph.
  const id = authoredShown === "components" ? e.target.getAttribute?.("data-id") : null;
  if (id && algoNodes.find((n) => n.id === id)?.kind === "function") {
    const request = ++algoRequest;
    const res = await fetch(`/algorithm?project=${encodeURIComponent(project)}&node=${encodeURIComponent(id)}`);
    const body = await res.json();
    if (project !== current || request !== algoRequest) return; // another Project or function was opened meanwhile
    $("error").textContent = res.ok ? "" : body.error;
    if (!res.ok) return;
    algoGraph = body;
    codeBox.hidden = true; // the first click of the double-click opened the function's source over the graph
    drawAlgorithm(body);
    algoTab.disabled = false;
    algoTab.textContent = `Algorithm: ${id.split(".").pop()}`;
    document.dispatchEvent(new CustomEvent("algorithm-opened", { detail: body }));
    showLayer("algorithms");
    fit(body.frame, 1); // a flow graph is never blown up past its natural size
    return;
  }
  // A step of the graph opens its source text.
  const step = e.target.closest?.("[data-step]");
  if (step && algoGraph) {
    const s = algoGraph.steps.find((x) => x.id === step.dataset.step);
    showCodeBox(`${algoGraph.file}:${s.line}${s.endLine > s.line ? "-" + s.endLine : ""}`, s.text);
  }
});
