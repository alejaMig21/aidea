// The Plan card in the Tutor pane (ticket 07): the concepts to understand, in dependency order, and the open decisions of each layer.
// The core stores the Plan and derives what is covered (GET /tutor/plan); this only draws them. There is no editing here:
// the person asks the Tutor for changes in the conversation. Names are prefixed "plan" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #plan-card { align-self: stretch; margin-top: 8px; padding: 12px; text-align: left; background: var(--raised); border: 1px solid var(--line); border-radius: 10px; }
    #plan-card[hidden] { display: none; }
    #plan-card h2, #plan-card h3 { text-align: left; }
    #plan-card h3 { margin: 10px 0 4px; font-size: 12px; color: var(--muted); }
    #plan-card p { max-width: none; margin: 4px 0 8px; font-size: 12px; }
    #plan-card ol, #plan-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
    #plan-card li { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
    #plan-card li.covered { color: var(--text); }
    #plan-card .mark { flex: none; width: 14px; text-align: center; font-weight: 700; }
    #plan-card li.covered .mark { color: var(--derived); }
    #plan-card .needs { font-size: 11px; }
  `;
  document.head.append(style);

  const card = Object.assign(document.createElement("section"), { id: "plan-card", hidden: true });
  card.setAttribute("aria-label", "Plan");
  $("contract-card").before(card); // above the Contract: it is what the person reads first

  // Concepts so that each comes after the ones it needs (the core guarantees there is no cycle).
  function planOrder(concepts) {
    const byName = new Map(concepts.map((c) => [c.name.toLowerCase(), c]));
    const out = [], seen = new Set();
    const visit = (c) => {
      if (seen.has(c)) return;
      seen.add(c);
      c.dependsOn.forEach((d) => byName.has(d.toLowerCase()) && visit(byName.get(d.toLowerCase())));
      out.push(c);
    };
    concepts.forEach(visit);
    return out;
  }

  const mk = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  let planToken = 0;

  async function planRefresh() {
    const mine = ++planToken, project = current;
    const body = project ? await fetch(`/tutor/plan?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    if (mine !== planToken) return; // a newer refresh, or another Project, took over
    card.hidden = !body?.plan;
    if (!body?.plan) return;
    const covered = new Set(body.covered.map((n) => n.toLowerCase()));
    const concepts = planOrder(body.plan.concepts).map((c) => {
      const done = covered.has(c.name.toLowerCase());
      const mark = mk("span", { className: "mark", textContent: done ? "✓" : "○" });
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", done ? "covered" : "not covered yet");
      const li = mk("li", { className: done ? "covered" : "" }, mark, mk("span", { textContent: c.name }));
      if (c.dependsOn.length) li.append(mk("span", { className: "needs", textContent: `needs ${c.dependsOn.join(", ")}` }));
      return li;
    });
    card.replaceChildren(
      mk("h2", { textContent: "Plan" }),
      mk("p", { textContent: "What you need to understand for this project, in order. Ask the Tutor if you want it changed." }),
      mk("ol", {}, ...concepts),
    );
    if (body.plan.decisions.length) {
      card.append(mk("h3", { textContent: "Open decisions" }), mk("ul", {}, ...body.plan.decisions.map((d) => mk("li", {}, mk("span", { className: "mark", textContent: "?" }), mk("span", { textContent: `${d.layer}: ${d.question}` })))));
    }
  }

  document.addEventListener("project-opened", planRefresh);
  document.addEventListener("plan-changed", planRefresh); // the Tutor set or revised the Plan, or a class ended (what is covered may have changed)
}
