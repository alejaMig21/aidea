// Proposals: changes the builder suggests to the authored layers, highlighted on their layer until the person decides.
// The core says what is pending and where each Proposal is drawn; this draws it and sends the person's decision.
const proposalStyle = document.createElement("style");
proposalStyle.textContent = `
  .proposal { cursor: pointer; }
  .proposal rect { fill: var(--accent); fill-opacity: .08; stroke: var(--accent); stroke-width: 2.5; stroke-dasharray: 6 4; }
  .proposal.update rect { fill-opacity: 0; stroke-dasharray: none; stroke-width: 4; }
  .proposal.remove rect { fill: #c0392b; stroke: #c0392b; }
  .proposal text { font-weight: 600; }
  #panel .proposal-box h2 { margin: 0; }
  #panel .proposal-box .field { font-size: 12px; margin: 4px 0; }
  #panel .proposal-box .old { color: var(--muted); text-decoration: line-through; }
  #panel .proposal-box .row { display: flex; gap: 8px; margin-top: 10px; }
  #panel .proposal-box .reject { background: transparent; color: var(--text); border: 1px solid var(--line); }
`;
document.head.append(proposalStyle);

let pendingProposals = [];
// Each Proposal comes with the secret that lets this interface decide it. It is kept for the life of the tab,
// so a reload does not lose it. The builder never sees it.
const proposalSecrets = (() => {
  try { return new Map(JSON.parse(sessionStorage.getItem("aidea-proposal-secrets") ?? "[]")); } catch { return new Map(); }
})();
const saveProposalSecrets = () => { try { sessionStorage.setItem("aidea-proposal-secrets", JSON.stringify([...proposalSecrets])); } catch { /* storage is optional */ } };

const proposalLabel = (p) => {
  const title = p.node?.title ?? p.nodeId;
  return p.kind === "add" ? `+ ${title}` : p.kind === "update" ? `~ ${title}` : `− ${title}`;
};

// Layer tabs show how many Proposals wait on each.
function markTabs() {
  layerBar.querySelectorAll("button[data-layer]").forEach((b) => {
    const layer = AUTHORED_LAYERS.find((l) => l.key === b.dataset.layer);
    if (!layer) return;
    const n = pendingProposals.filter((p) => p.layer === layer.key).length;
    b.textContent = n ? `${layer.label} (${n})` : layer.label;
  });
}

function drawProposals() {
  authoredGroup.querySelectorAll(".proposal").forEach((g) => g.remove());
  for (const p of pendingProposals) {
    const layerGroup = authoredGroup.querySelector(`[data-layer="${p.layer}"]`);
    if (!layerGroup || !p.rect) continue;
    const g = el("g", { class: `proposal ${p.kind}`, tabindex: 0, "data-proposal": p.id, "data-ref": p.id });
    const pad = p.kind === "add" ? 0 : 5;
    g.append(
      el("rect", { x: p.rect.x - pad, y: p.rect.y - pad, width: p.rect.width + 2 * pad, height: p.rect.height + 2 * pad, rx: 8 }),
      el("text", { x: p.rect.x + 10, y: p.rect.y + p.rect.height / 2 + 4 }, p.kind === "add" ? proposalLabel(p) : `${p.kind === "update" ? "changed" : "to remove"}`),
    );
    const open = () => showProposal(p);
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    layerGroup.append(g);
  }
  markTabs();
}

async function refreshProposals() {
  const project = current;
  if (!project) return;
  const res = await fetch(`/proposals?project=${encodeURIComponent(project)}`);
  if (!res.ok || project !== current) return;
  pendingProposals = (await res.json()).proposals;
  drawProposals();
}

const node = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};
const show = (v) => (typeof v === "string" ? v : JSON.stringify(v));

// The details of one Proposal in the right-hand panel, with the person's decision.
function showProposal(p) {
  const old = authoredData?.layers[p.layer]?.nodes.find((n) => n.id === p.nodeId);
  const rows = [];
  if (p.kind === "add") {
    for (const [k, v] of Object.entries(p.node)) if (k !== "rationale") rows.push(node("div", { className: "field" }, node("strong", { textContent: `${k}: ` }), show(v)));
    rows.push(node("div", { className: "field" }, node("strong", { textContent: "why: " }), p.node.rationale.why));
    for (const r of p.node.rationale.rejected) rows.push(node("div", { className: "field" }, node("strong", { textContent: "rejected: " }), `${r.option}: ${r.reason}`));
  } else if (p.kind === "update") {
    for (const [k, v] of Object.entries(p.changes)) {
      rows.push(node("div", { className: "field" }, node("strong", { textContent: `${k}: ` }), node("span", { className: "old", textContent: old ? show(old[k] ?? "(none)") : "" }), " → ", show(v)));
    }
  } else {
    rows.push(node("div", { className: "field", textContent: old ? `"${old.title}" will be removed from the ${p.layer} layer.` : "This Node will be removed." }));
  }
  const message = node("div", { className: "pb-error" });
  const decide = async (decision) => {
    const secret = proposalSecrets.get(p.id);
    if (!secret) { message.textContent = "This interface does not hold the key to decide this proposal (it was made in another window or before a restart)."; return; }
    const res = await fetch("/proposals/answer", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, secret, decision }),
    });
    if (!res.ok) { message.textContent = (await res.json().catch(() => ({}))).error ?? "Could not send the decision"; return; }
    proposalSecrets.delete(p.id);
    saveProposalSecrets();
    $("panel").replaceChildren();
    // An accepted Proposal is now in the file: draw the layers again from the files.
    if (decision === "accept") await draw(algoNodes);
    else await refreshProposals();
  };
  $("panel").replaceChildren(node("div", { className: "proposal-box" },
    node("h2", { textContent: `Proposal: ${p.kind} "${p.node?.title ?? old?.title ?? p.nodeId}"` }),
    node("div", { className: "field", textContent: `${p.layer} layer` }),
    ...rows,
    node("div", { className: "row" },
      node("button", { textContent: "Accept", onclick: () => decide("accept") }),
      node("button", { className: "reject", textContent: "Reject", onclick: () => decide("reject") })),
    message));
}

document.addEventListener("proposal-created", (e) => {
  proposalSecrets.set(e.detail.id, e.detail.secret);
  saveProposalSecrets();
  refreshProposals();
});

// "Review": go to the layer, bring the Proposal into view (the core says how to frame it) and open its details.
document.addEventListener("proposal-open", async (e) => {
  await refreshProposals();
  const p = pendingProposals.find((q) => q.id === e.detail.id);
  if (!p) return;
  showLayer(p.layer);
  if (p.frame) fit(p.frame);
  showProposal(p);
});

// Every time the Project is drawn, look at what is pending.
const drawWithoutProposals = draw;
draw = async (nodes) => {
  await drawWithoutProposals(nodes);
  await refreshProposals();
};
