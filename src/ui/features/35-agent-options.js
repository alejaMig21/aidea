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
    try {
      const res = await fetch("/agent-options?project=" + encodeURIComponent(project));
      if (!res.ok || project !== current) return;
      const { modes, models, choice } = await res.json();
      fill(chatMode, modes, choice.mode);
      fill(chatModel, models, choice.model);
      fill(tutorModel, models, choice.tutorModel);
      chatMode.title = modes.find((m) => m.id === choice.mode)?.meaning ?? "";
      for (const s of [chatModel, chatMode, tutorModel]) s.disabled = false;
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
  chatMode.onchange = save("mode", chatMode);
  chatModel.onchange = save("model", chatModel);
  tutorModel.onchange = save("tutorModel", tutorModel);

  for (const s of [chatModel, chatMode, tutorModel]) s.disabled = true; // until a Project is open
  document.addEventListener("project-opened", (e) => load(e.detail.id));
}
