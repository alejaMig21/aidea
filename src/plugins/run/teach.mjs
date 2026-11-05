// The view and the checks of the Run plugin for the Tutor. They run on the snapshot from main.js, read-only.
export const view = (snapshot) => ({
  recipe: snapshot.recipe,
  recipeErrors: snapshot.errors,
  programs: snapshot.parts.map((p) => ({ name: p.name, running: p.alive, exitCode: p.exit })),
});

export const checks = {
  "recipe-accepted": (snapshot) => (snapshot.recipe === "accepted" ? { ok: true, reason: "The run recipe is accepted." } : { ok: false, reason: `The run recipe is ${snapshot.recipe}, not accepted.` }),
  "part-running": (snapshot, { program }) => {
    const p = snapshot.parts.find((x) => x.name === program);
    if (!p) return { ok: false, reason: `There is no program called ${program} started by Play.` };
    return p.alive ? { ok: true, reason: `${program} is running.` } : { ok: false, reason: `${program} is not running.` };
  },
  "all-running": (snapshot) => {
    if (!snapshot.parts.length) return { ok: false, reason: "Play has not started any program." };
    const stopped = snapshot.parts.filter((p) => !p.alive).map((p) => p.name);
    return stopped.length ? { ok: false, reason: `Not running: ${stopped.join(", ")}.` } : { ok: true, reason: "Every program started by Play is running." };
  },
};
