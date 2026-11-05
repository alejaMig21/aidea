// The Contract Panel: what the person agreed on the Business, Requirements and Architecture layers as a checklist, and the Differences between the code and it as a list, with a dashed mark on the
// affected Nodes of their layers. The host half computes everything (main.js); this only draws it. It describes and never blocks.
const KINDS = {
  "broken-trace": "Link broken",
  "built-without-code": "Marked built, no code",
  "missing-relationship": "Declared, not in the code",
  "undeclared-dependency": "In the code, not declared",
  pattern: "Pattern rule",
  "not-built-yet": "Not built yet",
};
const ALL = ["business", "requirements", "architecture"];

export function activate(ui) {
  let marks = { set() {} }, last = { readiness: [], drift: [] }, token = 0;
  const removeMarks = ui.slots.add("layer.marks", {
    legend: [
      { layers: ALL, mark: "differs", text: "Dashed red outline: the code differs from what the Contract says about this Node (see the list in the Contract panel)" },
      { layers: ["requirements"], mark: "waiting", text: "Dotted grey outline: a requirement not built yet, only a question to ask (see the Contract panel)" },
    ],
    attach(api) { marks = api; },
  });

  const removePanel = ui.slots.add("layout.panel", {
    id: "contract",
    title: "Contract",
    min: 288,
    startsHidden: true, // the default window stays as it is; the Panel waits in the Panels menu
    icon: '<path d="M4 2.5h6l2 2V13.5H4zM6 7h4M6 9.5h4"/>',
    render(container) {
      const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
      container.style.cssText += ";overflow:auto;padding:10px 14px;display:flex;flex-direction:column;gap:14px";
      const agreed = el("section"), differences = el("section");
      container.append(agreed, differences);

      function draw() {
        const met = last.readiness.filter((c) => c.met).length;
        const items = last.readiness.map((c) => {
          const mark = el("span", { textContent: c.met ? "✓" : "○" });
          mark.setAttribute("role", "img");
          mark.setAttribute("aria-label", c.met ? "done" : "missing");
          mark.style.cssText = `flex:none;width:14px;text-align:center;font-weight:700;color:var(${c.met ? "--derived" : "--muted"})`;
          const li = el("li", {}, mark, c.text);
          li.style.cssText = `display:flex;gap:8px;align-items:baseline;font-size:13px;color:var(${c.met ? "--text" : "--muted"})`;
          return li;
        });
        const list = el("ul", {}, ...items);
        list.style.cssText = "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px";
        agreed.replaceChildren(
          el("h3", { textContent: `Contract: ${met} of ${last.readiness.length}` }),
          el("p", { textContent: "What you have agreed on the Business, Requirements and Architecture layers. The builder follows it." }),
          list,
        );

        const rows = last.drift.map((d) => {
          const show = el("button", { type: "button", textContent: `Show on ${d.layer}`, onclick: () => ui.layers.show(d.layer) });
          const ask = el("button", { type: "button", textContent: "Ask me about it", onclick: () => ui.tutor.startClass({ payload: { project: ui.project(), drift: d.id } }) });
          const kind = el("span", { textContent: `${KINDS[d.type] ?? d.type}${d.certainty === "possible" ? " (possible)" : ""}` });
          kind.style.cssText = "display:block;margin-bottom:2px;font:11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)";
          const row = el("div", {}, show, ask);
          row.style.cssText = "display:flex;gap:8px;margin-top:6px";
          const li = el("li", {}, kind, d.explanation, row);
          li.style.cssText = "font-size:13px;color:var(--label);overflow-wrap:anywhere";
          return li;
        });
        const diffList = el("ul", {}, ...rows);
        diffList.style.cssText = "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px";
        differences.replaceChildren(
          el("h3", { textContent: `Differences: ${last.drift.length ? last.drift.length : "none"}` }),
          el("p", { textContent: last.drift.length ? "Where your code is not what you agreed. It is only information: nothing is blocked, and either side may be the one to change." : "No differences found between the code and the Contract." }),
          ...(rows.length ? [diffList] : []),
        );
        marks.set(last.drift.flatMap((d) => d.nodes.map((node) => ({ layer: d.layer, node, mark: d.type === "not-built-yet" ? "waiting" : "differs" }))));
      }

      async function refresh() {
        const mine = ++token, project = ui.project();
        let body = { readiness: [], drift: [] };
        if (project) { try { body = await ui.call("contract", { project }); } catch { /* the Project is not open any more */ } }
        if (mine !== token) return;
        last = body;
        draw();
      }

      const stops = [ui.on("project-drawn", refresh), ui.on("proposals-changed", refresh)];
      refresh();
      return () => { token++; for (const stop of stops) stop(); };
    },
  });

  return () => { removePanel(); removeMarks(); };
}
