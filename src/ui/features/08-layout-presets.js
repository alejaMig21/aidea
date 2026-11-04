// Layout presets (layout-and-data 09): the Panels menu also lists layouts. Three are built into aidea (Default, Classic IDE, Canvas only) and are built here from the registry of Panels;
// the person's own are the state of the Layout saved under a name (the core keeps them in the per-user preferences, never in a Project). The person may also choose that a Layout is
// remembered for each Project instead of one shared by all. 07-layout.js owns the Layout (layoutCapture, layoutUse); this file is the menu rows and the dialogs around them.
// Names are prefixed "layout" because every feature file shares one global scope.
let layoutPresetRows; // the rows below the Panels in the menu (07-layout.js asks for them when it builds the menu)
{
  const info = (() => { try { return JSON.parse(decodeURIComponent(document.querySelector("meta[name=aidea-presets]")?.content ?? "")) ?? {}; } catch { return {}; } })();
  const builtInNames = Array.isArray(info.names) ? info.names : ["Default", "Classic IDE", "Canvas only"];
  const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  let mine = isObject(savedServed.presets) ? { ...savedServed.presets } : {}; // the person's own, by name
  let scope = savedServed.layoutScope === "project" ? "project" : "shared";
  const projectLayouts = isObject(savedServed.projectLayouts) ? { ...savedServed.projectLayouts } : {}; // by the path of the Project

  // The built-ins are only which Panels are wanted: the arrangement is the default one. Panels that do not exist (the Terminal, when its plugin is off) are left out.
  const flags = (shown) => ({ canvasFolded: false, ...Object.fromEntries(layoutNames.map((n) => [`${n}Folded`, !shown(n)])) });
  const builtIn = {
    "Default": () => flags((n) => !layoutDef[n].startsHidden),
    "Classic IDE": () => flags((n) => ["chat", "files", "code", "terminal"].includes(n)), // Files, Code and the strip at the bottom; the Tutor and Playback away
    "Canvas only": () => flags(() => false),
  };

  const problem = (name, except) => {
    const text = name.trim();
    if (!text) return "Give the layout a name.";
    if (text.length > 40) return "Use at most 40 characters.";
    if (/[\u0000-\u001f\u007f]/.test(text)) return "Use letters, digits and punctuation only.";
    if (builtInNames.some((b) => b.toLowerCase() === text.toLowerCase())) return "That name belongs to a built-in layout. Choose another.";
    if (Object.keys(mine).some((k) => k !== except && k.toLowerCase() === text.toLowerCase())) return "A layout with that name already exists.";
    if (!(except in mine) && Object.keys(mine).length >= 20) return "You can keep up to 20 layouts. Delete one first.";
    return "";
  };
  const keepMine = () => { savedPut("presets", mine); panelsBuild(); };

  // Where the Layout is saved: the shared one, or the one of the Project that is open when the person chose a Layout for each Project.
  const projectKey = () => (typeof current !== "undefined" && current ? String(current) : null);
  layoutPersist = (state) => {
    const key = projectKey();
    if (scope === "project" && key) { projectLayouts[key] = state; savedPut("projectLayouts", projectLayouts); } else savedPut("layout", state);
  };
  // Opening a Project brings its own Layout back (when it has one and the person asked for that).
  document.addEventListener("project-opened", () => {
    const key = projectKey();
    if (scope !== "project" || !key) return;
    if (isObject(projectLayouts[key])) layoutUse(projectLayouts[key]); else layoutPersist(layoutCapture()); // a Project with no Layout of its own starts from the one on screen
  });

  const use = (state) => { layoutUse(state); layoutSave(); };

  // Dialog: the person's layouts, each with Rename and Delete.
  async function manage() {
    const list = Object.assign(document.createElement("div"), { className: "dialog-list" });
    const draw = () => {
      list.replaceChildren(...Object.keys(mine).map((name) => {
        const row = Object.assign(document.createElement("div"), { className: "dialog-item" });
        const label = Object.assign(document.createElement("span"), { textContent: name, title: name });
        label.dataset.presetName = "";
        const rename = Object.assign(document.createElement("button"), { type: "button", textContent: "Rename" });
        const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "Delete" });
        rename.onclick = async () => {
          const next = await dialogPrompt({ title: "Rename this layout", label: "New name", value: name, accept: "Rename", validate: (v) => problem(v, name) });
          if (next === null || next.trim() === name) return;
          const renamed = {};
          for (const [k, v] of Object.entries(mine)) renamed[k === name ? next.trim() : k] = v;
          mine = renamed;
          keepMine();
          draw();
        };
        remove.onclick = async () => {
          if (!(await dialogConfirm({ title: `Delete the layout "${name}"?`, message: "The arrangement saved under this name is lost. The window itself does not change.", accept: "Delete", cancel: "Cancel" }))) return;
          delete mine[name];
          keepMine();
          draw();
        };
        row.append(label, rename, remove);
        return row;
      }));
      if (!Object.keys(mine).length) list.append(Object.assign(document.createElement("p"), { className: "dialog-empty", textContent: "You have no layouts of your own yet." }));
    };
    draw();
    await dialogShow({ title: "Your layouts", body: list, buttons: [{ label: "Close", value: true, primary: true }], cancelValue: true });
  }

  async function saveAs() {
    const name = await dialogPrompt({ title: "Save this layout", label: "Name", accept: "Save", validate: (v) => problem(v, "") });
    if (name === null) return;
    const key = name.trim();
    const existing = Object.keys(mine).find((k) => k.toLowerCase() === key.toLowerCase());
    if (existing) delete mine[existing];
    mine[key] = layoutCapture();
    keepMine();
  }

  const menuRow = (label, props, onclick) => {
    const b = Object.assign(document.createElement("button"), { type: "button", tabIndex: -1 });
    b.setAttribute("role", props.role ?? "menuitem");
    Object.assign(b.dataset, props.data ?? {});
    if (props.checked !== undefined) b.setAttribute("aria-checked", String(props.checked));
    b.append(Object.assign(document.createElement("span"), { className: "check", textContent: "✓", ariaHidden: "true" }), Object.assign(document.createElement("span"), { className: "label", textContent: label }));
    if (props.role !== "menuitemcheckbox") b.querySelector(".check").style.visibility = "hidden"; // keeps the labels aligned with the Panels above
    b.onclick = () => { panelsClose(false); onclick(); };
    return b;
  };

  // The rows that panelsBuild (07-layout.js) puts below the Panels.
  layoutPresetRows = function () {
    const out = [];
    const sep = Object.assign(document.createElement("div"), { role: "separator" });
    const title = Object.assign(document.createElement("div"), { className: "menu-label", textContent: "Layouts" });
    out.push(sep, title);
    for (const name of builtInNames) if (builtIn[name]) out.push(menuRow(name, { data: { preset: name, kind: "built-in" } }, () => use(builtIn[name]())));
    for (const name of Object.keys(mine)) out.push(menuRow(name, { data: { preset: name, kind: "mine" } }, () => use(mine[name])));
    out.push(menuRow("Save this layout as…", { data: { action: "save" } }, saveAs));
    if (Object.keys(mine).length) out.push(menuRow("Your layouts…", { data: { action: "manage" } }, manage));
    out.push(menuRow("A layout for each Project", { role: "menuitemcheckbox", checked: scope === "project", data: { action: "scope" } }, () => {
      scope = scope === "project" ? "shared" : "project";
      savedPut("layoutScope", scope);
      if (scope === "project") layoutPersist(layoutCapture()); // this Project starts with the layout on screen
      panelsBuild();
    }));
    return out;
  };
  panelsBuild(); // now that the rows exist
}
