// Playback: record one real run of the open Algorithm graph's function, then replay it step by step.
// The core runs the function once and keeps the recording; everything here replays that recording and never re-runs the code.
const playbackStyle = document.createElement("style");
playbackStyle.textContent = `
  #algorithm.has-recording .flow-step:not(.visited) { opacity: .4; }
  #algorithm .flow-step.now rect { stroke: var(--accent); stroke-width: 4; }
  #panel label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--muted); }
  #panel .pb-row { display: flex; gap: 6px; align-items: center; }
  #panel .pb-values { font: 12px/1.5 ui-monospace, monospace; margin: 8px 0; }
  #panel .pb-values div { display: flex; justify-content: space-between; gap: 8px; }
  #panel .pb-error { color: #c0392b; font-size: 12px; }
  #panel input[type="range"] { flex: 1; }
`;
document.head.append(playbackStyle);

let pbGraph = null;     // the open Algorithm graph
let pbRecording = null; // the recording being replayed
let pbIndex = 0;
let pbTimer = null;

const pbStop = () => { clearInterval(pbTimer); pbTimer = null; };

const pbEl = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};

function pbShowStep() {
  const entry = pbRecording.trace[pbIndex];
  document.querySelectorAll("#algorithm .flow-step").forEach((g) => {
    const seen = pbRecording.trace.slice(0, pbIndex + 1).some((e) => e.step === g.dataset.step);
    g.classList.toggle("visited", seen);
    g.classList.toggle("now", g.dataset.step === entry.step);
  });
  $("pb-position").textContent = `${pbIndex + 1} / ${pbRecording.trace.length}`;
  $("pb-slider").value = pbIndex;
  const names = Object.keys(entry.locals);
  const rows = names.map((name) => pbEl("div", {}, pbEl("span", { textContent: name }), pbEl("span", { textContent: entry.locals[name] })));
  const last = pbIndex === pbRecording.trace.length - 1;
  if (last && pbRecording.result !== undefined) rows.push(pbEl("div", {}, pbEl("strong", { textContent: "returns" }), pbEl("span", { textContent: pbRecording.result })));
  if (last && pbRecording.error) rows.push(pbEl("div", { className: "pb-error" }, pbEl("span", { textContent: `${pbRecording.error.type}: ${pbRecording.error.message}` })));
  if (last && pbRecording.truncated) rows.push(pbEl("div", { className: "pb-error" }, pbEl("span", { textContent: "Cut short: too many steps" })));
  $("pb-values").replaceChildren(...(rows.length ? rows : [pbEl("div", { textContent: "(no values yet)" })]));
  $("pb-output").textContent = last ? pbRecording.output : "";
  $("pb-play").textContent = pbTimer ? "Pause" : "Play";
}

function pbGo(index) {
  pbIndex = Math.max(0, Math.min(pbRecording.trace.length - 1, index));
  pbShowStep();
}

function pbPlayPause() {
  if (pbTimer) { pbStop(); pbShowStep(); return; }
  if (pbIndex >= pbRecording.trace.length - 1) pbIndex = 0;
  pbTimer = setInterval(() => {
    if (pbIndex >= pbRecording.trace.length - 1) { pbStop(); pbShowStep(); return; }
    pbGo(pbIndex + 1);
  }, 600);
  pbShowStep();
}

async function pbRecord() {
  const message = $("pb-message");
  message.textContent = "";
  message.className = "pb-error";
  let body;
  try {
    body = { project: current, node: pbGraph.node, args: JSON.parse($("pb-args").value || "[]"), fakes: JSON.parse($("pb-fakes").value || "{}") };
    if ($("pb-instance")) body.instance = { args: JSON.parse($("pb-instance").value || "[]") };
  } catch {
    message.textContent = "The inputs must be valid JSON, for example [130] for the arguments.";
    return;
  }
  const res = await post("/playback", body);
  const answer = await res.json();
  if (!res.ok) { message.textContent = answer.error; return; }
  pbStop();
  pbRecording = answer;
  $("algorithm").classList.add("has-recording");
  pbRender();
  pbGo(0);
}

// Builds the panel: the inputs always, the controls once there is a recording.
function pbRender() {
  const node = algoNodes.find((n) => n.id === pbGraph.node);
  const isMethod = algoNodes.find((n) => n.id === node?.parent)?.kind === "class";
  const field = (label, id, value) => pbEl("label", {}, label, pbEl("input", { id, value }));
  const parts = [
    pbEl("h2", { textContent: `Playback: ${pbGraph.node.split(".").pop()}` }),
    field("Arguments (JSON list)", "pb-args", "[]"),
    ...(isMethod ? [field("Constructor arguments of the instance (JSON list)", "pb-instance", "[]")] : []),
    field("Fake data for effects (JSON object)", "pb-fakes", "{}"),
    pbEl("button", { id: "pb-record", textContent: "Record a run", onclick: pbRecord }),
    pbEl("div", { id: "pb-message", className: "pb-error" }),
  ];
  if (pbRecording) {
    parts.push(
      pbEl("div", { className: "pb-row" },
        pbEl("button", { textContent: "⏮", title: "Back to the start", onclick: () => { pbStop(); pbGo(0); } }),
        pbEl("button", { textContent: "◀", title: "Step back", onclick: () => { pbStop(); pbGo(pbIndex - 1); } }),
        pbEl("button", { id: "pb-play", textContent: "Play", onclick: pbPlayPause }),
        pbEl("button", { textContent: "▶", title: "Step forward", onclick: () => { pbStop(); pbGo(pbIndex + 1); } }),
      ),
      pbEl("div", { className: "pb-row" },
        pbEl("input", { id: "pb-slider", type: "range", min: 0, max: pbRecording.trace.length - 1, value: pbIndex, oninput: (e) => { pbStop(); pbGo(Number(e.target.value)); } }),
        pbEl("span", { id: "pb-position" }),
      ),
      pbEl("div", { id: "pb-values", className: "pb-values" }),
      pbEl("pre", { id: "pb-output" }),
    );
  }
  $("panel").replaceChildren(...parts);
  if (pbRecording) {
    const inputs = pbRecording.input;
    $("pb-args").value = JSON.stringify(inputs.args);
    $("pb-fakes").value = JSON.stringify(inputs.fakes);
    if ($("pb-instance")) $("pb-instance").value = JSON.stringify(inputs.instance?.args ?? []);
  }
}

// A new graph starts without a recording.
document.addEventListener("algorithm-opened", (e) => {
  pbStop();
  pbGraph = e.detail;
  pbRecording = null;
  pbIndex = 0;
});

// The panel belongs to the Algorithms layer; leaving it pauses the replay.
const showLayerWithoutPlayback = showLayer;
showLayer = (which) => {
  showLayerWithoutPlayback(which);
  if (which !== "algorithms") pbStop();
  else if (pbGraph) { pbRender(); if (pbRecording) { $("algorithm").classList.add("has-recording"); pbShowStep(); } }
};
