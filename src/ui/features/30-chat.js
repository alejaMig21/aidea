// Chat bar: renders the events the core streams from POST /chat. No domain logic lives here.
// When the builder needs permission, a card with Approve and Reject appears; the answer goes back through POST /permission.
{
  const style = document.createElement("style");
  style.textContent = `
    #chat form { flex-direction: row; gap: 8px; }
    #chat input { flex: 1; }
    #chat button:disabled { opacity: .5; cursor: default; }
    #chat-log { max-height: 40vh; overflow-y: auto; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
    #chat-log:empty { display: none; }
    #chat-log .text { white-space: pre-wrap; }
    #chat-log .you { color: var(--muted); }
    #chat-log .tool { color: var(--muted); font: 12px ui-monospace, monospace; }
    #chat-log .nested { margin-left: 18px; border-left: 2px solid var(--line); padding-left: 8px; }
    #chat-log .error { color: #c0392b; }
    #chat-log .meta { color: var(--muted); font-size: 12px; }
    #chat-log .permission { border: 1px solid var(--accent); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
    #chat-log .permission pre { margin: 0; max-height: 160px; overflow: auto; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; }
    #chat-log .permission .row input { flex: 1; min-width: 0; }
    #chat-log .permission .row { display: flex; gap: 8px; align-items: center; }
    #chat-log .permission .reject { background: transparent; color: var(--text); border: 1px solid var(--line); }
  `;
  document.head.append(style);

  const log = document.createElement("div");
  log.id = "chat-log";
  log.setAttribute("role", "log");
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.placeholder = "Ask the builder";
  input.setAttribute("aria-label", "Message to the builder");
  input.required = true;
  const send = document.createElement("button");
  send.textContent = "Send";
  form.append(input, send);
  $("chat").append(log, form);

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
    box.append(title, ...requestBlocks(event.tool, event.input ?? {}), row);
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
    const message = input.value.trim();
    if (!message) return;
    if (!current) { add("error", "Open a Project first."); return; }
    const project = current;
    input.value = "";
    send.disabled = true;
    add("you", `You: ${message}`);
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
