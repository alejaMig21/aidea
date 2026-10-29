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

function componentsLegend(unresolved) {
  const line = (d, extra = "") => `<path d="${d}" style="fill:none;stroke:var(--cp-line);stroke-width:1.4;${extra}"/>`;
  const grey = "stroke:var(--unresolved);";
  notationRegisterLegend("components", {
    shapes: [
      [notationSwatch(`<path d="M3 22V6H15V9H41V22z" style="fill:var(--panel);stroke:var(--control)"/>`), "Package: a module, holding its classes and functions", ".cp-pkg"],
      [notationSwatch(`<rect x="3" y="2" width="38" height="20" rx="3" style="fill:var(--raised);stroke:var(--control)"/><path d="M3 9H41M3 15H41" style="stroke:var(--control)"/>`), "Class: name, attributes, methods", ".cp-class"],
      [notationSwatch(`<rect x="3" y="6" width="38" height="12" rx="3" style="fill:var(--raised);stroke:var(--control)"/>`), "Function: a small box inside its package", ".cp-func"],
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
    ],
  });
  notationRenderLegend();
}

// Draws the whole layer into `world`. `layout` is the core's answer, `nodes` the Project's Nodes.
function componentsDraw(world, nodes, layout, unresolved) {
  const at = new Map(layout.rects.map((r) => [r.id, r]));
  const node = new Map(nodes.map((n) => [n.id, n]));

  for (const m of nodes.filter((n) => n.kind === "module")) {
    const r = at.get(m.id);
    const pkgName = componentsShort(m.name), pkgShown = componentsFit(pkgName, r.width - 24);
    const tabW = Math.min(r.width, pkgShown.length * 7.4 + 32);
    world.append(
      el("rect", { x: r.x, y: r.y + 14, width: r.width, height: r.height - 14, rx: 8, class: "cp-pkg", "data-id": m.id, "data-ref": m.id }),
      el("rect", { x: r.x, y: r.y, width: tabW, height: 28, rx: 6, class: "cp-tab", "data-id": m.id, "data-ref": m.id }),
      componentsTip(el("text", { x: r.x + 12, y: r.y + 19, class: "cp-pkg-name", "data-ref": m.id }, pkgShown), pkgName, pkgShown),
    );
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
  componentsLegend(unresolved);
}

componentsLegend(0);
