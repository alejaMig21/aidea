// A plugin with one Panel. Copy this folder, change the id in aidea-plugin.json (the Panel takes the plugin's id) and the text below.
// Colours and sizes come only from the style tokens (CSS variables) listed by GET /plugins/inspect.
export function activate(ui) {
  return ui.slots.add("layout.panel", {
    id: "my-plugin", // the same as the plugin's id: the Panel takes that id
    title: "My plugin",
    render(container) {
      const text = Object.assign(document.createElement("p"), { textContent: "Hello from my plugin." });
      text.style.cssText = "margin:0;padding:1em;color:var(--text)";
      container.append(text);
      return () => text.remove(); // undo everything render added
    },
  });
}
