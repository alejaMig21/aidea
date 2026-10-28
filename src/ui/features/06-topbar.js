// Top bar: the Project switcher (current Project, recents, "Open folder...", a way back to Home).
// Names here are prefixed "switcher" because every feature file shares one global scope.
// Opening a Project reuses openProject() from the Canvas file; the recents come from the core (GET /recents).
const switcherButton = $("switcher-button");
const switcherMenu = $("switcher-menu");
const switcherList = $("switcher-list");

const closeSwitcher = () => { switcherMenu.hidden = true; switcherButton.setAttribute("aria-expanded", "false"); };

// The button says "Project <name>", or that none is open.
function setSwitcherName(name) {
  $("switcher-label").hidden = name === null;
  $("switcher-name").textContent = name ?? "No project open";
}
async function refreshSwitcherLabel() {
  if (!current || !$("home").hidden) { setSwitcherName(null); return; } // Home covers the Project
  const project = current;
  const list = await (await fetch("/projects")).json();
  if (project !== current || !$("home").hidden) return;
  const p = list.find((q) => q.id === project);
  setSwitcherName(p ? p.name : "unknown");
}

// "2 h ago", "Yesterday", "3 days ago": by calendar day once it is older than a day's worth of hours.
function switcherAgo(iso) {
  const then = new Date(iso), now = new Date();
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
  if (days < 1) return `${Math.floor(minutes / 60)} h ago`;
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

// One row of the popover: name over path, and a trailing detail (the dot for the current Project, the time for a recent one).
function switcherRow(name, path, onclick, { current: isHere, when, disabled } = {}) {
  const b = Object.assign(document.createElement("button"), { type: "button", className: "row", onclick, disabled: !!disabled });
  const text = Object.assign(document.createElement("span"), { className: "text" });
  text.append(Object.assign(document.createElement("strong"), { textContent: name }), Object.assign(document.createElement("span"), { className: "path", textContent: path }));
  if (isHere) {
    b.setAttribute("aria-current", "true");
    b.append(Object.assign(document.createElement("span"), { className: "dot" }), text);
  } else {
    b.append(text, Object.assign(document.createElement("span"), { className: "when", textContent: when }));
  }
  return b;
}
const switcherLabel = (text) => Object.assign(document.createElement("h2"), { textContent: text });

// Typed path: only in a plain browser. With the desktop shell, "Open folder..." shows its picker instead.
const switcherOpenFolder = async () => {
  if (window.aidea) { closeSwitcher(); homeOpenFolder(); return; }
  $("open").hidden = false;
  $("path").focus();
};
$("switcher-open").onclick = switcherOpenFolder;
$("open").addEventListener("submit", closeSwitcher);
// Home's "Open folder" button has no box of its own in a plain browser: it opens the switcher on the typed path.
if ($("home-open") && !window.aidea) $("home-open").onclick = async () => { if (switcherMenu.hidden) await openSwitcher(); switcherOpenFolder(); };

const switcherHome = () => {
  closeSwitcher();
  $("home").hidden = false;
  refreshHome();
  refreshSwitcherLabel();
};
$("switcher-home").onclick = switcherHome;

// Choosing the Project already open while Home is shown goes back to the work session.
const switcherCurrent = () => { closeSwitcher(); hideHome(); refreshSwitcherLabel(); };

async function openSwitcher() {
  const [recents, projects] = await Promise.all([fetch("/recents").then((r) => r.json()), fetch("/projects").then((r) => r.json())]);
  const here = projects.find((p) => p.id === current);
  const folderKey = (p) => p.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  const sameFolder = (a, b) => folderKey(a) === folderKey(b);
  const others = recents.filter((r) => !(here && sameFolder(r.path, here.path)));
  const parts = [];
  if (here) parts.push(switcherLabel("Current"), switcherRow(here.name, here.path, switcherCurrent, { current: true }));
  if (others.length) {
    parts.push(switcherLabel("Recent"));
    for (const r of others) parts.push(switcherRow(r.name, r.available ? r.path : `${r.path} (folder not found)`, () => { closeSwitcher(); openProject(r.path); }, { when: switcherAgo(r.openedAt), disabled: !r.available }));
  }
  switcherList.replaceChildren(...parts);
  $("open").hidden = true;
  switcherMenu.hidden = false;
  switcherButton.setAttribute("aria-expanded", "true");
}

switcherButton.onclick = () => (switcherMenu.hidden ? openSwitcher() : closeSwitcher());
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !switcherMenu.hidden) { closeSwitcher(); switcherButton.focus(); } });
document.addEventListener("click", (e) => { if (!switcherMenu.hidden && !$("switcher").contains(e.target)) closeSwitcher(); });

// A Project was opened: update the label right away.
const drawWithoutSwitcher = draw;
draw = async (nodes) => {
  refreshSwitcherLabel();
  await drawWithoutSwitcher(nodes);
};
