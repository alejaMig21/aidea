// The Data layer (layout-and-data 14), next to Flow in the layer bar. While a function is played it draws the variables the recording holds at the step being shown (the core records their
// shape: Python today): a scalar as a labelled box, a list as a row of cells with their places, a dictionary as keys pointing to values, an object as a box with its fields. What the last step
// changed is marked in words (CHANGED) as well as by its look. Data follows the one Playback position with Flow, the Playback panel and the trace table. Nobody writes it. Names are prefixed
// "data" because every feature file shares one global scope.
{
  const dataGroup = el("g", { id: "data" });
  const dataTab = Object.assign(document.createElement("button"), { textContent: "Data", disabled: true, title: "Open a function's Flow first: Data draws its variables while it is played" });
  dataTab.dataset.layer = "data";
  dataTab.onclick = () => showLayer("data");
  layerBar.append(dataTab);

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
    #data .data-note { fill: var(--muted); font: 13px var(--sans); }
  `;
  document.head.append(style);

  const LABEL = 120, CELL = 30, PAD = 8, ROW = 22, EXTRA = 16;
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
    return "…";
  }

  // One box with its text, at (x, y); returns where it ends.
  function cell(group, x, y, text, cls = "data-value", box = "data-box") {
    const w = widthOf(text);
    group.append(el("rect", { x, y, width: w, height: CELL, rx: 5, class: box }), el("text", { x: x + w / 2, y: y + CELL / 2 + 4.5, class: cls }, text));
    return w;
  }

  // Draws one value at (x, y) into `group` and returns its size.
  function drawValue(group, shape, x, y) {
    if (shape.kind === "seq") {
      const sc = el("g", { class: "data-seq" });
      let dx = 0;
      (shape.items ?? []).forEach((item, i) => {
        const text = summary(item), w = widthOf(text);
        sc.append(el("text", { x: x + dx + w / 2, y: y + 11, class: "data-pos" }, String(i)));
        sc.append(el("rect", { x: x + dx, y: y + EXTRA - 2, width: w, height: CELL, rx: 5, class: "data-box data-cell" }), el("text", { x: x + dx + w / 2, y: y + EXTRA - 2 + CELL / 2 + 4.5, class: "data-value" }, text));
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
      for (const [k, v] of shape.entries ?? []) {
        const pair = el("g", { class: "data-pair" });
        const kw = cell(pair, x, y + dy, summary(k), "data-key");
        pair.append(el("text", { x: x + kw + 14, y: y + dy + CELL / 2 + 4.5, class: "data-arrow" }, "→"));
        const vw = cell(pair, x + kw + 28, y + dy, summary(v));
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
        const vw = cell(oc, x + kw + 28, y + dy, summary(v));
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

  let dataFitted = false; // the view is framed once when the layer opens, not at every step
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
    let y = 0, widest = 0;
    for (const [name, shape] of Object.entries(entry.shapes)) {
      const row = el("g", { class: `data-var${shape.changed ? " changed" : ""}`, "data-var": name });
      row.append(el("text", { x: LABEL, y: y + (shape.kind === "seq" ? EXTRA - 2 : 0) + CELL / 2 + 4.5, class: "data-label" }, name));
      if (shape.changed) row.append(el("text", { x: LABEL, y: y + (shape.kind === "seq" ? EXTRA - 2 : 0) + CELL / 2 + 19, class: "data-changed" }, "CHANGED"));
      const size = drawValue(row, shape, LABEL + 14, y);
      dataGroup.append(row);
      widest = Math.max(widest, LABEL + 14 + size.width);
      y += Math.max(size.height, CELL + 14) + ROW;
    }
    if (!y) note("This step has no variables yet.");
    // The view is framed when the layer opens, and again whenever the trace table of a replay would cover the drawing (Fit leaves room for it).
    setTimeout(() => {
      const trace = $("trace-table"), g = dataGroup.getBoundingClientRect();
      const covered = trace && !trace.hidden && g.height > 0 && g.bottom > trace.getBoundingClientRect().top;
      if (!dataFitted || covered) { dataFitted = true; $("zoom-fit").click(); }
    }, 80);
  }

  document.addEventListener("playback-step", dataDraw);
  // The tab can be chosen once a function's Flow is open; a Project drawn again drops it, like the Flow tab.
  document.addEventListener("algorithm-opened", () => { dataTab.disabled = false; dataFitted = false; });
  const dataDrawProject = draw;
  draw = async (nodes) => { dataTab.disabled = true; dataGroup.replaceChildren(); await dataDrawProject(nodes); };

  const dataShowLayer = showLayer;
  showLayer = (which) => {
    dataShowLayer(which);
    if (dataGroup.parentNode !== $("world")) $("world").append(dataGroup);
    dataGroup.style.display = which === "data" ? "" : "none";
    if (which === "data") { dataFitted = false; dataDraw(); }
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
    ],
    arrows: [],
    colours: [["accent", "Blue: the variable that the last step changed"]],
    notShown: ["Values of a language that cannot record them yet (only Python does)", "Objects that point to other objects are drawn as a reference, not as nodes and arrows (not yet)", "Anything beyond the limit of 100 items in a list or dictionary"],
  });
}
