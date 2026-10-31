// Heavy-ish stand-ins for the six existing cards (same DOM weight in both engines).
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
export const PANELS = {
  builder: { title: "Builder", min: [268, 120] }, files: { title: "Files", min: [200, 120] }, code: { title: "Code", min: [240, 120] },
  canvas: { title: "Canvas", min: [376, 200] }, run: { title: "Run", min: [240, 120] }, tutor: { title: "Tutor", min: [288, 120] },
};
export function makeContent(id) {
  const b = el("div", "body"); b.dataset.panel = id;
  if (id === "builder" || id === "tutor") for (let i = 0; i < 300; i++) b.append(el("div", "msg", `${id} message ${i}: some text that wraps over a couple of lines to look like a chat turn in a card`));
  else if (id === "files") for (let i = 0; i < 600; i++) b.append(el("div", "row", `src/module${i % 40}/file${i}.py`));
  else if (id === "code") b.append(el("div", "code", Array.from({ length: 2000 }, (_, i) => `${String(i + 1).padStart(4)}  def fn_${i}(a, b):  return a + b  # line`).join("\n")));
  else if (id === "canvas") {
    let s = '<svg width="100%" height="100%" viewBox="0 0 1200 800">';
    for (let i = 0; i < 500; i++) { const x = (i % 25) * 46, y = Math.floor(i / 25) * 38; s += `<rect x="${x}" y="${y}" width="40" height="28" rx="6" fill="#1b2030" stroke="#6ea8ff"/><line x1="${x + 20}" y1="${y + 28}" x2="${x + 46}" y2="${y + 38}" stroke="#555"/>`; }
    b.innerHTML = s + "</svg>";
  } else for (let i = 0; i < 200; i++) b.append(el("div", "row", `step ${i}: total = ${i * 3}`));
  return b;
}
