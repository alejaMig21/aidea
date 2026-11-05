// Runs inside the real page (injected by overview-smooth-page.test.ts): the Components overview of a generated big Project, drawn and moved.
const report = { errors: [] };
window.addEventListener("error", (e) => { if (!String(e.message).startsWith("ResizeObserver")) report.errors.push(String(e.message)); });
const osWait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    await openProject(window.BIG_PROJECT);
    for (let i = 0; i < 2000 && !document.querySelector("#world .cp-ov-edge"); i++) await osWait(25);
    report.debug = { layer: typeof authoredShown !== "undefined" ? authoredShown : null, world: document.querySelectorAll("#world *").length, error: $("error").textContent, home: $("home").hidden, opening: $("opening").hidden, mode: typeof componentsMode !== "undefined" ? componentsMode : null };
    await osWait(500);
    $("zoom-fit").click();
    await osWait(300);
    const edges = [...document.querySelectorAll("#world .cp-ov-edge")];
    const style = getComputedStyle(edges[0]);
    report.edges = edges.length;
    report.faint = { opacity: style.opacity, strokeOpacity: style.strokeOpacity, markerEnd: style.markerEnd, zoom: Math.round(view.k * 100) / 100, heads: $("cp-root").classList.contains("ov-heads") };
    // Zoomed in far enough to read an arrowhead, the heads come back.
    for (let i = 0; i < 12 && view.k < 1; i++) $("zoom-in").click();
    await osWait(300);
    const zoomed = getComputedStyle(document.querySelector("#world .cp-ov-edge"));
    report.zoomedIn = { zoom: Math.round(view.k * 100) / 100, heads: $("cp-root").classList.contains("ov-heads"), markerEnd: zoomed.markerEnd };
    // Hovering a module lights its lines: they become fully visible, the others stay faint.
    const box = document.querySelector("#world rect.cp-ov-module");
    box.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    await osWait(400);
    const lit = [...document.querySelectorAll("#world .cp-ov-edge.nt-lit")];
    report.lit = { count: lit.length, strokeOpacity: lit[0] ? getComputedStyle(lit[0]).strokeOpacity : null, others: getComputedStyle(document.querySelector("#world .cp-ov-edge:not(.nt-lit)")).strokeOpacity };
  } catch (e) { report.errors.push(String((e && e.stack) || e)); }
  const out = document.createElement("pre");
  out.id = "os-report";
  out.textContent = JSON.stringify(report);
  document.body.append(out);
})();
