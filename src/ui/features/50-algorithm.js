// Algorithms layer: double-click a function on the Components layer to see its Algorithm graph;
// double-click a step to see its source text. The core builds and lays out the graph; this only draws it, in flowchart notation.
const algoStyle = document.createElement("style");
algoStyle.textContent = `
  .flow-edge { stroke: #4a546c; fill: none; stroke-width: 1.6; marker-end: url(#flow-arrow); }
  .flow-edge.exception { stroke: var(--danger); stroke-dasharray: 6 4; marker-end: url(#flow-arrow-red); opacity: .75; }
  .flow-edge.taken { stroke: var(--derived); opacity: 1; marker-end: url(#flow-arrow-teal); }
  .flow-edge.exception.taken { stroke: var(--danger); marker-end: url(#flow-arrow-red); }
  body:not(.motion-off) .flow-edge.exception.taken { animation: flow-flash .9s ease-out 2; } /* more specific than the kit's dash rule, so the flash wins; off with the motion switch */
  @media (prefers-reduced-motion: reduce) { .flow-edge.exception.taken { animation: none !important; } }
  @keyframes flow-flash { 0%, 100% { stroke-width: 1.6; } 30% { stroke-width: 5; filter: drop-shadow(0 0 6px var(--danger)); } }
  .flow-arrow-head { fill: #4a546c; }
  #flow-arrow-red .flow-arrow-head { fill: var(--danger); } #flow-arrow-teal .flow-arrow-head { fill: var(--derived); }
  .flow-label { fill: var(--muted); font-size: 11px; font-weight: 400; }
  .flow-label.exception { fill: var(--danger); font-family: var(--mono); }
  .flow-step { cursor: pointer; }
  .flow-step .sh { fill: var(--raised); stroke: var(--control); stroke-width: 1.4; }
  .flow-step text { font: 500 12.5px var(--mono); fill: var(--text); text-anchor: middle; pointer-events: none; }
  .flow-step text.tag { font: 500 9.5px var(--mono); fill: var(--muted); text-anchor: start; letter-spacing: .06em; text-transform: uppercase; }
  .flow-branch .sh, .flow-loop .sh { stroke: var(--label); stroke-width: 1.8; } /* structure, not "active now": accent is reserved for the token */
  .flow-raise .sh { fill: #ff8a8018; stroke: var(--danger); }
  .flow-step.generic .sh { stroke-dasharray: 3 3; }
  .flow-step.in-finally .sh { stroke-dasharray: 1 3; stroke-linecap: round; }
  .flow-step.c-except .sh { stroke: var(--danger); }
  .flow-step .inner { fill: none; stroke: var(--control); stroke-width: 1; pointer-events: none; }
  #algorithm.has-recording .flow-step:not(.visited):not(.now) { opacity: .4; }
  #algorithm .flow-step.visited .sh { stroke: var(--derived); }
  #algorithm .flow-step.now .sh { stroke: var(--accent); stroke-width: 2.4; fill: var(--proposal); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)); }
  .flow-token { fill: var(--accent); filter: drop-shadow(0 0 7px var(--accent)); pointer-events: none; }
  .flow-token.danger { fill: var(--danger); filter: drop-shadow(0 0 7px var(--danger)); }
`;
document.head.append(algoStyle);

// Arrow heads for the wires (grey, red for an exception, teal once taken during Playback)
const defs = el("defs", {});
for (const id of ["flow-arrow", "flow-arrow-red", "flow-arrow-teal"]) {
  const marker = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
  marker.append(el("path", { d: "M0 0 L10 5 L0 10 z", class: "flow-arrow-head" }));
  defs.append(marker);
}
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

// One symbol per step kind (flowchart notation): stadium = start, end, return, raise; diamond = if, match, case, loops;
// parallelogram = input and output; rectangle = process; pentagon = break and continue; double frame = with.
function flowShape(step, r) {
  const { x, y, width: w, height: h } = r, cx = x + w / 2, cy = y + h / 2, right = x + w, bottom = y + h;
  const sh = (tag, attrs) => el(tag, { class: "sh", ...attrs });
  if (["start", "end", "return", "raise"].includes(step.kind)) return [sh("rect", { x, y, width: w, height: h, rx: h / 2 })];
  if (step.kind === "branch" || step.kind === "loop") return [sh("polygon", { points: `${cx},${y} ${right},${cy} ${cx},${bottom} ${x},${cy}` })];
  if (step.io && step.kind === "step" && step.construct !== "with") return [sh("polygon", { points: `${x + 16},${y} ${right},${y} ${right - 16},${bottom} ${x},${bottom}` })];
  if (step.construct === "break" || step.construct === "continue") return [sh("polygon", { points: `${x},${y} ${right - 14},${y} ${right},${cy} ${right - 14},${bottom} ${x},${bottom}` })];
  const box = sh("rect", { x, y, width: w, height: h, rx: 5 });
  return step.construct === "with" ? [box, el("rect", { class: "inner", x: x + 4, y: y + 4, width: w - 8, height: h - 8, rx: 3 })] : [box];
}

function drawAlgorithm(graph) {
  const at = new Map(graph.rects.map((r) => [r.id, r]));
  const parts = [];
  // The core returns one route per edge (same order): a polyline of horizontal and vertical segments, and where the label goes.
  graph.routes.forEach((route, i) => {
    const exception = Boolean(graph.edges[i].exception);
    parts.push(el("path", {
      class: `flow-edge${exception ? " exception" : ""}`, id: `flow-edge-${i}`, "data-edge": i, "data-flow": "",
      "data-ends": `${route.from} ${route.to}`, d: "M" + route.points.map((p) => `${p.x} ${p.y}`).join(" L"),
    }));
    if (route.label) parts.push(el("text", { class: `flow-label${exception ? " exception" : ""}`, x: route.label.x, y: route.label.y }, route.label.text));
  });
  for (const step of graph.steps) {
    const r = at.get(step.id);
    const classes = ["flow-step", `flow-${step.kind}`, `flow-step-${step.kind}`, `c-${step.construct}`];
    if (step.generic) classes.push("generic");
    if (step.finally) classes.push("in-finally");
    const g = el("g", { class: classes.join(" "), "data-step": step.id, "data-node": step.id, tabindex: 0 });
    const tip = el("title", {}, `${step.generic ? step.construct + " (no flowchart symbol): " : ""}${step.reads.length ? "reads: " + step.reads.join(", ") : ""}${step.reads.length && step.writes.length ? " · " : ""}${step.writes.length ? "writes: " + step.writes.join(", ") : ""}`);
    const lines = step.lines ?? [step.label];
    const text = el("text", { x: r.x + r.width / 2, y: r.y + r.height / 2 - ((lines.length - 1) * 16) / 2 + 4.5 });
    lines.forEach((line, k) => text.append(el("tspan", { x: r.x + r.width / 2, dy: k ? 16 : 0 }, line)));
    g.append(tip, ...flowShape(step, r), text);
    const slanted = step.io && step.kind === "step" && step.construct !== "with";
    const own = step.generic ? step.construct : step.finally ? "finally" : step.construct === "with" ? "with" : "";
    const tag = step.io && !slanted ? `${own} ${step.io === "input" ? "input" : "output"}`.trim() : own; // a decision, loop, with or return that also touches the outside world says so
    if (tag) g.append(el("text", { class: "tag", x: r.x + 6, y: r.y - 4 }, tag));
    parts.push(g);
  }
  parts.push(el("circle", { class: "flow-token", id: "flow-token", r: 7, cx: 0, cy: 0, opacity: 0 }));
  algoGroup.replaceChildren(...parts);
}

// Playback: the token travels along the edge the recording really took from the previous step to this one; edges taken so far
// turn teal. The exception edge turns red (and flashes) only once it has been taken. Scrubbing, or a page with motion off, jumps.
let flowFrame = 0;
function flowEdgeBetween(graph, a, b) {
  const found = graph.edges.map((e, i) => [e, i]).filter(([e]) => e.from === a && e.to === b);
  if (found.length) return (found.find(([e]) => e.exception) ?? found[0])[1];
  // The exception edge leaves the `try` step, but the run raised inside its body: the handler is reached by that edge.
  return graph.edges.findIndex((e) => e.to === b && e.exception) >= 0 ? graph.edges.findIndex((e) => e.to === b && e.exception) : undefined;
}
function flowReplay(visits, index, previous) {
  const graph = algoGraph;
  const token = $("flow-token");
  if (!graph || !token) return;
  const taken = new Set();
  for (let k = 1; k <= index; k++) { const i = flowEdgeBetween(graph, visits[k - 1].step, visits[k].step); if (i !== undefined) taken.add(i); }
  algoGroup.querySelectorAll(".flow-edge").forEach((p) => p.classList.toggle("taken", taken.has(Number(p.dataset.edge))));
  const entry = visits[index], r = graph.rects.find((x) => x.id === entry?.step);
  if (!r) return;
  cancelAnimationFrame(flowFrame);
  const edgeIndex = index > 0 && index === previous + 1 ? flowEdgeBetween(graph, visits[index - 1].step, entry.step) : undefined;
  const path = edgeIndex === undefined ? null : $(`flow-edge-${edgeIndex}`);
  token.classList.toggle("danger", Boolean(graph.edges[edgeIndex]?.exception));
  const park = () => { token.setAttribute("cx", r.x + r.width / 2); token.setAttribute("cy", r.y + r.height / 2); token.setAttribute("opacity", 1); };
  if (!path || document.body.classList.contains("motion-off")) { park(); return; }
  const length = path.getTotalLength(), start = performance.now(), duration = 450;
  token.setAttribute("opacity", 1);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration), p = path.getPointAtLength(length * t);
    token.setAttribute("cx", p.x); token.setAttribute("cy", p.y);
    if (t < 1) flowFrame = requestAnimationFrame(tick); else park();
  };
  flowFrame = requestAnimationFrame(tick);
}

// The legend opened from the "?" button.
{
  const sw = (inner) => notationSwatch(`<g style="fill:var(--raised);stroke:var(--control);stroke-width:1.4">${inner}</g>`);
  const arrow = (colour, dash) => notationSwatch(`<path d="M2 12H36" style="stroke:${colour};stroke-width:1.6;${dash ? "stroke-dasharray:5 4" : ""}"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:${colour};stroke-width:1.5"/>`);
  notationRegisterLegend("algorithms", {
    shapes: [
      [sw(`<rect x="3" y="5" width="38" height="14" rx="7"/>`), "Rounded: start, end and return"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="7" style="stroke:var(--danger);fill:#ff8a8018"/>`), "Rounded, red: raise (the function stops with an error)"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3"/>`), "Rectangle: a step that does something"],
      [sw(`<polygon points="22,1 41,12 22,23 3,12" style="stroke:var(--accent)"/>`), "Diamond: a decision (if, match) or a loop test, with labelled exits"],
      [sw(`<polygon points="10,5 41,5 34,19 3,19"/>`), "Slanted: input or output (print, input, open, network and file calls)"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3"/><rect x="6" y="8" width="32" height="8" rx="2" style="fill:none"/>`), "Double frame: with"],
      [sw(`<polygon points="3,5 33,5 41,12 33,19 3,19"/>`), "Pointed: break or continue"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="stroke-dasharray:1 3"/>`), "Dotted, tagged finally: inside a finally block"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="stroke-dasharray:3 3"/>`), "Dashed, with its name above: a construct with no symbol (lambda, comprehension, pass...), shown as a generic step"],
    ],
    arrows: [
      [arrow("#4a546c"), "Control moves to the next step; the dashes flow in that direction"],
      [notationSwatch(`<path d="M30 20H40V6H8" style="fill:none;stroke:#4a546c;stroke-width:1.6"/><path d="M12 1L5 6L12 11" style="fill:none;stroke:#4a546c;stroke-width:1.5"/>`), "Arrow going back up: the loop repeats"],
      [arrow("var(--danger)", true), "Red dashed, labelled with an exception type: control goes to that handler"],
      [notationSwatch(`<circle cx="22" cy="12" r="7" style="fill:var(--accent)"/>`), "Playback token: it travels the edges the real run took; the active step glows, visited steps turn teal"],
    ],
    notShown: ["Data flow between steps (the panel lists the values)", "async and await, and generators", "Comprehensions and lambdas as flows of their own (one generic step each)", "Nested functions (one step; open their own graph)", "Exceptions raised outside a try (only try/except is drawn)"],
  });
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
