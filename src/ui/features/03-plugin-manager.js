// The plugin manager screen (part of the kernel, ADR 0008): drawn like the list of extensions of a code editor, which developers already know. A search box, a section for the plugins
// that are installed and one for those waiting in the quarantine (each with a count), and for each plugin an icon, its name, one line about it and who made it, with its actions.
// Installing needs a confirmation that names each blocking finding. Names are prefixed "pm" because every feature file shares one global scope.
const pmButton = document.getElementById("plugins-button");
const pmBox = Object.assign(document.createElement("section"), { id: "plugins-manager", hidden: true, tabIndex: -1 });
pmBox.setAttribute("role", "dialog");
pmBox.setAttribute("aria-label", "Plugins");

{
  const style = document.createElement("style");
  style.textContent = `
    #plugins-manager { position: fixed; top: 51px; right: 8px; z-index: 120; /* above the dock sashes (dockview gives them 99) */ width: min(480px, calc(100vw - 16px)); max-height: calc(100vh - 67px); overflow: auto; box-sizing: border-box; padding: 12px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(0, 0, 0, .5); font-family: var(--sans); font-size: 13px; }
    #plugins-manager[hidden] { display: none; }
    #plugins-manager h2 { margin: 0 0 8px; font-size: 13.5px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--text); }
    #plugins-manager p { margin: 0; }
    #plugins-manager .pm-meta { color: var(--muted); font-size: 12px; }
    #pm-message { min-height: 1.2em; margin-bottom: 6px; color: var(--accent-soft); font-size: 12px; }
    #pm-search { box-sizing: border-box; width: 100%; margin: 0 0 8px; padding: 6px 10px; background: var(--bg); color: var(--text); border: 1px solid var(--control); border-radius: 6px; font-size: 13px; }
    #plugins-manager .pm-section { display: flex; align-items: center; gap: 6px; width: 100%; margin: 6px 0 2px; padding: 4px 2px; background: transparent; border: 0; color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; cursor: pointer; text-align: left; }
    #plugins-manager .pm-chevron { display: inline-block; width: 12px; font-size: 12px; transition: transform .12s; }
    #plugins-manager .pm-section[aria-expanded="false"] .pm-chevron { transform: rotate(-90deg); }
    #plugins-manager .pm-count { min-width: 18px; padding: 0 6px; border-radius: 9px; background: var(--raised); color: var(--label); font-size: 11px; line-height: 18px; text-align: center; letter-spacing: 0; }
    #plugins-manager .pm-row { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 10px; padding: 8px; border-radius: 8px; }
    #plugins-manager .pm-row[hidden] { display: none; }
    #plugins-manager .pm-row:hover { background: var(--raised); }
    #plugins-manager .pm-icon { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 8px; background: var(--raised); color: var(--accent-soft); font-size: 18px; font-weight: 600; }
    #plugins-manager .pm-row:hover .pm-icon { background: var(--panel); }
    #plugins-manager .pm-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    #plugins-manager .pm-title-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
    #plugins-manager .pm-title { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #plugins-manager .pm-desc { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #plugins-manager .pm-meta-line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 0; flex-wrap: wrap; }
    #plugins-manager .pm-publisher { color: var(--label); }
    #plugins-manager .pm-badge { flex: none; padding: 0 6px; border-radius: 8px; border: 1px solid var(--line); font-size: 11px; line-height: 16px; color: var(--label); }
    #plugins-manager .pm-badge[data-kind="warn"] { color: var(--authored); border-color: var(--authored); }
    #plugins-manager .pm-badge[data-kind="bad"] { color: var(--danger); border-color: var(--danger); }
    #plugins-manager .pm-source { font: 11.5px var(--mono); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #plugins-manager ul { margin: 6px 0; padding-left: 18px; }
    #plugins-manager ul:empty { display: none; }
    #plugins-manager li[data-severity="block"] { color: var(--danger); }
    #plugins-manager li[data-severity="warn"] { color: var(--authored); }
    #plugins-manager button { padding: 3px 10px; font-size: 12px; background: transparent; color: var(--text); border: 1px solid var(--control); }
    #plugins-manager button.pm-install { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
    #plugins-manager button:disabled { opacity: .5; }
    #plugins-manager .pm-section:focus-visible, #plugins-manager button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    #plugins-manager input[type="text"], #plugins-manager input[type="password"], #plugins-manager input[type="number"], #plugins-manager select { box-sizing: border-box; width: 100%; padding: 4px 8px; background: var(--bg); color: var(--text); border: 1px solid var(--control); }
    #plugins-manager .pm-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    #plugins-manager .pm-add { padding: 4px 8px 8px; }
    #pm-empty { padding: 12px 8px; color: var(--muted); }
    #pm-empty[hidden] { display: none; }
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

// A section of the list: a header that folds its body away (the chevron turns), with a count of what it holds when `counted`.
function pmSection(key, label, body, counted = true) {
  const head = pmEl("button", { type: "button", className: "pm-section" }, pmEl("span", { className: "pm-chevron", textContent: "▾" }), pmEl("span", { textContent: label }), ...(counted ? [pmEl("span", { className: "pm-count" })] : []));
  head.dataset.section = key;
  head.setAttribute("aria-expanded", "true");
  head.onclick = () => {
    const open = head.getAttribute("aria-expanded") === "true";
    head.setAttribute("aria-expanded", String(!open));
    body.hidden = open;
  };
  return head;
}

const pmInstalledBox = pmEl("div", { id: "pm-installed" });
const pmQuarantineBox = pmEl("div", { id: "pm-quarantine" });
const pmAddBox = pmEl("div", { className: "pm-add" },
  pmEl("label", { htmlFor: "pm-source", className: "pm-meta" }, "The absolute path of a folder, or a Git link (https, ssh or file)"),
  pmEl("input", { id: "pm-source", type: "text", autocomplete: "off" }),
  pmEl("div", { className: "pm-actions" }, pmEl("button", { id: "pm-add", type: "button" }, "Add to the quarantine")),
  pmEl("p", { id: "pm-note", className: "pm-meta" }, "A plugin in the quarantine does not run. The scan lowers the risk and does not prove that a plugin is safe: read what it found before you install. After you install, a plugin runs with your own permissions."),
);
const pmSearch = pmEl("input", { id: "pm-search", type: "search", placeholder: "Search plugins", autocomplete: "off" });
pmSearch.setAttribute("aria-label", "Search plugins");

pmBox.append(
  pmEl("h2", {}, "Plugins"),
  pmEl("p", { id: "pm-message", role: "status" }),
  pmEl("p", { id: "pm-mode", className: "pm-meta" }),
  pmSearch,
  pmSection("installed", "Installed", pmInstalledBox),
  pmInstalledBox,
  pmEl("div", { className: "pm-actions" },
    Object.assign(pmEl("button", { type: "button", id: "pm-safe" }, "Restart in safe mode"), { title: "Start again with every plugin that does not ship with aidea switched off", onclick: () => (window.aidea?.restart ? window.aidea.restart(true) : pmMessage("Close aidea and open it with the --safe option.")) }),
    Object.assign(pmEl("a", { id: "pm-emergency", href: "/emergency" }, "Emergency screen"), { className: "pm-meta" })),
  pmSection("quarantine", "Waiting in the quarantine", pmQuarantineBox),
  pmQuarantineBox,
  pmEl("p", { id: "pm-empty", hidden: true }, "No plugin matches your search."),
  pmSection("add", "Add a plugin", pmAddBox, false),
  pmAddBox,
);
document.body.append(pmBox);

// What the search box narrows: a plugin matches by its name, id, publisher or description, in any case. The counts say how many are shown.
function pmFilter() {
  const query = pmSearch.value.trim().toLowerCase();
  for (const row of pmBox.querySelectorAll(".pm-row")) row.hidden = !!query && !(row.dataset.search ?? "").includes(query);
  for (const [key, box] of [["installed", pmInstalledBox], ["quarantine", pmQuarantineBox]]) pmBox.querySelector(`[data-section="${key}"] .pm-count`).textContent = String([...box.querySelectorAll(".pm-row")].filter((r) => !r.hidden).length);
  document.getElementById("pm-empty").hidden = !query || !!pmBox.querySelector(".pm-row:not([hidden])");
}
pmSearch.oninput = pmFilter;

// The icon of a plugin: the first letter of its name on a tile (plugins have no pictures of their own).
const pmIcon = (title) => pmEl("div", { className: "pm-icon", textContent: (title || "?").trim().charAt(0).toUpperCase() || "?", ariaHidden: "true" });
const pmBadge = (text, kind) => { const badge = pmEl("span", { className: "pm-badge", textContent: text }); badge.dataset.kind = kind; return badge; };
const pmSearchText = (...parts) => parts.filter(Boolean).join(" ").toLowerCase();

function pmQuarantineRow(entry) {
  const manifest = entry.report.manifest;
  const row = pmEl("div", { className: "pm-row" });
  row.dataset.qId = entry.id;
  row.dataset.qTitle = manifest?.title ?? "Invalid plugin";
  row.dataset.search = pmSearchText(manifest?.title, manifest?.id, manifest?.publisher, manifest?.description, entry.source);
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
    pmIcon(manifest?.title),
    pmEl("div", { className: "pm-body" },
      pmEl("div", { className: "pm-title-line" }, pmEl("span", { className: "pm-title" }, manifest?.title ?? "A plugin with an invalid manifest"), pmBadge(update ? "Update in quarantine" : "In quarantine", "warn")),
      pmEl("div", { className: "pm-desc", title: manifest?.description ?? "" }, manifest?.description ?? "It cannot be installed."),
      pmEl("div", { className: "pm-meta-line" }, ...(manifest ? [pmEl("span", { className: "pm-publisher" }, manifest.publisher), pmEl("span", { className: "pm-version" }, manifest.version), pmEl("span", {}, manifest.id)] : [])),
      pmEl("div", { className: "pm-source", title: entry.source }, entry.source),
      ...(update ? [pmEl("div", { className: "pm-meta", id: `pm-diff-${entry.id}` }, `Update from ${update.version.from} to ${update.version.to}. Files: ${update.files.added.length} added, ${update.files.removed.length} removed, ${update.files.changed.length} changed. New capabilities: ${update.capabilities.added.join(", ") || "none"}.`)] : []),
      findings,
      pmEl("div", { className: "pm-actions" }, install, discard),
    ),
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
  const row = pmEl("div", { className: "pm-row" });
  row.dataset.pluginId = p.id;
  row.dataset.state = p.state;
  row.dataset.search = pmSearchText(p.title, p.id, p.publisher, p.description);
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
  const holder = pmEl("div", { className: "pm-settings-holder" });
  if (p.settings) {
    const open = pmEl("button", { type: "button", className: "pm-settings-button" }, "Settings");
    open.onclick = () => (holder.firstChild ? holder.replaceChildren() : pmSettingsForm(p, holder));
    actions.prepend(open);
  }
  // A plugin that is running carries no mark (like an enabled extension); one that is not says why.
  const state = p.state === "active" ? [] : [pmBadge(p.state === "failed" || p.state === "incompatible" ? p.state : p.state === "inactive" && p.reason ? "Off" : p.state, p.state === "failed" || p.state === "incompatible" ? "bad" : "warn")];
  row.append(
    pmIcon(p.title),
    pmEl("div", { className: "pm-body" },
      pmEl("div", { className: "pm-title-line" }, pmEl("span", { className: "pm-title" }, p.title), ...state),
      pmEl("div", { className: "pm-desc", title: p.description ?? "" }, p.description ?? ""),
      pmEl("div", { className: "pm-meta-line" }, pmEl("span", { className: "pm-publisher" }, p.publisher ?? ""), pmEl("span", { className: "pm-version" }, p.version), pmEl("span", {}, p.id), ...(p.builtin ? [pmBadge("Ships with aidea", "plain")] : [])),
      ...(p.state !== "active" && p.reason ? [pmEl("div", { className: "pm-meta" }, p.reason)] : []),
      actions,
      holder,
    ),
  );
  return row;
}

async function pmRefresh() {
  const [{ body: list }, { body: waiting }] = await Promise.all([pmJson("GET", "/plugins"), pmJson("GET", "/plugins/quarantine")]);
  document.getElementById("pm-mode").textContent = list.safeMode ? "Safe mode is on: the plugins that do not ship with aidea are off. Restart aidea normally to use them." : "";
  pmInstalledBox.replaceChildren(...(list.plugins ?? []).map(pmInstalledRow));
  pmQuarantineBox.replaceChildren(...(waiting.entries ?? []).map(pmQuarantineRow));
  pmFilter();
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
