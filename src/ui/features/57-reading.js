// The Node whose code is being read shows it (layout-and-data 05). Files, Nodes and the steps of a Flow select each other through the Code panel: when a tab of the Code panel comes to the
// front (a file chosen in Files, "View code" on a Node, a step of a Flow), the Node it belongs to carries a sign on the Canvas: a thick ring and the word READING, so it reads without colour.
// One Node at a time. A file that is not a Node on the Canvas clears it, and so does a layer where the Node is not drawn. Names are prefixed "reading" because every feature file shares one global scope.
{
  const style = document.createElement("style");
  style.textContent = `
    #world .reading { stroke: var(--accent); stroke-width: 3; }
    #world .reading-tag { fill: var(--accent); font: 600 11px var(--sans); letter-spacing: .08em; pointer-events: none; }
  `;
  document.head.append(style);

  let readingId = null; // the Node whose code is on screen, whether or not the Canvas draws it now
  const onComponents = () => typeof authoredShown !== "string" || authoredShown === "components";

  function readingMark(id) {
    readingId = id;
    for (const n of document.querySelectorAll("#world .reading")) n.classList.remove("reading");
    for (const n of document.querySelectorAll("#world .reading-tag")) n.remove();
    if (!id || !onComponents()) return;
    const rects = [...document.querySelectorAll(`#world rect[data-id="${CSS.escape(id)}"]`)];
    if (!rects.length) return;
    for (const r of rects) r.classList.add("reading");
    const main = rects.find((r) => /cp-pkg|cp-class|cp-func/.test(r.getAttribute("class") ?? "")) ?? rects[0];
    $("world").append(el("text", { x: Number(main.getAttribute("x")) + Number(main.getAttribute("width")) - 4, y: Number(main.getAttribute("y")) - 5, class: "reading-tag", "text-anchor": "end" }, "READING"));
  }

  // The Node of what the Code panel shows: the Node it was opened for, else the module that is that file.
  document.addEventListener("code-tab-changed", (e) => {
    const { path, node } = e.detail ?? {};
    const found = node ?? (path ? algoNodes.find((n) => n.kind === "module" && n.file === path)?.id : null) ?? null;
    readingMark(found);
    if (found && typeof onSelect === "function" && codeSelected !== found) onSelect(found, true); // chosen from the code side: select it, without opening the code again
  });

  // The sign comes back after the Canvas is drawn again, and goes when another layer is shown.
  const readingDraw = draw;
  draw = async (nodes) => { await readingDraw(nodes); readingMark(readingId); };
  const readingShowLayer = showLayer;
  showLayer = (which) => { readingShowLayer(which); readingMark(readingId); };
}
