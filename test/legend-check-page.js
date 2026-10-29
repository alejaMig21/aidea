// Runs inside the real interface (injected by legend-check.test.ts). It opens the fixture Project, shows each layer, and writes a
// JSON report into a pre element (id legend-report) at the end of the body: per layer, the legend rows with how many drawn elements each selector matches, the colour
// tones really drawn (computed fill and stroke against the tone variables) and the class tokens drawn that no legend row covers.
(async () => {
  const report = { layers: {}, errors: [] };
  window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); }); // that one is a harmless browser notice
  window.addEventListener("unhandledrejection", (e) => report.errors.push(String(e.reason)));
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (test, what) => {
    for (let i = 0; i < 400; i++) { try { if (test()) return; } catch {} await pause(50); }
    report.errors.push(`timed out waiting for ${what}`);
  };

  // The colour of each tone variable as the browser computes it, to compare with what the layers really draw.
  const rgb = (text) => {
    const m = /^(?:rgba?|color\(srgb)\(?\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/.exec(text);
    if (!m) return null;
    const scale = text.startsWith("color(") ? 255 : 1;
    return { c: [m[1], m[2], m[3]].map((v) => Number(v) * scale), a: m[4] === undefined ? 1 : Number(m[4]) };
  };
  const probe = document.body.appendChild(document.createElement("span"));
  const tones = {};
  for (const tone of ["authored", "derived", "accent", "danger", "unresolved"]) {
    probe.style.color = `var(--${tone})`;
    tones[tone] = rgb(getComputedStyle(probe).color).c;
  }
  probe.remove();
  const toneOf = (colour) => {
    const p = rgb(colour);
    if (!p || p.a === 0) return null;
    return Object.keys(tones).find((t) => tones[t].every((v, i) => Math.abs(v - p.c[i]) < 2)) ?? null;
  };

  // The elements that belong to a layer. Components is everything in the world except the authored layers and the Algorithm graph.
  const roots = (layer) => layer === "components" ? [...$("world").children].filter((c) => c !== authoredGroup && c !== algoGroup)
    : layer === "algorithms" ? [algoGroup] : [authoredGroup.querySelector(`[data-layer="${layer}"]`)];
  const within = (layer) => roots(layer).flatMap((r) => [r, ...r.querySelectorAll("*")]);
  const matching = (layer, selector) => roots(layer).flatMap((r) => [...(r.matches(selector) ? [r] : []), ...r.querySelectorAll(selector)]);

  const seen = {}; // layer -> { rows: [count], tones: Set, uncovered: {token: tag} }
  function collect(layer) {
    const legend = notationLegends[layer];
    const into = (seen[layer] ??= { rows: {}, tones: new Set(), uncovered: {} });
    const rows = [...(legend.shapes ?? []), ...(legend.arrows ?? [])];
    const matched = new Set();
    rows.forEach((row, i) => {
      const found = typeof row[2] === "string" ? matching(layer, row[2]) : [];
      found.forEach((e) => matched.add(e));
      into.rows[i] = Math.max(into.rows[i] ?? 0, found.length);
    });
    for (const e of within(layer)) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || Number(cs.opacity) === 0 || e.closest("defs")) continue;
      if (cs.fill !== "none") { const t = toneOf(cs.fill); if (t) into.tones.add(t); }
      if (cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0) { const t = toneOf(cs.stroke); if (t) into.tones.add(t); }
      let covered = false;
      for (let n = e; n && !covered; n = n.parentElement) covered = matched.has(n);
      if (!covered) for (const token of e.classList) into.uncovered[token] ??= e.tagName.toLowerCase();
    }
  }

  openProject(window.LEGEND_PROJECT); // set by the test just before this script
  await until(() => authoredData && pendingProposals.length >= 2 && patternViolations.length >= 2 && document.querySelector(".has-drift") && document.querySelector(".has-broken"), "the Project to be drawn");

  for (const layer of ["business", "requirements", "architecture", "components"]) { showLayer(layer); await pause(100); collect(layer); }

  // Algorithms: open a function the way the UI does (double-click on its Node in Components), then record a run that raises.
  showLayer("components");
  $("world").querySelector('rect[data-id="tour.tour"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  await until(() => algoGraph && authoredShown === "algorithms" && $("pb-record"), "the Algorithm graph");
  await pause(100);
  collect("algorithms");
  $("pb-v-items").value = "[1, -2, 5, 120]";
  $("pb-v-mode").value = '"fast"';
  $("pb-v-path").value = '"missing.txt"';
  $("pb-record").click();
  await until(() => pbRecording, "the recording");
  pbGo(pbRecording.visits.length - 1);
  await pause(1000);
  collect("algorithms");
  report.recording = { steps: pbRecording.visits.length, error: pbRecording.error?.type };

  for (const [layer, got] of Object.entries(seen)) {
    const legend = notationLegends[layer];
    const rows = [...(legend.shapes ?? []), ...(legend.arrows ?? [])].map((row, i) => ({ text: row[1], selector: row[2] ?? null, why: row[3] ?? null, matches: got.rows[i] }));
    report.layers[layer] = { rows, colours: (legend.colours ?? []).map(([tone]) => tone), drawnTones: [...got.tones], uncovered: got.uncovered };
  }
  document.body.append(Object.assign(document.createElement("pre"), { id: "legend-report", textContent: JSON.stringify(report) }));
})();
