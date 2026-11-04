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
    #tutor-settings { display: flex; align-items: center; gap: 6px 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
    #tutor-settings label { display: flex; align-items: center; gap: 6px; }
    #tutor-settings input { accent-color: var(--accent); }
    #pane-tutor.tutor-live #tutor-settings { display: none; }
  `;
  document.head.append(modeStyle);

  // The Tutor's own settings, in the Tutor panel: its model and the review question at the start of a class
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
    reviewBox.disabled = true;
    try {
      const res = await fetch("/agent-options?project=" + encodeURIComponent(project));
      if (!res.ok || project !== current) return;
      const { modes, models, choice, reviewQuestion } = await res.json();
      fill(chatMode, modes, choice.mode);
      fill(chatModel, models, choice.model);
      fill(tutorModel, models, choice.tutorModel);
      chatMode.title = modes.find((m) => m.id === choice.mode)?.meaning ?? "";
      for (const s of [chatModel, chatMode, tutorModel]) s.disabled = false;
      reviewBox.checked = reviewQuestion !== false;
      reviewBox.disabled = false;
    } catch { /* the selectors stay disabled until a Project opens, and no choice is shown as if it were stored */ }
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
