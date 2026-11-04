// Code panel: the exact source text behind what the person is looking at, in a card of its own beside the Canvas (not a layer, not a floating box).
// It holds the files the person opened as tabs. A tab shows the whole file with line numbers and syntax colours, the lines of a Node or a Flow step highlighted
// and scrolled into view, and remembers those lines and its scroll position while another tab is shown.
// A file is chosen in the Files panel; a Node's code is opened from the Details ("View code") or from a step of a Flow.
// All text comes from the core (GET /source); nothing here derives anything from the code. Names start with "code" because every feature
// file shares one global scope.
// Keys on the tabs (ARIA tablist): Left and Right move between tabs (and show them), Home and End go to the first and the last, Delete closes the tab.
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-code { flex: 1 1 auto; min-height: 0; padding: 0; gap: 0; overflow: hidden; display: flex; flex-direction: column; }
    #code-tabs { display: flex; flex: none; overflow-x: auto; border-bottom: 1px solid var(--line); }
    #code-tabs[hidden] { display: none; }
    #code-tabs .code-tab { display: flex; flex: none; align-items: center; max-width: 220px; border-right: 1px solid var(--line); }
    #code-tabs .code-tab.on { background: var(--selected); box-shadow: inset 0 -2px var(--accent); }
    #code-tabs button { font: 13px var(--sans); background: transparent; border: 0; border-radius: 0; color: var(--muted); padding: 7px 8px; min-height: 30px; }
    #code-tabs button[role="tab"] { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 12px; }
    #code-tabs .code-tab.on button[role="tab"] { color: var(--text); }
    #code-tabs .code-tab.gone button[role="tab"] { font-style: italic; }
    #code-tabs button:hover { background: var(--raised); filter: none; }
    #code-tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    #code-tabs .code-close { flex: none; padding: 7px 8px 7px 2px; }
    #code-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); flex: none; }
    #code-head .where { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }
    #code-head strong { font-size: 14px; font-weight: 500; color: var(--text); }
    #code-head .lines { margin-left: 8px; font-size: 12px; color: var(--muted); }
    #code-head button { font-size: 13px; }
    #code-head input { flex: 1 1 100%; min-width: 0; font-size: 13px; }
    #code-head .note { flex-basis: 100%; font-size: 12px; color: var(--muted); }
    #code-head [hidden] { display: none; }
    #code-stack { position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    #code-stack .code-text { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 0; font: 12.5px/1.6 var(--mono); font-variant-ligatures: none; /* the text is shown exactly as written */ color: var(--text); }
    #code-stack .code-text[hidden] { display: none; }
    .code-text .cl { width: max-content; min-width: 100%; padding: 0 12px; white-space: pre; tab-size: 4; }
    .code-text .cl::before { content: attr(data-n); display: inline-block; width: var(--gutter, 4ch); margin-right: 16px; text-align: right; color: var(--muted); user-select: none; }
    .code-text .cl.hit { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    #code-stack .said { margin: 0; padding: 14px 16px; font: 13.5px/1.5 var(--sans); white-space: normal; color: var(--muted); }
    .code-text .tk-k { color: var(--syn-keyword); } .code-text .tk-s { color: var(--syn-string); } .code-text .tk-n { color: var(--syn-number); } .code-text .tk-c { color: var(--muted); }
    #panel .code-pick { margin: 6px 0 10px; font-size: 13.5px; overflow-wrap: anywhere; }
  `;
  document.head.append(style);
}

const codeTabsEl = Object.assign(document.createElement("div"), { id: "code-tabs", hidden: true });
codeTabsEl.setAttribute("role", "tablist");
codeTabsEl.setAttribute("aria-label", "Open files");
const codeHead = Object.assign(document.createElement("div"), { id: "code-head", hidden: true });
const codeStack = Object.assign(document.createElement("div"), { id: "code-stack" });
$("pane-code").append(codeTabsEl, codeHead, codeStack);
$("pane-code").dataset.selectionFix = ""; // text selected here may also be fixed by the Builder (54-select.js)

const CODE_EMPTY = "Choose a file in Files, or select a class, function or module on Components and press View code.";
const codeEmptyEl = Object.assign(document.createElement("p"), { className: "said", textContent: CODE_EMPTY });
codeStack.append(codeEmptyEl);

// One tab per file: { id, focus: what to ask the core for ({ node, step } or { path }), path (in the Project, once known), status (of the last read),
// gone (the file or Node does not exist any more), hit ({ line, endLine } highlighted), scroll, stale (changed on disk since it was read), el, button, wrap }.
const codeTabs = [];
const codeRecent = []; // tabs, the one shown last
let codeActive = null;
let codeSelected = null; // the Node selected on Components; "View code" opens it
let codeRequest = 0; // numbers the opens so the last one chosen is the one shown
let codeProject = null;
let codeTabCount = 0;

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

// The editor choice for this Project (one picker for the whole panel) and the button that opens the file shown in it. The template is typed by the
// person and checked by the core; the file and line sent are those of the tab shown.
const codeEditor = (() => {
  const btn = Object.assign(document.createElement("button"), { type: "button", textContent: "Open in my editor" });
  btn.onclick = async () => {
    if (!codeActive?.path) return;
    try {
      const r = await fetch("/open-in-editor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, file: codeActive.path, line: codeActive.hit?.line ?? 1 }) });
      $("error").textContent = r.ok ? "" : (await r.json()).error;
    } catch { $("error").textContent = "Could not reach aidea to open the editor."; }
  };
  const picker = document.createElement("select");
  picker.className = "agent-opt";
  picker.setAttribute("aria-label", "Editor to open the code in");
  picker.disabled = true;
  const template = Object.assign(document.createElement("input"), { type: "text", placeholder: "my-editor --line {line} {file}", hidden: true });
  template.setAttribute("aria-label", "Command for your editor; {file} is the file and {line} the line");
  const note = Object.assign(document.createElement("div"), { className: "note", hidden: true });
  const save = async () => {
    const body = { project: current, editor: picker.value, template: template.value };
    const r = await fetch("/editor-setting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    note.hidden = r.ok;
    note.textContent = r.ok ? "" : (await r.json()).error;
  };
  picker.onchange = () => { template.hidden = picker.value !== "custom"; if (picker.value !== "custom") save(); };
  template.onchange = save;
  // Reads the Project's choice; the controls stay off until it arrives.
  const load = (project) => {
    picker.disabled = true;
    fetch(`/editor-setting?project=${encodeURIComponent(project)}`).then((r) => r.ok ? r.json() : null).then((s) => {
      if (!s || project !== current) return;
      picker.replaceChildren(...s.editors.map((e) => Object.assign(document.createElement("option"), { value: e.id, textContent: e.label })));
      picker.value = s.editor;
      template.value = s.template;
      template.hidden = s.editor !== "custom";
      picker.disabled = false;
    }).catch(() => {});
  };
  return { controls: [picker, btn, template, note], load };
})();

const codeName = (tab) => tab.path ?? (tab.focus.path ?? tab.focus.node.split(".").pop());
const codeBase = (name) => name.slice(name.lastIndexOf("/") + 1);

// The head above the text: the file, its highlighted lines, and the editor controls when there is a file to open.
function codeHeadFor(tab) {
  codeHead.hidden = !tab || tab.gone || !tab.path;
  if (codeHead.hidden) return;
  const where = Object.assign(document.createElement("div"), { className: "where" });
  where.append(Object.assign(document.createElement("strong"), { textContent: tab.path }));
  if (tab.hit) where.append(Object.assign(document.createElement("span"), { className: "lines", textContent: tab.hit.endLine > tab.hit.line ? `lines ${tab.hit.line} to ${tab.hit.endLine}` : `line ${tab.hit.line}` }));
  codeHead.replaceChildren(where, ...codeEditor.controls);
}

// The labels of the tabs: the file's name, or its whole path when two open files share a name.
function codeLabels() {
  for (const tab of codeTabs) {
    const name = codeName(tab);
    const twin = codeTabs.some((o) => o !== tab && codeBase(codeName(o)) === codeBase(name));
    tab.button.textContent = twin ? name : codeBase(name);
    tab.button.title = name;
    tab.wrap.classList.toggle("gone", !!tab.gone);
    tab.close.setAttribute("aria-label", `Close ${name}`);
  }
}

// What the tab shows, from the core's answer: the text with line numbers, or a plain sentence.
function codeFill(tab, focus, r) {
  tab.focus = focus;
  tab.status = r.status;
  tab.gone = false;
  tab.stale = false;
  if (r.ok) {
    const { body } = r;
    tab.path = body.file;
    const rows = body.text.split(/\r?\n/);
    if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
    // A file read again without lines keeps the ones it had, while the file still reaches them.
    tab.hit = body.line ? { line: body.line, endLine: body.endLine } : focus.path !== undefined && tab.hit && tab.hit.endLine <= rows.length ? tab.hit : null;
    const language = rows.length <= 4000 ? codeLanguageOf(body.file) : undefined;
    tab.el.style.setProperty("--gutter", `${Math.max(3, String(rows.length).length)}ch`);
    const frag = document.createDocumentFragment();
    rows.forEach((text, i) => {
      const row = Object.assign(document.createElement("div"), { className: tab.hit && i + 1 >= tab.hit.line && i + 1 <= tab.hit.endLine ? "cl hit" : "cl" });
      if (language && text.length <= 1000) row.append(...codeSegments(text, language).map(([cls, part]) => (cls ? Object.assign(document.createElement("span"), { className: cls, textContent: part }) : document.createTextNode(part))));
      else row.textContent = text;
      row.dataset.n = i + 1;
      frag.append(row);
    });
    tab.el.replaceChildren(frag);
  } else {
    if (focus.path !== undefined) tab.path = focus.path;
    tab.hit = null;
    // The file is not on disk any more: say so in a sentence; the tab stays so the person can close it, or press Refresh after putting the file back.
    codeSay(tab, r.status === 404 && focus.path !== undefined ? `${focus.path} is gone: it was moved, renamed or deleted. Close this tab, or press Refresh if you put it back.` : r.body.error, r.status === 404);
  }
  codeLabels();
}

// A plain sentence in the tab (a file that cannot be shown, a Node or file that is gone).
function codeSay(tab, text, gone = false) {
  tab.gone = gone;
  const p = Object.assign(document.createElement("p"), { className: "said", textContent: text });
  p.setAttribute("role", "status");
  tab.el.replaceChildren(p);
}

function codeNewTab(key) {
  const id = ++codeTabCount;
  const el = Object.assign(document.createElement("div"), { className: "code-text", tabIndex: 0, hidden: true });
  el.id = `code-text-${id}`;
  el.setAttribute("role", "tabpanel");
  el.setAttribute("aria-labelledby", `code-tab-${id}`);
  const button = Object.assign(document.createElement("button"), { type: "button", id: `code-tab-${id}`, tabIndex: -1 });
  button.setAttribute("role", "tab");
  button.setAttribute("aria-controls", el.id);
  button.setAttribute("aria-selected", "false");
  const close = Object.assign(document.createElement("button"), { type: "button", className: "code-close", textContent: "×", tabIndex: -1 });
  const wrap = Object.assign(document.createElement("div"), { className: "code-tab" });
  wrap.setAttribute("role", "presentation");
  wrap.append(button, close);
  const tab = { id, key, focus: null, path: null, status: 0, gone: false, hit: null, scroll: { top: 0, left: 0 }, stale: false, el, button, close, wrap };
  el.onscroll = () => { if (el.offsetParent !== null) tab.scroll = { top: el.scrollTop, left: el.scrollLeft }; }; // a hidden element has no real position to remember
  button.onclick = () => codeActivate(tab);
  button.onauxclick = (e) => { if (e.button === 1) codeClose(tab); };
  close.onclick = () => codeClose(tab);
  codeTabs.push(tab);
  codeTabsEl.append(wrap);
  codeStack.append(el);
  return tab;
}

function codeActivate(tab) {
  codeActive = tab;
  codeRecent.splice(0, codeRecent.length, ...codeRecent.filter((t) => t !== tab), tab);
  for (const t of codeTabs) {
    t.el.hidden = t !== tab;
    t.wrap.classList.toggle("on", t === tab);
    t.button.setAttribute("aria-selected", String(t === tab));
    t.button.tabIndex = t === tab ? 0 : -1;
  }
  codeEmptyEl.hidden = true;
  codeTabsEl.hidden = false;
  codeHeadFor(tab);
  tab.button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  codeRestore(tab, false);
  document.dispatchEvent(new CustomEvent("code-tab-changed", { detail: { path: tab.path, node: tab.focus?.node ?? null } }));
  // A tab that may differ from the disk (Refresh was pressed while another tab was shown) is read again as it comes back.
  if (tab.stale) { tab.stale = false; codeReload(tab); }
}

// Puts the tab back where it was, or, for lines just chosen, brings them into view (the panel must be on screen for the measures to mean anything).
function codeRestore(tab, toHit) {
  const first = toHit ? tab.el.querySelector(".hit") : null;
  if (first) tab.scroll = { top: Math.max(0, first.offsetTop - tab.el.clientHeight / 3), left: 0 };
  tab.el.scrollTop = tab.scroll.top;
  tab.el.scrollLeft = tab.scroll.left;
}

function codeClose(tab) {
  const at = codeTabs.indexOf(tab), wasActive = tab === codeActive, hadFocus = tab.wrap.contains(document.activeElement);
  codeTabs.splice(at, 1);
  codeRecent.splice(codeRecent.indexOf(tab), 1);
  tab.wrap.remove();
  tab.el.remove();
  if (wasActive) {
    const back = codeRecent.at(-1);
    if (back) { codeActivate(back); if (hadFocus) back.button.focus(); }
    else codeEmpty();
  }
  codeLabels();
}

function codeEmpty() {
  codeActive = null;
  codeTabsEl.hidden = true;
  codeHeadFor(null);
  codeEmptyEl.hidden = false;
  document.dispatchEvent(new CustomEvent("code-tab-changed", { detail: { path: null } }));
}

codeTabsEl.onkeydown = (e) => {
  const tab = codeTabs.find((t) => t.button === e.target);
  if (!tab || e.ctrlKey || e.metaKey || e.altKey) return;
  const at = codeTabs.indexOf(tab);
  const to = { ArrowRight: codeTabs[(at + 1) % codeTabs.length], ArrowLeft: codeTabs[(at - 1 + codeTabs.length) % codeTabs.length], Home: codeTabs[0], End: codeTabs.at(-1) }[e.key];
  if (to) { codeActivate(to); to.button.focus(); } else if (e.key === "Delete") codeClose(tab);
  else return;
  e.preventDefault();
};

// Asks the core for a Node's file, or a file by its path. `range` ({from, to}) comes from a step of a Flow.
async function codeFetch(focus, range) {
  const target = focus.path !== undefined ? `file=${encodeURIComponent(focus.path)}` : `node=${encodeURIComponent(focus.node)}&whole=1`;
  const res = await fetch(`/source?project=${encodeURIComponent(current)}&${target}${range ? `&from=${range.from}&to=${range.to}` : ""}`);
  return { ok: res.ok, status: res.status, body: await res.json() };
}

// The tab for what was asked: the one that already holds this file, else a new one.
const codeTabFor = (focus, r) => {
  const key = r.ok ? r.body.file : focus.path ?? `node:${focus.node}`;
  return codeTabs.find((t) => t.key === key || (focus.path !== undefined && t.path === focus.path)) ?? codeNewTab(key);
};

// Shows the panel (a drawer in a narrow window) and the highlighted lines in it.
async function codeShow(tab, toHit) {
  layoutShowPane("code");
  await new Promise((done) => requestAnimationFrame(done)); // the card has its size once the layout has been applied
  if (codeActive === tab) codeRestore(tab, toHit);
}

async function codeOpenFocus(focus, range) {
  if (!current) return false;
  const project = current, request = ++codeRequest;
  // A file that is already open and still as it was read is shown as it is, with the lines and place it had.
  const open = focus.path !== undefined && !range && codeTabs.find((t) => t.path === focus.path && t.status === 200 && !t.stale);
  let tab = open, ok = true;
  if (!tab) {
    const r = await codeFetch(focus, range);
    if (project !== current || request !== codeRequest) return false; // another Project, or a newer choice, owns the panel: no tab is left behind for this one
    tab = codeTabFor(focus, r);
    codeFill(tab, focus, r);
    ok = r.ok;
  }
  if (request !== codeRequest) return false; // a newer choice owns the panel
  codeActivate(tab);
  await codeShow(tab, ok && !open && !!tab.hit);
  return ok;
}

// Opens the panel on a Node's code; `step` marks it as the lines of a Flow step.
const codeOpen = (nodeId, range, step = null) => codeOpenFocus({ node: nodeId, step }, range);

// Opens the panel on a file by its path in the Project (what the Files panel knows), optionally with lines to highlight.
const codeOpenFile = (path, range) => codeOpenFocus({ path }, range);

// Reads one tab again from disk. A step's lines are the graph's: they are kept only while that Flow is still the one open.
async function codeReload(tab, nodes) {
  const { node, step, path } = tab.focus, project = current;
  if (path === undefined && nodes && !nodes.some((n) => n.id === node)) {
    codeSay(tab, `${node.split(".").pop()} is not in the code any more: it was moved, renamed or deleted. Select another on Components.`, true);
    codeLabels();
    if (tab === codeActive) codeHeadFor(tab);
    return;
  }
  const s = step && algoGraph && algoOpenId === step.algo ? algoGraph.steps.find((x) => x.id === step.id) : null;
  const focus = path !== undefined ? { path } : { node, step: s ? step : null };
  const r = await codeFetch(focus, s ? { from: s.line, to: s.endLine ?? s.line } : undefined);
  if (project !== current || !codeTabs.includes(tab)) return;
  const { scrollTop, scrollLeft } = tab.el;
  codeFill(tab, focus, r);
  if (tab === codeActive) { codeHeadFor(tab); tab.el.scrollTop = scrollTop; tab.el.scrollLeft = scrollLeft; }
}

// A refresh reads the shown tab again; the others are read when they are shown next.
async function codeRefresh(nodes) {
  for (const tab of codeTabs) if (tab !== codeActive) tab.stale = true;
  if (codeActive) await codeReload(codeActive, nodes);
}

// Selecting a Node opens its code at once when the Code panel is on screen (nothing opens the panel by itself); otherwise the Details offer "View code".
// `fromCode` is a selection made from the code side (57-reading.js): the code is already shown.
function onSelect(nodeId, fromCode = false) {
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
  if (!fromCode && layoutShown.code) codeOpen(nodeId);
}

// A different Project starts with no tab open.
const drawWithoutCode = draw;
draw = async (nodes) => {
  if (codeProject !== current) {
    codeProject = current;
    codeSelected = null;
    codeRequest++;
    for (const tab of codeTabs.splice(0)) { tab.wrap.remove(); tab.el.remove(); }
    codeRecent.length = 0;
    codeEmpty();
    if (current) codeEditor.load(current);
  }
  await drawWithoutCode(nodes);
};

// A card that was hidden loses its scroll: when the panel comes back on screen (from the Panels menu, say) the tab shown is put back where it was.
let codeWasOnScreen = false;
document.addEventListener("layout-applied", () => {
  const now = layoutShown.code || layoutDrawer === "code";
  if (now && !codeWasOnScreen && codeActive) codeRestore(codeActive, false);
  codeWasOnScreen = now;
});
