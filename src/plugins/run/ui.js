// The Run plugin, interface half: Play and Stop all in the top bar. It asks the host half, shows what Play says (accept the recipe, a part that failed) and stays quiet otherwise.
// A part as the consent dialog shows it: its command, then where it runs, what it waits for, its ready signal, its variable names and its limit (the whole recipe, story 8).
const partLines = (p) => [`${p.name}: ${p.command}`, `  ${[
  p.folder && p.folder !== "." ? `in ${p.folder}` : null,
  p.waitFor?.length ? `after ${p.waitFor.join(", ")}` : null,
  p.ready ? `ready when ${Object.keys(p.ready)[0]} ${Object.values(p.ready)[0]}` : "no ready signal",
  p.env?.length ? `variables ${p.env.join(", ")}` : null,
  `limit ${p.timeoutSeconds} s`,
].filter(Boolean).join(" · ")}`];

// What Play offers to ask the Builder, by what Play just answered (null: nothing). A recipe when there is none or it is not valid; a review when a part failed, because the recipe may be
// out of date. The Builder reads the Project and proposes with its tool; nothing is written until the person accepts. A review that finds the recipe right proposes nothing.
export function askAbout(reason) {
  if (reason === "no-recipe" || reason === "invalid-recipe") return { label: "Ask the Builder for a recipe", title: "The Builder reads the project and proposes the run recipe for you to accept", message: "Read this project once and propose its run recipe with propose_run_recipe: every program Play must start, in order, each ready signal backed by files that show it. If you find nothing observable for a part, ask me what I see when it works." };
  if (reason === "failed") return { label: "Ask the Builder to review the recipe", title: "The Builder reads the project again and tells you whether the run recipe still matches how it starts", message: "A part of the run recipe failed to start. Read this project again and review the current run recipe with propose_run_recipe: if it no longer matches how the project starts, propose the corrected recipe; if it is right, say so and do not propose anything." };
  return null;
}

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
  box.append(make("div", { className: "row" }, accept, reject), status);
  log.append(box);
  log.scrollTop = log.scrollHeight;
}

export function activate(ui) {
  return ui.slots.add("layout.topbar", {
    id: "play",
    render(box) {
      const play = Object.assign(document.createElement("button"), { type: "button", textContent: "Play", title: "Start the programs of this project from its run recipe" });
      const stop = Object.assign(document.createElement("button"), { type: "button", textContent: "Stop all", title: "Stop everything Play started", hidden: true });
      // Asks the Builder through the chat, as the person would: one click, one message (askAbout says which).
      const ask = Object.assign(document.createElement("button"), { type: "button", hidden: true });
      ask.dataset.askRecipe = "";
      let asking = null;
      ask.onclick = () => {
        if (!asking || !window.chatUi) return;
        window.chatUi.send(asking.message);
        ask.hidden = true;
      };
      // After a failure the message says the Terminal shows the errors in depth: one action opens it (run-and-terminal 06).
      const terminal = Object.assign(document.createElement("button"), { type: "button", textContent: "Open the Terminal", title: "Show the output of the programs, one tab each", hidden: true });
      terminal.onclick = () => { ui.panels.show("terminal"); terminal.hidden = true; };
      const note = Object.assign(document.createElement("span"), { role: "status" });
      note.style.cssText = "color:var(--muted);font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      box.append(play, stop, ask, terminal, note);
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
            const lines = r.whole ? r.whole.parts.flatMap(partLines) : [`Added: ${r.changes.added.join(", ") || "none"}`, `Removed: ${r.changes.removed.join(", ") || "none"}`, `Changed: ${r.changes.changed.join(", ") || "none"}`];
            const yes = await ui.confirm({
              title: r.whole ? "This project wants to run these commands on your machine" : "The run recipe changed since you accepted it",
              message: r.whole ? "Read them before you accept. They run with your own permissions." : "Only what changed is shown. Accepting lets the whole recipe run again.",
              lines, accept: "Accept and start", cancel: "Cancel",
            });
            if (yes) {
              await ui.call("accept", { project });
              r = await ui.call("play", { project });
            } else { say("Not started: the recipe was not accepted."); return; }
          }
          say(r.started ? "" : describe(r)); // when it starts, Stop all appearing says it
          terminal.hidden = r.reason !== "failed";
          asking = askAbout(r.reason);
          ask.hidden = !asking;
          if (asking) { ask.textContent = asking.label; ask.title = asking.title; }
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
