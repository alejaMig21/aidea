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
  const tutorModel = make("Tutor model", "tutor-model");

  // The chat input card: the selectors sit bottom-left, Send bottom-right.
  const row = Object.assign(document.createElement("div"), { className: "chat-controls" });
  const form = $("chat-input").form;
  row.append(chatModel, chatMode, form.querySelector("button"));
  form.append(row);

  const modeStyle = document.createElement("style");
  modeStyle.textContent = `
    #chat-foot .mode-row { display: flex; align-items: center; gap: 8px; margin: 2px 0 4px; font-size: 12px; color: var(--muted); }
    #chat-foot .mode-row .seg { display: flex; border: 1px solid var(--control); border-radius: 8px; overflow: hidden; }
    #chat-foot .mode-row .seg button { align-self: auto; margin: 0; border: 0; border-radius: 0; background: transparent; color: var(--muted); font-size: 12px; font-weight: 400; padding: 3px 12px; }
    #chat-foot .mode-row .seg button[aria-pressed="true"] { background: var(--selected); color: var(--text); }
    #tutor-settings { display: flex; align-items: center; gap: 6px 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
    #tutor-settings label { display: flex; align-items: center; gap: 6px; }
    #tutor-settings input { accent-color: var(--accent); }
    #pane-tutor.tutor-live #tutor-settings { display: none; }
  `;
  document.head.append(modeStyle);

  // Direct / Class mode, at the foot of the Builder column: whether the builder waits at a Blocking decision until the person has answered a short class.
  const modeRow = Object.assign(document.createElement("div"), { className: "mode-row" });
  const seg = Object.assign(document.createElement("div"), { className: "seg" });
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "How the builder works");
  const modeButtons = {};
  for (const [id, label, says] of [
    ["direct", "Direct", "The builder works freely; you review its proposals and accept or reject them."],
    ["class", "Class", "At a big decision (a layer, a technology, a pattern) the builder waits until the Tutor has asked you about it."],
  ]) {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: label, title: says, disabled: true });
    b.dataset.mode = id;
    b.setAttribute("aria-pressed", "false");
    modeButtons[id] = b;
    seg.append(b);
  }
  modeRow.append(Object.assign(document.createElement("span"), { textContent: "Builder works" }), seg);
  row.before(modeRow);
  const pressMode = (id) => { for (const b of Object.values(modeButtons)) b.setAttribute("aria-pressed", String(b.dataset.mode === id)); };

  // The Tutor's own settings, in the Tutor column: its model and the review question at the start of a class
  // (on unless the person turns it off; the choice is remembered for the Project).
  const reviewBox = Object.assign(document.createElement("input"), { type: "checkbox", id: "review-question", checked: true, disabled: true });
  const settings = Object.assign(document.createElement("div"), { id: "tutor-settings" });
  const modelLabel = document.createElement("label");
  modelLabel.append("Tutor model", tutorModel);
  const reviewLabel = document.createElement("label");
  reviewLabel.append(reviewBox, "Start with a review question");
  settings.append(modelLabel, reviewLabel);
  $("tutor-head").after(settings);

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
    for (const b of Object.values(modeButtons)) b.disabled = true;
    reviewBox.disabled = true;
    try {
      const res = await fetch("/agent-options?project=" + encodeURIComponent(project));
      if (!res.ok || project !== current) return;
      const { modes, models, choice, classMode, reviewQuestion } = await res.json();
      fill(chatMode, modes, choice.mode);
      fill(chatModel, models, choice.model);
      fill(tutorModel, models, choice.tutorModel);
      chatMode.title = modes.find((m) => m.id === choice.mode)?.meaning ?? "";
      for (const s of [chatModel, chatMode, tutorModel]) s.disabled = false;
      pressMode(classMode === "class" ? "class" : "direct");
      for (const b of Object.values(modeButtons)) b.disabled = false;
      reviewBox.checked = reviewQuestion !== false;
      reviewBox.disabled = false;
    } catch { pressMode(""); /* the selectors stay disabled until a Project opens, and no choice is shown as if it were stored */ }
  }

  const save = (field, select) => async () => {
    if (!current) return;
    try {
      const res = await fetch("/agent-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: current, [field]: select.value }),
      });
      if (!res.ok) load(current); // refused: show what is really stored
      else if (field === "mode") chatMode.title = chatMode.selectedOptions[0]?.title ?? "";
    } catch { load(current); } // the core could not be reached: show what was stored
  };
  for (const b of Object.values(modeButtons)) b.onclick = () => { pressMode(b.dataset.mode); save("classMode", { value: b.dataset.mode })(); };
  reviewBox.onchange = async () => {
    if (!current) return;
    try {
      const res = await fetch("/agent-options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: current, reviewQuestion: reviewBox.checked }) });
      if (!res.ok) load(current); // refused: show what is really stored
    } catch { load(current); }
  };
  chatMode.onchange = save("mode", chatMode);
  chatModel.onchange = save("model", chatModel);
  tutorModel.onchange = save("tutorModel", tutorModel);

  for (const s of [chatModel, chatMode, tutorModel]) s.disabled = true; // until a Project is open
  document.addEventListener("project-opened", (e) => load(e.detail.id));
}
