// The Probe offer in the Tutor column (ticket 06): before a layer's first class the person may check what they know (five questions
// at most) or skip it. It never blocks: "Start a class" is always there. The questions are drawn by 50-tutor.js; the core decides
// everything (what is asked, what is stored). Names are prefixed "probe" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #probe-offer { margin: 0; font-size: 12px; color: var(--muted); }
    #pane-tutor.tutor-live #probe-offer { display: none; }
  `;
  document.head.append(style);

  // One quiet line, not a button: the person may check what they know, and "Start a class" stays the main action.
  const offer = Object.assign(document.createElement("p"), { id: "probe-offer", hidden: true });
  $("tutor-head").after(offer);

  const post = (path, body) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const layerKey = () => authoredShown; // the layer on screen: "components" is the derived view
  const layerName = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  let token = 0; // a late answer for a layer or Project that is no longer on screen is ignored

  const link = (text, onclick) => Object.assign(document.createElement("button"), { type: "button", textContent: text, onclick });
  const dot = () => document.createTextNode(" · ");

  async function refresh() {
    const mine = ++token;
    const project = current, layer = layerKey();
    if (!project || layer === "code") { offer.hidden = true; return; } // the Code layer is not a Tutor layer: it has no Probe
    let result = null;
    try {
      const res = await fetch(`/tutor/probes?project=${encodeURIComponent(project)}&layer=${layer}`);
      if (res.ok) result = (await res.json()).result;
    } catch { /* the offer is only a convenience: without the core it simply shows the unchecked state */ }
    if (mine !== token) return;
    offer.title = "";
    if (result?.status === "done") {
      const c = { known: 0, partial: 0, unknown: 0 };
      for (const t of result.topics) c[t.status]++;
      offer.title = `Known: ${c.known}, partly: ${c.partial}, new to you: ${c.unknown}`;
      offer.replaceChildren(`${layerName(layer)}: checked`, dot(), link("Redo", () => begin(layer)));
    } else if (result?.status === "skipped") {
      offer.replaceChildren(`${layerName(layer)}: check skipped`, dot(), link("Check what I know (3 to 5 questions)", () => begin(layer)));
    } else {
      offer.replaceChildren(
        `${layerName(layer)}: not checked yet`, dot(), link("Check what I know (3 to 5 questions)", () => begin(layer)),
        dot(), link("Skip", async () => { await post("/tutor/probes/skip", { project, layer }).catch(() => null); refresh(); }),
      );
    }
    offer.hidden = false;
  }

  function begin(layer) {
    const project = current;
    if (!project || !window.tutorUi) return;
    return window.tutorUi.startClass({
      path: "/tutor/probes",
      payload: { project, layer, redo: true },
      endLabel: "Skip probe",
      ended: "The check is over. You can start a class.",
      // Stopping the Probe is a skip: the core stores it and ends the stream; if it cannot be reached, closing the stream does the same job.
      skip: async () => {
        const res = await post("/tutor/probes/skip", { project, layer }).catch(() => null);
        if (!res?.ok) window.tutorUi.abort();
      },
      after: refresh,
    });
  }

  window.probeUi = { begin }; // the layer class (46-layer-class.js) runs the Probe first when the layer was never checked
  document.addEventListener("project-opened", refresh);
  const showLayerWithoutProbe = showLayer; // however a layer is shown (tab, View code, a step), each layer has its own Probe
  showLayer = (which) => { showLayerWithoutProbe(which); refresh(); };
}
