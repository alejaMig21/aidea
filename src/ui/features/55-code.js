// Code layer: the exact source text behind what the person is looking at, as a view in the Canvas area (not a floating box).
// It shows the whole file of a Node with line numbers, the Node's lines (or an Algorithm step's) highlighted and scrolled into view.
// All text comes from the core (GET /source?whole=1); nothing here derives anything from the code. Names start with "code" because
// every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #code-view { position: absolute; left: 15px; right: 15px; top: 62px; bottom: 15px; z-index: 0; display: flex; flex-direction: column; min-height: 0; background: var(--raised); border: 1px solid var(--control); border-radius: 12px; overflow: hidden; }
    body.code-open #zoom { display: none; }
    #code-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    #code-head .where { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }
    #code-head strong { font-size: 14px; font-weight: 500; color: var(--text); }
    #code-head .lines { margin-left: 8px; font-size: 12px; color: var(--muted); }
    #code-head button { font-size: 13px; }
    #code-head button.quiet { background: transparent; color: var(--text); border: 1px solid var(--control); }
    #code-head input { flex: 1 1 100%; min-width: 0; font-size: 13px; }
    #code-head .note { flex-basis: 100%; font-size: 12px; color: var(--muted); }
    #code-body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 0; font: 12.5px/1.6 var(--mono); font-variant-ligatures: none; /* the text is shown exactly as written */ color: var(--text); }
    #code-body .cl { width: max-content; min-width: 100%; padding: 0 12px; white-space: pre; tab-size: 4; }
    #code-body .cl::before { content: attr(data-n); display: inline-block; width: var(--gutter, 4ch); margin-right: 16px; text-align: right; color: var(--muted); user-select: none; }
    #code-body .cl.hit { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    #code-body .said { margin: 0; padding: 14px 16px; font: 13.5px/1.5 var(--sans); white-space: normal; }
    #panel .code-pick { margin: 6px 0 10px; font-size: 13.5px; overflow-wrap: anywhere; }
  `;
  document.head.append(style);
}

const codeView = Object.assign(document.createElement("section"), { id: "code-view", hidden: true });
codeView.setAttribute("aria-label", "Code layer");
const codeHead = Object.assign(document.createElement("div"), { id: "code-head" });
const codeBody = Object.assign(document.createElement("div"), { id: "code-body", tabIndex: 0 });
codeView.append(codeHead, codeBody);
document.querySelector("main").append(codeView);

const CODE_EMPTY = "Select a class, function or module on Components, or open a step of an algorithm.";
let codeFocus = null; // what the view shows: { node, step: { algo, id } | null, back: the layer it was opened from }
let codeSelected = null; // the Node selected on Components; the Code tab and "View code" open it
let codePending = false; // a Node was selected after the view was last opened
let codeLost = ""; // the sentence shown instead of a Node that a refresh could not find any more
let codeRequest = 0; // numbers the requests so a slow answer cannot replace a newer one
let codeProject = null;

const codeLabel = (layer) => layer === "algorithms" ? "Algorithms" : layerBar.querySelector(`[data-layer="${layer}"]`)?.textContent ?? layer; // the Algorithms tab also names the open function
const codeBackTarget = () => {
  const back = codeFocus?.back ?? "components";
  return layerBar.querySelector(`[data-layer="${back}"]`)?.disabled ? "components" : back;
};

function codeBackButton() {
  const target = codeBackTarget();
  const back = Object.assign(document.createElement("button"), { type: "button", className: "quiet", textContent: `Back to ${codeLabel(target)}` });
  back.setAttribute("aria-label", `Back to the ${codeLabel(target)} layer`);
  back.onclick = codeGoBack;
  return back;
}
function codeGoBack() {
  const target = codeBackTarget();
  showLayer(target);
  layerBar.querySelector(`[data-layer="${target}"]`)?.focus();
}

// A plain sentence in place of the file (nothing in focus, a file that cannot be shown, a Node that is gone).
function codeSay(text, withBack) {
  codeHead.replaceChildren(...(withBack ? [codeBackButton()] : []));
  codeHead.hidden = !withBack;
  const p = Object.assign(document.createElement("p"), { className: "said", textContent: text });
  p.setAttribute("role", "status");
  codeBody.replaceChildren(p);
  codeBody.removeAttribute("aria-label");
  codeBody.removeAttribute("role");
}

// The editor choice for this Project, with a button that opens the Node in it (the template is typed by the person; the core checks it).
function codeEditorControls(nodeId) {
  const btn = Object.assign(document.createElement("button"), { type: "button", textContent: "Open in my editor" });
  btn.onclick = async () => {
    const r = await fetch("/open-in-editor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, node: nodeId }) });
    $("error").textContent = r.ok ? "" : (await r.json()).error;
  };
  const picker = document.createElement("select");
  picker.className = "agent-opt";
  picker.setAttribute("aria-label", "Editor to open the code in");
  picker.disabled = true;
  const template = Object.assign(document.createElement("input"), { type: "text", placeholder: "my-editor --line {line} {file}", hidden: true });
  template.setAttribute("aria-label", "Command for your editor; {file} is the file and {line} the line");
  const note = Object.assign(document.createElement("div"), { className: "note", hidden: true });
  const saveEditor = async () => {
    const body = { project: current, editor: picker.value, template: template.value };
    const r = await fetch("/editor-setting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    note.hidden = r.ok;
    note.textContent = r.ok ? "" : (await r.json()).error;
  };
  picker.onchange = () => { template.hidden = picker.value !== "custom"; if (picker.value !== "custom") saveEditor(); };
  template.onchange = saveEditor;
  fetch(`/editor-setting?project=${encodeURIComponent(current)}`).then((r) => r.ok ? r.json() : null).then((s) => {
    if (!s) return;
    picker.replaceChildren(...s.editors.map((e) => Object.assign(document.createElement("option"), { value: e.id, textContent: e.label })));
    picker.value = s.editor;
    template.value = s.template;
    template.hidden = s.editor !== "custom";
    picker.disabled = false;
  }).catch(() => {});
  return [picker, btn, template, note];
}

function codeRender(body, nodeId) {
  const where = Object.assign(document.createElement("div"), { className: "where" });
  const lines = body.endLine > body.line ? `lines ${body.line} to ${body.endLine}` : `line ${body.line}`;
  where.append(Object.assign(document.createElement("strong"), { textContent: body.file }), Object.assign(document.createElement("span"), { className: "lines", textContent: lines }));
  codeHead.replaceChildren(where, ...codeEditorControls(nodeId), codeBackButton());
  codeHead.hidden = false;
  const rows = body.text.split(/\r?\n/);
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  codeBody.style.setProperty("--gutter", `${Math.max(3, String(rows.length).length)}ch`);
  const frag = document.createDocumentFragment();
  rows.forEach((text, i) => {
    const row = Object.assign(document.createElement("div"), { className: i + 1 >= body.line && i + 1 <= body.endLine ? "cl hit" : "cl", textContent: text });
    row.dataset.n = i + 1;
    frag.append(row);
  });
  codeBody.replaceChildren(frag);
  codeBody.setAttribute("role", "region");
  codeBody.setAttribute("aria-label", `Source text of ${body.file}`);
}

// Scrolls the highlighted lines into view; the view must be on screen for the measures to mean anything.
function codeScroll() {
  const first = codeBody.querySelector(".hit");
  if (first) codeBody.scrollTop = Math.max(0, first.offsetTop - codeBody.offsetTop - codeBody.clientHeight / 3);
}

// Reads a Node's file into the view without showing the layer. `range` ({from, to}) and `step` ({algo, id}) come from a step of an Algorithm graph.
async function codeLoad(nodeId, range, step, back) {
  const project = current, request = ++codeRequest;
  const query = `project=${encodeURIComponent(project)}&node=${encodeURIComponent(nodeId)}&whole=1${range ? `&from=${range.from}&to=${range.to}` : ""}`;
  const res = await fetch(`/source?${query}`);
  const body = await res.json();
  if (project !== current || request !== codeRequest) return false; // another Project or Node was opened meanwhile
  codeFocus = { node: nodeId, step, back };
  codePending = false;
  codeLost = "";
  if (res.ok) codeRender(body, nodeId); else codeSay(body.error, true);
  return res.ok;
}

// Opens the Code layer on a Node; the way back is the layer the person comes from.
async function codeOpen(nodeId, range, step = null) {
  if (!current) return false;
  const ok = await codeLoad(nodeId, range, step, authoredShown === "code" ? codeFocus?.back ?? "components" : authoredShown);
  if (codeFocus?.node !== nodeId) return false; // a newer request owns the view
  showLayer("code");
  codeScroll();
  return ok;
}

// A refresh read the code again: the view shows the same Node if it still exists and says so if it does not. `layer` is where the person was.
async function codeRefresh(nodes, layer) {
  if (!codeFocus) return;
  const { node, step, back } = codeFocus;
  if (!nodes.some((n) => n.id === node)) {
    codeFocus = null;
    codeLost = `${node.split(".").pop()} is not in the code any more: it was moved, renamed or deleted. Select another on Components.`;
    if (layer === "code") codeSay(codeLost, true);
    return;
  }
  // A step's lines are the graph's: from Code the graph is read again (that switches layer, so Code is shown again below); from Algorithms it already was.
  if (step && layer === "code" && !(algoGraph && algoOpenId === step.algo) && nodes.some((n) => n.id === step.algo)) await algoOpen(step.algo, true);
  const s = step && algoGraph && algoOpenId === step.algo ? algoGraph.steps.find((x) => x.id === step.id) : null;
  await codeLoad(node, s ? { from: s.line, to: s.endLine ?? s.line } : undefined, s ? step : null, back);
  if (layer === "code") { showLayer("code"); codeScroll(); }
}

// Selecting a Node does not open code by itself: the panel offers "View code", and so does the Code tab.
function onSelect(nodeId) {
  if (!current) return;
  codeSelected = nodeId;
  codePending = true;
  const n = algoNodes.find((x) => x.id === nodeId);
  const view = Object.assign(document.createElement("button"), { type: "button", textContent: "View code" });
  view.setAttribute("aria-label", `View the code of ${n?.name ?? nodeId}`);
  view.onclick = () => codeOpen(nodeId);
  $("panel").replaceChildren(
    Object.assign(document.createElement("h2"), { textContent: n?.kind ?? "Selected" }),
    Object.assign(document.createElement("p"), { className: "code-pick", textContent: n?.name ?? nodeId }),
    view,
  );
}

// The tab: with a Node selected since last time it opens that Node; otherwise it shows what was shown (or says how to pick something).
codeTab.disabled = true;
codeTab.title = "Read the code behind a Node";
codeTab.onclick = () => {
  if (codePending && codeSelected && codeSelected !== codeFocus?.node) codeOpen(codeSelected);
  else showLayer("code");
};

const showLayerWithoutCode = showLayer;
showLayer = (which) => {
  showLayerWithoutCode(which);
  codeView.hidden = which !== "code";
  document.body.classList.toggle("code-open", which === "code");
  layerBar.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); // the bar scrolls in a narrow Canvas: the layer on screen stays visible
  if (which === "code" && !codeFocus) codeSay(codeLost || CODE_EMPTY, Boolean(codeLost));
};

// A Project with nodes has code to read; a different Project starts with nothing in focus.
const drawWithoutCode = draw;
draw = async (nodes) => {
  if (codeProject !== current) { codeProject = current; codeFocus = null; codeSelected = null; codePending = false; codeLost = ""; codeBody.replaceChildren(); }
  await drawWithoutCode(nodes);
  codeTab.disabled = !nodes.length;
};

// Escape goes back to the layer the view was opened from, unless it is closing something else first.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || authoredShown !== "code" || e.cancelBubble || !legendPop.hidden || layoutDrawer || !$("switcher-menu").hidden) return;
  if (document.activeElement?.matches?.("input, select, textarea")) return;
  codeGoBack();
}, true);

notationRegisterLegend("code", {
  shapes: [
    [notationSwatch(`<rect x="2" y="4" width="40" height="16" style="fill:color-mix(in srgb, var(--accent) 16%, transparent);stroke:none"/><rect x="2" y="4" width="3" height="16" style="fill:var(--accent);stroke:none"/>`), "Tinted lines with a bar: the lines of the Node or the algorithm step you opened", "#code-body .cl.hit"],
    [notationSwatch(`<text x="22" y="16" text-anchor="end" style="fill:var(--muted);font:12px var(--mono)">12</text>`), "Grey numbers: the line numbers of the file, left out when you copy the text", "#code-body .cl"],
  ],
  colours: [["accent", "Blue: the lines in focus"]],
  notShown: ["Syntax colours: the text is shown exactly as written", "Editing: the view is read-only, use Open in my editor to change the file", "Files over 500 KB, or files that are not text", "What the code does when it runs (see Algorithms and Playback)"],
});
