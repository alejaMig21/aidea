const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const view = { x: 40, y: 40, k: 1 };
const apply = () => $("world").setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);

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
  const { rects } = await (await fetch(`/layout?project=${encodeURIComponent(project)}&layer=components`)).json();
  if (project !== current) return;
  const at = new Map(rects.map((r) => [r.id, r]));
  const world = $("world");
  world.replaceChildren();
  for (const n of nodes) {
    const parent = at.get(n.parent), r = at.get(n.id);
    if (parent) world.append(el("path", { class: "edge", d: `M${parent.x + 9} ${parent.y + parent.height} V${r.y + 14} H${r.x}`, "data-ref": n.id }));
  }
  for (const n of nodes) {
    const r = at.get(n.id);
    world.append(el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: 6, fill: `var(--${n.kind})`, "data-id": n.id, "data-ref": n.id }));
    world.append(el("text", { x: r.x + 10, y: r.y + 19, "data-ref": n.id }, `${n.kind === "function" ? "ƒ " : ""}${n.name.split(".").pop()}`));
    // Attributes are members of a class Node, drawn as slim rows above its methods.
    for (const a of n.attributes ?? []) {
      const ref = `${n.id}#${a.name}`, ar = at.get(ref);
      world.append(el("rect", { x: ar.x, y: ar.y, width: ar.width, height: ar.height, rx: 6, fill: "none", "stroke-dasharray": "3 3", "data-ref": ref }));
      world.append(el("text", { x: ar.x + 10, y: ar.y + 17, "data-ref": ref }, `• ${a.name}`));
    }
  }
}

// Projects
let current = null;
async function refreshList() {
  const list = await (await fetch("/projects")).json();
  $("projects").replaceChildren(...list.map((p) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.textContent = p.name;
    b.title = p.path;
    if (p.id === current) b.setAttribute("aria-current", "true");
    b.onclick = () => open(p.path);
    li.append(b);
    return li;
  }));
}
async function open(path) {
  $("error").textContent = "";
  const res = await fetch("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
  const body = await res.json();
  if (!res.ok) { $("error").textContent = body.error; return; }
  current = body.id;
  Object.assign(view, { x: 40, y: 40, k: 1 });
  apply();
  draw(body.nodes);
  refreshList();
}
$("open").onsubmit = (e) => { e.preventDefault(); open($("path").value.trim()); };
apply();
refreshList();
