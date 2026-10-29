// Requirements layer: functional stories with a checklist of acceptance criteria on the left, non-functional cards
// (quality tag and measure) on the right, and trace links drawn from each card, down its checklist, to what it points at:
// code for a functional requirement, Architecture for a non-functional one. The core decides where each card sits
// (layoutRequirements); card heights depend on the number of criteria, so the drawing only follows the rectangles it is given.
// This file loads after 45-notation.js because it registers its legend there.
const REQ_CHIP_X = 24, REQ_CHIP_W = 170, REQ_MAX_CHIPS = 3; // ponytail: only the first 3 trace targets of a requirement get a chip (the legend says so)
let requirementTraces = {}; // node id -> [{ to, broken }], from GET /traces

{
  const style = document.createElement("style");
  style.textContent = `
    .anode .req-box { fill: var(--bar); stroke: var(--control); }
    .anode .req-tag { fill: color-mix(in srgb, var(--authored) 14%, var(--bar)); stroke: color-mix(in srgb, var(--authored) 55%, transparent); }
    .req-kicker { fill: var(--muted); font: 600 10px var(--mono); letter-spacing: .1em; }
    .req-title { font-size: 14px; font-weight: 600; }
    .req-line { fill: var(--label); font-size: 12.5px; font-weight: 400; }
    .req-line .req-b { fill: var(--authored); font-weight: 600; }
    .req-crit { fill: var(--label); font: 400 11px var(--mono); }
    .req-tagtext { fill: var(--authored); font: 600 10.5px var(--mono); letter-spacing: .06em; }
    .req-measure { fill: var(--muted); font: 400 11px var(--mono); }
    .req-group { fill: var(--muted); font: 600 11px var(--mono); letter-spacing: .12em; }
    .req-edge { pointer-events: none; }
    .req-chip rect { fill: var(--raised); stroke: var(--derived); stroke-width: 1.2; }
    .req-chip.arch rect { stroke: var(--authored); }
    .req-chip.broken rect { stroke: var(--unresolved); stroke-dasharray: 5 4; }
    .req-chip text { fill: var(--label); font: 400 11.5px var(--mono); }
  `;
  document.head.append(style);
}

// "As a <as>, I want <want>" with the person's words in the authored colour, cut as a whole at `max` characters.
function reqStory(parts, max, x, y) {
  const t = el("text", { x, y, class: "req-line" });
  let left = max;
  for (const [text, bold] of parts) {
    if (left <= 0) break;
    t.append(el("tspan", bold ? { class: "req-b" } : {}, notationClip(text, left)));
    left -= text.length;
  }
  return t;
}

function reqCard(n, r) {
  const nfr = n.kind === "non-functional";
  const { x, y } = r;
  const g = el("g", { class: "anode req", tabindex: 0, "data-node": n.id, "data-ref": n.id });
  g.append(
    el("title", {}, nfr ? `${n.title}: ${n.statement} (${n.quality}; measure: ${n.measure})` : `${n.title}: As ${n.as}, I want ${n.want}, so that ${n.so}`),
    el("rect", { x, y, width: r.width, height: r.height, rx: 12 }),
    el("text", { x: x + 36, y: y + 22, class: "req-kicker" }, nfr ? "NON-FUNCTIONAL" : "USER STORY"),
    el("circle", { cx: x + 20, cy: y + 37, r: 4, class: "dot-authored" }),
    el("text", { x: x + 36, y: y + 42, class: "req-title" }, notationClip(n.title, 30)),
  );
  if (nfr) {
    g.append(
      el("text", { x: x + 36, y: y + 62, class: "req-line" }, notationClip(n.statement, 40)),
      el("rect", { x: x + 36, y: y + 70, width: n.quality.length * 7 + 18, height: 18, rx: 9, class: "req-tag" }),
      el("text", { x: x + 45, y: y + 83, class: "req-tagtext" }, n.quality.toUpperCase()),
      el("text", { x: x + 36, y: y + 104, class: "req-measure" }, notationClip(`Measure: ${n.measure}`, 38)),
    );
    return g;
  }
  g.append(
    reqStory([["As a ", 0], [n.as, 1], [", I want ", 0], [n.want, 1]], 40, x + 36, y + 62),
    reqStory([["so that ", 0], [n.so, 1]], 40, x + 36, y + 80),
  );
  (n.criteria ?? []).forEach((c, i) => {
    const top = y + 92 + 22 * i;
    g.append(
      el("rect", { x: x + 13, y: top + 1, width: 14, height: 14, rx: 4, class: "req-box" }),
      el("text", { x: x + 36, y: top + 13, class: "req-crit" }, notationClip(c, 38)),
    );
  });
  return g;
}

// The rail runs from the card's dot down past its criteria (the checkboxes), then out to each chip. Packets follow that path.
function reqTrace(n, r) {
  const nfr = n.kind === "non-functional";
  const railX = r.x + 20, railY = r.y + r.height - 8;
  const chipX = r.x + r.width + REQ_CHIP_X;
  const links = (requirementTraces[n.id] ?? (n.traces ?? []).map((to) => ({ to, broken: false }))).slice(0, REQ_MAX_CHIPS);
  return links.flatMap(({ to, broken }, i) => {
    const cy = railY - 30 * i;
    const edge = el("path", {
      class: "edge req-edge", "data-flow": "", "data-packets": 1, "data-tone": broken ? "unresolved" : nfr ? "authored" : "derived", "data-ends": `${n.id} ${to}`,
      d: `M${railX} ${r.y + 37}V${railY}H${chipX - 12}V${cy}H${chipX}`,
    });
    const chip = el("g", { class: `req-chip ${nfr ? "arch" : "code"}${broken ? " broken" : ""}`, "data-ref": to });
    chip.append(
      el("title", {}, `${nfr ? "Architecture" : "Code"}: ${to}${broken ? " (not found)" : ""}`),
      el("rect", { x: chipX, y: cy - 12, width: REQ_CHIP_W, height: 24, rx: 8 }),
      el("text", { x: chipX + 10, y: cy + 4 }, notationClip(to, 20)),
    );
    return [edge, chip];
  });
}

// Called by drawAuthored for the requirements layer: headings, cards, then the trace links over them.
function drawRequirements(g, nodes, rects, select) {
  const at = (n) => rects.find((r) => r.id === n.id);
  for (const [nonFunctional, text] of [[false, "FUNCTIONAL · what the system does"], [true, "NON-FUNCTIONAL · how well, within which limits"]]) {
    const first = nodes.find((n) => (n.kind === "non-functional") === nonFunctional);
    if (first) g.append(el("text", { x: at(first).x, y: -14, class: "req-group" }, text));
  }
  const cards = nodes.map((n) => {
    const card = reqCard(n, at(n));
    card.addEventListener("click", () => select(n, card));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") select(n, card); });
    return card;
  });
  g.append(...cards, ...nodes.flatMap((n) => reqTrace(n, at(n))));
}

// The right panel also lists what a card only shows in part.
const showRationaleWithoutRequirements = showRationale;
showRationale = (n) => {
  showRationaleWithoutRequirements(n);
  if (authoredShown !== "requirements") return;
  const heading = (text) => Object.assign(document.createElement("h2"), { textContent: text });
  const panel = $("panel");
  if (n.kind === "non-functional") {
    panel.append(heading(`Quality: ${n.quality}`), Object.assign(document.createElement("p"), { textContent: `${n.statement} Measure: ${n.measure}` }));
  } else if (n.criteria?.length) {
    const ul = document.createElement("ul");
    ul.replaceChildren(...n.criteria.map((c) => Object.assign(document.createElement("li"), { textContent: c })));
    panel.append(heading("Acceptance criteria"), ul);
  }
};

// Which trace links are broken is the core's to say: fetch them after each draw and redraw this layer when they change.
const drawWithoutRequirementTraces = draw;
draw = async (nodes) => {
  await drawWithoutRequirementTraces(nodes);
  const project = current;
  const res = await fetch(`/traces?project=${encodeURIComponent(project)}`);
  if (!res.ok || project !== current || !authoredData) return;
  const next = {};
  for (const l of (await res.json()).links) if (l.layer === "requirements") (next[l.from] ??= []).push({ to: l.to, broken: l.broken });
  if (JSON.stringify(next) === JSON.stringify(requirementTraces)) return;
  requirementTraces = next;
  drawAuthored();
  showLayer(authoredShown);
  markBroken(); // the redraw made new cards
};

notationRegisterLegend("requirements", {
  shapes: [
    [notationSwatch(`<rect x="4" y="3" width="36" height="18" rx="5" style="fill:var(--raised);stroke:var(--control)"/><rect x="9" y="7" width="26" height="3" rx="1" style="fill:var(--authored)"/>`), "Functional: a user story (As a, I want, so that) with its acceptance criteria"],
    [notationSwatch(`<rect x="4" y="4" width="14" height="14" rx="4" style="fill:var(--bar);stroke:var(--control)"/><rect x="22" y="9" width="18" height="4" rx="2" style="fill:var(--muted)"/>`), "A Given / When / Then criterion in the checklist"],
    [notationSwatch(`<rect x="4" y="3" width="36" height="18" rx="5" style="fill:var(--raised);stroke:var(--control)"/><rect x="9" y="12" width="22" height="6" rx="3" style="fill:var(--authored);opacity:.55"/>`), "Non-functional: a statement, its quality tag and how it is measured"],
    [notationSwatch(`<rect x="4" y="5" width="36" height="14" rx="5" style="fill:var(--raised);stroke:var(--derived)"/>`), "Trace chip: the code (teal) or the Architecture element (amber) the requirement points at; grey dashed when it is not found"],
  ],
  arrows: [[notationSwatch(`<path d="M2 12H36" style="stroke:var(--derived);stroke-width:1.6;stroke-dasharray:7 5"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:var(--derived);stroke-width:1.5"/>`), "Trace link: from the card, past its criteria, to its target; the dot travels that way"]],
  colours: [
    ["authored", "Amber: written by a person or the agent (the card's dot, the words of the story, the quality tag, a link to Architecture)"],
    ["derived", "Teal: found in the code (a link to code)"],
    ["unresolved", "Grey, dashed: a link whose target is not found, never moving"],
    ["danger", "Red outline on a card: a link from it is broken, or the code differs from what the Contract says"],
  ],
  notShown: ["Priority (no Must or Should labels)", "Story maps", "Whether each criterion passes", "More than three trace targets per requirement"],
});
