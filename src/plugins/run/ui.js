// The Run plugin, interface half: Play and Stop all in the top bar. It asks the host half, shows what Play says (accept the recipe, a part that failed) and stays quiet otherwise.
const readyText = (p) => (p.ready ? `ready when ${Object.keys(p.ready)[0]} ${Object.values(p.ready)[0]}, shown in ${p.evidence.join(", ")}` : "no ready signal: it counts as ready when it starts");

// The Proposal of a run recipe, drawn in the chat like the other proposals (dashed outline). Accept writes .aidea/run.json; Play still asks for its own acceptance.
function recipeCard(ui, event) {
  const log = document.getElementById("chat-log");
  if (!log) return;
  const make = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const box = make("div", { className: "proposal-line" });
  box.dataset.runRecipe = event.id;
  box.append(make("strong", { textContent: event.before ? "Proposal: change the run recipe" : "Proposal: run recipe" }));
  if (event.changes) box.append(make("span", { className: "meta", textContent: `Replaces the recipe in place. Added: ${event.changes.added.join(", ") || "none"}. Removed: ${event.changes.removed.join(", ") || "none"}. Changed: ${event.changes.changed.join(", ") || "none"}.` }));
  for (const p of event.parts) {
    const waits = p.waitFor?.length ? `, after ${p.waitFor.join(", ")}` : "";
    const env = p.env?.length ? `, variables ${p.env.join(", ")}` : "";
    box.append(
      make("div", {}, make("strong", { textContent: p.name }), " ", make("code", { textContent: p.command })),
      make("span", { className: "meta", textContent: `${readyText(p)}${waits}${env}` }),
    );
  }
  const status = make("span", { className: "meta", role: "status" });
  const accept = make("button", { type: "button", textContent: "Accept" });
  const reject = make("button", { type: "button", textContent: "Reject" });
  const decide = async (decision) => {
    accept.disabled = reject.disabled = true;
    try {
      await ui.call("decide", { project: ui.project(), id: event.id, secret: event.secret, decision });
      status.textContent = decision === "accept" ? "Written to .aidea/run.json. Play will ask you to accept it before it starts anything." : "Rejected. No recipe was written.";
    } catch (e) { status.textContent = e.message; accept.disabled = reject.disabled = false; }
  };
  accept.onclick = () => decide("accept");
  reject.onclick = () => decide("reject");
  box.append(make("div", { style: "display:flex;gap:8px" }, accept, reject), status);
  log.append(box);
  log.scrollTop = log.scrollHeight;
}

export function activate(ui) {
  return ui.slots.add("layout.topbar", {
    id: "play",
    render(box) {
      const play = Object.assign(document.createElement("button"), { type: "button", textContent: "Play", title: "Start the programs of this project from its run recipe" });
      const stop = Object.assign(document.createElement("button"), { type: "button", textContent: "Stop all", title: "Stop everything Play started", hidden: true });
      // Asks the Builder (through the chat, as the person would) for the recipe. The Builder reads the Project and proposes it with its tool; nothing is written until the person accepts.
      const ASK = "Read this project once and propose its run recipe with propose_run_recipe: every program Play must start, in order, each ready signal backed by files that show it. If you find nothing observable for a part, ask me what I see when it works.";
      const ask = Object.assign(document.createElement("button"), { type: "button", textContent: "Ask the Builder for a recipe", hidden: true, title: "The Builder reads the project and proposes the run recipe for you to accept" });
      ask.dataset.askRecipe = "";
      ask.onclick = () => {
        const input = document.getElementById("chat-input");
        if (!input?.form) return;
        input.value = ASK;
        input.dispatchEvent(new Event("input"));
        input.form.requestSubmit();
        ask.hidden = true;
      };
      const note = Object.assign(document.createElement("span"), { role: "status" });
      note.style.cssText = "color:var(--muted);font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      box.append(play, stop, ask, note);
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
          ask.hidden = !(r.reason === "no-recipe" || r.reason === "invalid-recipe");
        } catch (e) { say(e.message); } finally { play.disabled = false; poll(); }
      };
      stop.onclick = async () => { await ui.call("stop", { project: ui.project() }); say("Stopped."); poll(); };
      // The Builder proposed a recipe (the chat tells the window): a card in the chat shows every part, its ready signal and the files it rests on.
      const onProposed = (e) => recipeCard(ui, e.detail);
      document.addEventListener("run-recipe-proposed", onProposed);
      timer = setInterval(poll, 1500);
      return () => { clearInterval(timer); document.removeEventListener("run-recipe-proposed", onProposed); };
    },
  });
}
