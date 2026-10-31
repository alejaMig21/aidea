// Code panel: the exact source text behind what the person is looking at, in a card of its own beside the Canvas (not a layer, not a floating box).
// It shows the whole file with line numbers and syntax colours, the lines of a Node or a Flow step highlighted and scrolled into view.
// A file is chosen in the Files panel; a Node's code is opened from the Details ("View code") or from a step of a Flow.
// All text comes from the core (GET /source); nothing here derives anything from the code. Names start with "code" because every feature
// file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-code { flex: 1 1 auto; min-height: 0; padding: 0; gap: 0; overflow: hidden; }
    #code-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); flex: none; }
    #code-head .where { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }
    #code-head strong { font-size: 14px; font-weight: 500; color: var(--text); }
    #code-head .lines { margin-left: 8px; font-size: 12px; color: var(--muted); }
    #code-head button { font-size: 13px; }
    #code-head input { flex: 1 1 100%; min-width: 0; font-size: 13px; }
    #code-head .note { flex-basis: 100%; font-size: 12px; color: var(--muted); }
    #code-body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 0; font: 12.5px/1.6 var(--mono); font-variant-ligatures: none; /* the text is shown exactly as written */ color: var(--text); }
    #code-body .cl { width: max-content; min-width: 100%; padding: 0 12px; white-space: pre; tab-size: 4; }
    #code-body .cl::before { content: attr(data-n); display: inline-block; width: var(--gutter, 4ch); margin-right: 16px; text-align: right; color: var(--muted); user-select: none; }
    #code-body .cl.hit { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    #code-body .said { margin: 0; padding: 14px 16px; font: 13.5px/1.5 var(--sans); white-space: normal; color: var(--muted); }
    #code-body .tk-k { color: var(--syn-keyword); } #code-body .tk-s { color: var(--syn-string); } #code-body .tk-n { color: var(--syn-number); } #code-body .tk-c { color: var(--muted); }
    #panel .code-pick { margin: 6px 0 10px; font-size: 13.5px; overflow-wrap: anywhere; }
  `;
  document.head.append(style);
}

const codeHead = Object.assign(document.createElement("div"), { id: "code-head", hidden: true });
const codeBody = Object.assign(document.createElement("div"), { id: "code-body", tabIndex: 0 });
$("pane-code").append(codeHead, codeBody);

const CODE_EMPTY = "Choose a file in Files, or select a class, function or module on Components and press View code.";
let codeFocus = null; // what the panel shows: { node, step: { algo, id } | null } for a Node, { path } for a file
let codeSelected = null; // the Node selected on Components; "View code" opens it
let codeRequest = 0; // numbers the requests so a slow answer cannot replace a newer one
let codeProject = null;

// Syntax colours. ponytail: a line at a time with one regular expression per language, so a string or comment that spans lines is coloured wrongly
// after its first line; a real parser per language is the upgrade if that bothers anyone. Files over 4000 lines and lines over 1000 characters are shown plain.
const codeWords = (w) => `\\b(?:${w.trim().split(/\s+/).join("|")})\\b`;
const codeLanguages = {
  python: { ext: ["py", "pyw"], comment: "#", words: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield" },
  script: { ext: ["js", "mjs", "cjs", "jsx", "ts", "tsx", "mts", "cts"], comment: "//", words: "abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while with yield" },
};
for (const l of Object.values(codeLanguages)) l.re = new RegExp(`(${l.comment}.*$)|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b0[xX][\\da-fA-F_]+\\b|\\b\\d[\\d_.]*(?:[eE][+-]?\\d+)?\\b)|((?<!\\.)${codeWords(l.words)})`, "g");
const codeLanguageOf = (file) => Object.values(codeLanguages).find((l) => l.ext.includes(file.slice(file.lastIndexOf(".") + 1).toLowerCase()));
// The pieces of one line: [class, text] pairs, "" for plain text.
function codeSegments(text, language) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(language.re)) {
    if (m.index > at) out.push(["", text.slice(at, m.index)]);
    out.push([m[1] !== undefined ? "tk-c" : m[2] !== undefined ? "tk-s" : m[3] !== undefined ? "tk-n" : "tk-k", m[0]]);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(["", text.slice(at)]);
  return out;
}

// A plain sentence in place of the file (nothing in focus, a file that cannot be shown, a Node that is gone).
function codeSay(text, where) {
  const title = where && Object.assign(document.createElement("div"), { className: "where" });
  title?.append(Object.assign(document.createElement("strong"), { textContent: where }));
  codeHead.replaceChildren(...(title ? [title] : []));
  codeHead.hidden = !where;
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

// `nodeId` is the Node behind the text, when there is one: only then is "Open in my editor" offered (ticket 06 adds it for any file).
function codeRender(body, nodeId) {
  const where = Object.assign(document.createElement("div"), { className: "where" });
  where.append(Object.assign(document.createElement("strong"), { textContent: body.file }));
  if (body.line) where.append(Object.assign(document.createElement("span"), { className: "lines", textContent: body.endLine > body.line ? `lines ${body.line} to ${body.endLine}` : `line ${body.line}` }));
  codeHead.replaceChildren(where, ...(nodeId ? codeEditorControls(nodeId) : []));
  codeHead.hidden = false;
  const rows = body.text.split(/\r?\n/);
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  const language = rows.length <= 4000 ? codeLanguageOf(body.file) : undefined;
  codeBody.style.setProperty("--gutter", `${Math.max(3, String(rows.length).length)}ch`);
  const frag = document.createDocumentFragment();
  rows.forEach((text, i) => {
    const row = Object.assign(document.createElement("div"), { className: body.line && i + 1 >= body.line && i + 1 <= body.endLine ? "cl hit" : "cl" });
    if (language && text.length <= 1000) row.append(...codeSegments(text, language).map(([cls, part]) => (cls ? Object.assign(document.createElement("span"), { className: cls, textContent: part }) : document.createTextNode(part))));
    else row.textContent = text;
    row.dataset.n = i + 1;
    frag.append(row);
  });
  codeBody.replaceChildren(frag);
  codeBody.setAttribute("role", "region");
  codeBody.setAttribute("aria-label", `Source text of ${body.file}`);
}

// Scrolls the highlighted lines into view; the panel must be on screen for the measures to mean anything.
function codeScroll() {
  const first = codeBody.querySelector(".hit");
  codeBody.scrollTop = first ? Math.max(0, first.offsetTop - codeBody.clientHeight / 3) : 0;
}

// Reads a Node's file, or a file by its path, into the panel without showing it. `range` ({from, to}) and `step` ({algo, id}) come from a step of a Flow.
// A refresh (`quiet`) takes no request number of its own, so a file chosen while it runs is never discarded; a choice made during it discards the refresh.
async function codeLoad(focus, range, quiet = false) {
  const project = current, request = quiet ? codeRequest : ++codeRequest;
  const target = focus.path !== undefined ? `file=${encodeURIComponent(focus.path)}` : `node=${encodeURIComponent(focus.node)}&whole=1`;
  const res = await fetch(`/source?project=${encodeURIComponent(project)}&${target}${range ? `&from=${range.from}&to=${range.to}` : ""}`);
  const body = await res.json();
  if (project !== current || request !== codeRequest) return false; // another Project or file was opened meanwhile
  codeFocus = focus;
  if (res.ok) codeRender(body, focus.node); else codeSay(body.error, focus.path ?? focus.node);
  return res.ok;
}

// Shows the panel (a drawer in a narrow window) and the highlighted lines in it.
async function codeShow(ok) {
  layoutShowPane("code");
  await new Promise((done) => requestAnimationFrame(done)); // the card has its size once the layout has been applied
  if (ok) codeScroll();
}

async function codeOpenFocus(focus, range) {
  if (!current) return false;
  const ok = await codeLoad(focus, range);
  if (codeFocus !== focus) return false; // a newer request owns the panel
  await codeShow(ok);
  return ok;
}

// Opens the panel on a Node's code; `step` marks it as the lines of a Flow step.
const codeOpen = (nodeId, range, step = null) => codeOpenFocus({ node: nodeId, step }, range);

// Opens the panel on a file by its path in the Project (what the Files panel knows), optionally with lines to highlight.
const codeOpenFile = (path, range) => codeOpenFocus({ path }, range);

// A refresh read the code again: the panel shows the same Node or file again, and says so if the Node does not exist any more.
async function codeRefresh(nodes) {
  if (!codeFocus) return;
  const { node, step, path } = codeFocus;
  if (path !== undefined) { await codeLoad({ path }, undefined, true); return; }
  if (!nodes.some((n) => n.id === node)) {
    codeFocus = null;
    codeSay(`${node.split(".").pop()} is not in the code any more: it was moved, renamed or deleted. Select another on Components.`);
    return;
  }
  // A step's lines are the graph's: they are kept only while that Flow is still the one open.
  const s = step && algoGraph && algoOpenId === step.algo ? algoGraph.steps.find((x) => x.id === step.id) : null;
  await codeLoad({ node, step: s ? step : null }, s ? { from: s.line, to: s.endLine ?? s.line } : undefined, true);
}

// Selecting a Node does not open code by itself: the Details offer "View code".
function onSelect(nodeId) {
  if (!current) return;
  codeSelected = nodeId;
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

// A different Project starts with nothing in focus.
const drawWithoutCode = draw;
draw = async (nodes) => {
  if (codeProject !== current) { codeProject = current; codeFocus = null; codeSelected = null; codeSay(CODE_EMPTY); }
  await drawWithoutCode(nodes);
};

codeSay(CODE_EMPTY);
