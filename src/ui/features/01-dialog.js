// The dialog of aidea: a question that needs a yes or a no, drawn in the look of the rest of the window (docs/agents/ui-style.md) and never with the browser's own window.confirm.
// dialogConfirm({ title, message, lines, accept, cancel }) resolves true on accept, false on cancel or Escape. Plugins reach it as ui.confirm. Names are prefixed "dialog"
// because every feature file shares one global scope.
let dialogConfirm; // assigned below: the block keeps the helper names out of the shared global scope
{
  const style = document.createElement("style");
  style.textContent = `
    #dialog-layer { position: fixed; inset: 0; z-index: 200; /* above the plugin manager (120) and the dock sashes (99) */ display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, .5); }
    #dialog-layer .dialog { box-sizing: border-box; width: min(520px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 18px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); font-family: var(--sans); }
    #dialog-layer h2 { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--text); text-transform: none; letter-spacing: 0; }
    #dialog-layer .dialog-message { margin: 0 0 10px; font-size: 13.5px; line-height: 1.5; color: var(--text); }
    #dialog-layer .dialog-lines { margin: 0 0 14px; padding: 8px 10px; background: var(--raised); border: 1px solid var(--line); border-radius: 8px; font: 12.5px/1.6 var(--mono); max-height: 240px; overflow: auto; }
    #dialog-layer .dialog-lines div { white-space: pre-wrap; overflow-wrap: anywhere; }
    #dialog-layer .dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; }
    #dialog-layer button { padding: 4px 12px; font-size: 13px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #dialog-layer button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  `;
  document.head.append(style);

  let dialogCount = 0;
  dialogConfirm = function ({ title, message, lines = [], accept = "OK", cancel = "Cancel" }) {
    const opener = document.activeElement;
    const id = `dialog-title-${++dialogCount}`;
    const make = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
    const no = make("button", { type: "button", textContent: cancel });
    const yes = make("button", { type: "button", textContent: accept, className: "primary" });
    const box = make("div", { className: "dialog", role: "dialog" });
    box.dataset.dialog = "";
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", id);
    box.append(make("h2", { id, textContent: title }));
    if (message) box.append(make("p", { className: "dialog-message", textContent: message }));
    if (lines.length) {
      const list = make("div", { className: "dialog-lines" });
      for (const line of lines) { const row = make("div", { textContent: line }); row.dataset.line = ""; list.append(row); }
      box.append(list);
    }
    box.append(make("div", { className: "dialog-buttons" }, no, yes));
    const layer = make("div", { id: "dialog-layer" }, box);
    return new Promise((resolve) => {
      const close = (answer) => {
        document.removeEventListener("keydown", onKey, true);
        layer.remove();
        try { opener?.focus?.(); } catch { /* the control that asked is gone */ }
        resolve(answer);
      };
      // Escape means no. Tab stays between the two buttons. The safe button has the focus first: a consent is never given by a stray Enter.
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(false); }
        else if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          (document.activeElement === no ? yes : no).focus();
        }
      };
      document.addEventListener("keydown", onKey, true);
      no.onclick = () => close(false);
      yes.onclick = () => close(true);
      document.body.append(layer);
      no.focus();
    });
  };
}
