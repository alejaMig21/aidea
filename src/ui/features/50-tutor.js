// The Tutor column's class: "Start a class" opens a stream from POST /tutor/classes; the Tutor's messages and its questions
// are drawn here, and each answer goes back through POST /tutor/answer. No domain logic lives here: the core grades and decides.
// Names are prefixed "tutor" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-tutor:is(.tutor-live, .tutor-over) { align-items: stretch; justify-content: flex-start; text-align: left; }
    #pane-tutor:is(.tutor-live, .tutor-over) .tutor-empty, #pane-tutor.tutor-live #tutor-start { display: none; }
    #pane-tutor.tutor-over #tutor-start { align-self: flex-start; }
    #pane-tutor #tutor-end[hidden] { display: none; }
    #pane-tutor.tutor-live #tutor-end { align-self: flex-start; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #tutor-log { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    #tutor-log[hidden] { display: none; }
    #tutor-log .tutor-say { margin: 0; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
    #tutor-log .tutor-error { margin: 0; color: var(--danger); overflow-wrap: anywhere; }
    #tutor-log .tutor-meta { margin: 0; color: var(--muted); font-size: 12px; }
    #tutor-log .tutor-card { margin: 0; padding: 10px 12px; background: var(--raised); border: 1px solid var(--control); border-radius: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    #tutor-log .tutor-card fieldset { margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    #tutor-log .tutor-card legend, #tutor-log .tutor-card .tutor-prompt { padding: 0; font-weight: 600; overflow-wrap: anywhere; white-space: pre-wrap; }
    #tutor-log .tutor-card label { display: flex; gap: 8px; align-items: baseline; overflow-wrap: anywhere; }
    #tutor-log .tutor-card input[type=radio] { accent-color: var(--accent); flex: none; }
    #tutor-log .tutor-card .tutor-stops { flex-direction: row; flex-wrap: wrap; gap: 4px 12px; }
    #tutor-log .tutor-card .tutor-stops legend { flex: 1 0 100%; font-weight: 400; color: var(--muted); }
    #tutor-log .tutor-card .tutor-stops label { gap: 4px; align-items: center; }
    #tutor-log .tutor-card textarea { width: 100%; box-sizing: border-box; min-height: 52px; resize: vertical; font: inherit; }
    #tutor-log .tutor-card .tutor-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    #tutor-log .tutor-card button[type=submit] { background: var(--accent); color: var(--on-accent); border: 0; }
    #tutor-log .tutor-card button:disabled { opacity: .5; }
    #tutor-log .tutor-card .tutor-dontknow { background: transparent; color: var(--text); border: 1px solid var(--control); }
    #tutor-log .tutor-card .tutor-status { color: var(--danger); margin: 0; }
    #tutor-log .tutor-card.tutor-done { gap: 2px; }
    #tutor-log .tutor-card.tutor-done .tutor-answered { color: var(--muted); margin: 0; overflow-wrap: anywhere; }
  `;
  document.head.append(style);

  const STOPS = [0, 30, 50, 70, 90, 100];
  const pane = $("pane-tutor");
  const start = $("tutor-start");
  const emptyTitle = pane.querySelector("h2.tutor-empty");
  const emptyText = pane.querySelector("p.tutor-empty");
  const end = Object.assign(document.createElement("button"), { type: "button", id: "tutor-end", textContent: "End class", hidden: true });
  const log = Object.assign(document.createElement("div"), { id: "tutor-log", hidden: true });
  log.setAttribute("role", "log");
  log.setAttribute("aria-label", "Class with the Tutor");
  start.after(end);
  end.after(log);

  let running = null; // { abort, project } while a class is open
  let counter = 0;
  const cards = new Map(); // question id -> its card, so a withdrawn question can be closed

  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const line = (cls, text) => { log.append(el("p", { className: cls, textContent: text })); log.scrollTop = log.scrollHeight; pane.scrollTop = pane.scrollHeight; };

  function setAvailable(open) {
    if (running) return;
    start.disabled = !open;
    emptyTitle.textContent = open ? "Start a class" : "The Tutor is not available yet";
    emptyText.textContent = open
      ? "The Tutor asks you questions about your project, one at a time, and waits for your answers."
      : "Open a Project to start a class. The Tutor explains why each decision was made and asks you questions about your project.";
  }

  function collapse(card, summary) {
    card.className = "tutor-card tutor-done";
    card.replaceChildren(el("p", { className: "tutor-prompt", textContent: card.dataset.prompt }), el("p", { className: "tutor-answered", textContent: summary }));
  }

  function questionCard(q) {
    const n = ++counter;
    const form = el("form", { className: "tutor-card" });
    form.dataset.prompt = q.prompt;
    form.setAttribute("aria-label", "Question from the Tutor");
    const status = el("p", { className: "tutor-status" });
    status.setAttribute("role", "alert");
    const thought = el("textarea", { id: `tutor-thought-${n}`, rows: 2 });
    const thoughtLabel = el("label", { htmlFor: thought.id, textContent: "What I thought (optional)" });
    thoughtLabel.style.cssText = "display:block;margin-bottom:2px";
    const send = el("button", { type: "submit", textContent: "Send" });
    const buttons = el("div", { className: "tutor-buttons" }, send);
    let dontKnow;
    let first; // the control that gets the focus when the question appears
    let summary = () => "";
    let body;

    if (q.kind === "choice") {
      const options = el("fieldset");
      options.append(el("legend", { textContent: q.prompt }));
      q.options.forEach((text, i) => {
        const radio = el("input", { type: "radio", name: `tutor-option-${n}`, value: String(i), required: true });
        first ??= radio;
        options.append(el("label", {}, radio, text));
      });
      const stops = el("fieldset", { className: "tutor-stops" });
      stops.append(el("legend", { textContent: "How sure are you? (0 is a guess, 100 is certain)" }));
      for (const s of STOPS) {
        const radio = el("input", { type: "radio", name: `tutor-confidence-${n}`, value: String(s), checked: s === 50 });
        stops.append(el("label", {}, radio, String(s)));
      }
      body = [options, stops];
      summary = () => `You answered: ${q.options[Number(form.elements[`tutor-option-${n}`].value)]} (confidence ${form.elements[`tutor-confidence-${n}`].value})`;
    } else {
      const text = el("textarea", { id: `tutor-text-${n}`, rows: 3, required: true });
      first = text;
      body = [el("p", { className: "tutor-prompt", textContent: q.prompt }), el("label", { htmlFor: text.id, textContent: "Your answer" }), text];
      summary = () => `You answered: ${text.value.trim()}`;
    }
    if (q.allowDontKnow) {
      dontKnow = el("button", { type: "button", className: "tutor-dontknow", textContent: "Don't know" });
      buttons.append(dontKnow);
    }
    form.append(...body, thoughtLabel, thought, buttons, status);

    const submit = async (reply, summaryText) => {
      form.querySelectorAll("button, input, textarea").forEach((c) => { c.disabled = true; });
      status.textContent = "";
      try {
        const res = await fetch("/tutor/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: q.id, secret: q.secret, thought: thought.value.trim() || undefined, ...reply }),
        });
        if (res.ok) { cards.delete(q.id); collapse(form, summaryText); return; }
        status.textContent = (await res.json().catch(() => ({}))).error ?? "Could not send the answer";
      } catch (err) {
        status.textContent = `Could not reach the core: ${err.message}`;
      }
      form.querySelectorAll("button, input, textarea").forEach((c) => { c.disabled = false; }); // the person can try again
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (q.kind === "choice") {
        submit({ option: Number(form.elements[`tutor-option-${n}`].value), confidence: Number(form.elements[`tutor-confidence-${n}`].value) }, summary());
      } else submit({ text: form.querySelector("textarea").value }, summary());
    };
    if (dontKnow) dontKnow.onclick = () => {
      // The required fields must not stop someone who does not know.
      submit({ dontKnow: true }, "You said: I don't know");
    };

    log.append(form);
    cards.set(q.id, { form, first });
    form.scrollIntoView?.({ block: "nearest" });
    first.focus();
  }

  function expire(id) {
    const card = cards.get(id);
    if (!card) return;
    cards.delete(id);
    card.form.querySelectorAll("button, input, textarea").forEach((c) => { c.disabled = true; });
    card.form.querySelector(".tutor-status").textContent = "Expired: the Tutor stopped waiting for an answer";
  }

  function render(event) {
    if (event.type === "text") line("tutor-say", event.text);
    else if (event.type === "tutor_question") questionCard(event);
    else if (event.type === "tutor_question_expired") expire(event.id);
    else if (event.type === "error") { const p = el("p", { className: "tutor-error", textContent: event.message }); p.setAttribute("role", "alert"); log.append(p); }
  }

  // Back from a class: the conversation stays on screen, with the way to begin another one below it.
  function finish() {
    for (const id of [...cards.keys()]) expire(id);
    running = null;
    line("tutor-meta", "The class has ended.");
    pane.classList.replace("tutor-live", "tutor-over");
    end.hidden = true;
    start.disabled = !current;
    start.textContent = "Start another class";
  }

  async function startClass() {
    if (!current || running) return;
    const project = current;
    running = { abort: new AbortController(), project };
    log.replaceChildren();
    log.hidden = false;
    pane.classList.remove("tutor-over");
    pane.classList.add("tutor-live");
    end.hidden = false;
    start.disabled = true;
    end.focus();
    try {
      const res = await fetch("/tutor/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project }), signal: running.abort.signal });
      if (!res.ok) {
        const p = el("p", { className: "tutor-error", textContent: (await res.json().catch(() => ({}))).error ?? "The class could not start" });
        p.setAttribute("role", "alert");
        log.append(p);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const l of lines) if (l) render(JSON.parse(l));
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") { const p = el("p", { className: "tutor-error", textContent: `Could not reach the core: ${err.message}` }); p.setAttribute("role", "alert"); log.append(p); }
    } finally {
      finish();
    }
  }

  start.onclick = startClass;
  end.onclick = () => running?.abort.abort(); // closing the stream ends the class in the core
  document.addEventListener("project-opened", (e) => {
    if (running && running.project !== e.detail.id) running.abort.abort();
    if (!running) { log.replaceChildren(); log.hidden = true; pane.classList.remove("tutor-live", "tutor-over"); start.textContent = "Start a class"; }
    setAvailable(true);
  });
}
