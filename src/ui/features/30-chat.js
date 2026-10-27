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
    #chat-log .permission pre { margin: 0; max-height: 120px; overflow: auto; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; }
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

  // What the person needs to see to decide: the command, or the file and a preview of the change.
  const describe = (tool, input) => {
    const cut = (s, n = 300) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "…" : s);
    if (tool === "Bash") return [input.description, input.command].filter(Boolean).join("\n");
    if (tool === "Write") return `${input.file_path}\n${cut(input.content)}`;
    if (tool === "Edit") return `${input.file_path}\n- ${cut(input.old_string, 150)}\n+ ${cut(input.new_string, 150)}`;
    return cut(JSON.stringify(input, null, 2), 600);
  };

  function permissionCard(event) {
    const box = document.createElement("div");
    box.className = "permission";
    const title = document.createElement("strong");
    title.textContent = `Claude wants to use ${event.tool}`;
    const detail = document.createElement("pre");
    detail.textContent = describe(event.tool, event.input ?? {});
    const row = document.createElement("div");
    row.className = "row";
    const status = document.createElement("span");
    const approve = document.createElement("button");
    approve.textContent = "Approve";
    const reject = document.createElement("button");
    reject.textContent = "Reject";
    reject.className = "reject";
    const answer = async (decision) => {
      approve.disabled = reject.disabled = true;
      const res = await fetch("/permission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: event.id, decision }),
      });
      box.classList.add("answered");
      status.textContent = res.ok ? (decision === "allow" ? "Approved" : "Rejected") : (await res.json().catch(() => ({}))).error ?? "Could not send the answer";
    };
    approve.onclick = () => answer("allow");
    reject.onclick = () => answer("deny");
    row.append(approve, reject, status);
    box.append(title, detail, row);
    log.append(box);
    log.scrollTop = log.scrollHeight;
  }

  function render(event, project) {
    if (event.type === "session") sessions.set(project, event.sessionId);
    else if (event.type === "permission") permissionCard(event);
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
