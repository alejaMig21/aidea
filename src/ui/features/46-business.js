// Business layer: the nine-block canvas with sticky notes. The core says where every block and note sits (GET /layout);
// this draws them, the two illustrative flows (value out to the customers, money back to revenue) and the credit line.
// Loaded after the notation kit so its legend replaces the generic one; drawAuthored (20-authored.js) calls drawBusiness.
const BUSINESS_BLOCKS = {
  "key partnerships": "Key Partners", "key activities": "Key Activities", "key resources": "Key Resources",
  "value propositions": "Value Propositions", "customer relationships": "Customer Relationships", channels: "Channels",
  "customer segments": "Customer Segments", "cost structure": "Cost Structure", "revenue streams": "Revenue Streams",
};
const BUSINESS_CREDIT = "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0/). Layout adapted for aidea.";

{
  const style = document.createElement("style");
  style.textContent = `
    .bblock rect { fill: var(--raised); stroke: var(--control); }
    .bblock .btitle { fill: var(--authored); font: 600 12.5px var(--sans); }
    .bblock .bnum circle { fill: var(--selected); stroke: none; } .bblock .bnum text { fill: var(--muted); font: 700 11px var(--mono); text-anchor: middle; }
    .bflow { fill: none; stroke-width: 2; } .bflow-head { stroke: none; fill: var(--tone); }
    .bnote { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform .18s ease, filter .18s ease; filter: drop-shadow(0 2px 0 #0006); }
    .bnote rect { fill: #f2b45a22; stroke: #f2b45a66; transition: fill .18s ease, stroke .18s ease; }
    .bnote text { fill: #ffe0ae; font: 12.5px var(--sans); pointer-events: none; }
    .bnote:is(:hover, :focus-visible) { transform: rotate(var(--tilt, 1.2deg)) translateY(-2px); filter: drop-shadow(0 6px 10px #0008); }
    .bnote:is(:hover, :focus-visible) rect { fill: #41392f; stroke: #f2b45a99; }
    .bnote.selected rect { stroke: var(--accent); stroke-width: 1.5; }
    @media (prefers-reduced-motion: reduce) { .bnote:is(:hover, :focus-visible) { transform: none; } }
    body.motion-off .bnote:is(:hover, :focus-visible) { transform: none; }
    #business-credit { position: absolute; left: 15px; bottom: 15px; z-index: 1; max-width: calc(100% - 210px); font-size: 11.5px; color: var(--muted); }
  `;
  document.head.append(style);
}

const businessCredit = Object.assign(document.createElement("p"), { id: "business-credit", textContent: BUSINESS_CREDIT, hidden: true });
businessCredit.style.margin = "0";
document.querySelector("main").append(businessCredit);

// Two short lines at most; the whole title stays available as the tooltip.
function businessWrap(text, max = 30) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (!lines[last] || (lines[last] + " " + word).length <= max) lines[last] = (lines[last] + " " + word).trim();
    else if (last === 0) lines.push(word);
    else lines[last] += " " + word;
  }
  const last = lines.length - 1;
  if (lines[last].length > max) lines[last] = lines[last].slice(0, max - 1) + "…";
  return lines;
}

// A note tilts by an angle that shrinks with its width, so its ends move about 3 px at most and stay inside the gap to its neighbours.
const businessTilt = (width, index) => `${(index % 2 ? 1 : -1) * Math.min(1.8, (Math.atan(3 / (width / 2)) * 180) / Math.PI)}deg`;

function drawBusiness(g, nodes, layout, select) {
  const blocks = layout.blocks ?? [];
  const at = Object.fromEntries(blocks.map((b) => [b.id, b]));
  blocks.forEach((b, i) => {
    const card = el("g", { class: "bblock", tabindex: 0, "data-id": b.id, "data-ref": b.id });
    card.append(
      el("rect", { x: b.x, y: b.y, width: b.width, height: b.height, rx: 12, "data-tone": "authored", "data-breathe": "" }),
      el("text", { x: b.x + 14, y: b.y + 25, class: "btitle" }, BUSINESS_BLOCKS[b.id]),
    );
    const num = el("g", { class: "bnum", "aria-hidden": "true" });
    num.append(el("circle", { cx: b.x + b.width - 20, cy: b.y + 20, r: 10 }), el("text", { x: b.x + b.width - 20, y: b.y + 24 }, i + 1));
    card.append(num);
    g.append(card);
  });
  // The flows sit between the cards and the notes. They are illustrative, not relationships between notes.
  const bottom = (id) => at[id].y + at[id].height - 6;
  const flows = [];
  if (blocks.length === 9) {
    const vp = at["value propositions"], cs = at["customer segments"], rev = at["revenue streams"];
    for (const via of ["customer relationships", "channels"]) {
      flows.push({ d: `M${vp.x + vp.width} ${bottom(via)}H${cs.x - 9}`, head: [cs.x, bottom(via), "right"], tone: "accent", ends: `value propositions ${via} customer segments`, dur: 4 });
    }
    const x = cs.x + cs.width / 2;
    flows.push({ d: `M${x} ${cs.y + cs.height - 34}V${rev.y - 9}`, head: [x, rev.y, "down"], tone: "authored", ends: "customer segments revenue streams", dur: 3 });
  }
  for (const f of flows) {
    g.append(el("path", { class: "edge bflow", d: f.d, "data-tone": f.tone, "data-flow": "", "data-packets": 2, "data-packet-dur": f.dur, "data-ends": f.ends }));
    const [x, y, way] = f.head;
    g.append(el("path", { class: "bflow-head", "data-tone": f.tone, d: way === "right" ? `M${x - 9} ${y - 5}L${x} ${y}L${x - 9} ${y + 5}Z` : `M${x - 5} ${y - 9}L${x} ${y}L${x + 5} ${y - 9}Z` }));
  }
  const rects = new Map(layout.map((r) => [r.id, r]));
  const placed = new Map();
  for (const n of nodes) {
    const r = rects.get(n.id);
    if (!r) continue;
    const index = placed.get(n.block) ?? 0;
    placed.set(n.block, index + 1);
    // data-id (the block) makes hovering a note light the flows through its block; data-ref#note dims it with the block.
    const note = el("g", { class: "bnote", tabindex: 0, "data-id": n.block, "data-ref": `${n.block}#${n.id}`, style: `--tilt:${businessTilt(r.width, index)}` });
    const lines = businessWrap(n.title);
    note.append(el("title", {}, n.title), el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: 6 }));
    lines.forEach((line, i) => note.append(el("text", { x: r.x + 10, y: r.y + (lines.length === 1 ? 26 : 19 + i * 15) }, line)));
    const open = () => select(n, note);
    note.addEventListener("click", open);
    note.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    // A note picked up by the pointer goes on top of its neighbours (SVG has no z-index); it goes back when the pointer leaves.
    let home = null;
    note.addEventListener("pointerenter", () => { if (note.nextSibling) { home = note.nextSibling; g.append(note); } });
    note.addEventListener("pointerleave", () => { if (home) { g.insertBefore(note, home); home = null; } });
    g.append(note);
  }
}

// The credit line is always visible on this layer; a first visit fits the whole canvas on screen.
const showLayerWithoutBusiness = showLayer;
showLayer = (which) => {
  const first = which === "business" && authoredShown !== "business";
  showLayerWithoutBusiness(which);
  businessCredit.hidden = which !== "business";
  if (first) $("zoom-fit").click();
};

notationRegisterLegend("business", {
  shapes: [
    [notationSwatch(`<rect x="4" y="3" width="36" height="18" rx="5" style="fill:var(--raised);stroke:var(--control)"/><circle cx="33" cy="9" r="3" style="fill:var(--selected)"/>`), "One of the nine blocks; its place on the canvas is part of its meaning, and the number is its order"],
    [notationSwatch(`<rect x="6" y="6" width="32" height="12" rx="3" style="fill:#f2b45a22;stroke:#f2b45a99"/>`), "A sticky note: one idea in plain words, inside the block it belongs to"],
  ],
  arrows: [
    [notationSwatch(`<path d="M2 12H38" style="stroke:var(--accent);stroke-width:2;stroke-dasharray:7 5"/><circle cx="24" cy="12" r="4" style="fill:var(--accent)"/>`), "Value flows from the value propositions to the customer segments, through channels and relationships (illustrative)"],
    [notationSwatch(`<path d="M2 12H38" style="stroke:var(--authored);stroke-width:2;stroke-dasharray:7 5"/><circle cx="24" cy="12" r="4" style="fill:var(--authored)"/>`), "Money flows from the customer segments down to the revenue streams (illustrative)"],
  ],
  notShown: ["Relationships between notes", "The order of notes by importance", "Numbers, priorities or evidence for any note"],
});
