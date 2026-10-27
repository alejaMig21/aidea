// Top bar: the Project switcher (current Project, recents, "Open folder…", a way back to Home).
// Names here are prefixed "switcher" because every feature file shares one global scope.
// Opening a Project reuses open() from the Canvas file; the recents come from the core (GET /recents).
const switcherButton = $("switcher-button");
const switcherMenu = $("switcher-menu");

const switcherItem = (label, onclick, extra = {}) => {
  const b = Object.assign(document.createElement("button"), { textContent: label, onclick, ...extra });
  b.type = "button";
  return b;
};
const closeSwitcher = () => { switcherMenu.hidden = true; switcherButton.setAttribute("aria-expanded", "false"); };

// The button names the current Project, or says none is open.
async function refreshSwitcherLabel() {
  if (!current) { switcherButton.textContent = "No project open"; return; }
  const project = current;
  const list = await (await fetch("/projects")).json();
  if (project !== current) return;
  const p = list.find((q) => q.id === project);
  switcherButton.textContent = `Project: ${p ? p.name : "unknown"}`;
}

// Same as Home's instruction: type the folder path in the box and choose Open project.
const switcherOpenFolder = () => { closeSwitcher(); $("path").focus(); };

const switcherHome = () => {
  closeSwitcher();
  $("home").hidden = false;
  refreshHome();
};

async function openSwitcher() {
  const [recents, projects] = await Promise.all([fetch("/recents").then((r) => r.json()), fetch("/projects").then((r) => r.json())]);
  const here = projects.find((p) => p.id === current);
  const items = recents.map((r) => {
    const b = switcherItem("", () => { closeSwitcher(); open(r.path); }, { disabled: !r.available });
    b.append(r.name, Object.assign(document.createElement("span"), { className: "path", textContent: r.available ? r.path : `${r.path} (folder not found)` }));
    if (here && r.path === here.path) b.setAttribute("aria-current", "true");
    return b;
  });
  // The current Project is always listed, even if the recents do not hold it.
  if (here && !items.some((b) => b.getAttribute("aria-current"))) {
    const b = switcherItem(here.name, closeSwitcher);
    b.setAttribute("aria-current", "true");
    items.unshift(b);
  }
  switcherMenu.replaceChildren(...items, document.createElement("hr"), switcherItem("Open folder…", switcherOpenFolder), switcherItem("Home", switcherHome));
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
