// Shared visual language for every diagram layer: colour meaning, ambient motion, hover-lights-paths and the "?" legend.
// Layers only add their own shapes; they opt in with data attributes (all names here are prefixed "notation" or "nt-"):
//   [data-tone="accent|derived|visited|authored|danger|unresolved"]  colour meaning (edge stroke, packets, glow). Grey dashed "unresolved" never moves.
//   [data-flow]      on an edge path: dashes flow in the path's direction.
//   [data-packets="N"]  on an edge path: N glowing packets travel source to target along that very path, in a loop (data-packet-dur="s" overrides the pace).
//   [data-breathe]   on any element: slow glow (about 2.5 s).
//   [data-ends="idA idB"]  on an edge: the ids of its two Nodes; hovering or focusing a [data-node]/[data-id] Node lights its edges and dims the rest
//                    (a Node may carry data-light="id" when the edges know it by another id).
// Legends: notationRegisterLegend(layerKey, { shapes, arrows, notShown }) with shapes/arrows as [[notationSwatch(svgInner), "text"], ...] and notShown as ["text", ...].
const notationKey = "aidea.animations";
const notationColours = [
  ["accent", "Active now, or in flight"], ["derived", "Visited, or derived from the code"], ["authored", "Authored by a person or the agent"],
  ["danger", "Error or exception"], ["unresolved", "Unresolved: grey, dashed, never moving (inferred links are dashed but still flow)"],
];

{
  const style = document.createElement("style");
  style.textContent = `
    [data-tone="accent"] { --tone: var(--accent); } [data-tone="derived"], [data-tone="visited"] { --tone: var(--derived); }
    [data-tone="authored"] { --tone: var(--authored); } [data-tone="danger"] { --tone: var(--danger); } [data-tone="unresolved"] { --tone: var(--unresolved); }
    .edge[data-tone] { stroke: var(--tone); } .edge[data-tone="unresolved"] { stroke-dasharray: 5 4; }
    .nt-packet { fill: var(--tone, var(--accent)); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tone, var(--accent)) 70%, transparent)); pointer-events: none; }
    body.motion-off .nt-packet { display: none; }
    @keyframes nt-flow { to { stroke-dashoffset: -12; } }
    @keyframes nt-breathe {
      0%, 100% { filter: drop-shadow(0 0 1px color-mix(in srgb, var(--tone, var(--accent)) 15%, transparent)); }
      12.5%, 87.5% { filter: drop-shadow(0 0 2.2px color-mix(in srgb, var(--tone, var(--accent)) 22%, transparent)); }
      25%, 75% { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--tone, var(--accent)) 35%, transparent)); }
      37.5%, 62.5% { filter: drop-shadow(0 0 7.8px color-mix(in srgb, var(--tone, var(--accent)) 49%, transparent)); }
      50% { filter: drop-shadow(0 0 9px color-mix(in srgb, var(--tone, var(--accent)) 55%, transparent)); }
    }
    body:not(.motion-off) [data-flow]:not([data-tone="unresolved"]) { stroke-dasharray: 7 5; animation: nt-flow .9s linear infinite; }
    body:not(.motion-off) :is([data-breathe], .anode.selected) { animation: nt-breathe 2s linear infinite; /* eight sine-sampled stops: a smooth swell, never fully off */ }
    body.motion-paused * { animation-play-state: paused !important; }
    svg#canvas.nt-hl [data-ends] { opacity: .18; transition: opacity .2s; }
    svg#canvas.nt-hl [data-ends].nt-lit { opacity: 1; stroke-width: 3; }
    svg#canvas.nt-hl [data-ends].nt-lit:not([data-tone="unresolved"]) { stroke: var(--accent-soft); } /* unresolved stays grey */
    svg#canvas.nt-hl [data-ref]:not([data-ends]):not(.nt-near) { opacity: .35; }
    #motion-toggle { margin-left: auto; flex: none; padding: 4px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); font-size: 12.5px; font-weight: 400; }
    #motion-toggle b { font-weight: 600; color: var(--accent); } #motion-toggle[aria-pressed="false"] b { color: var(--muted); }
    #fold-buttons { margin-left: 0; }
    @media (max-width: 480px) { #motion-toggle .word { display: none; } }
    #layers { max-width: calc(100% - 68px); }
    #legend-button { position: absolute; right: 15px; top: 15px; z-index: 2; width: 30px; height: 30px; padding: 0; border-radius: 50%; background: var(--panel); color: var(--text); border: 1px solid var(--control); font-weight: 600; }
    #legend-pop { position: absolute; right: 15px; top: 52px; z-index: 5; width: min(420px, calc(100% - 30px)); max-height: calc(100% - 120px); overflow-y: auto; background: var(--raised); border: 1px solid var(--control); border-radius: 12px; padding: 12px 14px; box-shadow: 0 12px 32px #0009; }
    #legend-pop h3 { margin: 0 0 6px; font: 600 10.5px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
    #legend-pop ul { margin: 0 0 12px; gap: 5px; } #legend-pop li { display: flex; gap: 10px; align-items: center; font-size: 12.5px; color: var(--label); } #legend-pop li svg { flex: none; }
    #legend-pop ul.not li { display: list-item; list-style: "– "; margin-left: 14px; color: var(--muted); }
  `;
  document.head.append(style);
}

// ---- Text that does not fit is cut with an ellipsis (the whole text stays in a tooltip where it matters).
const notationClip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// ---- Animations switch: on by default, off when the system asks to reduce motion, remembered between sessions.
const notationStored = () => { try { return localStorage.getItem(notationKey); } catch { return null; } };
let notationOn = (notationStored() ?? (matchMedia("(prefers-reduced-motion: reduce)").matches ? "off" : "on")) === "on";
const notationToggle = Object.assign(document.createElement("button"), { type: "button", id: "motion-toggle", title: "Turn all motion on or off" });
notationToggle.setAttribute("aria-label", "Animations");
$("fold-buttons").before(notationToggle);

let notationStepping = false; // "Pause and step" (48-stepmode.js) holds the loop still too
function notationSync() {
  const frozen = document.hidden || notationStepping;
  document.body.classList.toggle("motion-off", !notationOn);
  document.body.classList.toggle("motion-paused", frozen); // a hidden window or a paused loop stops dashes, glow and packets
  notationToggle.setAttribute("aria-pressed", String(notationOn));
  notationToggle.innerHTML = `<span class="word">Animations: </span><b>${notationOn ? "on" : "off"}</b>`;
  if (notationOn && !frozen) svg.unpauseAnimations(); else svg.pauseAnimations();
  document.dispatchEvent(new Event("notation-sync"));
}
notationToggle.onclick = () => {
  notationOn = !notationOn;
  try { localStorage.setItem(notationKey, notationOn ? "on" : "off"); } catch {}
  notationSync();
};
document.addEventListener("visibilitychange", notationSync);

// ---- Packets: small glowing dots that follow an edge's own path (mpath), so they never drift from it.
let notationIds = 0;
function notationPacket(edge, count = 1, dur) {
  edge.id ||= `nt-edge-${++notationIds}`;
  const seconds = dur ?? Math.min(6, Math.max(1.6, (edge.getTotalLength?.() || 0) / 90 || 3)); // about 90 px per second
  for (let i = 0; i < count; i++) {
    const dot = el("circle", { class: "nt-packet", r: 6 });
    if (edge.dataset.tone) dot.dataset.tone = edge.dataset.tone;
    const move = el("animateMotion", { dur: `${seconds}s`, begin: `${(-i * seconds) / count}s`, repeatCount: "indefinite" });
    move.append(el("mpath", { href: `#${edge.id}` }));
    dot.append(move);
    edge.after(dot);
  }
}
// Packets are added when edges appear in the world, whoever draws them.
function notationDecorate() {
  $("world").querySelectorAll("[data-packets]:not([data-packeted])").forEach((edge) => {
    edge.dataset.packeted = "";
    if (edge.dataset.tone !== "unresolved") notationPacket(edge, Number(edge.dataset.packets) || 1, edge.dataset.packetDur && Number(edge.dataset.packetDur));
  });
}
new MutationObserver(notationDecorate).observe($("world"), { childList: true, subtree: true });

// Packets sit at the origin until they move, so Fit measures the world without them.
function notationBBox() {
  const packets = [...$("world").querySelectorAll(".nt-packet")];
  packets.forEach((p) => (p.style.display = "none"));
  const b = $("world").getBBox();
  packets.forEach((p) => (p.style.display = ""));
  return b;
}

// ---- Hover and keyboard focus light a Node's edges and dim the rest.
const notationEnds = (p) => p.dataset.ends.split(p.dataset.ends.includes("|") ? "|" : " "); // "|" when an id holds a space (the Business blocks)
const notationLight = (e) => {
  const node = e.target.closest?.("[data-node],[data-id]");
  const id = node && (node.dataset.light ?? node.dataset.node ?? node.dataset.id); // data-light: a note lights the edges of its block
  const edges = id ? [...$("world").querySelectorAll("[data-ends]")].filter((p) => notationEnds(p).includes(id)) : [];
  const near = new Set(edges.flatMap(notationEnds));
  svg.classList.toggle("nt-hl", edges.length > 0);
  $("world").querySelectorAll("[data-ends]").forEach((p) => p.classList.toggle("nt-lit", edges.includes(p)));
  $("world").querySelectorAll("[data-ref]:not([data-ends])").forEach((n) => n.classList.toggle("nt-near", near.has(n.dataset.ref.split("#")[0])));
};
const notationUnlight = () => notationLight({ target: document.body });
svg.addEventListener("pointerover", notationLight);
svg.addEventListener("pointerleave", notationUnlight);
svg.addEventListener("focusin", notationLight);
svg.addEventListener("focusout", notationUnlight);

// ---- Legend: a "?" on the Canvas card opens a popover fed by the layer shown.
const notationLegends = {};
const notationSwatch = (inner, width = 44) => `<svg width="${width}" height="24" viewBox="0 0 ${width} 24" aria-hidden="true">${inner}</svg>`;
function notationRegisterLegend(layer, legend) { notationLegends[layer] = legend; }

const legendButton = Object.assign(document.createElement("button"), { type: "button", id: "legend-button", textContent: "?" });
legendButton.setAttribute("aria-haspopup", "dialog");
legendButton.setAttribute("aria-expanded", "false");
legendButton.setAttribute("aria-controls", "legend-pop");
const legendPop = Object.assign(document.createElement("div"), { id: "legend-pop", hidden: true });
legendPop.setAttribute("role", "dialog");
document.querySelector("main").append(legendButton, legendPop);

function notationList(title, rows, className) {
  if (!rows?.length) return [];
  const ul = Object.assign(document.createElement("ul"), { className: className ?? "" });
  for (const row of rows) {
    const li = document.createElement("li");
    const [swatch, text] = Array.isArray(row) ? row : [null, row];
    if (swatch) li.insertAdjacentHTML("beforeend", swatch); // swatches are markup written by layer code, never project text
    li.append(Object.assign(document.createElement("span"), { textContent: text }));
    ul.append(li);
  }
  return [Object.assign(document.createElement("h3"), { textContent: title }), ul];
}
function notationRenderLegend() {
  const layer = authoredShown, legend = notationLegends[layer] ?? {};
  const label = layerBar.querySelector(`[data-layer="${layer}"]`)?.textContent ?? layer;
  legendButton.setAttribute("aria-label", `Legend for ${label}`);
  legendPop.setAttribute("aria-label", `${label} legend`);
  const colours = notationColours.map(([tone, text]) => [notationSwatch(`<rect x="4" y="6" width="36" height="12" rx="3" style="fill:var(--${tone});${tone === "unresolved" ? "opacity:.6" : ""}"/>`), text]);
  const notShown = legend.notShown ?? ["This layer has not described its notation yet."];
  legendPop.replaceChildren(...notationList("Shapes", legend.shapes), ...notationList("Arrows", legend.arrows), ...notationList("Colours", colours), ...notationList("Not shown", notShown, "not"));
}
function notationSetLegend(open) {
  if (open) notationRenderLegend();
  legendPop.hidden = !open;
  legendButton.setAttribute("aria-expanded", String(open));
}
legendButton.onclick = () => notationSetLegend(legendPop.hidden);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !legendPop.hidden) { notationSetLegend(false); legendButton.focus(); } });
document.addEventListener("click", (e) => { if (!legendPop.hidden && !legendPop.contains(e.target) && e.target !== legendButton) notationSetLegend(false); });
const showLayerWithoutLegend = showLayer;
showLayer = (which) => { showLayerWithoutLegend(which); notationRenderLegend(); };
notationRenderLegend();

// What the drawings here show today; later tickets replace each entry with their layer's full notation.
for (const layer of ["components", "business", "requirements", "architecture"]) {
  notationRegisterLegend(layer, {
    shapes: [[notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="5" style="fill:var(--raised);stroke:var(--control)"/>`), "A Node: one element, with its Rationale"]],
    arrows: [[notationSwatch(`<path d="M2 12H36" style="stroke:#4a546c;stroke-width:1.6;stroke-dasharray:7 5"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:#4a546c;stroke-width:1.5"/>`), "Parent to child; the dashes flow and the dot travels in that direction"]],
    notShown: ["Relationships other than parent and child are not drawn yet."],
  });
}

notationSync();
