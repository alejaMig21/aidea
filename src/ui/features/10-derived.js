// Code layer: selecting a Node shows its real source text, with a button to open it in the person's editor.
// All text comes from the core; nothing here derives anything from the code.
const codeBox = document.createElement("section");
codeBox.setAttribute("aria-label", "Code layer");
codeBox.hidden = true;
codeBox.style.cssText = "position:absolute;right:15px;bottom:68px;z-index:1;max-width:min(560px,90%);max-height:50%;overflow:auto;background:var(--raised);border:1px solid var(--control);border-radius:12px;padding:10px 12px";
document.querySelector("main").append(codeBox);

// Shows source text in the box. With a Node id it also offers to open that Node in the person's editor.
function showCodeBox(titleText, text, nodeId) {
  const head = document.createElement("div");
  head.style.cssText = "display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:6px";
  const title = document.createElement("strong");
  title.textContent = titleText;
  head.append(title);
  if (nodeId) {
    const btn = document.createElement("button");
    btn.textContent = "Open in my editor";
    btn.onclick = async () => {
      const r = await fetch("/open-in-editor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, node: nodeId }) });
      $("error").textContent = r.ok ? "" : (await r.json()).error;
    };
    const picker = document.createElement("select");
    picker.className = "agent-opt";
    picker.setAttribute("aria-label", "Editor to open the code in");
    picker.disabled = true;
    const template = Object.assign(document.createElement("input"), { type: "text", placeholder: 'my-editor --line {line} {file}', hidden: true });
    template.setAttribute("aria-label", "Command for your editor; {file} is the file and {line} the line");
    template.style.cssText = "flex:1 1 100%;min-width:0;font-size:13px";
    const note = Object.assign(document.createElement("div"), { hidden: true });
    note.style.cssText = "flex-basis:100%;font-size:12px;color:var(--muted)";
    const saveEditor = async () => {
      const body = { project: current, editor: picker.value, template: template.value };
      const r = await fetch("/editor-setting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      note.hidden = r.ok;
      note.textContent = r.ok ? "" : (await r.json()).error;
    };
    picker.onchange = () => { template.hidden = picker.value !== "custom"; if (picker.value !== "custom") saveEditor(); };
    template.onchange = saveEditor;
    head.append(picker, btn);
    head.style.flexWrap = "wrap";
    fetch(`/editor-setting?project=${encodeURIComponent(current)}`).then((r) => r.ok ? r.json() : null).then((s) => {
      if (!s) return;
      picker.replaceChildren(...s.editors.map((e) => Object.assign(document.createElement("option"), { value: e.id, textContent: e.label })));
      picker.value = s.editor;
      template.value = s.template;
      template.hidden = s.editor !== "custom";
      picker.disabled = false;
    }).catch(() => {});
    head.append(template, note);
  }
  const pre = document.createElement("pre");
  pre.style.cssText = "margin:0;font:12px/1.4 var(--mono);white-space:pre";
  pre.textContent = text;
  codeBox.replaceChildren(head, pre);
  codeBox.hidden = false;
}

let codeSelected = null; // the Node whose source is shown, so a refresh can read it again
async function onSelect(nodeId) {
  if (!current) return;
  codeSelected = nodeId;
  const res = await fetch(`/source?project=${encodeURIComponent(current)}&node=${encodeURIComponent(nodeId)}`);
  const body = await res.json();
  if (!res.ok) { $("error").textContent = body.error; return; }
  showCodeBox(`${body.file}:${body.line}-${body.endLine}`, body.text, nodeId);
}
