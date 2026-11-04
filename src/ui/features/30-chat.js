// Chat bar: renders the events the core streams from POST /chat. No domain logic lives here.
// When the builder needs permission, a card with Approve and Reject appears; the answer goes back through POST /permission.
{
  const log = document.createElement("div");
  log.id = "chat-log";
  log.setAttribute("role", "log");
  const form = document.createElement("form");
  const label = Object.assign(document.createElement("label"), { htmlFor: "chat-input", textContent: "Ask the builder" });
  const input = document.createElement("textarea"); // several lines: a pasted list keeps its line breaks
  input.id = "chat-input";
  input.rows = 1;
  input.placeholder = "Describe what to build or change";
  input.required = true;
  // The box is one line until the text needs more, then grows up to its CSS maximum and scrolls.
  const fit = () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; };
  input.addEventListener("input", fit);
  // Enter sends; Shift+Enter makes a new line; Enter that confirms an input-method composition does neither.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); form.requestSubmit(); } // 229: some browsers report a composition Enter this way
  });
  // The text wraps differently when the column is resized, so the height follows the width.
  let fitWidth = 0;
  // fit() changes the height of the very box that is observed, so it runs a frame later (a Panel moved by the Layout resizes it often).
  new ResizeObserver(() => requestAnimationFrame(() => { if (input.clientWidth !== fitWidth) { fitWidth = input.clientWidth; fit(); } })).observe(input);
  const send = document.createElement("button");
  send.textContent = "Send";
  form.append(label, input, send);
  const foot = Object.assign(document.createElement("div"), { id: "chat-foot" });
  foot.append(form);
  $("chat").append(log, foot);

  const sessions = new Map(); // project id -> Claude Code session id, so follow-ups continue the conversation
  const cards = new Map(); // permission request id -> its card, so a card can be withdrawn

  const add = (cls, text, parent) => {
    const div = document.createElement("div");
    div.className = cls + (parent ? " nested" : "");
    div.textContent = text;
    log.append(div);
    log.scrollTop = log.scrollHeight;
    return div;
  };

  const hint = (input) => {
    const v = input && (input.description || input.command || input.file_path || input.pattern || input.path || input.query);
    return typeof v === "string" ? v.slice(0, 80) : "";
  };

  // The person approves what they see, so the card shows the whole request. Characters that change the order the text
  // is read in, or that cannot be seen, are written out as <U+XXXX> instead of being drawn.
  const visible = (text) =>
    String(text ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F؜‎‏‪-‮⁦-⁩]/g, (c) => `<U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}>`);
  const MAX_SHOWN = 20000; // beyond this the card says how much is not shown

  // One labelled block of the request, scrollable.
  function block(label, text) {
    const wrap = document.createElement("div");
    const name = document.createElement("div");
    name.className = "meta";
    name.textContent = label;
    const pre = document.createElement("pre");
    const whole = visible(text);
    pre.textContent = whole.length > MAX_SHOWN ? whole.slice(0, MAX_SHOWN) : whole;
    wrap.append(name, pre);
    if (whole.length > MAX_SHOWN) {
      const more = document.createElement("div");
      more.className = "error";
      more.textContent = `${whole.length - MAX_SHOWN} more characters are not shown here. Reject unless you trust the rest.`;
      wrap.append(more);
    }
    return wrap;
  }

  const requestBlocks = (tool, input) => {
    if (tool === "Bash") {
      return [block("Command", input.command), ...(input.description ? [block("Claude's description (not checked)", input.description)] : [])];
    }
    if (tool === "Write") return [block("File", input.file_path), block("Content", input.content)];
    if (tool === "Edit") return [block("File", input.file_path), block("Replace", input.old_string), block("With", input.new_string)];
    return [block("Request", JSON.stringify(input, null, 2))];
  };

  function permissionCard(event) {
    const box = document.createElement("div");
    box.className = "permission";
    const title = document.createElement("strong");
    title.textContent = `Claude wants to use ${visible(event.tool)}`;
    const row = document.createElement("div");
    row.className = "row";
    const status = document.createElement("span");
    const reason = document.createElement("input");
    reason.placeholder = "Reason for rejecting (optional)";
    reason.setAttribute("aria-label", "Reason for rejecting");
    const approve = document.createElement("button");
    approve.textContent = "Approve";
    const reject = document.createElement("button");
    reject.textContent = "Reject";
    reject.className = "reject";
    const answer = async (decision) => {
      approve.disabled = reject.disabled = true;
      try {
        const res = await fetch("/permission", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: event.id, secret: event.secret, decision, message: decision === "deny" ? reason.value.trim() || undefined : undefined }),
        });
        box.classList.add("answered");
        status.textContent = res.ok ? (decision === "allow" ? "Approved" : "Rejected") : (await res.json().catch(() => ({}))).error ?? "Could not send the answer";
      } catch (err) {
        approve.disabled = reject.disabled = false; // the answer did not arrive: the person can try again
        status.textContent = `Could not reach the core: ${err.message}`;
      }
    };
    approve.onclick = () => answer("allow");
    reject.onclick = () => answer("deny");
    row.append(approve, reject, reason, status);
    const note = event.note ? Object.assign(document.createElement("p"), { className: "said", textContent: event.note }) : null; // a question from a plugin's guard rule
    box.append(title, ...(note ? [note] : []), ...requestBlocks(event.tool, event.input ?? {}), row);
    log.append(box);
    log.scrollTop = log.scrollHeight;
    cards.set(event.id, { box, buttons: [approve, reject], reason, status });
  }

  // The builder stopped waiting: the card can no longer be answered.
  function expireCard(id) {
    const card = cards.get(id);
    if (!card || card.box.classList.contains("answered")) return;
    card.box.classList.add("answered");
    card.buttons.forEach((b) => { b.disabled = true; });
    card.reason.disabled = true;
    card.status.textContent = "Expired: Claude stopped waiting for an answer";
  }

  function render(event, project) {
    if (event.type === "session") sessions.set(project, event.sessionId);
    else if (event.type === "permission") permissionCard(event);
    else if (event.type === "permission_expired") expireCard(event.id);
    else if (event.type === "proposal") {
      // The Canvas shows it highlighted on its layer; the chat says it happened and offers to take the person there.
      const line = add("proposal-line", `${event.source?.role === "tutor" ? "From the Tutor. " : ""}Proposal: ${event.kind} "${event.nodeId}" on the ${event.layer} layer. `);
      const review = document.createElement("button");
      review.textContent = "Review";
      review.onclick = () => document.dispatchEvent(new CustomEvent("proposal-open", { detail: { id: event.id } }));
      line.append(review);
      document.dispatchEvent(new CustomEvent("proposal-created", { detail: event }));
    }
    else if (event.type === "proposal_refused") {
      const [text, open] = proposalRefusedParts(event, "Claude");
      add("proposal-line", text).append(...(open ? [open] : []));
    }
    else if (event.type === "authored_changed") {
      // The builder changed the authored files without a Proposal: say which, and offer the way back.
      const names = event.files.map((f) => f.file.replace(/^\.aidea\//, "")).join(", ");
      const line = add("proposal-line", `Claude changed ${event.files.length === 1 ? "an authored file" : "authored files"} without a proposal: ${names}. `);
      const restore = document.createElement("button");
      restore.textContent = "Restore";
      restore.onclick = async () => {
        restore.disabled = true;
        try {
          const res = await fetch("/authored/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: event.id }) });
          const out = await res.json();
          restore.replaceWith(Object.assign(document.createElement("span"), {
            textContent: !res.ok ? out.error : out.skipped.length ? `Restored, except ${out.skipped.join(", ")}: you changed it since.` : "Restored.",
          }));
        } catch (err) {
          restore.disabled = false;
          restore.after(` Could not reach the core: ${err.message}`);
        }
      };
      line.append(restore);
    }
    else if (event.type === "decision_class") {
      add("proposal-line", "A decision is waiting for a class: the Tutor asks you about it before you can accept it. Open the Proposal to start it.");
      document.dispatchEvent(new CustomEvent("decision-class", { detail: event }));
    }
    else if (event.type === "text") add("text", event.text, event.parent);
    else if (event.type === "tool") add("tool", `> ${event.name} ${hint(event.input)}`.trim(), event.parent);
    else if (event.type === "error") add("error", event.message);
    else if (event.type === "result") {
      const bits = [];
      if (event.costUsd != null) bits.push(`$${event.costUsd.toFixed(4)}`);
      if (event.durationMs != null) bits.push(`${(event.durationMs / 1000).toFixed(1)}s`);
      if (bits.length) add("meta", bits.join(" · "));
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (send.disabled) return; // the builder is still answering: the draft stays in the box
    const message = input.value.trim();
    if (!message) { input.value = ""; fit(); return; }
    if (!current) { add("error", "Open a Project first."); return; }
    const project = current;
    input.value = "";
    fit();
    send.disabled = true;
    add("you", message);
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, message, sessionId: sessions.get(project) }),
      });
      if (!res.ok) { add("error", (await res.json()).error); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) if (line) render(JSON.parse(line), project);
      }
    } catch (err) {
      add("error", `Could not reach the core: ${err.message}`);
    } finally {
      // A card still waiting when the conversation ends can no longer be answered.
      log.querySelectorAll(".permission:not(.answered) button").forEach((b) => { b.disabled = true; });
      send.disabled = false;
      input.focus();
    }
  };
}
