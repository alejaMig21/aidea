// Home: shown while no Project is open. Lists the recent Projects the core remembers.
// Names here are prefixed "home" because every feature file shares one global scope.
const homeText = (tag, cls, content) => Object.assign(document.createElement(tag), { className: cls, textContent: content });

// "10 min ago", "2 hours ago", "yesterday", "3 days ago", then a date.
function homeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 1440) { const h = Math.floor(min / 60); return `${h} ${h === 1 ? "hour" : "hours"} ago`; }
  const d = Math.floor(min / 1440);
  if (d === 1) return "yesterday";
  return d < 7 ? `${d} days ago` : new Date(iso).toLocaleDateString();
}

async function refreshHome() {
  const recents = await (await fetch("/recents")).json();
  $("home-empty").hidden = recents.length > 0;
  $("recents").replaceChildren(...recents.map((r) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "open";
    b.disabled = !r.available;
    const info = homeText("span", "info", "");
    info.append(homeText("strong", "", r.name), homeText("span", "path", r.path));
    b.append(info, homeText("span", "when", r.available ? `Opened ${homeAgo(r.openedAt)}` : "Folder not found"));
    b.onclick = () => open(r.path);
    li.append(b);
    const f = homeText("button", "forget", "Forget");
    f.title = "Remove from this list; the folder is not touched";
    f.onclick = async () => {
      await fetch("/recents/forget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: r.path }) });
      refreshHome();
    };
    li.append(f);
    return li;
  }));
}
// Open folder: the desktop shell's picker when present (window.aidea), else focus the typed path box.
async function homeOpenFolder() {
  if (!window.aidea) return $("path").focus();
  const folder = await window.aidea.pickFolder();
  if (folder) open(folder);
}
$("home-open").onclick = homeOpenFolder;
const hideHome =() => { $("home").hidden = true; };
// New project: parent folder + name; the core creates the folder, refuses bad names and opens it.
$("home-new").onclick = () => { $("home-new-form").hidden = !$("home-new-form").hidden; };
if (window.aidea) {
  $("home-new-pick").hidden = false;
  $("home-new-pick").onclick = async () => { $("home-new-parent").value = (await window.aidea.pickFolder()) || $("home-new-parent").value; };
}
$("home-new-form").onsubmit = async (e) => {
  e.preventDefault();
  $("home-new-error").textContent = "";
  const res = await fetch("/projects/new", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parent: $("home-new-parent").value.trim(), name: $("home-new-name").value }) });
  if (!res.ok) { $("home-new-error").textContent = (await res.json()).error; return; }
  $("home-new-form").hidden = true;
  open((await res.json()).path); // Reopening is idempotent and runs the normal draw path.
};
refreshHome();
