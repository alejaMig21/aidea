const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const viewStart = { x: 100, y: 140, k: 1 }; // clear of the floating Layer tabs
const view = { ...viewStart };
const apply = () => {
  $("world").setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);
  $("zoom-pct").textContent = `${Math.round(view.k * 100)}%`;
  if (typeof componentsZoomed === "function") componentsZoomed(view.k); // the overview keeps its labels at a readable size
};

// Pan and zoom
const svg = $("canvas");
svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = Math.min(4, Math.max(0.1, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); // 0.1: the overview of a big project is wider than a screen at 0.2
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
  const k = Math.min(4, Math.max(0.1, view.k * f));
  view.x = r.width / 2 - ((r.width / 2 - view.x) / view.k) * k;
  view.y = r.height / 2 - ((r.height / 2 - view.y) / view.k) * k;
  view.k = k;
  apply();
};
$("zoom-in").onclick = () => zoomBy(1.2);
$("zoom-out").onclick = () => zoomBy(1 / 1.2);
// Fit asked while the Canvas is hidden has nothing to measure (0x0): it waits and runs when the svg gets a size.
let fitPending = false;
new ResizeObserver(() => { if (fitPending && svg.clientWidth) { fitPending = false; $("zoom-fit").click(); } }).observe(svg);
$("zoom-fit").onclick = () => {
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) { fitPending = true; return; }
  fitPending = false;
  const b = notationBBox(); // elements that are not displayed (other layers) are left out
  if (!b.width || !b.height) { Object.assign(view, viewStart); return apply(); }
  const credit = $("business-credit"), trace = $("trace-table");
  // What sits over the bottom of the Canvas: the Business credit line above the zoom control, and the trace table of a Playback replay.
  const creditH = (credit && !credit.hidden ? credit.offsetHeight + 8 : 0) + (trace && !trace.hidden ? trace.offsetHeight + 8 : 0);
  const w = r.width - 48, h = r.height - 140 - creditH; // clear of the floating Layer tabs (top) and the zoom control (bottom)
  view.k = Math.min(1, Math.max(0.1, Math.min(w / b.width, h / b.height)));
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
// Builds an element: Object.assign of its properties, then its children. The kernel's feature files share this one.
function uiMake(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}
async function draw(nodes) {
  const project = current;
  const res = await fetch(`/layout?project=${encodeURIComponent(project)}&layer=components`);
  const layout = await res.json();
  if (project !== current) return;
  if (!res.ok) { $("error").textContent = layout.error; return; }
  const world = $("world");
  world.replaceChildren();
  currentUnresolved = layout.unresolved ?? currentUnresolved; // the legend counts what this very drawing was made from
  componentsDraw(world, nodes, layout, currentUnresolved);
}

// What the Project holds, in one line near its name ("Analysed: Python, 587 files. Not analysed yet: JavaScript, 12 files");
// when nothing is analysable the Components layer says so instead of showing an empty canvas.
const languageList = (list) => list.map((l) => `${l.label}, ${l.files} ${l.files === 1 ? "file" : "files"}`).join("; ");
let noCodeWanted = false;
const syncNoCode = () => { $("no-code").hidden = !noCodeWanted || authoredShown !== "components"; }; // only the Components layer is empty
function showLanguages(languages) {
  const done = languages.filter((l) => l.analysed), todo = languages.filter((l) => !l.analysed);
  const line = [done.length && `Analysed: ${languageList(done)}.`, todo.length && `Not analysed yet: ${languageList(todo)}.`].filter(Boolean).join(" ");
  $("languages").textContent = line;
  $("languages").title = line;
  const none = $("no-code");
  noCodeWanted = done.length === 0;
  syncNoCode();
  if (!todo.length) { none.textContent = "No code was found in this project, so there is nothing to draw on this layer yet."; return; }
  // No plugin reads the language: say so, name it, and offer the way forward as a lesson. Nothing is prepared or sent for the person (language-plugins 04).
  const names = todo.map((l) => l.label);
  const ask = Object.assign(document.createElement("button"), { type: "button", id: "no-reader-offer", textContent: `Learn how to ask for a plugin for ${names[0]}` });
  ask.onclick = () => window.tutorUi?.startClass({ payload: { project: current, guide: true, message: `aidea cannot read the ${names.join(", ")} code of my project yet. Teach me how to ask for a plugin that reads ${names[0]}.` }, fallback: true });
  none.replaceChildren(`No plugin reads ${names.join(", ")}, so aidea cannot draw this project's code yet. Business, Requirements and Architecture still work. `, ask);
}

// Projects
let current = null;
let currentUnresolved = 0; // relationships the analysis could not resolve, for the Components legend
async function openProject(path) {
  $("error").textContent = "";
  const res = await fetch("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
  const body = await res.json();
  if (!res.ok) { $("error").textContent = body.error; return; }
  if (current !== body.id) authoredShown = "components"; // a different Project starts on the derived view, not on a layer it may not have yet
  current = body.id;
  currentUnresolved = body.unresolved ?? 0;
  showLanguages(body.languages ?? []);
  document.dispatchEvent(new CustomEvent("project-opened", { detail: { id: body.id } }));
  if (typeof hideHome === "function") hideHome();
  Object.assign(view, viewStart);
  apply();
  draw(body.nodes);
}
$("open").onsubmit = (e) => { e.preventDefault(); openProject($("path").value.trim()); };
apply();
