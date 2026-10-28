// Pattern groups on the Architecture layer: a labelled boundary around the member Nodes, the role written on each member, and
// each violation the core found (GET /patterns) drawn as a dashed arrow between the two Nodes: red when certain, grey with "?" when only possible.
// The core decides what is a violation; this file only draws. Arrows are static: nothing here moves.
let patternViolations = [];

{
  const style = document.createElement("style");
  style.textContent = `
    .pattern-boundary { fill: none; stroke: var(--authored); stroke-width: 1.2; stroke-dasharray: 2 5; stroke-linecap: round; pointer-events: none; }
    .pattern-title { fill: var(--authored); font: 600 11.5px var(--mono); pointer-events: none; }
    .pattern-role { fill: var(--authored); font: 600 10.5px var(--mono); pointer-events: none; }
    .pattern-violation line { stroke: var(--danger); stroke-width: 2.2; stroke-dasharray: 7 5; }
    .pattern-violation path { fill: var(--danger); }
    .pattern-violation.possible line { stroke: var(--unresolved); }
    .pattern-violation.possible path { fill: var(--unresolved); }
    .pattern-violation .hit { stroke: transparent; stroke-width: 14; stroke-dasharray: none; pointer-events: stroke; }
    .pattern-violation text { fill: var(--danger); font: 700 14px var(--mono); paint-order: stroke; stroke: var(--canvas); stroke-width: 4px; }
    .pattern-violation.possible text { fill: var(--muted); }
  `;
  document.head.append(style);
}

{
  const legend = notationLegends.architecture;
  notationRegisterLegend("architecture", {
    ...legend,
    shapes: [
      ...legend.shapes,
      [notationSwatch(`<rect x="3" y="3" width="38" height="18" rx="4" style="fill:none;stroke:var(--authored);stroke-dasharray:2 4"/>`), "Pattern group: a dotted boundary around Nodes that realise one pattern (for example hexagonal); each member is tagged with its role"],
    ],
    arrows: [
      ...legend.arrows,
      [notationSwatch(`<path d="M2 12H34" style="stroke:var(--danger);stroke-width:2;stroke-dasharray:6 4"/><path d="M42 12L33 7.5V16.5Z" style="fill:var(--danger)"/>`), "Red dashed arrow: the code breaks the pattern's rule (for example the domain depends on infrastructure). Hover for the rule and the evidence"],
      [notationSwatch(`<path d="M2 12H34" style="stroke:var(--unresolved);stroke-width:2;stroke-dasharray:6 4"/><path d="M42 12L33 7.5V16.5Z" style="fill:var(--unresolved)"/>`), "Grey dashed arrow with ?: the analysis could only guess (matched by name), so the violation is possible, not certain"],
    ],
    notShown: [...legend.notShown, "Rules of a pattern other than the ones in its kind (hexagonal: domain never depends on adapters or infrastructure; layered: lower layers never depend on upper ones)"],
  });
}

// Where the line from the centre of `a` towards the centre of `b` leaves `a`.
function patternEdge(a, b) {
  const [ax, ay, bx, by] = [a.x + a.width / 2, a.y + a.height / 2, b.x + b.width / 2, b.y + b.height / 2];
  const [dx, dy] = [bx - ax, by - ay];
  const t = Math.min(dx ? a.width / 2 / Math.abs(dx) : Infinity, dy ? a.height / 2 / Math.abs(dy) : Infinity);
  return { x: ax + dx * t, y: ay + dy * t };
}

function patternsDraw() {
  const g = authoredGroup.querySelector('[data-layer="architecture"]');
  const drawing = architecturePreview ?? architectureDrawing;
  g?.querySelectorAll(".pattern-under, .pattern-over").forEach((x) => x.remove());
  const groups = authoredData?.layers.architecture.patterns ?? [];
  if (!g || !drawing || !groups.length) return;
  const rects = new Map(drawing.rects.map((r) => [r.id, r]));
  const under = el("g", { class: "pattern-under" }), over = el("g", { class: "pattern-over" });
  for (const group of groups) {
    const members = group.roles.map((r) => ({ ...r, rect: rects.get(r.node) })).filter((m) => m.rect);
    if (!members.length) continue;
    const x1 = Math.min(...members.map((m) => m.rect.x)) - 20, y1 = Math.min(...members.map((m) => m.rect.y)) - 46;
    const x2 = Math.max(...members.map((m) => m.rect.x + m.rect.width)) + 20, y2 = Math.max(...members.map((m) => m.rect.y + m.rect.height)) + 20;
    // ponytail: one box around all members; it can also cover a Node that is not in the group. Draw per-member hulls if that confuses.
    under.append(
      el("rect", { class: "pattern-boundary", "data-pattern": group.id, x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 14 }),
      el("text", { class: "pattern-title", x: x1 + 12, y: y1 + 17 }, `${group.name} [${group.kind}]`),
    );
    for (const m of members) under.append(el("text", { class: "pattern-role", x: m.rect.x + m.rect.width - 8, y: m.rect.y - 7, "text-anchor": "end" }, `«${m.role}»`));
  }
  for (const v of patternViolations) {
    const [a, b] = [rects.get(v.from.node), rects.get(v.to.node)];
    if (!a || !b) continue;
    const p = patternEdge(a, b), q = patternEdge(b, a);
    const [ux, uy] = [q.x - p.x, q.y - p.y], len = Math.hypot(ux, uy) || 1, [nx, ny] = [ux / len, uy / len];
    const possible = v.certainty === "possible";
    const e = v.evidence[0];
    const tip = `${possible ? "Possible violation" : "Violation"}: ${v.rule}\n${v.from.node} (${v.from.role}) -> ${v.to.node} (${v.to.role})\n${e.kind} ${e.from} -> ${e.to} at line ${e.line}, ${e.resolution}${v.evidence.length > 1 ? ` (+${v.evidence.length - 1} more)` : ""}`;
    const arrow = el("g", { class: `pattern-violation${possible ? " possible" : ""}`, "data-violation": `${v.from.node}>${v.to.node}`, tabindex: 0 });
    arrow.append(
      el("title", {}, tip),
      el("line", { x1: p.x, y1: p.y, x2: q.x - nx * 8, y2: q.y - ny * 8 }),
      el("line", { class: "hit", x1: p.x, y1: p.y, x2: q.x, y2: q.y }),
      el("path", { d: `M${q.x} ${q.y}L${q.x - nx * 11 - ny * 5} ${q.y - ny * 11 + nx * 5}L${q.x - nx * 11 + ny * 5} ${q.y - ny * 11 - nx * 5}Z` }),
    );
    if (possible) arrow.append(el("text", { x: (p.x + q.x) / 2 + 6, y: (p.y + q.y) / 2 - 6 }, "?"));
    over.append(arrow);
  }
  g.prepend(under);
  g.append(over);
}

const architectureRenderWithoutPatterns = architectureRender;
architectureRender = () => { architectureRenderWithoutPatterns(); patternsDraw(); };

async function patternsRefresh() {
  const project = current;
  const body = project ? await fetch(`/patterns?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  if (project !== current) return;
  patternViolations = body?.violations ?? [];
  patternsDraw();
}
const drawWithoutPatterns = draw;
draw = async (nodes) => { await drawWithoutPatterns(nodes); await patternsRefresh(); };
