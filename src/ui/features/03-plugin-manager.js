// The plugin manager screen (part of the kernel, ADR 0008): the plugins that are installed, the ones waiting in the quarantine with what the scan found, and a form to add
// one from a folder or a Git link. Installing needs a confirmation that names each blocking finding. Names are prefixed "pm" because every feature file shares one global scope.
const pmButton = document.getElementById("plugins-button");
const pmBox = Object.assign(document.createElement("section"), { id: "plugins-manager", hidden: true, tabIndex: -1 });
pmBox.setAttribute("role", "dialog");
pmBox.setAttribute("aria-label", "Plugins");

{
  const style = document.createElement("style");
  style.textContent = `
    #plugins-manager { position: fixed; top: 51px; right: 8px; z-index: 120; /* above the dock sashes (dockview gives them 99) */ width: min(560px, calc(100vw - 16px)); max-height: calc(100vh - 67px); overflow: auto; box-sizing: border-box; padding: 14px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); font-family: var(--sans); font-size: 13px; }
    #plugins-manager[hidden] { display: none; }
    #plugins-manager h2 { margin: 0 0 8px; font-size: 13.5px; font-weight: 600; }
    #plugins-manager h3 { margin: 14px 0 6px; font-size: 12px; font-weight: 600; color: var(--label); text-transform: uppercase; letter-spacing: .04em; }
    #plugins-manager .pm-row { padding: 8px 0; border-top: 1px solid var(--line); }
    #plugins-manager .pm-title { font-weight: 600; }
    #plugins-manager .pm-meta { color: var(--muted); }
    #plugins-manager ul { margin: 6px 0; padding-left: 18px; }
    #plugins-manager li[data-severity="block"] { color: var(--danger); }
    #plugins-manager li[data-severity="warn"] { color: var(--authored); }
    #plugins-manager button { padding: 4px 12px; font-size: 13px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #plugins-manager button:disabled { opacity: .5; }
    #plugins-manager input[type="text"] { box-sizing: border-box; width: 100%; padding: 4px 8px; background: var(--bg); color: var(--text); border: 1px solid var(--control); }
    #plugins-manager .pm-actions { display: flex; gap: 8px; margin-top: 6px; }
    #pm-message { min-height: 1.2em; color: var(--accent-soft); }
  `;
  document.head.append(style);
}

const pmEl = (tag, props = {}, ...children) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
};
const pmMessage = (text) => { document.getElementById("pm-message").textContent = text; };
const pmJson = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

pmBox.append(
  pmEl("h2", {}, "Plugins"),
  pmEl("p", { id: "pm-message", role: "status" }),
  pmEl("p", { id: "pm-mode", className: "pm-meta" }),
  pmEl("h3", {}, "Installed"),
  pmEl("div", { id: "pm-installed" }),
  pmEl("div", { className: "pm-actions" },
    Object.assign(pmEl("button", { type: "button", id: "pm-safe" }, "Restart in safe mode"), { title: "Start again with every plugin that does not ship with aidea switched off", onclick: () => (window.aidea?.restart ? window.aidea.restart(true) : pmMessage("Close aidea and open it with the --safe option.")) }),
    Object.assign(pmEl("a", { id: "pm-emergency", href: "/emergency" }, "Emergency screen"), { className: "pm-meta" })),
  pmEl("h3", {}, "Waiting in the quarantine"),
  pmEl("div", { id: "pm-quarantine" }),
  pmEl("h3", {}, "Add a plugin"),
  pmEl("label", { htmlFor: "pm-source", className: "pm-meta" }, "The absolute path of a folder, or a Git link (https, ssh or file)"),
  pmEl("input", { id: "pm-source", type: "text", autocomplete: "off" }),
  pmEl("div", { className: "pm-actions" }, pmEl("button", { id: "pm-add", type: "button" }, "Add to the quarantine")),
  pmEl("p", { id: "pm-note", className: "pm-meta" }, "A plugin in the quarantine does not run. The scan lowers the risk and does not prove that a plugin is safe: read what it found before you install. After you install, a plugin runs with your own permissions."),
);
document.body.append(pmBox);

function pmQuarantineRow(entry) {
  const manifest = entry.report.manifest;
  const row = pmEl("div", { className: "pm-row" });
  row.dataset.qId = entry.id;
  row.dataset.qTitle = manifest?.title ?? "Invalid plugin";
  const install = pmEl("button", { type: "button", className: "pm-install" }, "Install");
  const boxes = [];
  const findings = pmEl("ul");
  for (const f of entry.report.findings) {
    const li = pmEl("li", {});
    li.dataset.finding = f.id;
    li.dataset.severity = f.severity;
    if (f.severity === "block") {
      const box = pmEl("input", { type: "checkbox" });
      box.dataset.confirm = "";
      box.dataset.key = f.key;
      box.setAttribute("aria-label", `I have read this and I want to install anyway: ${f.message}`);
      box.onchange = sync;
      boxes.push(box);
      li.append(box, " ", f.message);
    } else li.append(f.message);
    findings.append(li);
  }
  function sync() { install.disabled = boxes.some((b) => !b.checked); }
  sync();
  // A new version of an installed plugin: what it changes, and "Update" in place of "Install". An earlier confirmation does not carry over: each blocking finding is confirmed again.
  const update = entry.update;
  if (update) install.textContent = "Update";
  install.onclick = async () => {
    install.disabled = true;
    const { status, body } = await pmJson("POST", update ? "/plugins/update" : "/plugins/install", { id: entry.id, confirm: boxes.filter((b) => b.checked).map((b) => b.dataset.key) });
    pmMessage(status === 200 ? (body.status === "failed" ? `${manifest.title} could not be installed: ${body.reason}` : body.status === "restart-required" ? `${manifest.title} is updated. Restart aidea to run the new version.` : `${manifest.title} is ${update ? "updated" : "installed"}.`) : body.error ?? "The install was refused.");
    if (status === 200) await pluginsSync(); // a new plugin is live at once
    await pmRefresh();
  };
  const discard = pmEl("button", { type: "button", className: "pm-discard" }, "Discard");
  discard.onclick = async () => { await pmJson("POST", "/plugins/quarantine/discard", { id: entry.id }); await pmRefresh(); };
  row.append(
    pmEl("div", { className: "pm-title" }, manifest?.title ?? "A plugin with an invalid manifest"),
    pmEl("div", { className: "pm-meta" }, manifest ? `${manifest.id} ${manifest.version} by ${manifest.publisher}. ${manifest.description}` : "It cannot be installed."),
    pmEl("div", { className: "pm-meta" }, entry.source),
    ...(update ? [Object.assign(pmEl("div", { className: "pm-meta", id: `pm-diff-${entry.id}` }, `Update from ${update.version.from} to ${update.version.to}. Files: ${update.files.added.length} added, ${update.files.removed.length} removed, ${update.files.changed.length} changed. New capabilities: ${update.capabilities.added.join(", ") || "none"}.`), { })] : []),
    findings,
    pmEl("div", { className: "pm-actions" }, install, discard),
  );
  if (!manifest) install.disabled = true;
  return row;
}

// What an operation of the manager answered (applied, failed, restart-required) as a sentence; a restart comes with its button.
function pmReport(what, body) {
  if (body.status === "restart-required") {
    pmMessage(`${what}. It needs a restart of aidea to be complete.`);
    const restart = pmEl("button", { type: "button", className: "pm-restart" }, "Restart aidea");
    restart.onclick = () => (window.aidea?.restart ? window.aidea.restart() : pmMessage("Close aidea and open it again."));
    document.getElementById("pm-message").append(" ", restart);
  } else pmMessage(body.status === "applied" ? `${what}.` : `${what} failed: ${body.reason ?? body.error ?? "unknown reason"}`);
}

// The settings form of a plugin, drawn from the schema in its manifest. Only valid values are saved: the core answers each bad field by name. A secret is never shown; leave it empty to keep it.
async function pmSettingsForm(p, holder) {
  const { body } = await pmJson("GET", `/plugins/${encodeURIComponent(p.id)}/settings`);
  const form = pmEl("form", { className: "pm-settings" });
  form.dataset.settingsFor = p.id;
  const inputs = {}, errors = {};
  for (const [key, field] of Object.entries(body.schema ?? {})) {
    const value = body.values[key];
    let input;
    if (field.type === "choice") {
      input = pmEl("select", {}, ...field.options.map((o) => pmEl("option", { value: o, textContent: o })));
      input.value = value;
    } else if (field.type === "boolean") input = Object.assign(pmEl("input", { type: "checkbox" }), { checked: value === true });
    else if (field.type === "number") input = pmEl("input", { type: "number", value: value ?? "" });
    else if (field.type === "secret") input = pmEl("input", { type: "password", autocomplete: "off", placeholder: value?.set ? "set (leave empty to keep it)" : "not set" });
    else input = pmEl("input", { type: "text", value: value ?? "" });
    input.name = key;
    input.id = `pm-set-${p.id}-${key}`;
    inputs[key] = input;
    errors[key] = pmEl("div", { className: "pm-meta" });
    errors[key].dataset.error = key;
    form.append(pmEl("label", { htmlFor: input.id, className: "pm-meta" }, field.label), input, errors[key]);
  }
  const save = pmEl("button", { type: "submit", className: "pm-save" }, "Save settings");
  form.append(pmEl("div", { className: "pm-actions" }, save));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const values = {};
    for (const [key, field] of Object.entries(body.schema)) {
      const input = inputs[key];
      if (field.type === "boolean") values[key] = input.checked;
      else if (field.type === "number") { if (input.value !== "") values[key] = Number(input.value); }
      else if (field.type === "secret") { if (input.value !== "") values[key] = input.value; }
      else values[key] = input.value;
    }
    const answer = await pmJson("POST", `/plugins/${encodeURIComponent(p.id)}/settings`, { values });
    for (const key of Object.keys(errors)) errors[key].textContent = answer.body.errors?.[key] ?? "";
    pmMessage(answer.status === 200 ? `The settings of ${p.title} are saved.` : "Nothing was saved: fix the fields marked below.");
    if (answer.status === 200) for (const [key, field] of Object.entries(body.schema)) if (field.type === "secret") { inputs[key].value = ""; inputs[key].placeholder = "set (leave empty to keep it)"; }
  };
  holder.replaceChildren(form);
}

function pmInstalledRow(p) {
  const row = pmEl("div", { className: "pm-row" }, pmEl("span", { className: "pm-title" }, p.title), " ", pmEl("span", { className: "pm-meta" }, `${p.id} ${p.version}${p.builtin ? " (ships with aidea)" : ""} - ${p.state}${p.reason ? `: ${p.reason}` : ""}`));
  row.dataset.pluginId = p.id;
  row.dataset.state = p.state;
  const act = async (path, body, what) => {
    const { body: answer } = await pmJson("POST", path, body);
    await pluginsSync(); // a Panel appears or goes at once
    await pmRefresh();
    pmReport(what, answer); // after the refresh, which does not touch the message
  };
  const actions = pmEl("div", { className: "pm-actions" });
  if (!p.required) {
    const on = p.state === "active";
    const toggle = pmEl("button", { type: "button", className: on ? "pm-disable" : "pm-enable" }, on ? "Switch off" : "Switch on");
    toggle.onclick = () => act(on ? "/plugins/disable" : "/plugins/enable", { id: p.id }, on ? `${p.title} is switched off` : `${p.title} is switched on`);
    const data = pmEl("input", { type: "checkbox" });
    data.dataset.deleteData = "";
    data.setAttribute("aria-label", `Also delete the data of ${p.title}`);
    const remove = pmEl("button", { type: "button", className: "pm-remove" }, "Remove");
    remove.onclick = () => act("/plugins/remove", { id: p.id, deleteData: data.checked }, `${p.title} is removed`);
    actions.append(toggle, remove, pmEl("label", { className: "pm-meta" }, data, " also delete its data"));
  } else actions.append(pmEl("span", { className: "pm-meta" }, "Required: it cannot be switched off or removed."));
  if (p.settings) {
    const holder = pmEl("div", { className: "pm-settings-holder" });
    const open = pmEl("button", { type: "button", className: "pm-settings-button" }, "Settings");
    open.onclick = () => (holder.firstChild ? holder.replaceChildren() : pmSettingsForm(p, holder));
    actions.prepend(open);
    row.append(actions, holder);
    return row;
  }
  row.append(actions);
  return row;
}

async function pmRefresh() {
  const [{ body: list }, { body: waiting }] = await Promise.all([pmJson("GET", "/plugins"), pmJson("GET", "/plugins/quarantine")]);
  document.getElementById("pm-mode").textContent = list.safeMode ? "Safe mode is on: the plugins that do not ship with aidea are off. Restart aidea normally to use them." : "";
  document.getElementById("pm-installed").replaceChildren(...(list.plugins ?? []).map(pmInstalledRow));
  document.getElementById("pm-quarantine").replaceChildren(...(waiting.entries ?? []).map(pmQuarantineRow));
}

document.getElementById("pm-add").onclick = async () => {
  const input = document.getElementById("pm-source");
  const { status, body } = await pmJson("POST", "/plugins/quarantine", { source: input.value.trim() });
  pmMessage(status === 201 ? "Added to the quarantine. Nothing of it runs." : body.error ?? "That could not be added.");
  if (status === 201) input.value = "";
  await pmRefresh();
};

function pmOpen() {
  pmBox.hidden = false;
  pmMessage("");
  pmBox.focus();
  pmRefresh();
}
function pmClose() {
  if (pmBox.hidden) return;
  pmBox.hidden = true;
  pmButton.focus();
}
// The Builder proposed a plugin (it is in the quarantine already): the manager opens so the person reads the scan and decides.
function pmProposed(event) {
  pmOpen();
  pmMessage(`The Builder proposed the plugin "${event.title}". Read what the scan found, then install it or discard it.`);
}
pmButton.onclick = () => (pmBox.hidden ? pmOpen() : pmClose());
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pmBox.hidden) pmClose(); });
