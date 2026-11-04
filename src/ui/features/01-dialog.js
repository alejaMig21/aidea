// The dialog of aidea: a question that needs an answer, drawn in the look of the rest of the window (docs/agents/ui-style.md) and never with the browser's own window.confirm
// or window.prompt. dialogShow is the one piece; dialogConfirm (a yes or a no) and dialogPrompt (a name) are made of it, and plugins reach dialogConfirm as ui.confirm.
// Names are prefixed "dialog" because every feature file shares one global scope.
let dialogShow, dialogConfirm, dialogPrompt; // assigned below: the block keeps the helper names out of the shared global scope
{
  const style = document.createElement("style");
  style.textContent = `
    .dialog-layer { position: fixed; inset: 0; z-index: 200; /* above the plugin manager (120) and the dock sashes (99) */ display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, .5); }
    .dialog-layer .dialog { box-sizing: border-box; width: min(520px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 18px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); font-family: var(--sans); }
    .dialog-layer h2 { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--text); text-transform: none; letter-spacing: 0; }
    .dialog-layer .dialog-message { margin: 0 0 10px; font-size: 13.5px; line-height: 1.5; color: var(--text); }
    .dialog-layer .dialog-lines { margin: 0 0 14px; padding: 8px 10px; background: var(--raised); border: 1px solid var(--line); border-radius: 8px; font: 12.5px/1.6 var(--mono); max-height: 240px; overflow: auto; }
    .dialog-layer .dialog-lines div { white-space: pre-wrap; overflow-wrap: anywhere; }
    .dialog-layer label { display: block; margin: 0 0 4px; font-size: 12px; color: var(--muted); }
    .dialog-layer input[type="text"] { box-sizing: border-box; width: 100%; padding: 6px 10px; margin: 0 0 6px; background: var(--bg); color: var(--text); border: 1px solid var(--control); border-radius: 6px; font-size: 13px; }
    .dialog-layer .dialog-error { min-height: 1.2em; margin: 0 0 8px; font-size: 12px; color: var(--danger); }
    .dialog-layer .dialog-list { margin: 0 0 14px; }
    .dialog-layer .dialog-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); }
    .dialog-layer .dialog-item:first-child { border-top: 0; }
    .dialog-layer .dialog-item span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
    .dialog-layer .dialog-empty { margin: 0 0 14px; font-size: 12px; color: var(--muted); }
    .dialog-layer .dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; }
    .dialog-layer button { padding: 4px 12px; font-size: 13px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    .dialog-layer button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  `;
  document.head.append(style);

  let count = 0;
  const stack = []; // the dialogs open now, the last one on top: only that one answers the keyboard
  const make = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

  // dialogShow({ title, message?, body?, buttons: [{ label, value, primary?, onclick? }], cancelValue, focus?, onOpen? }) resolves with the value of the button pressed (a function is called for it),
  // or cancelValue on Escape. `body` is any element (a list, a field); `focus` is the element that starts with the focus (the first button when it is not given: a consent is never given by
  // a stray Enter). A button's `onclick` runs first and may return false to keep the dialog open (a field that did not pass its check). `onOpen(box, buttonElements)` runs once it is on screen.
  dialogShow = function ({ title, message, body, buttons, cancelValue, focus, onOpen }) {
    const opener = document.activeElement;
    const id = `dialog-title-${++count}`;
    const buttonEls = buttons.map((b) => make("button", { type: "button", textContent: b.label, className: b.primary ? "primary" : "" }));
    const box = make("div", { className: "dialog", role: "dialog" });
    box.dataset.dialog = "";
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", id);
    box.append(make("h2", { id, textContent: title }));
    if (message) box.append(make("p", { className: "dialog-message", textContent: message }));
    if (body) box.append(body);
    box.append(make("div", { className: "dialog-buttons" }, ...buttonEls));
    const layer = make("div", { className: "dialog-layer" }, box);
    return new Promise((resolve) => {
      const close = (answer) => {
        document.removeEventListener("keydown", onKey, true);
        stack.splice(stack.indexOf(layer), 1);
        layer.remove();
        try { (stack.length ? stack.at(-1).querySelector("button") : opener)?.focus?.(); } catch { /* the control that asked is gone */ }
        resolve(answer);
      };
      const focusables = () => [...box.querySelectorAll("button, input")].filter((x) => !x.disabled);
      // Escape means no. Tab stays inside the dialog, wrapping at both ends.
      const onKey = (e) => {
        if (stack.at(-1) !== layer) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(cancelValue); }
        else if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          const all = focusables(), at = all.indexOf(document.activeElement);
          all[(at + (e.shiftKey ? -1 : 1) + all.length) % all.length]?.focus();
        }
      };
      buttons.forEach((b, i) => { buttonEls[i].onclick = async () => { if (b.onclick && (await b.onclick(buttonEls[i])) === false) return; close(typeof b.value === "function" ? b.value() : b.value); }; });
      stack.push(layer);
      document.addEventListener("keydown", onKey, true);
      document.body.append(layer);
      (focus ?? buttonEls[0]).focus();
      onOpen?.(box, buttonEls);
    });
  };

  // A yes or a no: dialogConfirm({ title, message, lines, accept, cancel }) resolves true on accept, false on cancel or Escape. The safe button (Cancel) has the focus first.
  dialogConfirm = function ({ title, message, lines = [], accept = "OK", cancel = "Cancel" }) {
    let body = null;
    if (lines.length) {
      body = make("div", { className: "dialog-lines" });
      for (const line of lines) { const row = make("div", { textContent: line }); row.dataset.line = ""; body.append(row); }
    }
    return dialogShow({ title, message, body, buttons: [{ label: cancel, value: false }, { label: accept, value: true, primary: true }], cancelValue: false });
  };

  // A name: dialogPrompt({ title, label, value, accept, cancel, validate }) resolves with the text, or null on cancel or Escape. `validate(text)` returns what is wrong with it ("" when it is fine):
  // the dialog says so and stays open. Enter in the field accepts.
  dialogPrompt = function ({ title, label, value = "", accept = "OK", cancel = "Cancel", validate }) {
    const field = make("input", { type: "text", value, autocomplete: "off", id: `dialog-field-${count + 1}` });
    const error = make("p", { className: "dialog-error", role: "alert" });
    error.dataset.error = "";
    const body = make("div", {}, make("label", { htmlFor: field.id, textContent: label }), field, error);
    const check = () => { const problem = validate?.(field.value) ?? ""; error.textContent = problem; return problem ? false : undefined; };
    return dialogShow({
      title, body, cancelValue: null, focus: field,
      buttons: [{ label: cancel, value: null }, { label: accept, primary: true, onclick: check, value: () => field.value }],
      onOpen: (_box, buttonEls) => { field.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); buttonEls[1].click(); } }; },
    });
  };
}
