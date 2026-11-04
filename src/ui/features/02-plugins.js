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
