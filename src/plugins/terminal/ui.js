// The Terminal Panel, the first plugin that ships with aidea (ADR 0008): a Panel in the bottom strip of the Layout, hidden until the person shows it.
// It shows the output of the programs started with Play (the Run plugin), one tab for each, view only: nothing can be typed into it.
export function activate(ui) {
  return ui.slots.add("layout.panel", {
    id: "terminal",
    title: "Terminal",
    side: "bottom",
    min: 240,
    startsHidden: true,
    icon: '<path d="M4.5 6.5 6.5 8l-2 1.5M8 10h3"/>',
    render(container) {
      const empty = "The output of the programs you start with Play will appear here, one tab for each program.";
      const tabs = Object.assign(document.createElement("div"), { role: "tablist" });
      const bar = document.createElement("div");
      const text = Object.assign(document.createElement("pre"), { role: "log", tabIndex: 0 });
      const message = Object.assign(document.createElement("p"), { className: "said", textContent: empty });
      tabs.style.cssText = "display:flex;gap:4px;padding:6px 8px 0;flex-wrap:wrap";
      bar.style.cssText = "display:flex;gap:6px;align-items:center;padding:4px 8px;color:var(--muted);font-size:12px";
      text.style.cssText = "margin:0;padding:8px 12px;overflow:auto;flex:1;min-height:0;font:12px/1.45 var(--mono);color:var(--text);white-space:pre-wrap;word-break:break-word";
      message.style.cssText = "margin:0;padding:12px 14px;color:var(--muted)";
      text.dataset.selectionSource = "terminal"; // the selection control gives text selected here the terminal's own, longer limit
      container.style.cssText += ";display:flex;flex-direction:column";
      container.append(tabs, bar, text, message);

      let selected = null, parts = [], lastText = "", timer = 0, busy = false;
      const button = (label, title, onclick) => Object.assign(document.createElement("button"), { type: "button", textContent: label, title, onclick });
      const act = async (name, body) => { try { await ui.call(name, { project: ui.project(), ...body }, "run"); } catch { /* the next refresh shows the state */ } refresh(); };

      function draw() {
        const part = parts.find((p) => p.name === selected) ?? parts[0];
        message.hidden = parts.length > 0;
        tabs.hidden = bar.hidden = text.hidden = !parts.length;
        tabs.replaceChildren(...parts.map((p) => {
          const tab = button(`${p.name} ${p.alive ? "(running)" : p.stopped ? "(stopped)" : p.exit === null ? "" : `(exited ${p.exit})`}`, `Show the output of ${p.name}`, () => { selected = p.name; lastText = ""; draw(); });
          tab.role = "tab";
          tab.setAttribute("aria-selected", String(p === part));
          tab.dataset.part = p.name;
          return tab;
        }));
        if (!part) return;
        selected = part.name;
        bar.replaceChildren(
          Object.assign(document.createElement("span"), { textContent: part.alive ? "Running" : part.stopped ? "Stopped" : `Exited with code ${part.exit}` }),
          ...(part.alive ? [button("Stop", `Stop ${part.name}`, () => act("stop", { part: part.name }))] : []),
          button("Restart", `Restart ${part.name} and what depends on it`, () => act("restart", { part: part.name })),
        );
        const body = (part.dropped ? `[${part.dropped} older lines were dropped]\n` : "") + part.lines.join("\n");
        if (body !== lastText) {
          const atEnd = text.scrollTop + text.clientHeight >= text.scrollHeight - 8;
          text.textContent = lastText = body;
          if (atEnd) text.scrollTop = text.scrollHeight;
        }
      }

      async function refresh() {
        const project = ui.project();
        if (!project || busy) return;
        busy = true;
        try { parts = (await ui.call("output", { project }, "run")).parts; draw(); } catch { /* the Run plugin is off or the Project closed: keep what is shown */ } finally { busy = false; }
      }
      refresh();
      timer = setInterval(refresh, 800);
      return () => { clearInterval(timer); tabs.remove(); bar.remove(); text.remove(); message.remove(); };
    },
  });
}
