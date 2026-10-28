// Problems: what the core could not accept in a Project's .aidea files. A red count badge on the layer's tab, and a
// "Problems (N)" button next to the legend "?" that opens a popover. Nothing is ever drawn over the Canvas.
// The core sends structured problems ({ layer, file, id?, index?, field?, message }); this file only words and places them.
{
  const style = document.createElement("style");
  style.textContent = `
    #problems-button { position: absolute; right: 53px; top: 15px; z-index: 2; height: 30px; padding: 0 12px; border-radius: 15px; background: var(--panel); color: var(--danger); border: 1px solid var(--danger); font-size: 12.5px; font-weight: 600; }
    #problems-pop { position: absolute; right: 15px; top: 52px; z-index: 5; width: min(420px, calc(100% - 30px)); max-height: calc(100% - 120px); overflow-y: auto; background: var(--raised); border: 1px solid var(--control); border-radius: 12px; padding: 12px 14px; box-shadow: 0 12px 32px #0009; }
    #problems-pop h3 { margin: 0 0 6px; font: 600 10.5px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
    #problems-pop ul { margin: 0 0 12px; padding: 0; list-style: none; display: grid; gap: 8px; }
    #problems-pop li { font-size: 12.5px; color: var(--label); overflow-wrap: anywhere; }
    #problems-pop li b { color: var(--text); font-weight: 600; }
    #problems-pop li small { display: block; margin-top: 2px; color: var(--muted); font: 400 11px var(--mono); }
    #layers .badge.problems { background: var(--danger); }
    body.has-problems #layers { max-width: calc(100% - 190px); }
  `;
  document.head.append(style);
}

let problemsList = [];
const problemsButton = Object.assign(document.createElement("button"), { type: "button", id: "problems-button", hidden: true });
problemsButton.setAttribute("aria-haspopup", "dialog");
problemsButton.setAttribute("aria-expanded", "false");
problemsButton.setAttribute("aria-controls", "problems-pop");
const problemsPop = Object.assign(document.createElement("div"), { id: "problems-pop", hidden: true });
problemsPop.setAttribute("role", "dialog");
problemsPop.setAttribute("aria-label", "Problems in this project's files");
document.querySelector("main").append(problemsButton, problemsPop);

// Red count on the tab of a layer whose file has problems (also called by markTabs in 70-proposals.js after it rewrites a tab).
function problemsMarkTab(tab) {
  tab.querySelectorAll(".badge.problems").forEach((b) => b.remove());
  const n = problemsList.filter((p) => p.layer === tab.dataset.layer).length;
  if (!n) return;
  const badge = Object.assign(document.createElement("span"), { className: "badge problems", textContent: n, title: `${n} ${n === 1 ? "problem" : "problems"} in this layer's file` });
  tab.append(badge);
}

function problemsSetOpen(open) {
  problemsPop.hidden = !open;
  problemsButton.setAttribute("aria-expanded", String(open));
}

function problemsRender(list) {
  problemsList = list;
  document.body.classList.toggle("has-problems", list.length > 0);
  layerBar.querySelectorAll("button[data-layer]").forEach(problemsMarkTab);
  problemsButton.hidden = list.length === 0;
  problemsButton.textContent = `Problems (${list.length})`;
  if (!list.length) { problemsSetOpen(false); problemsPop.replaceChildren(); return; }
  const groups = [...AUTHORED_LAYERS.map((l) => [l.key, l.label]), [undefined, "Other files"]];
  problemsPop.replaceChildren(...groups.flatMap(([key, label]) => {
    const rows = list.filter((p) => p.layer === key);
    if (!rows.length) return [];
    const ul = document.createElement("ul");
    ul.replaceChildren(...rows.map((p) => {
      const li = document.createElement("li");
      const what = p.id !== undefined ? `Item "${p.id}"` : p.index !== undefined ? `Item ${p.index + 1} in the file (it has no id)` : "The file";
      li.append(Object.assign(document.createElement("b"), { textContent: `${what}: ` }), p.message, Object.assign(document.createElement("small"), { textContent: p.file }));
      return li;
    }));
    return [Object.assign(document.createElement("h3"), { textContent: label }), ul];
  }));
}

problemsButton.onclick = () => problemsSetOpen(problemsPop.hidden);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !problemsPop.hidden) { problemsSetOpen(false); problemsButton.focus(); } });
document.addEventListener("click", (e) => { if (!problemsPop.hidden && !problemsPop.contains(e.target) && e.target !== problemsButton) problemsSetOpen(false); });
