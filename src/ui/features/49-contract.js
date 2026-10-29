// The Contract section in the Tutor pane: what is agreed on the Business, Requirements and Architecture layers, as a plain checklist.
// The core derives the checks (GET /contract); this only draws them. It describes and never blocks, and it shows even while the Tutor is unavailable.
const contractStyle = document.createElement("style");
contractStyle.textContent = `
  #contract-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  #contract-card li { display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: var(--muted); }
  #contract-card li.met { color: var(--text); }
  #contract-card .mark { flex: none; width: 14px; text-align: center; font-weight: 700; color: var(--muted); }
  #contract-card li.met .mark { color: var(--derived); }
`;
document.head.append(contractStyle);

const contractSection = tutorSection("contract", "Contract");
const contractCard = contractSection.el;
$("pane-tutor").append(contractCard);

async function contractRefresh() {
  const project = current;
  const body = project ? await fetch(`/contract?project=${encodeURIComponent(project)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  if (project !== current) return; // the Project changed while waiting
  contractCard.hidden = !body;
  if (!body) return;
  const items = body.readiness.map((c) => {
    const mark = Object.assign(document.createElement("span"), { className: "mark", textContent: c.met ? "✓" : "○" });
    mark.setAttribute("role", "img");
    mark.setAttribute("aria-label", c.met ? "done" : "missing");
    const li = Object.assign(document.createElement("li"), { className: c.met ? "met" : "unmet" });
    li.append(mark, c.text);
    return li;
  });
  contractSection.summarise(`${body.readiness.filter((c) => c.met).length} of ${body.readiness.length}`);
  const list = document.createElement("ul");
  list.append(...items);
  contractSection.body.replaceChildren(
    Object.assign(document.createElement("p"), { textContent: "What you have agreed on the Business, Requirements and Architecture layers. The builder follows it." }),
    list,
  );
}

// Every time the Project is drawn (opened, or a Proposal accepted), the checklist is read again.
const drawWithoutContract = draw;
draw = async (nodes) => {
  await drawWithoutContract(nodes);
  await contractRefresh();
};
