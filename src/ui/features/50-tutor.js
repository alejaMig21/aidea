// The Tutor column's class: "Start a class" opens a stream from POST /tutor/classes; the Tutor's messages and its questions
// are drawn here, and each answer goes back through POST /tutor/answer. No domain logic lives here: the core grades and decides.
// Names are prefixed "tutor" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #pane-tutor:is(.tutor-live, .tutor-over) .tutor-help, #pane-tutor.tutor-live :is(#tutor-start, #tutor-topic) { display: none; }
    #pane-tutor #tutor-end[hidden] { display: none; }
    #pane-tutor.tutor-live #tutor-end { align-self: flex-start; background: transparent; color: var(--text); border: 1px solid var(--control); font-size: 13px; font-weight: 400; }
    #tutor-log { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    #tutor-log[hidden] { display: none; }
    #tutor-log .tutor-say { margin: 0; color: var(--text); font-size: 13.5px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
    #tutor-log .tutor-error { margin: 0; color: var(--danger); overflow-wrap: anywhere; }
    #tutor-log .tutor-step { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--text); overflow-wrap: anywhere; }
    #tutor-log .tutor-label { margin: 0; color: var(--accent); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
    #tutor-topic { width: 100%; margin: 0; padding: 7px 10px; font-size: 13px; }
    #tutor-log .tutor-meta { margin: 0; color: var(--muted); font-size: 12px; }
    #tutor-log .tutor-card { margin: 0; padding: 12px; background: var(--raised); border: 1px solid var(--control); border-radius: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    #tutor-log .tutor-card fieldset { margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    #tutor-log .tutor-card legend, #tutor-log .tutor-card .tutor-prompt { margin: 0; padding: 0; color: var(--text); font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; white-space: pre-wrap; }
    #tutor-log .tutor-card label { display: flex; gap: 8px; align-items: baseline; color: var(--text); font-size: 13.5px; overflow-wrap: anywhere; }
    #tutor-log .tutor-card input[type=radio] { accent-color: var(--accent); flex: none; }
    #tutor-log .tutor-card .tutor-stops { flex-direction: row; flex-wrap: wrap; gap: 4px 12px; }
    #tutor-log .tutor-card .tutor-stops legend { flex: 1 0 100%; font-size: 12px; font-weight: 400; color: var(--muted); }
    #tutor-log .tutor-card .tutor-stops label { gap: 4px; align-items: center; font-size: 12px; color: var(--label); }
    #tutor-log .tutor-card textarea { width: 100%; min-height: 64px; resize: vertical; font: inherit; font-size: 13px; padding: 7px 10px; color: var(--text); background: var(--panel); border: 1px solid var(--control); border-radius: 8px; }
    #tutor-log .tutor-card textarea::placeholder { color: var(--muted); }
    #tutor-log .tutor-card .tutor-thought label { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
    #tutor-log .tutor-card .tutor-link { align-self: flex-start; }
    #tutor-log .tutor-card .tutor-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    #tutor-log .tutor-card .tutor-buttons button { padding: 6px 14px; font-size: 13px; }
    #tutor-log .tutor-card button[type=submit] { background: var(--accent); color: var(--on-accent); border: 0; font-size: 13.5px; font-weight: 600; }
    #tutor-log .tutor-card button:disabled { opacity: .5; }
    #tutor-log .tutor-card .tutor-dontknow { background: transparent; color: var(--text); border: 1px solid var(--control); font-weight: 400; }
    #tutor-log .tutor-card .tutor-status { color: var(--danger); margin: 0; }
    #tutor-log .tutor-card.tutor-done { gap: 4px; }
    #tutor-log .tutor-card.tutor-done .tutor-answered { color: var(--muted); margin: 0; overflow-wrap: anywhere; }
  `;
  document.head.append(style);

  const STOPS = [0, 30, 50, 70, 90, 100];
  const pane = $("pane-tutor");
  const start = $("tutor-start");
  const help = pane.querySelector(".tutor-help");
  const end = Object.assign(document.createElement("button"), { type: "button", id: "tutor-end", textContent: "End class", hidden: true });
  const log = Object.assign(document.createElement("div"), { id: "tutor-log", hidden: true });
  log.setAttribute("role", "log");
  log.setAttribute("aria-label", "Class with the Tutor");
  const topic = Object.assign(document.createElement("input"), { type: "text", id: "tutor-topic", maxLength: 500, placeholder: "Topic (optional)" });
  topic.setAttribute("aria-label", "Topic of the class (optional)");
  start.before(topic);
  start.after(end);
  $("tutor-settings").after(log); // below the way to begin; the Probe line (51-probe.js) goes between the two

  let running = null; // { abort, project } while a class is open
  let counter = 0;
  const cards = new Map(); // question id -> its card, so a withdrawn question can be closed

  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const line = (cls, text) => { log.append(el("p", { className: cls, textContent: text })); log.scrollTop = log.scrollHeight; pane.scrollTop = pane.scrollHeight; };

  function setAvailable(open) {
    if (running) return;
    start.disabled = !open;
    help.textContent = open ? "The Tutor asks you questions about your project, one at a time." : "Open a Project to start a class.";
  }

  const PHASE_LABELS = { predict: "Predict", review: "Review of an earlier class" };
  function collapse(card, summary) {
    card.className = "tutor-card tutor-done";
    card.replaceChildren(...(PHASE_LABELS[card.dataset.phase] ? [el("p", { className: "tutor-label", textContent: PHASE_LABELS[card.dataset.phase] })] : []), el("p", { className: "tutor-prompt", textContent: card.dataset.prompt }), el("p", { className: "tutor-answered", textContent: summary }));
  }

  function questionCard(q) {
    const n = ++counter;
    const form = el("form", { className: "tutor-card" });
    form.dataset.prompt = q.prompt;
    form.dataset.phase = q.phase ?? "";
    form.setAttribute("aria-label", q.phase === "predict" ? "Prediction from the Tutor" : q.phase === "review" ? "Review question from the Tutor" : "Question from the Tutor");
    const status = el("p", { className: "tutor-status" });
    status.setAttribute("role", "alert");
    // What the person thought is optional, so it waits behind a link; the answer still sends it when it was written.
    const thought = el("textarea", { id: `tutor-thought-${n}`, rows: 2 });
    const thoughtBox = el("div", { className: "tutor-thought", hidden: true }, el("label", { htmlFor: thought.id, textContent: "What I thought (optional)" }), thought);
    const thoughtLink = el("button", { type: "button", className: "tutor-link", textContent: "Add what you thought" });
    thoughtLink.onclick = () => { thoughtLink.hidden = true; thoughtBox.hidden = false; thought.focus(); };
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
      const text = el("textarea", { id: `tutor-text-${n}`, rows: 3, required: true, placeholder: "Your answer" });
      text.setAttribute("aria-label", "Your answer");
      first = text;
      body = [el("p", { className: "tutor-prompt", textContent: q.prompt }), text];
      summary = () => `You answered: ${text.value.trim()}`;
    }
    if (q.allowDontKnow) {
      dontKnow = el("button", { type: "button", className: "tutor-dontknow", textContent: "Don't know" });
      buttons.append(dontKnow);
    }
    if (q.skippable) { // a probe question (ticket 06): the person may say they already know it
      const known = el("button", { type: "button", className: "tutor-dontknow", textContent: "I already know this" });
      known.onclick = () => submit({ skip: true }, "You said: I already know this");
      buttons.append(known);
    }
    if (PHASE_LABELS[q.phase]) form.prepend(el("p", { className: "tutor-label", textContent: PHASE_LABELS[q.phase] }));
    if (q.probe) form.prepend(el("p", { className: "tutor-label", textContent: `Question ${q.probe.n} of ${q.probe.of}` }));
    form.append(...body, thoughtLink, thoughtBox, buttons, status);

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
        if (res.status === 410) return expire(q.id); // the Tutor stopped waiting before this answer came
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
    // What the person already answered is kept; one click begins again on the same topic.
    const again = el("button", { type: "button", textContent: "Start a class on the same topic" });
    again.onclick = () => {
      again.disabled = true;
      running?.abort.abort();
      const go = () => (running ? setTimeout(go, 50) : startClass());
      go();
    };
    card.form.append(el("p", { className: "tutor-meta", textContent: "Your earlier answers are kept." }), again);
  }

  const UNREACHABLE = ["not_installed", "not_signed_in", "failed"];
  function render(event) {
    // A class that asked for a fallback (the layer class's quick tour) does not show an error when the Tutor could not be reached at all.
    if (event.type === "error" && running?.fallback && !running.heard && UNREACHABLE.includes(event.code)) { running.unavailable = true; return; }
    if (event.type !== "session" && event.type !== "error" && running) running.heard = true;
    if (event.type === "text") line("tutor-say", event.text);
    else if (event.type === "tutor_step") { log.append(el("h3", { className: "tutor-step", textContent: event.title })); pane.scrollTop = pane.scrollHeight; }
    else if (event.type === "tutor_explain") { if (event.repair) line("tutor-label", "Let's look again"); line("tutor-say", event.text); }
    else if (event.type === "decision_ready") document.dispatchEvent(new CustomEvent("proposals-changed"));
    else if (event.type === "tutor_finished") line("tutor-meta", `Class finished: ${event.summary}`);
    else if (event.type === "proposal") tutorProposal(event);
    else if (event.type === "proposal_refused") tutorRefused(event);
    else if (event.type === "decision_hint") decisionHint(event);
    else if (event.type === "tutor_question") questionCard(event);
    else if (event.type === "tutor_question_expired") expire(event.id);
    else if (event.type === "error") { const p = el("p", { className: "tutor-error", textContent: event.message }); p.setAttribute("role", "alert"); log.append(p); }
    else if (event.type === "learner") { learnerLine(event); document.dispatchEvent(new CustomEvent("plan-changed")); }
    else if (event.type === "tutor_plan") document.dispatchEvent(new CustomEvent("plan-changed"));
    else if (event.type === "probe_done") line("tutor-meta", `Known: ${event.counts.known}, partly: ${event.counts.partial}, new to you: ${event.counts.unknown}`);
    else if (event.type === "probe_skipped") line("tutor-meta", "Probe skipped. You can start a class anyway.");
  }

  // A Proposal the Tutor made from the person's answer: the Canvas shows it pending on its layer; here a line says so and offers the way there.
  function tutorProposal(event) {
    const review = el("button", { type: "button", textContent: "Review" });
    review.onclick = () => document.dispatchEvent(new CustomEvent("proposal-open", { detail: { id: event.id } }));
    log.append(el("p", { className: "tutor-meta tutor-proposal" }, el("strong", { textContent: "From the Tutor: " }), `proposal to ${event.kind === "add" ? "add" : "change"} "${event.nodeId}" on the ${event.layer} layer. `, review));
    document.dispatchEvent(new CustomEvent("proposal-created", { detail: event }));
    pane.scrollTop = pane.scrollHeight;
  }

  // A Proposal the Tutor tried to make and the core refused: one plain line with why, and the way to the one that is waiting.
  function tutorRefused(event) {
    const why = event.reason === "pending" ? "a proposal with that name is already waiting for you. Review it first. " : `the ${event.layer} layer already has it. `;
    const p = el("p", { className: "tutor-meta tutor-proposal" }, `The Tutor tried to add "${event.nodeId}", but ${why}`);
    if (event.proposalId) {
      const open = el("button", { type: "button", textContent: "Open it" });
      open.onclick = () => document.dispatchEvent(new CustomEvent("proposal-open", { detail: { id: event.proposalId } }));
      p.append(open);
    }
    log.append(p);
    pane.scrollTop = pane.scrollHeight;
  }

  // The person keeps missing the check of a decision class: one line offers the way out. The class goes on until they take it.
  function decisionHint(event) {
    const p = el("p", { className: "tutor-meta tutor-proposal", textContent: "Taking long? You can let the builder decide. " });
    const decide = el("button", { type: "button", textContent: "Decide for me" });
    decide.onclick = async () => {
      decide.disabled = true;
      const problem = await decideForMe(event.proposal);
      if (problem) { decide.disabled = false; p.append(` ${problem}`); return; }
      p.textContent = "The builder's proposal can be accepted now, on the Canvas.";
    };
    p.append(decide);
    log.append(p);
    pane.scrollTop = pane.scrollHeight;
  }

  // After a class: one plain line about the Learner graph. If the pipeline failed, a Retry button asks the core again.
  function learnerLine(event) {
    if (event.status === "saved") return void (event.ideas > 0 && line("tutor-meta", `Saved ${event.ideas} ${event.ideas === 1 ? "idea" : "ideas"} to your map`));
    const p = el("p", { className: "tutor-error", textContent: `${event.message} ` });
    const retry = el("button", { type: "button", textContent: "Retry" });
    retry.onclick = async () => {
      retry.disabled = true;
      const res = await fetch(`/tutor/classes/${encodeURIComponent(event.classId)}/close`, { method: "POST" }).catch(() => null);
      const body = await res?.json().catch(() => ({}));
      if (res?.ok) { p.className = "tutor-meta"; p.textContent = `Saved ${body.ideas} ${body.ideas === 1 ? "idea" : "ideas"} to your map`; }
      else { p.firstChild.textContent = `${body?.message ?? body?.error ?? "Could not reach the core"} `; retry.disabled = false; }
    };
    p.append(retry);
    log.append(p);
  }

  // Back from a class: the conversation stays on screen, with the way to begin another one below it.
  function finish(opts = {}) {
    for (const id of [...cards.keys()]) expire(id);
    running = null;
    line("tutor-meta", opts.ended ?? "The class has ended.");
    pane.classList.replace("tutor-live", "tutor-over");
    end.hidden = true;
    start.disabled = !current;
    start.textContent = opts.ended ? "Start a class" : "Start another class";
  }

  // `opts` lets another feature (the Probe, 51-probe.js) use the same column: its endpoint and body, the label of the stop button, what stop does, and the closing line.
  async function startClass(opts = {}) {
    if (!current || running) return;
    const project = current;
    running = { abort: new AbortController(), project, skip: opts.skip, fallback: opts.fallback };
    end.textContent = opts.endLabel ?? "End class";
    log.replaceChildren();
    log.hidden = false;
    pane.classList.remove("tutor-over");
    pane.classList.add("tutor-live");
    pane.querySelectorAll("details.tutor-section[open]").forEach((d) => { d.open = false; }); // the sections stay folded during a class
    end.hidden = false;
    start.disabled = true;
    end.focus();
    let unavailable = false;
    try {
      const res = await fetch(opts.path ?? "/tutor/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts.payload ?? { project, topic: topic.value.trim() || undefined }), signal: running.abort.signal });
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
      unavailable = running?.unavailable === true;
      finish(unavailable ? { ended: "The Tutor is not available." } : opts);
      opts.after?.();
    }
    return unavailable; // true: the Tutor could not be reached and the caller asked for a fallback
  }

  start.onclick = () => startClass();
  document.addEventListener("decision-class-start", (e) => startClass({ payload: { project: current, decision: e.detail.proposal } }));
  end.onclick = () => (running?.skip ? running.skip() : running?.abort.abort()); // closing the stream ends the class in the core
  window.tutorUi = { startClass, abort: () => running?.abort.abort(), isRunning: () => running !== null };
  document.addEventListener("project-opened", (e) => {
    if (running && running.project !== e.detail.id) running.abort.abort();
    if (!running) { log.replaceChildren(); log.hidden = true; pane.classList.remove("tutor-live", "tutor-over"); start.textContent = "Start a class"; }
    setAvailable(true);
  });
}
