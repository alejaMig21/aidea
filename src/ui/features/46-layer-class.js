// "Teach me through it" on all five diagram layers (ticket 09). The button starts a layer class led by the Tutor (the Probe first, if the
// layer has not been checked); while the Tutor is unavailable it runs the fixed quick tour instead and says so. The teaching content comes
// from the core (GET /layers/help); Business keeps its own dimming tour from 46-business-help.js. The button is that file's opener.
{
  const style = document.createElement("style");
  style.textContent = `
    #layer-tour { position: absolute; left: 15px; right: 15px; bottom: 71px; z-index: 3; padding: 10px 12px; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; box-shadow: 0 10px 28px #0009; }
    #layer-tour .step { margin: 0 0 4px; font: 600 10.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    #layer-tour .say { margin: 0 0 8px; font-size: 13.5px; line-height: 1.5; color: var(--text); }
    #layer-tour .more { margin: 0 0 8px; font-size: 12.5px; line-height: 1.45; color: var(--label); }
    #layer-tour .more b { color: var(--text); font-weight: 600; }
    #layer-tour .row { display: flex; gap: 6px; }
    #layer-tour .row button { padding: 4px 12px; font-size: 13px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #layer-tour .row button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
    #layer-tour .row .close { margin-left: auto; }
    #layer-tour[hidden], #layer-class-note[hidden] { display: none; }
    #layer-class-note { position: absolute; left: 15px; top: 92px; z-index: 2; margin: 0; font-size: 12px; color: var(--muted); }
  `;
  document.head.append(style);

  const main = document.querySelector("main");
  const mk = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const note = mk("p", { id: "layer-class-note", hidden: true, textContent: "The Tutor is not available, so this is the quick tour." });
  note.setAttribute("role", "status");
  const stepEl = mk("p", { className: "step" }), sayEl = mk("p", { className: "say" }), moreEl = mk("p", { className: "more" });
  sayEl.setAttribute("aria-live", "polite");
  const back = mk("button", { type: "button", textContent: "Back" }), next = mk("button", { type: "button", textContent: "Next", className: "primary" });
  const close = mk("button", { type: "button", textContent: "Close", className: "close" });
  close.setAttribute("aria-label", "Close the quick tour");
  const tour = mk("div", { id: "layer-tour", hidden: true, role: "region" }, stepEl, sayEl, moreEl, mk("div", { className: "row" }, back, next, close));
  tour.setAttribute("aria-label", "Quick tour of the layer");
  main.append(note, tour);

  let helpOf = null; // the core's teaching content, fetched once
  async function help() {
    if (!helpOf) helpOf = await fetch("/layers/help").then((r) => (r.ok ? r.json() : null)).then((b) => b?.layers ?? null).catch(() => null);
    return helpOf;
  }

  // The quick tour of a layer other than Business: the layer's own introduction, then each element in order. Nothing is asked and nothing is stored.
  let steps = [], at = 0;
  const bold = (label, text) => mk("span", {}, mk("b", { textContent: `${label} ` }), text);
  function render() {
    const s = steps[at];
    stepEl.textContent = `Step ${at + 1} of ${steps.length}: ${s.title}`;
    sayEl.textContent = s.say;
    moreEl.replaceChildren(bold("Ask yourself:", s.question), mk("br"), bold(s.exampleLabel ?? "Example:", s.example));
    back.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? "Finish" : "Next";
  }
  let guideTourOpen = false; // the tour of "How aidea works" stays open while the person moves between layers to try what it says
  function closeTour() {
    tour.hidden = true;
    note.hidden = true;
    if (businessWalkOpen) businessWalkSet(false);
    if (tour.contains(document.activeElement) || document.activeElement === document.body) (guideTourOpen ? $("guide-open") : businessWalkOpener).focus();
    guideTourOpen = false;
  }
  async function quickTour(layer, unavailable) {
    layoutShowCanvas();
    note.hidden = !unavailable;
    if (layer === "business") return businessWalkSet(true);
    const l = (await help())?.[layer];
    if (!l || authoredShown !== layer) return;
    steps = [{ title: l.name, say: l.what, question: l.question, example: l.example }, ...l.order.map((id) => ({ title: l.elements[id].name, say: l.elements[id].narration, question: l.elements[id].question, example: l.elements[id].example }))];
    at = 0;
    render();
    tour.hidden = false;
    next.focus();
  }
  back.onclick = () => { at = Math.max(0, at - 1); render(); };
  next.onclick = () => { if (at === steps.length - 1) closeTour(); else { at++; render(); } };
  close.onclick = closeTour;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !tour.hidden && legendPop.hidden) closeTour(); });

  // The button: Probe if the layer was never checked, then the class; the quick tour if the Tutor cannot be reached.
  async function teach() {
    const layer = authoredShown, project = current;
    if (!project || !window.tutorUi) return quickTour(layer, false);
    closeTour();
    const stored = await fetch(`/tutor/probes?project=${encodeURIComponent(project)}&layer=${layer}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (stored && !stored.result && window.probeUi) await window.probeUi.begin(layer);
    if (project !== current || authoredShown !== layer) return;
    const unavailable = await window.tutorUi.startClass({ payload: { project, layer }, fallback: true });
    if (unavailable && project === current && authoredShown === layer) quickTour(layer, true);
  }
  businessWalkOpener.onclick = teach;

  // "How aidea works" in the top bar: a Tutor class about the app (GET /guide has the same content as the quick tour). Same fallback as above.
  async function guideTour(unavailable) {
    const body = await fetch("/guide").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const g = body?.guide;
    if (!g) return;
    steps = [{ title: g.name, say: g.what, question: g.question, example: g.example }, ...g.order.map((id) => ({ title: g.elements[id].name, say: g.elements[id].what, question: g.elements[id].question, example: g.elements[id].tryIt, exampleLabel: "Try it:" })),
      // The lessons the enabled plugins ship (plugin-lessons 01), after the parts of aidea itself.
      ...(body.plugins ?? []).flatMap((p) => p.parts.map((x) => ({ title: p.title + ": " + x.name, say: x.what, question: x.question, example: x.tryIt, exampleLabel: "Try it:" })))];
    at = 0;
    render();
    note.hidden = !unavailable;
    layoutShowCanvas();
    layoutCloseDrawer(); // in a narrow window the Tutor's drawer covers the Canvas, where the tour is
    tour.hidden = false;
    guideTourOpen = true;
    next.focus();
  }
  $("guide-open").onclick = async () => {
    const project = current;
    closeTour();
    if (!project || !window.tutorUi) return guideTour(false);
    layoutShowPane("right");
    const unavailable = await window.tutorUi.startClass({ payload: { project, guide: true }, fallback: true });
    if (unavailable && project === current) guideTour(true);
  };

  // Every layer has the button; leaving a layer ends its tour (the tour of the app stays).
  const showLayerWithoutClass = showLayer;
  showLayer = (which) => {
    if (which !== authoredShown && !guideTourOpen) { tour.hidden = true; note.hidden = true; }
    showLayerWithoutClass(which);
  };
}
