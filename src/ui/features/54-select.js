// Select any text to learn about it (ticket 13): selecting text anywhere (a builder reply, a Rationale, the Code panel, the Tutor's own words)
// shows a small control next to it with "Explain" (a brief explanation, no class) and "Enter the Tutor" (a free class on that text).
// Text typed in the person's own input boxes never triggers it. The core does the work (POST /tutor/define, POST /tutor/classes {selection});
// the selected text only travels as data. Names are prefixed "select" because every feature file shares one global scope.
{
  const MAX = 2000; // the core's limit on a selection
  const MAX_TERMINAL = 8000; // the core's limit on text selected in the terminal (the Terminal marks its log with data-selection-source="terminal")
  const style = document.createElement("style");
  style.textContent = `
    #select-pop { position: fixed; z-index: 30; max-width: 320px; padding: 6px; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; box-shadow: 0 10px 28px #0009; font-size: 13px; color: var(--text); }
    #select-pop[hidden] { display: none; }
    #select-pop .row { display: flex; gap: 6px; }
    #select-pop button { padding: 3px 10px; font-size: 12.5px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #select-pop button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
    #select-pop button:disabled { opacity: .5; }
    #select-pop .said { margin: 6px 2px 2px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
    #select-pop .said.error { color: var(--danger); }
    #select-pop .hint { margin: 6px 2px 2px; font-size: 12px; color: var(--muted); }
    #select-pop .warn { margin: 2px; }
    #select-pop .warn[hidden] { display: none; }
    #select-pop .warn p { margin: 0 0 6px; font-size: 12px; line-height: 1.45; color: var(--text); }
  `;
  document.head.append(style);

  const pop = Object.assign(document.createElement("div"), { id: "select-pop", hidden: true, role: "dialog" });
  pop.setAttribute("aria-label", "Learn about the selected text");
  const define = Object.assign(document.createElement("button"), { type: "button", textContent: "Explain" });
  const enter = Object.assign(document.createElement("button"), { type: "button", textContent: "Enter the Tutor", className: "primary" });
  const row = Object.assign(document.createElement("div"), { className: "row" });
  const said = Object.assign(document.createElement("p"), { className: "said", hidden: true });
  said.setAttribute("role", "status");
  const hint = Object.assign(document.createElement("p"), { className: "hint", hidden: true });
  // "This looks like a secret": asked before any button sends text. The text is never changed or hidden; the check is a warning, not a guarantee.
  const warn = Object.assign(document.createElement("div"), { className: "warn", hidden: true });
  const warnText = Object.assign(document.createElement("p"), { textContent: "This looks like a secret (a key, a password or a token). Send it anyway? This check is a warning, not a guarantee: read the text yourself before you send it." });
  const warnRow = Object.assign(document.createElement("div"), { className: "row" });
  const sendAnyway = Object.assign(document.createElement("button"), { type: "button", textContent: "Send anyway" });
  const cancel = Object.assign(document.createElement("button"), { type: "button", textContent: "Cancel" });
  warnRow.append(sendAnyway, cancel);
  warn.append(warnText, warnRow);
  row.append(define, enter);
  pop.append(row, warn, said, hint);
  document.body.append(pop);

  let text = "", source, token = 0; // text is what would be sent; source is "terminal" for text selected there
  let afterWarning = null; // what to do when the person confirms the secret warning
  const resetWarning = () => { afterWarning = null; warn.hidden = true; row.hidden = false; };
  const hide = () => { pop.hidden = true; said.hidden = true; said.textContent = ""; text = ""; token++; resetWarning(); };

  // Does this text look like a secret? Made-up examples of each: a private key header, "DB_PASSWORD=hunter2hunter2", "password: correct-horse-9", "Bearer <long token>",
  // a key with a known prefix (sk-, ghp_, AKIA...), "postgres://user:pass@host", or one long mixed-case string of letters and digits. Ids, hashes and paths are not flagged.
  function selectLooksLikeSecret(value) {
    const t = value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ""); // a UUID is an id, not a key
    const name = "\\b\\w*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\\w*[\"']?";
    return [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      new RegExp(name + "\\s*=\\s*[\"']?[^\\s\"']{6,}", "i"), // NAME=value
      new RegExp(name + "\\s*:\\s*[\"']?(?=[^\\s\"']*\\d)[^\\s\"']{8,}", "i"), // name: value, only when the value has a digit ("Invalid token: expected string" is not a secret)
      /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/,
      /\b(?:sk-|sk_live_|pk_live_|rk_live_|ghp_|gho_|ghs_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza)[A-Za-z0-9_-]{12,}/,
      /[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:[^\s@\/]+@/i,
      /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{32,}\b/,
    ].some((re) => re.test(t));
  }
  // Runs `go` now, or after the person confirms when the text looks like a secret.
  function sendOrWarn(go) {
    if (!selectLooksLikeSecret(text)) return go();
    afterWarning = go;
    row.hidden = true;
    warn.hidden = false;
  }
  sendAnyway.onclick = () => { const go = afterWarning; resetWarning(); go?.(); };
  cancel.onclick = resetWarning;

  // Is the selection in a box the person types in? Those never offer the control.
  const typing = (node) => {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    return !!el?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  };

  const inTerminal = (node) => !!(node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('[data-selection-source="terminal"]');

  function check() {
    const sel = window.getSelection();
    const picked = sel?.toString().trim() ?? "";
    if (!picked || !sel.rangeCount || !current || typing(sel.anchorNode) || typing(sel.focusNode) || typing(document.activeElement)) return;
    if (pop.contains(sel.anchorNode)) return;
    // A long traceback keeps its END, where the error is: the control says it cut the start.
    const fromTerminal = inTerminal(sel.anchorNode) && inTerminal(sel.focusNode);
    const cut = fromTerminal && picked.length > MAX_TERMINAL;
    const sent = cut ? picked.slice(-MAX_TERMINAL) : picked;
    if (sent !== text) { token++; said.hidden = true; resetWarning(); } // a definition still on its way belongs to the old selection
    text = sent;
    source = fromTerminal ? "terminal" : undefined;
    const tooLong = !fromTerminal && picked.length > MAX;
    const busy = window.tutorUi?.isRunning();
    define.disabled = tooLong;
    enter.disabled = tooLong || busy;
    hint.textContent = tooLong ? `Select less text: up to ${MAX} characters.` : cut ? `Only the last ${MAX_TERMINAL} characters are sent: the start was cut.` : "A class is running: end it to start another.";
    hint.hidden = !(tooLong || cut || busy);
    pop.hidden = false;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
    pop.style.top = `${r.bottom + 8 + h > innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8}px`;
  }

  // The selection settles on mouse up or after keyboard selection; a click elsewhere or Escape closes the control.
  document.addEventListener("mouseup", (e) => { if (!pop.contains(e.target)) setTimeout(check, 0); });
  document.addEventListener("keyup", (e) => { if (e.shiftKey && e.key.startsWith("Arrow")) check(); });
  document.addEventListener("mousedown", (e) => { if (!pop.hidden && !pop.contains(e.target)) hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { hide(); e.stopPropagation(); } }, true);
  pop.addEventListener("mousedown", (e) => e.preventDefault()); // keeps the selection while a button is pressed

  define.onclick = () => sendOrWarn(explain);
  enter.onclick = () => sendOrWarn(enterTheTutor);
  async function explain() {
    const mine = ++token, project = current, asked = text, from = source;
    define.disabled = true; // the answer re-enables it only if the selection has not changed meanwhile
    said.className = "said";
    said.textContent = "Defining…";
    said.hidden = false;
    try {
      const res = await fetch("/tutor/define", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: asked, source: from }) });
      const body = await res.json().catch(() => ({}));
      if (mine !== token) return;
      said.className = res.ok ? "said" : "said error";
      said.textContent = res.ok ? body.definition : body.error ?? "Could not define this text";
    } catch (err) {
      if (mine !== token) return;
      said.className = "said error";
      said.textContent = `Could not reach the core: ${err.message}`;
    }
    define.disabled = !source && text.length > MAX;
  }
  function enterTheTutor() {
    const asked = text, project = current, from = source;
    hide();
    window.getSelection()?.removeAllRanges();
    window.tutorUi?.startClass({ payload: { project, selection: asked, source: from } });
  };
  document.addEventListener("project-opened", hide);
}
