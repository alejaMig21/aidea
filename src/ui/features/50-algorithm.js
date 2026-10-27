// Algorithms layer: double-click a function on the Components layer to see its Algorithm graph;
// double-click a step to see its source text. The core builds and lays out the graph; this only draws it.
const algoStyle = document.createElement("style");
algoStyle.textContent = `
  .flow-edge { stroke: var(--muted); fill: none; marker-end: url(#flow-arrow); }
  .flow-label { fill: var(--muted); font-size: 11px; }
  .flow-step { cursor: pointer; }
  .flow-step rect { stroke-width: 1.5; }
  .flow-start rect, .flow-end rect, .flow-return rect, .flow-raise rect { fill: var(--module); }
  .flow-branch rect, .flow-loop rect { fill: var(--class); stroke: var(--accent); }
  .flow-step.flow-step-step rect { fill: var(--function); }
  .flow-end text, .flow-start text { font-weight: 600; }
`;
document.head.append(algoStyle);

// Arrow heads for the wires
const defs = el("defs", {});
defs.append(el("marker", { id: "flow-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }));
defs.firstChild.append(el("path", { d: "M0 0 L10 5 L0 10 z", fill: "context-stroke" }));
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
  for (const e of graph.edges) {
    const from = at.get(e.from), to = at.get(e.to);
    // A way back leaves from the right side of a step and re-enters the right side of an earlier one.
    const d = e.back
      ? `M${from.x + from.width} ${from.y + from.height / 2} C${from.x + from.width + 70} ${from.y + from.height / 2}, ${to.x + to.width + 70} ${to.y + to.height / 2}, ${to.x + to.width} ${to.y + to.height / 2}`
      : `M${from.x + from.width / 2} ${from.y + from.height} L${to.x + to.width / 2} ${to.y}`;
    parts.push(el("path", { class: "flow-edge", d }));
    if (e.label) {
      const x = e.back ? from.x + from.width + 40 : (from.x + to.x) / 2 + from.width / 2 + 6;
      const y = e.back ? (from.y + to.y) / 2 + from.height / 2 : (from.y + from.height + to.y) / 2;
      parts.push(el("text", { class: "flow-label", x, y }, e.label));
    }
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
    const res = await fetch(`/algorithm?project=${encodeURIComponent(project)}&node=${encodeURIComponent(id)}`);
    const body = await res.json();
    if (project !== current) return; // another Project was opened meanwhile: this answer is stale
    $("error").textContent = res.ok ? "" : body.error;
    if (!res.ok) return;
    algoGraph = body;
    codeBox.hidden = true; // the first click of the double-click opened the function's source over the graph
    drawAlgorithm(body);
    algoTab.disabled = false;
    algoTab.textContent = `Algorithm: ${id.split(".").pop()}`;
    showLayer("algorithms");
    fit(body.frame);
    return;
  }
  // A step of the graph opens its source text.
  const step = e.target.closest?.("[data-step]");
  if (step && algoGraph) {
    const s = algoGraph.steps.find((x) => x.id === step.dataset.step);
    showCodeBox(`${algoGraph.file}:${s.line}${s.endLine > s.line ? "-" + s.endLine : ""}`, s.text);
  }
});
