// The view and the checks of the Terminal for the Tutor. They run on the snapshot from main.js, read-only.
export const view = (snapshot) => ({
  tabs: snapshot.parts.map((p) => ({ name: p.name, running: p.alive, exitCode: p.exit, lastLines: p.lines.slice(-5) })),
});

export const checks = {
  "program-wrote": (snapshot, { program }) => {
    const tab = snapshot.parts.find((p) => p.name === program);
    if (!tab) return { ok: false, reason: `There is no tab for a program called ${program}.` };
    return tab.lines.length > 0 ? { ok: true, reason: `The program ${program} wrote to its tab.` } : { ok: false, reason: `The tab of ${program} is empty.` };
  },
};
