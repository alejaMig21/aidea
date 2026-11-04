// "Pause and step": freezes the live motion of every diagram layer. On the Algorithms layer with a Playback recording it also shows
// Previous step / Next step, which walk the recording one Playback step at a time; on every other layer only the pause is left.
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
const stepPrev = stepButton("step-prev", `‹<span class="word"> Previous step</span>`, "Previous step");
const stepNext = stepButton("step-next", `<span class="word">Next step </span>›`, "Next step");
const stepCount = Object.assign(document.createElement("span"), { id: "step-count" });
stepCount.setAttribute("aria-live", "polite");
const stepGroup = Object.assign(document.createElement("div"), { id: "step-controls" });
stepGroup.append(stepToggle, stepPrev, stepNext, stepCount);
notationToggle.after(stepGroup);

let stepOn = false;
const stepRecording = () => (playbackLayer() && pbRecording?.visits.length ? pbRecording : null); // a replay on the flowchart steps by Playback step

document.addEventListener("algorithm-opened", () => queueMicrotask(stepUi)); // a new function drops the recording: the step controls go with it
function stepUi() {
  const rec = stepRecording();
  stepGroup.hidden = !notationOn;
  stepToggle.setAttribute("aria-pressed", String(stepOn));
  stepToggle.innerHTML = stepOn ? `▶<span class="word"> Resume live</span>` : `❚❚<span class="word"> Pause and step</span>`;
  stepToggle.title = stepOn ? "Resume the live loop" : "Pause the loop and step by hand";
  stepToggle.setAttribute("aria-label", stepToggle.title);
  for (const b of [stepPrev, stepNext, stepCount]) b.hidden = !(stepOn && rec); // the hop buttons only where they step something
  if (!rec) return;
  stepCount.textContent = `Step ${pbIndex + 1} / ${rec.visits.length}`;
  stepPrev.disabled = pbIndex <= 0; stepNext.disabled = pbIndex >= rec.visits.length - 1;
}

function stepSet(on) {
  stepOn = on && notationOn;
  notationStepping = stepOn;
  document.body.classList.toggle("step-mode", stepOn);
  if (stepOn && stepRecording()) pbStop();
  notationSync(); // freezes or resumes dashes, glow and any packet still in the page
  stepUi();
}

function stepMove(direction) {
  if (!stepRecording()) return;
  if (direction > 0 && pbGuessOn) { pbStepForward(); return; } // "Guess first" asks before it shows the step
  pbStop(); pbGo(pbIndex + direction); // the Playback token and the trace table follow
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
