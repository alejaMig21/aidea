// The view and the checks of the Contract plugin for the Tutor. They run on the snapshot from main.js, read-only.
export const view = (snapshot) => ({
  agreed: snapshot.readiness.map((c) => ({ id: c.id, met: c.met, text: c.text })),
  differences: snapshot.drift.map((d) => ({ type: d.type, layer: d.layer, nodes: d.nodes, certainty: d.certainty ?? "certain", explanation: d.explanation })),
});

export const checks = {
  "check-met": (snapshot, { id }) => {
    const c = snapshot.readiness.find((x) => x.id === id);
    if (!c) return { ok: false, reason: `The Contract has no check called ${id}.` };
    return { ok: c.met, reason: c.text };
  },
  "no-differences": (snapshot) => {
    const real = snapshot.drift.filter((d) => d.type !== "not-built-yet");
    return real.length ? { ok: false, reason: `${real.length} difference${real.length === 1 ? "" : "s"} between the code and the Contract.` } : { ok: true, reason: "The code has no difference with the Contract." };
  },
};
