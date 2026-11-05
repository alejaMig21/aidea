// Components layer drawn UML-style: packages (a box with a tab) holding class boxes with three compartments and small
// function boxes, with relationships between them. The core says where everything sits and where every route runs
// (GET /layout?layer=components); this only draws it. All names here are prefixed "components" or "cp-".
//   Resolution decides the stroke: resolved solid, inferred dashed, unresolved grey dashed with "?" and never animated.
//   Resolved and inferred relationships flow in their direction and carry one message packet (the shared motion kit, 45-notation.js).
{
  const style = document.createElement("style");
  style.textContent = `
    :root { --cp-line: #8b95a8; }
    .cp-pkg { fill: color-mix(in srgb, var(--panel) 70%, transparent); stroke: var(--control); }
    .cp-tab { fill: var(--panel); stroke: var(--control); }
    rect[data-id].cp-hit { fill: transparent; stroke: none; cursor: pointer; }
    rect[data-id].cp-hit:hover { fill: color-mix(in srgb, var(--accent) 14%, transparent); }
    .cp-divider { stroke: var(--control); }
    .cp-pkg-name { font: 600 12px var(--mono); fill: var(--derived); }
    .cp-class-name { font: 600 13px var(--sans); }
    .cp-member { font: 400 12px var(--mono); fill: var(--label); }
    .cp-mark { fill: var(--muted); }
    .cp-abstract { font-style: italic; } .cp-static { text-decoration: underline; }
    .cp-label { font: 400 11px var(--mono); fill: var(--muted); }
    .cp-edge { stroke: var(--cp-line); stroke-width: 1.4; } .edge.cp-edge[data-tone="unresolved"] { stroke: var(--unresolved); }
    .cp-edge[data-kind="imports"] { stroke-dasharray: 6 4; }
    .cp-edge[data-resolution="inferred"] { stroke-dasharray: 6 4; }
    .cp-q { fill: var(--muted); font: 600 12px var(--mono); }
    /* Overview of a big project: a block per folder, a compact box per module, one faint line per pair (lit when its module is hovered or focused). */
    .cp-ov-folder { fill: color-mix(in srgb, var(--panel) 70%, transparent); stroke: var(--control); }
    .cp-ov-label { font: 600 13px var(--mono); fill: var(--derived); pointer-events: none; paint-order: stroke; stroke: var(--panel); stroke-linejoin: round; }
    /* Under Fit the boxes shrink but the folder names do not: componentsZoomed sizes them; a module name or its counts is drawn only when it would be 11px or more on screen. */
    #cp-root:not(.ov-names) .cp-ov-name, #cp-root:not(.ov-counts) .cp-ov-counts { display: none; }
    rect[data-id].cp-ov-module { cursor: pointer; } rect[data-id].cp-ov-module:is(:hover, :focus) { stroke: var(--accent); }
    .cp-ov-name { font: 600 13px var(--sans); pointer-events: none; } .cp-ov-counts { font: 400 12px var(--mono); fill: var(--muted); pointer-events: none; }
    /* The lines are faint by stroke-opacity, not opacity: an element with opacity under 1 is drawn on a layer of its own, and 400 of them made the overview slow to move (17 fps against 53). The arrowheads are drawn only from the zoom where they can be read (componentsZoomed). */
    .cp-ov-edge { fill: none; stroke: var(--cp-line); stroke-width: 1.4; stroke-opacity: .15; pointer-events: stroke; }
    #cp-root.ov-heads .cp-ov-edge { marker-end: url(#cp-open-base); }
    svg#canvas.nt-hl .cp-ov-edge:not(.nt-lit) { opacity: 1; stroke-opacity: .18; transition: stroke-opacity .2s; } svg#canvas.nt-hl .cp-ov-edge.nt-lit { stroke-opacity: 1; }
    .cp-ov-edge[data-kind="imports"], .cp-ov-edge[data-resolution="inferred"] { stroke-dasharray: 6 4; }
    .cp-imports { fill: var(--raised); stroke: var(--control); }
    .cp-import { fill: transparent; stroke: none; cursor: pointer; } .cp-import:is(:hover, :focus) { fill: color-mix(in srgb, var(--accent) 14%, transparent); }
    .cp-import-unresolved { cursor: help; } .cp-import-unresolved:hover { fill: transparent; }
    .cp-import-group { font: 600 11px var(--mono); fill: var(--muted); }
    .cp-ov-tests { stroke-dasharray: 6 4; cursor: pointer; } .cp-ov-tests:is(:hover, :focus) { stroke: var(--accent); }
    /* Keyboard focus keeps the shared outline (index.html :focus-visible); hover and focus only light the box. */
    #components-note { position: absolute; left: 15px; bottom: 15px; max-width: calc(100% - 210px); z-index: 1; padding: 6px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; font-size: 12px; color: var(--muted); }
    #components-note button { all: unset; cursor: pointer; color: var(--accent-soft); text-decoration: underline; } #components-note button:focus-visible { outline: 2px solid var(--accent); }
    #zoom #components-back { color: var(--text); font-weight: 500; }
  `;
  document.head.append(style);
  // Arrow heads, one per tone, so the head matches its line: a hollow triangle (inheritance) and an open arrow.
  const heads = el("defs", {});
  for (const tone of ["base", "unresolved"]) {
    const colour = tone === "base" ? "var(--cp-line)" : "var(--unresolved)";
    const marker = (id, path, fill) => {
      const m = el("marker", { id: `cp-${id}-${tone}`, viewBox: "0 0 12 12", refX: 11, refY: 6, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto" });
      m.append(el("path", { d: path, style: `fill:${fill};stroke:${colour};stroke-width:1.3;stroke-linejoin:round` }));
      return m;
    };
    heads.append(marker("tri", "M1 1.5L11 6L1 10.5z", "var(--canvas)"), marker("open", "M2 1.5L11 6L2 10.5", "none"));
  }
  svg.prepend(heads);
}

const componentsMarks = { public: "+", private: "-", special: "~" };
const componentsShort = (name) => name.split(".").pop();
// A name that does not fit its box is cut with an ellipsis and the whole name goes in the tooltip (about 7.4 px per character of the 12-13 px fonts).
const componentsFit = (text, room, char = 7.4) => notationClip(text, Math.max(3, Math.floor(room / char)));
const componentsTip = (t, full, shown) => (shown !== full && t.append(el("title", {}, full)), t);

function componentsLegend(unresolved, module = null) {
  const line = (d, extra = "") => `<path d="${d}" style="fill:none;stroke:var(--cp-line);stroke-width:1.4;${extra}"/>`;
  const grey = "stroke:var(--unresolved);";
  notationRegisterLegend("components", {
    shapes: [
      [notationSwatch(`<path d="M3 22V6H15V9H41V22z" style="fill:var(--panel);stroke:var(--control)"/>`), "Package: a module, holding its classes and functions", ".cp-pkg"],
      [notationSwatch(`<rect x="3" y="2" width="38" height="20" rx="3" style="fill:var(--raised);stroke:var(--control)"/><path d="M3 9H41M3 15H41" style="stroke:var(--control)"/>`), "Class: name, attributes, methods", ".cp-class"],
      [notationSwatch(`<rect x="3" y="6" width="38" height="12" rx="3" style="fill:var(--raised);stroke:var(--control)"/>`), "Function: a small box inside its package", ".cp-func"],
      ...(module ? [[notationSwatch(`<rect x="3" y="2" width="38" height="20" rx="3" style="fill:var(--raised);stroke:var(--control)"/><path d="M3 9H41" style="stroke:var(--control)"/><path d="M8 14H30M8 19H24" style="stroke:var(--label)"/>`), "Imports: the modules this module imports, one row each with its whole name. Click a row to open that module. A row with ? is a dynamic import that cannot be followed; its tooltip says why", ".cp-imports"]] : []),
      [notationSwatch(`<text x="2" y="16" style="fill:var(--label);font:12px var(--mono)">+ - ~</text>`), "Visibility: + public, - private, ~ special (dunder). Derived from the naming convention (underscores), not part of UML", ".cp-mark"],
      [notationSwatch(`<text x="2" y="16" style="fill:var(--label);font:12px var(--sans);text-decoration:underline">name</text>`), "Underlined: static or class method", ".cp-static"],
      [notationSwatch(`<text x="2" y="16" style="fill:var(--label);font:italic 12px var(--sans)">Name</text>`), "Italic: abstract class or method", ".cp-abstract"],
    ],
    arrows: [
      [notationSwatch(line("M2 12H30") + `<path d="M30 6L42 12L30 18z" style="fill:var(--canvas);stroke:var(--cp-line);stroke-width:1.3"/>`), "Inheritance: the hollow triangle points to the base class", '.cp-edge[data-kind="inherits"]'],
      [notationSwatch(line("M2 12H36", "stroke-dasharray:6 4") + line("M33 7L41 12L33 17")), "Import between packages, labelled import", '.cp-edge[data-kind="imports"]'],
      [notationSwatch(line("M2 12H36") + line("M33 7L41 12L33 17")), "A call. Solid: resolved, the target is certain; the dot travels in its direction", '.cp-edge[data-kind="calls"][data-resolution="resolved"]'],
      [notationSwatch(line("M2 12H36", "stroke-dasharray:6 4") + line("M33 7L41 12L33 17")), "Dashed: inferred, matched by name only (several classes may share it)", '.cp-edge[data-kind="calls"][data-resolution="inferred"]'],
      [notationSwatch(`<path d="M2 12H30" style="fill:none;${grey}stroke-width:1.4;stroke-dasharray:5 4"/><path d="M27 7L35 12L27 17" style="fill:none;${grey}stroke-width:1.4"/><text x="37" y="16" style="fill:var(--muted);font:600 12px var(--mono)">?</text>`), `Grey dashed with ?: unresolved, never animated. ${unresolved} in this Project. Python decides the target at run time (getattr, a function held in a variable), so aidea cannot say where it goes`, '.cp-edge[data-resolution="unresolved"]'],
    ],
    colours: [
      ["derived", "Teal: read from the code (package names)"],
      ["accent", "Blue: a call in flight, the dot that travels along a relationship"],
      ["unresolved", "Grey, dashed: unresolved, never moving"],
    ],
    notShown: [
      "Composition and aggregation are not inferred: guessing them from code gives too many false positives",
      "Calls to libraries and built-in functions are left out",
      "Nested functions are not Nodes: their calls count for the function around them",
      "A call from several methods of one class to another class is drawn once, between the two boxes",
      "Imports of modules outside the Project",
      "Calls made in a class body or in a decorator",
      "Aliases (f = g): a call through the new name is not followed to g; it shows as unresolved",
      ...(module ? ["The detail of one module: what leaves it is a short line labelled with the module it goes to; what comes into it from other modules, and calls to other modules matched by name only, are not drawn (open that module to see its side)"] : []),
    ],
  });
  notationRenderLegend();
}

// The legend of the overview of a big project: what it shows and, as plainly, what it leaves out.
function componentsOverviewLegend(pairs, unresolved, tests = null) {
  const line = (extra = "") => `<path d="M2 12H36" style="fill:none;stroke:var(--cp-line);stroke-width:1.4;${extra}"/><path d="M33 7L41 12L33 17" style="fill:none;stroke:var(--cp-line);stroke-width:1.4"/>`;
  notationRegisterLegend("components", {
    shapes: [
      [notationSwatch(`<rect x="2" y="2" width="40" height="20" rx="5" style="fill:var(--panel);stroke:var(--control)"/>`), "Folder: a block holding the modules of one folder, named by its path", ".cp-ov-folder"],
      [notationSwatch(`<rect x="3" y="5" width="38" height="14" rx="3" style="fill:var(--raised);stroke:var(--control)"/>`), "Module: one box with its name and how many classes and functions it holds. Double click it, or press Enter on it, to open its detail", ".cp-ov-module"],
      ...(tests && !tests.open ? [[notationSwatch(`<rect x="2" y="2" width="40" height="20" rx="5" style="fill:var(--panel);stroke:var(--control);stroke-dasharray:6 4"/>`), "Closed block: the folders named test, tests, fixtures or spec, folded into one. The line at the bottom says how many modules it holds and opens it", ".cp-ov-tests"]] : []),
    ],
    arrows: [
      [notationSwatch(line()), "A call or an import between two modules, one line per pair, with the arrow on the module that is used. Only the lines of the module under the pointer (or focused) are lit; the others are faint. Solid: calls; dashed: imports, or calls matched by name only", ".cp-ov-edge"],
    ],
    colours: [["derived", "Teal: folder paths, read from the code"]],
    notShown: [
      "Classes, methods and functions: open a module (All modules brings you back)",
      ...(tests && !tests.open ? [`${componentsPlural(tests.modules, "module")} of the test and fixture folders, and the ${componentsPlural(tests.pairs, "pair")} that touch them: closed, open the block to see them`] : []),
      pairs.total > pairs.shown ? `Only the ${pairs.shown} strongest of ${pairs.total} module pairs are drawn, to keep the picture smooth (a pair is two modules that talk to each other, drawn as one line); ${pairs.total - pairs.shown} lines are hidden. The note above draws more of them, and clicking a module draws every line it has` : `All ${pairs.total} module pairs are drawn`,
      `Relationships that cannot be followed (unresolved, ${unresolved} in this Project): they show in the detail of the module they leave`,
      "Imports of modules outside the Project, and calls to libraries and built-in functions",
      "Several relationships between the same two modules are one line (its tooltip says how many)",
    ],
  });
  notationRenderLegend();
}

// Draws the whole layer into `world` (one group, so it can be replaced alone). `layout` is the core's answer, `nodes` the Project's Nodes.
// A big project answers with mode "overview" (see componentsOverviewDraw); a small one, or one module of a big one, with "detail".
function componentsDraw(world, nodes, layout, unresolved, module = null) {
  world.querySelector(":scope > #cp-root")?.remove();
  const root = el("g", { id: "cp-root" });
  world.append(root);
  componentsNodes = nodes;
  componentsOpen = module;
  componentsMode = layout.mode ?? "detail";
  if (componentsMode === "overview") {
    componentsTestsOpen = !!layout.tests?.open;
    componentsOverviewDraw(root, nodes, layout);
    componentsOverviewLegend(layout.pairs, unresolved, layout.tests);
  } else {
    componentsDetailDraw(root, nodes, layout);
    componentsLegend(unresolved, module);
  }
  componentsPairs = layout.pairs ?? null;
  componentsTests = layout.tests ?? null;
  componentsChrome();
  notationUnlight(); // what was under the pointer is gone
  if ((componentsMode === "overview" || module) && authoredShown === "components") {
    $("zoom-fit").click();
    if (module && view.k < 0.6) { // a long module shrunk to fit is unreadable: start at its top at a readable size, Fit still frames all of it
      const b = notationBBox(), r = svg.getBoundingClientRect();
      view.k = 0.6; view.x = (r.width - b.width * 0.6) / 2 - b.x * 0.6; view.y = 130 - b.y * 0.6; apply();
    }
  }
}

function componentsDetailDraw(world, nodes, layout) {
  const at = new Map(layout.rects.map((r) => [r.id, r]));
  const node = new Map(nodes.map((n) => [n.id, n]));

  for (const m of nodes.filter((n) => n.kind === "module" && at.has(n.id))) {
    const r = at.get(m.id);
    const pkgName = componentsShort(m.name), pkgShown = componentsFit(pkgName, r.width - 24);
    const tabW = Math.min(r.width, pkgShown.length * 7.4 + 32);
    world.append(
      el("rect", { x: r.x, y: r.y + 14, width: r.width, height: r.height - 14, rx: 8, class: "cp-pkg", "data-id": m.id, "data-ref": m.id }),
      el("rect", { x: r.x, y: r.y, width: tabW, height: 28, rx: 6, class: "cp-tab", "data-id": m.id, "data-ref": m.id }),
      componentsTip(el("text", { x: r.x + 12, y: r.y + 19, class: "cp-pkg-name", "data-ref": m.id }, pkgShown), pkgName, pkgShown),
    );
  }

  // The "Imports" box of a module opened from the overview: one row per imported module, whole name, each opening that module.
  for (const [moduleId, block] of Object.entries(layout.imports ?? {})) {
    const box = at.get(block.box);
    world.append(
      el("rect", { x: box.x, y: box.y, width: box.width, height: box.height, rx: 6, class: "cp-imports", "data-ref": moduleId }),
      el("text", { x: box.x + box.width / 2, y: box.y + 20, "text-anchor": "middle", class: "cp-class-name", "data-ref": moduleId }, "Imports"),
      el("path", { d: `M${box.x} ${box.y + 30}H${box.x + box.width}`, class: "cp-divider", "data-ref": moduleId }),
    );
    for (const row of block.rows) {
      const r = at.get(row.id);
      if (row.group) { // a folder heading, when there are many imports
        world.append(el("text", { x: r.x + 10, y: r.y + 15, class: "cp-import-group", "data-ref": moduleId }, row.label));
        continue;
      }
      const open = row.target !== null, hint = open ? `${row.label}: click to open its detail` : row.why;
      const rect = el("rect", { x: r.x + 1, y: r.y, width: r.width - 2, height: r.height, rx: 4, class: open ? "cp-import" : "cp-import cp-import-unresolved", "data-ref": moduleId, ...(open ? { "data-import": row.target, tabindex: 0, role: "button", "aria-label": `Import ${row.label}. Press Enter to open it` } : {}) });
      rect.append(el("title", {}, hint));
      const text = el("text", { x: r.x + 10 + (open ? 0 : 14), y: r.y + 15, class: "cp-member", "data-ref": moduleId, "pointer-events": "none" }, row.label);
      world.append(rect, text);
      if (!open) world.append(el("text", { x: r.x + 10, y: r.y + 15, class: "cp-q", "data-ref": moduleId, "pointer-events": "none" }, "?"));
    }
  }

  for (const route of layout.routes) {
    const tone = route.resolution === "unresolved" ? "unresolved" : "base"; // only unresolved takes a tone: the rest is plain grey with accent packets
    const head = route.kind === "inherits" ? "tri" : "open";
    const path = el("path", {
      class: "edge cp-edge", d: route.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "),
      "data-kind": route.kind, "data-resolution": route.resolution, "data-ref": route.from, "data-ends": route.ends.join(" "),
      "marker-end": `url(#cp-${head}-${tone})`,
    });
    if (tone === "unresolved") path.setAttribute("data-tone", tone);
    const meaning = { resolved: "resolved", inferred: "inferred, matched by name only", unresolved: "unresolved, too dynamic to follow" }[route.resolution];
    path.append(el("title", {}, `${route.kind} ${route.name}${route.count > 1 ? ` (x${route.count})` : ""}: ${meaning}${route.external ? ", outside the Project" : ""}`));
    const moves = route.to !== null && route.resolution !== "unresolved";
    if (moves) path.setAttribute("data-packets", 1); // one message per route, travelling source to target
    if (moves && (route.resolution === "inferred" || route.kind === "imports")) path.setAttribute("data-flow", "");
    world.append(path);
    if (route.label) {
      const stub = route.to === null;
      const text = stub ? notationClip(route.name, 12) : route.label.text;
      world.append(componentsTip(el("text", { x: route.label.x, y: route.label.y, class: "cp-label", "data-ref": route.from }, text), route.label.text, text));
      if (stub && route.resolution === "unresolved") {
        world.append(el("text", { x: route.label.x + text.length * 6.6 + 4, y: route.label.y, class: "cp-q", "data-ref": route.from }, "?"));
      }
    }
  }

  const row = (r, mark, label, cls, refId) => {
    const t = el("text", { x: r.x + 10, y: r.y + 15, class: `cp-member ${cls}`, "data-ref": refId });
    const shown = componentsFit(label, r.width - 20 - 2 * 7.4); // the mark and its space take two characters
    t.append(el("tspan", { class: "cp-mark" }, `${mark} `), document.createTextNode(shown));
    return componentsTip(t, label, shown);
  };

  for (const n of nodes.filter((x) => at.has(x.id) && x.kind !== "module" && (x.kind === "class" || node.get(x.parent)?.kind === "module"))) {
    const r = at.get(n.id);
    const isClass = n.kind === "class";
    world.append(el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: 6, class: isClass ? "cp-class" : "cp-func", "data-id": n.id, "data-ref": n.id }));
    const name = componentsShort(n.name);
    if (!isClass) {
      const full = `${componentsMarks[n.markers?.visibility ?? "public"]} ƒ ${name}()`, shown = componentsFit(full, r.width - 20);
      world.append(componentsTip(el("text", { x: r.x + 10, y: r.y + 19, class: `cp-member ${n.markers?.abstract ? "cp-abstract" : ""} ${n.markers?.static ? "cp-static" : ""}`, "data-ref": n.id }, shown), full, shown));
      continue;
    }
    const c = layout.compartments[n.id];
    const shownName = componentsFit(name, r.width - 20, 8.4); // the class name is semibold 13 px
    world.append(
      componentsTip(el("text", { x: r.x + r.width / 2, y: r.y + 20, "text-anchor": "middle", class: `cp-class-name ${n.markers?.abstract ? "cp-abstract" : ""}`, "data-ref": n.id }, shownName), name, shownName),
      el("path", { d: `M${r.x} ${c.attributes}H${r.x + r.width}M${r.x} ${c.methods}H${r.x + r.width}`, class: "cp-divider", "data-ref": n.id }),
    );
    for (const a of n.attributes ?? []) {
      const ar = at.get(`${n.id}#${a.name}`);
      const visibility = n.attributeVisibility?.[a.name] ?? "public";
      world.append(row(ar, componentsMarks[visibility], a.name, "", n.id));
    }
    for (const m of nodes.filter((x) => x.parent === n.id && x.kind === "function")) {
      const mr = at.get(m.id);
      world.append(el("rect", { x: mr.x + 1, y: mr.y, width: mr.width - 2, height: mr.height, rx: 4, class: "cp-hit", "data-id": m.id, "data-ref": m.id }));
      const label = m.markers?.property ? componentsShort(m.name) : `${componentsShort(m.name)}()`;
      world.append(row(mr, componentsMarks[m.markers?.visibility ?? "public"], label, `${m.markers?.abstract ? "cp-abstract" : ""} ${m.markers?.static ? "cp-static" : ""}`, n.id));
    }
  }
}

// ---- Overview of a big project (the core says mode "overview"): a block per folder, a box per module, one faint line per pair.
const componentsPlural = (n, word) => `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`;
function componentsOverviewDraw(world, nodes, layout) {
  const at = new Map(layout.rects.map((r) => [r.id, r]));
  for (const route of layout.routes) {
    const [a, c, b] = route.points;
    const path = el("path", {
      class: "cp-ov-edge", d: `M${a.x} ${a.y}Q${c.x} ${c.y} ${b.x} ${b.y}`, "data-kind": route.kind, "data-resolution": route.resolution,
      "data-ref": route.from, "data-ends": route.ends.join(" "),
    });
    path.append(el("title", {}, `${route.kind} ${route.name}${route.count > 1 ? ` (x${route.count})` : ""}: ${route.resolution}`));
    world.append(path);
  }
  const folderLabel = (r) => r.id === "tests:folded" ? `tests and fixtures: ${layout.tests.modules} hidden`
    : r.id.startsWith("folder:") ? (r.id.slice(7) === "." ? "(project root)" : r.id.slice(7)) : null;
  for (const r of layout.rects) {
    const label = folderLabel(r);
    if (!label) continue;
    const closed = r.id === "tests:folded";
    const block = el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: 8, class: closed ? "cp-ov-folder cp-ov-tests" : "cp-ov-folder",
      ...(closed ? { tabindex: 0, role: "button", "aria-label": `${label}. Double click it, or press Enter on it, to show them` } : {}) });
    block.append(el("title", {}, closed ? `${label}. Double click to show them` : label)); // the full name, when Fit cut it short
    world.append(block);
  }
  for (const m of nodes.filter((n) => n.kind === "module" && at.has(n.id))) {
    const r = at.get(m.id), c = layout.counts[m.id] ?? { classes: 0, functions: 0 };
    const name = componentsShort(m.name), counts = `${componentsPlural(c.classes, "class")} · ${componentsPlural(c.functions, "function")}`;
    const box = el("rect", {
      x: r.x, y: r.y, width: r.width, height: r.height, rx: 6, class: "cp-ov-module", "data-id": m.id, "data-ref": m.id,
      tabindex: 0, role: "button", "aria-label": `${m.name}, ${counts}. Press Enter to open it`,
    });
    box.append(el("title", {}, `${m.name}: ${counts}`));
    world.append(
      box,
      el("text", { x: r.x + 10, y: r.y + 24, class: "cp-ov-name", "data-ref": m.id }, componentsFit(name, r.width - 20, 8.4)),
      el("text", { x: r.x + 10, y: r.y + 43, class: "cp-ov-counts", "data-ref": m.id }, counts),
    );
  }
  for (const r of layout.rects) { // the folder names go last: under Fit they stand over the boxes, with a halo to stay readable
    const label = folderLabel(r);
    if (!label) continue;
    const t = el("text", { class: "cp-ov-label", "data-full": label, "data-w": r.width, "data-x": r.x, "data-y": r.y }, label);
    t.append(el("title", {}, label));
    world.append(t);
  }
  componentsZoomed(view.k, true);
}

// Zoom of the overview. The smallest text of the shared scale is 11px (ui-style.md): a folder name is always 13px on screen
// (the box shrinks, the name does not; it is cut to the width of its box), a module name or its counts is shown only from the zoom
// where it reaches 11px. Called by every zoom (00-canvas.js apply) and once after drawing; it reads the drawing, not the state of this file.
let componentsZoomK = 0;
function componentsZoomed(k, force = false) {
  const root = document.getElementById("cp-root");
  if (!root || (k === componentsZoomK && !force)) return;
  componentsZoomK = k;
  root.classList.toggle("ov-names", k * 13 >= 11);
  root.classList.toggle("ov-counts", k * 12 >= 11);
  root.classList.toggle("ov-heads", k * 12 >= 7); // an arrowhead is 12 px: drawn only when it would be 7 px or more on screen
  const kk = Math.min(k, 1);
  for (const t of root.querySelectorAll(".cp-ov-label")) {
    const d = t.dataset, room = d.w * kk - 12, full = d.full, shown = notationClip(full, Math.max(3, Math.floor(room / 7.9)));
    t.setAttribute("x", +d.x + 6 / kk);
    t.setAttribute("y", +d.y + 14 / kk);
    t.style.fontSize = `${13 / kk}px`;
    t.style.strokeWidth = `${5 / kk}px`;
    t.firstChild.textContent = shown;
  }
}

// What the overview and the detail of a module add to the Canvas: the "All modules" button (next to Fit) and the line about the pair cap.
let componentsNodes = [], componentsMode = "detail", componentsOpen = null, componentsPairs = null, componentsTests = null;
const componentsBack = Object.assign(document.createElement("button"), { type: "button", id: "components-back", textContent: "All modules", hidden: true });
componentsBack.setAttribute("aria-label", "Back to the overview of all modules");
$("zoom").prepend(componentsBack);
const componentsNote = Object.assign(document.createElement("div"), { id: "components-note", hidden: true });
document.querySelector("main").append(componentsNote);
function componentsChrome() {
  const here = authoredShown === "components";
  componentsBack.hidden = !(here && componentsOpen);
  const pairs = componentsPairs;
  componentsNote.hidden = !(here && componentsMode === "overview" && pairs);
  if (!pairs) return;
  const hidden = pairs.total - pairs.shown;
  const more = (label, cap) => Object.assign(document.createElement("button"), { type: "button", textContent: label, onclick: () => { componentsCap = cap; componentsLoad(null, componentsTestsOpen); } });
  componentsNote.replaceChildren(hidden > 0
    ? `Showing the ${pairs.shown} strongest of ${pairs.total} module pairs. A pair is two modules that talk to each other, drawn as one line; ${hidden} lines are not drawn so the picture stays smooth, strongest first. `
    : `${componentsPlural(pairs.total, "module pair")} drawn. `);
  if (hidden > 0) componentsNote.append(more(`Draw ${Math.min(400, hidden)} more`, pairs.cap + 400), " ", more(`Draw all ${pairs.total} (slower)`, "all"), " Click a module to draw every line it has. ");
  else if (componentsCap) componentsNote.append(more("Draw fewer", null), " ");
  if (componentsFocus) componentsNote.append(`Every line of ${componentsFocus} is drawn. `, Object.assign(document.createElement("button"), { type: "button", textContent: "clear", onclick: () => { componentsFocus = null; componentsLoad(null, componentsTestsOpen); } }), " ");
  const tests = componentsTests; // the test and fixture folders: said in words with their count, and one control to open or close them
  if (tests) {
    const toggle = Object.assign(document.createElement("button"), { type: "button", textContent: tests.open ? "hide" : "show" });
    toggle.onclick = () => componentsToggleTests();
    componentsNote.append(tests.open
      ? ` · includes ${componentsPlural(tests.modules, "test module")}, ${componentsPlural(tests.pairs, "pair")} touch them - `
      : ` · ${componentsPlural(tests.modules, "test module")} hidden (${componentsPlural(tests.pairs, "pair")} touch them, not counted above) - `, toggle);
  }
}
function componentsToggleTests() { return componentsLoad(null, !componentsTests?.open); }
const componentsShowLayerPlain = showLayer;
showLayer = (which) => { componentsShowLayerPlain(which); componentsChrome(); };

// Opens the detail of one module (id) or, with null, the overview again. Only the Components drawing is replaced.
// How many module pairs the overview draws (null: the default; a number; "all") and the module whose every line is drawn (big-projects 03). A different Project starts again.
let componentsCap = null, componentsFocus = null, componentsClickTimer = 0;
document.addEventListener("project-opened", () => { componentsCap = null; componentsFocus = null; });
async function componentsLoad(module, tests = false) {
  const project = current, started = performance.now();
  const more = module ? "" : (tests ? "&tests=1" : "") + (componentsCap ? `&pairs=${componentsCap}` : "") + (componentsFocus ? `&focus=${encodeURIComponent(componentsFocus)}` : "");
  const res = await fetch(`/layout?project=${encodeURIComponent(project)}&layer=components${module ? `&module=${encodeURIComponent(module)}` : more}`);
  const layout = await res.json();
  if (project !== current) return;
  $("error").textContent = res.ok ? "" : layout.error;
  if (!res.ok) return;
  componentsDraw($("world"), componentsNodes, layout, currentUnresolved, module);
  componentsLoaded = performance.now() - started; // read by the headless checks: the time to open a module
}
let componentsLoaded = 0;
let componentsTestsOpen = false; // whether the overview last drawn had the tests block open (a module's detail has no such block)
componentsBack.onclick = () => componentsLoad(null, componentsTestsOpen); // the tests block stays as the person left it in the overview
// A click on an import row of a module's detail opens that module (the same as double clicking its box in the overview).
// Read from pointerup like the Canvas does for selecting: the pointer is captured by the svg, so a click would not name the row.
let componentsDown = null;
svg.addEventListener("pointerdown", (e) => { componentsDown = [e.clientX, e.clientY]; });
svg.addEventListener("pointerup", (e) => {
  const moved = componentsDown && Math.hypot(e.clientX - componentsDown[0], e.clientY - componentsDown[1]) >= 4;
  componentsDown = null;
  const row = !moved && authoredShown === "components" ? document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-import]") : null;
  if (row) componentsLoad(row.dataset.import);
  // A click on a module of the overview draws every line it has (a second click, or a double click that opens it, undoes or replaces it).
  const box = !moved && !row && componentsMode === "overview" && authoredShown === "components" ? document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".cp-ov-module") : null;
  if (box) {
    clearTimeout(componentsClickTimer);
    componentsClickTimer = setTimeout(() => { componentsFocus = componentsFocus === box.dataset.id ? null : box.dataset.id; componentsLoad(null, componentsTestsOpen); }, 260);
  }
});
svg.addEventListener("dblclick", (e) => {
  const live = componentsMode === "overview" && authoredShown === "components";
  const box = live ? e.target.closest?.(".cp-ov-module") : null;
  if (box) { clearTimeout(componentsClickTimer); componentsLoad(box.dataset.id); }
  else if (live && e.target.closest?.(".cp-ov-tests")) componentsToggleTests();
});
svg.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.target.classList?.contains("cp-ov-module")) componentsLoad(e.target.dataset.id);
  else if (e.target.classList?.contains("cp-ov-tests")) componentsToggleTests();
  else if (e.target.dataset?.import) componentsLoad(e.target.dataset.import);
});
// A module that keeps the focus (after a click or Tab) keeps its lines lit when the pointer leaves the Canvas.
svg.addEventListener("pointerleave", () => { if (document.activeElement?.classList?.contains("cp-ov-module")) notationLight({ target: document.activeElement }); });

componentsLegend(0);
