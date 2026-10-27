// Playback: record one real run of the open Algorithm graph's function, then replay it step by step.
// The core runs the function once and keeps the recording; everything here replays that recording and never re-runs the code.
const playbackStyle = document.createElement("style");
playbackStyle.textContent = `
  #algorithm.has-recording .flow-step:not(.visited) { opacity: .4; }
  #algorithm .flow-step.now rect { stroke: var(--accent); stroke-width: 4; }
  #pane-algorithm label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--muted); }
  #pane-algorithm .pb-row { display: flex; gap: 6px; align-items: center; }
  #pane-algorithm .pb-values { font: 12px/1.5 ui-monospace, monospace; margin: 8px 0; }
  #pane-algorithm .pb-values div { display: flex; justify-content: space-between; gap: 8px; }
  #pane-algorithm .pb-error { color: #c0392b; font-size: 12px; }
  #pane-algorithm .pb-warning { color: var(--muted); font-size: 12px; margin: 4px 0; }
  #pane-algorithm .pb-check { flex-direction: row; align-items: center; gap: 6px; }
  #pane-algorithm input[type="range"] { flex: 1; }
`;
document.head.append(playbackStyle);

// The Algorithm column: a tab in the right slot, present only while the Algorithms layer is shown.
// Proposals stay in #panel, outside this column, so deciding on them works from any tab.
const pbPane = document.createElement("div");
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
  const entry = pbRecording.visits[pbIndex];
  document.querySelectorAll("#algorithm .flow-step").forEach((g) => {
    const seen = pbRecording.visits.slice(0, pbIndex + 1).some((e) => e.step === g.dataset.step);
    g.classList.toggle("visited", seen);
    g.classList.toggle("now", g.dataset.step === entry.step);
  });
  $("pb-position").textContent = `${pbIndex + 1} / ${pbRecording.visits.length}`;
  $("pb-slider").value = pbIndex;
  const names = Object.keys(entry.locals);
  const rows = names.map((name) => pbEl("div", {}, pbEl("span", { textContent: name }), pbEl("span", { textContent: entry.locals[name] })));
  const last = pbIndex === pbRecording.visits.length - 1;
  if (last && pbRecording.result !== undefined) rows.push(pbEl("div", {}, pbEl("strong", { textContent: "returns" }), pbEl("span", { textContent: pbRecording.result })));
  if (last && pbRecording.error) rows.push(pbEl("div", { className: "pb-error" }, pbEl("span", { textContent: `${pbRecording.error.type}: ${pbRecording.error.message}` })));
  if (last && pbRecording.truncated) rows.push(pbEl("div", { className: "pb-error" }, pbEl("span", { textContent: "Cut short: too many steps" })));
  $("pb-values").replaceChildren(...(rows.length ? rows : [pbEl("div", { textContent: "(no values yet)" })]));
  $("pb-output").textContent = last ? pbRecording.output : "";
  $("pb-play").textContent = pbTimer ? "Pause" : "Play";
}

function pbGo(index) {
  pbIndex = Math.max(0, Math.min(pbRecording.visits.length - 1, index));
  pbShowStep();
}

function pbPlayPause() {
  if (pbTimer) { pbStop(); pbShowStep(); return; }
  if (pbIndex >= pbRecording.visits.length - 1) pbIndex = 0;
  pbTimer = setInterval(() => {
    if (pbIndex >= pbRecording.visits.length - 1) { pbStop(); pbShowStep(); return; }
    pbGo(pbIndex + 1);
  }, 600);
  pbShowStep();
}

async function pbRecord() {
  const message = $("pb-message");
  message.textContent = "";
  message.className = "pb-error";
  document.querySelectorAll("#pane-algorithm .pb-field-error").forEach((n) => { n.textContent = ""; });
  const body = { project: current, node: pbGraph.node, useProjectPython: $("pb-own-python").checked };
  const read = (items, prefix) => Object.fromEntries(items.map((p) => [p.name, $(`${prefix}${p.name}`).value]));
  body.values = read(pbNode().parameters ?? [], "pb-v-");
  if (pbNode().constructorParameters) body.instanceValues = read(pbNode().constructorParameters, "pb-c-");
  if (pbNode().effects) body.effects = read(pbNode().effects, "pb-e-");
  const project = current;
  const res = await post("/playback", body);
  const answer = await res.json().catch(() => ({ error: "The core sent an answer that could not be read." }));
  if (project !== current) return; // another Project was opened meanwhile
  if (!res.ok) {
    const fields = Object.entries(answer.fields ?? {}).filter(([name]) => $(`pb-err-${name}`));
    for (const [name, text] of fields) $(`pb-err-${name}`).textContent = text; // shown on the field it belongs to
    if (!fields.length) message.textContent = answer.error;
    return;
  }
  pbStop();
  pbRecording = answer;
  $("algorithm").classList.add("has-recording");
  pbRender();
  pbGo(0);
}

const pbNode = () => algoNodes.find((n) => n.id === pbGraph.node);

// One labelled field per item (a parameter, or an effect row), prefilled with its suggested example.
// Its error shows right under it, under the key the core reports (`name`, `constructor.name` or `effect:name`).
function pbFieldGroup(title, items, prefix, errorKey, label, hint) {
  if (!items?.length) return [];
  const field = (p) => pbEl("label", {},
    label(p),
    pbEl("input", { id: `${prefix}${p.name}`, value: p.suggestion ?? "", placeholder: p.default !== undefined ? `default: ${p.default}` : hint }),
    pbEl("span", { id: `pb-err-${errorKey(p.name)}`, className: "pb-error pb-field-error" }));
  return [pbEl("h3", { textContent: title }), ...items.map(field)];
}

function pbFields(node) {
  const typed = (p) => (p.annotation ? `${p.name}: ${p.annotation}` : p.name);
  return [
    ...pbFieldGroup("Instance (constructor)", node.constructorParameters, "pb-c-", (n) => `constructor.${n}`, typed, "a Python value, such as 3 or [1, 2]"),
    ...pbFieldGroup(node.constructorParameters ? "Arguments of the method" : "Arguments", node.parameters, "pb-v-", (n) => n, typed, "a Python value, such as 3 or [1, 2]"),
    ...pbFieldGroup("Data for external effects", node.effects, "pb-e-", (n) => `effect:${n}`, (p) => `${p.name} gives back`, "a Python value, such as \"text\""),
    pbEl("button", { textContent: "Use example", onclick: () => {
      for (const [items, prefix] of [[node.constructorParameters, "pb-c-"], [node.parameters, "pb-v-"], [node.effects, "pb-e-"]]) {
        for (const p of items ?? []) $(`${prefix}${p.name}`).value = p.suggestion ?? "";
      }
    } }),
  ];
}

// Builds the panel: the inputs always, the controls once there is a recording.
function pbRender() {
  const parts = [
    pbEl("h2", { textContent: `Playback: ${pbGraph.node.split(".").pop()}` }),
    ...pbFields(pbNode()),
    pbEl("label", { className: "pb-check" }, pbEl("input", { id: "pb-own-python", type: "checkbox" }), "Use the Project's own Python (.venv, venv or env)"),
    pbEl("p", { className: "pb-warning", textContent: "Recording runs this function for real, on your computer, with the Project's own code. Writing files, network access and new programs are blocked as a safety net, not as a guarantee: only play code you trust." }),
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
        pbEl("input", { id: "pb-slider", type: "range", min: 0, max: pbRecording.visits.length - 1, value: pbIndex, oninput: (e) => { pbStop(); pbGo(Number(e.target.value)); } }),
        pbEl("span", { id: "pb-position" }),
      ),
      pbEl("div", { id: "pb-values", className: "pb-values" }),
      pbEl("pre", { id: "pb-output" }),
      pbEl("p", { className: "pb-warning", textContent: `Python used: ${pbRecording.interpreter}` }),
    );
  }
  pbPane.replaceChildren(...parts);
  if (pbRecording) {
    const inputs = pbRecording.input;
    $("pb-own-python").checked = pbRecording.interpreter !== "default";
    for (const [texts, prefix] of [[inputs.values, "pb-v-"], [inputs.instanceValues, "pb-c-"], [inputs.effects, "pb-e-"]]) {
      for (const [name, text] of Object.entries(texts ?? {})) if ($(`${prefix}${name}`)) $(`${prefix}${name}`).value = text;
    }
  }
}

// A new graph starts without a recording.
document.addEventListener("algorithm-opened", (e) => {
  pbStop();
  pbGraph = e.detail;
  pbRecording = null;
  pbIndex = 0;
});

// The column belongs to the Algorithms layer: opening it adds and selects the tab, leaving removes it and pauses the replay.
const showLayerWithoutPlayback = showLayer;
showLayer = (which) => {
  showLayerWithoutPlayback(which);
  if (which !== "algorithms" || !pbGraph) { pbStop(); rightUnregisterTab("algorithm"); }
  else {
    if (!pbPane.isConnected) rightRegisterTab("algorithm", "Algorithm", pbPane); // in the page first: pbRender looks fields up by id
    pbRender();
    rightShowTab("algorithm");
    if (pbRecording) { $("algorithm").classList.add("has-recording"); pbShowStep(); }
  }
};
