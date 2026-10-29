// Drift in the Tutor pane (ticket 12): where the built code differs from the Contract, as a plain list, with a dashed mark on the affected Nodes
// of their layers and a button that turns a difference into a class. The core derives everything (GET /drift); this only draws it.
// A difference is information: nothing here blocks the person or the builder. Names are prefixed "drift" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #drift-card { align-self: stretch; margin-top: 8px; padding: 12px; text-align: left; background: var(--raised); border: 1px solid var(--line); border-radius: 10px; }
    #drift-card[hidden] { display: none; }
    #drift-card h2 { text-align: left; }
    #drift-card p { max-width: none; margin: 4px 0 8px; font-size: 12px; }
    #drift-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    #drift-card li { font-size: 12px; color: var(--text); overflow-wrap: anywhere; }
    #drift-card .kind { display: block; margin-bottom: 2px; font: 600 10.5px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    #drift-card .row { display: flex; gap: 6px; margin-top: 4px; }
    #drift-card .row button { padding: 2px 10px; font-size: 12px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    .anode.has-drift rect, .bnote.has-drift rect { stroke: var(--danger); stroke-width: 1.5; stroke-dasharray: 5 3; }
  `;
  document.head.append(style);

  const card = Object.assign(document.createElement("section"), { id: "drift-card", hidden: true });
  card.setAttribute("aria-label", "Differences from the Contract");
  $("contract-card").before(card);

  const KINDS = {
    "broken-trace": "Link broken",
    "built-without-code": "Marked built, no code",
    "missing-relationship": "Declared, not in the code",
    "undeclared-dependency": "In the code, not declared",
    pattern: "Pattern rule",
  };
  const mk = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  let driftList = [], driftToken = 0;

  // The Nodes named by a difference carry a dashed outline on the layer it is about. Every redraw calls this again.
  function driftMark() {
    document.querySelectorAll(".anode.has-drift, .bnote.has-drift").forEach((n) => n.classList.remove("has-drift"));
    for (const d of driftList) {
      for (const id of d.nodes) {
        authoredGroup.querySelector(`g[data-layer="${d.layer}"] [data-node="${id}"]`)?.classList.add("has-drift");
      }
    }
  }

  function driftDraw() {
    card.hidden = !current;
    if (!current) return;
    const items = driftList.map((d) => {
      const show = mk("button", { type: "button", textContent: `Show on ${d.layer}` });
      show.onclick = () => showLayer(d.layer);
      const ask = mk("button", { type: "button", textContent: "Ask me about it" });
      ask.onclick = () => window.tutorUi?.startClass({ payload: { project: current, drift: d.id } });
      return mk("li", {}, mk("span", { className: "kind", textContent: `${KINDS[d.type] ?? d.type}${d.certainty === "possible" ? " (possible)" : ""}` }), d.explanation, mk("div", { className: "row" }, show, ask));
    });
    card.replaceChildren(
      mk("h2", { textContent: "Differences from the Contract" }),
      mk("p", { textContent: driftList.length ? "Where your code is not what you agreed. It is only information: nothing is blocked, and either side may be the one to change." : "No differences found between your code and what you agreed." }),
      ...(items.length ? [mk("ul", {}, ...items)] : []),
    );
  }

  async function driftRefresh() {
    const mine = ++driftToken, project = current;
    const body = project ? await fetch(`/drift?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    if (mine !== driftToken) return;
    driftList = body?.drift ?? [];
    driftDraw();
    driftMark();
  }

  const swatch = notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--danger);stroke-width:1.5;stroke-dasharray:5 3"/>`);
  for (const layer of ["requirements", "architecture"]) {
    const legend = notationLegends[layer];
    notationRegisterLegend(layer, { ...legend, shapes: [...legend.shapes, [swatch, "Dashed red outline: the code differs from what the Contract says about this Node (see the list in the Tutor column)"]] });
  }

  const drawWithoutDrift = draw;
  draw = async (nodes) => { await drawWithoutDrift(nodes); await driftRefresh(); };
  const showLayerWithoutDrift = showLayer;
  showLayer = (which) => { showLayerWithoutDrift(which); driftMark(); };
  document.addEventListener("proposals-changed", driftRefresh); // an accepted Proposal changes the Contract
}
