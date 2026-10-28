// Business layer: the nine-block canvas with sticky notes. The core says where every block and note sits (GET /layout);
// this draws them, a hint line in each (the wording lives in 46-business-help.js) and the credit line.
// Loaded after the notation kit so its legend replaces the generic one; drawAuthored (20-authored.js) calls drawBusiness.
const BUSINESS_BLOCKS = {
  "key partnerships": "Key Partners", "key activities": "Key Activities", "key resources": "Key Resources",
  "value propositions": "Value Propositions", "customer relationships": "Customer Relationships", channels: "Channels",
  "customer segments": "Customer Segments", "cost structure": "Cost Structure", "revenue streams": "Revenue Streams",
};
const BUSINESS_CREDIT = "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0. Layout adapted for aidea.";

{
  const style = document.createElement("style");
  style.textContent = `
    .bblock rect { fill: var(--raised); stroke: var(--control); }
    .bblock .btitle { fill: var(--authored); font: 600 12.5px var(--sans); }
    .bblock .bnum circle { fill: var(--selected); stroke: none; } .bblock .bnum text { fill: var(--muted); font: 700 11px var(--mono); text-anchor: middle; }
    .bnote { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform .18s ease, filter .18s ease; filter: drop-shadow(0 2px 0 #0006); }
    .bnote rect { fill: #f2b45a22; stroke: #f2b45a66; transition: fill .18s ease, stroke .18s ease; }
    .bnote text { fill: #ffe0ae; font: 12.5px var(--sans); pointer-events: none; }
    .bnote:is(:hover, :focus-visible) { transform: rotate(var(--tilt, 1.2deg)) translateY(-2px); filter: drop-shadow(0 6px 10px #0008); }
    .bnote:is(:hover, :focus-visible) rect { fill: #41392f; stroke: #f2b45a99; }
    .bnote.selected rect { stroke: var(--accent); stroke-width: 1.5; }
    @media (prefers-reduced-motion: reduce) { .bnote:is(:hover, :focus-visible) { transform: none; } }
    body.motion-off .bnote:is(:hover, :focus-visible) { transform: none; }
    #business-credit { position: absolute; left: 15px; right: 15px; bottom: 63px; z-index: 1; margin: 0; padding: 6px 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; font-size: 11.5px; line-height: 1.4; color: var(--muted); }
    #business-credit a { color: var(--accent); }
  `;
  document.head.append(style);
}

const businessCredit = Object.assign(document.createElement("p"), { id: "business-credit", hidden: true });
businessCredit.append(
  `${BUSINESS_CREDIT} `,
  Object.assign(document.createElement("a"), { href: "https://creativecommons.org/licenses/by-sa/3.0/", target: "_blank", rel: "noopener noreferrer", textContent: "CC BY-SA 3.0 licence" }),
);
document.querySelector("main").append(businessCredit);

// Two lines at most, cut by measured width (not by character count, so wide letters cannot cross the note's edge);
// the whole title stays available as the tooltip.
const businessMeasure = document.createElement("canvas").getContext("2d");
function businessWrap(text, width) {
  businessMeasure.font = `12.5px ${getComputedStyle(document.documentElement).getPropertyValue("--sans") || "sans-serif"}`;
  const fits = (s) => businessMeasure.measureText(s).width <= width;
  const clip = (s) => {
    if (fits(s)) return s;
    while (s.length > 1 && !fits(`${s}…`)) s = s.slice(0, -1);
    return `${s}…`;
  };
  const words = text.split(" ");
  let first = "", i = 0;
  while (i < words.length && fits(`${first} ${words[i]}`.trim())) first = `${first} ${words[i++]}`.trim();
  if (!first) return [clip(text)];
  return i < words.length ? [first, clip(words.slice(i).join(" "))] : [first];
}

// The prompt of an empty block: the hint cut into lines of about 24 letters.
const businessPrompt = (text, max = 24) => text.split(" ").reduce((lines, word) => {
  if (lines.length && (lines.at(-1) + " " + word).length <= max) lines[lines.length - 1] += " " + word; else lines.push(word);
  return lines;
}, []);

// A note tilts by an angle that shrinks with its width, so its ends move about 3 px at most and stay inside the gap to its neighbours.
const businessTilt = (width, index) => `${(index % 2 ? 1 : -1) * Math.min(1.8, (Math.atan(3 / (width / 2)) * 180) / Math.PI)}deg`;

function drawBusiness(g, nodes, layout, select) {
  const blocks = layout.blocks ?? [];
  blocks.forEach((b, i) => {
    const card = el("g", { class: "bblock", tabindex: 0, "data-id": b.id, "data-ref": b.id });
    card.append(
      el("rect", { x: b.x, y: b.y, width: b.width, height: b.height, rx: 12, "data-tone": "authored", "data-breathe": "" }),
      el("text", { x: b.x + 14, y: b.y + 25, class: "btitle" }, BUSINESS_BLOCKS[b.id]),
    );
    const num = el("g", { class: "bnum", "aria-hidden": "true" });
    num.append(el("circle", { cx: b.x + b.width - 20, cy: b.y + 20, r: 10 }), el("text", { x: b.x + b.width - 20, y: b.y + 24 }, BUSINESS_WALK.indexOf(b.id) + 1)); // the number is the place in the telling order of "Walk me through it"
    card.append(num);
    // Under the name: the hint, small; an empty block shows it larger as the prompt of what to write.
    const hint = BUSINESS_HELP[b.id]?.hint ?? "";
    if (nodes.some((n) => n.block === b.id)) card.append(el("text", { x: b.x + 14, y: b.y + 44, class: "bhint" }, hint));
    else businessPrompt(hint).forEach((line, k) => card.append(el("text", { x: b.x + 14, y: b.y + 84 + k * 20, class: "bprompt" }, line)));
    g.append(card);
  });
  const rects = new Map(layout.map((r) => [r.id, r]));
  const placed = new Map();
  for (const n of nodes) {
    const r = rects.get(n.id);
    if (!r) continue;
    const index = placed.get(n.block) ?? 0;
    placed.set(n.block, index + 1);
    // data-node makes the note zoomable and markable like any Node; data-block ties it to its block (help card, guided reading); data-ref#note dims it with the block.
    const note = el("g", { class: "bnote", tabindex: 0, "data-node": n.id, "data-block": n.block, "data-ref": `${n.block}#${n.id}`, style: `--tilt:${businessTilt(r.width, index)}` });
    const lines = businessWrap(n.title, r.width - 20);
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
  businessHeld = {};
  for (const n of nodes) (businessHeld[n.block] ??= []).push(n.title);
  businessHelpDrawn();
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
    [notationSwatch(`<rect x="4" y="3" width="36" height="18" rx="5" style="fill:none;stroke:var(--control);stroke-dasharray:4 3"/>`), "The blocks fill in over time; an empty one is normal, it is a question still to answer"],
  ],
  notShown: ["Relationships between notes", "The order of notes by importance", "Numbers, priorities or evidence for any note"],
});
