// Model and Permission mode selectors. Everything shown comes from GET /agent-options (what the active agent adapter
// offers) and every change goes back through POST /agent-options, which remembers it for the Project.
// Names are prefixed "agentOpt" because every feature file shares one global scope.
{
  const make = (label, id) => {
    const s = document.createElement("select");
    s.className = "agent-opt";
    s.id = id;
    s.setAttribute("aria-label", label);
    return s;
  };
  const chatModel = make("Model for the builder", "chat-model");
  const chatMode = make("Permission mode", "chat-mode");
  const tutorModel = make("Model for the Tutor", "tutor-model");

  // The chat input card: the selectors sit bottom-left, Send bottom-right.
  const row = Object.assign(document.createElement("div"), { className: "chat-controls" });
  const form = $("chat-input").form;
  row.append(chatModel, chatMode, form.querySelector("button"));
  form.append(row);
  $("pane-tutor").querySelector("button").before(tutorModel); // beside the disabled "Start a class"

  // Class / Direct mode: whether the builder waits at a Blocking decision until the person has answered a short class.
  const modeStyle = document.createElement("style");
  modeStyle.textContent = `
    #pane-tutor #class-mode { border: 0; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; align-self: stretch; align-items: center; min-width: 0; }
    #pane-tutor #class-mode legend { padding: 0; font-size: 12px; color: var(--muted); }
    #pane-tutor #class-mode label { display: flex; flex-direction: column; align-items: flex-start; max-width: 262px; text-align: left; font-size: 13px; color: var(--text); }
    #pane-tutor #class-mode label span { color: var(--muted); font-size: 12px; line-height: 1.4; }
    #pane-tutor #class-mode input { margin-right: 6px; accent-color: var(--accent); }
    #pane-tutor.tutor-live #class-mode { display: none; }
  `;
  document.head.append(modeStyle);
  const modeBox = document.createElement("fieldset");
  modeBox.id = "class-mode";
  modeBox.append(Object.assign(document.createElement("legend"), { textContent: "How the builder works" }));
  const modeRadios = {};
  for (const [id, label, says] of [
    ["direct", "Direct", "The builder works freely; you review its proposals and accept or reject them."],
    ["class", "Class", "At a big decision (a layer, a technology, a pattern) the builder waits until the Tutor has asked you about it."],
  ]) {
    const radio = Object.assign(document.createElement("input"), { type: "radio", name: "class-mode", value: id, disabled: true });
    modeRadios[id] = radio;
    const l = document.createElement("label");
    const head = document.createElement("div");
    head.append(radio, label);
    l.append(head, Object.assign(document.createElement("span"), { textContent: says }));
    modeBox.append(l);
  }
  tutorModel.after(modeBox);

  const fill = (select, list, chosen) => {
    select.replaceChildren(...list.map((o) => {
      const opt = Object.assign(document.createElement("option"), { value: o.id, textContent: o.label });
      if (o.available === false) { opt.disabled = true; opt.title = o.reason ?? "Not available"; opt.textContent += " (unavailable)"; }
      else if (o.meaning) opt.title = o.meaning;
      return opt;
    }));
    select.value = chosen;
  };

  async function load(project) {
    for (const s of [chatModel, chatMode, tutorModel]) s.disabled = true;
    for (const r of Object.values(modeRadios)) r.disabled = true;
    try {
      const res = await fetch("/agent-options?project=" + encodeURIComponent(project));
      if (!res.ok || project !== current) return;
      const { modes, models, choice, classMode } = await res.json();
      fill(chatMode, modes, choice.mode);
      fill(chatModel, models, choice.model);
      fill(tutorModel, models, choice.tutorModel);
      chatMode.title = modes.find((m) => m.id === choice.mode)?.meaning ?? "";
      for (const s of [chatModel, chatMode, tutorModel]) s.disabled = false;
      modeRadios[classMode === "class" ? "class" : "direct"].checked = true;
      for (const r of Object.values(modeRadios)) r.disabled = false;
    } catch { /* the selectors stay disabled until a Project opens */ }
  }

  const save = (field, select) => async () => {
    if (!current) return;
    const res = await fetch("/agent-options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: current, [field]: select.value }),
    });
    if (!res.ok) load(current); // refused: show what is really stored
    else if (field === "mode") chatMode.title = chatMode.selectedOptions[0]?.title ?? "";
  };
  for (const r of Object.values(modeRadios)) r.onchange = save("classMode", r);
  chatMode.onchange = save("mode", chatMode);
  chatModel.onchange = save("model", chatModel);
  tutorModel.onchange = save("tutorModel", tutorModel);

  for (const s of [chatModel, chatMode, tutorModel]) s.disabled = true; // until a Project is open
  document.addEventListener("project-opened", (e) => load(e.detail.id));
}
