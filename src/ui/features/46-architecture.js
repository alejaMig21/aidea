// The Architecture layer drawn C4-style: dashed boundaries around what they contain, boxes with name, [kind: technology]
// and description, one-way labelled arrows with packets. The core decides every position and route (GET /layout, and
// the preview in GET /proposals while Proposals are pending); this file only draws them.
// Called from drawAuthored (20-authored.js) and drawProposals (70-proposals.js).
let architectureDrawing = null; // the layer as it is in the files
let architecturePreview = null; // the layer with every pending Proposal applied, when any is pending

{
  const style = document.createElement("style");
  style.textContent = `
    .anode.arch-boundary rect { fill: none; stroke: #4b5365; stroke-width: 1.5; stroke-dasharray: 8 6; }
    .anode.arch-boundary.selected rect { stroke: var(--accent); }
    .anode.arch-boundary .arch-title { fill: var(--muted); font: 400 12px var(--mono); }
    .anode.arch-external rect { fill: var(--panel); stroke: #4b5365; stroke-dasharray: 6 4; }
    .arch-name { font: 600 14px var(--sans); fill: var(--text); }
    .arch-sub { fill: var(--muted); font: 400 11px var(--mono); }
    .arch-desc { fill: var(--label); font: 400 11.5px var(--sans); }
    .arch-person { fill: none; stroke: var(--authored); stroke-width: 1.6; }
    .arch-label { fill: var(--label); font: 400 11.5px var(--sans); paint-order: stroke; stroke: var(--canvas); stroke-width: 4px; stroke-linejoin: round; }
    .arch-label.tech { fill: var(--muted); font: 400 10.5px var(--mono); }
    path.edge.arch-head { fill: #4a546c; stroke-linejoin: round; stroke-width: 1; }
    svg#canvas.nt-hl path.edge.arch-head.nt-lit { fill: var(--accent-soft); stroke-width: 1; }
    svg#canvas:not([data-shown="components"]) #world > .nt-packet { display: none; } /* packets of the derived edges are made after the layer was chosen */
  `;
  document.head.append(style);
}
const showLayerWithoutArchitecture = showLayer;
showLayer = (which) => { showLayerWithoutArchitecture(which); svg.dataset.shown = which; };

notationRegisterLegend("architecture", {
  shapes: [
    [notationSwatch(`<circle cx="22" cy="7" r="4" style="fill:none;stroke:var(--authored)"/><path d="M13 21q0-9 9-9q9 0 9 9z" style="fill:none;stroke:var(--authored)"/>`), "Person: someone who uses the system"],
    [notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:var(--raised);stroke:var(--control)"/><circle cx="10" cy="9" r="2" style="fill:var(--authored)"/>`), "Container: something that runs. Name, [kind: technology], one line"],
    [notationSwatch(`<rect x="3" y="3" width="38" height="18" rx="4" style="fill:none;stroke:#4b5365;stroke-dasharray:5 3"/>`), "Dashed boundary: what it encloses is part of it. Boundaries are a convention of C4 tooling, not required by the C4 authors"],
    [notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:var(--panel);stroke:#4b5365;stroke-dasharray:4 3"/>`), "External person or system (marked external), outside the boundary"],
    [notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:var(--proposal);stroke:var(--accent);stroke-dasharray:4 3"/>`), "Proposal: suggested by the agent, not accepted yet"],
  ],
  arrows: [[notationSwatch(`<path d="M2 12H34" style="stroke:#4a546c;stroke-width:1.6;stroke-dasharray:7 5"/><path d="M42 12L33 7.5V16.5Z" style="fill:#4a546c"/>`), "One-way relationship with a verb and the technology; dashes flow and a dot travels in its direction"]],
  notShown: ["Dynamic scenarios and numbered steps", "Deployment (servers, regions)", "C4 levels as separate diagrams: one Canvas holds them all, nested"],
});

const architectureLine = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");
function architectureHead(points) {
  const a = points[points.length - 2], b = points[points.length - 1];
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  return `M${b.x} ${b.y}L${b.x - dx * 9 - dy * 4.5} ${b.y - dy * 9 + dx * 4.5}L${b.x - dx * 9 + dy * 4.5} ${b.y - dy * 9 - dx * 4.5}Z`;
}

// Rebuilds the whole Architecture layer from the core's drawing; pending Proposals are drawn where the preview puts them.
function architectureRender() {
  const g = authoredGroup.querySelector('[data-layer="architecture"]');
  const drawing = architecturePreview ?? architectureDrawing;
  if (!g || !drawing || !authoredData) return;
  g.replaceChildren();
  const committed = authoredData.layers.architecture.nodes;
  const adds = new Map((typeof pendingProposals === "undefined" ? [] : pendingProposals).filter((p) => p.layer === "architecture" && p.kind === "add").map((p) => [p.nodeId, p]));
  const known = new Set(committed.flatMap((n) => (n.relations ?? []).map((r) => `${n.id}>${r.to}>${r.label}`)));
  const byId = new Map(committed.map((n) => [n.id, n]));
  const boxes = new Set(drawing.groups.map((b) => b.id));

  // Boundaries first, then arrows, then boxes, so a box is never hidden by a line.
  const select = (node, n) => () => {
    authoredGroup.querySelectorAll(".selected").forEach((s) => s.classList.remove("selected"));
    node.classList.add("selected");
    showRationale(n);
  };
  const tile = (r, extra = "") => {
    const n = byId.get(r.id) ?? adds.get(r.id)?.node;
    const t = drawing.texts[r.id];
    const proposal = adds.get(r.id);
    const person = n.kind === "person", external = n.external === true && !boxes.has(r.id);
    const node = el("g", { class: `anode ${extra}${external ? " arch-external" : ""}${proposal ? " proposal add" : ""}`, tabindex: 0, "data-node": r.id, "data-ref": r.id, ...(proposal ? { "data-breathe": "", "data-proposal": proposal.id } : {}) });
    node.append(el("title", {}, `${n.title}: ${n.description ?? n.technology}`), el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: boxes.has(r.id) ? 16 : 12 }));
    if (boxes.has(r.id)) node.append(el("text", { x: r.x + 16, y: r.y + r.height - 10, class: "arch-title" }, t.title)); // at the bottom, as C4 tools do: arrows enter from above
    else {
      const cx = r.x + r.width / 2, off = person ? 40 : 0, lead = person || external ? 14 : 29;
      if (person) node.append(el("circle", { cx, cy: r.y + 18, r: 8, class: "arch-person" }), el("path", { d: `M${cx - 14} ${r.y + 40}q0-14 14-14q14 0 14 14z`, class: "arch-person" }));
      else if (!external) node.append(el("circle", { cx: r.x + 17, cy: r.y + 26, r: 4.5, class: proposal ? "" : "dot-authored", style: proposal ? "fill:var(--accent)" : "" }));
      const at = (dx, y, cls, text) => el("text", person ? { x: cx, y: r.y + y, class: cls, "text-anchor": "middle" } : { x: r.x + dx, y: r.y + y, class: cls }, text);
      node.append(at(lead, 30 + off, "arch-name", t.title), at(14, 50 + off, "arch-sub", t.sub));
      t.lines.forEach((line, i) => node.append(at(14, 73 + off + i * 15, "arch-desc", line)));
      if (proposal) node.append(el("text", { x: r.x + r.width - 14, y: r.y + 26, class: "tag" }, proposal.status === "waiting-for-class" ? "WAITING" : "PROPOSAL"));
    }
    if (proposal) { node.addEventListener("click", () => showProposal(proposal)); node.addEventListener("keydown", (e) => { if (e.key === "Enter") showProposal(proposal); }); }
    else { node.addEventListener("click", select(node, n)); node.addEventListener("keydown", (e) => { if (e.key === "Enter") select(node, n)(); }); }
    return node;
  };

  const rectOf = new Map(drawing.rects.map((r) => [r.id, r]));
  for (const b of drawing.groups) if (byId.has(b.id) || adds.has(b.id)) g.append(tile(b, "arch-boundary"));
  for (const route of drawing.routes) {
    const isNew = !known.has(`${route.from}>${route.to}>${route.label?.text}`);
    const cls = isNew ? "edge proposal-edge" : "edge";
    const tone = isNew ? { "data-tone": "accent" } : {};
    g.append(
      el("path", { class: cls, "data-flow": "", "data-packets": 1, "data-ends": `${route.from} ${route.to}`, d: architectureLine(route.points), ...tone }),
      el("path", { class: `${cls} arch-head`, "data-ends": `${route.from} ${route.to}`, d: architectureHead(route.points) }),
    );
    if (route.label) {
      g.append(el("text", { x: route.label.x, y: route.label.y, class: "arch-label" }, route.label.text));
      if (route.technology) g.append(el("text", { x: route.label.x, y: route.label.y + 13, class: "arch-label tech" }, `[${route.technology}]`));
    }
  }
  for (const r of drawing.rects) if (!boxes.has(r.id) && rectOf.has(r.id) && (byId.has(r.id) || adds.has(r.id))) g.append(tile(r));
  markBroken(); // the tiles are new
}
