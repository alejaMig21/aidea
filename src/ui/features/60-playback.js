// Playback: record one real run of the open Algorithm graph's function, then replay it step by step.
// The core runs the function once and keeps the recording; everything here replays that recording and never re-runs the code.
const playbackStyle = document.createElement("style");
playbackStyle.textContent = `
  #algorithm.has-recording .flow-step:not(.visited) { opacity: .4; }
  #pane-algorithm { padding: 0; gap: 0; }
  #pane-algorithm > header { display: flex; justify-content: space-between; align-items: center; height: 40px; padding: 0 14px; border-bottom: 1px solid var(--line); font-weight: 600; font-size: 13px; flex: none; }
  #pane-algorithm > header span { font: 400 12px var(--mono); color: var(--muted); }
  #pane-algorithm .body { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  #pane-algorithm h3 { margin: 6px 0 0; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  #pane-algorithm hr { border: 0; border-top: 1px solid #202531; margin: 8px 0 2px; width: 100%; }
  #pane-algorithm label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--label); }
  #pane-algorithm input:not([type]), #pane-algorithm input[type="text"] { padding: 6px 10px; font-size: 13px; }
  #pane-algorithm .pb-row { display: flex; gap: 8px; align-items: center; }
  #pane-algorithm .pb-row > button { flex: 1; padding: 5px 10px; font-size: 13px; }
  #pane-algorithm .pb-row > button.step { flex: none; width: 29px; padding: 4px 0; }
  #pane-algorithm .pb-values, #pane-algorithm #pb-output { font: 12.5px/1.7 var(--mono); margin: 4px 0 0; padding: 10px 12px; background: var(--raised); border-radius: 8px; color: var(--text); white-space: pre-wrap; }
  #pane-algorithm #pb-output:empty { display: none; }
  #pane-algorithm .pb-values div { display: flex; justify-content: space-between; gap: 8px; }
  #pane-algorithm .pb-error { color: var(--danger); font-size: 12px; }
  #pane-algorithm .pb-warning, #pane-algorithm .pb-hint { color: var(--muted); font-size: 12px; margin: 4px 0; }
  #pane-algorithm .pb-check { flex-direction: row; align-items: center; gap: 6px; }
  #pane-algorithm input[type="range"] { flex: 1; min-width: 0; padding: 0; accent-color: var(--accent); }
  #pane-algorithm #pb-position { font-size: 12px; color: var(--muted); }
`;
document.head.append(playbackStyle);

// The Algorithm column: a tab in the right slot, always there, enabled only while an Algorithm is open.
// Proposals stay in #panel, outside this column, so deciding on them works from any tab.
const pbPane = document.createElement("div");
rightRegisterTab("algorithm", "Algorithms", pbPane); // always in the right slot, in the page so pbRender can find its fields by id
rightSetTabEnabled("algorithm", false); // until an Algorithm is open
let pbGraph = null;     // the open Algorithm graph
let pbRecording = null; // the recording being replayed
let pbIndex = 0;
let pbPrevIndex = -1; // the step shown before, so the token knows which edge to travel
let pbRenderedFor = null; // the graph the form was last built for: the form is rebuilt only when this changes
let pbTimer = null;

const pbStop = () => { clearInterval(pbTimer); pbTimer = null; };

const pbEl = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};

function pbShowStep() {
  pbShowEntry();
  document.dispatchEvent(new Event("playback-step")); // the trace table and the step controls follow
}
function pbShowEntry() {
  const entry = pbRecording.visits[pbIndex];
  if (!entry) { // the run failed before its first step (for example a missing argument)
    $("pb-position").textContent = "0 / 0";
    $("pb-values").replaceChildren(pbEl("div", { className: "pb-error" }, pbEl("span", { textContent: pbRecording.error ? `${pbRecording.error.type}: ${pbRecording.error.message}` : "Nothing was recorded" })));
    $("pb-output").textContent = pbRecording.output ?? "";
    return;
  }
  flowReplay(pbRecording.visits, pbIndex, pbPrevIndex);
  pbPrevIndex = pbIndex;
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
  pbPrevIndex = -1;
  pbRecording = answer;
  $("algorithm").classList.add("has-recording");
  pbRender();
  pbGo(0);
}

const pbNode = () => pbGraph && algoNodes.find((n) => n.id === pbGraph.node);

// One labelled field per item (a parameter, or an effect row), prefilled with its suggested example.
// Its error shows right under it, under the key the core reports (`name`, `constructor.name` or `effect:name`).
function pbFieldGroup(title, items, prefix, errorKey, label, hint) {
  if (!items?.length) return [];
  const field = (p) => pbEl("label", {},
    label(p),
    pbEl("input", { id: `${prefix}${p.name}`, value: p.suggestion ?? "", placeholder: p.default !== undefined ? `default: ${p.default}` : hint }),
    pbEl("span", { id: `pb-err-${errorKey(p.name)}`, className: "pb-error pb-field-error" }));
  return [...(title === "Arguments" ? [] : [pbEl("h3", { textContent: title })]), ...items.map(field)]; // "Test data" already heads the plain case
}

function pbFields(node) {
  const typed = (p) => (p.annotation ? `${p.name}: ${p.annotation}` : p.name);
  return [
    ...pbFieldGroup("Instance (constructor)", node.constructorParameters, "pb-c-", (n) => `constructor.${n}`, typed, "a Python value, such as 3 or [1, 2]"),
    ...pbFieldGroup(node.constructorParameters ? "Arguments of the method" : "Arguments", node.parameters, "pb-v-", (n) => n, typed, "a Python value, such as 3 or [1, 2]"),
    ...pbFieldGroup("Data for external effects", node.effects, "pb-e-", (n) => `effect:${n}`, (p) => `${p.name} gives back`, "a Python value, such as \"text\""),
  ];
}

// Builds the panel: the inputs always, the controls once there is a recording.
function pbRender() {
  if (!pbNode()) { rightSetTabEnabled("algorithm", false); return; } // the function is gone (another Project): nothing to show
  pbRenderedFor = pbGraph;
  const node = pbNode();
  const useExample = () => {
    for (const [items, prefix] of [[node.constructorParameters, "pb-c-"], [node.parameters, "pb-v-"], [node.effects, "pb-e-"]]) {
      for (const p of items ?? []) $(`${prefix}${p.name}`).value = p.suggestion ?? "";
    }
  };
  const parts = [
    pbEl("h3", { textContent: "Test data" }),
    ...pbFields(node),
    pbEl("p", { className: "pb-hint", textContent: "Numbers, text in quotes like \"hi\", or lists like [1, 2, 3]." }),
    pbEl("div", { className: "pb-row" }, pbEl("button", { textContent: "Use example", onclick: useExample }), pbEl("button", { id: "pb-record", className: "primary", textContent: "Record a run", onclick: pbRecord })),
    pbEl("label", { className: "pb-check" }, pbEl("input", { id: "pb-own-python", type: "checkbox" }), "Use the Project's own Python (.venv, venv or env)"),
    pbEl("p", { className: "pb-warning", textContent: "Recording runs this function for real, on your computer, with the Project's own code. Writing files, network access and new programs are blocked as a safety net, not as a guarantee: only play code you trust." }),
    pbEl("div", { id: "pb-message", className: "pb-error" }),
  ];
  if (pbRecording) {
    parts.push(
      pbEl("hr"),
      pbEl("h3", { textContent: "Playback" }),
      pbEl("div", { className: "pb-row" },
        pbEl("button", { className: "step", textContent: "‹", title: "Step back", onclick: () => { pbStop(); pbGo(pbIndex - 1); } }),
        pbEl("input", { id: "pb-slider", type: "range", min: 0, max: pbRecording.visits.length - 1, value: pbIndex, oninput: (e) => { pbStop(); pbGo(Number(e.target.value)); } }),
        pbEl("button", { className: "step", textContent: "›", title: "Step forward", onclick: () => { pbStop(); pbGo(pbIndex + 1); } }),
      ),
      pbEl("div", { className: "pb-row" },
        pbEl("button", { textContent: "⏮", title: "Back to the start", onclick: () => { pbStop(); pbGo(0); } }),
        pbEl("button", { id: "pb-play", className: "primary", textContent: "Play", onclick: pbPlayPause }),
        pbEl("span", { id: "pb-position" }),
      ),
      pbEl("div", { id: "pb-values", className: "pb-values" }),
      pbEl("pre", { id: "pb-output" }),
      pbEl("p", { className: "pb-warning", textContent: `Python used: ${pbRecording.interpreter}` }),
    );
  }
  pbPane.replaceChildren(pbEl("header", {}, "Algorithm", pbEl("span", { textContent: pbGraph.node.split(".").pop() })), pbEl("div", { className: "body" }, ...parts));
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
  algoGroup.classList.remove("has-recording"); // the new graph has no recording yet
  pbGraph = e.detail;
  pbRecording = null;
  pbIndex = 0;
  pbPrevIndex = -1;
  pbRenderedFor = null;
});

// Opening or redrawing a Project drops the graph the form belonged to.
const drawWithoutPlayback = draw;
draw = async (nodes) => {
  pbStop();
  algoGroup.classList.remove("has-recording");
  pbGraph = null;
  pbRecording = null;
  pbIndex = 0;
  pbRenderedFor = null;
  rightSetTabEnabled("algorithm", false);
  await drawWithoutPlayback(nodes);
};

// The column belongs to the Algorithms layer: opening it adds and selects the tab, leaving removes it and pauses the replay.
const showLayerWithoutPlayback = showLayer;
showLayer = (which) => {
  showLayerWithoutPlayback(which);
  if (which !== "algorithms" || !pbNode()) { pbStop(); rightSetTabEnabled("algorithm", false); }
  else {
    rightSetTabEnabled("algorithm", true);
    if (pbRenderedFor !== pbGraph) pbRender(); // keep what the person typed unless the graph changed
    rightShowTab("algorithm");
    if (pbRecording) { $("algorithm").classList.add("has-recording"); pbShowStep(); }
  }
};
