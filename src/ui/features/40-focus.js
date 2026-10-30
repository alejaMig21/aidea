// Focus zoom: double-click a Node to open the layer below, framed on what realises it; "Zoom out" goes back.
// The core computes the framing and says what to dim; this only applies them.
const focusStyle = document.createElement("style");
focusStyle.textContent = `
  [data-ref] { transition: opacity .2s; }
  .dim { opacity: .2; }
  .anode.has-broken rect, .bnote.has-broken rect { stroke: var(--danger); stroke-width: 1.5; }
`;
document.head.append(focusStyle);

const zoomOut = document.createElement("button");
zoomOut.textContent = "Zoom out";
zoomOut.hidden = true;
layerBar.append(zoomOut);

const post = (path, body) =>
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Fits a frame (in layer coordinates) into the visible Canvas.
function fit(frame, maxZoom = 4) {
  const r = svg.getBoundingClientRect();
  view.k = Math.min(maxZoom, Math.max(0.2, Math.min(r.width / frame.width, r.height / frame.height)));
  view.x = (r.width - frame.width * view.k) / 2 - frame.x * view.k;
  view.y = (r.height - frame.height * view.k) / 2 - frame.y * view.k;
  apply();
}
const dim = (ids) => document.querySelectorAll("[data-ref]").forEach((e) => e.classList.toggle("dim", ids.includes(e.dataset.ref)));

// Any other way of changing layer clears the dimming.
const showLayerPlain = showLayer;
showLayer = (which) => { showLayerPlain(which); dim([]); };

svg.addEventListener("dblclick", async (e) => {
  const node = e.target.closest("[data-node]");
  if (!node || authoredShown === "algorithms" || authoredShown === "code") return; // a step of a graph opens its lines (50-algorithm.js); only the authored layers have a focus
  const project = current;
  const res = await post("/focus", { project, layer: authoredShown, node: node.dataset.node });
  const body = await res.json();
  if (project !== current) return; // another Project was opened meanwhile: this answer is stale
  $("error").textContent = res.ok ? "" : body.error;
  if (!res.ok) return;
  showLayer(body.layer);
  fit(body.frame);
  dim(body.dimmed);
  zoomOut.hidden = false;
  if (body.broken.length) $("error").textContent = `Broken links: ${body.broken.join(", ")}`;
});

zoomOut.onclick = async () => {
  const project = current;
  const res = await post("/focus/out", { project });
  const body = await res.json();
  if (project !== current) return;
  if (!res.ok) { zoomOut.hidden = true; $("error").textContent = body.error; return; }
  $("error").textContent = "";
  showLayer(body.layer);
  fit(body.frame);
  zoomOut.hidden = body.remaining === 0;
};

// The Nodes with a Broken link carry a red outline. Every redraw of a layer calls markBroken again.
let brokenFrom = new Set();
function markBroken() {
  document.querySelectorAll(".anode, .bnote").forEach((n) => n.classList.toggle("has-broken", brokenFrom.has(n.dataset.node)));
}

// After each Project is drawn, find the Nodes that have a Broken link.
const drawWithoutBroken = draw;
draw = async (nodes) => {
  await drawWithoutBroken(nodes);
  zoomOut.hidden = true;
  const project = current;
  const res = await fetch(`/traces?project=${encodeURIComponent(project)}`);
  if (!res.ok || project !== current) return;
  const { links } = await res.json();
  brokenFrom = new Set(links.filter((l) => l.broken).map((l) => l.from));
  markBroken();
};
