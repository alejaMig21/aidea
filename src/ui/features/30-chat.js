// Chat bar: renders the events the core streams from POST /chat. No domain logic lives here.
// Permission requests are not handled yet (ticket 07): until then Claude Code denies them on its own.
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

  function render(event, project) {
    if (event.type === "session") sessions.set(project, event.sessionId);
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
      send.disabled = false;
      input.focus();
    }
  };
}
