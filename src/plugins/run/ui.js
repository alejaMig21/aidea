// The Run plugin, interface half: Play and Stop all in the top bar. It asks the host half, shows what Play says (accept the recipe, a part that failed) and stays quiet otherwise.
export function activate(ui) {
  return ui.slots.add("layout.topbar", {
    id: "play",
    render(box) {
      const play = Object.assign(document.createElement("button"), { type: "button", textContent: "Play", title: "Start the programs of this project from its run recipe" });
      const stop = Object.assign(document.createElement("button"), { type: "button", textContent: "Stop all", title: "Stop everything Play started", hidden: true });
      const note = Object.assign(document.createElement("span"), { role: "status" });
      note.style.cssText = "color:var(--muted);font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      box.append(play, stop, note);
      const say = (text) => { note.textContent = note.title = text; };
      let timer = 0;
      const poll = async () => {
        const project = ui.project();
        if (!project) return;
        try {
          const { parts } = await ui.call("output", { project });
          stop.hidden = !parts.some((p) => p.alive);
        } catch { /* the core is gone or the Project closed: nothing to show */ }
      };
      const describe = (r) => {
        if (r.reason === "no-recipe") return "This project has no run recipe yet (.aidea/run.json). Ask the Builder to propose one.";
        if (r.reason === "invalid-recipe") return `The run recipe is not valid: ${r.errors.join("; ")}`;
        if (r.reason === "failed") return `${r.failed.part} ${r.failed.why}. Last lines: ${r.failed.lastLines.slice(-3).join(" / ") || "none"}. ${r.hint}`;
        return "Play could not start.";
      };
      play.onclick = async () => {
        const project = ui.project();
        if (!project) return say("Open a project first.");
        play.disabled = true;
        say("Starting...");
        try {
          let r = await ui.call("play", { project });
          if (r.reason === "needs-accept") {
            const shown = r.whole ? r.whole.parts.map((p) => `${p.name}: ${p.command}`).join("\n") : `Added: ${r.changes.added.join(", ") || "none"}. Removed: ${r.changes.removed.join(", ") || "none"}. Changed: ${r.changes.changed.join(", ") || "none"}.`;
            if (window.confirm(`${r.whole ? "This project wants to run these commands on your machine:" : "The run recipe changed since you accepted it:"}\n\n${shown}\n\nAccept and start?`)) {
              await ui.call("accept", { project });
              r = await ui.call("play", { project });
            } else { say("Not started: the recipe was not accepted."); return; }
          }
          say(r.started ? "" : describe(r)); // when it starts, Stop all appearing says it
        } catch (e) { say(e.message); } finally { play.disabled = false; poll(); }
      };
      stop.onclick = async () => { await ui.call("stop", { project: ui.project() }); say("Stopped."); poll(); };
      timer = setInterval(poll, 1500);
      return () => clearInterval(timer);
    },
  });
}
