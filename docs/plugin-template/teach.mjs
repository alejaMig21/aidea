// The view and the checks the Tutor can use. They run on the snapshot from main.js, read-only: no writing, no programs, no network.
export const view = (snapshot) => snapshot;

export const checks = {
  // Each check answers { ok: true | false, reason: "one short sentence" }. Name them in aidea-plugin.json too.
  "is-open": (snapshot) => ({ ok: snapshot.open === true, reason: snapshot.open === true ? "The Panel is open." : "The Panel is not open." }),
};
