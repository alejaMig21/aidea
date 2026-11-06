// The animation engine (animation-and-data 08). A consumer hands it a recording: { steps: [{ label, pieces: [{ id, kind, name?, data }] }] }. Each step is a whole picture; elements inside a piece carry ids
// that stay the same from step to step, so the engine finds what is NEW and what is CHANGED by comparing a picture with the one before it (the recording marks nothing). Pieces are drawn by the
// registry: a kind has `elements(piece)` (id -> a text that changes when the element changes), `draw(ctx)` and `text(piece)`. The engine draws the note of a cut piece (`data.hidden`), the text form and
// the saved image, and animates one step forward. Names here are prefixed "eng" because every feature file shares one global scope.
const animEngine = (() => {
  const CELL = 30, PAD = 8, ROW = 52, FRACTION = 0.7; // a transition lasts about 70% of a step at the Playback speed
  const pieces = new Map();
  const plain = (n) => n.toLocaleString("en-US");
  const cutNote = (n) => `… and ${plain(n)} more`;

  const style = document.createElement("style");
  style.textContent = `
    .eng-cell { fill: var(--raised); stroke: var(--control); stroke-width: 1.4; }
    .eng-cell.new, .eng-cell.changed { stroke: var(--accent); stroke-width: 2.4; }
    .eng-value { fill: var(--text); font: 12.5px var(--mono); text-anchor: middle; }
    .eng-tag, .eng-was { fill: var(--accent); font: 600 11px var(--sans); letter-spacing: .08em; text-anchor: middle; }
    .eng-was { fill: var(--muted); font-weight: 400; letter-spacing: 0; }
    .eng-cut { fill: var(--muted); font: 12px var(--sans); }
  `;
  document.head.append(style);

  pieces.set("list", {
    elements: (p) => new Map(p.data.cells.map((c) => [c.id, String(c.value)])),
    draw({ g, piece, mark, was, track }) {
      piece.data.cells.forEach((c, i) => {
        const m = mark(c.id), x = i * (CELL + 4), cell = el("g", { "data-id": c.id });
        cell.append(el("rect", { class: `eng-cell${m ? ` ${m}` : ""}`, "data-id": c.id, x, y: 14, width: CELL, height: CELL, rx: 3 }));
        cell.append(el("text", { x: x + CELL / 2, y: 33, class: "eng-value" }, String(c.value)));
        if (m) cell.append(el("text", { x: x + CELL / 2, y: 10, class: "eng-tag", "data-id": c.id }, m.toUpperCase()));
        if (m === "changed") cell.append(el("text", { x: x + CELL / 2, y: 58, class: "eng-was", "data-id": c.id }, `WAS ${was(c.id)}`));
        g.append(cell);
        track(c.id, cell, { x, y: 0 });
      });
      if (piece.data.hidden) g.append(el("text", { x: piece.data.cells.length * (CELL + 4) + 4, y: 33, class: "eng-cut" }, cutNote(piece.data.hidden)));
    },
    text: (p) => `[${[...p.data.cells.map((c) => c.value), ...(p.data.hidden ? [cutNote(p.data.hidden)] : [])].join(", ")}]`,
  });

  // What the picture `now` has that `before` has not (NEW), what has another value (CHANGED), and the value it had.
  function compare(before, now) {
    const marks = new Map(), olds = new Map();
    for (const piece of now?.pieces ?? []) {
      const kind = pieces.get(piece.kind), earlier = before?.pieces.find((p) => p.id === piece.id);
      if (!kind || !earlier || earlier.kind !== piece.kind) continue; // a piece with no earlier picture is drawn without marks
      const old = kind.elements(earlier), cur = kind.elements(piece);
      for (const [id, sig] of cur) {
        marks.set(`${piece.id}/${id}`, !old.has(id) ? "new" : old.get(id) !== sig ? "changed" : null);
        olds.set(`${piece.id}/${id}`, old.get(id));
      }
    }
    return { marks, olds };
  }

  const textOf = (picture) => (picture?.pieces ?? []).map((p) => { const t = pieces.get(p.kind)?.text(p); return t === undefined ? "" : p.name ? `${p.name} = ${t}` : t; }).filter(Boolean).join("\n");

  function mount(host, options = {}) {
    const speed = options.speed ?? (() => 600), animated = options.animated ?? (() => false);
    let shown = -1, where = new Map(); // the step on screen and where each element was drawn
    function show(recording, index) {
      const picture = recording.steps[index], { marks, olds } = compare(recording.steps[index - 1], picture);
      const forward = animated() && shown >= 0 && index === shown + 1, wasAt = where;
      where = new Map();
      host.replaceChildren();
      (picture?.pieces ?? []).forEach((piece, row) => {
        const kind = pieces.get(piece.kind);
        if (!kind) return;
        const g = el("g", { class: "eng-piece", "data-id": piece.id, transform: `translate(${PAD},${row * ROW})` });
        host.append(g);
        kind.draw({
          g, piece,
          mark: (id) => marks.get(`${piece.id}/${id}`) ?? null,
          was: (id) => olds.get(`${piece.id}/${id}`),
          // Where an element sits, so the next step can move it from there (or fade it in when it is new).
          track(id, node, at) {
            const key = `${piece.id}/${id}`, from = wasAt.get(key);
            where.set(key, at);
            if (!forward) return;
            const duration = Math.round(speed() * FRACTION);
            if (from) node.animate([{ transform: `translate(${from.x - at.x}px, ${from.y - at.y}px)` }, { transform: "translate(0, 0)" }], { duration, easing: "ease-in-out" });
            else node.animate([{ opacity: 0 }, { opacity: 1 }], { duration });
          },
        });
      });
      shown = index;
    }
    return {
      show,
      text: (recording, index) => textOf(recording.steps[index]),
      // The picture on screen as a standalone SVG: the page's colours are written out because a saved file has no page variables.
      svg() {
        const box = host.getBBox(), pad = 24, root = getComputedStyle(document.documentElement);
        const css = style.textContent.replace(/var\((--[\w-]+)\)/g, (_, name) => root.getPropertyValue(name).trim() || "currentColor");
        const out = el("svg", { xmlns: NS, viewBox: `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`, width: Math.ceil(box.width + 2 * pad), height: Math.ceil(box.height + 2 * pad) });
        out.append(el("style", {}, css), el("rect", { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad, fill: root.getPropertyValue("--bg").trim() }), host.cloneNode(true));
        return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(out)}`;
      },
    };
  }
  // The slot `engine.piece` of the plugin API (docs/plugin-api.md): a plugin registers a piece of its own in the same registry the pieces of aidea use.
  pluginSlotDeclare("engine.piece", {
    kind: "list",
    add(entry) {
      if (!entry || typeof entry.kind !== "string" || typeof entry.elements !== "function" || typeof entry.draw !== "function" || typeof entry.text !== "function") throw new Error('a piece needs a "kind" and the functions "elements", "draw" and "text"');
      if (pieces.has(entry.kind)) throw new Error(`the piece "${entry.kind}" already exists`);
      pieces.set(entry.kind, entry);
      return () => { if (pieces.get(entry.kind) === entry) pieces.delete(entry.kind); };
    },
  });
  return { pieces, mount };
})();
