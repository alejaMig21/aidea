// The plugin side of the window (ADR 0008, docs/plugin-api.md): loads the interface half of each active plugin, offers it the named slots the rest of the page
// declares (pluginSlotDeclare), and undoes everything a plugin added when it is disabled. Names are prefixed "plugin" because every feature file shares one global scope.
const pluginsServed = (() => {
  try { return JSON.parse(decodeURIComponent(document.querySelector('meta[name="aidea-plugins"]')?.content ?? "") || "[]"); } catch { return []; }
})();
const pluginSlots = {}; // slot name -> { add(entry, owner) -> remove }, declared by the code that owns the slot
const pluginLoaded = new Map(); // plugin id -> the function that undoes its interface half
let pluginPending = pluginsServed.length; // interface halves still to activate at the start of the page
const pluginStartWaiters = [];

// Runs `fn` now, or, when plugin interface halves are still being activated at the start of the page, as soon as they are (the Layout is built after them).
function pluginsBeforeStart(fn) { if (pluginPending) pluginStartWaiters.push(fn); else fn(); }
function pluginSlotDeclare(name, slot) { pluginSlots[name] = slot; }

// The top bar: a plugin adds a control (a button, a status) next to the fixed ones. The entry is { id, render(container) -> dispose }.
pluginSlotDeclare("layout.topbar", {
  kind: "list",
  add(entry, owner) {
    if (!entry || typeof entry.id !== "string" || typeof entry.render !== "function") throw new Error('a top bar entry needs an "id" and a "render" function');
    const box = document.createElement("span");
    box.dataset.topbarPlugin = `${owner}.${entry.id}`;
    box.style.cssText = "display:inline-flex;align-items:center;gap:8px;min-width:0;max-width:460px;white-space:nowrap"; // the controls sit in a row with the bar's own gap, and a long message is cut
    document.getElementById("topbar-plugins").append(box);
    let dispose;
    try { dispose = entry.render(box); } catch (e) { box.remove(); throw e; }
    return () => { try { if (typeof dispose === "function") dispose(); } finally { box.remove(); } };
  },
});

function pluginReportFailure(id, reason) {
  fetch("/plugins/ui-state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, reason }) }).catch(() => {});
}

async function pluginUiActivate(id) {
  const removers = [];
  const undo = (returned) => () => {
    for (const remove of removers.splice(0).reverse()) { try { remove(); } catch { /* the rest still goes */ } }
    if (typeof returned === "function") { try { returned(); } catch { /* the plugin is gone anyway */ } }
  };
  const ui = {
    plugin: { id },
    // A named call to the host half of this plugin; resolves with its answer or rejects with its message.
    // The id of the Project that is open now, or null.
    project: () => (typeof current === "undefined" ? null : current),
    // A question that needs a yes or a no, in the dialog of aidea (never the browser's): ui.confirm({ title, message?, lines?, accept?, cancel? }) resolves true or false.
    confirm: (options) => dialogConfirm(options),
    // A named call to the host half of this plugin, or of another one (`plugin`); resolves with its answer or rejects with its message.
    async call(name, body = {}, plugin = id) {
      const res = await fetch(`/plugins/${encodeURIComponent(plugin)}/call/${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const answer = await res.json().catch(() => null);
      if (!res.ok) throw new Error(answer?.error ?? `the call "${name}" failed (${res.status})`);
      return answer;
    },
    slots: {
      add(slot, entry) {
        const declared = pluginSlots[slot];
        if (!declared) throw new Error(`the slot "${slot}" does not exist`);
        const remove = declared.add(entry, id);
        removers.push(remove);
        return remove;
      },
    },
  };
  try {
    const mod = await import(`/plugins/${encodeURIComponent(id)}/ui`);
    if (typeof mod.activate !== "function") throw new Error('the interface half must export an "activate" function');
    pluginLoaded.set(id, undo(await mod.activate(ui)));
  } catch (e) {
    undo()(); // whatever it added before failing leaves the screen
    pluginReportFailure(id, `interface half: ${e?.message ?? e}`);
  }
}

// Puts the window in step with the plugins that are active now: loads the interface half of new ones, undoes the ones that went.
async function pluginsSync() {
  const { plugins } = await (await fetch("/plugins")).json();
  const want = new Set(plugins.filter((p) => p.state === "active" && p.ui).map((p) => p.id));
  for (const [id, undo] of [...pluginLoaded]) if (!want.has(id)) { pluginLoaded.delete(id); undo(); }
  for (const id of want) if (!pluginLoaded.has(id)) await pluginUiActivate(id);
}

if (pluginPending) {
  // After every script of the page has run, so the slots are declared before a plugin asks for one.
  document.addEventListener("DOMContentLoaded", async () => {
    for (const { id } of pluginsServed) await pluginUiActivate(id);
    pluginPending = 0;
    for (const fn of pluginStartWaiters.splice(0)) fn();
  });
}
