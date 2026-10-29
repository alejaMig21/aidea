// Proposals: changes the builder suggests to the authored layers, highlighted on their layer until the person decides.
// The core says what is pending and where each Proposal is drawn; this draws it and sends the person's decision.
const proposalStyle = document.createElement("style");
proposalStyle.textContent = `
  .proposal { cursor: pointer; }
  .proposal rect { fill: var(--proposal); stroke: var(--accent); stroke-width: 1.3; stroke-dasharray: 5 4; }
  .proposal-edge { stroke: var(--accent); stroke-width: 1.3; stroke-dasharray: 5 4; }
  .proposal.update rect, .proposal.remove rect { fill: none; }
  .proposal.remove rect { stroke: var(--danger); }
  .proposal .tag { fill: var(--accent); font: 500 12px var(--sans); letter-spacing: .06em; text-anchor: end; }
  .proposal.remove .tag { fill: var(--danger); }
  #panel .proposal-box .waiting { margin: 8px 0 0; font-size: 12px; color: var(--accent); font-weight: 600; }
  .proposal .node-sub { fill: var(--accent-soft); }
  #panel .proposal-box h2 { margin: 0; text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--text); font-weight: 600; }
  #panel .proposal-box .field { font-size: 12px; margin: 4px 0; }
  #panel .proposal-box .old { color: var(--muted); text-decoration: line-through; }
  #panel .proposal-box .from-tutor { display: inline-block; margin: 2px 0 4px; padding: 1px 8px; font-size: 11px; font-weight: 600; color: var(--accent); border: 1px dashed var(--accent); border-radius: 10px; }
  #panel .proposal-box .from-answer { margin: 4px 0; padding: 2px 10px; border-left: 2px solid var(--accent); color: var(--text); font-size: 12px; font-style: italic; overflow-wrap: anywhere; }
  #panel .proposal-box .row { display: flex; gap: 8px; margin-top: 10px; }
`;
document.head.append(proposalStyle);

let pendingProposals = [];
// Each Proposal comes with the secret that lets this interface decide it. It is kept for the life of the tab,
// so a reload does not lose it. The builder never sees it.
const proposalSecrets = (() => {
  try { return new Map(JSON.parse(sessionStorage.getItem("aidea-proposal-secrets") ?? "[]")); } catch { return new Map(); }
})();
const saveProposalSecrets = () => { try { sessionStorage.setItem("aidea-proposal-secrets", JSON.stringify([...proposalSecrets])); } catch { /* storage is optional */ } };

// Layer tabs show how many Proposals wait on each.
function markTabs() {
  layerBar.querySelectorAll("button[data-layer]").forEach((b) => {
    const layer = AUTHORED_LAYERS.find((l) => l.key === b.dataset.layer);
    if (!layer) return;
    const n = pendingProposals.filter((p) => p.layer === layer.key).length;
    b.textContent = layer.label;
    if (n) b.append(Object.assign(document.createElement("span"), { className: "badge", textContent: n }));
    problemsMarkTab(b); // textContent above wiped the red problems badge: put it back
  });
}

function drawProposals() {
  authoredGroup.querySelectorAll(".proposal, .proposal-edge").forEach((g) => g.remove());
  architectureRender(); // the Architecture layer draws its own added elements and relations from the preview
  for (const p of pendingProposals) {
    if (p.layer === "architecture" && p.kind === "add") continue;
    const layerGroup = authoredGroup.querySelector(`[data-layer="${p.layer}"]`);
    if (!layerGroup || !p.rect) continue;
    const g = el("g", { class: `proposal ${p.kind}`, tabindex: 0, "data-proposal": p.id, "data-ref": p.id });
    const pad = p.kind === "add" ? 0 : 5;
    const { x, y, width, height } = p.rect;
    g.append(el("rect", { x: x - pad, y: y - pad, width: width + 2 * pad, height: height + 2 * pad, rx: 10 }));
    if (p.kind === "add" && height < 64) { // a Business note: just its title, the dashed outline says it is a Proposal
      g.append(el("text", { x: x + 10, y: y + 26 }, authoredShort(p.node?.title ?? p.nodeId)));
    } else if (p.kind === "add") {
      const layer = AUTHORED_LAYERS.find((l) => l.key === p.layer);
      g.append(
        el("text", { x: x + width - 14, y: y + 25, class: "tag" }, p.status === "waiting-for-class" ? "WAITING" : "PROPOSAL"),
        el("text", { x: x + 16, y: y + 29 }, p.node?.title ?? p.nodeId),
        el("text", { x: x + 16, y: y + 49, class: "node-sub" }, authoredShort(layer?.detail(p.node) ?? "")),
      );
    } else {
      g.append(el("text", { x: x + width + pad - 4, y: y - pad - 6, class: "tag" }, p.kind === "update" ? "PROPOSED CHANGE" : "PROPOSED REMOVAL"));
    }
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
  const body = await res.json();
  pendingProposals = body.proposals;
  architecturePreview = body.previews?.architecture ?? null;
  drawProposals();
}

const node = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};
const show = (v) => (typeof v === "string" ? v : JSON.stringify(v));

// "Decide for me": skips the class of a held Proposal. Returns the problem as text, or null when it worked.
const proposalNoKey = "This window cannot decide this proposal any more, because the page was reloaded or the proposal was made in another window. Ask the builder for the change again here.";
async function decideForMe(id) {
  const secret = proposalSecrets.get(id);
  if (!secret) return proposalNoKey;
  const res = await fetch("/proposals/skip-class", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, secret }) });
  if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Could not skip the class";
  await refreshProposals();
  return null;
}

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
    if (!secret) { message.textContent = proposalNoKey; return; }
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
  // A Blocking decision in Class mode: it cannot be accepted until the person answered the class (or chose "Decide for me").
  const waiting = p.status === "waiting-for-class";
  const skip = async () => {
    const problem = await decideForMe(p.id);
    if (problem) { message.textContent = problem; return; }
    const now = pendingProposals.find((q) => q.id === p.id);
    if (now) showProposal(now);
  };
  $("panel").replaceChildren(node("div", { className: "proposal-box" },
    node("h2", { textContent: `Proposal: ${p.kind} "${p.node?.title ?? old?.title ?? p.nodeId}"` }),
    node("div", { className: "field", textContent: `${p.layer} layer` }),
    ...(p.source?.role === "tutor" ? [node("div", { className: "from-tutor", textContent: "From the Tutor" })] : []),
    ...(p.fromAnswer ? [node("blockquote", { className: "from-answer", textContent: p.fromAnswer }), node("div", { className: "field", textContent: "Your words, which the Tutor used." })] : []),
    ...rows,
    ...(waiting ? [node("p", { className: "waiting", textContent: "Waiting for a class: the Tutor asks you about this decision first. You can start the class, or let the builder decide." })] : []),
    node("div", { className: "row" },
      ...(waiting
        ? [node("button", { id: "decision-start", textContent: "Start the class", onclick: () => document.dispatchEvent(new CustomEvent("decision-class-start", { detail: { proposal: p.id } })) }),
          node("button", { id: "decision-skip", textContent: "Decide for me", onclick: skip })]
        : [node("button", { textContent: "Accept", onclick: () => decide("accept") })]),
      node("button", { className: "reject", textContent: "Reject", onclick: () => decide("reject") })),
    message));
}

// The Tutor wrote the person's reason into a decision: it can be accepted now.
document.addEventListener("proposals-changed", () => refreshProposals());

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
