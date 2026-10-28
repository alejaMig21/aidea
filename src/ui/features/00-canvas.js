const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const viewStart = { x: 100, y: 140, k: 1 }; // clear of the floating Layer tabs
const view = { ...viewStart };
const apply = () => {
  $("world").setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);
  $("zoom-pct").textContent = `${Math.round(view.k * 100)}%`;
};

// Pan and zoom
const svg = $("canvas");
svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = Math.min(4, Math.max(0.2, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  const r = svg.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  view.x = px - ((px - view.x) / view.k) * k;
  view.y = py - ((py - view.y) / view.k) * k;
  view.k = k;
  apply();
}, { passive: false });
// Zoom control: buttons zoom about the centre of the Canvas; Fit frames what is drawn on the visible layer.
const zoomBy = (f) => {
  const r = svg.getBoundingClientRect();
  const k = Math.min(4, Math.max(0.2, view.k * f));
  view.x = r.width / 2 - ((r.width / 2 - view.x) / view.k) * k;
  view.y = r.height / 2 - ((r.height / 2 - view.y) / view.k) * k;
  view.k = k;
  apply();
};
$("zoom-in").onclick = () => zoomBy(1.2);
$("zoom-out").onclick = () => zoomBy(1 / 1.2);
$("zoom-fit").onclick = () => {
  const b = notationBBox(); // elements that are not displayed (other layers) are left out
  if (!b.width || !b.height) { Object.assign(view, viewStart); return apply(); }
  const r = svg.getBoundingClientRect();
  const w = r.width - 48, h = r.height - 140; // clear of the floating Layer tabs (top) and the zoom control (bottom)
  view.k = Math.min(1, Math.max(0.2, Math.min(w / b.width, h / b.height)));
  view.x = (r.width - b.width * view.k) / 2 - b.x * view.k;
  view.y = 70 + (h - b.height * view.k) / 2 - b.y * view.k;
  apply();
};
let downAt = null;
// The pointer is captured only once the gesture is a drag: capturing on press would
// redirect the click to the Canvas and Nodes would never receive it.
svg.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
svg.addEventListener("pointermove", (e) => {
  if (!downAt) return;
  if (!svg.hasPointerCapture(e.pointerId)) {
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4) return;
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("dragging");
  }
  view.x += e.movementX; view.y += e.movementY; apply();
});
svg.addEventListener("pointerup", (e) => {
  if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  svg.classList.remove("dragging");
  // A press that barely moved is a click: select the Node under the pointer.
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4) {
    const id = document.elementFromPoint(e.clientX, e.clientY)?.getAttribute("data-id");
    if (id && typeof onSelect === "function") onSelect(id);
  }
  downAt = null;
});

// Drawing: the core says where every Node sits (GET /layout); this only draws the rectangles it is given.
// `data-ref` marks every drawn piece with the id the core uses, so the core can ask for some to be dimmed.
const el = (name, attrs, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};
async function draw(nodes) {
  const project = current;
  const res = await fetch(`/layout?project=${encodeURIComponent(project)}&layer=components`);
  const { rects, error } = await res.json();
  if (project !== current) return;
  if (!res.ok) { $("error").textContent = error; return; }
  const at = new Map(rects.map((r) => [r.id, r]));
  const world = $("world");
  world.replaceChildren();
  for (const n of nodes) {
    const parent = at.get(n.parent), r = at.get(n.id);
    if (parent) world.append(el("path", { class: "edge", d: `M${parent.x + 9} ${parent.y + parent.height} V${r.y + 14} H${r.x}`, "data-ref": n.id, "data-flow": "", "data-packets": 1, "data-ends": `${n.parent} ${n.id}` }));
  }
  for (const n of nodes) {
    const r = at.get(n.id);
    world.append(el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: 8, "data-id": n.id, "data-ref": n.id }));
    world.append(el("circle", { cx: r.x + 13, cy: r.y + r.height / 2, r: 3.5, class: "dot-derived", "data-ref": n.id }));
    world.append(el("text", { x: r.x + 24, y: r.y + 19, "data-ref": n.id }, `${n.kind === "function" ? "ƒ " : ""}${n.name.split(".").pop()}`));
    // Attributes are members of a class Node, drawn as slim rows above its methods.
    for (const a of n.attributes ?? []) {
      const ref = `${n.id}#${a.name}`, ar = at.get(ref);
      world.append(el("rect", { x: ar.x, y: ar.y, width: ar.width, height: ar.height, rx: 8, fill: "none", "stroke-dasharray": "3 3", "data-ref": ref }));
      world.append(el("text", { x: ar.x + 10, y: ar.y + 17, "data-ref": ref }, `• ${a.name}`));
    }
  }
}

// Projects
let current = null;
async function open(path) {
  $("error").textContent = "";
  const res = await fetch("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
  const body = await res.json();
  if (!res.ok) { $("error").textContent = body.error; return; }
  current = body.id;
  document.dispatchEvent(new CustomEvent("project-opened", { detail: { id: body.id } }));
  if (typeof hideHome === "function") hideHome();
  Object.assign(view, viewStart);
  apply();
  draw(body.nodes);
}
$("open").onsubmit = (e) => { e.preventDefault(); open($("path").value.trim()); };
apply();
