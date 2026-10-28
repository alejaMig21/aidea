// The Probe offer in the Tutor column (ticket 06): before a layer's first class the person may check what they know (five questions
// at most) or skip it. It never blocks: "Start a class" is always there. The questions are drawn by 50-tutor.js; the core decides
// everything (what is asked, what is stored). Names are prefixed "probe" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #probe-offer { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0 0 6px; }
    #probe-offer .probe-status { margin: 0; font-size: 12px; color: var(--muted); }
    #probe-offer .probe-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    #probe-offer button { margin: 0; }
    #probe-offer button.probe-main { background: var(--accent); color: var(--on-accent); border: 0; }
    #pane-tutor.tutor-live #probe-offer { display: none; }
    #pane-tutor.tutor-over #probe-offer { align-items: flex-start; }
  `;
  document.head.append(style);

  const offer = Object.assign(document.createElement("div"), { id: "probe-offer", hidden: true });
  offer.setAttribute("aria-label", "Check what you know before the class");
  $("tutor-start").before(offer);

  const post = (path, body) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const layerKey = () => authoredShown; // the layer on screen: "components" is the derived view
  const layerName = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  let token = 0; // a late answer for a layer or Project that is no longer on screen is ignored

  function button(text, onclick, main) {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, onclick });
    if (main) b.className = "probe-main";
    return b;
  }

  async function refresh() {
    const mine = ++token;
    const project = current, layer = layerKey();
    if (!project) { offer.hidden = true; return; }
    let result = null;
    try {
      const res = await fetch(`/tutor/probes?project=${encodeURIComponent(project)}&layer=${layer}`);
      if (res.ok) result = (await res.json()).result;
    } catch { /* the offer is only a convenience: without the core it simply shows the unchecked state */ }
    if (mine !== token) return;
    const status = Object.assign(document.createElement("p"), { className: "probe-status" });
    const buttons = Object.assign(document.createElement("div"), { className: "probe-buttons" });
    if (result?.status === "done") {
      const c = { known: 0, partial: 0, unknown: 0 };
      for (const t of result.topics) c[t.status]++;
      status.textContent = `${layerName(layer)} check: Known: ${c.known}, partly: ${c.partial}, new to you: ${c.unknown}`;
      buttons.append(button("Redo the check", () => begin(layer)));
    } else if (result?.status === "skipped") {
      status.textContent = `${layerName(layer)} check skipped`;
      buttons.append(button("Check what I know (5 questions)", () => begin(layer)));
    } else {
      status.textContent = `${layerName(layer)}: not checked yet`;
      buttons.append(
        button("Check what I know first (5 questions)", () => begin(layer), true),
        button("Skip", async () => { await post("/tutor/probes/skip", { project, layer }).catch(() => null); refresh(); }),
      );
    }
    offer.replaceChildren(status, buttons);
    offer.hidden = false;
  }

  function begin(layer) {
    const project = current;
    if (!project || !window.tutorUi) return;
    window.tutorUi.startClass({
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

  document.addEventListener("project-opened", refresh);
  $("layers").addEventListener("click", () => setTimeout(refresh, 0)); // the layer tabs: each layer has its own Probe
}
