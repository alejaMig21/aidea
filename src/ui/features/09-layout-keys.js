// Layout and keyboard (layout-and-data 11), built on top of the docking library (ADR 0007): F6 moves between Panels, Tab walks them in the order they are on screen, the borders between
// Panels are separators that the arrow keys move, and a Panel is moved with Alt+Shift and the arrows. Every move is announced in a live region. The keys are written in the Panels menu.
// The library already gives its tabs the roles of a tab list (role, aria-selected, one tab stop in each group). Names are prefixed "keys" because every feature file shares one global scope.
{
  const live = Object.assign(document.createElement("div"), { id: "layout-live", role: "status" });
  live.setAttribute("aria-live", "polite");
  live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
  document.body.append(live);
  const say = (text) => { live.textContent = text; };

  const style = document.createElement("style");
  style.textContent = `
    /* The focus ring of the shared scale on a tab and on a border (the library draws none of its own; the Canvas' card has no white outline). */
    .dockview-theme-aidea .dv-tab:focus-visible { outline: 2px solid var(--accent) !important; outline-offset: -2px !important; }
    .dockview-theme-aidea .dv-groupview:focus-visible { outline: 2px solid var(--accent) !important; outline-offset: -2px !important; }
    .dockview-theme-aidea .dv-sash[role="separator"]:focus-visible { outline: none !important; background: var(--accent) !important; }
    #panels-menu .menu-note { padding: 6px 10px 4px; font-size: 12px; line-height: 1.5; color: var(--muted); }
  `;
  document.head.append(style);

  const title = (id) => (id === "canvas" ? "Canvas" : layoutDef[id]?.title ?? id);
  const rect = (g) => g.element.getBoundingClientRect();
  // The groups on screen, left to right and top to bottom.
  const groups = () => layoutApi.groups.filter((g) => g.panels.length).sort((a, b) => rect(a).left - rect(b).left || rect(a).top - rect(b).top);
  const tabOf = (g) => g.element.querySelector('.dv-tab[tabindex="0"]') ?? g.element.querySelector(".dv-tab");
  const panelOf = (g) => g.activePanel ?? g.panels[0];
  const bodyOf = (g) => { const p = panelOf(g); return p ? layoutEl(p.id) : null; };
  const groupOf = (el) => el && groups().find((g) => g.element.contains(el) || bodyOf(g)?.contains(el));
  const groupTitle = (g) => g.panels.map((p) => title(p.id)).join(" and ");

  // ---- F6 and Shift+F6: the next and the previous Panel, in screen order, wrapping. The focus lands on the Panel's tab (its name), from where Tab goes into it.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "F6" || e.altKey || e.ctrlKey || e.metaKey) return;
    const all = groups();
    if (!all.length) return;
    e.preventDefault();
    const at = all.indexOf(groupOf(document.activeElement));
    const next = all[at === -1 ? (e.shiftKey ? all.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + all.length) % all.length];
    tabOf(next)?.focus();
    say(groupTitle(next));
  }, true);

  // ---- Tab: the library puts every tab first and the contents of the Panels after them (they are drawn apart), which is not the order on screen. Inside the dock the walk is
  // rebuilt: for each group in screen order its tab, what is in it, then the border after it. At either end the browser carries on (to the top bar, or out of the page).
  const sashes = () => [...layoutDock.querySelectorAll('.dv-sash[role="separator"]')];
  const focusable = (root) => [...root.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex]")]
    .filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest("[hidden], [inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
  function stops() {
    const out = [];
    for (const g of groups()) {
      const tab = tabOf(g), body = bodyOf(g);
      if (tab) out.push(tab);
      if (body) out.push(...focusable(body));
      out.push(...sashes().filter((s) => s.dataset.after === String(g.id)));
    }
    return out;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
    const all = stops(), at = all.indexOf(document.activeElement);
    if (at === -1) return; // not in the dock (a menu, the top bar, a dialog): the browser decides
    const next = all[at + (e.shiftKey ? -1 : 1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
  }, true);

  // ---- The borders between Panels. The library draws them as 4px bars with no role; each one becomes a separator with a name and a value (the size of the Panel before it), reached by
  // the walk above and moved with the arrow keys: 20px a step, 100 with Shift, Home and End to the ends. Never past the smallest size a Panel has.
  const minOf = (g, horizontal) => Math.max(...g.panels.map((p) => (horizontal ? layoutMinHeight : p.id === "canvas" ? layoutCanvasMin : layoutDef[p.id]?.min ?? 240)));
  function decorate() {
    const all = groups();
    const near = (a, b) => Math.abs(a - b) <= 12;
    for (const s of layoutDock.querySelectorAll(".dv-sash")) {
      const r = s.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const horizontal = r.width > r.height; // a bar lying across the window resizes heights
      const overlap = (g) => (horizontal ? rect(g).left < r.right && rect(g).right > r.left : rect(g).top < r.bottom && rect(g).bottom > r.top);
      const before = all.find((g) => overlap(g) && near(horizontal ? rect(g).bottom : rect(g).right, horizontal ? r.top : r.left));
      const after = all.find((g) => overlap(g) && near(horizontal ? rect(g).top : rect(g).left, horizontal ? r.bottom : r.right));
      if (!before || !after) { s.removeAttribute("role"); continue; }
      const size = (g) => Math.round(horizontal ? rect(g).height : rect(g).width);
      s.setAttribute("role", "separator");
      s.setAttribute("tabindex", "-1"); // reached by the walk above, not by the browser's own Tab order
      s.setAttribute("aria-orientation", horizontal ? "horizontal" : "vertical");
      s.setAttribute("aria-label", `Resize ${groupTitle(before)} and ${groupTitle(after)}`);
      // How far the border can go each way: what the Panel before it can give up, and what the one after it can, down to the least size the library keeps it at. A group at the edge of the
      // window is drawn 5px narrower than the library's own number (it gives up part of its margin), so its least drawn size is that much smaller.
      const edge = (g) => (horizontal ? rect(g).top <= layoutDock.getBoundingClientRect().top + layoutGap + 1 || rect(g).bottom >= layoutDock.getBoundingClientRect().bottom - layoutGap - 1 : rect(g).left <= layoutGap + 1 || rect(g).right >= layoutDock.getBoundingClientRect().right - layoutGap - 1);
      const least = (g) => (horizontal ? g.minimumHeight : g.minimumWidth) - (edge(g) ? 5 : 0);
      const room = (g) => Math.max(0, size(g) - (Number.isFinite(least(g)) ? least(g) : minOf(g, horizontal)));
      s.setAttribute("aria-valuemin", String(size(before) - room(before)));
      s.setAttribute("aria-valuemax", String(size(before) + room(after)));
      s.setAttribute("aria-valuenow", String(size(before)));
      s.dataset.after = String(before.id);
    }
  }
  let decorateQueued = false;
  const refresh = () => { if (decorateQueued) return; decorateQueued = true; requestAnimationFrame(() => { decorateQueued = false; decorate(); }); };
  new MutationObserver(refresh).observe(layoutDock, { childList: true, subtree: true }); // sashes come and go with the arrangement
  layoutApi.onDidLayoutChange(refresh);
  window.addEventListener("resize", refresh);
  refresh();

  layoutDock.addEventListener("keydown", (e) => {
    const s = e.target.closest?.('.dv-sash[role="separator"]');
    if (!s || e.altKey || e.ctrlKey || e.metaKey) return;
    const horizontal = s.getAttribute("aria-orientation") === "horizontal";
    const [less, more] = horizontal ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const min = Number(s.getAttribute("aria-valuemin")), max = Number(s.getAttribute("aria-valuemax")), now = Number(s.getAttribute("aria-valuenow"));
    const step = e.shiftKey ? 100 : 20;
    const want = e.key === less ? now - step : e.key === more ? now + step : e.key === "Home" ? -1e5 : e.key === "End" ? 1e5 : null;
    if (want === null) return;
    e.preventDefault();
    const g = groups().find((x) => String(x.id) === s.dataset.after);
    if (!g) return;
    layoutTouched = true; // the sizes the person made are kept from now on
    // The move is a drag of the border, made with the same pointer events a mouse makes: the library then moves the two Panels beside it by the same amount, keeps each above its least
    // size and gives the rest to nobody else. (Its own setSize shares the difference among all the other groups.) Home and End are a drag as far as it can go.
    const by = want === -1e5 || want === 1e5 ? want : Math.max(min - now, Math.min(max - now, want - now));
    const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const pointer = (type, dx, dy) => new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x + dx, clientY: y + dy, pointerId: 1, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, isPrimary: true });
    s.dispatchEvent(pointer("pointerdown", 0, 0));
    s.dispatchEvent(pointer("pointermove", horizontal ? 0 : by, horizontal ? by : 0));
    s.dispatchEvent(pointer("pointerup", horizontal ? 0 : by, horizontal ? by : 0));
    decorate();
    say(`${s.getAttribute("aria-label")}: ${s.getAttribute("aria-valuenow")} pixels.`);
  });

  // ---- Moving a Panel from the keyboard, with the focus on its tab or inside it. Alt+Shift+Arrow: to the other side of the Panel next to it in that direction. Alt+Shift+Enter: into the
  // tabs of the Panel on its left (else on its right). The Canvas is never put in tabs and nothing is put in tabs with the Canvas.
  const sides = { ArrowLeft: ["left", "left"], ArrowRight: ["right", "right"], ArrowUp: ["top", "above"], ArrowDown: ["bottom", "below"] };
  function neighbour(g, direction) {
    const r = rect(g), gap = layoutGap + 6;
    const rows = (o) => rect(o).top < r.bottom && rect(o).bottom > r.top, cols = (o) => rect(o).left < r.right && rect(o).right > r.left;
    const pool = groups().filter((o) => o !== g);
    if (direction === "left") return pool.filter((o) => rows(o) && rect(o).right <= r.left + gap).sort((a, b) => rect(b).right - rect(a).right)[0];
    if (direction === "right") return pool.filter((o) => rows(o) && rect(o).left >= r.right - gap).sort((a, b) => rect(a).left - rect(b).left)[0];
    if (direction === "above") return pool.filter((o) => cols(o) && rect(o).bottom <= r.top + gap).sort((a, b) => rect(b).bottom - rect(a).bottom)[0];
    return pool.filter((o) => cols(o) && rect(o).top >= r.bottom - gap).sort((a, b) => rect(a).top - rect(b).top)[0];
  }
  const hasCanvas = (g) => g.panels.some((p) => p.id === "canvas");
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || layoutNarrow) return;
    const side = sides[e.key];
    if (!side && e.key !== "Enter") return;
    const from = groupOf(document.activeElement);
    if (!from) return;
    e.preventDefault();
    const panel = panelOf(from), name = title(panel.id);
    const done = (text) => { say(text); setTimeout(() => { const g = groups().find((x) => x.panels.some((p) => p.id === panel.id)); if (g) tabOf(g)?.focus(); }, 0); };
    layoutBusy = true; // the library's own move is not a Panel dragged out of the Layout
    try {
      if (side) {
        const to = neighbour(from, side[1]);
        if (!to) return say(`There is no Panel ${side[1] === "above" || side[1] === "below" ? side[1] : `to the ${side[1]}`} of ${name}.`);
        panel.api.moveTo({ group: to, position: side[0] });
        done(`Moved ${name} to the ${side[0] === "top" ? "top" : side[0] === "bottom" ? "bottom" : side[0]} of ${groupTitle(to)}.`);
      } else {
        if (panel.id === "canvas") return say("The Canvas stays on its own: it is never put in tabs.");
        const options = [neighbour(from, "left"), neighbour(from, "right")].filter(Boolean);
        const to = options.find((o) => !hasCanvas(o));
        if (!to) return say(options.length ? "The Canvas stays on its own: nothing is put in tabs with it." : `There is no Panel to put ${name} in the tabs of.`);
        panel.api.moveTo({ group: to, position: "center" });
        done(`Moved ${name} into the tabs of ${groupTitle(to)}.`);
      }
    } finally { layoutBusy = false; }
    layoutSave();
    refresh();
  }, true);

  // ---- The keys, written down where the person looks for the Panels.
  const rowsBefore = layoutPresetRows;
  layoutPresetRows = function () {
    const note = Object.assign(document.createElement("div"), { className: "menu-note", textContent: "Keys: F6 and Shift+F6 move between Panels; Tab walks them in screen order. On a border the arrow keys resize it (Shift: 100 px; Home and End: to the ends). On a Panel's tab, Alt+Shift+Arrows move the Panel, and Alt+Shift+Enter puts it in the tabs of its neighbour." });
    const sep = Object.assign(document.createElement("div"), { role: "separator" });
    return [...(rowsBefore ? rowsBefore() : []), sep, note];
  };
  panelsBuild();
}
