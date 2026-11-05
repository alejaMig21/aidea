// The host half of the Terminal: it gives the Tutor a snapshot of the tabs (what each program started with Play has written), for the view and the check of the teaching surface.
// The output belongs to the Run plugin; the Terminal asks it through its service, and has nothing to show when Run is off. At most the last 20 lines of each tab travel.
const LAST = 20;

export function activate(ctx) {
  ctx.teach.state(({ project } = {}) => {
    const output = ctx.services.get("run.output");
    if (!project || typeof output !== "function") return { parts: [] };
    return { parts: output({ project }).parts.map((p) => ({ name: p.name, alive: p.alive, exit: p.exit ?? null, lines: p.lines.slice(-LAST) })) };
  });
}
