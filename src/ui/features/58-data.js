// The Data layer (layout-and-data 14), next to Flow in the layer bar. While a function is played it draws the variables the recording holds at the step being shown (the core records their
// shape: Python today): a scalar as a labelled box, a list as a row of cells with their places, a dictionary as keys pointing to values, an object as a box with its fields. What the last step
// changed is marked in words (CHANGED) as well as by its look. Objects that point to objects (linked lists, trees, graphs, aliases, cycles; layout-and-data 15) are drawn as framed nodes with an arrow
// for every pointer, laid out as a tree from the variables; a pointer the last step set is a heavy arrow tagged NEW, the one it replaced a dashed arrow tagged WAS. Data follows the one Playback position with Flow, the Playback panel and the trace table. Nobody writes it. Names are prefixed
// "data" because every feature file shares one global scope.
{
  const dataGroup = el("g", { id: "data" });
  const dataTab = Object.assign(document.createElement("button"), { textContent: "Data", disabled: true, title: "Open a function's Flow first: Data draws its variables while it is played" });
  dataTab.dataset.layer = "data";
  dataTab.onclick = () => showLayer("data");
  // Two buttons that belong to this layer only (layout-and-data 17): the text form of each value beside the drawing, and the drawing saved as an image.
  let dataText = false;
  const dataTextButton = Object.assign(document.createElement("button"), { id: "data-text-toggle", textContent: "Text", hidden: true, title: "Write each variable's value as text beside the drawing" });
  dataTextButton.setAttribute("aria-pressed", "false");
  dataTextButton.onclick = () => { dataText = !dataText; dataTextButton.setAttribute("aria-pressed", String(dataText)); dataDraw(); };
  const dataSaveButton = Object.assign(document.createElement("button"), { id: "data-save-image", textContent: "Save image", hidden: true, title: "Save the drawing of this step as an SVG image" });
  dataSaveButton.onclick = () => {
    const url = URL.createObjectURL(new Blob([dataSvgText()], { type: "image/svg+xml" }));
    Object.assign(document.createElement("a"), { href: url, download: `aidea-data-step-${pbIndex + 1}.svg` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  layerBar.append(dataTab);
  $("zoom").prepend(dataTextButton, dataSaveButton); // with the zoom controls: the layer bar has no room left

  const style = document.createElement("style");
  style.textContent = `
    #layers [data-layer="data"] { order: 6; }
    #data { font-family: var(--mono); }
    #data .data-label { fill: var(--label); font: 13px var(--sans); text-anchor: end; }
    #data .data-pos { fill: var(--muted); font: 11px var(--mono); text-anchor: middle; }
    #data .data-box { fill: var(--raised); stroke: var(--control); stroke-width: 1.4; }
    #data .data-value { fill: var(--text); font: 12.5px var(--mono); text-anchor: middle; }
    #data .data-key { fill: var(--label); font: 12.5px var(--mono); text-anchor: middle; }
    #data .data-arrow { fill: var(--muted); font: 13px var(--sans); text-anchor: middle; }
    #data .data-hidden-cell { fill: none; stroke: var(--control); stroke-width: 1.4; stroke-dasharray: 4 3; }
    #data .data-hidden { fill: var(--muted); font: 12px var(--sans); text-anchor: middle; }
    #data .data-title { fill: var(--muted); font: 11px var(--mono); }
    #data .data-var.changed .data-box { stroke: var(--accent); stroke-width: 2.4; }
    #data .data-changed { fill: var(--accent); font: 600 11px var(--sans); letter-spacing: .08em; text-anchor: end; }
    #data .data-var.pointed .data-label { fill: var(--accent); font-weight: 600; }
    #data .data-var.pointed .data-box { stroke: var(--accent); stroke-width: 3; }
    #data .data-look { fill: var(--accent); font: 600 11px var(--sans); letter-spacing: .08em; text-anchor: end; }
    #data .data-note { fill: var(--muted); font: 13px var(--sans); }
    #data .data-textline { fill: var(--label); font: 12.5px var(--mono); }
    #zoom #data-text-toggle[hidden], #zoom #data-save-image[hidden] { display: none; }
    #zoom #data-text-toggle[aria-pressed="true"] { color: var(--accent); font-weight: 600; }
    #data .data-frame { fill: var(--bg); stroke: var(--line); stroke-width: 1; }
    #data .data-port { fill: var(--muted); }
    #data .data-cut { fill: var(--muted); font: 12px var(--sans); text-anchor: middle; }
    #data .data-edge, #data .data-edge-old { fill: none; stroke: var(--muted); stroke-width: 1.4; }
    #data .data-edge.rewired { stroke: var(--accent); stroke-width: 2.6; }
    #data .data-edge-old { stroke: var(--accent); stroke-width: 1.6; stroke-dasharray: 5 4; }
    #data .data-edge-tag { fill: var(--accent); font: 600 11px var(--sans); letter-spacing: .08em; text-anchor: middle; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
    #data .data-head { fill: var(--muted); }
    #data .data-head-hot { fill: var(--accent); }
  `;
  document.head.append(style);

  const LABEL = 120, CELL = 30, PAD = 8, ROW = 22, EXTRA = 16, FRAME = 8, GAP = 16, COLGAP = 90, PORT = 26;
  const CUT_DEPTH = 6, CUT_NODES = 500; // the core's limits (src/core/playback.py), stated on every cut
  const widthOf = (text) => Math.max(40, Math.round(text.length * 7.6) + 18);
  const plain = (n) => n.toLocaleString("en-US");

  // The text of a scalar the way Python writes it. A value the core could not give as a number (nan, a huge integer) carries its own text.
  function scalarText(s) {
    const v = s.value;
    if (v !== null && typeof v === "object") return v.digits ? `${String(v.value).slice(0, 12)}… (${plain(v.digits)} digits)` : String(v.value);
    if (v === null || s.type === "NoneType") return "None";
    if (typeof v === "boolean") return v ? "True" : "False";
    if (typeof v === "string") return `'${v}'${s.hidden ? "…" : ""}`;
    return String(v);
  }
  // One line for a value that sits inside another (an item, a key, a field): a scalar in full, a container by its size.
  function summary(s) {
    if (!s) return "";
    if (s.kind === "scalar") return scalarText(s);
    if (s.kind === "seq") return `${s.type}[${plain((s.len ?? s.items?.length ?? 0))}]`;
    if (s.kind === "map") return `${s.type}{${plain(s.len ?? s.entries?.length ?? 0)}}`;
    if (s.kind === "object") return s.type ?? "object";
    if (s.kind === "ref") return `→ #${s.id}`;
    if (s.kind === "cut") return cutText(s);
    return "…";
  }
  const cutText = (s) => (s.reason === "depth" ? `cut: depth limit (${CUT_DEPTH} levels)` : `cut: node limit (${CUT_NODES} values per step)`);

  // What can be drawn as a node: a list, set, dictionary or object that has an identity (tuples and numbers have none).
  const isNode = (s) => !!s && s.id !== undefined && (s.kind === "seq" || s.kind === "map" || s.kind === "object");
  // The places in a node that can hold a value: [slot, value]. A dictionary's slot is its entry number.
  const slotsOf = (n) => (n.kind === "seq" ? (n.items ?? []).map((v, i) => [String(i), v]) : n.kind === "map" ? (n.entries ?? []).map(([, v], i) => [String(i), v]) : Object.entries(n.fields ?? {}));
  // A value is a pointer when it names an object elsewhere (a ref, or a cut that is described somewhere in this step), or is an object, or a container held by an object. A list or dictionary
  // inside another list or dictionary stays one line of text, as before.
  const linkId = (parent, v, nodes) => {
    const id = !v ? null : v.kind === "ref" || v.kind === "cut" ? v.id : isNode(v) && (v.kind === "object" || parent === "object") ? v.id : null;
    return id !== undefined && id !== null && nodes.has(id) ? id : null;
  };
  // Reads one step's shapes: the nodes, the pointers between them, and the variables that are drawn as nodes. Used for the step shown and for the one before it.
  function dataScan(shapes) {
    const nodes = new Map(), edges = new Map(), adj = new Map(), targeted = new Set(), sources = new Set(), vars = new Map();
    const walk = (s) => {
      if (!isNode(s) || nodes.has(s.id)) return;
      nodes.set(s.id, s);
      for (const [, v] of slotsOf(s)) if (isNode(v) && (v.kind === "object" || s.kind === "object")) walk(v);
    };
    for (const v of Object.values(shapes ?? {})) walk(v);
    for (const n of nodes.values()) {
      const to = [];
      for (const [slot, v] of slotsOf(n)) {
        const id = linkId(n.kind, v, nodes);
        if (id === null) continue;
        edges.set(`${n.id}:${slot}`, id); to.push(id); targeted.add(id); sources.add(n.id);
      }
      adj.set(n.id, to);
    }
    for (const v of Object.values(shapes ?? {})) if (v.kind === "ref" && nodes.has(v.id)) targeted.add(v.id);
    // An object variable is always a node; a list or dictionary only when it is part of a pointer.
    for (const [name, v] of Object.entries(shapes ?? {})) {
      const id = v.kind === "ref" && nodes.has(v.id) ? v.id : isNode(v) && (v.kind === "object" || targeted.has(v.id) || sources.has(v.id)) ? v.id : null;
      if (id !== null) { vars.set(name, id); edges.set(`var:${name}`, id); }
    }
    return { nodes, edges, adj, vars };
  }
  let dataCtx = { nodes: new Map(), ports: null }; // the step being drawn; ports is where the pointers of the node being drawn start

  // One box with its text, at (x, y); returns where it ends.
  function cell(group, x, y, text, cls = "data-value", box = "data-box") {
    const w = widthOf(text);
    group.append(el("rect", { x, y, width: w, height: CELL, rx: 5, class: box }), el("text", { x: x + w / 2, y: y + CELL / 2 + 4.5, class: cls }, text));
    return w;
  }

  // The cell for one value held by a node: its text, a dot when it is a pointer (the arrow starts there), a dashed cell when the drawing was cut. Returns the cell's width.
  function slotCell(group, x, y, v, slot, parent, box = "data-box") {
    const to = dataCtx.ports ? linkId(parent, v, dataCtx.nodes) : null;
    if (to !== null) {
      group.append(el("rect", { x, y, width: PORT, height: CELL, rx: 5, class: `${box} data-port-cell` }), el("circle", { cx: x + PORT / 2, cy: y + CELL / 2, r: 4.5, class: "data-port" }));
      dataCtx.ports.set(slot, { x: x + PORT / 2, y: y + CELL / 2, to });
      return PORT;
    }
    if (v?.kind === "cut") {
      const text = cutText(v), w = widthOf(text) + 8;
      group.append(el("rect", { x, y, width: w, height: CELL, rx: 5, class: "data-hidden-cell" }), el("text", { x: x + w / 2, y: y + CELL / 2 + 4.5, class: "data-cut" }, text));
      return w;
    }
    return cell(group, x, y, summary(v), "data-value", box);
  }

  // Draws one value at (x, y) into `group` and returns its size.
  function drawValue(group, shape, x, y) {
    if (shape.kind === "seq") {
      const sc = el("g", { class: "data-seq" });
      let dx = 0;
      (shape.items ?? []).forEach((item, i) => {
        const w = slotCell(sc, x + dx, y + EXTRA - 2, item, String(i), shape.kind, "data-box data-cell");
        sc.append(el("text", { x: x + dx + w / 2, y: y + 11, class: "data-pos" }, String(i)));
        dx += w + 4;
      });
      if (shape.hidden > 0) {
        const text = `${plain(shape.hidden)} more hidden`, w = widthOf(text) + 8;
        sc.append(el("rect", { x: x + dx, y: y + EXTRA - 2, width: w, height: CELL, rx: 5, class: "data-hidden-cell" }), el("text", { x: x + dx + w / 2, y: y + EXTRA - 2 + CELL / 2 + 4.5, class: "data-hidden" }, text));
        dx += w;
      }
      if (!shape.items?.length && !shape.hidden) { sc.append(el("rect", { x, y: y + EXTRA - 2, width: 60, height: CELL, rx: 5, class: "data-hidden-cell" }), el("text", { x: x + 30, y: y + EXTRA - 2 + CELL / 2 + 4.5, class: "data-hidden" }, "empty")); dx = 60; }
      group.append(sc);
      return { width: dx, height: EXTRA - 2 + CELL };
    }
    if (shape.kind === "map") {
      const mc = el("g", { class: "data-map" });
      let dy = 0, maxW = 0;
      let entry = 0;
      for (const [k, v] of shape.entries ?? []) {
        const pair = el("g", { class: "data-pair" });
        const kw = cell(pair, x, y + dy, summary(k), "data-key");
        pair.append(el("text", { x: x + kw + 14, y: y + dy + CELL / 2 + 4.5, class: "data-arrow" }, "→"));
        const vw = slotCell(pair, x + kw + 28, y + dy, v, String(entry++), shape.kind);
        mc.append(pair);
        maxW = Math.max(maxW, kw + 28 + vw);
        dy += CELL + 6;
      }
      if (shape.hidden > 0) {
        const text = `${plain(shape.hidden)} more hidden`, w = widthOf(text) + 8;
        mc.append(el("rect", { x, y: y + dy, width: w, height: CELL, rx: 5, class: "data-hidden-cell" }), el("text", { x: x + w / 2, y: y + dy + CELL / 2 + 4.5, class: "data-hidden" }, text));
        maxW = Math.max(maxW, w);
        dy += CELL + 6;
      }
      if (!dy) { mc.append(el("rect", { x, y, width: 60, height: CELL, rx: 5, class: "data-hidden-cell" }), el("text", { x: x + 30, y: y + CELL / 2 + 4.5, class: "data-hidden" }, "empty")); maxW = 60; dy = CELL + 6; }
      group.append(mc);
      return { width: maxW, height: dy - 6 };
    }
    if (shape.kind === "object") {
      const oc = el("g", { class: "data-object" });
      oc.append(el("text", { x, y: y + 10, class: "data-title" }, shape.type ?? "object"));
      let dy = 16, maxW = 0;
      for (const [name, v] of Object.entries(shape.fields ?? {})) {
        const kw = cell(oc, x, y + dy, name, "data-key");
        oc.append(el("text", { x: x + kw + 14, y: y + dy + CELL / 2 + 4.5, class: "data-arrow" }, "→"));
        const vw = slotCell(oc, x + kw + 28, y + dy, v, name, shape.kind);
        maxW = Math.max(maxW, kw + 28 + vw);
        dy += CELL + 6;
      }
      group.append(oc);
      return { width: maxW, height: dy - 6 };
    }
    // A scalar, a reference to a value drawn elsewhere, or a part that was cut: one box.
    const sc = el("g", { class: shape.kind === "scalar" ? "data-scalar" : "data-other" });
    const w = cell(sc, x, y, summary(shape));
    group.append(sc);
    return { width: w, height: CELL };
  }

  // The plain statement in place of a drawing.
  const note = (text) => dataGroup.replaceChildren(el("text", { x: 0, y: 20, class: "data-note" }, text));

  // The variables that point to objects, and the objects, from `top` down: names in a column on the left, the objects laid out as a tree (a column per level, a parent between its children),
  // an arrow for every pointer. `before` is the step before this one: a pointer that is different from there is NEW, and the arrow it replaced is drawn dashed as WAS.
  function dataGraph(scan, before, linked, top) {
    // Roots first that no object points to (the head of a list, the root of a tree), so the structure reads left to right; the stable sort keeps the order of the variables.
    const pointed = new Set([...scan.edges].filter(([key]) => !key.startsWith("var:")).map(([, to]) => to));
    const roots = [...new Set(linked.map(([name]) => scan.vars.get(name)))].sort((a, b) => pointed.has(a) - pointed.has(b));
    const order = [], seen = new Set();
    const reach = (id) => { if (seen.has(id)) return; seen.add(id); order.push(id); for (const t of scan.adj.get(id) ?? []) reach(t); };
    roots.forEach(reach);
    // Each node is drawn once, at the origin, to learn its size and where its pointers start; it is moved when the layout is known.
    const boxes = new Map();
    for (const id of order) {
      dataCtx.ports = new Map();
      const g = el("g", { class: "data-node", "data-id": id }), frame = el("rect", { class: "data-frame", rx: 8 });
      g.append(frame);
      const size = drawValue(g, scan.nodes.get(id), FRAME, FRAME), w = size.width + 2 * FRAME, h = size.height + 2 * FRAME;
      frame.setAttribute("width", w); frame.setAttribute("height", h);
      boxes.set(id, { g, w, h, ports: dataCtx.ports });
    }
    dataCtx.ports = null;

    const level = new Map(), bottom = [];
    let next = 0;
    const place = (id, depth) => {
      const at = { depth, y: 0 }, kids = [];
      level.set(id, at);
      for (const t of scan.adj.get(id) ?? []) if (!level.has(t)) { place(t, depth + 1); kids.push(t); }
      const h = boxes.get(id).h, mid = (k) => level.get(k).y + boxes.get(k).h / 2;
      let yy = kids.length ? (mid(kids[0]) + mid(kids.at(-1))) / 2 - h / 2 : next;
      yy = Math.max(yy, bottom[depth] ?? 0);
      at.y = yy; bottom[depth] = yy + h + GAP; next = Math.max(next, yy + h + GAP);
    };
    roots.forEach((id) => { if (!level.has(id)) place(id, 0); });
    const widest = [];
    for (const [id, at] of level) widest[at.depth] = Math.max(widest[at.depth] ?? 0, boxes.get(id).w);
    const colX = [LABEL + 90];
    for (let d = 1; d < widest.length; d++) colX[d] = colX[d - 1] + widest[d - 1] + COLGAP;
    const spot = new Map();
    for (const [id, at] of level) spot.set(id, { x: colX[at.depth], y: top + at.y });

    // The arrows: from a name or a pointer's dot to the left edge of its object.
    const edges = el("g", { class: "data-edges" }), defs = el("defs", {});
    for (const cls of ["data-head", "data-head-hot"]) {
      const m = el("marker", { id: cls, viewBox: "0 0 12 12", refX: 11, refY: 6, markerWidth: 10, markerHeight: 10, markerUnits: "userSpaceOnUse", orient: "auto" });
      m.append(el("path", { d: "M1 1.5L11 6L1 10.5z", class: cls }));
      defs.append(m);
    }
    // A pointer that goes forward is an S; one that goes back (a cycle, a node that points to an earlier one) dips below both ends so it does not run over the forward arrows.
    const curve = (from, to) => {
      if (to.x <= from.x + 4) { const d = 70; return `M${from.x} ${from.y} C${from.x + 60} ${from.y + d} ${to.x - 60} ${to.y + d} ${to.x} ${to.y}`; }
      const dx = Math.max(40, Math.abs(to.x - from.x) / 2);
      return `M${from.x} ${from.y} C${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
    };
    const landing = (id) => ({ x: spot.get(id).x, y: spot.get(id).y + boxes.get(id).h / 2 });
    const arrow = (key, from, to, label) => {
      const target = landing(to), was = before?.edges.get(key);
      const hot = !!before && (was !== undefined ? was !== to : !key.startsWith("var:") && before.nodes.has(Number(key.split(":")[0])));
      const path = el("path", { class: `data-edge${hot ? " rewired" : ""}`, d: curve(from, target), "data-from": key, "data-to": to, "marker-end": `url(#${hot ? "data-head-hot" : "data-head"})` });
      path.append(el("title", {}, `${label} points to #${to}${hot ? " (set by this step)" : ""}`));
      edges.append(path);
      const tag = (word, a, b) => edges.append(el("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6, class: "data-edge-tag" }, word));
      if (hot) tag("NEW", from, target);
      if (hot && was !== undefined && spot.has(was)) {
        const old = landing(was);
        edges.append(el("path", { class: "data-edge-old", d: curve(from, old), "data-from": key, "data-to": was, "marker-end": "url(#data-head-hot)" }));
        tag("WAS", from, old);
      }
    };
    for (const [id, b] of boxes) {
      const at = spot.get(id);
      b.g.setAttribute("transform", `translate(${at.x} ${at.y})`);
      for (const [slot, p] of b.ports) arrow(`${id}:${slot}`, { x: at.x + p.x, y: at.y + p.y }, p.to, slot);
    }
    const labels = el("g", { class: "data-names" });
    linked.forEach(([name, shape], i) => {
      const ly = top + i * (CELL + 24), row = el("g", { class: `data-var${shape.changed ? " changed" : ""}${name === dataPointed ? " pointed" : ""}`, "data-var": name });
      row.append(el("text", { x: LABEL, y: ly + CELL / 2 + 4.5, class: "data-label" }, name));
      if (name === dataPointed) row.append(el("text", { x: LABEL, y: ly + CELL / 2 - 11, class: "data-look" }, "LOOK HERE"));
      if (shape.changed) row.append(el("text", { x: LABEL, y: ly + CELL / 2 + 19, class: "data-changed" }, "CHANGED"));
      labels.append(row);
      arrow(`var:${name}`, { x: LABEL + 8, y: ly + CELL / 2 }, scan.vars.get(name), name);
    });
    dataGroup.append(defs, edges, labels, ...[...boxes.values()].map((b) => b.g));
    return Math.max(top + linked.length * (CELL + 24), ...[...spot].map(([id, p]) => p.y + boxes.get(id).h)) + ROW;
  }

  // The drawing as a standalone SVG: its own styles with the colours written out (the page's variables do not exist outside it), on the page's background.
  function dataSvgText() {
    const box = dataGroup.getBBox(), pad = 24, root = getComputedStyle(document.documentElement);
    const css = style.textContent.replace(/var\((--[\w-]+)\)/g, (_, name) => root.getPropertyValue(name).trim() || "currentColor");
    const svgEl = el("svg", { xmlns: NS, viewBox: `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`, width: Math.ceil(box.width + 2 * pad), height: Math.ceil(box.height + 2 * pad) });
    const copy = dataGroup.cloneNode(true);
    copy.removeAttribute("style");
    svgEl.append(el("style", {}, css), el("rect", { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad, fill: root.getPropertyValue("--bg").trim() }), copy);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svgEl)}`;
  }

  let dataPointed = null; // the variable the Tutor asked the person to look at (a prediction that points at Data)
  let dataFitted = false, dataFramed = { w: 0, h: 0 }; // the view is framed when the layer opens or the drawing outgrows the frame, not at every step
  function dataDraw() {
    if (authoredShown !== "data") return;
    const rec = pbRecording, entry = rec?.visits?.[pbIndex];
    if (!rec) return note("Press Play in the Playback panel: Data draws the variables of this function as it runs.");
    if (!entry) return note(rec.error ? `The run stopped before its first step: ${rec.error.type}.` : "Nothing was recorded.");
    if (!entry.shapes) {
      return note(rec.visits.some((v) => v.shapes) || rec.shapesTruncated
        ? "Too many values to draw: Data stops after the step where its budget ran out."
        : "This language does not record the values of a run for Data yet. Python functions do.");
    }
    dataGroup.replaceChildren();
    const scan = dataScan(entry.shapes), before = pbIndex > 0 && rec.visits[pbIndex - 1]?.shapes ? dataScan(rec.visits[pbIndex - 1].shapes) : null;
    dataCtx = { nodes: scan.nodes, ports: null };
    let y = 0, widest = 0;
    const linked = [];
    for (const [name, shape] of Object.entries(entry.shapes)) {
      if (scan.vars.has(name)) { linked.push([name, shape]); continue; }
      const row = el("g", { class: `data-var${shape.changed ? " changed" : ""}${name === dataPointed ? " pointed" : ""}`, "data-var": name });
      row.append(el("text", { x: LABEL, y: y + (shape.kind === "seq" ? EXTRA - 2 : 0) + CELL / 2 + 4.5, class: "data-label" }, name));
      if (name === dataPointed) row.append(el("text", { x: LABEL, y: y + (shape.kind === "seq" ? EXTRA - 2 : 0) + CELL / 2 - 11, class: "data-look" }, "LOOK HERE"));
      if (shape.changed) row.append(el("text", { x: LABEL, y: y + (shape.kind === "seq" ? EXTRA - 2 : 0) + CELL / 2 + 19, class: "data-changed" }, "CHANGED"));
      const size = drawValue(row, shape, LABEL + 14, y);
      dataGroup.append(row);
      widest = Math.max(widest, LABEL + 14 + size.width);
      y += Math.max(size.height, CELL + 14) + ROW;
    }
    if (linked.length) y = dataGraph(scan, before, linked, y);
    if (!y) note("This step has no variables yet.");
    else if (dataText) {
      // The same values as text, from the same step of the recording (its own text form, cut at 100 characters), in a column to the right of the drawing.
      const box = dataGroup.getBBox(), col = el("g", { class: "data-text" }), x = box.x + box.width + 60;
      col.append(el("text", { x, y: 10, class: "data-title" }, "AS TEXT"));
      Object.keys(entry.shapes).forEach((name, i) => {
        const text = String(entry.locals?.[name] ?? "");
        col.append(el("text", { x, y: 36 + i * 22, class: "data-textline", "data-name": name }, `${name} = ${text.length > 100 ? `${text.slice(0, 100)}…` : text}`));
      });
      dataGroup.append(col);
    }
    // The view is framed when the layer opens, again whenever the drawing grows past what was framed (a structure gets bigger as the run goes on), and whenever the trace table of a replay
    // would cover it (Fit leaves room for it).
    setTimeout(() => {
      const trace = $("trace-table"), g = dataGroup.getBoundingClientRect(), box = dataGroup.getBBox();
      const covered = trace && !trace.hidden && g.height > 0 && g.bottom > trace.getBoundingClientRect().top;
      const grew = box.width > dataFramed.w + 1 || box.height > dataFramed.h + 1;
      if (!dataFitted || covered || grew) { dataFitted = true; dataFramed = { w: box.width, h: box.height }; $("zoom-fit").click(); }
    }, 80);
  }

  document.addEventListener("playback-step", dataDraw);
  // The Tutor's prediction can point at Data: show that step of the open recording and mark the variable in words. False when there is nothing to show (no recording, Data not open yet).
  window.dataUi = {
    point(p) {
      if (dataTab.disabled || !pbRecording) return false;
      dataPointed = p.variable ?? null;
      showLayer("data");
      if (p.step !== undefined) pbGo(Math.min(p.step, pbRecording.visits.length - 1)); else dataDraw();
      return true;
    },
    clearPoint() { if (dataPointed === null) return; dataPointed = null; dataDraw(); },
  };
  // The tab can be chosen once a function's Flow is open; a Project drawn again drops it, like the Flow tab.
  document.addEventListener("algorithm-opened", () => { dataTab.disabled = false; dataFitted = false; });
  const dataDrawProject = draw;
  draw = async (nodes) => { dataTab.disabled = true; dataGroup.replaceChildren(); await dataDrawProject(nodes); };

  const dataShowLayer = showLayer;
  showLayer = (which) => {
    dataShowLayer(which);
    if (dataGroup.parentNode !== $("world")) $("world").append(dataGroup);
    dataGroup.style.display = which === "data" ? "" : "none";
    dataTextButton.hidden = dataSaveButton.hidden = which !== "data";
    if (which === "data") { dataFitted = false; dataFramed = { w: 0, h: 0 }; dataDraw(); }
  };

  // The legend opened from the "?" button.
  const sw = (inner) => notationSwatch(`<g style="fill:var(--raised);stroke:var(--control);stroke-width:1.4">${inner}</g>`);
  notationRegisterLegend("data", {
    shapes: [
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3"/>`), "A box: a variable and the value it holds at this step", ".data-scalar"],
      [sw(`<rect x="2" y="5" width="12" height="14" rx="2"/><rect x="16" y="5" width="12" height="14" rx="2"/><rect x="30" y="5" width="12" height="14" rx="2"/>`), "A row of cells: a list. The small number above a cell is its place, counted from 0", ".data-seq"],
      [sw(`<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M19 12H25" style="fill:none"/><rect x="28" y="5" width="14" height="14" rx="2"/>`), "A key pointing to its value: a dictionary", ".data-map"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="fill:none;stroke-dasharray:4 3"/>`), "Dashed: a part that is not drawn, with how many items are hidden", ".data-hidden-cell"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="stroke:var(--accent);stroke-width:2.4"/>`), "Heavier line and the word CHANGED: the variable the last step changed", ".data-var.changed"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="stroke:var(--accent);stroke-width:3"/>`), "Heavy blue line and the words LOOK HERE: the variable the Tutor asks you to look at", ".data-var.pointed"],
      [sw(`<rect x="2" y="2" width="40" height="20" rx="5" style="fill:var(--bg);stroke:var(--line)"/><rect x="7" y="6" width="30" height="12" rx="3"/>`), "A framed object, list or dictionary that is pointed to", ".data-frame"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3"/><circle cx="22" cy="12" r="3.5" style="fill:var(--muted);stroke:none"/>`), "A dot in a cell: a pointer. Its arrow ends at the object it points to", ".data-port"],
      [sw(`<rect x="3" y="5" width="38" height="14" rx="3" style="fill:none;stroke-dasharray:4 3"/>`), `Dashed, tagged cut: the drawing stops here, more than ${CUT_DEPTH} levels below the variable or more than ${CUT_NODES} values in one step`, ".data-cut"],
    ],
    arrows: [
      [notationSwatch(`<path d="M2 12H36" style="stroke:var(--muted);stroke-width:1.6"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:var(--muted);stroke-width:1.5"/>`), "Arrow: a name or a field that points to an object. Several arrows into one frame: several names for one object", ".data-edge:not(.rewired)"],
      [notationSwatch(`<path d="M2 12H36" style="stroke:var(--accent);stroke-width:2.6"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:var(--accent);stroke-width:1.5"/>`), "Heavy blue arrow tagged NEW: a pointer the last step set", ".data-edge.rewired"],
      [notationSwatch(`<path d="M2 12H36" style="stroke:var(--accent);stroke-width:1.6;stroke-dasharray:5 4"/><path d="M34 7L42 12L34 17" style="fill:none;stroke:var(--accent);stroke-width:1.5"/>`), "Dashed blue arrow tagged WAS: where that pointer pointed before the last step", ".data-edge-old"],
    ],
    colours: [["accent", "Blue: the variable that the last step changed, and the pointer it set"]],
    notShown: ["Values of a language that cannot record them yet (only Python does)", "An object inside a tuple, or inside a list that sits in another list or dictionary (drawn as a count or a type name)", "Anything beyond the limit of 100 items in a list or dictionary"],
  });
}
