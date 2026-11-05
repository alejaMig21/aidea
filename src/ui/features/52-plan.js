// The Plan section in the Tutor pane (ticket 07): the concepts to understand, in dependency order, and the open decisions of each layer.
// The core stores the Plan and derives what is covered (GET /tutor/plan); this only draws them. There is no editing here:
// the person asks the Tutor for changes in the conversation. Names are prefixed "plan" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #plan-card .plan-bar { height: 4px; border-radius: 2px; background: var(--control); overflow: hidden; }
    #plan-card .plan-bar i { display: block; height: 100%; background: var(--derived); }
    #plan-card ol, #plan-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    #plan-card li { display: grid; grid-template-columns: 30px 1fr; gap: 0 6px; align-items: baseline; font-size: 13px; color: var(--label); }
    #plan-card li.covered { color: var(--text); }
    #plan-card li.current { color: var(--text); font-weight: 600; }
    #plan-card li.current .plan-n::after { content: " \\25B6"; color: var(--accent); font-size: 10px; }
    #plan-card .plan-n { color: var(--muted); font-size: 12px; text-align: right; }
    #plan-card .mark { color: var(--derived); font-weight: 700; }
    #plan-card .needs { grid-column: 2; font-size: 12px; color: var(--muted); }
    #plan-card h3 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  `;
  document.head.append(style);

  const section = tutorSection("plan", "Plan");
  const card = section.el;
  $("contract-card").before(card); // above the Contract: it is what the person reads first

  // Concepts so that each comes after the ones it needs (the core guarantees there is no cycle).
  const planNorm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); // the core's `normalise`
  function planOrder(concepts) {
    const byName = new Map(concepts.map((c) => [planNorm(c.name), c]));
    const out = [], seen = new Set();
    const visit = (c) => {
      if (seen.has(c)) return;
      seen.add(c);
      c.dependsOn.forEach((d) => byName.has(planNorm(d)) && visit(byName.get(planNorm(d))));
      out.push(c);
    };
    concepts.forEach(visit);
    return out;
  }

  const planAfter = (numbers) => `after ${numbers.length > 1 ? `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}` : numbers[0]}`;
  const mk = uiMake;
  let planToken = 0;
  let planCurrent = null; // the Plan item the open step is about (its name, normalised), while a class runs
  const planMark = () => card.querySelectorAll("li[data-item]").forEach((li) => li.classList.toggle("current", planCurrent !== null && li.dataset.item === planCurrent));

  async function planRefresh() {
    const mine = ++planToken, project = current;
    const body = project ? await fetch(`/tutor/plan?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    if (mine !== planToken) return; // a newer refresh, or another Project, took over
    card.hidden = !body?.plan;
    if (!body?.plan) return;
    const covered = new Set(body.covered.map(planNorm));
    const ordered = planOrder(body.plan.concepts);
    const number = new Map(ordered.map((c, i) => [planNorm(c.name), i + 1])); // the numbers of the list, for "after 1 and 2"
    const done = ordered.filter((c) => covered.has(planNorm(c.name))).length;
    section.summarise(`${done} of ${ordered.length} covered` + (body.plan.approved ? "" : " \u00B7 waiting for your go-ahead"));
    const concepts = ordered.map((c, i) => {
      const isDone = covered.has(planNorm(c.name));
      const n = mk("span", { className: "plan-n", textContent: String(i + 1) });
      if (isDone) {
        const mark = mk("span", { className: "mark", textContent: " ✓" });
        mark.setAttribute("role", "img");
        mark.setAttribute("aria-label", "covered");
        n.append(mark);
      }
      const li = mk("li", { className: isDone ? "covered" : "" }, n, mk("span", { textContent: c.name }));
      const needs = c.dependsOn.map((d) => number.get(planNorm(d))).filter(Boolean).sort((a, b) => a - b);
      if (needs.length) li.append(mk("span", { className: "needs", textContent: planAfter(needs) }));
      li.dataset.item = planNorm(c.name);
      return li;
    });
    const bar = mk("div", { className: "plan-bar" }, mk("i"));
    queueMicrotask(planMark); // the list is in the section by then
    bar.firstChild.style.width = `${ordered.length ? (done / ordered.length) * 100 : 0}%`;
    section.body.replaceChildren(bar, mk("ol", {}, ...concepts), mk("p", { textContent: "Ask the Tutor if you want the Plan changed." }));
    if (body.plan.decisions.length) {
      section.body.append(mk("h3", { textContent: "Open decisions" }), mk("ul", {}, ...body.plan.decisions.map((d) => mk("li", {}, mk("span", { className: "plan-n", textContent: "?" }), mk("span", { textContent: `${d.layer}: ${d.question}` })))));
    }
  }

  document.addEventListener("plan-step", (e) => { planCurrent = e.detail.item ? planNorm(e.detail.item) : null; planMark(); });
  document.addEventListener("project-opened", () => { planCurrent = null; });
  document.addEventListener("project-opened", planRefresh);
  document.addEventListener("plan-changed", planRefresh); // the Tutor set or revised the Plan, or a class ended (what is covered may have changed)
}
