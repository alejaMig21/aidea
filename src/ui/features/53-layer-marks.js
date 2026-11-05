// The slot `layer.marks` of the plugin API (docs/plugin-api.md): a plugin marks Nodes of the authored layers with one of the marks below and adds the lines of the legend that explain them.
// The page draws the marks and keeps them across every redraw; the plugin only says which Nodes. It also tells plugins when the Project was drawn ("project-drawn", see ui.on in 02-plugins.js).
// Names are prefixed "marks" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    .anode.has-drift rect, .bnote.has-drift rect { stroke: var(--danger); stroke-width: 1.5; stroke-dasharray: 5 3; }
    .anode.has-waiting rect, .bnote.has-waiting rect { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 3; }
  `;
  document.head.append(style);

  const MARKS = {
    differs: { cls: "has-drift", swatch: notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--danger);stroke-width:1.5;stroke-dasharray:5 3"/>`) },
    waiting: { cls: "has-waiting", swatch: notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:2 3"/>`) },
  };
  const LAYERS = ["business", "requirements", "architecture"];
  const sources = new Map(); // one entry of one plugin -> its list of { layer, node, mark }

  function marksApply() {
    document.querySelectorAll(Object.values(MARKS).map((m) => `.${m.cls}`).join(",")).forEach((n) => n.classList.remove(...Object.values(MARKS).map((m) => m.cls)));
    for (const list of sources.values()) {
      for (const { layer, node, mark } of list) {
        const at = (s) => String(s).replace(/["\\]/g, (c) => "\\" + c);
        authoredGroup.querySelector(`g[data-layer="${at(layer)}"] [data-node="${at(node)}"]`)?.classList.add(MARKS[mark].cls);
      }
    }
  }

  pluginSlotDeclare("layer.marks", {
    kind: "list",
    // entry: { legend?: [{ layers: ["architecture", ...], mark: "differs" | "waiting", text }], attach(api) -> dispose }; api.set(list) replaces the marks of this entry.
    add(entry, owner) {
      if (!entry || typeof entry.attach !== "function") throw new Error('a marks entry needs an "attach" function');
      const key = Symbol(owner);
      const rows = [];
      for (const line of entry.legend ?? []) {
        if (!MARKS[line?.mark] || typeof line.text !== "string" || !Array.isArray(line.layers) || line.layers.some((l) => !LAYERS.includes(l))) throw new Error('a legend line is { layers, mark: "differs" or "waiting", text }');
        for (const layer of line.layers) rows.push([layer, [MARKS[line.mark].swatch, line.text, `.${MARKS[line.mark].cls}`]]);
      }
      for (const [layer, row] of rows) (notationLegends[layer].shapes ??= []).push(row);
      let dispose;
      const api = {
        set(list) {
          if (!Array.isArray(list)) throw new Error("marks.set needs a list");
          sources.set(key, list.filter((m) => m && LAYERS.includes(m.layer) && typeof m.node === "string" && MARKS[m.mark]));
          marksApply();
        },
      };
      try { dispose = entry.attach(api); } catch (e) { for (const [layer, row] of rows) notationLegends[layer].shapes.splice(notationLegends[layer].shapes.indexOf(row), 1); throw e; }
      notationRenderLegend();
      return () => {
        try { if (typeof dispose === "function") dispose(); } finally {
          sources.delete(key);
          for (const [layer, row] of rows) { const s = notationLegends[layer].shapes; const i = s.indexOf(row); if (i >= 0) s.splice(i, 1); }
          marksApply();
          notationRenderLegend();
        }
      };
    },
  });

  const drawWithoutMarks = draw;
  draw = async (nodes) => { await drawWithoutMarks(nodes); marksApply(); document.dispatchEvent(new Event("project-drawn")); };
  const showLayerWithoutMarks = showLayer;
  showLayer = (which) => { showLayerWithoutMarks(which); marksApply(); };
}
