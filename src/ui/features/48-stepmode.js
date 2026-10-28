// "Pause and step": freezes the live motion of every diagram layer and advances it by hand, one hop at a time.
// A hop is one packet travelling one edge end to end. Hop number h always means the same thing (deterministic): the packet of edge number h
// (in drawing order) has just arrived at its end; hop 0 is the packet waiting at the start of the first edge. While paused, the loop's own
// packets are hidden and one stepping dot (#nt-hop) shows the hop. On the flowchart with a recording, a hop is one Playback step instead.
// Only shown while Animations are on; cleared when the layer or the Project changes. Names here are prefixed "step".
{
  const style = document.createElement("style");
  style.textContent = `
    #step-controls { display: flex; gap: 6px; align-items: center; flex: none; margin-left: 6px; }
    #step-controls[hidden] { display: none; }
    #step-controls button { flex: none; padding: 4px 10px; background: transparent; color: var(--text); border: 1px solid var(--control); font-size: 12.5px; font-weight: 400; }
    #step-controls button[hidden] { display: none; }
    #step-controls button:disabled { opacity: .4; }
    #step-controls #step-toggle[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
    #step-count { font: 12px var(--mono); color: var(--muted); white-space: nowrap; }
    #step-count[hidden] { display: none; }
    @media (max-width: 1100px) { #step-controls .word { display: none; } #step-controls button { padding: 4px 8px; } }
    body.step-mode .nt-packet { display: none; }
    .nt-hop { fill: var(--tone, var(--accent)); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tone, var(--accent)) 70%, transparent)); pointer-events: none; }
    body.motion-off .nt-hop { display: none; }
    svg#canvas .nt-hop-edge { stroke-width: 3; }
  `;
  document.head.append(style);
}

const stepButton = (id, label, title) => {
  const b = Object.assign(document.createElement("button"), { type: "button", id, title });
  b.setAttribute("aria-label", title);
  b.innerHTML = label;
  return b;
};
const stepToggle = stepButton("step-toggle", "", "Pause the loop and step by hand");
const stepPrev = stepButton("step-prev", `‹<span class="word"> Previous hop</span>`, "Previous hop");
const stepNext = stepButton("step-next", `<span class="word">Next hop </span>›`, "Next hop");
const stepCount = Object.assign(document.createElement("span"), { id: "step-count" });
stepCount.setAttribute("aria-live", "polite");
const stepGroup = Object.assign(document.createElement("div"), { id: "step-controls" });
stepGroup.append(stepToggle, stepPrev, stepNext, stepCount);
notationToggle.after(stepGroup);

let stepOn = false, stepHop = 0, stepFrame = 0;
const stepDot = el("circle", { class: "nt-hop", id: "nt-hop", r: 6 });
const stepEdges = () => [...$("world").querySelectorAll("[data-packets]")].filter((e) => e.dataset.tone !== "unresolved" && e.getClientRects().length); // what is on screen; grey unresolved edges never move
const stepRecording = () => (authoredShown === "algorithms" && pbRecording?.visits.length ? pbRecording : null); // a replay on the flowchart steps by Playback step

function stepClear() {
  cancelAnimationFrame(stepFrame);
  stepDot.remove();
  $("world").querySelectorAll(".nt-hop-edge").forEach((e) => e.classList.remove("nt-hop-edge"));
}

function stepPlace(animate) {
  stepClear();
  const edge = stepRecording() ? null : stepEdges()[Math.max(0, stepHop - 1)];
  if (!edge) return;
  edge.classList.add("nt-hop-edge");
  if (edge.dataset.tone) stepDot.dataset.tone = edge.dataset.tone; else delete stepDot.dataset.tone;
  edge.after(stepDot);
  const length = edge.getTotalLength();
  const at = (t) => { const p = edge.getPointAtLength(length * t); stepDot.setAttribute("cx", p.x); stepDot.setAttribute("cy", p.y); };
  if (!animate) { at(stepHop ? 1 : 0); return; }
  const start = performance.now();
  const tick = (now) => { const t = Math.min(1, (now - start) / 450); at(t); if (t < 1) stepFrame = requestAnimationFrame(tick); };
  stepFrame = requestAnimationFrame(tick);
}

function stepUi() {
  const rec = stepRecording(), hops = stepEdges().length;
  stepGroup.hidden = !notationOn;
  stepToggle.setAttribute("aria-pressed", String(stepOn));
  stepToggle.innerHTML = stepOn ? `▶<span class="word"> Resume live</span>` : `❚❚<span class="word"> Pause and step</span>`;
  stepToggle.title = stepOn ? "Resume the live loop" : "Pause the loop and step by hand";
  stepToggle.setAttribute("aria-label", stepToggle.title);
  for (const b of [stepPrev, stepNext, stepCount]) b.hidden = !stepOn;
  const word = rec ? "step" : "hop";
  stepPrev.setAttribute("aria-label", `Previous ${word}`); stepNext.setAttribute("aria-label", `Next ${word}`);
  stepPrev.querySelector(".word").textContent = ` Previous ${word}`; stepNext.querySelector(".word").textContent = `Next ${word} `;
  stepPrev.disabled = stepNext.disabled = false;
  if (rec) { stepCount.textContent = `Step ${pbIndex + 1} / ${rec.visits.length}`; stepPrev.disabled = pbIndex <= 0; stepNext.disabled = pbIndex >= rec.visits.length - 1; }
  else { stepCount.textContent = hops ? `Hop ${stepHop} / ${hops}` : "Nothing moves here"; stepPrev.disabled = stepHop <= 0; stepNext.disabled = stepHop >= hops; }
}

function stepSet(on) {
  stepOn = on && notationOn;
  notationStepping = stepOn;
  stepHop = 0;
  document.body.classList.toggle("step-mode", stepOn);
  if (stepOn) { if (stepRecording()) pbStop(); stepPlace(false); } else stepClear();
  notationSync(); // freezes or resumes dashes, glow and any packet still in the page
  stepUi();
}

function stepMove(direction) {
  const rec = stepRecording();
  if (rec) { pbStop(); pbGo(pbIndex + direction); return; } // the Playback token and the trace table follow
  stepHop = Math.max(0, Math.min(stepEdges().length, stepHop + direction));
  stepPlace(direction > 0);
  stepUi();
}

stepToggle.onclick = () => stepSet(!stepOn);
stepPrev.onclick = () => stepMove(-1);
stepNext.onclick = () => stepMove(1);
document.addEventListener("notation-sync", () => { if (stepOn && !notationOn) stepSet(false); else stepUi(); });
document.addEventListener("playback-step", stepUi);

// Another layer or another Project starts live again.
const showLayerWithoutStepMode = showLayer;
showLayer = (which) => { if (stepOn) stepSet(false); showLayerWithoutStepMode(which); stepUi(); };
const drawWithoutStepMode = draw;
draw = async (nodes) => { if (stepOn) stepSet(false); await drawWithoutStepMode(nodes); stepUi(); };

stepUi();
