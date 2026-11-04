// The Terminal Panel, the first plugin that ships with aidea (ADR 0008): a Panel in the bottom strip of the Layout, hidden until the person shows it.
// For now it only says what it will show; the output of the programs started with Play comes with the run recipe.
export function activate(ui) {
  return ui.slots.add("layout.panel", {
    id: "terminal",
    title: "Terminal",
    side: "bottom",
    min: 240,
    startsHidden: true,
    icon: '<path d="M4.5 6.5 6.5 8l-2 1.5M8 10h3"/>',
    render(container) {
      const message = Object.assign(document.createElement("p"), { className: "said", textContent: "The output of the programs you start with Play will appear here, one tab for each program." });
      message.style.cssText = "margin:0;padding:12px 14px;color:var(--muted)";
      container.append(message);
      return () => message.remove();
    },
  });
}
