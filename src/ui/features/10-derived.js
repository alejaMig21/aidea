// Code layer: selecting a Node shows its real source text, with a button to open it in the person's editor.
// All text comes from the core; nothing here derives anything from the code.
const codeBox = document.createElement("section");
codeBox.setAttribute("aria-label", "Code layer");
codeBox.hidden = true;
codeBox.style.cssText = "position:absolute;right:16px;bottom:40px;max-width:min(560px,90%);max-height:50%;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px";
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
    head.append(btn);
  }
  const pre = document.createElement("pre");
  pre.style.cssText = "margin:0;font:12px/1.4 ui-monospace,monospace;white-space:pre";
  pre.textContent = text;
  codeBox.replaceChildren(head, pre);
  codeBox.hidden = false;
}

async function onSelect(nodeId) {
  if (!current) return;
  const res = await fetch(`/source?project=${encodeURIComponent(current)}&node=${encodeURIComponent(nodeId)}`);
  const body = await res.json();
  if (!res.ok) { $("error").textContent = body.error; return; }
  showCodeBox(`${body.file}:${body.line}-${body.endLine}`, body.text, nodeId);
}
