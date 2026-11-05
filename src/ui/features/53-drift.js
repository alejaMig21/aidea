// Drift in the Tutor pane (ticket 12): where the built code differs from the Contract, as a plain list, with a dashed mark on the affected Nodes
// of their layers and a button that turns a difference into a class. The core derives everything (GET /drift); this only draws it.
// A difference is information: nothing here blocks the person or the builder. Names are prefixed "drift" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #drift-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    #drift-card li { font-size: 13px; color: var(--label); overflow-wrap: anywhere; }
    #drift-card .kind { display: block; margin-bottom: 2px; font: 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    #drift-card .row { display: flex; gap: 8px; margin-top: 6px; }
    #drift-card .row button { padding: 3px 10px; font-size: 12px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    .anode.has-drift rect, .bnote.has-drift rect { stroke: var(--danger); stroke-width: 1.5; stroke-dasharray: 5 3; }
    .anode.has-waiting rect, .bnote.has-waiting rect { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 3; }
  `;
  document.head.append(style);

  const section = tutorSection("drift", "Differences");
  const card = section.el;
  $("contract-card").before(card);

  const KINDS = {
    "broken-trace": "Link broken",
    "built-without-code": "Marked built, no code",
    "missing-relationship": "Declared, not in the code",
    "undeclared-dependency": "In the code, not declared",
    pattern: "Pattern rule",
    "not-built-yet": "Not built yet",
  };
  const mk = uiMake;
  let driftList = [], driftToken = 0;

  // The Nodes named by a difference carry a dashed outline on the layer it is about. Every redraw calls this again.
  function driftMark() {
    document.querySelectorAll(".anode.has-drift, .bnote.has-drift, .anode.has-waiting, .bnote.has-waiting").forEach((n) => n.classList.remove("has-drift", "has-waiting"));
    for (const d of driftList) {
      for (const id of d.nodes) {
        authoredGroup.querySelector(`g[data-layer="${d.layer}"] [data-node="${id}"]`)?.classList.add(d.type === "not-built-yet" ? "has-waiting" : "has-drift");
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
    section.summarise(driftList.length ? String(driftList.length) : "none");
    section.body.replaceChildren(
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
  const waiting = notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:2 3"/>`);
  for (const layer of ["business", "requirements", "architecture"]) {
    const legend = notationLegends[layer];
    notationRegisterLegend(layer, { ...legend, shapes: [...legend.shapes, [swatch, "Dashed red outline: the code differs from what the Contract says about this Node (see the list in the Tutor panel)", ".has-drift"], ...(layer === "requirements" ? [[waiting, "Dotted grey outline: a requirement not built yet, only a question to ask (see the Tutor panel)", ".has-waiting"]] : [])] });
  }

  const drawWithoutDrift = draw;
  draw = async (nodes) => { await drawWithoutDrift(nodes); await driftRefresh(); };
  const showLayerWithoutDrift = showLayer;
  showLayer = (which) => { showLayerWithoutDrift(which); driftMark(); };
  document.addEventListener("proposals-changed", driftRefresh); // an accepted Proposal changes the Contract
}
