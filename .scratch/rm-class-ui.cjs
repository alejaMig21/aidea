const fs = require("fs");
function edit(f, pairs) {
  let t = fs.readFileSync(f, "utf8"); const eol = t.includes("\r\n") ? "\r\n" : "\n";
  for (const [a, b] of pairs) { const A = a.replace(/\n/g, eol), B = b.replace(/\n/g, eol); if (!t.includes(A)) throw new Error("nf " + f + ": " + a.slice(0, 90)); t = t.replace(A, () => B); }
  fs.writeFileSync(f, t);
}
function cut(f, from, to, keepTo = true) {
  let t = fs.readFileSync(f, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error("markers in " + f + ": " + from.slice(0, 50));
  fs.writeFileSync(f, t.slice(0, a) + t.slice(keepTo ? b : b + to.length));
}
// 35-agent-options.js
const A = "src/ui/features/35-agent-options.js";
cut(A, "    #chat-foot .mode-row {", "    #tutor-settings {");
cut(A, "  // Direct / Class mode, at the foot of the Builder panel", "  // The Tutor's own settings, in the Tutor panel");
edit(A, [
  [`    for (const b of Object.values(modeButtons)) b.disabled = true;\n`, ``],
  [`const { modes, models, choice, classMode, reviewQuestion } = await res.json();`, `const { modes, models, choice, reviewQuestion } = await res.json();`],
  [`      pressMode(classMode === "class" ? "class" : "direct");
      for (const b of Object.values(modeButtons)) b.disabled = false;
`, ``],
  [`    } catch { pressMode(""); /* the selectors stay disabled until a Project opens, and no choice is shown as if it were stored */ }`, `    } catch { /* the selectors stay disabled until a Project opens, and no choice is shown as if it were stored */ }`],
  [`  for (const b of Object.values(modeButtons)) b.onclick = () => { pressMode(b.dataset.mode); save("classMode", { value: b.dataset.mode })(); };\n`, ``],
]);
// 50-tutor.js
const T = "src/ui/features/50-tutor.js";
cut(T, "  // The person keeps missing the check of a decision class", "  // After a class: one plain line about the Learner graph.");
edit(T, [
  [`    else if (event.type === "decision_ready") document.dispatchEvent(new CustomEvent("proposals-changed"));\n`, ``],
  [`    else if (event.type === "decision_hint") decisionHint(event);\n`, ``],
  [`  document.addEventListener("decision-class-start", (e) => startClass({ payload: { project: current, decision: e.detail.proposal } }));\n`, ``],
]);
// 70-proposals.js
const P = "src/ui/features/70-proposals.js";
edit(P, [
  [`p.status === "waiting-for-class" ? "WAITING" : "PROPOSAL"),`, `"PROPOSAL"),`],
  [`// "Decide for me": skips the class of a held Proposal. Returns the problem as text, or null when it worked.
const proposalNoKey`, `const proposalNoKey`],
  [`  // A Blocking decision in Class mode: it cannot be accepted until the person answered the class (or chose "Decide for me").
  const waiting = p.status === "waiting-for-class";
  const skip = async () => {
    const problem = await decideForMe(p.id);
    if (problem) { message.textContent = problem; return; }
    const now = pendingProposals.find((q) => q.id === p.id);
    if (now) showProposal(now);
  };
`, ``],
  [`    ...(waiting ? [node("p", { className: "waiting", textContent: "Waiting for a class: the Tutor asks you about this decision first. You can start the class, or let the builder decide." })] : []),
    node("div", { className: "row" },
      ...(waiting
        ? [node("button", { id: "decision-start", textContent: "Start the class", onclick: () => document.dispatchEvent(new CustomEvent("decision-class-start", { detail: { proposal: p.id } })) }),
          node("button", { id: "decision-skip", textContent: "Decide for me", onclick: skip })]
        : [node("button", { textContent: "Accept", onclick: () => decide("accept") })]),
      node("button", { className: "reject"`, `    node("div", { className: "row" },
      node("button", { textContent: "Accept", onclick: () => decide("accept") }),
      node("button", { className: "reject"`],
  [`  #panel .proposal-box .waiting { margin: 8px 0 0; font-size: 12px; color: var(--accent); font-weight: 600; }\n`, ``],
]);
cut(P, "async function decideForMe(id) {", "// The details of one Proposal in the right-hand panel");
// 46-architecture.js
edit("src/ui/features/46-architecture.js", [[`proposal.status === "waiting-for-class" ? "WAITING" : "PROPOSAL"`, `"PROPOSAL"`]]);
// 30-chat.js
edit("src/ui/features/30-chat.js", [[`    else if (event.type === "decision_class") {
      add("proposal-line", "A decision is waiting for a class: the Tutor asks you about it before you can accept it. Open the Proposal to start it.");
      document.dispatchEvent(new CustomEvent("decision-class", { detail: event }));
    }
`, ``]]);
