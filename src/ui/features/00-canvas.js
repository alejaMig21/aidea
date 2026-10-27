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

// Drawing: one column per module, members stacked below, indented by depth
const el = (name, attrs, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};
function draw(nodes) {
  const world = $("world");
  world.replaceChildren();
  const kids = (id) => nodes.filter((n) => n.parent === id);
  nodes.filter((n) => n.kind === "module").forEach((mod, col) => {
    let row = 0;
    const place = (n, depth, parentPos) => {
      const pos = { x: col * 280 + depth * 18, y: row++ * 36, w: 240 - depth * 18, h: 28 };
      if (parentPos) {
        const mx = parentPos.x + 9;
        world.append(el("path", { class: "edge", d: `M${mx} ${parentPos.y + parentPos.h} V${pos.y + 14} H${pos.x}` }));
      }
      world.append(el("rect", { x: pos.x, y: pos.y, width: pos.w, height: pos.h, rx: 6, fill: `var(--${n.kind})`, "data-id": n.id }));
      world.append(el("text", { x: pos.x + 10, y: pos.y + 19 }, `${n.kind === "function" ? "ƒ " : ""}${n.name.split(".").pop()}`));
      // Attributes are members of a class Node, drawn as slim rows above its methods.
      (n.attributes ?? []).forEach((a) => {
        const apos = { x: pos.x + 18, y: row++ * 36, w: pos.w - 18, h: 24 };
        world.append(el("rect", { x: apos.x, y: apos.y, width: apos.w, height: apos.h, rx: 6, fill: "none", "stroke-dasharray": "3 3" }));
        world.append(el("text", { x: apos.x + 10, y: apos.y + 17 }, `• ${a.name}`));
      });
      kids(n.id).forEach((c) => place(c, depth + 1, pos));
    };
    place(mod, 0, null);
  });
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
  draw(body.nodes);
  refreshList();
}
$("open").onsubmit = (e) => { e.preventDefault(); open($("path").value.trim()); };
apply();
refreshList();
