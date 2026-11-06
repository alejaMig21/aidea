// The status of a Node's evidence (layer-inference 03) on its box and in the legend. Observed has no mark (it is what the code shows, or what the person wrote); inferred and unknown do.
// The words are in the Node's details (evidenceLines, 20-authored.js). Names are prefixed "evidence" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    .anode.ev-inferred:not(.has-drift) rect, .bnote.ev-inferred:not(.has-drift) rect { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 1 4; stroke-linecap: round; }
    .anode.ev-unknown:not(.has-drift) rect, .bnote.ev-unknown:not(.has-drift) rect { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 8 3 1 3; }
  `;
  document.head.append(style);

  const inferred = notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:1 4;stroke-linecap:round"/>`);
  const unknown = notationSwatch(`<rect x="4" y="4" width="36" height="16" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:8 3 1 3"/>`);
  for (const layer of ["business", "requirements", "architecture"]) {
    const legend = notationLegends[layer];
    notationRegisterLegend(layer, { ...legend, shapes: [...legend.shapes,
      [inferred, "Dotted outline: inferred from the code, not seen directly (the Node's details say where from)", ".ev-inferred"],
      [unknown, "Dash-dot outline: not known; the Node's details say why", ".ev-unknown"]] });
  }

  function evidenceMark() {
    authoredGroup.querySelectorAll(".ev-inferred, .ev-unknown").forEach((n) => n.classList.remove("ev-inferred", "ev-unknown"));
    for (const [layer, { nodes }] of Object.entries(authoredData?.layers ?? {})) {
      for (const n of nodes) {
        if (n.evidence?.status !== "inferred" && n.evidence?.status !== "unknown") continue;
        authoredGroup.querySelector(`g[data-layer="${layer}"] [data-node="${String(n.id).replace(/["\\]/g, (c) => "\\" + c)}"]`)?.classList.add(`ev-${n.evidence.status}`);
      }
    }
  }

  const drawWithoutEvidence = draw;
  draw = async (nodes) => { await drawWithoutEvidence(nodes); evidenceMark(); };
  const showLayerWithoutEvidence = showLayer;
  showLayer = (which) => { showLayerWithoutEvidence(which); evidenceMark(); }; // the Architecture layer draws itself again when it is shown
}
